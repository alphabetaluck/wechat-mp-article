import { markArticleDeletedInDb } from '~/server/db/article-info-db';

export default defineEventHandler(async event => {
  const payload = (await readBody(event)) as { url?: string };
  if (!payload?.url) {
    throw createError({
      statusCode: 400,
      statusMessage: '`url` is required',
    });
  }

  await markArticleDeletedInDb(payload.url);
  return { success: true };
});

