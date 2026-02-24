import { promises as fs } from 'node:fs';
import path from 'node:path';

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

interface FileDbState {
  infos: Record<string, InfoRecord>;
  articlesByKey: Record<string, ArticleRecord>;
  articleLinkToKey: Record<string, string>;
}

const DB_FILENAME = 'article-info.json';
const DEFAULT_STATE: FileDbState = {
  infos: {},
  articlesByKey: {},
  articleLinkToKey: {},
};

let state: FileDbState | null = null;
let queue: Promise<unknown> = Promise.resolve();

function nowSeconds(): number {
  return Math.round(Date.now() / 1000);
}

function getDbBaseDir(): string {
  const base = process.env.NITRO_FILE_DB_BASE || '.data/filedb';
  return path.resolve(process.cwd(), base);
}

function getDbFilePath(): string {
  return path.join(getDbBaseDir(), DB_FILENAME);
}

async function ensureLoaded(): Promise<void> {
  if (state) {
    return;
  }

  const filePath = getDbFilePath();
  try {
    const raw = await fs.readFile(filePath, 'utf-8');
    const parsed = JSON.parse(raw) as Partial<FileDbState>;
    state = {
      infos: parsed.infos || {},
      articlesByKey: parsed.articlesByKey || {},
      articleLinkToKey: parsed.articleLinkToKey || {},
    };
  } catch (error: any) {
    if (error?.code !== 'ENOENT') {
      console.error('Failed to load file database, fallback to empty state:', error);
    }
    state = structuredClone(DEFAULT_STATE);
  }
}

async function persist(): Promise<void> {
  await ensureLoaded();

  const baseDir = getDbBaseDir();
  const filePath = getDbFilePath();
  const tmpPath = `${filePath}.tmp`;
  await fs.mkdir(baseDir, { recursive: true });
  await fs.writeFile(tmpPath, JSON.stringify(state), 'utf-8');
  await fs.rename(tmpPath, filePath);
}

async function runExclusive<T>(task: () => Promise<T>): Promise<T> {
  const next = queue.then(task, task);
  queue = next.then(
    () => undefined,
    () => undefined
  );
  return next;
}

function getInfoFromState(fakeid: string): InfoRecord | undefined {
  return state?.infos[fakeid];
}

export async function getAllInfosFromDb(): Promise<InfoRecord[]> {
  return runExclusive(async () => {
    await ensureLoaded();
    return Object.values(state!.infos);
  });
}

export async function getInfoFromDb(fakeid: string): Promise<InfoRecord | undefined> {
  return runExclusive(async () => {
    await ensureLoaded();
    return getInfoFromState(fakeid);
  });
}

export async function updateInfoInDb(info: InfoRecord): Promise<boolean> {
  return runExclusive(async () => {
    await ensureLoaded();

    let infoCache = getInfoFromState(info.fakeid);
    if (infoCache) {
      if (info.completed) {
        infoCache.completed = info.completed;
      }
      infoCache.count += info.count;
      infoCache.articles += info.articles;
      infoCache.nickname = info.nickname;
      infoCache.round_head_img = info.round_head_img;
      infoCache.total_count = info.total_count;
      infoCache.update_time = nowSeconds();
    } else {
      infoCache = {
        fakeid: info.fakeid,
        completed: info.completed,
        count: info.count,
        articles: info.articles,
        nickname: info.nickname,
        round_head_img: info.round_head_img,
        total_count: info.total_count,
        create_time: nowSeconds(),
        update_time: nowSeconds(),
      };
    }
    state!.infos[info.fakeid] = infoCache;

    await persist();
    return true;
  });
}

export async function updateLastUpdateTimeInDb(fakeid: string): Promise<boolean> {
  return runExclusive(async () => {
    await ensureLoaded();
    const infoCache = getInfoFromState(fakeid);
    if (infoCache) {
      infoCache.last_update_time = nowSeconds();
      state!.infos[fakeid] = infoCache;
      await persist();
    }
    return true;
  });
}

export async function importInfosToDb(infos: InfoRecord[]): Promise<void> {
  await runExclusive(async () => {
    await ensureLoaded();

    for (const info of infos) {
      const prev = getInfoFromState(info.fakeid);
      state!.infos[info.fakeid] = {
        fakeid: info.fakeid,
        completed: false,
        count: 0,
        articles: 0,
        nickname: info.nickname,
        round_head_img: info.round_head_img,
        total_count: 0,
        create_time: prev?.create_time || nowSeconds(),
        update_time: nowSeconds(),
      };
    }

    await persist();
  });
}

function buildArticleKey(fakeid: string, aid: string): string {
  return `${fakeid}:${aid}`;
}

function getAllArticles(): ArticleRecord[] {
  return Object.values(state!.articlesByKey);
}

