import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { getBlobRootDir, getDbBaseDirPath, getSqliteDb } from '~/server/db/sqlite';

interface BlobRef {
  kind: string;
  sha256: string;
  file_type: string;
  size: number;
  relative_path: string;
}

interface HtmlRecord {
  fakeid: string;
  url: string;
  title: string;
  commentID: string | null;
  blob: BlobRef;
}

interface ResourceRecord {
  fakeid: string;
  url: string;
  blob: BlobRef;
}

interface AssetRecord {
  fakeid: string;
  url: string;
  blob: BlobRef;
}

interface DebugRecord {
  type: string;
  url: string;
  title: string;
  fakeid: string;
  blob: BlobRef;
}

interface MetadataRecord {
  fakeid: string;
  url: string;
  title: string;
  [key: string]: any;
}

interface CommentRecord {
  fakeid: string;
  url: string;
  title: string;
  data: any;
}

interface CommentReplyRecord {
  fakeid: string;
  url: string;
  title: string;
  data: any;
  contentID: string;
}

interface ResourceMapRecord {
  fakeid: string;
  url: string;
  resources: string[];
}

interface LegacyContentDbState {
  html?: Record<string, HtmlRecord>;
  metadata?: Record<string, MetadataRecord>;
  comment?: Record<string, CommentRecord>;
  commentReply?: Record<string, CommentReplyRecord>;
  resource?: Record<string, ResourceRecord>;
  resourceMap?: Record<string, ResourceMapRecord>;
  asset?: Record<string, AssetRecord>;
  debug?: Record<string, DebugRecord>;
}

interface BlobRow {
  blob_kind: string;
  blob_sha256: string;
  blob_file_type: string;
  blob_size: number;
  blob_relative_path: string;
}

let initialized = false;

function ensureSchemaAndMigrate(): void {
  if (initialized) {
    return;
  }

  const db = getSqliteDb();
  db.exec(`
    CREATE TABLE IF NOT EXISTS html (
      url TEXT PRIMARY KEY,
      fakeid TEXT NOT NULL,
      title TEXT NOT NULL,
      comment_id TEXT,
      blob_kind TEXT NOT NULL,
      blob_sha256 TEXT NOT NULL,
      blob_file_type TEXT NOT NULL,
      blob_size INTEGER NOT NULL,
      blob_relative_path TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS metadata (
      url TEXT PRIMARY KEY,
      fakeid TEXT NOT NULL,
      payload TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS comment (
      url TEXT PRIMARY KEY,
      fakeid TEXT NOT NULL,
      payload TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS comment_reply (
      url TEXT NOT NULL,
      content_id TEXT NOT NULL,
      fakeid TEXT NOT NULL,
      payload TEXT NOT NULL,
      PRIMARY KEY(url, content_id)
    );

    CREATE TABLE IF NOT EXISTS resource (
      url TEXT PRIMARY KEY,
      fakeid TEXT NOT NULL,
      blob_kind TEXT NOT NULL,
      blob_sha256 TEXT NOT NULL,
      blob_file_type TEXT NOT NULL,
      blob_size INTEGER NOT NULL,
      blob_relative_path TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS resource_map (
      url TEXT PRIMARY KEY,
      fakeid TEXT NOT NULL,
      payload TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS asset (
      url TEXT PRIMARY KEY,
      fakeid TEXT NOT NULL,
      blob_kind TEXT NOT NULL,
      blob_sha256 TEXT NOT NULL,
      blob_file_type TEXT NOT NULL,
      blob_size INTEGER NOT NULL,
      blob_relative_path TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS debug (
      url TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      fakeid TEXT NOT NULL,
      blob_kind TEXT NOT NULL,
      blob_sha256 TEXT NOT NULL,
      blob_file_type TEXT NOT NULL,
      blob_size INTEGER NOT NULL,
      blob_relative_path TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_html_fakeid ON html(fakeid);
    CREATE INDEX IF NOT EXISTS idx_metadata_fakeid ON metadata(fakeid);
    CREATE INDEX IF NOT EXISTS idx_comment_fakeid ON comment(fakeid);
    CREATE INDEX IF NOT EXISTS idx_comment_reply_fakeid ON comment_reply(fakeid);
    CREATE INDEX IF NOT EXISTS idx_resource_fakeid ON resource(fakeid);
    CREATE INDEX IF NOT EXISTS idx_resource_map_fakeid ON resource_map(fakeid);
    CREATE INDEX IF NOT EXISTS idx_asset_fakeid ON asset(fakeid);
    CREATE INDEX IF NOT EXISTS idx_debug_fakeid ON debug(fakeid);
  `);

  migrateLegacyJsonIfNeeded();
  initialized = true;
}

