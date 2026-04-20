# 已知限制 · 按里程碑累计

每条目记录"不紧急但要记着"的技术债 / 浏览器限制 / 临时绕过。修复或确认无关时
划掉条目并保留删除注记，方便回溯演化。

---

## M6 (2026-04-20)

### Prisma 7 migration drift 再次触发 (P2 · 已修)

**症状**：`add_toilet_moderation` migration 生成时误附加
`DROP INDEX toilet_location_idx` + `ALTER TABLE "Toilet" ALTER COLUMN
"location" DROP NOT NULL` 两行。运行时两者都已生效，spatial index 丢失
+ 约束放松。
**根因**：与 M2 已记录的条目同源 — Prisma schema 里 `location` 是
`Unsupported?`，但 DB 列是 NOT NULL + trigger；每次 `prisma migrate dev`
都想对齐这两行。
**修复**：手动恢复 DB（`ALTER ... SET NOT NULL` + `CREATE INDEX ... USING GIST`）
+ 从 migration 文件里剥掉那两行 + 加注释引用 KNOWN_ISSUES M2 + SPEC v1.1 §8。
**未来防御**：每次 `pnpm prisma migrate dev` 之后必须人工 review migration
SQL，发现这两行就删。长期方案：迁到 `prisma db push` 模式，或等 Prisma 7
正式 GA 看这行为是否修复。

### `toilet.list` staleTime 从 5min 缩到 30s (M6 admin fix)

**背景**：P3 admin approve 后主地图不刷新 → 把 staleTime 改 30s +
`refetchOnMount: 'always'`，并让 `admin.review.onSuccess` 调
`utils.toilet.list.invalidate()` 作为主刷新信号。
**权衡**：当前数据量（APPROVED 厕所 < 50）refetch 成本可忽略。未来 M11
导入 OSM 后数据规模 3000+，每 30s 刷一次整个 list 会变贵。
**未来评估点**：M11 数据导入后监控 `toilet.list` p95 响应 + 服务端 CPU；
如超预期可改回 `staleTime: 5min` + 只在 admin.review 路径靠 invalidate。

### `auth.signin` 与 `auth.signIn` 两个 key 并存

**背景**：T2.2 用 nested `auth.signin.*` 放登录页文案（title/subtitle/
google/emailLabel 等）。M6 加 header 按钮时用 `auth.signIn`（大写 I）。
**影响**：JSON key 大小写敏感，技术上不冲突，但视觉上易读错。
**未来修**：下一轮 i18n cleanup（可能 M8 引入 DeepL 时顺手）把 header
flat keys 挪到 `auth.header.*` 命名空间。

### 自建 `/auth/signin` 页面的 end-to-end 行为未完整回归

**背景**：T2.2 建了自建 signin page；M6 P3 给它加了 AppHeader。NextAuth
config 的 `pages.signIn` 指向该路径，所以登录流走我们这页。
**风险**：Resend magic-link 分支在 dev 环境 Ming 从未端到端测过（只测了
Google OAuth）。未来 M10 部署前需要用真实邮箱走一遍 magic-link 流程。

### admin queue 无 pagination / virtualization

**背景**：`admin.listQueue` 一次返回最多 100 条，每条附全部 photos，
client 批量调 `photo.getViewUrls` 拿 presigned URL。
**影响**：当前队列 <10 条无感。50+ 时 photos 签名批量会挤到 `getViewUrls`
的 20-key 硬上限。
**未来改进**：M10 部署前加 cursor-based pagination（基于 createdAt），
photos 签名按页签。不阻塞 MVP 上线。

### Haiku 4.5 response token 上限 512

**背景**：`moderateToilet` 里 `max_tokens: 512` 固定值。
**风险**：若 reasons 列表变长或 prompt 诱导 Haiku 写更详细 reason，
512 token 可能截断 JSON → parser 抛错 → `submission.create` 落到 PENDING
fallback（不自动 REJECT）。不会造成数据不一致，但会漏抓垃圾。
**未来监控**：观察 `ToiletModeration.rawText` 长度分布；如果接近 512 的
比例 > 5%，提到 1024。

### 测试数据手动 backfill 的 slug=1 没走完整 pipeline

