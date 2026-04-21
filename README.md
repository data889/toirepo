# toirepo.app

众包厕所地图 — 专门标注"官方地图上没有但实际可用"的免费厕所。MVP 从东京起步，未来全球。

## 本地开发

### 前置要求

- Node 22 LTS（`.nvmrc` 已声明，`nvm use` 自动切换）
- pnpm 10+（项目 `.npmrc` 启用 `engine-strict`，不符版本会被拒绝）
- Docker Desktop 或 OrbStack

### 启动

```bash
nvm use
pnpm install
# 首次：复制 env 模板（两份文件的 DATABASE_URL 必须一致）
cp .env.local.example .env.local
cp .env.local.example .env      # Prisma CLI 读 .env；应用读 .env.local
docker compose up -d            # 启动 PostgreSQL 16 + PostGIS 3.4（端口 5433）
pnpm prisma migrate dev         # 应用数据库 migration
pnpm prisma generate            # 生成 Prisma client
pnpm dev                        # 启动开发服务器
```

访问 http://localhost:3000/zh-CN/

> `.env` 与 `.env.local` 都被 `.gitignore` 忽略，不会入库。两者内容应保持一致：
> Prisma CLI（`prisma.config.ts` 里 `import 'dotenv/config'`）读 `.env`，
> 应用运行时（Next.js 默认行为）读 `.env.local`。

### 常用命令

| 命令                                | 用途                                               |
| ----------------------------------- | -------------------------------------------------- |
| `pnpm dev`                          | 启动开发服务器（Turbopack）                        |
| `pnpm build` / `pnpm start`         | 生产构建与启动                                     |
| `pnpm typecheck`                    | `tsc --noEmit` 类型检查                            |
| `pnpm lint`                         | ESLint                                             |
| `pnpm format:check` / `pnpm format` | Prettier 检查 / 自动修复                           |
| `pnpm smoke:db`                     | 数据库端到端冒烟测试（tsx + pg adapter + trigger） |
| `pnpm auth:check`                   | 列出 User 表所有记录（Auth 测试后确认入库）        |
| `pnpm prisma migrate dev`           | 应用新 migration                                   |
| `pnpm prisma generate`              | 重新生成 Prisma client                             |
| `pnpm prisma studio`                | 数据库 GUI（http://localhost:5555）                |
| `docker compose up -d` / `down`     | PostgreSQL 容器启停                                |

### 本机端口

toirepo 使用 **5433**（本机 5432 被其他项目 `planning_db` 占用）。
生产 Supabase 不受影响。

### Auth 测试（手工）

T2.2 的登录流程需要在浏览器里实际点一遍。`.env.local` 填好 4 个 auth
secret 后：

1. `pnpm dev` 启动。
2. 访问 `http://localhost:3000/zh-CN/auth/signin`——应看到
   "登录 toirepo" 标题、Google 按钮、邮箱输入框。
3. **Google OAuth 测试**：
   - 点 "使用 Google 账号登录" → 跳到 Google 授权页 → 选账号 →
     回到 `http://localhost:3000/zh-CN`（首页）。
   - 打开 DevTools → Application → Cookies，确认有 `authjs.session-token`。
   - 跑 `pnpm auth:check`，应看到刚登录的邮箱 + `role=USER`。
4. **Magic Link 测试**：
   - 在 signin 页输入一个**已注册 Resend 邮箱**的邮件地址
     （`onboarding@resend.dev` 测试域名只能发给注册 Resend 的账号）
     → 点 "发送登录链接"。
   - 检查邮箱收件箱。
   - 点邮件里的登录链接 → 自动登录并跳转首页。
5. **受保护路由测试**：
   - 登录后访问 `/zh-CN/me`：预期 200（我们还没建 /me 页面所以会 404，
     但至少不再重定向回 signin，说明 session 有效）。
   - 做登出（浏览器里手工清 cookie，或访问 `/api/auth/signout`）
     后再访问 `/zh-CN/me`：应 307 重定向回 signin 并带 callbackUrl。

测试失败的常见原因：

- `redirect_uri_mismatch`：Google Cloud Console 的 OAuth client 里没加
  `http://localhost:3000/api/auth/callback/google` 到 Authorized
  redirect URIs。
- `invalid_key` / Resend 邮件没到：`RESEND_API_KEY` 不对，或发件方
  `EMAIL_FROM` 未在 Resend dashboard 验证。

## 参考文档

- `CLAUDE.md` — 项目级 AI 执行指令（所有 Claude Code session 必读）
- `docs/PROJECT_SPEC.md` — 规格总纲（v1.1，含 v1.0→v1.1 偏差说明）
- `docs/TASK_BREAKDOWN.md` — 任务拆解（v1.1，按 M1→M11 顺序执行）
- `docs/COLORS.md` — 配色快查表（SPEC §4.2 落地）

## 技术栈

Next.js 16 · Tailwind v4 · Prisma 7 (pg adapter) · PostgreSQL 16 + PostGIS · next-auth v5 · tRPC 11 · next-intl v4 · MapLibre GL 5 · shadcn/ui · Zod 4
