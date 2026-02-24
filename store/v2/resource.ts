import { request } from '#shared/utils/request';
import { base64ToBlob, blobToBase64 } from './backend-blob';
import { db } from './db';

export interface ResourceAsset {
  fakeid: string;
  url: string;
  file: Blob;
}

/**
 * 更新 resource 缓存
 * @param resource 缓存
 */
export async function updateResourceCache(resource: ResourceAsset): Promise<boolean> {
  try {
    const resp = await request<{ success: boolean }>('/api/data/resource/update', {
      method: 'POST',
      body: {
        fakeid: resource.fakeid,
        url: resource.url,
        file_base64: await blobToBase64(resource.file),
        file_type: resource.file.type || 'application/octet-stream',
      },
    });
    return resp.success;
  } catch (error) {
    console.warn('Fallback to local Dexie for updateResourceCache:', error);
    return db.transaction('rw', 'resource', () => {
      db.resource.put(resource);
      return true;
    });
  }
}

/**
 * 获取 resource 缓存
 * @param url
 */
export async function getResourceCache(url: string): Promise<ResourceAsset | undefined> {
  try {
    const resp = await request<
      | {
          fakeid: string;
          url: string;
          file_base64: string;
          file_type: string;
        }
      | undefined
    >('/api/data/resource/get', {
      query: {
        url: url,
      },
    });
    if (resp) {
      return {
        fakeid: resp.fakeid,
        url: resp.url,
        file: base64ToBlob(resp.file_base64, resp.file_type || 'application/octet-stream'),
      };
    }
  } catch (error) {
    console.warn('Fallback to local Dexie for getResourceCache:', error);
  }
  return db.resource.get(url);
}
