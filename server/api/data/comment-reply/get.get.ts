import { getCommentReplyFromDb } from '~/server/db/content-db';

export default defineEventHandler(async event => {
  const query = getQuery(event);
  const url = typeof query.url === 'string' ? query.url : '';
  const contentID = typeof query.contentID === 'string' ? query.contentID : '';
  if (!url || !contentID) {
    throw createError({
      statusCode: 400,
      statusMessage: '`url` and `contentID` are required',
    });
  }
  return getCommentReplyFromDb(url, contentID);
});