function tableCount(tableName: string): number {
  const db = getSqliteDb();
  const row = db.prepare(`SELECT COUNT(*) as count FROM ${tableName}`).get() as { count: number };
  return row.count;
}

function migrateLegacyJsonIfNeeded(): void {
  const hasData =
    tableCount('html') > 0 ||
    tableCount('metadata') > 0 ||
    tableCount('comment') > 0 ||
    tableCount('comment_reply') > 0 ||
    tableCount('resource') > 0 ||
    tableCount('resource_map') > 0 ||
    tableCount('asset') > 0 ||
    tableCount('debug') > 0;

  if (hasData) {
    return;
  }

  const legacyPath = path.join(getDbBaseDirPath(), 'content-db.json');
  if (!existsSync(legacyPath)) {
    return;
  }

  try {
    const parsed = JSON.parse(readFileSync(legacyPath, 'utf-8')) as LegacyContentDbState;
    const db = getSqliteDb();

    const tx = db.transaction(() => {
      const upsertHtml = db.prepare(`
        INSERT INTO html (
          url, fakeid, title, comment_id,
          blob_kind, blob_sha256, blob_file_type, blob_size, blob_relative_path
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(url) DO UPDATE SET
          fakeid = excluded.fakeid,
          title = excluded.title,
          comment_id = excluded.comment_id,
          blob_kind = excluded.blob_kind,
          blob_sha256 = excluded.blob_sha256,
          blob_file_type = excluded.blob_file_type,
          blob_size = excluded.blob_size,
          blob_relative_path = excluded.blob_relative_path
      `);

      const upsertPayloadByUrl = {
        metadata: db.prepare(`
          INSERT INTO metadata (url, fakeid, payload)
          VALUES (?, ?, ?)
          ON CONFLICT(url) DO UPDATE SET fakeid = excluded.fakeid, payload = excluded.payload
        `),
        comment: db.prepare(`
          INSERT INTO comment (url, fakeid, payload)
          VALUES (?, ?, ?)
          ON CONFLICT(url) DO UPDATE SET fakeid = excluded.fakeid, payload = excluded.payload
        `),
        resourceMap: db.prepare(`
          INSERT INTO resource_map (url, fakeid, payload)
          VALUES (?, ?, ?)
          ON CONFLICT(url) DO UPDATE SET fakeid = excluded.fakeid, payload = excluded.payload
        `),
      };

      const upsertCommentReply = db.prepare(`
        INSERT INTO comment_reply (url, content_id, fakeid, payload)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(url, content_id) DO UPDATE SET fakeid = excluded.fakeid, payload = excluded.payload
      `);

      const upsertResource = db.prepare(`
        INSERT INTO resource (
          url, fakeid, blob_kind, blob_sha256, blob_file_type, blob_size, blob_relative_path
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(url) DO UPDATE SET
          fakeid = excluded.fakeid,
          blob_kind = excluded.blob_kind,
          blob_sha256 = excluded.blob_sha256,
          blob_file_type = excluded.blob_file_type,
          blob_size = excluded.blob_size,
          blob_relative_path = excluded.blob_relative_path
      `);

      const upsertAsset = db.prepare(`
        INSERT INTO asset (
          url, fakeid, blob_kind, blob_sha256, blob_file_type, blob_size, blob_relative_path
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(url) DO UPDATE SET
          fakeid = excluded.fakeid,
          blob_kind = excluded.blob_kind,
          blob_sha256 = excluded.blob_sha256,
          blob_file_type = excluded.blob_file_type,
          blob_size = excluded.blob_size,
          blob_relative_path = excluded.blob_relative_path
      `);

      const upsertDebug = db.prepare(`
        INSERT INTO debug (
          url, type, title, fakeid,
          blob_kind, blob_sha256, blob_file_type, blob_size, blob_relative_path
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(url) DO UPDATE SET
          type = excluded.type,
          title = excluded.title,
          fakeid = excluded.fakeid,
          blob_kind = excluded.blob_kind,
          blob_sha256 = excluded.blob_sha256,
          blob_file_type = excluded.blob_file_type,
          blob_size = excluded.blob_size,
          blob_relative_path = excluded.blob_relative_path
      `);

      for (const item of Object.values(parsed.html || {})) {
        if (!item?.url || !item?.fakeid || !item?.title || !item?.blob) {
          continue;
        }
        upsertHtml.run(
          item.url,
          item.fakeid,
          item.title,
          item.commentID,
          item.blob.kind,
          item.blob.sha256,
          item.blob.file_type,
          Number(item.blob.size) || 0,
          item.blob.relative_path
        );
      }

      for (const item of Object.values(parsed.metadata || {})) {
        if (!item?.url || !item?.fakeid) {
          continue;
        }
        upsertPayloadByUrl.metadata.run(item.url, item.fakeid, JSON.stringify(item));
      }

      for (const item of Object.values(parsed.comment || {})) {
        if (!item?.url || !item?.fakeid) {
          continue;
        }
        upsertPayloadByUrl.comment.run(item.url, item.fakeid, JSON.stringify(item));
      }

      for (const item of Object.values(parsed.commentReply || {})) {
        if (!item?.url || !item?.fakeid || !item?.contentID) {
          continue;
        }
        upsertCommentReply.run(item.url, item.contentID, item.fakeid, JSON.stringify(item));
      }

      for (const item of Object.values(parsed.resource || {})) {
        if (!item?.url || !item?.fakeid || !item?.blob) {
          continue;
        }
        upsertResource.run(
          item.url,
          item.fakeid,
          item.blob.kind,
          item.blob.sha256,
          item.blob.file_type,
          Number(item.blob.size) || 0,
          item.blob.relative_path
        );
      }

      for (const item of Object.values(parsed.resourceMap || {})) {
        if (!item?.url || !item?.fakeid) {
          continue;
        }
        upsertPayloadByUrl.resourceMap.run(item.url, item.fakeid, JSON.stringify(item));
      }

      for (const item of Object.values(parsed.asset || {})) {
        if (!item?.url || !item?.fakeid || !item?.blob) {
          continue;
        }
        upsertAsset.run(
          item.url,
          item.fakeid,
          item.blob.kind,
          item.blob.sha256,
          item.blob.file_type,
          Number(item.blob.size) || 0,
          item.blob.relative_path
        );
      }

      for (const item of Object.values(parsed.debug || {})) {
        if (!item?.url || !item?.fakeid || !item?.title || !item?.type || !item?.blob) {
          continue;
        }
        upsertDebug.run(
          item.url,
          item.type,
          item.title,
          item.fakeid,
          item.blob.kind,
          item.blob.sha256,
          item.blob.file_type,
          Number(item.blob.size) || 0,
          item.blob.relative_path
        );
      }
    });

    tx();
  } catch (error) {
    console.error('Failed to migrate legacy content-db.json into sqlite:', error);
  }
}

