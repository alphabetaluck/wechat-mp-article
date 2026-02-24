import { upsertMetadataToDb } from '~/server/db/content-db';

export default defineEventHandler(async event => {
  const payload = (await readBody(event)) as Record<string, any>;
  if (!payload?.url || !payload?.fakeid || !payload?.title) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid payload for metadata update',
    });
  }

  return {
    success: await upsertMetadataToDb(payload),
  };
});

