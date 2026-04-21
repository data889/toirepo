# 已知限制 · 按里程碑累计

每条目记录"不紧急但要记着"的技术债 / 浏览器限制 / 临时绕过。修复或确认无关时
划掉条目并保留删除注记，方便回溯演化。

---

## M10 P2 polish carryover (2026-04-22)

三个 P2.1 遗留项升级为正式 debt，明确触发条件 + 取消时机，不再散在各章

### PENDING own-submission 橙色 overlay

**背景**：地图 marker 已按 ToiletStatus 分色（APPROVED / CLOSED /
NO_TOILET_HERE 三态），但用户自己提交且 `status=PENDING` 的厕所**不单独
标记**。产品目标是给自己 PENDING 的提交一个橙色 outline，提示"还在审
核中"。
**进度**：M10 P2 SessionProvider 已挂（client 组件能读 `session.user.id`），
缺的只是
1. `toilet.list` 扩展 bbox + include my PENDING（或独立 API
   `toilet.listMyPending`）
2. MapCanvas 新增独立 GeoJSON source + symbol layer（橙色 outline，不与
   APPROVED 聚簇）
3. `?submittedById=me` 或类似 client-side filter
**推迟理由**：不阻塞任何核心路径；用户可在 `/me?tab=submissions` 看状态。
**触发条件**：
- 用户反馈"提交后不知道在哪看"
- 或 M12 全球数据后 PENDING 数量显著上升
**工作量**：半天（1 commit）
**Vercel plugin 备注**：今晚 MapTiler env 写入 prod 过程中发现 Claude
Code Vercel plugin 拦截"preview 全分支"非交互写入——要求 explicit
git-branch。workaround 留本条作提醒：未来预览环境 env 差异需 Ming 手动
在 Vercel Dashboard 维护（或脚本里遍历分支列表）。

### ReviewForm 编辑 PENDING/REJECTED 完整路径

**背景**：`/me/reviews` 列表里编辑按钮目前跳回 toilet drawer，drawer 的
ReviewForm 只对 APPROVED review 预填字段（`review.listByToilet` 仅返
APPROVED）。用户的 PENDING / REJECTED review 在 drawer 重新写等于新建
（upsert 语义不丢数据，但用户看不到自己原来写的内容）。
**完整 UX 应有**：
1. `review.listMine` 已返回 body + rating + photoKeys — 直接预填足够
2. `/me/reviews` 编辑按钮改为本地 Dialog，绕过 drawer
3. 保留 drawer 入口（APPROVED 下的 "编辑我的评论"）
**推迟理由**：用户量少时痛感低；P2.3 写 /me 时刻意简化避免 scope
蠕变。
**触发条件**：admin 拒绝率 > 15% 或 /me/reviews 的跳转率 > 删除率（说明
用户想改不想删）
**工作量**：半天（1 commit，纯 UI）

### admin review reject note 持久化

**背景**：`admin.resolveReview` mutation 接 `note?: string` 输入，server
端**丢弃不存**（Review 表无 rejectionNote 列）。当前只靠 Haiku 的
`aiReasons` 给拒绝解释；admin 手写 note 体验为零。
**完整 UX 应有**：
1. Prisma Review 加 `rejectionNote String? @db.Text`
2. Migration 手写 SQL `ALTER TABLE "Review" ADD COLUMN "rejectionNote"
   TEXT;` + `prisma migrate resolve --applied` + `prisma generate`
3. `admin.resolveReview` 写 `{ rejectionNote: input.note ?? null }`
4. `MyReviewsList` REJECTED 行展示 `adminRejectionNote`（优先于
   `aiReasons`）
**Ming 已批准走 Prisma 7 drift 规避路径** — 是 M10 P2 polish 的**最后一
commit**，放在 OG / JSON-LD / Cloudflare runbook 之后，便于回滚。
**工作量**：1 commit（migration + router + UI + docs）

---

## M10 P2 追踪 (2026-04-22)

### GeolocateControl 无方向跟随箭头