export async function syncArticleCacheToDb(account: InfoRecord, publishPage: any): Promise<void> {
  await runExclusive(async () => {
    await ensureLoaded();

    const fakeid = account.fakeid;
    const total_count = Number(publishPage?.total_count || 0);
    const publishList = Array.isArray(publishPage?.publish_list)
      ? publishPage.publish_list.filter((item: any) => !!item?.publish_info)
      : [];

    let msgCount = 0;
    let articleCount = 0;

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
        const key = buildArticleKey(fakeid, article.aid);
        const existed = !!state!.articlesByKey[key];
        const normalized = { ...article, fakeid } as ArticleRecord;
        state!.articlesByKey[key] = normalized;
        state!.articleLinkToKey[normalized.link] = key;

        if (!existed) {
          newEntryCount++;
          articleCount++;
        }
      }

      if (newEntryCount > 0) {
        msgCount++;
      }
    }

    let infoCache = state!.infos[fakeid];
    const completed = publishList.length === 0;
    if (!infoCache) {
      infoCache = {
        fakeid,
        completed,
        count: msgCount,
        articles: articleCount,
        nickname: account.nickname,
        round_head_img: account.round_head_img,
        total_count,
        create_time: nowSeconds(),
        update_time: nowSeconds(),
      };
    } else {
      if (completed) {
        infoCache.completed = true;
      }
      infoCache.count += msgCount;
      infoCache.articles += articleCount;
      infoCache.nickname = account.nickname;
      infoCache.round_head_img = account.round_head_img;
      infoCache.total_count = total_count;
      infoCache.update_time = nowSeconds();
    }
    state!.infos[fakeid] = infoCache;

    await persist();
  });
}

export async function hitArticleCacheFromDb(fakeid: string, createTime: number): Promise<boolean> {
  return runExclusive(async () => {
    await ensureLoaded();
    return getAllArticles().some(article => article.fakeid === fakeid && article.create_time < createTime);
  });
}

export async function getArticleCacheFromDb(fakeid: string, createTime: number): Promise<ArticleRecord[]> {
  return runExclusive(async () => {
    await ensureLoaded();
    return getAllArticles()
      .filter(article => article.fakeid === fakeid && article.create_time < createTime)
      .sort((a, b) => a.create_time - b.create_time);
  });
}

export async function getArticleByLinkFromDb(url: string): Promise<ArticleRecord | undefined> {
  return runExclusive(async () => {
    await ensureLoaded();

    const key = state!.articleLinkToKey[url];
    if (key) {
      return state!.articlesByKey[key];
    }

    return getAllArticles().find(article => article.link === url);
  });
}

export async function upsertArticleToDb(article: ArticleRecord): Promise<boolean> {
  return runExclusive(async () => {
    await ensureLoaded();
    if (!article.fakeid || !article.aid || !article.link) {
      throw new Error('Invalid article payload');
    }
    const key = buildArticleKey(article.fakeid, article.aid);
    state!.articlesByKey[key] = article;
    state!.articleLinkToKey[article.link] = key;
    await persist();
    return true;
  });
}

export async function deleteArticleFromDb(fakeid: string, aid: string, link?: string): Promise<boolean> {
  return runExclusive(async () => {
    await ensureLoaded();
    const key = buildArticleKey(fakeid, aid);
    const article = state!.articlesByKey[key];
    if (article) {
      delete state!.articlesByKey[key];
      delete state!.articleLinkToKey[article.link];
      await persist();
      return true;
    }

    if (link) {
      const keyByLink = state!.articleLinkToKey[link];
      if (keyByLink) {
        const target = state!.articlesByKey[keyByLink];
        delete state!.articlesByKey[keyByLink];
        if (target?.link) {
          delete state!.articleLinkToKey[target.link];
        }
        await persist();
        return true;
      }
    }
    return false;
  });
}

export async function markArticleDeletedInDb(url: string): Promise<void> {
  await runExclusive(async () => {
    await ensureLoaded();

    const key = state!.articleLinkToKey[url];
    if (key && state!.articlesByKey[key]) {
      state!.articlesByKey[key].is_deleted = true;
      await persist();
      return;
    }

    for (const [articleKey, article] of Object.entries(state!.articlesByKey)) {
      if (article.link === url) {
        article.is_deleted = true;
        state!.articleLinkToKey[url] = articleKey;
        await persist();
        return;
      }
    }
  });
}

export async function deleteAccountDataFromDb(fakeids: string[]): Promise<void> {
  await runExclusive(async () => {
    await ensureLoaded();
    const idSet = new Set(fakeids);

    for (const fakeid of fakeids) {
      delete state!.infos[fakeid];
    }

    for (const [key, article] of Object.entries(state!.articlesByKey)) {
      if (idSet.has(article.fakeid)) {
        delete state!.articlesByKey[key];
        delete state!.articleLinkToKey[article.link];
      }
    }

    await persist();
  });
}
