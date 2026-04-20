# 已知限制 · 按里程碑累计

每条目记录"不紧急但要记着"的技术债 / 浏览器限制 / 临时绕过。修复或确认无关时
划掉条目并保留删除注记，方便回溯演化。

---

## M7 P1 追踪 (2026-04-21)

### Prisma 7 drift 第三次触发（已手动修）

**症状**：`prisma migrate diff` 再次在 M7 P1 migration SQL 顶部生成
`DROP INDEX "toilet_location_idx"` + `ALTER TABLE "Toilet" ALTER COLUMN
"location" DROP NOT NULL`。
**根因**：已记录的 M2 + M6 P2 条目；Prisma 7 对 `Unsupported(geography)?`
column 的每次 diff 都会重新想拉平 NOT NULL。
**修复**：migration.sql 顶部加了注释 + 手动剥掉那两行 + 用 `migrate
resolve --applied` 标记已应用（避免 `migrate dev` 想重置 10k+ Toilet 数据）。
DB 侧通过 `SELECT is_nullable` + `SELECT indexname` 验证 spatial index
+ NOT NULL 完好。

### Admin 通知管道未落地（P1 刻意）

**症状**：`appeal.create` 只 `console.log` 新申诉；没有 email /
webhook / 实时推送给 admin。
**计划**：M7 P3 admin UI 会加一个 `listPending` 列表页，当 admin 主动
刷新时看到新申诉。真实 push 通道（Resend 邮件 or 前端 WebSocket）放
到 M10 部署后或 P4。

### Review photo 没有 thumbnail pipeline

**背景**：Review.photoKeys 是 R2 原图 keys 数组，不走 M5 P2 的 photo
upload pipeline（那个流程自动生成 thumbnail + 写 `Photo` 表）。
**影响**：评论照片加载时走原图，加载慢。UI 可在客户端渲染时调
`photo.getViewUrls` 拿 presigned GET，然后浏览器加载原图。
**未来**：P2 UI 写到评论组件时，决定是否给评论照片也生成 thumbnail —
要么复用 M5 的 photo.createUploadUrl 走 Photo 表（但 Review.photoKeys
改成 Photo[] 关联），要么客户端走简化 resize。

### Trust L3 `autoTrustChecked` bool 目前只写不读

**背景**：User.autoTrustChecked 字段加上了（防重入 guard 预留），
`admin.review` 在 counter 增加时把它置 false。但 `recalculateTrustLevel`
不读它 —— 每次调用都重算。
**影响**：性能无差别（都要 findUnique 读 user 一次）。字段存在但空转。
**未来**：若 trust 计算扩展为异步 batch job（例如 daily cron 扫
`autoTrustChecked=false` 的用户），这个 bool 才真正发挥作用。当前留着
因 schema migration 已应用，拔掉成本 > 留着成本。

### `review:submit` / `confirmation:submit` / `dispute:submit` rate-limit
keys 被重命名

**背景**：M2 T2.4 预设的 key 名 `review:submit` / `confirmation:submit`
在 M7 P1 改为 `review:create` / `confirmation:toggle`；`dispute:submit`
留着给未来 OwnerDispute 用。窗口参数按 Ming 决策调整。
**影响**：旧名称在代码里无调用，Redis 也没有 orphan counter —— rename
是干净的零停机操作。
**记录原因**：防止未来 grep 代码找不到旧名疑惑；老 SPEC §6.3 的 key
命名以当前 `limits.ts` 文件为准。

---

## M9 P1 (2026-04-20)

### Service Worker 在 HTTP 局域网 IP 上不注册

**症状**：iPhone Safari 通过 `http://192.168.x.x:3000` 访问，SW 不会被
注册（`navigator.serviceWorker.register` 在非安全上下文静默失败）。
**影响**：装机 + standalone 显示不受影响（manifest 足够触发 "Add to Home
Screen"），但离线能力 + tile / tRPC 缓存要等 HTTPS。
**修复时机**：M10 Vercel 部署后自动生效。
**绕过**：无需；`ServiceWorkerRegistrar.tsx` 的 catch 块静默吞异常，不影响
其他功能。

### iOS 不支持 maskable icon

