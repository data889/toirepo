# toirepo · 剩余里程碑路线图

记录 M7 → M11 每个里程碑开工前需要 Ming 准备的外部资源、决策点，以及推荐执行顺序。
这是"不看代码也能决定下一步"的 index。

状态截至 M6 完成（2026-04-20，origin/main HEAD = c93692b + 本文档 commit）。

---

## 当前进度

6 / 11 里程碑完成。~112 commits 累计（M1 14 + M2 31 + M3 28 + M4 6 + M5 16 + M6 17）。

剩余：M7 社交层 · M8 DeepL 翻译 · M9 SEO + PWA · M10 Vercel 部署 · M11 OSM 导入。

---

## 推荐执行顺序

M6 完成后建议顺序（排序依据：依赖关系 + 外部准备可并行）：

1. **M7 评论/确认/申诉** — 无外部准备，紧承 M6 审核体系
2. **M11 OSM 导入** — 无外部准备，让产品第一次有真数据
3. **M8 DeepL 翻译** — 需 Ming 先申请 API key，可在 M7/M11 期间并行申请
4. **M9 SEO + PWA** — 无外部准备，但建议 M11 有真数据后再做（sitemap 才有内容）
5. **M10 Vercel 部署** — 最后做，需域名 + Supabase + 所有 env vars 迁移

M7 和 M11 都可以立即开工；M8/M9 选一个做也行，但 M9 依赖 M11 数据量大起来。

---

## M7 · 评论 / 确认 / 申诉

Schema：`Review` / `Confirmation` / `OwnerDispute` 三 model 都已在 T2.1 建表。M7 只做业务逻辑 + UI。

**外部依赖**：无。

**Ming 需决策**：

- **申诉流程入口**：被 REJECTED 的用户能否在 `/me/submissions` 点"申诉"？申诉走 `OwnerDispute` 表还是独立的 `SubmissionAppeal`？
  推荐：复用 `OwnerDispute`（schema 已有 `DisputeStatus.NEEDS_INFO` 枚举），申诉进 admin queue 的 "disputes" tab。
- **评论 rate limit**：T2.4 `comment:post` 已有 rate key；直接用还是要调 window。
  推荐：直接用。
- **Review cleanliness 分值**：目前 schema 是 `Int`（0-5？1-5？0-10？）。
  推荐：1-5（5 星系统），0 表示未评分。
- **Review 是否走 AI 预审**：M6 建的 moderation 只对 Toilet，不覆盖 Review。Review 的文字评论是否也要 AI 过滤仇恨言论 / 垃圾？
  推荐：MVP 先不加，admin 发现后手动删；M7 留 `Review.status` 字段为 PENDING 允许未来接入。

**估计 commits**：~15–20（3 model × create/list + UI 3 组件 + 申诉流 + admin queue 扩展到 disputes）。

---

## M8 · DeepL 翻译

**外部依赖**：

- **DeepL API key** — 去 https://www.deepl.com/pro-api 申请 Free tier（50 万 chars / 月，对 MVP 阶段绰绰有余）。
  注册后把 key 放 `.env.local`：`DEEPL_API_KEY="..."` （`.env.local.example` 已有占位，Ming 之前已注释掉的那行）。

**Ming 需决策**：

- **翻译触发时机**：
  - A) admin `review.APPROVE` 时同步翻译（响应 +1-2s）
  - B) admin approve 后异步 queue（Vercel cron / serverless trigger）
  - C) cron daily batch
  推荐：A（和 AI 审核路径风格一致，简单）
- **翻译范围**：仅用户提交的 name / address / accessNote，还是也翻译 Review 评论？
  推荐：先翻 Toilet 三字段；Review 评论 MVP 不翻。
- **Seed 数据回填**：现有 20 条 seed 的三语是否重新用 DeepL 跑？
  推荐：不跑（seed 是 pre-translated fixture，DeepL 可能改得更差）。
