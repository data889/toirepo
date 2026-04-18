# toirepo.app · 任务拆解文档

> **配套文档**：`PROJECT_SPEC.md`（规格总纲，必读）
> **使用方式**：按顺序执行任务。每个任务大小控制在 1-2 小时以内，适合单次 Claude Code 对话完成。
> **里程碑标记**：`M1/M2/...` 表示里程碑。每个里程碑结束后应人工验收后再进入下一个。

---

# TASK_BREAKDOWN v1.1 变更说明（2026-04-18）

## T1.1 扩展

原 v1.0 的 5 个子步骤扩展为 7 个，补充了工程实践项：

- 新增：v1.1 变更说明写入 SPEC、CLAUDE.md 填充、.nvmrc + engines + engine-strict、
  .env.local.example、.gitignore 补全
- 原步骤"pnpm create next-app"已在任务外由发起人执行
- 实际执行序列：A(SPEC v1.1) → B(CLAUDE.md) → C(Prettier) → D(Node版本) →
  E(Docker) → F(Husky) → G(.gitignore + env example) → H(本说明)
- 验证清单从 4 条扩展为 9 条（见 T1.1 末尾）

## 其他本地实施决定

- PostgreSQL 端口改用 5433（本机 5432 被 planning_db 占用）
- 配置 `.npmrc` 启用 `engine-strict=true`，防止 Homebrew 系统 Node 25 污染
- `.husky/pre-commit` 自动 source nvm，解决本机双 Node 共存下的 hook 环境问题

## T1.2 版本偏差

- **Prisma 5 → 7**：`pnpm add @prisma/client` 默认拉到 7.7.0。决定：接受升级。
  `postgresqlExtensions` 从 preview 转为稳定，§5.2 schema 的 `previewFeatures` flag
  可省略。详见 PROJECT_SPEC v1.1 变更说明第 4 条。
- **Zod 3 → 4**：`pnpm add zod` 默认拉到 4.3.6。决定：接受升级。本项目用到的
  API 子集与 v4 完全兼容，`z.record()` 签名变化由 TS 显式提示。详见
  PROJECT_SPEC v1.1 变更说明第 5 条。
- **maplibre-gl 4 → 5 · react-map-gl 7 → 8**：两个地图库均默认装到最新主版本。
  决定：接受升级。T3.4 步骤 2 的 import 写法同步修订为 `react-map-gl` + `mapLib`
  prop 注入 maplibre-gl（v8 已移除 `react-map-gl/maplibre` 子路径）。详见
  PROJECT_SPEC v1.1 变更说明第 6 条。
- **next-intl 3 → 4**：默认拉到 4.9.1。决定：接受升级。v4 官方适配 Next.js 16，
  v3 止步 Next 15。T1.4 正文为抽象引用（"按 next-intl App Router 教程配置"），
  无 v3 特定代码示例需要改；仅提醒实施 T1.4 时参考 v4 教程。详见 PROJECT_SPEC
  v1.1 变更说明第 7 条。
- **@hookform/resolvers 3 → 5**（+2 major，下游库）：默认拉到 5.2.2。
  决定：接受升级。`zodResolver` 的 import 模式（`@hookform/resolvers/zod`）
  跨 v3/v4/v5 稳定，v5 主要是对 Zod 4 的 TS 类型优化。记录在批次 9 commit
  996d782 body 中。
- **@trpc/next 新增**：SPEC §3.1 只列了 `@trpc/server/client/react-query`,
  T1.2 实际多装了 `@trpc/next` 11.16.0（Next.js 专用 helper，与其他 tRPC 包
  同版本）。非版本偏差，只是补全 tRPC Next.js 集成必需的姐妹包。
- **@types/node 20 → 22**：SPEC T1.2 依赖清单期望 `^22` 但 create-next-app
  脚手架预装 `^20`。T1.2 总验收时发现并升级到 22.19.17，对齐 Node 22 运行时
  类型（v22 新增的 API 如 `process.loadEnvFile`、原生 `WebSocket` 等在代码
  里可获得类型提示）。
- **T2.1 新增包 · Prisma 7 adapter 模式**：`@prisma/adapter-pg` 7.7.0、
  `pg` 8.20.0、`@types/pg` 8.20.0（dev）、`dotenv` 17.4.2（dev，供
  `prisma.config.ts` 使用）。非 SPEC §3.1 原始列表。Prisma 7 强制 adapter
  模式连接数据库，此改动在 PROJECT_SPEC v1.1 第 4 条有详细说明。
- **lint-staged 15 → 16**：T1.1 F 子步骤 `pnpm add -D lint-staged` 未带版本
  号，拉到 v16.4.0，超出 SPEC T1.2 期望的 `^15`。v15 → v16 主要是移除 Node
  18 支持与 CLI flag 重命名；本项目通过 `package.json` 的 `lint-staged` config
  对象使用，格式兼容，pre-commit hook 一直正常工作。保留 v16，不降级。
- **白名单追加（批次 5）**：`@parcel/watcher` + `@swc/core` 加入
  `onlyBuiltDependencies`。用途：next-intl 的 transitive deps，负责文件监听和
  JS/TS 编译的原生 binding。不批准 postinstall 会 fallback 到 JS/WASM，dev
  hot-reload 与 build 速度显著下降。
- **白名单追加（批次 8）**：`@sentry/cli`、`core-js`、`protobufjs` 加入
  `onlyBuiltDependencies`。用途：`@sentry/cli` 下载 sentry-cli 二进制（M10
  T10.2 source maps 上传依赖）；`core-js` postinstall 仅打印感谢信，加入是为
  清零警告噪音；`protobufjs` 是 posthog-js 事件序列化依赖。
