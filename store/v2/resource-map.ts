import { request } from '#shared/utils/request';

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
  const resp = await request<{ success: boolean }>('/api/data/resource-map/update', {
    method: 'POST',
    body: resourceMap,
  });
  return resp.success;
}

/**
 * 获取 resource-map 缓存
 * @param url
 */
export async function getResourceMapCache(url: string): Promise<ResourceMapAsset | undefined> {
  return request<ResourceMapAsset | undefined>('/api/data/resource-map/get', {
    query: {
      url: url,
    },
  });
}
