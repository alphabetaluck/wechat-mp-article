import { upsertHtmlToDb } from '~/server/db/content-db';

export default defineEventHandler(async event => {
  const payload = (await readBody(event)) as {
    fakeid?: string;
    url?: string;
    title?: string;
    commentID?: string | null;
    file_base64?: string;
    file_type?: string;
  };
  if (!payload?.fakeid || !payload.url || !payload.title || !payload.file_base64) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid payload for html update',
    });
  }

  return {
    success: await upsertHtmlToDb({
      fakeid: payload.fakeid,
      url: payload.url,
      title: payload.title,
      commentID: payload.commentID || null,
      file_base64: payload.file_base64,
      file_type: payload.file_type,
    }),
  };
});

