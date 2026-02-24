# Findings

- Current front-end persistence is Dexie at `store/v2/db.ts` with tables for article/info/html/metadata/comment/resource/etc.
- Main sync path writes article/info through `updateArticleCache()` called from `apis/index.ts#getArticleList`.
- `single.vue` still writes directly to Dexie `db.article`, so compatibility fallback is needed during phased migration.
- Project runs Nuxt with `ssr: false` and Nitro server APIs available.
- Existing Nitro storage is configured for `kv`, but article/info persistence is currently client-only.
- New backend file-db modules:
  - `server/db/article-info-db.ts` (info/article)
  - `server/db/content-db.ts` (html/metadata/comment/comment-reply/resource/resource-map/asset/debug)
- Blob-backed tables are persisted as files under `${NITRO_FILE_DB_BASE:-.data/filedb}/blobs/*`, while indexes/metadata are stored in JSON DB files.
- Added `/api/data/*` endpoints for all migrated tables and switched corresponding `store/v2/*` modules to use them.
- Front-end stores keep local Dexie fallback for phased compatibility.
- `account/delete` now clears both article-info db and content db.
