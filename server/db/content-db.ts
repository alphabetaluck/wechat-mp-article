import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';

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

interface ContentDbState {
  html: Record<string, HtmlRecord>;
  metadata: Record<string, MetadataRecord>;
  comment: Record<string, CommentRecord>;
  commentReply: Record<string, CommentReplyRecord>;
  resource: Record<string, ResourceRecord>;
  resourceMap: Record<string, ResourceMapRecord>;
  asset: Record<string, AssetRecord>;
  debug: Record<string, DebugRecord>;
}

const DB_FILENAME = 'content-db.json';
const DEFAULT_STATE: ContentDbState = {
  html: {},
  metadata: {},
  comment: {},
  commentReply: {},
  resource: {},
  resourceMap: {},
  asset: {},
  debug: {},
};

let state: ContentDbState | null = null;
let queue: Promise<unknown> = Promise.resolve();

function getDbBaseDir(): string {
  const base = process.env.NITRO_FILE_DB_BASE || '.data/filedb';
  return path.resolve(process.cwd(), base);
}

function getDbFilePath(): string {
  return path.join(getDbBaseDir(), DB_FILENAME);
}

function getBlobRootDir(): string {
  return path.join(getDbBaseDir(), 'blobs');
}

async function ensureLoaded(): Promise<void> {
  if (state) {
    return;
  }

  const filePath = getDbFilePath();
  try {
    const raw = await fs.readFile(filePath, 'utf-8');
    const parsed = JSON.parse(raw) as Partial<ContentDbState>;
    state = {
      html: parsed.html || {},
      metadata: parsed.metadata || {},
      comment: parsed.comment || {},
      commentReply: parsed.commentReply || {},
      resource: parsed.resource || {},
      resourceMap: parsed.resourceMap || {},
      asset: parsed.asset || {},
      debug: parsed.debug || {},
    };
  } catch (error: any) {
    if (error?.code !== 'ENOENT') {
      console.error('Failed to load content database, fallback to empty state:', error);
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

function createCommentReplyKey(url: string, contentID: string): string {
  return `${url}:${contentID}`;
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
  return runExclusive(async () => {
    await ensureLoaded();
    const blob = await saveBlob('html', payload.file_base64, payload.file_type);
    state!.html[payload.url] = {
      fakeid: payload.fakeid,
      url: payload.url,
      title: payload.title,
      commentID: payload.commentID,
      blob,
    };
    await persist();
    return true;
  });
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
  return runExclusive(async () => {
    await ensureLoaded();
    const found = state!.html[url];
    if (!found) {
      return undefined;
    }
    return {
      fakeid: found.fakeid,
      url: found.url,
      title: found.title,
      commentID: found.commentID,
      file_base64: await readBlobAsBase64(found.blob),
      file_type: found.blob.file_type,
    };
  });
}

export async function deleteHtmlFromDb(url: string): Promise<boolean> {
  return runExclusive(async () => {
    await ensureLoaded();
    if (state!.html[url]) {
      delete state!.html[url];
      await persist();
      return true;
    }
    return false;
  });
}

export async function upsertMetadataToDb(payload: MetadataRecord): Promise<boolean> {
  return runExclusive(async () => {
    await ensureLoaded();
    state!.metadata[payload.url] = payload;
    await persist();
    return true;
  });
}

export async function getMetadataFromDb(url: string): Promise<MetadataRecord | undefined> {
  return runExclusive(async () => {
    await ensureLoaded();
    return state!.metadata[url];
  });
}

export async function upsertCommentToDb(payload: CommentRecord): Promise<boolean> {
  return runExclusive(async () => {
    await ensureLoaded();
    state!.comment[payload.url] = payload;
    await persist();
    return true;
  });
}

export async function getCommentFromDb(url: string): Promise<CommentRecord | undefined> {
  return runExclusive(async () => {
    await ensureLoaded();
    return state!.comment[url];
  });
}

export async function upsertCommentReplyToDb(payload: CommentReplyRecord): Promise<boolean> {
  return runExclusive(async () => {
    await ensureLoaded();
    state!.commentReply[createCommentReplyKey(payload.url, payload.contentID)] = payload;
    await persist();
    return true;
  });
}

export async function getCommentReplyFromDb(url: string, contentID: string): Promise<CommentReplyRecord | undefined> {
  return runExclusive(async () => {
    await ensureLoaded();
    return state!.commentReply[createCommentReplyKey(url, contentID)];
  });
}

export async function upsertResourceToDb(payload: {
  fakeid: string;
  url: string;
  file_base64: string;
  file_type?: string;
}): Promise<boolean> {
  return runExclusive(async () => {
    await ensureLoaded();
    const blob = await saveBlob('resource', payload.file_base64, payload.file_type);
    state!.resource[payload.url] = {
      fakeid: payload.fakeid,
      url: payload.url,
      blob,
    };
    await persist();
    return true;
  });
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
  return runExclusive(async () => {
    await ensureLoaded();
    const found = state!.resource[url];
    if (!found) {
      return undefined;
    }
    return {
      fakeid: found.fakeid,
      url: found.url,
      file_base64: await readBlobAsBase64(found.blob),
      file_type: found.blob.file_type,
    };
  });
}

export async function upsertResourceMapToDb(payload: ResourceMapRecord): Promise<boolean> {
  return runExclusive(async () => {
    await ensureLoaded();
    state!.resourceMap[payload.url] = payload;
    await persist();
    return true;
  });
}

export async function getResourceMapFromDb(url: string): Promise<ResourceMapRecord | undefined> {
  return runExclusive(async () => {
    await ensureLoaded();
    return state!.resourceMap[url];
  });
}

export async function upsertAssetToDb(payload: {
  fakeid: string;
  url: string;
  file_base64: string;
  file_type?: string;
}): Promise<boolean> {
  return runExclusive(async () => {
    await ensureLoaded();
    const blob = await saveBlob('asset', payload.file_base64, payload.file_type);
    state!.asset[payload.url] = {
      fakeid: payload.fakeid,
      url: payload.url,
      blob,
    };
    await persist();
    return true;
  });
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
  return runExclusive(async () => {
    await ensureLoaded();
    const found = state!.asset[url];
    if (!found) {
      return undefined;
    }
    return {
      fakeid: found.fakeid,
      url: found.url,
      file_base64: await readBlobAsBase64(found.blob),
      file_type: found.blob.file_type,
    };
  });
}

export async function upsertDebugToDb(payload: {
  type: string;
  url: string;
  title: string;
  fakeid: string;
  file_base64: string;
  file_type?: string;
}): Promise<boolean> {
  return runExclusive(async () => {
    await ensureLoaded();
    const blob = await saveBlob('debug', payload.file_base64, payload.file_type);
    state!.debug[payload.url] = {
      type: payload.type,
      url: payload.url,
      title: payload.title,
      fakeid: payload.fakeid,
      blob,
    };
    await persist();
    return true;
  });
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
  return runExclusive(async () => {
    await ensureLoaded();
    const found = state!.debug[url];
    if (!found) {
      return undefined;
    }
    return {
      type: found.type,
      url: found.url,
      title: found.title,
      fakeid: found.fakeid,
      file_base64: await readBlobAsBase64(found.blob),
      file_type: found.blob.file_type,
    };
  });
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
  return runExclusive(async () => {
    await ensureLoaded();
    const result: {
      type: string;
      url: string;
      title: string;
      fakeid: string;
      file_base64: string;
      file_type: string;
    }[] = [];
    for (const item of Object.values(state!.debug)) {
      result.push({
        type: item.type,
        url: item.url,
        title: item.title,
        fakeid: item.fakeid,
        file_base64: await readBlobAsBase64(item.blob),
        file_type: item.blob.file_type,
      });
    }
    return result;
  });
}

export async function deleteAccountContentFromDb(fakeids: string[]): Promise<void> {
  await runExclusive(async () => {
    await ensureLoaded();
    const idSet = new Set(fakeids);

    for (const [url, item] of Object.entries(state!.html)) {
      if (idSet.has(item.fakeid)) {
        delete state!.html[url];
      }
    }
    for (const [url, item] of Object.entries(state!.metadata)) {
      if (idSet.has(item.fakeid)) {
        delete state!.metadata[url];
      }
    }
    for (const [url, item] of Object.entries(state!.comment)) {
      if (idSet.has(item.fakeid)) {
        delete state!.comment[url];
      }
    }
    for (const [key, item] of Object.entries(state!.commentReply)) {
      if (idSet.has(item.fakeid)) {
        delete state!.commentReply[key];
      }
    }
    for (const [url, item] of Object.entries(state!.resource)) {
      if (idSet.has(item.fakeid)) {
        delete state!.resource[url];
      }
    }
    for (const [url, item] of Object.entries(state!.resourceMap)) {
      if (idSet.has(item.fakeid)) {
        delete state!.resourceMap[url];
      }
    }
    for (const [url, item] of Object.entries(state!.asset)) {
      if (idSet.has(item.fakeid)) {
        delete state!.asset[url];
      }
    }
    for (const [url, item] of Object.entries(state!.debug)) {
      if (idSet.has(item.fakeid)) {
        delete state!.debug[url];
      }
    }

    await persist();
  });
}
