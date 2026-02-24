import { deleteArticleFromDb } from '~/server/db/article-info-db';

export default defineEventHandler(async event => {
  const payload = (await readBody(event)) as {
    fakeid?: string;
    aid?: string;
    link?: string;
  };
  if (!payload?.fakeid || !payload.aid) {
    throw createError({
      statusCode: 400,
      statusMessage: '`fakeid` and `aid` are required',
    });
  }

  return {
    success: await deleteArticleFromDb(payload.fakeid, payload.aid, payload.link),
  };
});

