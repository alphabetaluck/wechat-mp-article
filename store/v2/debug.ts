import { request } from '#shared/utils/request';
import { base64ToBlob, blobToBase64 } from './backend-blob';

export interface DebugAsset {
  type: string;
  url: string;
  file: Blob;
  title: string;
  fakeid: string;
}

/**
 * 更新 html 缓存
 * @param html 缓存
 */
export async function updateDebugCache(html: DebugAsset): Promise<boolean> {
  const resp = await request<{ success: boolean }>('/api/data/debug/update', {
    method: 'POST',
    body: {
      type: html.type,
      url: html.url,
      title: html.title,
      fakeid: html.fakeid,
      file_base64: await blobToBase64(html.file),
      file_type: html.file.type || 'application/octet-stream',
    },
  });
  return resp.success;
}

/**
 * 获取 asset 缓存
 * @param url
 */
export async function getDebugCache(url: string): Promise<DebugAsset | undefined> {
  const resp = await request<
    | {
        type: string;
        url: string;
        title: string;
        fakeid: string;
        file_base64: string;
        file_type: string;
      }
    | undefined
  >('/api/data/debug/get', {
    query: {
      url: url,
    },
  });
  if (resp) {
    return {
      type: resp.type,
      url: resp.url,
      title: resp.title,
      fakeid: resp.fakeid,
      file: base64ToBlob(resp.file_base64, resp.file_type || 'application/octet-stream'),
    };
  }
  return undefined;
}

export async function getDebugInfo(): Promise<DebugAsset[]> {
  const resp = await request<
    {
      type: string;
      url: string;
      title: string;
      fakeid: string;
      file_base64: string;
      file_type: string;
    }[]
  >('/api/data/debug/all');
  return resp.map(item => {
    return {
      type: item.type,
      url: item.url,
      title: item.title,
      fakeid: item.fakeid,
      file: base64ToBlob(item.file_base64, item.file_type || 'application/octet-stream'),
    };
  });
}
