# Cloudflare 橙云切换 runbook

## 背景

M10 P1 部署上线时 `toirepo.com` 的 DNS 记录（Cloudflare Registrar +
Cloudflare DNS）配的是**灰云 (DNS Only)**，流量直达 Vercel Edge。橙云
切换 = 打开 Cloudflare 代理，流量经过 Cloudflare Edge 再到 Vercel。

好处：

- Cloudflare 的 anti-DDoS / bot protection（免费自动启用）
- 更近的 PoP（日本用户命中东京 PoP 而非 Vercel 的 SFO / ICN）
- 独立的 WAF 规则层（免费 tier 够基本 rate limit + custom rules）
- 可控的 edge cache 层（对 static assets 效果最大）

代价：

- Cloudflare 的 TLS 层介入 → 需正确配置 SSL mode，否则双层证书冲突
- Cloudflare 的默认优化（Rocket Loader / Auto Minify / 缓存策略）与
  Next.js App Router 的 RSC streaming / dynamic routes 可能冲突 → 需显
  式关掉
- Next.js 的动态 metadata / ISR / Server Actions 的 cache header 经 CF
  再经浏览器 → 两层缓存 key 可能错位

本文档**只写步骤**。真正切换时逐项在 Cloudflare Dashboard 手动勾选（不自动化），每步单独验证。

---

## 切换前检查清单

- [ ] Vercel Deployment → Settings → Domains → `toirepo.com` 显示 Valid
      Configuration (Edge Config)
- [ ] `curl -sI https://toirepo.com` 看到 `server: Vercel`（灰云直达的
      标记；切换后会变 `server: cloudflare`）
- [ ] Vercel → Project → Settings → Security 关掉 "Deployment
      Protection"（否则 Cloudflare 的 crawler / preview 请求会被 401
      拦截导致 health check 误报）
- [ ] `docs/VERCEL_ENV.md` 里 `NEXT_PUBLIC_SITE_URL` 已是
      `https://toirepo.com`（Vercel prod 环境已配）
- [ ] 健康检查脚本 `pnpm prod:healthcheck` 跑通（9/9 green）

---

## 步骤 1 · Cloudflare SSL mode

Dashboard → `toirepo.com` → SSL/TLS → Overview

- 目标：**Full (Strict)**
- 含义：CF → origin 走 HTTPS，且 CF 校验 origin 证书有效性
- Vercel 提供的证书是 Let's Encrypt，CF 原生信任，无需额外配置
- ⚠ 不要用 "Flexible" — CF → origin 走 HTTP，Vercel 会 301 到 HTTPS，造
  成无限重定向
- ⚠ 不要用 "Full" (无 Strict) — 接受自签，降低安全性且无实际好处

验证：切到 Full (Strict) 后，`curl -v https://toirepo.com 2>&1 | grep
'server:'` 看到 `cloudflare`（说明经过 CF）+ `curl` 仍 200（说明 CF→
Vercel TLS handshake 成功）。

---

## 步骤 2 · 关闭破坏性优化

Dashboard → `toirepo.com` → Speed → Optimization

- **Rocket Loader**：**Off**
  - 它重写页面脚本为 async loading。Next.js hydration 脚本被它改写后
    经常拿到过期的 React bundle 引用 → 水合失败 → 白屏或 hydration
    mismatch warning
- **Auto Minify → JavaScript**：**Off**（Next.js 自带 SWC minify）
- **Auto Minify → CSS**：**Off**（同上，Tailwind 生成的 CSS 已经 minified）
- **Auto Minify → HTML**：**Off**（Next.js App Router 的 RSC streaming
  对 HTML 结构敏感，CF 的 HTML minify 可能吃掉 `<template>` 边界）
- **Brotli**：**On**（CF 免费 brotli，Vercel 已 gzip；叠加不冲突）

Dashboard → Caching → Configuration

- **Caching Level**：**Standard**（默认，按 query string 分 key）
- **Browser Cache TTL**：**Respect Existing Headers**（让 Vercel 控）
- ⚠ 不要用 "Aggressive" — 会把 user 专属内容也缓存

Dashboard → Caching → Cache Rules（免费 3 条规则）

**规则 1 · 不缓存 tRPC 动态 API**

- If: `URI Path starts with /api/trpc/` OR `URI Path starts with /api/auth/`
- Then: Cache eligibility = **Bypass cache**

**规则 2 · 不缓存 HTML**（Next.js App Router streams，CF 不应预缓存）

- If: `URI Path matches \.(?!css|js|png|jpg|jpeg|svg|webp|ico|woff2?|pmtiles|webmanifest)`
- Then: Cache eligibility = **Bypass cache**

**规则 3 · 激进缓存静态资产**

- If: `URI Path starts with /_next/static/` OR `URI Path starts with /icons/`
- Then:
  - Cache eligibility = **Eligible for cache**
  - Edge TTL = 1 year
  - Browser TTL = 1 year

---

## 步骤 3 · 翻橙云

Dashboard → DNS → Records

- 把 `A @` 的 Proxy status **从 DNS Only 改为 Proxied**（橙云图标）
- `AAAA @`、`CNAME www` 同样改成 Proxied
- 保存立即生效（全球 DNS 传播 ~几分钟）

---

## 步骤 4 · 切换后验证

10 分钟后跑：

```bash
# 1. Cloudflare 在前面
curl -sI https://toirepo.com | grep -iE 'server|cf-ray'
# 预期: server: cloudflare + cf-ray 标记存在

# 2. Healthcheck 仍全绿
PROD_URL='https://toirepo.com' pnpm prod:healthcheck

# 3. Vercel deployment 仍能被 hit（通过 CF）
curl -sI https://toirepo.com/api/trpc/toilet.list?batch=1 | head
# 预期: 200 + JSON，cf-cache-status: BYPASS（步骤 2 规则 1 生效）

# 4. 静态资产被 CF 缓存
curl -sI https://toirepo.com/icons/icon-512.png | grep -iE 'cf-cache-status|cache-control'
# 预期 2nd request: cf-cache-status: HIT
```

## 步骤 5 · 回滚（紧急情况）

如发现页面空白 / 500 / 水合失败：

1. DNS → 把 `A @` 和 `AAAA @` 的 Proxy 切回 **DNS Only**（灰云）
2. 等 30 秒 DNS 传播
3. `curl -sI https://toirepo.com | grep server` 看到 `Vercel`
4. 用户立即恢复（除了 CF DNS 缓存的那几十秒）

橙云设置不会丢——重新开 Proxy 就恢复，调 CF 规则没有破坏性。

---

## 常见陷阱

- **"ERR_TOO_MANY_REDIRECTS"**：SSL mode 选了 Flexible。改 Full
  (Strict)。
- **页面闪白 / React hydration error "Hydration failed because the
  initial UI does not match..."**：Rocket Loader 没关。
- **登录后看到别人的页面**：缓存把 Cookie 维度漏了。Cache Rules 规则
  1 必须 Bypass `/api/auth/`。
- **R2 的 pmtiles 从 CF 拉不到（CORS 报错）**：R2 bucket CORS
  AllowedOrigins 需要加 `https://toirepo.com`（已加）+ `*.toirepo.com`
  （CF 可能换 origin header，保守起见加进去）。

---

## 本文档状态

- **M10 P2 (2026-04-22)**：本文档创建。橙云切换**未执行**。
- **切换时机**：MVP 上线后有真实流量观测后，Ming 决定。可能 M10 P3
  或 M12 之前的产品 polish 阶段。
- **如果用户量 < 1000 DAU**：灰云已经足够，不需要橙云的 DDoS 防护 +
  edge cache 收益。
