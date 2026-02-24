import { request } from '#shared/utils/request';

export interface Info {
  fakeid: string;
  completed: boolean;
  count: number;
  articles: number;

  // 公众号昵称
  nickname?: string;
  // 公众号头像
  round_head_img?: string;

  // 公众号文章总数
  total_count: number;
  create_time?: number;
  update_time?: number;

  // 最后更新时间
  last_update_time?: number;
}

/**
 * 更新 info 缓存
 * @param info
 */
export async function updateInfoCache(info: Info): Promise<boolean> {
  const resp = await request<{ success: boolean }>('/api/data/info/update', {
    method: 'POST',
    body: info,
  });
  return resp.success;
}

export async function updateLastUpdateTime(fakeid: string): Promise<boolean> {
  const resp = await request<{ success: boolean }>('/api/data/info/last-update', {
    method: 'POST',
    body: {
      fakeid: fakeid,
    },
  });
  return resp.success;
}

/**
 * 获取 info 缓存
 * @param fakeid
 */
export async function getInfoCache(fakeid: string): Promise<Info | undefined> {
  return request<Info | undefined>('/api/data/info/get', {
    query: {
      fakeid: fakeid,
    },
  });
}

export async function getAllInfo(): Promise<Info[]> {
  return request<Info[]>('/api/data/info/all');
}

// 获取公众号的名称
export async function getAccountNameByFakeid(fakeid: string): Promise<string | null> {
  const account = await getInfoCache(fakeid);
  if (!account) {
    return null;
  }

  return account.nickname || null;
}

// 批量导入公众号
export async function importInfos(infos: Info[]): Promise<void> {
  const normalized = infos.map(info => {
    return {
      ...info,
      completed: false,
      count: 0,
      articles: 0,
      total_count: 0,
      create_time: undefined,
      update_time: undefined,
      last_update_time: undefined,
    };
  });
  await request<{ success: boolean }>('/api/data/info/import', {
    method: 'POST',
    body: {
      infos: normalized,
    },
  });
}
