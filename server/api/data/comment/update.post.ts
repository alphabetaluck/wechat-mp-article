import { upsertCommentToDb } from '~/server/db/content-db';

export default defineEventHandler(async event => {
  const payload = (await readBody(event)) as {
    fakeid?: string;
    url?: string;
    title?: string;
    data?: any;
  };
  if (!payload?.fakeid || !payload.url || !payload.title) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid payload for comment update',
    });
  }

  return {
    success: await upsertCommentToDb({
      fakeid: payload.fakeid,
      url: payload.url,
      title: payload.title,
      data: payload.data,
    }),
  };
});

