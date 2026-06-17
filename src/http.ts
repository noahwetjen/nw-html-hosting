import express, { NextFunction, Request, Response } from 'express';
import { isNativeError } from 'node:util/types';
import { z } from 'zod';
import { AppConfig } from './config.js';
import { Database } from './db.js';
import { agentHtmlSdk } from './browser-sdk.js';
import { agentHtmlHostCss, designSystemHeadTags } from './design-system.js';
import {
  createDocumentSchema,
  DocumentsService,
  ExpiredError,
  NotFoundError,
  updateDocumentSchema
} from './documents.js';
import { isHtmlPath, normalizeAssetPath } from './paths.js';
import { registerMcpRoutes } from './mcp.js';

const stateBodySchema = z.union([
  z.object({ state: z.unknown() }),
  z.record(z.string(), z.unknown())
]);

const statePatchSchema = z.object({
  fields: z.record(z.string(), z.unknown())
});

export function createHttpApp(config: AppConfig, db: Database): express.Express {
  const app = express();
  const documents = new DocumentsService(db, config);

  app.disable('x-powered-by');
  app.use(express.json({ limit: '25mb' }));
  app.use(securityHeaders);
  app.use(cors);

  app.get('/healthz', (_req, res) => {
    res.json({ ok: true });
  });

  app.get('/agent-html-sdk.js', (_req, res) => {
    res
      .type('application/javascript; charset=utf-8')
      .set('cache-control', 'public, max-age=300')
      .send(agentHtmlSdk);
  });

  app.get(['/agent-html-host.css', '/agent-html-design-system.css'], (_req, res) => {
    res
      .type('text/css; charset=utf-8')
      .set('cache-control', 'public, max-age=300')
      .send(agentHtmlHostCss);
  });

  app.get('/api/documents', requireApiKey(config), async (_req, res, next) => {
    try {
      res.json({ documents: await documents.list() });
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/documents', requireApiKey(config), async (req, res, next) => {
    try {
      const document = await documents.create(createDocumentSchema.parse(req.body));
      res.status(201).json({ document });
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/documents/:id', requireApiKey(config), async (req, res, next) => {
    try {
      res.json({ document: await documents.get(requiredParam(req, 'id')) });
    } catch (error) {
      next(error);
    }
  });

  app.put('/api/documents/:id', requireApiKey(config), async (req, res, next) => {
    try {
      const document = await documents.update(requiredParam(req, 'id'), updateDocumentSchema.parse(req.body));
      res.json({ document });
    } catch (error) {
      next(error);
    }
  });

  app.delete('/api/documents/:id', requireApiKey(config), async (req, res, next) => {
    try {
      await documents.delete(requiredParam(req, 'id'));
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/documents/:id/state', requireApiKey(config), async (req, res, next) => {
    try {
      res.json({ state: await documents.getState(requiredParam(req, 'id')) });
    } catch (error) {
      next(error);
    }
  });

  app.put('/api/documents/:id/state', requireApiKey(config), async (req, res, next) => {
    try {
      const body = stateBodySchema.parse(req.body);
      const state = 'state' in body ? body.state : body;
      const document = await documents.updateState(requiredParam(req, 'id'), state);
      res.json({ state: document.state, document });
    } catch (error) {
      next(error);
    }
  });

  app.patch('/api/documents/:id/state', requireApiKey(config), async (req, res, next) => {
    try {
      const body = statePatchSchema.parse(req.body);
      const document = await documents.patchState(requiredParam(req, 'id'), body.fields);
      res.json({ state: document.state, document });
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/public/documents/:id/state', async (req, res, next) => {
    try {
      res.json({ state: await documents.getPublicState(requiredParam(req, 'id')) });
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/public/documents/:id', async (req, res, next) => {
    try {
      const document = await documents.getPublic(requiredParam(req, 'id'));
      res.json({
        document: {
          id: document.id,
          title: document.title,
          url: document.url,
          entryPath: document.entryPath,
          expiresAt: document.expiresAt,
          isExpired: document.isExpired,
          isPublic: document.isPublic,
          createdAt: document.createdAt,
          updatedAt: document.updatedAt
        }
      });
    } catch (error) {
      next(error);
    }
  });

  app.put('/api/public/documents/:id/state', async (req, res, next) => {
    try {
      const body = stateBodySchema.parse(req.body);
      const state = 'state' in body ? body.state : body;
      const document = await documents.updatePublicState(requiredParam(req, 'id'), state);
      res.json({ state: document.state });
    } catch (error) {
      next(error);
    }
  });

  app.patch('/api/public/documents/:id/state', async (req, res, next) => {
    try {
      const body = statePatchSchema.parse(req.body);
      const document = await documents.patchPublicState(requiredParam(req, 'id'), body.fields);
      res.json({ state: document.state });
    } catch (error) {
      next(error);
    }
  });

  app.get('/d/:id', async (req, res, next) => {
    try {
      const documentId = requiredParam(req, 'id');
      const document = await documents.getPublic(documentId);
      await sendAsset(db, documentId, document.entryPath, res);
    } catch (error) {
      next(error);
    }
  });

  app.get(/^\/d\/([^/]+)\/(.+)$/, async (req, res, next) => {
    try {
      const documentId = regexParam(req, 0);
      const rawAssetPath = regexParam(req, 1);
      const assetPath = normalizeAssetPath(rawAssetPath);
      await documents.getPublic(documentId);
      await sendAsset(db, documentId, assetPath, res);
    } catch (error) {
      next(error);
    }
  });

  registerMcpRoutes(app, config, db);

  app.use((_req, res) => {
    res.status(404).json({ error: 'Not found' });
  });

  app.use(errorHandler);

  return app;
}

function requireApiKey(config: AppConfig) {
  return (req: Request, res: Response, next: NextFunction) => {
    const authorization = req.header('authorization');
    const bearer = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
    const apiKey = bearer ?? req.header('x-api-key');

    if (apiKey !== config.apiKey) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    next();
  };
}

function requiredParam(req: Request, name: string): string {
  const value = req.params[name];
  if (!value || Array.isArray(value)) {
    throw new Error(`Missing route parameter: ${name}`);
  }
  return value;
}

function regexParam(req: Request, index: number): string {
  const value = req.params[index];
  if (!value || Array.isArray(value)) {
    throw new Error(`Missing route parameter: ${index}`);
  }
  return value;
}

function securityHeaders(_req: Request, res: Response, next: NextFunction) {
  res.set({
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'no-referrer',
    'permissions-policy': 'camera=(), microphone=(), geolocation=()'
  });
  next();
}

function cors(req: Request, res: Response, next: NextFunction) {
  res.set({
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
    'access-control-allow-headers': 'content-type,authorization,x-api-key'
  });
  if (req.method === 'OPTIONS') {
    res.status(204).send();
    return;
  }
  next();
}

async function sendAsset(db: Database, documentId: string, assetPath: string, res: Response) {
  const asset = await db.getAsset(documentId, assetPath);
  if (!asset) {
    throw new NotFoundError(`Asset ${assetPath} not found`);
  }

  res.set('cache-control', 'no-store');
  res.type(asset.mime_type);

  if (isHtmlPath(asset.path)) {
    const html = asset.content.toString('utf8');
    res.send(injectHtmlShell(html, documentId));
    return;
  }

  res.send(asset.content);
}

function injectHtmlShell(html: string, documentId: string): string {
  let nextHtml = injectBase(html, documentId);
  nextHtml = injectDarkTheme(nextHtml);
  nextHtml = injectDesignSystem(nextHtml);
  nextHtml = injectSdk(nextHtml);
  return nextHtml;
}

function injectBase(html: string, documentId: string): string {
  if (/<base\s/i.test(html)) {
    return html;
  }

  const base = `<base href="/d/${encodeURIComponent(documentId)}/">`;
  if (/<head[^>]*>/i.test(html)) {
    return html.replace(/<head[^>]*>/i, (match) => `${match}${base}`);
  }

  return `${base}\n${html}`;
}

function injectSdk(html: string): string {
  if (html.includes('/agent-html-sdk.js')) {
    return html;
  }

  const script = '<script src="/agent-html-sdk.js" defer></script>';
  if (html.includes('</body>')) {
    return html.replace('</body>', `${script}\n</body>`);
  }
  return `${html}\n${script}`;
}

function injectDarkTheme(html: string): string {
  if (!/<html\b/i.test(html) || /<html[^>]*\sdata-theme=/i.test(html) || /data-agent-ui=["']off["']/i.test(html)) {
    return html;
  }

  return html.replace(/<html\b/i, '<html data-theme="dark"');
}

function injectDesignSystem(html: string): string {
  if (
    html.includes('cdn.jsdelivr.net/npm/daisyui@5') ||
    html.includes('data-agent-design-system="daisyui"') ||
    /data-agent-ui=["']off["']/i.test(html) ||
    /data-agent-theme=["']off["']/i.test(html)
  ) {
    return html;
  }

  if (/<head[^>]*>/i.test(html)) {
    return html.replace(/<head[^>]*>/i, (match) => `${match}\n${designSystemHeadTags}`);
  }
  return `${designSystemHeadTags}\n${html}`;
}

function errorHandler(error: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (error instanceof NotFoundError) {
    res.status(404).json({ error: error.message });
    return;
  }

  if (error instanceof ExpiredError) {
    res.status(410).json({ error: error.message });
    return;
  }

  if (error instanceof z.ZodError) {
    res.status(400).json({ error: 'Invalid request body', issues: error.issues });
    return;
  }

  if (isNativeError(error)) {
    res.status(400).json({ error: error.message });
    return;
  }

  res.status(500).json({ error: 'Internal server error' });
}
