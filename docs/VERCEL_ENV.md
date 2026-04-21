# Vercel Environment Variables · 配置清单

> 配置位置：Vercel Dashboard → 你的 project → Settings → Environment
> Variables → `Add New`。每条变量需明确指定生效环境（Production /
> Preview / Development，可多选）。
>
> 本表按 prod 必须 / preview 必须 / 可选 分组。Dev 用 .env.local，不在此处。

---

## 1. Production 必须（25 项）

### 1.1 数据库（Supabase）

| Variable | 值来源 | 注意 |
|---|---|---|
| `DATABASE_URL` | Supabase Dashboard → Settings → Database → **Transaction pooler URI**（端口 6543）| 末尾加 `?sslmode=require` |
| `DIRECT_URL` | Supabase 同页 → **Direct connection URI**（端口 5432）| 末尾加 `?sslmode=require`。runtime 不直接用，但 Prisma 7 部分 introspection 路径仍读 |

### 1.2 Auth.js v5

| Variable | 值来源 | 注意 |
|---|---|---|
| `AUTH_SECRET` | 本地跑 `openssl rand -hex 32` | 32 字节 hex；prod 与 dev **必须不同** |
| `AUTH_GOOGLE_ID` | Google Cloud Console → APIs & Services → Credentials → OAuth 客户端 ID | 同一 OAuth 客户端可同时给 dev/prod 用（已加 prod 回调 URL） |
| `AUTH_GOOGLE_SECRET` | 同上 secret | 不要复用 dev 的；如有泄露风险，prod 重新生成一对 |
| `AUTH_URL` | `https://toirepo.com` | next-auth v5 推断 OAuth callback；preview 可不填，next-auth 会 fallback 到 `VERCEL_URL` |

### 1.3 Cloudflare R2

| Variable | 值 |
|---|---|
| `R2_ACCOUNT_ID` | Cloudflare Dashboard → R2 → 右侧 Account ID |
| `R2_ACCESS_KEY_ID` | R2 → Manage R2 API Tokens → 用于 prod 的 token |
| `R2_SECRET_ACCESS_KEY` | 同上 secret |
| `R2_BUCKET_NAME` | `toirepo-tiles` |
| `R2_PHOTOS_BUCKET_NAME` | `toirepo-photos` |
| `R2_PUBLIC_URL` | 例如 `https://photos.toirepo.com`（自定义 R2 公网 hostname）|
| `NEXT_PUBLIC_R2_PUBLIC_URL` | 与 `R2_PUBLIC_URL` 相同值。**注意 NEXT_PUBLIC 前缀**。MapTiler key 存在时仅作 fallback |

### 1.3.1 MapTiler basemap（M10 P2 加入）

| Variable | 值 |
|---|---|
| `NEXT_PUBLIC_MAPTILER_KEY` | MapTiler Cloud account (https://cloudflare.com/account) → API keys → 复制 default key。Free tier 每月 100k tile requests 够 MVP 流量。设置后地图 style 走 `api.maptiler.com/maps/basic-v2-light/style.json?key=…`（全球覆盖）；不设置则回退到 R2 自托管 tokyo.pmtiles（东京 only，MAX_BOUNDS 自动启用）|

Prod / Preview 两侧都配同一 key 即可。Attribution 自动随 style 返回 "© MapTiler © OpenStreetMap contributors"，无需手工拼接。

### 1.4 AI / 翻译

| Variable | 值 |
|---|---|
| `ANTHROPIC_API_KEY` | console.anthropic.com → API Keys |
| `DEEPL_API_KEY` | DeepL Pro 控制台。M8 使用，M10 P1 暂不阻塞但建议提前配 |

### 1.5 邮件（Resend）

| Variable | 值 |
|---|---|
| `RESEND_API_KEY` | resend.com → API Keys |
| `AUTH_RESEND_FROM` | `noreply@toirepo.com`（M10 P2 加入；Resend 域名验证后的 authoritative sender）|
| `EMAIL_FROM` | `noreply@toirepo.com`（pre-M10 遗留名，auth.ts 作 fallback 保留；两者值相同即可）|

### 1.6 Upstash Rate Limit

| Variable | 值来源 |
|---|---|
| `UPSTASH_REDIS_REST_URL` | console.upstash.com → 你的 Redis instance → REST URL |
| `UPSTASH_REDIS_REST_TOKEN` | 同上 token |

### 1.7 规范站点 URL（SEO + sitemap）

| Variable | 值 |
|---|---|
| `NEXT_PUBLIC_SITE_URL` | `https://toirepo.com` — 驱动 layout metadataBase / robots / sitemap / hreflang 绝对 URL |

### 1.8 PostHog 分析

| Variable | 值 |
|---|---|
| `NEXT_PUBLIC_POSTHOG_KEY` | posthog.com → Project Settings → Project API Key |
| `NEXT_PUBLIC_POSTHOG_HOST` | `https://us.i.posthog.com`（默认）或 `https://eu.i.posthog.com` |

---

## 2. Preview 推荐（自动注入或可省）

| Variable | 处理 |
|---|---|
| `VERCEL_URL` | Vercel 自动注入（`toirepo-git-<branch>.vercel.app`），无需手动配 |
| `AUTH_URL` | Preview 不填，next-auth 自动 fallback 到 `VERCEL_URL`。但 OAuth callback 需要 Google Cloud Console 加 preview 域名才能登录——MVP 阶段 preview 不做完整 OAuth 测试 |
| 其余敏感凭据 | 复用 Production 的值（在 Vercel Add Variable 时勾选 Preview + Production）|

**Preview 的 R2 + photo CORS 限制**：preview deployment 的 origin 是
`toirepo-git-<branch>.vercel.app`，不在 R2 CORS 白名单里。视觉测试需要切到
prod URL。代码功能（不依赖图片）preview 仍可测。

---

## 3. Development（**不**配 Vercel）

dev 走 `.env.local`，不进 Vercel。`.env.local.example` 是模板。

---

## 4. 配完后的 Redeploy

第一次配好所有变量后，需要在 Vercel Dashboard → Deployments → 最新部署
→ `…` → `Redeploy` 触发一次重 build（之前那次 build 缺失 env 已失败）。

---

## 5. 检查清单（快速过一遍）

- [ ] Production: 17 项（含 2 个 NEXT_PUBLIC_）全部配齐
- [ ] Preview: 不需要单独配，复用 Production 的（在 Add Variable 时勾选 Preview）
- [ ] `NEXT_PUBLIC_R2_PUBLIC_URL` 与 `R2_PUBLIC_URL` 相等
- [ ] `AUTH_URL` 是 `https://toirepo.com`（不是 http、不是 www. 前缀、不是 trailing slash）
- [ ] Google Cloud Console 的 OAuth Authorized redirect URIs 含 `https://toirepo.com/api/auth/callback/google`
- [ ] Supabase URI 末尾的 `?sslmode=require` 没漏

---

## 6. 关联

- `docs/DEPLOYMENT.md` — 完整首次部署流程（步骤化）
- `.env.local.example` — dev 模板，三类变量分组
