import { syncArticleCacheToDb, type InfoRecord } from '~/server/db/article-info-db';

export default defineEventHandler(async event => {
  const payload = (await readBody(event)) as {
    account?: InfoRecord;
    publish_page?: any;
  };
  if (!payload?.account || !payload.publish_page) {
    throw createError({
      statusCode: 400,
      statusMessage: '`account` and `publish_page` are required',
    });
  }

  await syncArticleCacheToDb(payload.account, payload.publish_page);
  return { success: true };
});

