import { lookup as lookupMime } from 'mime-types';
import { z } from 'zod';
import { AppConfig } from './config.js';
import { Database, DocumentRow } from './db.js';
import { createPublicId } from './ids.js';
import { normalizeAssetPath } from './paths.js';
import { setNested } from './state-paths.js';

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_FILES_PER_DOCUMENT = 100;

const expiresAtSchema = z.union([z.string(), z.date(), z.null()]).optional();

export const fileInputSchema = z.object({
  path: z.string().min(1),
  content: z.string(),
  encoding: z.enum(['utf8', 'base64']).default('utf8'),
  mimeType: z.string().optional()
});

export const createDocumentSchema = z.object({
  title: z.string().max(200).optional(),
  html: z.string().optional(),
  entryPath: z.string().default('index.html'),
  state: z.unknown().default({}),
  expiresAt: expiresAtSchema,
  files: z.array(fileInputSchema).default([])
});

export const updateDocumentSchema = z.object({
  title: z.string().max(200).optional(),
  html: z.string().optional(),
  entryPath: z.string().optional(),
  state: z.unknown().optional(),
  expiresAt: expiresAtSchema,
  files: z.array(fileInputSchema).optional(),
  replaceFiles: z.boolean().default(false)
});

export type FileInput = z.infer<typeof fileInputSchema>;
export type CreateDocumentInput = z.infer<typeof createDocumentSchema>;
export type UpdateDocumentInput = z.infer<typeof updateDocumentSchema>;

export type DocumentSummary = {
  id: string;
  title: string;
  url: string;
  entryPath: string;
  state: unknown;
  expiresAt: string | null;
  isExpired: boolean;
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
};

export type DocumentDetail = DocumentSummary & {
  files: Array<{
    path: string;
    mimeType: string;
    size: number;
    updatedAt: string;
  }>;
};

export class NotFoundError extends Error {
  constructor(message = 'Not found') {
    super(message);
    this.name = 'NotFoundError';
  }
}

export class ExpiredError extends Error {
  constructor(message = 'Document is no longer publicly accessible') {
    super(message);
    this.name = 'ExpiredError';
  }
}

export class DocumentsService {
  constructor(
    private readonly db: Database,
    private readonly config: AppConfig
  ) {}

  urlFor(id: string): string {
    return `${this.config.publicBaseUrl}/d/${id}`;
  }

  async list(): Promise<DocumentSummary[]> {
    const documents = await this.db.listDocuments();
    return documents.map((document) => this.toSummary(document));
  }

  async get(id: string): Promise<DocumentDetail> {
    const document = await this.db.getDocument(id);
    if (!document) {
      throw new NotFoundError(`Document ${id} not found`);
    }
    const files = await this.db.listAssets(id);
    return {
      ...this.toSummary(document),
      files: files.map((file) => ({
        path: file.path,
        mimeType: file.mime_type,
        size: file.size,
        updatedAt: file.updated_at.toISOString()
      }))
    };
  }

  async getPublic(id: string): Promise<DocumentDetail> {
    const document = await this.get(id);
    if (!document.isPublic) {
      throw new ExpiredError(`Document ${id} is no longer publicly accessible`);
    }
    return document;
  }

  async create(input: CreateDocumentInput): Promise<DocumentDetail> {
    const id = createPublicId();
    const entryPath = normalizeAssetPath(input.entryPath);
    const files = this.prepareFiles(input.files, input.html, entryPath);
    const document = await this.db.createDocument({
      id,
      title: input.title ?? '',
      entryPath,
      state: input.state ?? {},
      expiresAt: normalizeExpiresAt(input.expiresAt),
      files
    });
    return {
      ...this.toSummary(document),
      files: files.map((file) => ({
        path: file.path,
        mimeType: file.mimeType,
        size: file.content.byteLength,
        updatedAt: document.updated_at.toISOString()
      }))
    };
  }

  async update(id: string, input: UpdateDocumentInput): Promise<DocumentDetail> {
    const existing = await this.db.getDocument(id);
    if (!existing) {
      throw new NotFoundError(`Document ${id} not found`);
    }

    const entryPath = input.entryPath ? normalizeAssetPath(input.entryPath) : undefined;
    const effectiveEntryPath = entryPath ?? existing.entry_path;
    const files = input.files || input.html !== undefined
      ? this.prepareFiles(input.files ?? [], input.html, effectiveEntryPath, input.replaceFiles)
      : undefined;

    const document = await this.db.replaceDocument({
      id,
      title: input.title,
      entryPath,
      state: input.state,
      expiresAt: input.expiresAt === undefined ? undefined : normalizeExpiresAt(input.expiresAt),
      files,
      replaceFiles: input.replaceFiles
    });
    if (!document) throw new NotFoundError(`Document ${id} not found`);
    return this.get(id);
  }