- **白名单追加（批次 11）**：`esbuild` 加入 `onlyBuiltDependencies`。用途：
  vitest + tsx 的原生编译器二进制。不批准则测试 runner 和 TS 脚本执行失败或
  严重变慢。当前完整列表：@prisma/engines, prisma, @parcel/watcher, @swc/core,
  @sentry/cli, core-js, protobufjs, esbuild。
- **pnpm 构建白名单**：pnpm v10 默认禁用 postinstall 脚本。本项目在 `package.json`
  顶层加 `"pnpm": { "onlyBuiltDependencies": [...] }` 显式允许 Prisma 的 engine
  构建脚本。未来批次若出现其他需构建的包（如 sharp、esbuild、swc 变体），
  追加到该数组，并在对应批次 commit 说明。

## T1.2 批次偏差处理规则（自批次 4 起）

为避免每批都停，约定：

- **下游运行时库**的大版本偏差：本批 commit body 里记录，T1.2 总验收时统一补一次
  `docs: bump v1.1 — T1.2 version deltas` commit。
- **架构级库**（地图、i18n、PWA、监控）的大版本偏差：立即停下来。
- 任何 peer dep error / engine 错误 / install 失败 / 需要新加白名单：立即停下来。
- 当依赖库实际 API 与 SPEC 代码示例冲突时，允许直接修改 SPEC 正文示例，
  以库的实际 API 为准，并在 v1.1 变更说明里记录修订点。
- 白名单追加默认策略：全加。除非具体包的 postinstall 有明确安全顾虑，
  否则以清零 "Ignored build scripts" 警告为目标。每次追加仍需停下来报告，
  只是决策默认值从"权衡"变为"接受"。

后续任务如实际执行偏离 v1.0 文本，同样在此处追加说明。

---

## 里程碑总览

| 里程碑 | 目标 | 任务数 | 预计工时 |
|---|---|---|---|
| M1 | 项目脚手架 + 本地开发环境 | 4 | 4-6h |
| M2 | 数据库 + 认证 | 5 | 6-8h |
| M3 | 地图底图与视觉系统 | 5 | 8-10h |
| M4 | 厕所数据展示（只读） | 4 | 6-8h |
| M5 | 用户提交与上传 | 5 | 8-10h |
| M6 | AI 预审与人工审核 | 4 | 6-8h |
| M7 | 评论、确认、店家申诉 | 3 | 4-6h |
| M8 | 多语言与机器翻译 | 3 | 4-6h |
| M9 | SEO、PWA、性能 | 3 | 4-6h |
| M10 | 部署与监控 | 3 | 4h |
| M11 | OSM 导入与上线准备 | 2 | 3-4h |
| **合计** | MVP 上线 | **41** | **57-76h** |

---

## M1 · 项目脚手架

### T1.1 初始化 Next.js 项目

**目标**：创建 Next.js 15 项目，配置 TypeScript、ESLint、Prettier。

**步骤**（v1.1 实际执行）：

A. 在 `docs/PROJECT_SPEC.md` 顶部写入 v1.1 变更说明（Next 16 / Tailwind v4 / 端口 5433）— `b00f41a`
B. 填充 `CLAUDE.md`（项目级 AI 指令、红线、commit 规范）— `4666e08`
C. 配置 Prettier（`prettier@3` + `prettier-plugin-tailwindcss`，`.prettierrc`、`.prettierignore`、format/format:check/typecheck scripts）— `bd96dfe`
D. 锁定 Node 版本（`.nvmrc=22`、`package.json` engines 字段、`.npmrc` engine-strict）— `efef019`
E. Docker Compose（`postgis/postgis:16-3.4-alpine`，端口 5433:5432，容器名 toirepo_postgres，命名 volume toirepo_pg_data，healthcheck）— `609887b`
F. Husky v9 + lint-staged（`.husky/pre-commit` 自动 source nvm，lint-staged 对 ts/tsx/json/md/yaml/css 分规则）— `eb82ee3`
G. `.gitignore` 补全（env 精准三条规则、macOS、IDE、logs）+ 加入 `.env.local.example` — `c5e7c1d`
H. 本说明同步（此 commit）

**验证**（v1.1 扩展为 9 项）：

- [ ] `node -v` 输出 v22.22.2（需先 `nvm use`）
- [ ] `pnpm -v` 输出 10.33.0
- [ ] `pnpm typecheck` 无错误
- [ ] `pnpm lint` 无警告无错误
- [ ] `pnpm format:check` 全部通过
- [ ] `docker compose ps` 显示 toirepo_postgres 为 healthy
- [ ] `docker exec toirepo_postgres psql -U toirepo -d toirepo -c "SELECT PostGIS_Version();"` 返回 3.4+
- [ ] `git log --oneline` 显示 T1.1 的 A–H commit 链完整
- [ ] 制造一个 TSX 文件测试 pre-commit hook 在 Node 22 下跑通 eslint+prettier（测试后立即 `git reset --hard HEAD~1` 回滚）

---

### T1.2 安装核心依赖

**目标**：安装所有 PROJECT_SPEC §3.1 列出的主要依赖。

**依赖清单**：

