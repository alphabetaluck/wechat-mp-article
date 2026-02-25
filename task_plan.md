# Task Plan

## Goal
Migrate core Dexie persistence from browser IndexedDB to backend storage and expose stable Nuxt server APIs, while keeping current UI flows working.

## Phases
- [x] Phase 1: Implement server file-db service and data model for `info` and `article`
- [x] Phase 2: Add server API routes for read/write/delete operations used by current front-end store
- [x] Phase 3: Refactor `store/v2/info.ts`, `store/v2/article.ts`, and `store/v2/index.ts` to call backend APIs
- [x] Phase 4: Extend migration to content tables (`html`, `metadata`, `comment`, `comment_reply`, `resource`, `resource-map`, `asset`, `debug`)
- [x] Phase 5: Validate endpoints via local dev HTTP calls outside sandbox
- [x] Phase 6: Replace JSON file db implementation with `better-sqlite3` and keep `/api/data/*` contracts unchanged
- [x] Phase 7: Validate SQLite runtime (`npm rebuild better-sqlite3`) and regression test key endpoints
- [x] Phase 8: Remove all front-end Dexie/IndexedDB fallback paths and enforce backend API-only storage flow

## Constraints
- Keep existing function signatures in `store/v2/*` to minimize page-level changes.
- Preserve compatibility for single-article local-only flow via fallback where necessary.

## Validation
- `pnpm exec nuxi prepare` -> passed
- HTTP calls against local dev server -> passed for all `/api/data/*` endpoints on SQLite backend

## Errors Encountered
| Error | Attempt | Resolution |
|-------|---------|------------|
| Dev server could not bind any localhost port in sandbox | 1 | Ran dev server outside sandbox with approval |
| Sandboxed curl could not reach non-sandbox dev process | 1 | Ran curl outside sandbox with approval |
| Dev console repeatedly logs `#app-manifest` pre-transform warning | observed | Did not block server API checks; noted as environment/frontend warning |
| `better-sqlite3` binding missing (`Could not locate the bindings file`) | 1 | Rebuilt native module with `npm rebuild better-sqlite3` outside sandbox |
| `pnpm` add/rebuild hit store permission errors in sandbox | 2 | Switched to `npm` path and executed rebuild outside sandbox |
