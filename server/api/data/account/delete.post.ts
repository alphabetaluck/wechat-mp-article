import { deleteAccountDataFromDb } from '~/server/db/article-info-db';
import { deleteAccountContentFromDb } from '~/server/db/content-db';

export default defineEventHandler(async event => {
  const payload = (await readBody(event)) as { ids?: string[] };
  if (!payload?.ids || !Array.isArray(payload.ids)) {
    throw createError({
      statusCode: 400,
      statusMessage: '`ids` must be an array',
    });
  }

  await deleteAccountDataFromDb(payload.ids);
  await deleteAccountContentFromDb(payload.ids);
  return { success: true };
});
