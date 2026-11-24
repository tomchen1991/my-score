# My Score

个人媒体评分：Svelte 前端 + Cloudflare Worker API + D1。

线上：https://review.falsita.cn

发布入口为 `npm run deploy`，由自有 DevOps 流水线调用。切换时先在 Cloudflare Dashboard 断开 Workers Builds 的 Git 集成，避免合并到 `main` 时重复发布。

## 本地开发

```bash
npm ci
npx wrangler d1 migrations apply my-score --local
npm run dev          # 前端 http://localhost:5173，/api 代理到 8787
# 另一个终端：
npm run dev:worker   # 本地 Worker，接受 localhost:5173 的登录请求
```

本地若要手动登录，在 `.dev.vars` 配置独立测试 client 的 `OIDC_CLIENT_ID`、`OIDC_CLIENT_SECRET` 和 `AUTH_SESSION_KEY`。`npm run test:auth` 使用模拟 Auth 和隔离的本地 D1，不需要生产凭据或真实验证码。

## Auth 接入与部署

1. 在 [Falsita Auth 管理页](https://auth.falsita.cn/manage) 为 `my-score` 创建独立 client，绑定选定的密钥组，同时启用「允许应用站内输入验证码」和「24 小时活动滑动会话」。站内登录无需填写回调 URL；Auth 目前只接受单用户身份 `sub=owner`。
2. 在 `my-score` Worker 配置 `OIDC_CLIENT_ID`、`OIDC_CLIENT_SECRET` 和 `AUTH_SESSION_KEY`；用 Cloudflare Dashboard 或 `npx wrangler secret put <名称>` 写入。`AUTH_SESSION_KEY` 是独立的随机 32 字节密钥，以 Base64 存储（例如用 `openssl rand -base64 32` 生成）。不要提交凭据；更换此密钥会使现有本站会话失效。
3. 首次发布前完成上述配置。DevOps 在项目根目录执行 `npm ci`、`npm run deploy`；发布任务通过流水线密钥注入 `CLOUDFLARE_API_TOKEN` 和 `CLOUDFLARE_ACCOUNT_ID`。应用的 Auth Secret 单独保存在 Worker，不需要传给前端构建。Wrangler 会创建会话 Durable Object，本次不需要 D1 迁移。旧用户名/密码与 JWT 不再使用；首次访问须以 Auth 重新登录。确认不再需要旧版回滚后，可移除已弃用的 `AUTH_SECRET`，并单独清理旧 D1 用户凭据。

站内使用 6 位验证码或 32 位恢复码登录，浏览器只保存 HttpOnly Cookie。切换分类、翻页和新增、编辑、删除作品会把空闲期限延长到 24 小时；打开页面或后台检查只验证会话，不续期。受保护的 API 每次在线校验，Auth 管理端撤销后，下次请求即失效。退出会清除本站会话并向 Auth 请求撤销当前授权，不退出其他应用。`GET /api/media/perfect` 保持公开。
