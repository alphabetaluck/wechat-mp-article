export type ApiName = 'searchbiz' | 'appmsgpublish';

interface APICall {
  name: ApiName;
  account: string;
  call_time: number;
  is_normal: boolean;
  payload: Record<string, any>;
}

export type { APICall };

const apiCalls: APICall[] = [];

/**
 * 写入调用记录
 * @param record
 */
export async function updateAPICache(record: APICall) {
  apiCalls.push(record);
  return true;
}

export async function queryAPICall(
  account: string,
  start: number,
  end: number = new Date().getTime()
): Promise<APICall[]> {
  return apiCalls.filter(item => item.account === account && item.call_time > start && item.call_time < end);
}
