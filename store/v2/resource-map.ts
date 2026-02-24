import { request } from '#shared/utils/request';
import { db } from './db';

export interface ResourceMapAsset {
  fakeid: string;
  url: string;
  resources: string[];
}

/**
 * 更新 resource-map 缓存
 * @param resourceMap 缓存
 */
export async function updateResourceMapCache(resourceMap: ResourceMapAsset): Promise<boolean> {
  try {
    const resp = await request<{ success: boolean }>('/api/data/resource-map/update', {
      method: 'POST',
      body: resourceMap,
    });
    return resp.success;
  } catch (error) {
    console.warn('Fallback to local Dexie for updateResourceMapCache:', error);
    return db.transaction('rw', 'resource-map', () => {
      db['resource-map'].put(resourceMap);
      return true;
    });
  }
}

/**
 * 获取 resource-map 缓存
 * @param url
 */
export async function getResourceMapCache(url: string): Promise<ResourceMapAsset | undefined> {
  try {
    return await request<ResourceMapAsset | undefined>('/api/data/resource-map/get', {
      query: {
        url: url,
      },
    });
  } catch (error) {
    console.warn('Fallback to local Dexie for getResourceMapCache:', error);
    return db['resource-map'].get(url);
  }
}
