import { mkdirSync } from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';

declare global {
  // eslint-disable-next-line no-var
  var __wechatArticleSqliteDb__: Database.Database | undefined;
}

function getDbBaseDir(): string {
  const base = process.env.NITRO_FILE_DB_BASE || '.data/filedb';
  return path.resolve(process.cwd(), base);
}

function getDbFilePath(): string {
  return path.join(getDbBaseDir(), 'wechat-article.db');
}

export function getBlobRootDir(): string {
  return path.join(getDbBaseDir(), 'blobs');
}

export function getDbBaseDirPath(): string {
  return getDbBaseDir();
}

export function getSqliteDb(): Database.Database {
  if (!globalThis.__wechatArticleSqliteDb__) {
    mkdirSync(getDbBaseDir(), { recursive: true });
    const db = new Database(getDbFilePath());
    db.pragma('journal_mode = WAL');
    db.pragma('synchronous = NORMAL');
    db.pragma('foreign_keys = ON');
    globalThis.__wechatArticleSqliteDb__ = db;
  }
  return globalThis.__wechatArticleSqliteDb__;
}
