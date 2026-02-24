import { type InfoRecord, updateInfoInDb } from '~/server/db/article-info-db';

export default defineEventHandler(async event => {
  const payload = (await readBody(event)) as InfoRecord;
  if (!payload || !payload.fakeid) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid payload',
    });
  }

  return {
    success: await updateInfoInDb(payload),
  };
});