function parsePayload<T>(payload: string): T | undefined {
  try {
    return JSON.parse(payload) as T;
  } catch {
    return undefined;
  }
}

function toBlobRef(row: BlobRow): BlobRef {
  return {
    kind: row.blob_kind,
    sha256: row.blob_sha256,
    file_type: row.blob_file_type,
    size: Number(row.blob_size) || 0,
    relative_path: row.blob_relative_path,
  };
}

async function saveBlob(kind: string, base64: string, fileType?: string): Promise<BlobRef> {
  const bytes = Buffer.from(base64, 'base64');
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  const relativePath = path.join(kind, sha256);
  const absPath = path.join(getBlobRootDir(), relativePath);

  await fs.mkdir(path.dirname(absPath), { recursive: true });
  try {
    await fs.access(absPath);
  } catch {
    await fs.writeFile(absPath, bytes);
  }

  return {
    kind,
    sha256,
    file_type: fileType || 'application/octet-stream',
    size: bytes.length,
    relative_path: relativePath,
  };
}

async function readBlobAsBase64(ref: BlobRef): Promise<string> {
  const absPath = path.join(getBlobRootDir(), ref.relative_path);
  const bytes = await fs.readFile(absPath);
  return bytes.toString('base64');
}

export async function upsertHtmlToDb(payload: {
  fakeid: string;
  url: string;
  title: string;
  commentID: string | null;
  file_base64: string;
  file_type?: string;
}): Promise<boolean> {
  ensureSchemaAndMigrate();
  const blob = await saveBlob('html', payload.file_base64, payload.file_type);

  getSqliteDb()
    .prepare(`
      INSERT INTO html (
        url, fakeid, title, comment_id,
        blob_kind, blob_sha256, blob_file_type, blob_size, blob_relative_path
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(url) DO UPDATE SET
        fakeid = excluded.fakeid,
        title = excluded.title,
        comment_id = excluded.comment_id,
        blob_kind = excluded.blob_kind,
        blob_sha256 = excluded.blob_sha256,
        blob_file_type = excluded.blob_file_type,
        blob_size = excluded.blob_size,
        blob_relative_path = excluded.blob_relative_path
    `)
    .run(
      payload.url,
      payload.fakeid,
      payload.title,
      payload.commentID,
      blob.kind,
      blob.sha256,
      blob.file_type,
      blob.size,
      blob.relative_path
    );

  return true;
}