**背景**：Ming 要求 `showUserHeading: true` 让定位点跟随手机朝向旋转为箭头。
maplibre-gl 5.x 的 `GeolocateControlOptions` 没有此选项——`showUserHeading`
是 Mapbox GL 独占的功能，MapLibre 未移植。当前实装仅启用 `trackUserLocation:
true`（跟随用户移动重新 center）+ 纯圆点标记。
**影响**：iPhone 用户看不到朝向箭头，但位置跟随 + 走动时地图 re-center 正常。
**未来路径**（M12 polish 或等上游）：
1. 自建 GeolocateControl 子类 + 监听 `DeviceOrientationEvent`，用 rotate CSS transform 转圆点为箭头。iOS 要 `DeviceMotionEvent.requestPermission()` 用户手势才能拿到陀螺仪权限
2. 或等 maplibre-gl 上游加 `showUserHeading`（有 open feature request）

### R2 `tokyo.pmtiles` 残留 object

**背景**：M10 P2 把 basemap 切到 Protomaps 公网后，R2 `toirepo-tiles` bucket
里的 `tokyo.pmtiles` (237MB) 不再有消费者。
**影响**：零成本（R2 存储费可忽略）。但 bucket 有 dead data 不整洁。
**清理时机**：M12 之前评估。如果 M12 决定切回自托管 Planetiler，这个文件用作
回退起点；如果 M12 继续用 Protomaps，清理即可。

### ~~Protomaps 公网 sample dataset 依赖~~ → 已回退到 R2 自托管 (2026-04-21)

**原计划**：basemap source 指向 `https://r2-public.protomaps.com/protomaps-sample-datasets/protomaps-basemap-opensource-20240814.pmtiles`。
**实际结果**：Ming 第一次 prod 验证时该 URL 返回 **HTTP 404**。同日复查 `https://build.protomaps.com/20240801.pmtiles` 等所有备用 URL 同样 404 — Protomaps 会 rotate sample snapshots off their CDN 不发公告。
**决策**：回退到 R2 自托管 `tokyo.pmtiles`（commit `b717ab1`）。MAX_BOUNDS 也恢复到 Kanto bbox，防止 zoom out 出现空白画布。覆盖重回东京 only。
**M12 决策矩阵**（全球覆盖的 3 条路）：

| 路径 | 工作量 | 运维成本 | 风险 |
|---|---|---|---|
| 自建 Planetiler + R2（全球子集，几百 MB-几 GB） | 1-2 天流水线 + 每季度 regen | R2 存储 / 流量（开始免费） | 初次 Planetiler 调优 |
| Protomaps 付费 `api.protomaps.com/tiles` | 半天接 key + 改 source 协议（MVT tile 非 pmtiles） | $500/月起 | 厂商锁定 |
| 第三方公网 pmtiles（社区 host） | 几小时切 URL | 零 | 同样 rotate 风险，未来又挂 |

**推荐**：M12 走"自建 Planetiler + R2"路径。docs/MAP_DATA.md 下半段保留了完整 Planetiler 流水线文档。

### Toilet 数据仍仅东京 (M12 对应)

**背景**：底图已全球化但 `toilet.list` 返回全量东京 10,106 条。用户 zoom out
到全球时看到空白地图 + 东京仍有密集 marker。
**UX 影响**：非东京访客第一次打开会困惑（"这是东京地图？"）。
**计划**：M12 milestone 处理（docs/ROADMAP.md "M12 · 全球 toilet 数据" 占位已登记）。
**MVP 态度**：接受。M10 上线时用首页引导文案说明"从东京起步，其他城市陆续
覆盖"。

---

## M7 P2.1 追踪 (2026-04-21)

### PENDING own-submission overlay 推迟到 M10 polish

**背景**：地图 marker 目前按 ToiletStatus 显示 APPROVED / CLOSED /
NO_TOILET_HERE 三态视觉。对于 `status=PENDING` 的自己提交，产品上希望给
marker 叠一个橙色小圆圈提示"你提交的还在审核"。P2.1 未实现。
**原因**：要加这个需要 (a) MapCanvas 挂上 SessionProvider 或者从 server
传入 userId prop，(b) 客户端 session query + GeoJSON 源按 submittedById
分组过滤，(c) 新 symbol layer + 独立图标资产。工程量超 P2.1 范围。
**推迟到 M10 polish 的原因**：M10 部署前本来就要做 UI polish 轮，session
client 基建和 marker overlay 一起做更经济。
**触发条件**：M10 前置、或用户反馈明确需求、或自己账户提交量累积后痛感强。
**影响**：已提交者暂时看不到自己 PENDING 的厕所（只能走 /me/submissions
页面看到），非阻塞。

