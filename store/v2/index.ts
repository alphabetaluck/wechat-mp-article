import { request } from '#shared/utils/request';

// 删除公众号数据
export async function deleteAccountData(ids: string[]): Promise<void> {
  await request<{ success: boolean }>('/api/data/account/delete', {
    method: 'POST',
    body: {
      ids: ids,
    },
  });
}
