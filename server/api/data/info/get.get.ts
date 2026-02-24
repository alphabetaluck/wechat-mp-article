import { getInfoFromDb } from '~/server/db/article-info-db';

export default defineEventHandler(async event => {
  const query = getQuery(event);
  const fakeid = typeof query.fakeid === 'string' ? query.fakeid : '';
  if (!fakeid) {
    throw createError({
      statusCode: 400,
      statusMessage: '`fakeid` is required',
    });
  }

  return getInfoFromDb(fakeid);
});