```json
{
  "dependencies": {
    "next": "^15",
    "react": "^19",
    "react-dom": "^19",
    "@prisma/client": "^5",
    "prisma": "^5",
    "next-auth": "5.0.0-beta.25",
    "@auth/prisma-adapter": "^2",
    "@trpc/server": "^11",
    "@trpc/client": "^11",
    "@trpc/react-query": "^11",
    "@tanstack/react-query": "^5",
    "zod": "^3",
    "maplibre-gl": "^4",
    "react-map-gl": "^7",
    "next-intl": "^3",
    "tailwindcss": "^3",
    "sharp": "^0",
    "exifr": "^7",
    "react-hook-form": "^7",
    "@hookform/resolvers": "^3",
    "lucide-react": "latest",
    "@aws-sdk/client-s3": "^3",
    "@aws-sdk/s3-request-presigner": "^3",
    "@anthropic-ai/sdk": "latest",
    "deepl-node": "latest",
    "resend": "latest",
    "@upstash/ratelimit": "latest",
    "@upstash/redis": "latest",
    "@sentry/nextjs": "latest",
    "posthog-js": "latest",
    "serwist": "latest",
    "@serwist/next": "latest"
  },
  "devDependencies": {
    "@types/node": "^22",
    "@types/react": "^19",
    "typescript": "^5",
    "eslint": "^9",
    "eslint-config-next": "^15",
    "prettier": "^3",
    "prettier-plugin-tailwindcss": "^0",
    "husky": "^9",
    "lint-staged": "^15",
    "vitest": "latest",
    "@playwright/test": "latest",
    "tsx": "latest"
  }
}
```

**验证**：
- [ ] `pnpm install` 无冲突
- [ ] `pnpm typecheck` 通过

---

### T1.3 初始化 shadcn/ui

**目标**：配置 shadcn/ui 并安装常用组件。

**步骤**：
1. `pnpm dlx shadcn@latest init`
2. 选择配置：New York 风格、Slate 中性色（会被我们后续覆盖）
3. 安装组件：`button input label form select textarea dialog sheet dropdown-menu toast badge card separator tabs`
4. 按 PROJECT_SPEC §4.2 修改 `tailwind.config.ts` 和 `globals.css`，使用 toirepo 的配色

**验证**：
- [ ] `src/components/ui/` 下有对应组件文件
- [ ] 简单测试页面可正常渲染 Button 组件
- [ ] 主色已替换为 toirepo 配色

---

### T1.4 设置 i18n 基础

**目标**：配置 next-intl 的路由、middleware 和基础文案结构。

**步骤**：
1. 按 next-intl App Router 教程配置
2. 创建 `messages/zh-CN.json`、`messages/ja.json`、`messages/en.json`（先放少量 key 测试）
3. 设置 middleware 使默认重定向到 `/zh-CN/`
4. 创建 `LocaleSwitcher` 组件

**验证**：
- [ ] 访问 `/` 重定向到 `/zh-CN/`
- [ ] 访问 `/ja/` 显示日文
- [ ] LocaleSwitcher 可在三语间切换

---

## M2 · 数据库与认证

### T2.1 定义 Prisma Schema

**目标**：按 PROJECT_SPEC §5.2 完整实现 Prisma schema。

**步骤**：
1. 创建 `prisma/schema.prisma`，包含所有模型与枚举
2. 注意：Prisma 对 PostGIS geography 类型支持有限，用 `Unsupported("geography(Point, 4326)")`
3. 运行 `pnpm prisma migrate dev --name init`
4. 创建后续 migration 手动添加空间索引与触发器（见 PROJECT_SPEC §5.3）
5. 运行 `pnpm prisma generate`

**验证**：
- [ ] 所有表创建成功
- [ ] `\d "Toilet"` 可看到 location 字段类型为 geography
- [ ] `\d+ "Toilet"` 可看到 GIST 空间索引
- [ ] 插入一条测试数据验证触发器自动生成 location

---

### T2.2 配置 Auth.js（Google + 邮箱）

**目标**：配置 Auth.js v5，支持 Google OAuth + 邮箱 Magic Link。

**步骤**：
1. 创建 `src/server/auth.ts`，使用 PrismaAdapter
2. 配置 Google Provider（需环境变量 `AUTH_GOOGLE_ID` 和 `AUTH_GOOGLE_SECRET`，人工提供）
3. 配置 Email Provider（Resend）
4. 创建 `src/app/api/auth/[...nextauth]/route.ts`
5. 创建登录页 `/auth/signin`（使用 shadcn 表单）

**验证**：
- [ ] 用 Google 登录成功后数据库创建 User 记录
- [ ] 邮箱 Magic Link 正常发送
- [ ] 登录后 `auth()` 可在 server component 中获取 session
- [ ] 退出登录清空 session

---

### T2.3 配置 tRPC

**目标**：搭建 tRPC 基础设施。

**步骤**：
1. 创建 `src/server/api/trpc.ts`（context、publicProcedure、protectedProcedure、adminProcedure）
2. 创建 `src/server/api/root.ts`（合并 router）
3. 创建 `src/app/api/trpc/[trpc]/route.ts`
4. 创建 `src/lib/trpc/client.tsx` 和 `src/lib/trpc/server.ts`
5. 在 app/[locale]/layout.tsx 中包裹 TRPCProvider
6. 创建测试 router（如 `pingRouter`）验证通路

**验证**：
- [ ] Server Component 中可调用 `api.ping.hello()`
- [ ] Client Component 中可用 `api.ping.hello.useQuery()`
- [ ] protectedProcedure 未登录返回 UNAUTHORIZED

---

### T2.4 配置速率限制

