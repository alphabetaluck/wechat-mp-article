import { upsertResourceToDb } from '~/server/db/content-db';

export default defineEventHandler(async event => {
  const payload = (await readBody(event)) as {
    fakeid?: string;
    url?: string;
    file_base64?: string;
    file_type?: string;
  };
  if (!payload?.fakeid || !payload.url || !payload.file_base64) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid payload for resource update',
    });
  }

  return {
    success: await upsertResourceToDb({
      fakeid: payload.fakeid,
      url: payload.url,
      file_base64: payload.file_base64,
      file_type: payload.file_type,
    }),
  };
});

