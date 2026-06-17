import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { Express, NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { AppConfig } from './config.js';
import { Database } from './db.js';
import {
  createDocumentSchema,
  DocumentsService,
  updateDocumentSchema
} from './documents.js';

const fileInputShape = {
  path: z.string().describe('Relative file path such as index.html, styles.css, app.js, or assets/logo.png.'),
  content: z.string().describe('File content as UTF-8 text or base64 when encoding is base64.'),
  encoding: z.enum(['utf8', 'base64']).default('utf8'),
  mimeType: z.string().optional().describe('Optional MIME type. Inferred from path when omitted.')
};

export function registerMcpRoutes(app: Express, config: AppConfig, db: Database): void {
  app.post('/mcp', requireApiKey(config), async (req, res) => {
    const server = createMcpServer(config, db);
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined
    });

    try {
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
      res.on('close', () => {
        void transport.close();
        void server.close();
      });
    } catch (error) {
      console.error('MCP request failed', error);
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: '2.0',
          error: {
            code: -32603,
            message: 'Internal server error'
          },
          id: null
        });
      }
    }
  });

  app.get('/mcp', (_req, res) => {
    res.status(405).json({
      jsonrpc: '2.0',
      error: { code: -32000, message: 'Use POST for Streamable HTTP MCP.' },
      id: null
    });
  });
}

function createMcpServer(config: AppConfig, db: Database): McpServer {
  const documents = new DocumentsService(db, config);
  const server = new McpServer({
    name: 'shareable-agent-html',
    version: '0.1.0'
  });

  server.registerTool(
    'list_documents',
    {
      title: 'List hosted HTML documents',
      description: 'List all hosted shareable HTML documents and their current shared JSON state.'
    },
    async () => jsonResult({ documents: await documents.list() })
  );

  server.registerTool(
    'create_document',
    {
      title: 'Create hosted HTML document',
      description: [
        'Create a public shareable HTML document or mini-site.',
        'Use html for a single index.html page, or files for index.html plus CSS, JS, and images.',
        'Interactive fields are saved automatically when the page contains form controls with data-field attributes.'
      ].join(' '),
      inputSchema: {
        title: z.string().max(200).optional(),
        html: z.string().optional().describe('Convenience field for a single HTML entry file.'),
        entryPath: z.string().default('index.html'),
        state: z.unknown().default({}).describe('Initial shared JSON state.'),
        files: z.array(z.object(fileInputShape)).default([])
      }
    },
    async (input) => {
      const document = await documents.create(createDocumentSchema.parse(input));
      return jsonResult({ document });
    }
  );

  server.registerTool(
    'get_document',
    {
      title: 'Get hosted HTML document metadata',
      description: 'Get metadata, public URL, file list, and current shared JSON state for a document.',
      inputSchema: {
        id: z.string()
      }
    },
    async ({ id }) => jsonResult({ document: await documents.get(id) })
  );

  server.registerTool(
    'update_document',
    {
      title: 'Update hosted HTML document',
      description: [
        'Update document metadata, state, or files.',
        'Set replaceFiles=true to replace the whole mini-site; otherwise provided files are upserted.'
      ].join(' '),
      inputSchema: {
        id: z.string(),
        title: z.string().max(200).optional(),
        html: z.string().optional(),
        entryPath: z.string().optional(),
        state: z.unknown().optional(),
        files: z.array(z.object(fileInputShape)).optional(),
        replaceFiles: z.boolean().default(false)
      }
    },
    async ({ id, ...input }) => {
      const document = await documents.update(id, updateDocumentSchema.parse(input));
      return jsonResult({ document });
    }
  );

  server.registerTool(
    'delete_document',
    {
      title: 'Delete hosted HTML document',
      description: 'Delete a hosted document, its assets, and its shared JSON state.',
      inputSchema: {
        id: z.string()
      }
    },
    async ({ id }) => {
      await documents.delete(id);
      return jsonResult({ deleted: true, id });
    }
  );

  server.registerTool(
    'get_document_state',
    {
      title: 'Get shared JSON state',
      description: 'Get the current shared JSON state submitted through the public HTML page.',
      inputSchema: {
        id: z.string()
      }
    },
    async ({ id }) => jsonResult({ id, state: await documents.getState(id) })
  );

  server.registerTool(
    'update_document_state',
    {
      title: 'Update shared JSON state',
      description: 'Overwrite the current shared JSON state for a public HTML document.',
      inputSchema: {
        id: z.string(),
        state: z.unknown()
      }
    },
    async ({ id, state }) => {
      const document = await documents.updateState(id, state);
      return jsonResult({ document });
    }
  );

  server.registerTool(
    'patch_document_state',
    {
      title: 'Patch shared JSON state fields',
      description: 'Patch specific shared JSON state fields by data-field path without replacing the full state.',
      inputSchema: {
        id: z.string(),
        fields: z.record(z.string(), z.unknown()).describe('Map of data-field paths to values, for example {"pages.0.action":"remove"}.')
      }
    },
    async ({ id, fields }) => {
      const document = await documents.patchState(id, fields);
      return jsonResult({ document });
    }
  );

  return server;
}

function jsonResult(value: unknown) {
  return {
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify(value, null, 2)
      }
    ]
  };
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