**目标**：集成 Upstash Ratelimit。

**步骤**：
1. 注册 Upstash 账户，创建 Redis 数据库（需人工）
2. 创建 `src/lib/ratelimit.ts`，按 PROJECT_SPEC §6.3 定义各个限流器
3. 在 trpc 中间件中按 procedure 类型应用限流
4. 创建速率限制错误的用户提示

**验证**：
- [ ] 连续快速调用受限 procedure 触发限流
- [ ] 限流响应返回 429 状态码

---

### T2.5 实现权限辅助函数

**目标**：建立权限检查工具函数。

**步骤**：
1. 创建 `src/lib/permissions.ts`：
   - `canSubmitToilet(user)`
   - `canConfirmToilet(user, toiletId)` (检查 30 天限制)
   - `canReviewToilet(user, toiletId)` (检查是否已评论)
   - `canAccessAdmin(user)`
   - `canAutoPublish(user)` (信任用户判断，MVP 阶段返回 false)
2. 创建单元测试

**验证**：
- [ ] 所有函数有单元测试
- [ ] 边界情况覆盖（被封禁用户、未验证邮箱等）

---

## M3 · 地图底图与视觉系统

### T3.1 下载与配置 MapLibre 底图数据

**目标**：准备东京地区的 OSM 矢量瓦片（pmtiles 格式）。

**步骤**：
1. 使用 Planetiler 从 Geofabrik 下载关东地区 OSM 数据
   - 或直接下载预生成的 `planet.pmtiles` 的东京部分
2. 生成 pmtiles 文件，上传到 R2
3. 配置 pmtiles HTTP Range Request 服务（R2 原生支持）

**注意**：此任务依赖 R2 已创建。Claude Code 应先确认 R2 配置。

**替代方案**：如果 Planetiler 生成耗时过长，可先用 Protomaps 的公共瓦片服务作为临时方案，后续再切换到自托管。

**验证**：
- [ ] pmtiles URL 可通过 HTTP Range 请求访问
- [ ] 在 MapLibre 调试工具中能看到瓦片数据

---

### T3.2 设计并实现自定义地图样式

**目标**：创建 `public/map-style/toirepo-paper.json`，实现纸质感白底样式。

**步骤**：
1. 参考 OpenMapTiles 官方样式文件结构
2. 按 PROJECT_SPEC §4.2 的配色定义所有 layer 样式：
   - `background`：`#FDFCF9`
   - `landuse_park`：`#E8EBE0`
   - `water`：`#E8E4D8`（不用蓝色！）
   - `road_primary`：line-color `#B8B4A8`，line-width 1.5
   - `road_secondary`：line-color `#D8D4C8`，line-width 0.8
   - `rail`：line-color `#C4A8A0`，line-dasharray [3, 2]
   - `place_label`：text-color `#8A8578`，letter-spacing 1.5
3. 移除所有 POI、店铺、车站 icon（保持极简）
4. 移除鲜艳色地铁线色
5. 字体：使用 Noto Sans（需要 glyphs 服务，可用 MapLibre demo tiles glyphs 作为起点）

**验证**：
- [ ] 样式在本地可渲染
- [ ] 水域不是蓝色
- [ ] 整体视觉符合"纸质感"定义
- [ ] 放大到 zoom 16 不会出现不协调的彩色元素

---

### T3.3 实现四种厕所图标

**目标**：创建 `public/toilet-icons/` 下的四个 SVG 图标。

**步骤**：
1. 按 PROJECT_SPEC §4.2 与 §4.4 规范设计：
   - `public.svg`：圆形，填充 `#D4573A`，中心白色 "P"
   - `mall.svg`：圆角方形，填充 `#2C6B8F`，中心白色 "M"
   - `konbini.svg`：三角形，填充 `#5C8A3A`，中心白色 "C"
   - `purchase.svg`：五边形（盾牌状），填充 `#B8860B`，中心白色 "¥"
2. 每个图标外描边 2.5px 白色
3. 尺寸 32×32，viewBox 0 0 32 32
4. 同时导出 2x PNG 版本（64×64）供不支持 SVG 的场景使用

**验证**：
- [ ] 四个 SVG 文件在浏览器中可正常显示
- [ ] 图标在 `#FDFCF9` 和 `#B8B4A8`（街道色）背景上均清晰可见
- [ ] 图标聚簇展示的算法预留（将在 T3.5 实现）

---

### T3.4 实现 MapCanvas 组件

**目标**：基础地图组件，加载样式并初始化。

**步骤**：
1. 创建 `src/components/map/MapCanvas.tsx`
2. 使用 `react-map-gl` 封装，通过 `mapLib={maplibregl}` prop 注入 MapLibre GL JS
   （v8+ 已移除 `react-map-gl/maplibre` 子路径导入方式）
3. 初始化中心点：东京站 (35.6812, 139.7671)，zoom=14
4. 支持用户定位权限请求（按钮触发，不自动请求）
5. 添加 Zoom controls（样式覆写为纸质感）
6. 全屏切换按钮

**验证**：
- [ ] 地图组件在首页正确渲染
- [ ] 拖动、缩放流畅
- [ ] 定位按钮可获取当前位置
- [ ] 移动端触控正常

---

### T3.5 实现厕所 Marker 与聚簇

**目标**：在地图上渲染厕所图标，支持聚簇展示。

