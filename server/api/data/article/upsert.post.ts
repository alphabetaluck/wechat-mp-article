import { type ArticleRecord, upsertArticleToDb } from '~/server/db/article-info-db';

export default defineEventHandler(async event => {
  const payload = (await readBody(event)) as ArticleRecord;
  if (!payload?.fakeid || !payload.aid || !payload.link) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid payload for article upsert',
    });
  }

  return {
    success: await upsertArticleToDb(payload),
  };
});

