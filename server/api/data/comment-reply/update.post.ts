import { upsertCommentReplyToDb } from '~/server/db/content-db';

export default defineEventHandler(async event => {
  const payload = (await readBody(event)) as {
    fakeid?: string;
    url?: string;
    title?: string;
    data?: any;
    contentID?: string;
  };
  if (!payload?.fakeid || !payload.url || !payload.title || !payload.contentID) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid payload for comment reply update',
    });
  }

  return {
    success: await upsertCommentReplyToDb({
      fakeid: payload.fakeid,
      url: payload.url,
      title: payload.title,
      data: payload.data,
      contentID: payload.contentID,
    }),
  };
});

