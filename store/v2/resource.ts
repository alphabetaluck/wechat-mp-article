import { request } from '#shared/utils/request';
import { base64ToBlob, blobToBase64 } from './backend-blob';

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
}

/**
 * 获取 resource 缓存
 * @param url
 */
export async function getResourceCache(url: string): Promise<ResourceAsset | undefined> {
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
  return undefined;
}