export async function getHtmlFromDb(url: string): Promise<
  | {
      fakeid: string;
      url: string;
      title: string;
      commentID: string | null;
      file_base64: string;
      file_type: string;
    }
  | undefined
> {
  ensureSchemaAndMigrate();
  const row = getSqliteDb()
    .prepare(`
      SELECT
        fakeid, url, title, comment_id,
        blob_kind, blob_sha256, blob_file_type, blob_size, blob_relative_path
      FROM html
      WHERE url = ?
    `)
    .get(url) as
    | (BlobRow & {
        fakeid: string;
        url: string;
        title: string;
        comment_id: string | null;
      })
    | undefined;

  if (!row) {
    return undefined;
  }

  const blob = toBlobRef(row);
  return {
    fakeid: row.fakeid,
    url: row.url,
    title: row.title,
    commentID: row.comment_id,
    file_base64: await readBlobAsBase64(blob),
    file_type: blob.file_type,
  };
}

export async function deleteHtmlFromDb(url: string): Promise<boolean> {
  ensureSchemaAndMigrate();
  const result = getSqliteDb().prepare('DELETE FROM html WHERE url = ?').run(url);
  return result.changes > 0;
}

export async function upsertMetadataToDb(payload: MetadataRecord): Promise<boolean> {
  ensureSchemaAndMigrate();
  getSqliteDb()
    .prepare(`
      INSERT INTO metadata (url, fakeid, payload)
      VALUES (?, ?, ?)
      ON CONFLICT(url) DO UPDATE SET fakeid = excluded.fakeid, payload = excluded.payload
    `)
    .run(payload.url, payload.fakeid, JSON.stringify(payload));

  return true;
}

export async function getMetadataFromDb(url: string): Promise<MetadataRecord | undefined> {
  ensureSchemaAndMigrate();
  const row = getSqliteDb().prepare('SELECT payload FROM metadata WHERE url = ?').get(url) as
    | {
        payload: string;
      }
    | undefined;

  if (!row) {
    return undefined;
  }

  return parsePayload<MetadataRecord>(row.payload);
}

export async function upsertCommentToDb(payload: CommentRecord): Promise<boolean> {
  ensureSchemaAndMigrate();
  getSqliteDb()
    .prepare(`
      INSERT INTO comment (url, fakeid, payload)
      VALUES (?, ?, ?)
      ON CONFLICT(url) DO UPDATE SET fakeid = excluded.fakeid, payload = excluded.payload
    `)
    .run(payload.url, payload.fakeid, JSON.stringify(payload));

  return true;
}

export async function getCommentFromDb(url: string): Promise<CommentRecord | undefined> {
  ensureSchemaAndMigrate();
  const row = getSqliteDb().prepare('SELECT payload FROM comment WHERE url = ?').get(url) as
    | {
        payload: string;
      }
    | undefined;

  if (!row) {
    return undefined;
  }

  return parsePayload<CommentRecord>(row.payload);
}

export async function upsertCommentReplyToDb(payload: CommentReplyRecord): Promise<boolean> {
  ensureSchemaAndMigrate();
  getSqliteDb()
    .prepare(`
      INSERT INTO comment_reply (url, content_id, fakeid, payload)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(url, content_id) DO UPDATE SET fakeid = excluded.fakeid, payload = excluded.payload
    `)
    .run(payload.url, payload.contentID, payload.fakeid, JSON.stringify(payload));

  return true;
}

