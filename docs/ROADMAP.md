# toirepo · 剩余里程碑路线图

记录每个里程碑开工前需要 Ming 准备的外部资源、决策点，以及推荐执行顺序。
这是"不看代码也能决定下一步"的 index。

---

## 当前状态（M11 完成后 · 2026-04-20）

**7 / 11 里程碑完成（64%）。~120 commits 累计。**

- ✅ M1-M6 + M11：基础设施 + UGC + 审核 + 真实数据
- ⏳ M7 / M8 / M9 / M10：社交层 / 翻译 / PWA / 部署

**产品已达 alpha 可用状态**：localhost 上可作真实 app 使用，手机扫局域网 IP
即可访问。DB 含 10,129 条厕所（10,106 OSM + 23 用户/seed），覆盖东京 23 区
全域。

---

## 剩余里程碑推荐顺序（M11 完成后重排）

1. **M9 SEO + PWA** — 让 app 能装到手机上，Ming 自己能真用。
2. **M7 评论/确认/申诉** — 社交层；有真实用户后才有评论对象。
3. **M8 DeepL 翻译** — 补齐 zh-CN 名称覆盖（现在多数是 fallback "公共厕所"）。
4. **M10 Vercel 部署** — 对外上线。

**重排理由**：之前排"先 M7"假设是"让 toirepo 有社交互动"；但 M11 完成后产品
已经可用，Ming 自己的日常使用才是最大即时价值点。M9 PWA 能把 app 装到手机
上作日常通勤工具；M7 社交层在有真实用户之后做意义更大；M8 翻译可以在 M9
/ M7 任何一个期间 Ming 并行申请 key 不阻塞。

M9 和 M7 都无外部依赖，可立即开工。M8 需 DeepL key、M10 需一堆外部账号，
见各自章节。

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

## M11 · OSM 导入 — ✅ 完成（2026-04-20）

**实际产出**：

- 10,106 条东京 23 区真实 OSM 数据导入 DB（KONBINI 6,201 / PUBLIC 3,607 /
  MALL 302）
- Overpass 查询 8.6s + 批量 upsert 4.2s，总耗时 < 13 秒
- 0 冲突：10m 内无既有 user/seed 数据，完美分流
- 多语言覆盖：ja 99.7% / en 93.8% / zh-CN 33.5%（后者靠 PUBLIC fallback 放大）
- `toilet.list` 默认 limit 200 → 2000 以承载新规模，ceiling 5000

**Ming 当时的决策**：全量导入 / 容忍 bbox 边缘飘出 23 区 / PUBLIC 无名走
"公衆トイレ" 3-locale fallback / 10m 冲突时保留现有 user/seed。

**实现文件**：`src/server/osm/{client,mapping,queries}.ts`、
`scripts/osm-import-dryrun.ts`、`scripts/osm-import.ts`、
`src/server/api/routers/toilet/schemas.ts`（limit 提升）、
`src/components/map/MapCanvas.tsx`（客户端拉 2000）。

**debt 落 KNOWN_ISSUES M11**：全东京 20% 覆盖率 / 无 photos / zh-CN fallback /
绕过 AI 审核 / seed 脚本纪律 / Overpass headers。

**未来增量同步**（V1.0+）：
- 切 Overpass Diff / Planet-Diff API 做增量更新
- 加 admin "re-import osm" 按钮或 cron
- 抽样 AI spot-check（每周 100 条 × $0.003 = $0.30）

---

## 外部资源准备清单（给 Ming 的"今晚可以做"列表）

不阻塞 M9，但尽早做可以缩短后续时间：

- [ ] App icon 1024×1024 PNG（M9）— 看设计能力
- [ ] DeepL API key（M8）— 10 min 注册
- [ ] Vercel 账号 + 登录（M10）— 5 min
- [ ] Supabase 账号（M10）— 5 min
- [ ] 域名注册 `toirepo.app`（M10）— 30 min
- [ ] Sentry 账号（M10，可选）— 5 min
- [ ] PostHog 账号（M10，可选）— 5 min

---

## 文档参考

- `docs/PROJECT_SPEC.md` — 原始规格 + v1.1 变更说明
- `docs/TASK_BREAKDOWN.md` — M1-M11 原始任务拆解
- `docs/KNOWN_ISSUES.md` — 按里程碑累计技术债
- `docs/COLORS.md` — SPEC §4.2 配色落地
- `docs/MAP_DATA.md` — pmtiles 流程 / R2 bucket 组织
