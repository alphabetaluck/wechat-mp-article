import { deleteHtmlFromDb } from '~/server/db/content-db';

export default defineEventHandler(async event => {
  const payload = (await readBody(event)) as { url?: string };
  if (!payload?.url) {
    throw createError({
      statusCode: 400,
      statusMessage: '`url` is required',
    });
  }

  return {
    success: await deleteHtmlFromDb(payload.url),
  };
});
