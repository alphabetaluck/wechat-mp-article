import { updateLastUpdateTimeInDb } from '~/server/db/article-info-db';

export default defineEventHandler(async event => {
  const payload = (await readBody(event)) as { fakeid?: string };
  if (!payload?.fakeid) {
    throw createError({
      statusCode: 400,
      statusMessage: '`fakeid` is required',
    });
  }

  return {
    success: await updateLastUpdateTimeInDb(payload.fakeid),
  };
});

