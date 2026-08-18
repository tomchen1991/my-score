# My Score

个人媒体评分：Svelte 前端 + Cloudflare Worker API + D1。

线上：https://review.falsita.cn

合并到 `main` 后由 Cloudflare Workers Builds 自动部署。

## 本地开发

```bash
npm install
npm run dev          # 前端 http://localhost:5173，/api 代理到 8787
npm run dev:worker   # Worker + D1
```

`AUTH_SECRET` 写在 `.dev.vars`。

## 部署

```bash
npm run deploy
```
