# 生产部署运维手册

> 本文档是 toirepo 首次正式部署的"按部就班"手册。M10 P1 走完后，主要内容
> 进入"运维参考"角色——日常运维不需要重新跑一遍，但 Vercel 项目重建 /
> Supabase 迁移 / DNS 重配 时仍按此文执行。
>
> **首次部署目标域名**：`https://toirepo.com`（Cloudflare Registrar 注册，
> DNS 同在 Cloudflare）。
> **生产 DB**：Supabase project `toirepo-prod`，region `ap-northeast-1
> (Tokyo)`。
> **托管**：Vercel，绑定 `github.com/data889/toirepo` main 分支自动部署。

---

## 0. 前置检查

- [ ] CLAUDE.md 红线全部理解（不动 schema / 不硬编码 key / 不抢占端口）
- [ ] 本地 `pnpm typecheck && pnpm lint && pnpm test && pnpm format:check` 全绿
- [ ] git status 干净（生产部署前不要带未提交修改）

---

## 1. Supabase 生产 DB 首次 migration

> Ming 本地机器跑一次。**不导入测试数据 / seed**——仅同步 schema。
> M11 OSM 导入流水线放 prod 在本节末尾跑一次。

### 1.1 拿 Supabase 连接 URI

进 Supabase Dashboard → 你的 `toirepo-prod` 项目 → Settings → Database →
**Connection string** 段：

- **Transaction pooler URI**（端口 6543）→ 给 Vercel runtime 用
  → 在 Vercel 配 `DATABASE_URL`
- **Direct connection URI**（端口 5432）→ 给 prisma migrate / drift 检查用
  → 临时设环境变量 `DIRECT_URL`，**不**写进 `.env.local`（避免本地误连
  prod DB）

两个 URI 都加 `?sslmode=require` 后缀（Supabase prod 必须 TLS）。

### 1.2 Drift 检查

部署前先看本地 schema 和 prod DB 是否一致。**首次部署 prod DB 是空的**，
drift 会显示完整 schema 待 apply——这是预期。

```bash
DIRECT_URL='postgresql://postgres.<ref>:<pwd>@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres?sslmode=require' \
  pnpm prod:migrate-drift
```

输出含 `MIGRATION FILES MATCH SCHEMA` → 直接进 1.3。
输出含 `WARNING: drift detected` → 停下来读 KNOWN_ISSUES `Prisma 7 drift`
段（M2 / M6 P2 / M7 P1 / M7 P1.5 累计 5 次手动处理过 drift）。**不要跑
`prisma migrate dev`**——会要求重置已有数据。

### 1.3 跑 migration

```bash
DIRECT_URL='<上面那串 direct URI>' pnpm prod:migrate
```

成功标志：脚本输出"✓ Migration applied" + 列出全部 tables。

### 1.4 验证 PostGIS 扩展

```bash
psql 'postgresql://postgres.<ref>:<pwd>@.../postgres?sslmode=require' \
  -c "SELECT PostGIS_Version();"
```

返回 `3.x` → OK。Supabase 默认启用 PostGIS extension。

---

## 2. R2 生产 CORS 切换

> 现在 R2 bucket CORS 白名单含 `localhost:3000` + `192.168.151.5:3000`
> （DHCP 漂移过的 LAN IP）。Prod 上线时要把 `https://toirepo.com` 加入，
> LAN IP 删掉。完整 CORS JSON 在 `docs/R2_CORS.md`。

操作要点：
1. Cloudflare Dashboard → R2 → `toirepo-tiles` bucket → Settings → CORS
   Policy → Edit。粘贴 R2_CORS.md §"prod 切换" 给的 JSON。
2. 同样改 `toirepo-photos` bucket（CORS JSON 略不同——多一个 `PUT`）。
3. R2 CORS 即时生效，不需重建 bucket。

完整步骤 + JSON：见 `docs/R2_CORS.md`。

---

## 3. Vercel 项目配置

### 3.1 Environment Variables