  async delete(id: string): Promise<void> {
    const deleted = await this.db.deleteDocument(id);
    if (!deleted) {
      throw new NotFoundError(`Document ${id} not found`);
    }
  }

  async getState(id: string): Promise<unknown> {
    const state = await this.db.getState(id);
    if (state === null) {
      throw new NotFoundError(`Document ${id} not found`);
    }
    return state;
  }

  async getPublicState(id: string): Promise<unknown> {
    await this.getPublic(id);
    return this.getState(id);
  }

  async updateState(id: string, state: unknown): Promise<DocumentSummary> {
    const document = await this.db.updateState(id, state);
    if (!document) {
      throw new NotFoundError(`Document ${id} not found`);
    }
    return this.toSummary(document);
  }

  async updatePublicState(id: string, state: unknown): Promise<DocumentSummary> {
    await this.getPublic(id);
    return this.updateState(id, state);
  }

  async patchState(id: string, fields: Record<string, unknown>): Promise<DocumentSummary> {
    const document = await this.db.patchState(id, (currentState) => {
      const base = cloneJson(isObjectLike(currentState) ? currentState : {});
      for (const [path, value] of Object.entries(fields)) {
        setNested(base, path, value);
      }
      return base;
    });
    if (!document) {
      throw new NotFoundError(`Document ${id} not found`);
    }
    return this.toSummary(document);
  }

  async patchPublicState(id: string, fields: Record<string, unknown>): Promise<DocumentSummary> {
    await this.getPublic(id);
    return this.patchState(id, fields);
  }

  private prepareFiles(
    files: FileInput[],
    html: string | undefined,
    entryPath: string,
    requireEntry = true
  ) {
    const map = new Map<string, { path: string; content: Buffer; mimeType: string }>();

    if (html !== undefined) {
      map.set(entryPath, {
        path: entryPath,
        content: Buffer.from(html, 'utf8'),
        mimeType: 'text/html; charset=utf-8'
      });
    }

    for (const file of files) {
      const assetPath = normalizeAssetPath(file.path);
      const content = file.encoding === 'base64'
        ? Buffer.from(file.content, 'base64')
        : Buffer.from(file.content, 'utf8');

      if (content.byteLength > MAX_FILE_BYTES) {
        throw new Error(`File ${assetPath} is too large. Max size is ${MAX_FILE_BYTES} bytes.`);
      }

      map.set(assetPath, {
        path: assetPath,
        content,
        mimeType: file.mimeType ?? inferMimeType(assetPath)
      });
    }

    if (map.size === 0 && requireEntry) {
      map.set(entryPath, {
        path: entryPath,
        content: Buffer.from(defaultHtml(), 'utf8'),
        mimeType: 'text/html; charset=utf-8'
      });
    }

    if (requireEntry && !map.has(entryPath)) {
      throw new Error(`Entry path ${entryPath} must be included in files or html.`);
    }

    if (map.size > MAX_FILES_PER_DOCUMENT) {
      throw new Error(`Too many files. Max is ${MAX_FILES_PER_DOCUMENT}.`);
    }

    return Array.from(map.values());
  }

  private toSummary(document: DocumentRow): DocumentSummary {
    return {
      id: document.id,
      title: document.title,
      url: this.urlFor(document.id),
      entryPath: document.entry_path,
      state: document.state,
      expiresAt: document.expires_at?.toISOString() ?? null,
      isExpired: isExpired(document.expires_at),
      isPublic: !isExpired(document.expires_at),
      createdAt: document.created_at.toISOString(),
      updatedAt: document.updated_at.toISOString()
    };
  }
}

export function isExpired(expiresAt: Date | string | null | undefined, now = new Date()): boolean {
  if (!expiresAt) return false;
  const date = typeof expiresAt === 'string' ? new Date(expiresAt) : expiresAt;
  return date.getTime() <= now.getTime();
}

function normalizeExpiresAt(value: z.infer<typeof expiresAtSchema>): Date | null {
  if (value === undefined || value === null) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error('expiresAt must be a valid ISO date string or Date.');
  }
  return date;
}

function isObjectLike(value: unknown): value is Record<string, unknown> | unknown[] {
  return typeof value === 'object' && value !== null;
}

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function inferMimeType(assetPath: string): string {
  const mimeType = lookupMime(assetPath);
  if (mimeType) {
    if (mimeType.startsWith('text/') || mimeType === 'application/javascript') {
      return `${mimeType}; charset=utf-8`;
    }
    return mimeType;
  }
  return 'application/octet-stream';
}

function defaultHtml(): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Untitled document</title>
</head>
<body>
  <main>
    <h1>Untitled document</h1>
  </main>
</body>
</html>`;
}
