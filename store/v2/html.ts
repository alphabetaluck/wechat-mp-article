import { request } from '#shared/utils/request';
import { base64ToBlob, blobToBase64 } from './backend-blob';
import { db } from './db';

export interface HtmlAsset {
  fakeid: string;
  url: string;
  file: Blob;
  title: string;
  commentID: string | null;
}

/**
 * 更新 html 缓存
 * @param html 缓存
 */
export async function updateHtmlCache(html: HtmlAsset): Promise<boolean> {
  try {
    const resp = await request<{ success: boolean }>('/api/data/html/update', {
      method: 'POST',
      body: {
        fakeid: html.fakeid,
        url: html.url,
        title: html.title,
        commentID: html.commentID,
        file_base64: await blobToBase64(html.file),
        file_type: html.file.type || 'text/html',
      },
    });
    return resp.success;
  } catch (error) {
    console.warn('Fallback to local Dexie for updateHtmlCache:', error);
    return db.transaction('rw', 'html', () => {
      db.html.put(html);
      return true;
    });
  }
}

/**
 * 获取 asset 缓存
 * @param url
 */
export async function getHtmlCache(url: string): Promise<HtmlAsset | undefined> {
  try {
    const resp = await request<
      | {
          fakeid: string;
          url: string;
          title: string;
          commentID: string | null;
          file_base64: string;
          file_type: string;
        }
      | undefined
    >('/api/data/html/get', {
      query: {
        url: url,
      },
    });
    if (resp) {
      return {
        fakeid: resp.fakeid,
        url: resp.url,
        title: resp.title,
        commentID: resp.commentID,
        file: base64ToBlob(resp.file_base64, resp.file_type || 'text/html'),
      };
    }
  } catch (error) {
    console.warn('Fallback to local Dexie for getHtmlCache:', error);
  }
  return db.html.get(url);
}

export async function deleteHtmlCache(url: string): Promise<boolean> {
  try {
    const resp = await request<{ success: boolean }>('/api/data/html/delete', {
      method: 'POST',
      body: {
        url: url,
      },
    });
    return resp.success;
  } catch (error) {
    console.warn('Fallback to local Dexie for deleteHtmlCache:', error);
    await db.html.delete(url);
    return true;
  }
}