**背景**：slug='1' 是 M5 时代提交，M6 P2 用 `pnpm test:moderation 1`
手动跑了 AI + SQL 更新 Toilet.status。
**影响**：该厕所 ToiletModeration 有 row，但 Toilet.publishedAt 等状态
字段未走 `admin.review` 路径。如果未来 admin 重新看这条并 approve，
publishedAt 会被设为当时时间（非原提交时间）— 可接受。
**不用修**：只是一条测试数据，产品上线前 seed 清空即可。

---

## M5 (2026-04-20)

### `NEEDS_REVISION` 状态未纳入 ToiletStatus enum (P3 决策)

**症状**：M5 Prompt 3 的 MySubmissionsList `STATUS_COLOR` 与 i18n status map
按 Prisma `ToiletStatus` 真实 enum 5 值（PENDING/APPROVED/REJECTED/HIDDEN/
ARCHIVED）实现，未含审核反馈→用户修改→重提交 状态机需要的 NEEDS_REVISION。
**根因**：`prisma/schema.prisma` 初版 enum 未设计 NEEDS_REVISION；CLAUDE.md
§4 红线禁止无 user confirmation 修 schema；Ming 决策 M6 审核流设计时再拍板。
**未来修**：M6 prompt 决定是否加 migration + 业务逻辑。如走这条路，
MySubmissionsList 的 STATUS_COLOR + 3 语 i18n `submissions.status` 都要补。
**影响**：M5 范围内无影响；用户当前只能看到 PENDING / APPROVED / REJECTED 三态。

### Zod refine 错误消息未 i18n (P3 跳过)

**症状**：`submission.create` 的 `LocalizedStringSchema.refine` message 是
英文 hardcode `'At least one locale must have a non-empty value'`。客户端
SubmitForm 的 catch 块把 TRPCError.message 直接显示成红 banner。
**绕过**：客户端 canSubmit 按钮级 disabled 基本拦住了无效提交；极端情况
（绕过客户端直接 POST）才暴露这条英文 message。
**未来修**：tRPC 客户端解析 `err.data?.zodError?.fieldErrors` 拿到
`code='custom'` + `path` + i18n key 重渲染。或 server 端把 refine message
写成 key（如 `'submit.error.name.allLocalesEmpty'`）让客户端 `t(key)`。
**影响**：正常路径不触发；仅恶意/异常 client 路径看到英文技术消息。

### Photo presigned URL cache 不跨 tab / 刷新持久化

**症状**：`useBatchPhotoUrls` 用 React Query `staleTime: 50min`，单 tab 内
1h presigned TTL 内只调一次 `photo.getViewUrls`。但切 tab / 刷新会重新请求。
**绕过**：无——按现在体量（每用户 MVP 阶段 <50 提交 × ≤4 photo）每次刷新
1 次 batch 调用成本可忽略。
**未来改进**：M9 PWA 阶段若加 IndexedDB serwist cache，可把 presigned URL
连同 `Expires` header 一起缓存。
**影响**：冷加载 `/me/submissions` 首次 GET 多约 200-400ms。

### Photo 上传中断遗留 R2 孤儿对象

**症状**：用户走到 PhotoStep 已上传 2 张 photo 的原图+缩略图（= 4 个 R2
object）再关 tab / 断网 / 不点提交按钮 → 那 4 个 R2 object 永不被任何
Toilet 引用，成为垃圾。
**根因**：`createUploadUrl` 即刻生成 object key + presigned PUT，client 直
接上传；`submission.create` 才把 key 写入 `Photo.url`。中间没有 claim 机制。
**绕过**：不做。MVP 阶段 R2 photos bucket 容忍少量垃圾。
**未来改进**：M6 审核队列设计时加一个 GC 任务：扫 R2 photos bucket 找
DB 没有对应 Photo.url 且 LastModified > 24h 的 object 批量 delete。

### Worktree 并行 dev server 端口漂移（开发体验）

**症状**：主仓 3000 + worktree 3001 并存时，worktree 的 MapCanvas 会偶尔
找不到 dev mapbox style——其实是浏览器 hit 了错端口 cache。
**绕过**：清浏览器 cache、确认 URL 带正确端口。关掉其中一个 dev 最干净。
**影响**：仅并行开发场景。单 dev 环境无此问题。