**步骤**：
1. 使用 MapLibre 的原生 cluster 功能（GeoJSON Source 的 `cluster: true`）
2. 按类型设置不同的 Layer，每种类型使用对应图标
3. 聚簇时：
   - 同类型聚簇：显示类型对应色的大圆 + 数字
   - 混合类型聚簇：显示灰色圆 `#888780` + 数字
4. 点击图标：触发 popup 显示 `ToiletCard`
5. 点击聚簇：地图平滑 zoom in 到该区域

**验证**：
- [ ] 500 个以上厕所不卡顿
- [ ] 聚簇在不同 zoom level 正确展开/合并
- [ ] 点击图标弹窗显示正确信息
- [ ] 移动端触控友好（点击区域足够大）

---

## M4 · 厕所数据展示（只读）

### T4.1 实现 toilet 列表 tRPC procedure

**目标**：实现 `toilet.list` procedure（PROJECT_SPEC §6.2）。

**步骤**：
1. 在 `src/server/api/routers/toilet.ts` 实现 list procedure
2. 支持 bbox 查询（PostGIS ST_Within）
3. 支持 center + radius 查询（PostGIS ST_DWithin）
4. 支持所有筛选条件
5. 只返回 `status = APPROVED` 的厕所
6. 限制单次最大返回 500 条

**验证**：
- [ ] 空数据库时返回空数组不报错
- [ ] 插入 3-5 条测试数据后查询正确
- [ ] bbox 查询边界点处理正确
- [ ] 性能：500 条数据 P95 < 200ms

---

### T4.2 实现筛选器 UI

**目标**：实现地图侧边的筛选器面板。

**步骤**：
1. 创建 `FilterPanel.tsx`（桌面端右上角浮动，移动端底部抽屉）
2. 包含 PROJECT_SPEC §5.6 中列出的所有筛选项
3. 使用 URL search params 保存筛选状态（方便分享链接）
4. 更改筛选后地图自动重新请求数据

**验证**：
- [ ] 所有筛选项可点击生效
- [ ] URL 实时反映筛选状态
- [ ] 筛选后地图图标正确更新
- [ ] 移动端抽屉交互流畅

---

### T4.3 实现厕所卡片与详情页

**目标**：卡片（地图 popup）+ 详情页（独立路由）。

**步骤**：
1. 创建 `ToiletCard.tsx`（紧凑版，展示核心信息 + "查看详情"按钮）
2. 创建 `src/app/[locale]/t/[slug]/page.tsx`（SSR 详情页）
3. 详情页包含：
   - 头部：名称、类型徽章、地址、楼层
   - 地图小缩略图（点击全屏查看）
   - 属性徽章网格（PROJECT_SPEC §5.2 Toilet model 的所有布尔字段）
   - 进入路径说明（突出显示！）
   - 开放时间
   - 照片画廊
   - 评论列表
   - 一键确认可用按钮（登录状态下可用）
   - "在 Google Maps 中打开"、"复制分享链接"按钮
4. 未登录用户看到 CTA："注册后可评论和确认"

**验证**：
- [ ] 点击地图图标可弹出卡片
- [ ] 卡片"查看详情"跳转到详情页
- [ ] 详情页直接访问 URL 可 SSR 渲染（curl 能拿到完整 HTML）
- [ ] 未审核厕所的 slug 访问返回 404

---

### T4.4 实现地址搜索

**目标**：地图顶部搜索栏，可按地名/地址跳转。

**步骤**：
1. 使用 Nominatim API（OSM 官方免费服务，但需遵守每秒 1 次的限制）
2. 或使用 Mapbox Geocoding API（需 token）
3. 实现自动补全下拉（debounce 300ms）
4. 选择结果后地图 flyTo 该位置
5. 移动端搜索栏可全屏展开

**验证**：
- [ ] 搜索"涩谷站"跳转到正确位置
- [ ] 搜索"Shinjuku"支持英文
- [ ] 搜索"新宿駅"支持日文
- [ ] 搜索 500m 精度的精确地址可行

---

## M5 · 用户提交与上传

### T5.1 实现提交表单

**目标**：`/submit` 页面，注册用户可提交新厕所。

**步骤**：
1. 创建 `src/app/[locale]/submit/page.tsx`（需登录）
2. 表单字段（react-hook-form + zod）：
   - 位置（地图点击选点，或输入地址搜索）
   - 类型选择（4 种图标单选）
   - 名称（单语输入，后端自动翻译）
   - 建筑名 + 楼层
   - 改札内/外（仅当类型=PUBLIC 且名称含"駅/Station"时显示）
   - 属性多选（无障碍、婴儿护理台、免治马桶等）
   - 开放时间（24H 开关 + 简易时段编辑器）
   - 进入路径说明（多行文本，强烈鼓励填写）
   - 照片上传（≥1 张）
3. 提交按钮：先校验 → 上传照片 → 调用 `toilet.submit` procedure
4. 成功后跳转到"感谢页"，说明"您的提交正在审核中"

**验证**：
- [ ] 所有必填项未填时表单不可提交
- [ ] 未登录访问 /submit 重定向到登录页
- [ ] 提交成功后数据库创建 status=PENDING 记录
- [ ] 同一位置 50m 内已有同类型厕所时警告用户"可能重复"

---

### T5.2 实现照片上传（含 EXIF 剥离）

**目标**：安全、高效的照片上传流程。

**步骤**：
1. 创建 `PhotoUploader.tsx`
2. 客户端流程：
   - 用户选择图片（支持 jpg/png/webp/heic）
   - 用 `exifr` 读取并丢弃所有 EXIF 数据
   - 使用 Canvas 压缩长边 ≤ 2048px
   - 生成缩略图（长边 400px）
   - 两个文件都上传
