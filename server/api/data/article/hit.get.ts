import { hitArticleCacheFromDb } from '~/server/db/article-info-db';

export default defineEventHandler(async event => {
  const query = getQuery(event);
  const fakeid = typeof query.fakeid === 'string' ? query.fakeid : '';
  const createTime = Number(query.create_time || 0);
  if (!fakeid || !createTime) {
    throw createError({
      statusCode: 400,
      statusMessage: '`fakeid` and `create_time` are required',
    });
  }

  return {
    hit: await hitArticleCacheFromDb(fakeid, createTime),
  };
});