**症状**：iPhone 主屏幕 icon 来自 `apple-touch-icon.png` (180×180, flattened
#2C6B8F bg)，忽略 manifest 里的 maskable 项。
**影响**：iOS 视觉圆角由 iOS 自行裁剪，而不是设计师预设的 mask shape。
**缓解**：`gen-icons.ts` 生成 apple-touch-icon 时已用 `sharp.flatten({ background:
'#2C6B8F' })` 扁平化掉透明通道，避免 iOS 圆角裁出一圈深色边。

### Manifest / icon 更新后 iOS 已装 PWA 不自动刷

**症状**：换 `public/icons/toirepo-icon-source.svg` + 重跑 `pnpm gen:icons`
+ redeploy，已装 iPhone 主屏 app 仍显示旧图标。
**影响**：纯开发体验问题；用户角度感知不到。
**修复**：装机流程文档（`docs/M9-pwa-install.md`）里写了删装重来的步骤。

### 手写 SW 而非 Serwist / next-pwa

**决策**：M9 P1 选手写 50 行 SW 而非 Serwist。
**理由**：Next 16 + Turbopack + Serwist 的组合在 2026-04 这个版本窗口的兼容
性未经充分验证；手写 SW 可审计、不新增 deps、不依赖 webpack-only 插件。
**未来**：M10 部署前若发现手写 SW precache manifest 需要自动生成（CSS / JS
bundle hash 变了 cache 就 miss），再切 Serwist。当前 precache 列表只
`/manifest.webmanifest`，runtime 缓存按 URL pattern 不需要 hash。

### PWA 图标源暂时是 SVG 程序画 (非设计稿)

**症状**：`public/icons/toirepo-icon-source.svg` 是按 Ming 描述（深青渐变 +
白 pin + 橙 T）程序画的简单版本，不是设计师稿。
**更新（2026-04-21）**：Ming 放入真设计稿 `public/icons/toirepo-icon-1024.png`
并重跑 `pnpm gen:icons`，7 张 PNG 已全部切换为设计版本。SVG 源保留作为
fallback，不再是视觉真相来源。

### LAN IP 漂移运维负担（2026-04-21 实机装机暴露）

**症状**：M9 P1 iPhone 装机时发现 Next 16 Turbopack dev 默认阻挡 LAN origin
访问 dev resource（HMR chunk / client bundle），页骨架加载但 client
component 不 hydrate。修复：`next.config.ts` 加 `allowedDevOrigins: ['<Mac
LAN IP>']`。
**漂移风险**：DHCP 分配的 Mac LAN IP 在路由器重启 / 换 Wi-Fi 后可能变，
每次变化需手动改 `next.config.ts` + 重启 dev server。
**缓解**：`docs/LAN_ACCESS.md` 集中记录了 2 步维护流程（next.config + R2 CORS
同步）。
**彻底消除时机**：M10 部署后统一走 `https://toirepo.app`，`allowedDevOrigins`
可以整行删除（prod 构建忽略这个字段）。

### R2 CORS 不支持 IP 段通配符（2026-04-21 实机装机暴露）

**症状**：LAN IP 访问地图，basemap 渲染失败，DevTools 报 `TypeError: Failed
to fetch` 拉 pmtiles。R2 bucket CORS 白名单只含 `http://localhost:3000`，
新 LAN origin 触发 CORS 预检 403。
**修复**：Cloudflare Dashboard → R2 bucket (`toirepo-tiles` 和
`toirepo-photos` 都要) → Settings → CORS Policy 的 `AllowedOrigins` 精确
加 `http://192.168.x.x:3000`。
**不能通配**：R2 CORS 规范上不支持 `192.168.*` 或 `*.local` 等 wildcard；
每个新 IP 都要手动加一条。
**彻底消除时机**：M10 上线后把 AllowedOrigins 缩到 `["https://toirepo.app"]`
单条，本条自动失效。具体迁移步骤见 `docs/LAN_ACCESS.md` §6。

### iPhone PWA 已装后 manifest / icon 不热更新（交叉引用）

之前记录在本章节"Manifest / icon 更新后 iOS 已装 PWA 不自动刷"条目；
`docs/LAN_ACCESS.md` §5 常见故障快查表也列了"图标显示为网页截图"的删装
重来流程。此处留交叉引用防止未来搜索时错过。
**换源路径**：把真实设计稿 PNG 放 `public/icons/toirepo-icon-1024.png`，跑
`pnpm gen:icons` → 所有尺寸重跑。脚本已预置 PNG > SVG 优先级。

---

## M11 (2026-04-20)

### `toilet.list` limit=2000 只覆盖全东京 ~20%

**背景**：DB 现有 10,128 APPROVED 厕所，MapCanvas 默认拉 limit=2000。
**影响**：东京中心区域（千代田 / 中央 / 港 / 新宿 / 涩谷）在 zoom 14 基本
密到看不出缺口；但边郊区（练马 / 足立 / 葛饰 / 江戸川）用户可能遇到"这
个 konbini 应该在图上但没显示"的情况。
**升级方案**：切 bbox 动态查询 —— `toilet.list` 已支持 `bbox` 参数（T4.3
就留了），改 MapCanvas 在 map.on('moveend') 时 refetch with current bounds。
**不阻塞 MVP**：Ming 通勤动线全在中心区域；真实部署（M10）用户多起来
时再升级。

### OSM 数据无 photos — 详情页 PhotoGallery 永远空

**背景**：用户提交的 Toilet 有 Photo relation，OSM 导入的 10,106 条 0 photos。
**当前行为**：详情页 PhotoGallery 条件渲染（`toilet.photos.length > 0` 才渲染），
OSM 厕所页面的"照片"一节整个缺席。
**影响**：纯功能上正确；体验上对纯 OSM 厕所稍单薄。
**未来功能**：M7 / post-M7 可以加"为 OSM 厕所补充照片"—— 登录用户进详情
页点"添加照片"走一个简化的 photo-only submission 流。不开 new M.

### OSM 数据 zh-CN 覆盖率被 fallback 放大

**背景**：dry-run 报告 zh-CN 覆盖 33.5%，实际多数来自 PUBLIC 无名 fallback
"公共厕所"（~3,607 条 PUBLIC 中很多都走这个 fallback），真正来自 OSM
`name:zh` tag 的 zh-CN 名称占比低。
**影响**：中文用户看到大量重复"公共厕所"+ 原文便利店名（"ローソン" /
"セブン-イレブン"）混排。信息够用但视觉单调。
**M8 修复路径**：DeepL ja→zh-CN 机翻能把 ~99.7% 的 ja 名称全量转成 zh-CN。
估算 10k × 平均 15 字 = 150k 字符一次性费用，Free tier 完全吞得下。

### OSM 批量导入绕过 AI 审核 pipeline

**背景**：`scripts/osm-import.ts` 直接 `db.toilet.upsert` 写 status=APPROVED +
source=OSM_IMPORT，不走 submission.create，不触发 moderateToilet。
**假设**：OSM 作为开放协作社区，贡献者已经做过隐式审核，污染率极低。
**风险**：OSM 用户恶意注入（例如把私人宅邸标成"公共厕所"）→ toirepo 用户
被误导。
**缓解**：admin queue 可以手动把任何一条标 HIDDEN / REJECTED；osmId 字段
让我们可以精准定位具体条目。
**长期改进**：M11 可以留一个 batch 工具跑抽样 AI（例如每周从 10k 中随机
选 100 条跑 `moderateToilet`，发现 REJECTED 置信度 ≥0.85 的自动 HIDDEN）。
成本：100 call × $0.003 = $0.30/周。

### seed 脚本和 OSM 数据共存 — 靠纪律不跑 seed

**背景**：`pnpm seed` 每次创建/更新 20 条 mock toilets（slug="1", "tokyo-station-..."）。
osmId 是 NULL，和 OSM 数据的 osmId @unique 索引不冲突。
**风险**：如果操作失误再跑一次 seed，mock 厕所会 upsert 回到 DB（slug 匹配），
出现在地图和队列里。不会破坏数据但是制造噪音。
**缓解**：ROADMAP.md 注明"M11 完成后不要再跑 seed"；M10 部署前把 seed 移到
`tests/fixtures/` 或加 `--force` flag 门禁。
**MVP 阶段**：靠纪律。

### Overpass API User-Agent / Accept 头必需

**症状**：`fetch(OVERPASS_ENDPOINT, { ... })` with Node 默认 headers → 406 Not
Acceptable。
**修复**：osm/client.ts 加 `User-Agent: toirepo-osm-import/...` + `Accept:
application/json`。已落地。
**未来注意**：Overpass free tier 约 25 queries/day。M11 开发迭代时贴边过。
M10 生产环境应该缓存导入结果（R2 或 DB 快照），不在每次部署时调 Overpass。
**长期**：M11 扩展"增量同步"时考虑调 Overpass Slim / Planet-Diff，而非每次
重抓全量 bbox。

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
