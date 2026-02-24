import { type InfoRecord, importInfosToDb } from '~/server/db/article-info-db';

export default defineEventHandler(async event => {
  const payload = (await readBody(event)) as { infos?: InfoRecord[] };
  if (!payload?.infos || !Array.isArray(payload.infos)) {
    throw createError({
      statusCode: 400,
      statusMessage: '`infos` must be an array',
    });
  }

  await importInfosToDb(payload.infos);
  return { success: true };
});