export async function getCommentReplyFromDb(url: string, contentID: string): Promise<CommentReplyRecord | undefined> {
  ensureSchemaAndMigrate();
  const row = getSqliteDb()
    .prepare('SELECT payload FROM comment_reply WHERE url = ? AND content_id = ?')
    .get(url, contentID) as
    | {
        payload: string;
      }
    | undefined;

  if (!row) {
    return undefined;
  }

  return parsePayload<CommentReplyRecord>(row.payload);
}

export async function upsertResourceToDb(payload: {
  fakeid: string;
  url: string;
  file_base64: string;
  file_type?: string;
}): Promise<boolean> {
  ensureSchemaAndMigrate();
  const blob = await saveBlob('resource', payload.file_base64, payload.file_type);

  getSqliteDb()
    .prepare(`
      INSERT INTO resource (url, fakeid, blob_kind, blob_sha256, blob_file_type, blob_size, blob_relative_path)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(url) DO UPDATE SET
        fakeid = excluded.fakeid,
        blob_kind = excluded.blob_kind,
        blob_sha256 = excluded.blob_sha256,
        blob_file_type = excluded.blob_file_type,
        blob_size = excluded.blob_size,
        blob_relative_path = excluded.blob_relative_path
    `)
    .run(payload.url, payload.fakeid, blob.kind, blob.sha256, blob.file_type, blob.size, blob.relative_path);

  return true;
}

export async function getResourceFromDb(url: string): Promise<
  | {
      fakeid: string;
      url: string;
      file_base64: string;
      file_type: string;
    }
  | undefined
> {
  ensureSchemaAndMigrate();
  const row = getSqliteDb()
    .prepare(`
      SELECT fakeid, url, blob_kind, blob_sha256, blob_file_type, blob_size, blob_relative_path
      FROM resource
      WHERE url = ?
    `)
    .get(url) as
    | (BlobRow & {
        fakeid: string;
        url: string;
      })
    | undefined;

  if (!row) {
    return undefined;
  }

  const blob = toBlobRef(row);
  return {
    fakeid: row.fakeid,
    url: row.url,
    file_base64: await readBlobAsBase64(blob),
    file_type: blob.file_type,
  };
}

export async function upsertResourceMapToDb(payload: ResourceMapRecord): Promise<boolean> {
  ensureSchemaAndMigrate();
  getSqliteDb()
    .prepare(`
      INSERT INTO resource_map (url, fakeid, payload)
      VALUES (?, ?, ?)
      ON CONFLICT(url) DO UPDATE SET fakeid = excluded.fakeid, payload = excluded.payload
    `)
    .run(payload.url, payload.fakeid, JSON.stringify(payload));

  return true;
}

export async function getResourceMapFromDb(url: string): Promise<ResourceMapRecord | undefined> {
  ensureSchemaAndMigrate();
  const row = getSqliteDb().prepare('SELECT payload FROM resource_map WHERE url = ?').get(url) as
    | {
        payload: string;
      }
    | undefined;

  if (!row) {
    return undefined;
  }

  return parsePayload<ResourceMapRecord>(row.payload);
}

export async function upsertAssetToDb(payload: {
  fakeid: string;
  url: string;
  file_base64: string;
  file_type?: string;
}): Promise<boolean> {
  ensureSchemaAndMigrate();
  const blob = await saveBlob('asset', payload.file_base64, payload.file_type);

  getSqliteDb()
    .prepare(`
      INSERT INTO asset (url, fakeid, blob_kind, blob_sha256, blob_file_type, blob_size, blob_relative_path)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(url) DO UPDATE SET
        fakeid = excluded.fakeid,
        blob_kind = excluded.blob_kind,
        blob_sha256 = excluded.blob_sha256,
        blob_file_type = excluded.blob_file_type,
        blob_size = excluded.blob_size,
        blob_relative_path = excluded.blob_relative_path
    `)
    .run(payload.url, payload.fakeid, blob.kind, blob.sha256, blob.file_type, blob.size, blob.relative_path);

  return true;
}

export async function getAssetFromDb(url: string): Promise<
  | {
      fakeid: string;
      url: string;
      file_base64: string;
      file_type: string;
    }
  | undefined
