import { upsertResourceMapToDb } from '~/server/db/content-db';

export default defineEventHandler(async event => {
  const payload = (await readBody(event)) as {
    fakeid?: string;
    url?: string;
    resources?: string[];
  };
  if (!payload?.fakeid || !payload.url || !Array.isArray(payload.resources)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid payload for resource-map update',
    });
  }
  return {
    success: await upsertResourceMapToDb({
      fakeid: payload.fakeid,
      url: payload.url,
      resources: payload.resources,
    }),
  };
});