3. 服务端流程：
   - 通过预签名 URL 直接上传到 R2
   - 上传完成后调用 `photo.confirmUpload` 记录入库
   - 异步触发 AI 预审（Vercel Cron 或 Inngest）
4. UI：上传进度条、拖拽上传、预览、删除

**验证**：
- [ ] 上传照片后用 exiftool 验证 GPS 数据已剥离
- [ ] 2MB 以内的大图上传流畅
- [ ] 移动端相机直接拍照上传正常
- [ ] 网络中断时有错误提示且可重试

---

### T5.3 实现位置选点

**目标**：地图上点击选点，带地址反查。

**步骤**：
1. 创建 `LocationPicker.tsx`
2. 集成到提交表单
3. 用户点击地图后：
   - 放置临时 marker
   - 调用 Nominatim 反查地址填入表单
   - 提示"您是否确认此位置？"
4. 支持拖拽 marker 微调
5. 支持"使用我当前位置"快捷按钮

**验证**：
- [ ] 点击地图准确放置 marker
- [ ] 反查的地址正确性可接受（至少能识别到街道级别）
- [ ] 拖拽后地址实时更新
- [ ] 不在东京范围内的位置警告（MVP 阶段只接受东京提交）

---

### T5.4 实现我的提交页

**目标**：用户个人页面，查看自己的提交状态。

**步骤**：
1. 创建 `src/app/[locale]/me/submissions/page.tsx`
2. 显示：已提交的厕所（含状态标签：待审核/已发布/已拒绝）
3. 已拒绝的条目显示拒绝原因
4. 已发布的条目显示"查看"链接
5. 我的评论列表
6. 我的照片列表

**验证**：
- [ ] 分页正常（每页 20 条）
- [ ] 状态标签颜色正确
- [ ] 拒绝原因对用户可见

---

### T5.5 实现注册页与邮箱验证

**目标**：注册流程完整可用。

**步骤**：
1. 创建 `/auth/signup` 页面（可与 signin 合并为一个页面的不同 tab）
2. 邮箱注册：用户输入邮箱 → 发送 Magic Link → 点击验证后自动登录
3. Google 注册：直接 OAuth 跳转
4. 注册成功后引导填写昵称（可跳过）
5. 服务条款、隐私政策勾选框（必须主动勾选）

**验证**：
- [ ] 邮箱 Magic Link 5 分钟内可用，过期后失效
- [ ] 服务条款未勾选时无法注册
- [ ] 注册后 session 立即生效
- [ ] 重复邮箱注册会识别为登录

---

## M6 · AI 预审与人工审核

### T6.1 实现 AI 预审（图片）

**目标**：使用 Claude Haiku 4.5 对上传图片进行预审。

**步骤**：
1. 创建 `src/lib/moderation/image-prescreen.ts`
2. 实现 prompt（参考 PROJECT_SPEC §7.2）
3. 调用 Anthropic SDK，传入图片 base64 + prompt
4. 解析 JSON 响应，存入 Photo.aiPrescreenResult
5. 规则：
   - `allowed=true && confidence >= 0.7` → 进入人工审核队列
   - `allowed=true && confidence < 0.7` → 仍然进入人工审核队列（保守策略）
   - `allowed=false` → 自动 REJECTED + 通知用户
6. 使用 Vercel Cron 每分钟扫描待预审的照片

**验证**：
- [ ] 上传正常入口照片 → 预审通过
- [ ] 上传无关照片（如食物）→ 预审拒绝
- [ ] 上传人像照片 → 预审拒绝
- [ ] API 失败时不影响用户流程，记录错误日志

---

### T6.2 实现 AI 预审（文字）

**目标**：对用户提交的文字内容（厕所名称、进入路径说明、评论）进行预审。

**步骤**：
1. 创建 `src/lib/moderation/text-prescreen.ts`
2. 使用 Claude Haiku 判断
3. 在内容提交时同步调用（快速、不阻塞用户太久）
4. 违规内容直接拒绝提交

**验证**：
- [ ] 正常中日英文本通过
- [ ] 包含辱骂/人身攻击的文本被拒绝
- [ ] 包含广告/推销的文本被标记

---

### T6.3 实现审核队列 UI

**目标**：管理员后台 `/admin/queue` 可视化审核界面。

**步骤**：
1. 创建 `src/app/admin/queue/page.tsx`（需 ADMIN 角色）
2. 使用 tabs 分类：厕所 / 照片 / 评论 / 店家申诉
3. 每个队列项展示：
   - 提交者信息（含信用等级、历史通过率）
   - 提交时间
   - AI 预审结果
   - 完整提交内容
   - 附近（100m 内）已有厕所列表（防重复）
4. 操作按钮：通过 / 拒绝（需填原因）/ 合并到已有 / 跳过
5. 键盘快捷键：A（通过）、R（拒绝）、M（合并）、S（跳过）
6. 通过后自动进入下一条

**验证**：
- [ ] 非 ADMIN 访问返回 403
- [ ] 通过后厕所 status=APPROVED，publishedAt 填入当前时间
- [ ] 拒绝后用户收到邮件通知（含拒绝原因）
- [ ] 合并功能正确：保留 primary，删除 duplicates，转移关联数据

---

### T6.4 实现审计日志

**目标**：所有关键操作记录到 AuditLog 表。