### ReviewItem / ReviewList / ConfirmationCounter 无 RTL 测试

**背景**：P2.1 的 RTL 测试只覆盖 4 个纯展示组件：StarRating /
ToiletStatusBadge / TrustBadge / RatingSummary。剩下 3 个组件未加测试。
**原因**：这 3 个组件直接依赖 tRPC client（`api.review.listByToilet` /
`api.confirmation.countByToilet`）或 useBatchPhotoUrls hook，RTL mock 基建
成本（msw handler + QueryClient wrapper + tRPC provider 封装）超 P2.1 时间
预算。
**延后计划**：P2.2 写表单交互时一次性铺设 msw + QueryClient 测试工具
（反正评论提交 / Confirmation toggle 表单也要 mock tRPC mutation），ReviewItem
/ ReviewList / ConfirmationCounter 测试顺带写。
**触发补齐**：线上发现组件渲染 regression（例如评论列表空态 / 加载态 /
错误态显示错误）；或 P2.2 开工即补。
**影响**：组件 UI 简单，手工目测覆盖；无测试不等于无行为保证。

### happy-dom 替代 jsdom 选型（决策记录）

**决策**：P2.1 引入 RTL 时 vitest env 选 happy-dom，不选 jsdom。
**理由**：happy-dom 启动 ~50ms vs jsdom ~200ms，88 个测试的 setup 成本
差 ~13s；本地 watch 模式体验差异明显。
**兼容性**：jest-dom matchers 通过 `@testing-library/jest-dom/vitest`
入口自动适配 happy-dom，P2.1 已验证 `toBeInTheDocument` 等 matcher 工作正常。
**风险**：happy-dom 对部分 CSS computed style / animation API / 特定
DOM 细节的覆盖度略低于 jsdom。未来若测试撞到这些边界，可选择：
(a) 单测试文件 override env 为 jsdom，或 (b) 整体切换。
**非技术债，是决策记录**：记在这里方便未来评估。

### photo.getViewUrls 改 publicProcedure

**背景**：P2.1 实机验收发现匿名访客点开 drawer 触发 10+ 条 UNAUTHORIZED
console error，根因是 `photo.getViewUrls` 原为 protectedProcedure。匿名
浏览本来就是 M7 P2.1 读路径的产品设计（"先看图判断信号"），登录门槛伤
UX。
**处理**：`photo.getViewUrls` 改为公开路径，新增 IP-based rate limit
`photo:view` 60/min/IP。
**防御面**：
- 60/min/IP 足够正常浏览（同时开多个 drawer），触顶是爬虫行为
- 1h presigned TTL 限制单 URL 价值
- R2 bucket 级 bandwidth 监控需 M10 部署时接入
**risk / 未来动作**：
- M10 部署后 1-2 周观察 R2 bandwidth 曲线，若异常（远超用户规模线性预期）
  排查爬虫
- 若爆爬虫，降级路径：(a) thumbnail 公开 + original session-gated，或
  (b) 加 per-IP daily cap 叠在 per-min 上
- `createUploadUrl` 保持 protectedProcedure，上传侧不受影响

### tRPC loggerLink 降级为按 code 分流

**背景**：原 loggerLink 把所有失败 query 送 console.error（包括 401 / 403
/ 404 / 400 这些业务正常的预期错误），dev console 被红色噪音淹没掩盖真
defect。P2.1 验收时从 photo.getViewUrls 问题顺手修掉。
**处理**：`src/lib/trpc/client.tsx` 自定义 logger：
- 成功 query：不打印（默认过于 noisy）
- 上行请求：`console.info`（浏览器默认隐藏）
- 下行失败且 code ∈ {UNAUTHORIZED / FORBIDDEN / NOT_FOUND / BAD_REQUEST /
  UNPROCESSABLE_CONTENT / TOO_MANY_REQUESTS}：`console.warn`
- 下行失败且 code 其他（INTERNAL_SERVER_ERROR / 网络错误 / UNKNOWN）：
  `console.error`
