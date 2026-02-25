import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { getDbBaseDirPath, getSqliteDb } from '~/server/db/sqlite';

export interface InfoRecord {
  fakeid: string;
  completed: boolean;
  count: number;
  articles: number;
  nickname?: string;
  round_head_img?: string;
  total_count: number;
  create_time?: number;
  update_time?: number;
  last_update_time?: number;
}

export interface ArticleRecord {
  fakeid: string;
  aid: string;
  link: string;
  create_time: number;
  is_deleted?: boolean;
  [key: string]: any;
}

interface LegacyFileDbState {
  infos?: Record<string, InfoRecord>;
  articlesByKey?: Record<string, ArticleRecord>;
}

interface InfoRow {
  fakeid: string;
  completed: number;
  count: number;
  articles: number;
  nickname: string | null;
  round_head_img: string | null;
  total_count: number;
  create_time: number;
  update_time: number;
  last_update_time: number | null;
}

interface ArticleRow {
  fakeid: string;
  aid: string;
  link: string;
  create_time: number;
  is_deleted: number;
  payload: string;
}

let initialized = false;

function nowSeconds(): number {
  return Math.round(Date.now() / 1000);
}

function toNumber(value: unknown, fallback = 0): number {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function ensureSchemaAndMigrate(): void {
  if (initialized) {
    return;
  }

  const db = getSqliteDb();
  db.exec(`
    CREATE TABLE IF NOT EXISTS infos (
      fakeid TEXT PRIMARY KEY,
      completed INTEGER NOT NULL DEFAULT 0,
      count INTEGER NOT NULL DEFAULT 0,
      articles INTEGER NOT NULL DEFAULT 0,
      nickname TEXT,
      round_head_img TEXT,
      total_count INTEGER NOT NULL DEFAULT 0,
      create_time INTEGER NOT NULL,
      update_time INTEGER NOT NULL,
      last_update_time INTEGER
    );

    CREATE TABLE IF NOT EXISTS articles (
      fakeid TEXT NOT NULL,
      aid TEXT NOT NULL,
      link TEXT NOT NULL,
      create_time INTEGER NOT NULL DEFAULT 0,
      is_deleted INTEGER NOT NULL DEFAULT 0,
      payload TEXT NOT NULL,
      PRIMARY KEY(fakeid, aid)
    );

    CREATE INDEX IF NOT EXISTS idx_articles_fakeid_create_time ON articles(fakeid, create_time);
    CREATE INDEX IF NOT EXISTS idx_articles_link ON articles(link);
  `);

  migrateLegacyJsonIfNeeded();
  initialized = true;
}

function migrateLegacyJsonIfNeeded(): void {
  const db = getSqliteDb();
  const infoCount = (db.prepare('SELECT COUNT(*) as count FROM infos').get() as { count: number }).count;
  const articleCount = (db.prepare('SELECT COUNT(*) as count FROM articles').get() as { count: number }).count;
  if (infoCount > 0 || articleCount > 0) {
    return;
  }

  const legacyPath = path.join(getDbBaseDirPath(), 'article-info.json');
  if (!existsSync(legacyPath)) {
    return;
  }

  try {
    const parsed = JSON.parse(readFileSync(legacyPath, 'utf-8')) as LegacyFileDbState;
    const infos = Object.values(parsed.infos || {});
    const articles = Object.values(parsed.articlesByKey || {});

    const tx = db.transaction(() => {
      const insertInfo = db.prepare(`
        INSERT INTO infos (
          fakeid, completed, count, articles, nickname, round_head_img,
          total_count, create_time, update_time, last_update_time
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(fakeid) DO UPDATE SET
          completed = excluded.completed,
          count = excluded.count,
          articles = excluded.articles,
          nickname = excluded.nickname,
          round_head_img = excluded.round_head_img,
          total_count = excluded.total_count,
          update_time = excluded.update_time,
          last_update_time = excluded.last_update_time
      `);

      const upsertArticle = db.prepare(`
        INSERT INTO articles (fakeid, aid, link, create_time, is_deleted, payload)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(fakeid, aid) DO UPDATE SET
          link = excluded.link,
          create_time = excluded.create_time,
          is_deleted = excluded.is_deleted,
          payload = excluded.payload
      `);

      for (const info of infos) {
        const ts = nowSeconds();
        insertInfo.run(
          info.fakeid,
          info.completed ? 1 : 0,
          toNumber(info.count),
          toNumber(info.articles),
          info.nickname ?? null,
          info.round_head_img ?? null,
          toNumber(info.total_count),
          toNumber(info.create_time, ts),
          toNumber(info.update_time, ts),
          info.last_update_time == null ? null : toNumber(info.last_update_time)
        );
      }

      for (const article of articles) {
        if (!article.fakeid || !article.aid || !article.link) {
          continue;
        }
        upsertArticle.run(
          article.fakeid,
          article.aid,
          article.link,
          toNumber(article.create_time),
          article.is_deleted ? 1 : 0,
          JSON.stringify(article)
        );
      }
    });

    tx();
  } catch (error) {
    console.error('Failed to migrate legacy article-info.json into sqlite:', error);
  }
}

function rowToInfoRecord(row: InfoRow): InfoRecord {
  return {
    fakeid: row.fakeid,
    completed: row.completed === 1,
    count: toNumber(row.count),
    articles: toNumber(row.articles),
    nickname: row.nickname || undefined,
    round_head_img: row.round_head_img || undefined,
    total_count: toNumber(row.total_count),
    create_time: toNumber(row.create_time),
    update_time: toNumber(row.update_time),
    last_update_time: row.last_update_time == null ? undefined : toNumber(row.last_update_time),
  };
}

function rowToArticleRecord(row: ArticleRow): ArticleRecord {
  try {
    const parsed = JSON.parse(row.payload) as ArticleRecord;
    if (parsed && typeof parsed === 'object') {
      return {
        ...parsed,
        fakeid: parsed.fakeid || row.fakeid,
        aid: parsed.aid || row.aid,
        link: parsed.link || row.link,
        create_time: toNumber(parsed.create_time, row.create_time),
        is_deleted: Boolean(parsed.is_deleted ?? row.is_deleted),
      };
    }
  } catch {
    // ignore malformed payload and fallback to db columns
  }

  return {
    fakeid: row.fakeid,
    aid: row.aid,
    link: row.link,
    create_time: toNumber(row.create_time),
    is_deleted: row.is_deleted === 1,
  };
}

function withDb<T>(task: (db: ReturnType<typeof getSqliteDb>) => T): T {
  ensureSchemaAndMigrate();
  return task(getSqliteDb());
}

export async function getAllInfosFromDb(): Promise<InfoRecord[]> {
  return withDb(db => {
    const rows = db.prepare('SELECT * FROM infos').all() as InfoRow[];
    return rows.map(rowToInfoRecord);
  });
}

export async function getInfoFromDb(fakeid: string): Promise<InfoRecord | undefined> {
  return withDb(db => {
    const row = db.prepare('SELECT * FROM infos WHERE fakeid = ?').get(fakeid) as InfoRow | undefined;
    return row ? rowToInfoRecord(row) : undefined;
  });
}

export async function updateInfoInDb(info: InfoRecord): Promise<boolean> {
  return withDb(db => {
    const existing = db.prepare('SELECT * FROM infos WHERE fakeid = ?').get(info.fakeid) as InfoRow | undefined;
    const ts = nowSeconds();

    if (existing) {
      db.prepare(`
        UPDATE infos
        SET completed = ?, count = ?, articles = ?, nickname = ?, round_head_img = ?, total_count = ?, update_time = ?
        WHERE fakeid = ?
      `).run(
        info.completed ? 1 : existing.completed,
        toNumber(existing.count) + toNumber(info.count),
        toNumber(existing.articles) + toNumber(info.articles),
        info.nickname ?? null,
        info.round_head_img ?? null,
        toNumber(info.total_count),
        ts,
        info.fakeid
      );
    } else {
      db.prepare(`
        INSERT INTO infos (
          fakeid, completed, count, articles, nickname, round_head_img,
          total_count, create_time, update_time, last_update_time
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        info.fakeid,
        info.completed ? 1 : 0,
        toNumber(info.count),
        toNumber(info.articles),
        info.nickname ?? null,
        info.round_head_img ?? null,
        toNumber(info.total_count),
        ts,
        ts,
        info.last_update_time == null ? null : toNumber(info.last_update_time)
      );
    }

    return true;
  });
}

export async function updateLastUpdateTimeInDb(fakeid: string): Promise<boolean> {
  return withDb(db => {
    const ts = nowSeconds();
    db.prepare('UPDATE infos SET last_update_time = ? WHERE fakeid = ?').run(ts, fakeid);
    return true;
  });
}

export async function importInfosToDb(infos: InfoRecord[]): Promise<void> {
  withDb(db => {
    const ts = nowSeconds();
    const tx = db.transaction((payload: InfoRecord[]) => {
      const existingStmt = db.prepare('SELECT create_time FROM infos WHERE fakeid = ?');
      const upsertStmt = db.prepare(`
        INSERT INTO infos (
          fakeid, completed, count, articles, nickname, round_head_img,
          total_count, create_time, update_time, last_update_time
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(fakeid) DO UPDATE SET
          completed = excluded.completed,
          count = excluded.count,
          articles = excluded.articles,
          nickname = excluded.nickname,
          round_head_img = excluded.round_head_img,
          total_count = excluded.total_count,
          update_time = excluded.update_time
      `);

      for (const info of payload) {
        const existed = existingStmt.get(info.fakeid) as { create_time?: number } | undefined;
        upsertStmt.run(
          info.fakeid,
          0,
          0,
          0,
          info.nickname ?? null,
          info.round_head_img ?? null,
          0,
          toNumber(existed?.create_time, ts),
          ts,
          null
        );
      }
    });

    tx(infos);
  });
}

export async function syncArticleCacheToDb(account: InfoRecord, publishPage: any): Promise<void> {
  withDb(db => {
    const fakeid = account.fakeid;
    const totalCount = toNumber(publishPage?.total_count);
    const publishList = Array.isArray(publishPage?.publish_list)
      ? publishPage.publish_list.filter((item: any) => !!item?.publish_info)
      : [];

    const selectArticle = db.prepare('SELECT 1 FROM articles WHERE fakeid = ? AND aid = ? LIMIT 1');
    const upsertArticle = db.prepare(`
      INSERT INTO articles (fakeid, aid, link, create_time, is_deleted, payload)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(fakeid, aid) DO UPDATE SET
        link = excluded.link,
        create_time = excluded.create_time,
        is_deleted = excluded.is_deleted,
        payload = excluded.payload
    `);

    let msgCount = 0;
    let articleCount = 0;

    const tx = db.transaction(() => {
      for (const item of publishList) {
        let publishInfo: any;
        try {
          publishInfo = typeof item.publish_info === 'string' ? JSON.parse(item.publish_info) : item.publish_info;
        } catch {
          continue;
        }

        const appmsgex = Array.isArray(publishInfo?.appmsgex) ? publishInfo.appmsgex : [];
        let newEntryCount = 0;

        for (const article of appmsgex) {
          if (!article?.aid || !article?.link) {
            continue;
          }

          const normalized = {
            ...article,
            fakeid,
          } as ArticleRecord;

          const existed = !!selectArticle.get(fakeid, normalized.aid);
          upsertArticle.run(
            fakeid,
            normalized.aid,
            normalized.link,
            toNumber(normalized.create_time),
            normalized.is_deleted ? 1 : 0,
            JSON.stringify(normalized)
          );

          if (!existed) {
            newEntryCount++;
            articleCount++;
          }
        }

        if (newEntryCount > 0) {
          msgCount++;
        }
      }

      const completed = publishList.length === 0;
      const infoRow = db.prepare('SELECT * FROM infos WHERE fakeid = ?').get(fakeid) as InfoRow | undefined;
      const ts = nowSeconds();

      if (!infoRow) {
        db.prepare(`
          INSERT INTO infos (
            fakeid, completed, count, articles, nickname, round_head_img,
            total_count, create_time, update_time, last_update_time
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          fakeid,
          completed ? 1 : 0,
          msgCount,
          articleCount,
          account.nickname ?? null,
          account.round_head_img ?? null,
          totalCount,
          ts,
          ts,
          null
        );
      } else {
        db.prepare(`
          UPDATE infos
          SET completed = ?, count = ?, articles = ?, nickname = ?, round_head_img = ?, total_count = ?, update_time = ?
          WHERE fakeid = ?
        `).run(
          completed ? 1 : infoRow.completed,
          toNumber(infoRow.count) + msgCount,
          toNumber(infoRow.articles) + articleCount,
          account.nickname ?? null,
          account.round_head_img ?? null,
          totalCount,
          ts,
          fakeid
        );
      }
    });

    tx();
  });
}

export async function hitArticleCacheFromDb(fakeid: string, createTime: number): Promise<boolean> {
  return withDb(db => {
    const row = db
      .prepare('SELECT 1 as hit FROM articles WHERE fakeid = ? AND create_time < ? LIMIT 1')
      .get(fakeid, createTime) as { hit: number } | undefined;
    return !!row;
  });
}

export async function getArticleCacheFromDb(fakeid: string, createTime: number): Promise<ArticleRecord[]> {
  return withDb(db => {
    const rows = db
      .prepare('SELECT * FROM articles WHERE fakeid = ? AND create_time < ? ORDER BY create_time ASC')
      .all(fakeid, createTime) as ArticleRow[];
    return rows.map(rowToArticleRecord);
  });
}

export async function getArticleByLinkFromDb(url: string): Promise<ArticleRecord | undefined> {
  return withDb(db => {
    const row = db.prepare('SELECT * FROM articles WHERE link = ? LIMIT 1').get(url) as ArticleRow | undefined;
    return row ? rowToArticleRecord(row) : undefined;
  });
}

export async function upsertArticleToDb(article: ArticleRecord): Promise<boolean> {
  return withDb(db => {
    if (!article.fakeid || !article.aid || !article.link) {
      throw new Error('Invalid article payload');
    }

    db.prepare(`
      INSERT INTO articles (fakeid, aid, link, create_time, is_deleted, payload)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(fakeid, aid) DO UPDATE SET
        link = excluded.link,
        create_time = excluded.create_time,
        is_deleted = excluded.is_deleted,
        payload = excluded.payload
    `).run(
      article.fakeid,
      article.aid,
      article.link,
      toNumber(article.create_time),
      article.is_deleted ? 1 : 0,
      JSON.stringify(article)
    );

    return true;
  });
}

export async function deleteArticleFromDb(fakeid: string, aid: string, link?: string): Promise<boolean> {
  return withDb(db => {
    const byKey = db.prepare('DELETE FROM articles WHERE fakeid = ? AND aid = ?').run(fakeid, aid);
    if (byKey.changes > 0) {
      return true;
    }

    if (!link) {
      return false;
    }

    const target = db.prepare('SELECT fakeid, aid FROM articles WHERE link = ? LIMIT 1').get(link) as
      | {
          fakeid: string;
          aid: string;
        }
      | undefined;

    if (!target) {
      return false;
    }

    const byLink = db.prepare('DELETE FROM articles WHERE fakeid = ? AND aid = ?').run(target.fakeid, target.aid);
    return byLink.changes > 0;
  });
}

export async function markArticleDeletedInDb(url: string): Promise<void> {
  withDb(db => {
    const row = db.prepare('SELECT * FROM articles WHERE link = ? LIMIT 1').get(url) as ArticleRow | undefined;
    if (!row) {
      return;
    }

    let payload = rowToArticleRecord(row);
    payload = {
      ...payload,
      is_deleted: true,
    };

    db.prepare('UPDATE articles SET is_deleted = 1, payload = ? WHERE fakeid = ? AND aid = ?').run(
      JSON.stringify(payload),
      row.fakeid,
      row.aid
    );
  });
}

export async function deleteAccountDataFromDb(fakeids: string[]): Promise<void> {
  if (!fakeids.length) {
    return;
  }

  withDb(db => {
    const placeholders = fakeids.map(() => '?').join(',');
    const tx = db.transaction((ids: string[]) => {
      db.prepare(`DELETE FROM infos WHERE fakeid IN (${placeholders})`).run(...ids);
      db.prepare(`DELETE FROM articles WHERE fakeid IN (${placeholders})`).run(...ids);
    });

    tx(fakeids);
  });
}
