# wechat-mp-article

这是一个基于上游项目(wechat-article/wechat-article-exporter)维护的 fork，用于批量下载和导出微信公众号文章内容，支持文章列表、正文、评论、资源等数据处理与导出。

本分支已将核心缓存存储从浏览器 IndexedDB（Dexie）迁移为后端文件数据库（保留前端 Dexie 兜底），以便统一数据管理、便于服务端部署与调试。

## 本 fork 的主要改动

- 新增后端文件数据库：
  - `server/db/article-info-db.ts`
  - `server/db/content-db.ts`
- 新增并接入 `/api/data/*` 数据接口：
  - `info`、`article`、`html`、`metadata`、`comment`、`comment-reply`
  - `resource`、`resource-map`、`asset`、`debug`、`account/delete`
- 前端 `store/v2/*` 已切换为后端 API 优先，Dexie 作为失败兜底。
- 单篇处理流程（`pages/dashboard/single.vue`）不再直接写 Dexie，改为通过 store API 写入后端。

## 快速开始

环境要求：

- Node.js `>= 22`

安装依赖并启动开发：

```bash
npm install
npm run dev
```

## 数据存储说明

后端文件数据库默认写入：

- `.data/filedb`

可通过环境变量覆盖：

```bash
NITRO_FILE_DB_BASE=/your/path/to/filedb
```

其中正文、资源等二进制数据存储在 `blobs/` 子目录，索引与结构化数据存储为 JSON 文件。

## 开发验证

- `pnpm exec nuxi prepare` 通过
- 本地 `npm run dev` 启动后，已验证 `/api/data/*` 主要读写接口可用

## 许可证

MIT