**步骤**：
1. 在每个 admin procedure 中插入 AuditLog 记录
2. 创建 `/admin/logs` 查看页面
3. 支持按操作者、时间、操作类型过滤

**验证**：
- [ ] 审核通过/拒绝/合并/隐藏都有日志
- [ ] 日志不可修改（无 update/delete API）

---

## M7 · 评论、确认、店家申诉

### T7.1 实现评论功能

**目标**：用户对厕所发表评论和评分。

**步骤**：
1. 在 `ToiletDetail` 下方添加 `ReviewForm`
2. 评分：1-5 星（清洁度）
3. 文字评论（可选，≤500 字）
4. 提交前自动调用 AI 文本预审
5. 同一用户对同一厕所只能有一条评论（update-or-insert）
6. 评论提交后 status=PENDING，审核通过后显示

**验证**：
- [ ] 未登录看到"登录后可评论"提示
- [ ] 已评论用户看到"修改我的评论"而不是新增
- [ ] 评论通过审核后 toilet.cleanliness 自动重算

---

### T7.2 实现"一键确认可用"

**目标**：用户经过厕所时可一秒确认信息有效。

**步骤**：
1. 在 ToiletDetail 页面添加 `ConfirmButton`
2. 两个按钮：
   - "这里还能用 ✓"（绿色）
   - "这里不能用了"（红色，点击后要求填原因）
3. 同一用户对同一厕所 30 天内只能确认一次（前端 + 后端双重检查）
4. 确认后 toilet.lastConfirmedAt 更新
5. 3 次 "不能用" 确认在 7 天内 → 自动 status=HIDDEN + 通知管理员

**验证**：
- [ ] 连续点击被阻止
- [ ] 30 天后可再次确认
- [ ] "不能用"确认达到阈值后厕所自动隐藏

---

### T7.3 实现店家申诉

**目标**：店家可申诉下架自己店内的厕所标注。

**步骤**：
1. 创建 `/owner-dispute` 公开页面（无需登录）
2. 表单字段：
   - 申诉厕所的 URL 或位置
   - 申诉人姓名
   - 申诉人与店铺的关系
   - 联系邮箱（需验证）
   - 申诉原因（文本）
   - 证明文件上传（营业执照等）
3. 提交后发送邮件验证（类似 Magic Link）
4. 验证后进入 `/admin/disputes` 队列
5. 管理员处理：同意（厕所 status=HIDDEN）/ 驳回 / 要求补充材料

**验证**：
- [ ] 未验证邮箱的申诉不进入管理员视图
- [ ] 每 IP 每天最多 3 次申诉
- [ ] 审核决定通过邮件通知申诉人

---

## M8 · 多语言与机器翻译

### T8.1 集成 DeepL 翻译

**目标**：用户提交内容自动翻译成另两种语言。

**步骤**：
1. 注册 DeepL API（付费方案，支持中日英）
2. 创建 `src/lib/translation/deepl.ts`
3. 翻译时机：
   - 厕所提交时（名称、地址、建筑名、进入路径说明）
   - 评论提交时
4. 翻译结果缓存（相同文本 30 天内不重复调用）
5. 非原始语言版本前缀 `[MT]` 标记
6. 翻译失败时回退到 Claude Haiku 做翻译

**验证**：
- [ ] 中文提交自动生成日英版本
- [ ] 日文提交自动生成中英版本
- [ ] 缓存命中时不调用 API（监控日志）

---

### T8.2 完善界面文案

**目标**：所有用户可见的界面文案三语齐全。

**步骤**：
1. 扫描代码中所有硬编码文字，全部移到 messages JSON
2. 简体中文由项目发起人审校
3. 日文、英文可先用 Claude 翻译，后期人工审校
4. 使用 next-intl 的命名空间组织（如 `common`、`map`、`submit`、`admin`）

**验证**：
- [ ] 切换语言后所有可见文字正确切换
- [ ] 无硬编码字符串残留（可用正则扫描检查）

---

### T8.3 多语言内容展示逻辑

**目标**：在详情页正确展示多语言内容。

**步骤**：
1. 按用户当前 locale 优先展示对应语言
2. 如果该语言是 `[MT]` 机器翻译版本，显示小图标提示 + "查看原文"链接
3. 点击小图标显示原文弹窗
4. 长期计划：V1.0 支持用户提交人工译文校对

**验证**：
- [ ] 中文用户看到中文版本（机器翻译版本有 MT 标记）
- [ ] 查看原文功能正常
- [ ] 原始语言的用户看不到 MT 标记

---

## M9 · SEO、PWA、性能

### T9.1 实现 SEO 基础

**目标**：符合 PROJECT_SPEC §11 的 SEO 要求。

**步骤**：
1. 每个厕所详情页设置 `<title>`、`<meta description>`、Open Graph
2. 实现 `sitemap.ts`（动态生成）
3. 实现 `robots.ts`
4. 实现 JSON-LD 结构化数据（schema.org Place）
5. 多语言 hreflang 标签
6. Canonical URL

**验证**：
- [ ] `/sitemap.xml` 包含所有已发布厕所
- [ ] Google Rich Results Test 验证通过
- [ ] curl 首页和详情页能看到完整 HTML

---

### T9.2 实现动态 OG 图片

**目标**：每个厕所详情页的分享图片自动生成。

**步骤**：
1. 使用 Next.js `opengraph-image.tsx` 特性
2. 图片包含：厕所名 + 类型图标 + 地址 + 小地图截图
3. 字体嵌入 Noto Sans
4. 尺寸 1200×630