进 Vercel Dashboard → 你的 project → Settings → Environment Variables，
按 `docs/VERCEL_ENV.md` 一项一项加。Production / Preview 分别配。

### 3.2 Domain 添加

Vercel project → Settings → Domains → `Add` → `toirepo.com`：

1. Vercel 会显示需要的 DNS 记录（A / AAAA 或 CNAME）。
2. 切到 Cloudflare Dashboard → DNS → Records，按 Vercel 给的指引加：
   - `A @ 76.76.21.21`，**Proxy status: DNS Only（灰云）**
   - `AAAA @ <Vercel 给的 IPv6>`，DNS Only
   - `CNAME www <toirepo.com>`，DNS Only
3. 回 Vercel 点 `Refresh`。等 1–5 分钟 DNS propagation。
4. Vercel 自动 provision Let's Encrypt 证书。
5. 同流程加 `www.toirepo.com`，Vercel 内置 redirect → `toirepo.com`。

**为什么灰云**：M10 P1 只测原生 Vercel→Cloudflare DNS 链路。M10 P2 polish
阶段再决定是否切橙云（带 Cloudflare CDN）。橙云会改变 SSL 协议栈，先稳
定一周再调。

### 3.3 触发首次正式部署

Vercel 会在 push main 时自动部署。如果环境变量是后配的，需要在 Vercel
Dashboard → Deployments → 最新一条 → `Redeploy` 触发一次重 build（这次
带 env）。

成功 build 后 Vercel 给的临时 URL 应该 200。等 DNS / SSL 落定后
`https://toirepo.com` 也 200。

---

## 4. 生产健康验证

跑健康检查脚本：

```bash
PROD_URL='https://toirepo.com' pnpm prod:healthcheck
```

期望全 ✓：
- 三个 locale 根页 200
- `/api/trpc/toilet.list?...` 返回 JSON
- `/manifest.webmanifest` / `/sitemap.xml` / `/robots.txt` 200
- OAuth `/api/auth/signin/google` 返回 Google 重定向

---

## 5. M11 OSM 数据导入到 prod

最后一步：把 10,106 条 OSM toilets 灌进 prod DB。**Ming 本地机器跑**——
连 prod DB 走 direct URI。

```bash
DATABASE_URL='<Supabase direct URI>' pnpm osm:import
```

预计 4–5 秒。完成后 prod 地图就有数据了。

**不要跑 `pnpm seed`**——23 条 mock 数据不进 prod。

---

## 6. 回滚

Vercel Dashboard → Deployments → 找到上一个正常部署 → `…` → `Promote to
Production`。一键回滚到前一版本。

DB schema 回滚不会自动发生（migrate deploy 是单向），如果新 migration
导致问题需要手动改。M10 阶段 schema 已稳定，预计不会用到。

---

## 7. 常见故障

| 症状 | 排查 |
|---|---|
| Vercel build 失败 `Module not found: @/generated/prisma` | postinstall hook 没跑。检查 `package.json` 的 `postinstall` 字段存在 |
| Build 成功但运行时 `PrismaClientInitializationError` | `DATABASE_URL` 没配，或写错 connection string |
| Google OAuth 跳转回 callback 报 `redirect_uri_mismatch` | Google Cloud Console → OAuth 客户端 → Authorized redirect URIs 没加 `https://toirepo.com/api/auth/callback/google` |
| 地图加载但底图 404 | `NEXT_PUBLIC_R2_PUBLIC_URL` 漏配，或 R2 CORS 没加 prod 域名 |
| 用户上传照片报 CORS | `toirepo-photos` bucket CORS 没加 prod 域名 |

---

## 8. 关联文档

- `docs/VERCEL_ENV.md` — Vercel 环境变量逐项说明
- `docs/R2_CORS.md` — R2 bucket CORS 配置（替代旧的 LAN_ACCESS.md）
- `docs/KNOWN_ISSUES.md` — Prisma 7 drift / R2 CORS 通配符等历史债务
- `.env.local.example` — 本地 dev env 模板
