import { getAllInfosFromDb } from '~/server/db/article-info-db';

export default defineEventHandler(async () => {
  return getAllInfosFromDb();
});
