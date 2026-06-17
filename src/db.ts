import pg from 'pg';
import { AppConfig } from './config.js';

export type DocumentRow = {
  id: string;
  title: string;
  entry_path: string;
  state: unknown;
  created_at: Date;
  updated_at: Date;
};

export type AssetRow = {
  document_id: string;
  path: string;
  content: Buffer;
  mime_type: string;
  created_at: Date;
  updated_at: Date;
};

export type AssetSummary = {
  path: string;
  mime_type: string;
  size: number;
  updated_at: Date;
};

export class Database {
  private pool: pg.Pool;

  constructor(config: AppConfig) {
    this.pool = new pg.Pool({
      connectionString: config.databaseUrl,
      ssl: config.databaseUrl.includes('railway.app') || process.env.PGSSLMODE === 'require'
        ? { rejectUnauthorized: false }
        : undefined
    });
  }

  async migrate(): Promise<void> {
    await this.withConnectionRetry(async () => {
      await this.pool.query(`
        create table if not exists documents (
          id text primary key,
          title text not null default '',
          entry_path text not null default 'index.html',
          state jsonb not null default '{}'::jsonb,
          created_at timestamptz not null default now(),
          updated_at timestamptz not null default now()
        );

        create table if not exists assets (
          document_id text not null references documents(id) on delete cascade,
          path text not null,
          content bytea not null,
          mime_type text not null,
          created_at timestamptz not null default now(),
          updated_at timestamptz not null default now(),
          primary key (document_id, path)
        );

        create index if not exists documents_updated_at_idx on documents (updated_at desc);
      `);
    });
  }

  async close(): Promise<void> {
    await this.pool.end();
  }

  async listDocuments(): Promise<DocumentRow[]> {
    const result = await this.pool.query<DocumentRow>(`
      select id, title, entry_path, state, created_at, updated_at
      from documents
      order by updated_at desc
    `);
    return result.rows;
  }

  async getDocument(id: string): Promise<DocumentRow | null> {
    const result = await this.pool.query<DocumentRow>(
      `select id, title, entry_path, state, created_at, updated_at from documents where id = $1`,
      [id]
    );
    return result.rows[0] ?? null;
  }

  async createDocument(input: {
    id: string;
    title: string;
    entryPath: string;
    state: unknown;
    files: Array<{ path: string; content: Buffer; mimeType: string }>;
  }): Promise<DocumentRow> {
    const client = await this.pool.connect();
    try {
      await client.query('begin');
      const docResult = await client.query<DocumentRow>(
        `
          insert into documents (id, title, entry_path, state)
          values ($1, $2, $3, $4::jsonb)
          returning id, title, entry_path, state, created_at, updated_at
        `,
        [input.id, input.title, input.entryPath, JSON.stringify(input.state)]
      );

      for (const file of input.files) {
        await client.query(
          `
            insert into assets (document_id, path, content, mime_type)
            values ($1, $2, $3, $4)
          `,
          [input.id, file.path, file.content, file.mimeType]
        );
      }

      await client.query('commit');
      return docResult.rows[0];
    } catch (error) {
      await client.query('rollback');
      throw error;
    } finally {
      client.release();
    }
  }

  async replaceDocument(input: {
    id: string;
    title?: string;
    entryPath?: string;
    state?: unknown;
    files?: Array<{ path: string; content: Buffer; mimeType: string }>;
    replaceFiles: boolean;
  }): Promise<DocumentRow | null> {
    const client = await this.pool.connect();
    try {
      await client.query('begin');
      const existing = await client.query<DocumentRow>(
        `select id, title, entry_path, state, created_at, updated_at from documents where id = $1 for update`,
        [input.id]
      );
      if (!existing.rows[0]) {
        await client.query('rollback');
        return null;
      }

      if (input.replaceFiles) {
        await client.query(`delete from assets where document_id = $1`, [input.id]);
      }

      for (const file of input.files ?? []) {
        await client.query(
          `
            insert into assets (document_id, path, content, mime_type)
            values ($1, $2, $3, $4)
            on conflict (document_id, path)
            do update set content = excluded.content, mime_type = excluded.mime_type, updated_at = now()
          `,
          [input.id, file.path, file.content, file.mimeType]
        );
      }

      const updated = await client.query<DocumentRow>(
        `
          update documents
          set
            title = coalesce($2, title),
            entry_path = coalesce($3, entry_path),
            state = coalesce($4::jsonb, state),
            updated_at = now()
          where id = $1
          returning id, title, entry_path, state, created_at, updated_at
        `,
        [
          input.id,
          input.title ?? null,
          input.entryPath ?? null,
          input.state === undefined ? null : JSON.stringify(input.state)
        ]
      );

      await client.query('commit');
      return updated.rows[0];
    } catch (error) {
      await client.query('rollback');
      throw error;
    } finally {
      client.release();
    }
  }

  async deleteDocument(id: string): Promise<boolean> {
    const result = await this.pool.query(`delete from documents where id = $1`, [id]);
    return (result.rowCount ?? 0) > 0;
  }

  async getAsset(documentId: string, assetPath: string): Promise<AssetRow | null> {
    const result = await this.pool.query<AssetRow>(
      `
        select document_id, path, content, mime_type, created_at, updated_at
        from assets
        where document_id = $1 and path = $2
      `,
      [documentId, assetPath]
    );
    return result.rows[0] ?? null;
  }

  async listAssets(documentId: string): Promise<AssetSummary[]> {
    const result = await this.pool.query<AssetSummary>(
      `
        select path, mime_type, octet_length(content) as size, updated_at
        from assets
        where document_id = $1
        order by path asc
      `,
      [documentId]
    );
    return result.rows;
  }

  async getState(documentId: string): Promise<unknown | null> {
    const result = await this.pool.query<{ state: unknown }>(
      `select state from documents where id = $1`,
      [documentId]
    );
    return result.rows[0]?.state ?? null;
  }

  async updateState(documentId: string, state: unknown): Promise<DocumentRow | null> {
    const result = await this.pool.query<DocumentRow>(
      `
        update documents
        set state = $2::jsonb, updated_at = now()
        where id = $1
        returning id, title, entry_path, state, created_at, updated_at
      `,
      [documentId, JSON.stringify(state)]
    );
    return result.rows[0] ?? null;
  }

  async patchState(
    documentId: string,
    patcher: (state: unknown) => unknown
  ): Promise<DocumentRow | null> {
    const client = await this.pool.connect();
    try {
      await client.query('begin');
      const current = await client.query<{ state: unknown }>(
        `select state from documents where id = $1 for update`,
        [documentId]
      );
      if (!current.rows[0]) {
        await client.query('rollback');
        return null;
      }

      const nextState = patcher(current.rows[0].state);
      const updated = await client.query<DocumentRow>(
        `
          update documents
          set state = $2::jsonb, updated_at = now()
          where id = $1
          returning id, title, entry_path, state, created_at, updated_at
        `,
        [documentId, JSON.stringify(nextState)]
      );

      await client.query('commit');
      return updated.rows[0];
    } catch (error) {
      await client.query('rollback');
      throw error;
    } finally {
      client.release();
    }
  }

  private async withConnectionRetry(operation: () => Promise<void>): Promise<void> {
    const maxAttempts = 20;
    let lastError: unknown;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        await operation();
        return;
      } catch (error) {
        lastError = error;
        if (attempt === maxAttempts) break;
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }

    throw lastError;
  }
}
