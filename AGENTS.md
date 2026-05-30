# AGENTS.md

## 项目简介

Nuxt 3 应用（SPA + Nitro 服务端），用于批量下载/导出微信公众号文章。客户端完全由浏览器渲染（`ssr: false`），Nitro 负责服务端 API 路由，数据存储基于 SQLite + blob。

**包管理器：** `pnpm`（本地开发用 pnpm；Dockerfile 使用 Yarn，不要混淆）。  
**Node：** >= 22。

## 常用命令

```bash
pnpm install          # 同时自动执行 `nuxt prepare`（生成 .nuxt/ 类型）
pnpm dev              # 启动开发服务器
pnpm build            # 生产构建 → .output/
pnpm preview          # Cloudflare Pages 本地预览（会先执行构建）
pnpm format           # Biome：格式化 + 整理 import（唯一的格式化步骤）
```

不存在 `test`、`lint`、`typecheck` 脚本。手动类型检查：`pnpm exec nuxi typecheck`。

## 工具链注意事项

- **类型是生成的**，不提交到仓库。`.nuxt/tsconfig.json` 由 `nuxt prepare` 生成（`pnpm install` 时自动触发）。类型缺失时运行 `pnpm exec nuxi prepare`。
- **Biome**（`biome.json`）负责格式化和 import 整理，**linter 已显式关闭**（`"linter": { "enabled": false }`）。`.prettierrc` 仅用于编辑器兼容，实际格式化工具是 Biome。
- **`better-sqlite3`** 是原生 Node addon。在新机器安装或升级 Node 版本后，需执行：`npm rebuild better-sqlite3`。
- 未配置任何测试框架，不存在测试文件。

## 架构

```
pages/          Vue 路由页面（SPA）
components/     Vue 组件
composables/    Vue composables
store/v2/       Pinia store — 调用服务端 API，不使用浏览器 IndexedDB
server/
  api/data/     Nitro REST API 路由（所有数据读写均经此处）
  db/           SQLite 层（better-sqlite3）：sqlite.ts、article-info-db.ts、content-db.ts
  kv/           Nitro KV 存储处理器
apis/           客户端 API 调用封装
shared/         客户端与服务端共用代码
types/          TypeScript 类型定义
```

数据流：Vue 页面 → Pinia store（`store/v2/`）→ `apis/` fetch 封装 → Nitro API 路由（`server/api/data/`）→ SQLite / blob 存储。

运行时数据存放在 `.data/filedb/`（已 gitignore）：`wechat-article.db` 和 `blobs/`。

## 环境变量

| 变量 | 默认值 | 说明 |
|---|---|---|
| `NITRO_FILE_DB_BASE` | `.data/filedb` | 覆盖 SQLite + blob 存储根路径 |
| `NITRO_KV_DRIVER` | `memory` | Docker/生产环境使用 `fs` |
| `NITRO_KV_BASE` | — | KV 文件系统存储路径（driver=fs 时使用）|
| `NUXT_AGGRID_LICENSE` | — | AG Grid Enterprise 授权密钥 |

## CI / 发布

- CI（`.github/workflows/docker.yml`）仅在 `v*` 标签推送时触发，CI 中不执行 test/lint/typecheck。
- 发布流程：`git tag v<version> && git push --tags` → 多架构 Docker 镜像推送至 GHCR。
- Docker 镜像暴露端口 3000，以非 root `node` 用户运行。
