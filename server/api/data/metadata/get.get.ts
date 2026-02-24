import { getMetadataFromDb } from '~/server/db/content-db';

export default defineEventHandler(async event => {
  const query = getQuery(event);
  const url = typeof query.url === 'string' ? query.url : '';
  if (!url) {
    throw createError({
      statusCode: 400,
      statusMessage: '`url` is required',
    });
  }
  return getMetadataFromDb(url);
});