**生产环境不变**：`enabled: NODE_ENV === 'development'`，prod 构建整个
loggerLink 沉默。
**风险**：若未来新增 tRPC error code（比如 trpc v12 新枚举），默认走
`console.error` fallback 保守处理，需要时更新 `SOFT_TRPC_CODES` 集合。
**非决策债**：降噪有明确收益，无悬而未决项，记录以便追溯"为什么 dev
console 不全红"。

---

## M7 P1.5 追踪 (2026-04-21)

### AppealType enum swap 手工操作

**背景**：P1.5 把 `BAD_APPROVED_DATA` 重命名为 `REPORT_DATA_ERROR` 并加
了 4 个新值。PostgreSQL 不支持 DROP enum value，只能 CREATE 新 type →
column USING CASE 迁移 → DROP 旧 type → RENAME。migration.sql 顶部注释
记录了完整步骤。
**风险**：如果未来有人跑 `pnpm prisma migrate dev`，Prisma 会按新的
enum 重生 migration SQL，里面可能包含 `DROP TYPE "AppealType"` 直接操作，
在已应用此 P1.5 migration 的 DB 上会失败。解决：每次 Prisma 7 下的新
migration 都先 `migrate diff` → 人工 review → 不用 `migrate dev`。

### Prisma 7 drift 第 4 次规避

**背景**：本轮选择了**完全不跑** `prisma migrate dev`，因为 DB 里已有
10,129 Toilet 行 + M7 P1 的 AppealType enum，`migrate dev` 会要求重置。
**操作路径**：手写 migration SQL → `docker exec psql < migration.sql` →
`prisma migrate resolve --applied` → `prisma generate`。
**验证**：`Toilet.location` NOT NULL + `toilet_location_idx` spatial 完好，
10,129 Toilet 行完整。这是第 4 次规避 drift。

### `proposedChanges` 字段没有 DB 级白名单

**背景**：Appeal.proposedChanges 是 JSONB。zod 层的 ProposedChangesSchema
允许 name / address / type / floor；但 DB 只检查 `IS NOT NULL`。
**风险**：若未来绕过 tRPC 直接写 DB，可以写入任意字段。`admin.resolveAppeal`
的 SUGGEST_EDIT 分支只按白名单字段 patch Toilet，非白名单字段静默忽略 —
所以风险收敛但不为零。
**修复方向**：加 PostgreSQL `jsonb_path_match` CHECK 或 JSON schema
extension，MVP 阶段不做。

### M8+ TODO · 重新接入 SUGGEST_EDIT 的 hours 字段

**背景**：M7 P1.5 hotfix 把 `hours` 从 ProposedChangesSchema 移除（之前
是"软落地"——zod 接受但 admin.resolveAppeal 静默忽略，导致用户感觉编辑
成功而实际没落库的"假成功"体验）。
**未来步骤**（M8+ Toilet 加 hours Json 列时）：
1. `prisma/schema.prisma` 给 Toilet 加 `hours Json?`（多语言 + 结构化营业时间，参考 OSM `opening_hours` tag 格式）
2. `src/server/api/routers/appeal/index.ts` ProposedChangesSchema 重新加
   `hours: z.string().max(200).optional()`（或更结构化的 schema）
3. `src/server/api/routers/admin/index.ts` SUGGEST_EDIT UPHELD 分支加
   `if (typeof pc.hours === 'string') patch.hours = ...` 真正落库
4. M7 P2 SUGGEST_EDIT UI 重新启用 hours 输入控件
**记录原因**：避免重新踩坑——`hours` 不能再次以"软落地"姿态被加回 zod
schema，必须配套 Toilet.hours 列 + UPHELD 副作用 + UI 三件套同时上。

### `admin.listAppeals` 无 photo 缩略图签名

**背景**：列表返回 evidence String[]（R2 keys），但不附带 `photo.getViewUrls`
签名结果。admin UI (M7 P3) 需要自己批量调 getViewUrls 拿 presigned GET。
**现状**：行为正确，只是多一次往返。M7 P3 的 UI 层加 useBatchPhotoUrls
hook 就解决（与 /me/submissions 一样的 pattern）。

### Appeal moderation 与 Toilet / Review moderation 分离