**验证**：
- [ ] 访问 `/t/[slug]/opengraph-image` 生成图片
- [ ] 分享到 Twitter/微信可正确预览
- [ ] 生成时间 < 2s

---

### T9.3 配置 PWA

**目标**：支持 PWA 安装与离线访问。

**步骤**：
1. 安装 `@serwist/next`
2. 配置 manifest.json（name、icons、theme_color、start_url）
3. 缓存策略按 PROJECT_SPEC §12.2
4. 实现"添加到主屏"提示（仅移动端首次访问 3 次后显示）
5. 离线页面（无网络时显示的 fallback）

**验证**：
- [ ] Chrome 开发工具 Application 面板检查 PWA 配置完整
- [ ] 移动端 Safari 可"添加到主屏"
- [ ] 离线时已查看的厕所可打开

---

## M10 · 部署与监控

### T10.1 配置 Vercel 部署

**目标**：生产环境可访问。

**步骤**：
1. Vercel 项目创建，绑定 GitHub 仓库
2. 配置 production、preview 两个环境
3. 环境变量配置（参考 PROJECT_SPEC §13.2）
4. 绑定自定义域名 `toirepo.app`（人工先购买域名）
5. 配置 DNS（A 记录 / CNAME）
6. 启用 HTTPS（Vercel 自动）

**验证**：
- [ ] https://toirepo.app 可访问
- [ ] HTTPS 证书正确
- [ ] 推送 main 分支自动部署

---

### T10.2 配置监控

**目标**：错误追踪、分析、可用性监控。

**步骤**：
1. 集成 Sentry（需项目 DSN）
2. 集成 PostHog（前端页面浏览、关键事件）
3. 配置 Uptime Robot 每 5 分钟探测
4. 配置 Sentry 告警规则（5 分钟内 10 个相同错误）

**验证**：
- [ ] 故意抛错后 Sentry 收到
- [ ] PostHog 看到页面浏览事件
- [ ] 可用性报告每天生成

---

### T10.3 配置数据库备份

**目标**：数据安全。

**步骤**：
1. Supabase 自动每日备份（默认 7 天保留）
2. 额外配置：每周手动导出 SQL dump 到 R2
3. 备份恢复演练文档

**验证**：
- [ ] 演练一次"删表 → 恢复"流程，10 分钟内完成

---

## M11 · OSM 导入与上线准备

### T11.1 实现 OSM 数据导入脚本

**目标**：一次性导入东京现有公共厕所数据。

**步骤**：
1. 创建 `scripts/import-osm-toilets.ts`
2. 使用 Overpass API 查询（PROJECT_SPEC §6.4）
3. 分类逻辑：
   - `amenity=toilets` + `access=yes/public` + `fee=no` → PUBLIC
   - 位于商场/百货 POI 多边形内 → MALL
   - 位于便利店 500m 内（名称匹配 7-Eleven / Family Mart / Lawson / Ministop）→ 暂不自动分类为 KONBINI，而是 PUBLIC（因便利店是否开放不一定），由人工补充
4. 导入的数据 source=OSM_IMPORT，status 直接 APPROVED（信任 OSM 社区数据）
5. 日志：导入 N 条，跳过 M 条（已存在）
6. 可重复执行（通过 osmId 去重）

**验证**：
- [ ] 东京 23 区导入 3000+ 条厕所数据
- [ ] 重复执行脚本无重复插入
- [ ] 地图上可见密集分布

---

### T11.2 上线前检查清单

**目标**：确保质量后再公开。

**检查项**：
- [ ] 所有环境变量已在生产配置
- [ ] 数据库备份已配置并演练
- [ ] 所有页面移动端测试通过（iPhone Safari、Android Chrome）
- [ ] 所有页面键盘导航可用（tab、enter、esc）
- [ ] 隐私政策、服务条款已人工撰写并发布
- [ ] Cookie 公告横幅显示并可接受/拒绝
- [ ] 所有邮件模板（注册验证、审核通知、拒绝通知、申诉通知）已测试
- [ ] Google OAuth 已配置生产回调 URL
- [ ] Sentry / PostHog / Uptime Robot 已接入
- [ ] 管理员账户已创建
- [ ] README.md 完整（运维手册）
- [ ] 性能：Lighthouse 所有页面 Performance ≥ 85，SEO ≥ 95
- [ ] 无控制台错误或警告（生产模式）
- [ ] 所有 console.log 已清理

---

## 后置：V1.0 任务（MVP 上线 3 个月后）

- 繁中界面支持
- 信任用户机制激活
- 多审核员角色
- 用户个人页扩展
- 收藏夹
- 路线分享
- OSM 贡献回流
- 暗色模式（深夜模式）

---

## 执行规范（Claude Code 注意事项）

### 任务内必做

1. 每个任务开始前，阅读 PROJECT_SPEC.md 相关章节
2. 任务完成后，运行验证清单并口头确认
3. 提交代码前运行 `pnpm lint && pnpm typecheck`
4. 大改动涉及数据库迁移的，先演练在本地执行
5. 涉及敏感 API Key 的任务，暂停等待人工提供

### 不得自行做的决定

1. 不得更换技术栈
2. 不得修改配色方案
3. 不得修改图标设计
4. 不得修改数据库 schema（除非发现 SPEC 错误并经过讨论）
5. 不得跳过 AI 预审层（即便调试麻烦）
6. 不得硬编码 API Key 或数据库密码

### 遇到模糊时

立即提问。宁可多问一次，也不要猜测。

---

**文档结束。**
