import { request } from '#shared/utils/request';
import { base64ToBlob, blobToBase64 } from './backend-blob';

interface Asset {
  url: string;
  file: Blob;
  fakeid: string;
}

export type { Asset };

/**
 * 更新 asset 缓存
 * @param asset
 */
export async function updateAssetCache(asset: Asset): Promise<boolean> {
  const resp = await request<{ success: boolean }>('/api/data/asset/update', {
    method: 'POST',
    body: {
      fakeid: asset.fakeid,
      url: asset.url,
      file_base64: await blobToBase64(asset.file),
      file_type: asset.file.type || 'application/octet-stream',
    },
  });
  return resp.success;
}

/**
 * 获取 asset 缓存
 * @param url
 */
export async function getAssetCache(url: string): Promise<Asset | undefined> {
  const resp = await request<
    | {
        fakeid: string;
        url: string;
        file_base64: string;
        file_type: string;
      }
    | undefined
  >('/api/data/asset/get', {
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