**背景**：M6 有 ToiletModeration 表持久化 toilet 审核；M7 P1 把 review
moderation 字段 inline 到 Review；M7 P1.5 把 appeal moderation 字段
inline 到 Appeal。三种风格三处存放。
**评价**：接受。每种审核对象查询模式不同：Toilet 需要 1:1 唯一约束 +
独立 ToiletModeration 表做 admin 队列 join；Review / Appeal 本身就是
队列对象，inline 更直观。
**未来**：若要统一 moderation 审计 UI（跨 toilet + review + appeal），
考虑抽一个 `ModerationEvent` 表做只读视图。不紧急。

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

## M12 location nullness (2026-04-22)

### Prod Toilet.location 非 Tokyo 行全 NULL → backfill + 诊断脚本

**症状**：M12 prod imports 结束后累计 365k 行，listByBbox 对东京以外
bbox 全返 0。Tokyo 查询正常 → SQL / 包封路径 / 客户端 wiring 都对。差异只能是
非 Tokyo 行 `location` geography 列是 NULL。

**根因假设**（需脚本 Phase 1 诊断确认）：prisma/migrations/20260419001746_
add_spatial_index_and_trigger/ 的 `toilet_location_trigger`（BEFORE INSERT
OR UPDATE OF latitude, longitude）在 M11（2026-04-20）和 M12（2026-04-22）
之间的某次 prod 操作中被 drop / disable。M11 import 成功（Tokyo 有
location）→ M12 import 那时 trigger 已缺失（新行 location NULL）。

**代码审计**：scripts/osm-import.ts（M11）与 scripts/osm-import-global.ts
（M12）的 upsert payload **完全相同**——都只写 `latitude` + `longitude`，
都靠 trigger 合成 location。所以不是 upsert 路径漏，是 trigger 漏。**不需
改 osm-import-global.ts**。

**Prisma 7 drift 历史**（同类事件前科）：KNOWN_ISSUES M2 / M6 / M7-P1 /
M7-P1.5 记录过 Prisma migrate diff 多次生成 `DROP INDEX toilet_location_idx`
+ `ALTER TABLE "Toilet" ALTER COLUMN "location" DROP NOT NULL`，每次手删。
未曾见过 drift 影响 trigger 本身——但 prod 状态怎样是谜，脚本跑出来看。

**修复**：`scripts/backfill-toilet-location.ts` (`pnpm prod:backfill-location`)
四阶段 idempotent：
1. 诊断 — count + trigger + GIST index 列表
2. 若 trigger / index 缺失则按 migration SQL 重建（IF NOT EXISTS / OR
   REPLACE 幂等）
3. batched CTE UPDATE 每 10k 行补 location，进度条
4. 后置诊断 — 确认 0 NULL

Local docker smoke test：`365,759 rows, 0 NULL, trigger 存在, GIST index
缺失 → 重建`。本地路径全通。

**Ming 跑**：`DATABASE_URL='<prod URI>' pnpm prod:backfill-location`，
跑完硬刷 toirepo.com zoom 到任意城市应立即看到 markers。

**防回归**：未来 `pnpm prisma migrate dev` 仍可能生成 drift 行，每次审
review migration SQL 并手删（按 SPEC v1.1 §8 + CLAUDE.md §4.3 规则）。若
drift 又跳过 trigger 本身的 drop，本脚本仍可以再跑一次幂等修复。

---

## M11 (2026-04-20)

### ~~`toilet.list` limit=2000 只覆盖全东京 ~20%~~ → 已修 (2026-04-22, M12 P1)

**原背景**：DB 10,128 APPROVED 厕所，MapCanvas 默认拉 limit=2000，边郊
区用户遇"marker 应在图上但没显示"。
**修复**：M12 P1 引入 `toilet.listByBbox` tRPC endpoint + MapCanvas
`map.on('moveend')` debounce 500ms 触发 viewport-scoped 重拉。zoom < 3
显示 onboarding hint 跳过 fetch。
**验证**：prod 365k+ Toilets，panning Beijing / NYC / London 每次 settle
fires 1 query limit ≤5000 rows，全世界覆盖。admin 审核后
`utils.toilet.listByBbox.invalidate()` 保留推送式刷新。
**相关文件**：`src/server/api/routers/toilet/listByBbox.ts`、
`src/components/map/MapCanvas.tsx`、`src/components/admin/{AdminQueueList,AdminAppealsList}.tsx`。

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