- **Machine-translated 标记**：`submission/index.ts` 当前提交时 address 机翻，schema 是否加 `Toilet.translatedAt` / 字段级 `__mt: true` 标记？
  推荐：name/address 的 Json value 用 `{ "zh-CN": "...", "__mt": { "ja": true, "en": true } }` 结构，UI 小字标注"机翻"。

**估计 commits**：~8-10（DeepL client + translation service + pipeline 集成 + UI 机翻标记 + i18n）。

---

## M9 · SEO + PWA

**外部依赖**：无 API key 需求。

**Ming 需提供**：

- **App icon**：1024×1024 PNG（transparent BG 或白底都行）。用于 `public/icons/icon-1024.png`，再 fallback 出 192/512 等 PWA 标准尺寸。
  如果 Ming 没有设计师，可用 M3 的 4 个厕所图标之一放大 + "toirepo" 字样合成。
- **Favicon**：可复用 app icon 16×16 / 32×32。

**Ming 需决策**：

- **OG image 策略**：
  - A) 静态图片 `public/og.png`（品牌图）
  - B) 每个厕所详情页 `@vercel/og` dynamic generate（照片 + 名称 + 地址）
  推荐：A for MVP，B 推到 post-launch。
- **sitemap 频率**：`next-sitemap` 每次 build 生成一次 or runtime 生成？
  推荐：runtime 生成 via `app/sitemap.ts`，包含所有 APPROVED 厕所详情 URL。
- **PWA 离线策略**：serwist 缓存什么？地图 tiles pmtiles？
  推荐：MVP 只缓存 HTML/CSS/JS shell + 最近访问的详情页，tiles 因 pmtiles 是 HTTP range-request 本身就对离线不友好。

**估计 commits**：~6-8（sitemap + robots.txt + PWA manifest + serwist + OG image + metadata）。

---

## M10 · Vercel 部署

**外部依赖**：

- **Vercel 账号**（github 登录免费）
- **Supabase 账号**（github 登录免费 tier；提供生产 Postgres + PostGIS 扩展）
- **Domain**：`toirepo.app` 需注册 + DNS 指向 Vercel
  推荐 registrar：Cloudflare（便宜 + DNS 集成）或 Porkbun
- **Sentry 账号**（可选，但 `.env.local` 已有 `SENTRY_DSN` 占位）
- **PostHog 账号**（可选，`.env.local` 已有 `NEXT_PUBLIC_POSTHOG_KEY` 占位）

**Ming 需决策**：

- **Vercel plan**：Hobby free tier 够吗？
  诊断：Hobby 100GB bandwidth / 10s function timeout。Haiku 4.5 审核 2-3s 在 10s 内安全。图片上传 R2 bypass Vercel 不占 bandwidth。**Hobby 足够 MVP。**
- **Supabase plan**：Free tier 500MB Postgres 够吗？
  诊断：500MB 存 5-10 万条厕所 + 评论 + 日志。**Free tier 够 MVP 前 6 个月。**
- **生产环境 seed 策略**：
  - A) 跑一次 seed 放 20 条 mock 数据（便于上线即有内容）
  - B) 空库上线，第一批真实用户提交 + admin approve
  - C) 等 M11 OSM 导入一起上
  推荐：C（跳过 seed，M10 + M11 绑定发布）
- **域名是 toirepo.app 还是其他**？
  如果不同，需要更新 `AUTH_URL` 和 OAuth callback URL（Google Cloud Console）。
- **R2 生产 bucket 是否新建**？
  推荐：新建 `toirepo-prod-photos` 和 `toirepo-prod-tiles`，避免和本地开发共用。需要重传 pmtiles 到新 bucket。