> {
  ensureSchemaAndMigrate();
  const row = getSqliteDb()
    .prepare(`
      SELECT fakeid, url, blob_kind, blob_sha256, blob_file_type, blob_size, blob_relative_path
      FROM asset
      WHERE url = ?
    `)
    .get(url) as
    | (BlobRow & {
        fakeid: string;
        url: string;
      })
    | undefined;

  if (!row) {
    return undefined;
  }

  const blob = toBlobRef(row);
  return {
    fakeid: row.fakeid,
    url: row.url,
    file_base64: await readBlobAsBase64(blob),
    file_type: blob.file_type,
  };
}

export async function upsertDebugToDb(payload: {
  type: string;
  url: string;
  title: string;
  fakeid: string;
  file_base64: string;
  file_type?: string;
}): Promise<boolean> {
  ensureSchemaAndMigrate();
  const blob = await saveBlob('debug', payload.file_base64, payload.file_type);

  getSqliteDb()
    .prepare(`
      INSERT INTO debug (
        url, type, title, fakeid,
        blob_kind, blob_sha256, blob_file_type, blob_size, blob_relative_path
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(url) DO UPDATE SET
        type = excluded.type,
        title = excluded.title,
        fakeid = excluded.fakeid,
        blob_kind = excluded.blob_kind,
        blob_sha256 = excluded.blob_sha256,
        blob_file_type = excluded.blob_file_type,
        blob_size = excluded.blob_size,
        blob_relative_path = excluded.blob_relative_path
    `)
    .run(
      payload.url,
      payload.type,
      payload.title,
      payload.fakeid,
      blob.kind,
      blob.sha256,
      blob.file_type,
      blob.size,
      blob.relative_path
    );

  return true;
}

export async function getDebugFromDb(url: string): Promise<
  | {
      type: string;
      url: string;
      title: string;
      fakeid: string;
      file_base64: string;
      file_type: string;
    }
  | undefined
> {
  ensureSchemaAndMigrate();
  const row = getSqliteDb()
    .prepare(`
      SELECT
        type, title, fakeid, url,
        blob_kind, blob_sha256, blob_file_type, blob_size, blob_relative_path
      FROM debug
      WHERE url = ?
    `)
    .get(url) as
    | (BlobRow & {
        type: string;
        title: string;
        fakeid: string;
        url: string;
      })
    | undefined;

  if (!row) {
    return undefined;
  }

  const blob = toBlobRef(row);
  return {
    type: row.type,
    url: row.url,
    title: row.title,
    fakeid: row.fakeid,
    file_base64: await readBlobAsBase64(blob),
    file_type: blob.file_type,
  };
}

export async function getAllDebugFromDb(): Promise<
  {
    type: string;
    url: string;
    title: string;
    fakeid: string;
    file_base64: string;
    file_type: string;
  }[]
> {
  ensureSchemaAndMigrate();
  const rows = getSqliteDb()
    .prepare(`
      SELECT
        type, title, fakeid, url,
        blob_kind, blob_sha256, blob_file_type, blob_size, blob_relative_path
      FROM debug
      ORDER BY rowid ASC
    `)
    .all() as (BlobRow & {
    type: string;
    title: string;
    fakeid: string;
    url: string;
  })[];

  const result: {
    type: string;
    url: string;
    title: string;
    fakeid: string;
    file_base64: string;
    file_type: string;
  }[] = [];

  for (const row of rows) {
    const blob = toBlobRef(row);
    result.push({
      type: row.type,
      url: row.url,
      title: row.title,
      fakeid: row.fakeid,
      file_base64: await readBlobAsBase64(blob),
      file_type: blob.file_type,
    });
  }

  return result;
}

function deleteByFakeids(tableName: string, fakeids: string[]): void {
  if (!fakeids.length) {
    return;
  }
  const placeholders = fakeids.map(() => '?').join(',');
  getSqliteDb().prepare(`DELETE FROM ${tableName} WHERE fakeid IN (${placeholders})`).run(...fakeids);
}

export async function deleteAccountContentFromDb(fakeids: string[]): Promise<void> {
  if (!fakeids.length) {
    return;
  }

  ensureSchemaAndMigrate();
  const db = getSqliteDb();
  const tx = db.transaction((ids: string[]) => {
    deleteByFakeids('html', ids);
    deleteByFakeids('metadata', ids);
    deleteByFakeids('comment', ids);
    deleteByFakeids('comment_reply', ids);
    deleteByFakeids('resource', ids);
    deleteByFakeids('resource_map', ids);
    deleteByFakeids('asset', ids);
    deleteByFakeids('debug', ids);
  });

  tx(fakeids);
}