---

## M4 (2026-04-20)

### URL `?t=slug` 跳详情页时未清理 (T4.4 / T4.5)

**症状**：在 drawer 打开状态下点"查看详情"跳到 `/[locale]/t/[slug]`，
URL 上原有的 `?t=slug` 查询参数被保留（虽然到了详情页已无意义）。
**影响**：纯视觉小瑕疵；不影响功能或 SEO。
**绕过**：未做。
**未来修**：在 `ToiletDrawer` 的 "View details" `<Link>` 里 explicit 写
`?` 清空，或在 detail page route 里 useEffect 清理。M5+ 任意一轮顺手处理。

---

## M3 (2026-04-19 ~ 04-20)

### Geolocation 精度受限于 HTTP 协议 (T3.4)

**症状**：定位按钮响应 + 权限请求 + 授权流程都对，但解析出的位置远离 Ming
实际位置。
**根因**：浏览器在不安全 origin（HTTP）下故意降级 geolocation 精度，作为
GPS 数据敏感性的保护。
**绕过**：本地开发暂不修；M10 上 Vercel HTTPS 后再回归验证。
**影响**：仅本地开发体验；生产部署后自动消失。

### Tailwind 4 + Turbopack 下 `.absolute` 工具类被 cascade 压过 (T3.4)

**症状**：`<div className="absolute inset-0">` 在地图容器上不生效，
DevTools 显示 `position: absolute` 被 strikethrough。
**绕过**：地图容器三层（`<main>` / `<section>` / `<MapCanvas>`）都用
inline `style={{ position, top, left, ... }}` 取代 Tailwind 工具类。
**根因未排查**：可能是 `@theme` / `@layer utilities` 加载顺序问题。等
Next 16 / Tailwind 4 / Turbopack 版本更新后回归。
**影响**：仅这一处布局；其他 Tailwind 工具类（颜色、间距、字体、flex 子项）
全部正常工作。

### Icon 渲染分辨率多轮调试 (T3.5)

**最终方案**：SVG 128×128 栅格（viewBox 仍 32×32）+ `pixelRatio=4` +
layer `icon-size=1`。Retina DPR 2 下从 128px 源下采样到 64px 物理像素 = 锐利。
**坑**：icon-size × pixelRatio × DPR 的组合多种参数都能"凑出 32px 显示"，
但只有"源 > 目标"才不像素化。
**风险**：未来 MapLibre 版本若改 pixelRatio 处理逻辑或 DPR 计算，需重验。
**判定方式**：浏览器 DevTools 把图标元素截屏放大 4x 看锯齿。

---

## M2

### Husky pre-commit hook 不拦 typecheck (T2.5)

**症状**：lint-staged 只跑 `eslint --fix` + `prettier --write`，typecheck
失败仍能 commit。
**T2.5 实例**：commit `ba64f4c` 提交时 typecheck 已失败（AdapterUser 缺
`bannedAt`），但 husky 放行。次提交 `99c19fd` 才修。
**绕过**：开发者手动跑 `pnpm typecheck` 在 commit 前。
**未来改进**：考虑加 typecheck 到 lint-staged 链（成本：每次 commit 多
~10s）或 pre-push hook。

### Prisma 7 + Unsupported(geography) 不能从 client 写入 (T2.1)

**症状**：`db.toilet.create()` 拒绝构造 INSERT 当 model 含必填 Unsupported 字段。
**绕过**：`Toilet.location` 在 Prisma schema 标 optional（`Unsupported(...)?`），
DB 层仍 NOT NULL + trigger 填充。
**详情**：详见 PROJECT_SPEC v1.1 第 8 条。
**刻意 drift**：Prisma migrate diff 会反复想 DROP NOT NULL + DROP INDEX，
manually clear 那些 migration SQL。

### Prisma 7 + Next.js 16 + pnpm 模块解析 (T2.2)

**症状**：`@prisma/client-runtime-utils` 在 pnpm 严格链接模式下 Next.js
bundler 解析不到。
**绕过**：装为直接 dep + `next.config.ts` 加 `serverExternalPackages`。
**详情**：详见 PROJECT_SPEC v1.1 第 4 条。

---

## M1

无累计技术债（M1 全部干净）。