**env vars 迁移清单**（从本地 `.env.local` → Vercel project settings）：
```
DATABASE_URL (Supabase 提供)
DIRECT_URL (Supabase direct connection, for migrations)
AUTH_SECRET (重新生成更安全)
AUTH_GOOGLE_ID / AUTH_GOOGLE_SECRET (同本地, 但需加生产 callback URL)
AUTH_URL (生产 URL, e.g. https://toirepo.app)
R2_ACCOUNT_ID / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY (生产可用同 account 不同 token)
R2_BUCKET_NAME / R2_PHOTOS_BUCKET_NAME (生产 bucket 名)
R2_PUBLIC_URL / NEXT_PUBLIC_R2_PUBLIC_URL (生产 bucket 公网 URL)
UPSTASH_REDIS_REST_URL / _TOKEN (Upstash 生产 DB)
RESEND_API_KEY / EMAIL_FROM (生产域名邮箱)
ANTHROPIC_API_KEY (M6 加的, 同本地)
DEEPL_API_KEY (M8 加的, 同本地)
SENTRY_DSN (可选)
NEXT_PUBLIC_POSTHOG_KEY (可选)
```

**估计 commits**：~5-8（Vercel config + Supabase migration + prod bucket upload + env doc 更新）。

---

## M11 · OSM 导入

**外部依赖**：无 API key 需求（OpenStreetMap Overpass API 完全免费，只有 IP rate limit）。

**Ming 需决策**：

- **数据范围**：东京 23 区 or 整个东京都？
  推荐：23 区（bbox 与 M3 pmtiles 一致：`[138.9, 35.3, 140.2, 35.95]`）。
  Overpass query：`node["amenity"="toilets"](bbox);` 估算 3000-5000 条。
- **审核策略**：OSM 导入数据是否走 M6 AI 审核？
  - A) 全走 AI（Haiku 成本按 $0.003/call × 5000 = $15，可接受）
  - B) 直接 status=APPROVED 跳过 AI（OSM 数据已是社区审核过）
  - C) 抽样 AI，例如 10% 走 AI 做 spot-check，其余自动 APPROVED
  推荐：B（OSM 是更大社区的审核结果，toirepo 的 AI 只该管用户 submit 的）。
- **去重策略**：用户已提交的厕所和 OSM 如何冲突检查？
  schema `Toilet.osmId String? @unique` 已预留。
  - A) 同坐标 50m 内匹配即认为是同一个，OSM 数据不插入
  - B) 信任 OSM，重复的以 OSM 覆盖（风险：用户 accessNote 丢失）
  - C) 全部 OSM 都插入，让 admin 手动判重
  推荐：A（精确到 50m 防止重复 marker 挤在地图上）。
- **照片处理**：OSM 没有照片。用户如果看到 OSM 厕所想加照片？
  推荐：M11 阶段不处理；后续"补照片"功能单开一轮。
- **更新策略**：OSM 数据会更新，toirepo 如何同步？
  推荐：M11 只做一次性导入 + 手动触发。自动 cron 同步留给 V1.0。

**估计 commits**：~6-8（Overpass client + import script + 去重逻辑 + 运行 + seed 替换）。

---

## 外部资源准备清单（给 Ming 的"今天晚上可以做"列表）

不阻塞当前 M7，但是尽早做可以缩短后续时间：

- [ ] DeepL API key（M8）— 10 min 注册
- [ ] Vercel 账号 + 登录（M10）— 5 min
- [ ] Supabase 账号（M10）— 5 min
- [ ] 域名注册 `toirepo.app`（M10）— 30 min
- [ ] App icon 1024×1024 PNG（M9）— 看设计能力
- [ ] Sentry 账号（M10，可选）— 5 min
- [ ] PostHog 账号（M10，可选）— 5 min

---

## 文档参考

- `docs/PROJECT_SPEC.md` — 原始规格 + v1.1 变更说明
- `docs/TASK_BREAKDOWN.md` — M1-M11 原始任务拆解
- `docs/KNOWN_ISSUES.md` — 按里程碑累计技术债
- `docs/COLORS.md` — SPEC §4.2 配色落地
- `docs/MAP_DATA.md` — pmtiles 流程 / R2 bucket 组织
