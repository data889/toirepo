# SPEC v1.1 变更说明（2026-04-18）

> 本文档原始版本为 v1.0。以下偏差已在实施过程中发生并被确认，视为 v1.1 的事实状态。
> 正文其余部分（§2 以后）内容有效，仅版本号与端口号需按此处理解。

## 变更点

1. **Next.js 版本**：v1.0 写 "Next.js 15"，实施时 `create-next-app` 默认拉到 **16.2.4**。
   决定：接受升级。Next.js 16 API 与 15 高度兼容，生态已跟进。后文 §3.1 表格请视为 16。

2. **Tailwind CSS 版本**：v1.0 写 "Tailwind v3"，实施时装到 **4.2.2**。
   决定：接受升级。配置方式从 `tailwind.config.ts` 迁移到 `globals.css` 里的
   `@theme` CSS 指令。T1.3 实施时需按 Tailwind v4 写法，不再生成 `tailwind.config.ts`。
   §4.2 配色表的 Hex 值不变，但落地位置改成 `@theme` 里的 CSS 变量声明。

3. **PostgreSQL 端口**：v1.0 默认 5432，因本机已有其他项目占用该端口，
   toirepo 本地开发统一改用 **5433**。`DATABASE_URL` 形如：
   `postgresql://toirepo:toirepo@localhost:5433/toirepo`。
   生产环境（Supabase）不受影响。

4. **Prisma 版本**：v1.0 写 "Prisma 5"，实施时 `pnpm add` 默认拉到 **7.7.0**。
   决定：接受升级。其余 API 对本项目 MVP 范围（无 middleware 使用）高度兼容。

   **更正（2026-04-19）**：此前 v1.1 文档写"v7 的 postgresqlExtensions 已稳定"
   不准确——该 feature 在 Prisma 7.x 仍为 preview。本项目不启用该 preview，
   改为在 init migration SQL 里显式 `CREATE EXTENSION IF NOT EXISTS postgis`
   管理扩展，schema `datasource` 块不含 `extensions` 字段。

   **Prisma 7 adapter-mandatory**：v7.0 起禁止在 `schema.prisma` 的 datasource 块
   里写 `url` / `directUrl`，连接由 `prisma.config.ts` 提供（且 CLI 需要
   `datasource.url` 做 shadow-db / schema diff），运行时 `PrismaClient`
   构造也需传 adapter。本项目使用 `@prisma/adapter-pg`（基于 `pg` 驱动）
   连接本地 Docker PostGIS 与生产 Supabase。SPEC §5.2 的 schema 内容不变，
   仅 datasource 语法层面调整。

5. **Zod 版本**：v1.0 写 "Zod 3"，实施时 `pnpm add` 默认拉到 **4.3.6**。
   决定：接受升级。v4 与本项目用到的 API 子集（`.parse`、`.safeParse`、
   `z.object`、`z.string`、`z.enum`、`z.nativeEnum`、`z.array`、`z.tuple`、
   `z.infer`）完全兼容；`z.record()` 签名改变将在写 schema 时由 TS
   显式提示，不构成隐藏风险。tRPC v11 原生兼容 Zod v4。

6. **地图库版本**：v1.0 指定 `maplibre-gl@^4` 和 `react-map-gl@^7`，
   实施时 `pnpm add` 默认拉到 **maplibre-gl 5.23.0** 和 **react-map-gl 8.1.1**。
   决定：接受升级。配套 TASK_BREAKDOWN T3.4 的 import 路径示例已同步修订
   （react-map-gl v8 移除了 `react-map-gl/maplibre` 子路径，改为通过
   `mapLib` prop 在运行时注入 maplibre-gl）。MapLibre v5 对本项目
   从零设计的 `toirepo-paper.json` 样式无实质影响。

7. **next-intl 版本**：v1.0 写 "next-intl 3"，实施时 `pnpm add` 默认拉到
   **4.9.1**。决定：接受升级。v4 官方适配 Next.js 16（v3 仅支持到 Next 15），
   这本身即是升级的硬理由。T1.4 的路径前缀策略（/zh-CN / /ja / /en，默认
   /zh-CN）在 v4 完全保留；实施 T1.4 时请按 **v4 App Router 教程**配置
   （`createNextIntlPlugin` + `createMiddleware` 新签名），不要参考 v3 教程。

8. **Prisma 7 对 Unsupported 非可选字段的限制**：SPEC §5.2 原把 `Toilet.location`
   写为 `Unsupported("geography(Point, 4326)")`（非可选）。Prisma 7 运行时会
   拒绝对含必填 Unsupported 字段的 model 执行 `db.model.create()`，
   即使该字段由 DB 触发器填充。决定：将 `location` 改为 optional
   （`Unsupported(...)?`）。DB 层仍是 NOT NULL + trigger，数据完整性不变；
   Prisma schema 层准确反映"应用不写此字段"的意图。SPEC §5.2 Toilet model
   定义已同步修订。这是 Prisma 社区 PostGIS 标准模式。

9. **Next.js 16 proxy 约定**：v1.0 使用 `src/middleware.ts`，Next.js 16 已将该
   文件约定重命名为 `src/proxy.ts`（middleware 路径仍兼容但发 deprecation
   警告）。T2.2 一并完成重命名 + 文档同步。另外，Proxy 文件默认运行在 Node.js
   runtime（旧 middleware 默认 edge），不再需要手工 `export const runtime = 'nodejs'`
   来让 Prisma 等 Node-only 依赖工作。

10. **地图 rail 视觉简化**：v1.0 §4.5 要求"地铁线路不用鲜艳色，统一用深海青
    `#2C6B8F` 单色细线"。T3.2 实施时发现 Protomaps basemaps v4 的
    `roads.kind=rail` 不区分地铁与国铁（需要查 `kind_detail` 子字段才能区分），
    MVP 阶段简化为所有 rail 统一用 `#C4A8A0` 赭红虚线（与 boundaries 同色，
    与草图示意稿一致）。§4.5 正文已同步修订。未来需要区分地铁/国铁时，重写
    `roads.kind=rail` 的 filter 为基于 `kind_detail in [subway, tram]` 的分层。

---
# toirepo.app · 项目规格文档

> **项目代号**：toirepo（トイレ + repository）
> **文档版本**：v1.0 · 2026-04-18
> **目标读者**：Claude Code（自动化实施）+ 项目发起人（审阅与修改）
> **实施策略**：本文档为"只读规格"。任何与本文档冲突的 Claude Code 推断都应以本文档为准；如发现歧义或缺失，Claude Code 应在执行前提问而非自行假设。

---

## 1. 项目愿景

### 1.1 一句话定义

一个专门标注"官方地图上没有但实际可用"的免费公共厕所的众包地图，从东京起步，面向全球扩展。

### 1.2 核心差异化价值

现有地图（Google Maps、Apple Maps、Yahoo! Japan 地图）的厕所信息存在三类盲区：
1. **商业建筑内的免费厕所**：商场、百货店、大型书店、咖啡店等建筑内可自由使用但未被标注
2. **进入路径**：即使标注了位置，也不告诉你"从哪个门进、坐哪部电梯、几楼、需不需要告诉店员"
3. **实时有效性**：标注的厕所可能已关闭、改造、改为仅住客使用

toirepo 的核心价值就是填补这三类盲区，通过众包 + 审核的方式建立起"在地人才知道"的知识库。

### 1.3 非目标（明确不做什么）

- 不做导航（与 Google Maps 不竞争，用户找到厕所后可一键跳转到 Google/Apple Maps 导航）
- 不做付费厕所指引
- 不做住客专用、会员专用厕所
- 不做收费内容（至少 MVP 阶段不考虑变现）
- 不做社交功能（不关注用户、不私信、不排行榜）

---

## 2. 功能范围与分阶段

### 2.1 MVP（第一版，面向东京）

必须具备的最小可用功能集：

- 交互式地图，展示已审核的厕所（4 种类型图标）
- 厕所详情查看（基础信息 + 照片 + 评论 + 最近确认时间）
- 用户注册登录（邮箱 + Google OAuth）
- 注册用户可提交新厕所（带照片）
- 注册用户可为现有厕所上传照片、发表评论、一键"确认仍可用"
- 管理员审核队列（单一管理员角色，但 schema 预留多角色字段）
- AI 预审层：Claude Haiku 多模态预筛违规图片
- OSM 数据一次性导入（东京 23 区现有厕所）
- 三语界面（简中主界面 + 日 + 英）
- 机器翻译：提交内容自动生成三语版本并标注"机器翻译"
- 每个厕所独立 URL 页面（SEO 友好）
- PWA 支持（离线查看已加载区域、可加到主屏）
- 筛选器（见 §5.6）
- 店家申诉下架通道
- 隐私政策、服务条款、Cookie 公告（GDPR + 日本个人信息保护法 + 中国个保法三地合规）

### 2.2 V1.0（东京稳定运营 3 个月后）

- 繁中界面扩展
- 信任用户机制激活（阈值可配置，默认 10 次通过审核后晋升）
- 多审核员角色系统激活（管理员 / 高级审核员 / 普通审核员）
- 用户个人页面（我提交的厕所、我的评论、我的贡献数）
- 收藏夹（保存常用厕所）
- 路线分享（选择几个厕所生成一个可分享链接）
- 数据导出（OSM 贡献回流：对 OSM 现有位置的纠错自动推送到 OSM）

### 2.3 V2.0（全球扩展）

- 多城市支持架构（区域路由 /tokyo/ /osaka/ /taipei/ /bangkok/）
- LINE OAuth 接入
- Apple OAuth 接入
- 原生 App（React Native 或 Flutter）
- 多语言扩展：韩语、泰语、粤语等

---

## 3. 技术栈

### 3.1 选型总览

| 层 | 技术 | 选型理由 |
|---|---|---|
| 前端框架 | Next.js 15 (App Router) + TypeScript | SSR 对 SEO 关键；App Router 对国际化路由友好 |
| UI 组件 | Tailwind CSS + shadcn/ui | 最主流、Claude Code 最熟悉 |
| 地图引擎 | MapLibre GL JS | 完全开源、矢量渲染、无调用限制 |
| 地图底图 | 自托管 OSM 矢量瓦片（Planetiler 生成 + pmtiles 托管） | 无厂商锁定、可完全自定义样式 |
| 地理编码 | Nominatim（自托管）+ Mapbox Geocoding API（备选） | OSM 生态友好 |
| 后端 | Next.js API Routes + tRPC | 类型安全、前后端一体 |
| 数据库 | PostgreSQL 16 + PostGIS | 空间查询必需 |
| ORM | Prisma | 类型安全、迁移友好 |
| 认证 | Auth.js v5（原 NextAuth） | 社区活跃、支持多 provider |
| 图片存储 | Cloudflare R2 | 零出口流量费，比 S3 便宜 90% |
| 图片处理 | sharp + Cloudflare Images | EXIF 剥离、压缩、多尺寸 |
| AI 预审 | Anthropic Claude Haiku 4.5 | 多模态、成本低、中日英都擅长 |
| 机器翻译 | DeepL API（主）+ Claude Haiku（备） | DeepL 中日英质量最高 |
| 邮件 | Resend | 开发者友好、免费额度够用 |
| 部署 | Vercel（前端） + Supabase（PostgreSQL + PostGIS + 认证 + 存储） | 减少运维负担，一站式 |
| 监控 | Sentry（错误） + PostHog（产品分析） | 免费额度够 MVP |
| i18n | next-intl | App Router 原生支持 |
| 表单 | react-hook-form + zod | 业界标准 |
| CI/CD | GitHub Actions + Vercel 自动部署 | 零配置 |

### 3.2 开发环境要求

- Node.js 20 LTS 或以上
- pnpm（包管理器，比 npm/yarn 快）
- Docker（本地跑 PostgreSQL + PostGIS）
- PostgreSQL 16 with PostGIS 3.4 extension

### 3.3 推荐的本地开发启动方式

```bash
# 1. 克隆仓库后
pnpm install

# 2. 启动本地 PostgreSQL + PostGIS
docker compose up -d

# 3. 运行数据库迁移
pnpm prisma migrate dev

# 4. 导入东京 OSM 厕所数据
pnpm tsx scripts/import-osm-toilets.ts --city=tokyo

# 5. 启动开发服务器
pnpm dev
```

---

## 4. 视觉设计规范

### 4.1 设计理念

**"一张纸的地图"**——极简、手绘感、东京本地气质。地图本身退到背景，厕所图标是整个界面唯一有彩色的元素。

### 4.2 配色

#### 地图底图色板

| 用途 | Hex | 备注 |
|---|---|---|
| 主背景（纸色） | `#FDFCF9` | 接近纯白，带一丝暖黄 |
| 街道（主干） | `#B8B4A8` | 暖灰褐 |
| 街道（次要） | `#D8D4C8` | 浅暖灰 |
| 水域 | `#E8E4D8` | 比底色稍深的米色（不用蓝） |
| 铁路 | `#C4A8A0` 虚线 | 淡砖红虚线 |
| 文字标注 | `#8A8578` | 中性暖灰 |
| 绿地/公园 | `#E8EBE0` | 极淡的苔绿 |

#### 厕所图标色板

| 类型 | 形状 | Hex | 中文 | 日文 | English |
|---|---|---|---|---|---|
| 纯公共厕所 | 圆形 `P` | `#D4573A`（朱砂红） | 公共 | 公衆 | Public |
| 商场/百货内免费 | 方形圆角 `M` | `#2C6B8F`（深海青） | 商场 | 商業施設 | Mall |
| 便利店免费 | 三角 `C` | `#5C8A3A`（苔绿） | 便利店 | コンビニ | Konbini |
| 需消费（咖啡店/餐厅） | 五边形 `¥` | `#B8860B`（赭金） | 需消费 | 要利用 | Purchase |

选择逻辑：这四色来自日式陶器釉色（朱砂/青花/苔绿/赭石金），互相之间色相区分度高但饱和度控制在中等，与纸色底图协调。

#### UI 控件色板

| 用途 | Hex |
|---|---|
| 主文字 | `#2C2C2A` |
| 次要文字 | `#5F5E5A` |
| 辅助文字 | `#888780` |
| 边框 | `#E0DCD0` |
| 按钮主色 | `#2C2C2A`（近黑） |
| 按钮文字 | `#FDFCF9` |
| 链接色 | `#2C6B8F`（与商场图标同色） |
| 错误红 | `#C5432A` |
| 成功绿 | `#4A7A2C` |

### 4.3 字体

- 中日英衣架字体：`"PingFang SC", "Hiragino Sans", "Noto Sans JP", "Noto Sans SC", system-ui, sans-serif`
- 数字与品牌字：`"Inter", system-ui, sans-serif`
- 不使用衬线体（日本地图传统风格偏几何感）

### 4.4 图标设计规范

- 大小：32×32 CSS 像素（Retina 2x 导出 64×64 PNG 与 SVG）
- 白色外描边：宽度 2.5px，保证在任何底图色上可见
- 中心字母：使用等宽 Inter Medium，字号等于图标宽度的 0.4
- 聚簇显示（zoom out 时）：同类型合并为一个大圆，显示数字
- 不同类型混合聚簇：显示为灰色圆圈带数字

### 4.5 示例引用

具体视觉效果参见项目启动时与用户的 Claude 对话（2026-04-18）中生成的示意稿。关键原则：
- 底图几乎不显眼，线条带轻微"手绘不完美"感（可通过 MapLibre 样式的 line-opacity 和 line-offset 实现）
- 水域不用蓝色（重要！这是去 Google Maps 化的关键之一）
- 铁路（含地铁与国铁）统一用 `#C4A8A0` 赭红虚线，不区分类型、不用彩色（v1.1 #10）
- 公园用极淡苔绿填充，不标注具体树木

### 4.6 暗色模式

**MVP 不做暗色模式**。理由：纸质感白底是品牌核心，暗色模式会破坏统一性。V1.0 阶段再考虑做"深夜模式"（深灰棕底 + 暖色图标）。

---

## 5. 数据模型

### 5.1 厕所类型枚举

```typescript
enum ToiletType {
  PUBLIC = 'PUBLIC',           // 纯公共厕所（公园、市政）
  MALL = 'MALL',               // 商场/百货内免费
  KONBINI = 'KONBINI',         // 便利店免费
  PURCHASE = 'PURCHASE',       // 需消费（咖啡店、餐厅）
}
```

### 5.2 核心数据库 Schema（PostgreSQL + PostGIS）

以下为 Prisma schema 语法（转换为 PostgreSQL DDL 时 Prisma 会自动处理）。

```prisma
// prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
  extensions = [postgis]
}

// ============================================================
// 用户与认证
// ============================================================

model User {
  id            String   @id @default(cuid())
  email         String   @unique
  emailVerified DateTime?
  name          String?
  image         String?
  locale        String   @default("zh-CN") // zh-CN / ja / en
  role          UserRole @default(USER)    // schema 预留，MVP 阶段仅使用 USER 和 ADMIN

  // 信任机制（V1.0 激活，MVP 阶段只记录不使用）
  trustLevel        Int      @default(0)  // 0=新用户 / 1=信任用户 / 2=高级信任
  approvedSubmissions Int    @default(0)  // 累计通过审核的提交数
  rejectedSubmissions Int    @default(0)  // 累计被拒的提交数

  // 禁用状态
  bannedAt      DateTime?
  banReason     String?

  accounts      Account[]
  sessions      Session[]
  toilets       Toilet[]         @relation("SubmittedBy")
  photos        Photo[]
  reviews       Review[]
  confirmations Confirmation[]

  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
}

enum UserRole {
  USER                // 普通注册用户
  TRUSTED_USER        // 信任用户（V1.0 激活）
  MODERATOR           // 普通审核员（V1.0 激活）
  SENIOR_MODERATOR    // 高级审核员（V1.0 激活）
  ADMIN               // 管理员（MVP 阶段使用）
}

// Auth.js 标准表（省略 Account、Session、VerificationToken 详细定义）

// ============================================================
// 厕所核心实体
// ============================================================

model Toilet {
  id          String      @id @default(cuid())
  slug        String      @unique // 用于 SEO-friendly URL，如 shibuya-starbucks-q-front-3f

  // 地理信息
  location    Unsupported("geography(Point, 4326)")? // PostGIS 字段；schema 层 optional，DB 层 NOT NULL + trigger。见 v1.1 #8
  latitude    Float       // 冗余存储，便于 API 响应
  longitude   Float

  // 分类
  type        ToiletType

  // 多语言名称（JSON 存储）
  name        Json        // { "zh-CN": "涩谷星巴克 Q-Front 店", "ja": "スターバックスQフロント店", "en": "Starbucks Shibuya Q-Front" }

  // 地址与建筑信息
  address     Json        // { "zh-CN": "...", "ja": "...", "en": "..." }
  building    Json?       // 建筑名称 { "zh-CN": "Q-Front", ... }
  floor       String?     // "3F" / "B1" / "屋顶"

  // 东京特色字段
  stationGateSide StationGateSide? // 改札内/外（仅车站类厕所）

  // 属性标签
  isFree      Boolean     @default(true)
  requiresPurchase Boolean @default(false) // 需要消费
  requiresKey Boolean     @default(false)  // 需要索取钥匙
  is24Hours   Boolean     @default(false)

  // 设施
  hasAccessible Boolean   @default(false)  // 无障碍
  hasBabyChanging Boolean @default(false)  // 婴儿护理台
  hasKidsToilet Boolean   @default(false)  // 儿童马桶
  hasWashlet  Boolean     @default(false)  // 免治马桶
  hasGenderNeutral Boolean @default(false) // 无性别卫生间
  hasFamilyRoom Boolean   @default(false)  // 家庭卫生间

  // 隔间数量（粗略）
  stallCount  StallCount? // SMALL (1-2) / MEDIUM (3-5) / LARGE (6+)

  // 开放时间
  openingHours Json?      // 结构化存储，形如 { "mon": ["10:00-22:00"], ... } 或 { "alwaysOpen": true }

  // 进入路径说明（核心差异化价值！）
  accessNote  Json?       // { "zh-CN": "二楼，从右侧楼梯上去", "ja": "...", "en": "..." }

  // 数据来源
  source      ToiletSource  @default(USER_SUBMISSION)
  osmId       String?       @unique // OSM node/way ID，用于去重与数据回流
  submittedById String?
  submittedBy User?         @relation("SubmittedBy", fields: [submittedById], references: [id])

  // 审核状态
  status      ToiletStatus  @default(PENDING)
  publishedAt DateTime?

  // 统计
  cleanliness Float?        // 1-5 星平均值（冗余，从 reviews 计算）
  reviewCount Int           @default(0)
  photoCount  Int           @default(0)
  lastConfirmedAt DateTime? // 最近一次"确认仍可用"时间

  // 关联
  photos        Photo[]
  reviews       Review[]
  confirmations Confirmation[]
  auditLogs     AuditLog[]
  disputes      OwnerDispute[]

  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  // 索引
  @@index([type, status])
  @@index([status, publishedAt])
  @@index([osmId])
  // PostGIS 空间索引需要在 migration 中手动添加：
  // CREATE INDEX toilet_location_idx ON "Toilet" USING GIST (location);
}

enum ToiletStatus {
  PENDING      // 待审核
  APPROVED     // 已发布
  REJECTED     // 已拒绝
  HIDDEN       // 已隐藏（店家申诉、违规举报）
  ARCHIVED     // 已归档（永久关闭的厕所）
}

enum ToiletSource {
  OSM_IMPORT        // OSM 数据导入
  USER_SUBMISSION   // 用户提交
  ADMIN_CREATED     // 管理员创建
}

enum StationGateSide {
  INSIDE     // 改札内（需要车票）
  OUTSIDE    // 改札外（免费进入）
  BOTH       // 内外都有
}

enum StallCount {
  SMALL      // 1-2
  MEDIUM     // 3-5
  LARGE      // 6+
}

// ============================================================
// 照片
// ============================================================

model Photo {
  id        String      @id @default(cuid())
  toiletId  String
  toilet    Toilet      @relation(fields: [toiletId], references: [id], onDelete: Cascade)
  userId    String
  user      User        @relation(fields: [userId], references: [id])

  // 存储
  url       String      // R2 bucket URL
  thumbnailUrl String   // 缩略图 URL
  width     Int
  height    Int
  sizeBytes Int

  // 分类
  category  PhotoCategory @default(ENTRANCE) // 入口/指示牌/内部远景

  // 审核
  status    PhotoStatus @default(PENDING)
  aiPrescreenResult Json?  // AI 预审结果 { flagged: boolean, reasons: string[] }
  rejectedReason    String?

  createdAt DateTime @default(now())

  @@index([toiletId, status])
}

enum PhotoCategory {
  ENTRANCE      // 入口（推荐）
  SIGNAGE       // 指示牌
  EXTERIOR      // 隔间外观
  BUILDING      // 建筑外景（指示用）
}

enum PhotoStatus {
  PENDING
  APPROVED
  REJECTED
}

// ============================================================
// 评论
// ============================================================

model Review {
  id        String      @id @default(cuid())
  toiletId  String
  toilet    Toilet      @relation(fields: [toiletId], references: [id], onDelete: Cascade)
  userId    String
  user      User        @relation(fields: [userId], references: [id])

  cleanliness Int       // 1-5
  comment   Json?       // 多语言 { "zh-CN": "...", "ja": "(machine translated)...", "en": "(machine translated)..." }
  originalLocale String // 用户提交时的原始语言

  status    ReviewStatus @default(PENDING)
  rejectedReason String?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([toiletId, status])
  @@unique([toiletId, userId]) // 每个用户对每个厕所只能有一条评论
}

enum ReviewStatus {
  PENDING
  APPROVED
  REJECTED
}

// ============================================================
// 确认（"这里还能用"一键确认）
// ============================================================

model Confirmation {
  id        String   @id @default(cuid())
  toiletId  String
  toilet    Toilet   @relation(fields: [toiletId], references: [id], onDelete: Cascade)
  userId    String
  user      User     @relation(fields: [userId], references: [id])
  stillAvailable Boolean // true = 仍可用，false = 已不可用（触发重新审核）
  note      String?  // 可选备注

  createdAt DateTime @default(now())

  @@index([toiletId])
  @@index([userId, createdAt])
  // 同一用户对同一厕所 30 天内只能确认一次（在应用层实现）
}

// ============================================================
// 店家申诉
// ============================================================

model OwnerDispute {
  id         String   @id @default(cuid())
  toiletId   String
  toilet     Toilet   @relation(fields: [toiletId], references: [id])

  claimerEmail  String
  claimerName   String
  claimerRole   String  // "店主"、"经理"、"品牌代表" 等
  reason        String  @db.Text
  evidenceUrls  String[] // 证明文件 URL（营业执照等）

  status        DisputeStatus @default(PENDING)
  resolvedAt    DateTime?
  resolvedNote  String?

  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt
}

enum DisputeStatus {
  PENDING
  APPROVED      // 同意下架
  REJECTED      // 驳回申诉
  NEEDS_INFO    // 需要更多证据
}

// ============================================================
// 审计日志
// ============================================================

model AuditLog {
  id        String   @id @default(cuid())
  toiletId  String?
  toilet    Toilet?  @relation(fields: [toiletId], references: [id])
  actorId   String?  // 可以为 null（系统操作）
  action    String   // "CREATED", "APPROVED", "REJECTED", "HIDDEN", "OWNER_DISPUTE_APPROVED" 等
  metadata  Json?

  createdAt DateTime @default(now())

  @@index([toiletId])
  @@index([actorId])
}
```

### 5.3 PostGIS 空间索引与查询

在 Prisma migration 完成后，手动添加空间索引：

```sql
-- migrations/xxxx_add_spatial_index.sql
CREATE INDEX IF NOT EXISTS toilet_location_idx ON "Toilet" USING GIST (location);

-- 触发器：当 latitude/longitude 更新时自动更新 location 字段
CREATE OR REPLACE FUNCTION update_toilet_location()
RETURNS TRIGGER AS $$
BEGIN
  NEW.location = ST_SetSRID(ST_MakePoint(NEW.longitude, NEW.latitude), 4326)::geography;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER toilet_location_trigger
BEFORE INSERT OR UPDATE OF latitude, longitude ON "Toilet"
FOR EACH ROW EXECUTE FUNCTION update_toilet_location();
```

常用空间查询示例：

```sql
-- 查找以给定点为中心 500m 范围内的已发布厕所
SELECT * FROM "Toilet"
WHERE status = 'APPROVED'
  AND ST_DWithin(
    location,
    ST_SetSRID(ST_MakePoint($longitude, $latitude), 4326)::geography,
    500  -- 米
  )
ORDER BY ST_Distance(
  location,
  ST_SetSRID(ST_MakePoint($longitude, $latitude), 4326)::geography
);

-- 查找地图 viewport 内的厕所（给定 bounding box）
SELECT * FROM "Toilet"
WHERE status = 'APPROVED'
  AND ST_Within(
    location::geometry,
    ST_MakeEnvelope($minLng, $minLat, $maxLng, $maxLat, 4326)
  )
LIMIT 500;
```

### 5.4 Slug 生成规则

用于 SEO-friendly URL。格式：`{区名}-{建筑或店名}-{楼层}`，全部小写，空格变连字符，去掉特殊字符。

示例：
- `shibuya-starbucks-q-front-3f`
- `shinjuku-isetan-main-building-b1`
- `chiyoda-tokyo-station-yaesu-exit`

Slug 冲突时后缀加数字：`shibuya-starbucks-2`。

---

## 6. API 设计

### 6.1 架构

使用 tRPC 替代传统 REST，获得类型安全的前后端接口。所有端点挂在 `/api/trpc/[trpc]` 下。

### 6.2 主要 Procedure 清单

```typescript
// src/server/api/routers/toilet.ts
toiletRouter = {
  // 公开查询（游客可访问）
  list: publicProcedure
    .input(z.object({
      bbox: z.tuple([z.number(), z.number(), z.number(), z.number()]).optional(), // [minLng, minLat, maxLng, maxLat]
      center: z.tuple([z.number(), z.number()]).optional(),
      radius: z.number().optional(), // 米
      types: z.array(z.nativeEnum(ToiletType)).optional(),
      filters: z.object({
        hasAccessible: z.boolean().optional(),
        hasBabyChanging: z.boolean().optional(),
        hasWashlet: z.boolean().optional(),
        is24Hours: z.boolean().optional(),
        minCleanliness: z.number().min(1).max(5).optional(),
        confirmedWithinDays: z.number().optional(),
        stationGateSide: z.nativeEnum(StationGateSide).optional(),
      }).optional(),
      limit: z.number().max(500).default(200),
    }))
    .query(...),

  getBySlug: publicProcedure
    .input(z.object({ slug: z.string() }))
    .query(...),

  // 认证用户
  submit: protectedProcedure
    .input(toiletSubmitSchema)
    .mutation(...),

  confirmStillAvailable: protectedProcedure
    .input(z.object({ toiletId: z.string(), stillAvailable: z.boolean(), note: z.string().optional() }))
    .mutation(...),

  // 店家申诉（无需登录，邮箱验证）
  submitOwnerDispute: publicProcedure
    .input(ownerDisputeSchema)
    .mutation(...),
};

// src/server/api/routers/photo.ts
photoRouter = {
  upload: protectedProcedure
    .input(z.object({
      toiletId: z.string(),
      file: z.instanceof(File),
      category: z.nativeEnum(PhotoCategory),
    }))
    .mutation(...),
  // 上传流程：
  // 1. 前端压缩图片到 max 2048px 长边
  // 2. 剥离 EXIF GPS 数据（client-side with exifr 库）
  // 3. 上传到 R2，存入 Photo 表 status=PENDING
  // 4. 异步触发 AI 预审（Inngest 或 Vercel Cron）
  // 5. 预审通过进入人工审核队列，预审未通过自动 REJECTED
};

// src/server/api/routers/review.ts
reviewRouter = {
  submit: protectedProcedure.input(reviewSchema).mutation(...),
};

// src/server/api/routers/admin.ts
adminRouter = {
  pendingQueue: adminProcedure.query(...),
  approve: adminProcedure.input(z.object({ entityType: z.enum(['toilet', 'photo', 'review']), id: z.string() })).mutation(...),
  reject: adminProcedure.input(z.object({ entityType: z.enum(['toilet', 'photo', 'review']), id: z.string(), reason: z.string() })).mutation(...),
  // 后台厕所合并（处理用户重复提交同一厕所的情况）
  mergeToilets: adminProcedure.input(z.object({ primaryId: z.string(), duplicateIds: z.array(z.string()) })).mutation(...),
  // 处理店家申诉
  resolveOwnerDispute: adminProcedure.input(z.object({ disputeId: z.string(), action: z.enum(['approve', 'reject', 'needs_info']), note: z.string() })).mutation(...),
};
```

### 6.3 速率限制

使用 Upstash Redis 实现：

| 操作 | 限制 |
|---|---|
| 厕所提交 | 5 次/小时/用户，20 次/天/用户 |
| 照片上传 | 20 张/小时/用户 |
| 评论 | 10 次/小时/用户 |
| 一键确认 | 100 次/天/用户（方便有使命感的用户批量确认） |
| 登录尝试 | 5 次/15 分钟/IP |
| 店家申诉 | 3 次/天/IP（防止骚扰） |

### 6.4 OSM 数据导入脚本

```bash
# scripts/import-osm-toilets.ts
# 使用 Overpass API 拉取指定区域的厕所
# 查询语句：
# [out:json][timeout:60];
# area["name"="東京都"]->.searchArea;
# (
#   node["amenity"="toilets"](area.searchArea);
#   way["amenity"="toilets"](area.searchArea);
# );
# out center;
```

导入时的去重与分类逻辑：
- OSM tag `amenity=toilets` + `access=yes` + `fee=no` → `PUBLIC`
- OSM tag `amenity=toilets` + 位于商场 POI 内 → `MALL`
- OSM tag `amenity=toilets` + 位于便利店 POI 内 → `KONBINI`
- 每个 OSM 节点用 `osmId` 字段去重，重复导入时只更新不新增

---

## 7. 审核工作流

### 7.1 状态机

```
用户提交 ─→ [AI 预审]
              │
              ├─ 通过 ─→ PENDING ─→ [人工审核]
              │                      │
              │                      ├─ 通过 ─→ APPROVED（发布）
              │                      │           │
              │                      │           ├─ [用户标记不可用] ─→ RE_REVIEW ─→ HIDDEN 或保持 APPROVED
              │                      │           └─ [店家申诉通过] ─→ HIDDEN
              │                      │
              │                      └─ 拒绝 ─→ REJECTED
              │
              └─ 不通过 ─→ 自动 REJECTED + 通知用户（仅图片）
```

### 7.2 AI 预审规则（Claude Haiku 多模态）

预审 prompt 模板（储存在 `src/lib/moderation/prompts.ts`）：

```
你是一个图片内容审核员。请判断以下图片是否可以发布在一个厕所地图网站上。

允许的内容：
- 厕所门口、入口、指示牌
- 建筑外观、楼层指示
- 洗手台、隔间外观（远景）
- 无性别/无障碍/家庭卫生间的指示牌

禁止的内容：
- 马桶/小便池的正面特写照（隐私）
- 任何可识别的人物（人脸、背影近景）
- 裸露、性暗示内容
- 暴力、血腥、恶心内容
- 与厕所无关的内容（食物、风景、广告等）
- 水印、商业 logo 为主体的照片

请以 JSON 返回：
{ "allowed": true/false, "reasons": [...], "confidence": 0.0-1.0 }

如 confidence < 0.7，则一律返回 allowed=false 进入人工审核。
```

对厕所文字描述的预审 prompt：

```
判断这段厕所描述是否违规：
- 是否包含人身攻击、辱骂
- 是否包含政治敏感内容
- 是否包含不实信息（"100% 好用"这种广告式表述）
- 是否包含隐私信息（人名、电话号码）

返回 JSON: { "allowed": true/false, "reasons": [...] }
```

### 7.3 人工审核界面要求

管理员后台 `/admin/queue` 页面：

- 左侧：待审核队列列表（可按类型筛选：厕所/照片/评论/申诉）
- 右侧：当前审核项详情
  - 厕所提交：地图预览 + 所有字段 + AI 预审结果 + 同位置 100m 内已有厕所列表（防重复）
  - 照片：大图预览 + AI 预审结果 + EXIF 数据（应为空）+ 上传者信用记录
  - 评论：评论原文 + 机器翻译版本 + AI 预审结果
- 快捷键：A = 通过，R = 拒绝（弹出原因输入），M = 合并到已有厕所，S = 跳过

### 7.4 一键确认机制

- 仅登录用户可用
- 同一用户对同一厕所 30 天内只能确认一次
- 如果连续 3 个不同用户 7 天内标记"不可用"，该厕所自动转入 `HIDDEN` 并通知管理员
- 超过 180 天无人确认的厕所在详情页显示"信息可能过时"提示

---

## 8. 多语言与翻译

### 8.1 界面文案

使用 `next-intl` 管理。文件结构：

```
messages/
  zh-CN.json
  ja.json
  en.json
```

URL 策略：使用路径前缀 `/zh-CN/`、`/ja/`、`/en/`，默认 `/zh-CN/`。

### 8.2 用户生成内容（UGC）翻译

用户提交内容时：
1. 前端检测或让用户选择提交语言
2. 后端调用 DeepL API 翻译成另两种语言
3. 存储为 JSON：`{ "zh-CN": "...", "ja": "[MT] ...", "en": "[MT] ..." }`
4. 非原始语言的版本带前缀 `[MT]`（machine translation），前端渲染时显示小图标提示

校对机制（V1.0）：其他用户可对机器翻译版本提交人工译文，由审核员批准后替换。

### 8.3 DeepL 使用量优化

- 缓存翻译结果 30 天
- 同一地址、同一建筑名的翻译只调用一次 API
- 月度预算监控告警

---

## 9. 页面路由与组件结构

### 9.1 路由

```
/                              → 重定向到用户首选语言
/[locale]/                     → 首页（东京地图）
/[locale]/t/[slug]             → 厕所详情页（SEO 目标）
/[locale]/submit               → 提交新厕所
/[locale]/about                → 关于
/[locale]/privacy              → 隐私政策
/[locale]/terms                → 服务条款
/[locale]/owner-dispute        → 店家申诉入口
/[locale]/auth/signin          → 登录
/[locale]/auth/signup          → 注册
/[locale]/me                   → 用户个人页（V1.0）
/[locale]/me/contributions     → 我的贡献（V1.0）

/admin                         → 管理员后台（需 ADMIN 角色）
/admin/queue                   → 审核队列
/admin/toilets                 → 所有厕所管理
/admin/users                   → 用户管理
/admin/disputes                → 店家申诉处理
/admin/stats                   → 统计看板
```

### 9.2 关键组件清单

```
src/components/
├── map/
│   ├── MapCanvas.tsx              # MapLibre 地图主画布
│   ├── MapStyleLoader.ts          # 加载自定义纸质样式
│   ├── ToiletMarker.tsx           # 厕所图标（4 种形状）
│   ├── ToiletClusterMarker.tsx    # 聚合标记
│   ├── UserLocationMarker.tsx     # 用户当前位置
│   ├── SearchBar.tsx              # 地址搜索
│   └── FilterPanel.tsx            # 筛选器
├── toilet/
│   ├── ToiletCard.tsx             # 卡片（地图弹出框用）
│   ├── ToiletDetail.tsx           # 详情页主组件
│   ├── ToiletBadges.tsx           # 属性徽章
│   ├── ToiletAccessNote.tsx       # 进入路径说明
│   ├── ConfirmButton.tsx          # 一键确认可用
│   ├── PhotoGallery.tsx           # 照片画廊
│   └── ReviewList.tsx             # 评论列表
├── submit/
│   ├── SubmitForm.tsx             # 主表单
│   ├── LocationPicker.tsx         # 位置选点（地图点击）
│   ├── PhotoUploader.tsx          # 照片上传（含 EXIF 剥离）
│   └── AttributeSelector.tsx      # 属性多选
├── admin/
│   ├── QueueItem.tsx              # 审核队列项
│   ├── ApprovalPanel.tsx          # 审核操作面板
│   └── NearbyToilets.tsx          # 附近已有厕所（防重复）
├── ui/ (shadcn/ui 生成的组件)
└── layout/
    ├── Header.tsx
    ├── Footer.tsx
    └── LocaleSwitcher.tsx
```

---

## 10. 合规与隐私

### 10.1 三地法律覆盖

| 地区 | 法律 | 关键要求 |
|---|---|---|
| 欧盟 | GDPR | Cookie 横幅、数据删除权、数据下载权 |
| 日本 | 个人情報保護法 | 用户同意、安全保管措施 |
| 中国 | 个人信息保护法 | 敏感信息单独同意、跨境传输声明 |

### 10.2 实施要点

- 首次访问：Cookie 公告横幅（仅必要 cookie 默认开启，分析 cookie 需明确同意）
- 用户注册：隐私政策勾选框，必须主动勾选
- 个人中心：提供"下载我的数据"和"删除账户"功能
- 图片上传：客户端剥离 EXIF GPS 数据（用 `exifr` 库）
- 位置权限：使用浏览器标准 `navigator.geolocation`，拒绝时不影响使用
- 数据保留：用户注销后，其提交的厕所数据匿名化保留（匿名化用户字段置为 null），照片保留但显示"已注销用户"
- 跨境传输声明：在隐私政策中明确数据存储位置与跨境情况（AWS/Cloudflare 区域）

### 10.3 OSM 数据协议

- OSM 数据遵循 ODbL v1.0 协议
- 用户贡献数据使用 CC-BY-SA 4.0 协议（在服务条款中明确）
- 网站页脚始终展示："Base map data © OpenStreetMap contributors"
- 数据下载接口提供 OSM 格式导出，遵守"Share-Alike"条款

---

## 11. SEO 策略

### 11.1 目标关键词

- 中文：`涩谷 公共厕所`、`东京 免费 厕所`、`新宿 婴儿护理台 厕所` 等
- 日文：`渋谷 トイレ 無料`、`東京駅 おむつ交換台` 等
- 英文：`free toilet Shibuya`、`Tokyo accessible restroom` 等

### 11.2 技术实施

- 所有厕所详情页 SSR 渲染，服务端生成完整 HTML
- `<title>`：`{厕所名} · {区名} · toirepo`
- `<meta description>`：进入路径说明的前 150 字
- Open Graph 图：自动生成（厕所图标 + 名称 + 底图截图）
- `sitemap.xml`：包含所有已发布厕所的 URL，每日更新
- `robots.txt`：允许所有（但禁止爬 `/admin`、`/api` 路径）
- 结构化数据（JSON-LD）：使用 schema.org `Place` 类型
- Canonical URL：多语言页面互相指向对方的 `hreflang`

### 11.3 分享优化

- 每个厕所页面提供"复制链接"按钮（复制形如 `https://toirepo.app/zh-CN/t/shibuya-starbucks-q-front-3f`）
- 分享时附带 OG 图片（服务端动态生成）

---

## 12. PWA 配置

### 12.1 能力

- 可安装到手机主屏
- 离线时可查看已加载区域地图（瓦片缓存）
- 离线时可查看最近访问过的厕所详情
- 后台同步（提交的厕所在离线时暂存，网络恢复后上传）

### 12.2 实施

- 使用 `@serwist/next`（Serwist 是 Workbox 的现代替代）
- 缓存策略：
  - 静态资源：Cache First
  - API 查询：Stale While Revalidate
  - 地图瓦片：Cache First + 7 天过期
  - 照片：Cache First + LRU（最多 100 张）
- Manifest 图标：512×512 + 192×192 PNG，maskable

---

## 13. 部署与运维

### 13.1 环境

| 环境 | 域名 | 数据库 |
|---|---|---|
| 开发 | localhost:3000 | 本地 Docker |
| 预览 | preview.toirepo.app | Supabase 预览分支 |
| 生产 | toirepo.app | Supabase 生产 |

### 13.2 环境变量（.env.example）

```bash
# 数据库
DATABASE_URL="postgresql://..."
DIRECT_URL="postgresql://..."

# 认证
AUTH_SECRET="openssl rand -hex 32"
AUTH_GOOGLE_ID="..."
AUTH_GOOGLE_SECRET="..."
AUTH_URL="https://toirepo.app"

# 存储
R2_ACCOUNT_ID="..."
R2_ACCESS_KEY_ID="..."
R2_SECRET_ACCESS_KEY="..."
R2_BUCKET_NAME="toirepo-photos"
R2_PUBLIC_URL="https://photos.toirepo.app"

# AI
ANTHROPIC_API_KEY="..."
DEEPL_API_KEY="..."

# 邮件
RESEND_API_KEY="..."
EMAIL_FROM="noreply@toirepo.app"

# 限流
UPSTASH_REDIS_REST_URL="..."
UPSTASH_REDIS_REST_TOKEN="..."

# 监控
SENTRY_DSN="..."
POSTHOG_KEY="..."

# 地理编码（可选）
MAPBOX_ACCESS_TOKEN="..."
```

### 13.3 部署流程

- 推送到 `main` 分支 → Vercel 自动部署到生产
- 推送到其他分支 → Vercel 自动生成预览 URL
- 数据库迁移：GitHub Actions 先跑 `prisma migrate deploy`，成功后才部署前端
- 回滚：Vercel 一键回滚到前一版本

### 13.4 监控

- Sentry：前端 + 后端错误追踪
- PostHog：产品分析（页面浏览、按钮点击、提交漏斗）
- Vercel Analytics：Core Web Vitals
- Uptime Robot：每 5 分钟探测可用性（免费方案）

---

## 14. 反作弊

### 14.1 实施措施

- 同 IP 短时间内多次提交 → 速率限制（见 §6.3）
- 新厕所至少需要 2 个独立用户确认位置后才公开（V1.0）
- 评分加权：`trustLevel` 越高权重越大
- 图片哈希去重：同一张图上传多次自动识别（perceptual hash）
- 异常模式检测：某用户提交的厕所拒绝率超 50% 自动降级并通知管理员

---

## 15. 项目目录结构

```
toirepo/
├── .github/
│   └── workflows/
│       ├── ci.yml
│       └── deploy.yml
├── docker-compose.yml              # 本地 PostgreSQL + PostGIS
├── messages/                       # i18n 文案
│   ├── zh-CN.json
│   ├── ja.json
│   └── en.json
├── prisma/
│   ├── schema.prisma
│   ├── migrations/
│   └── seed.ts
├── public/
│   ├── icons/                      # PWA 图标
│   ├── map-style/                  # 自定义 MapLibre 样式 JSON
│   └── toilet-icons/               # 4 种厕所图标 SVG
├── scripts/
│   ├── import-osm-toilets.ts
│   ├── generate-slugs.ts
│   └── backup-db.sh
├── src/
│   ├── app/
│   │   ├── [locale]/
│   │   │   ├── layout.tsx
│   │   │   ├── page.tsx            # 首页（地图）
│   │   │   ├── t/[slug]/
│   │   │   ├── submit/
│   │   │   ├── me/
│   │   │   └── ...
│   │   ├── admin/
│   │   ├── api/
│   │   │   ├── trpc/[trpc]/
│   │   │   ├── auth/[...nextauth]/
│   │   │   └── cron/
│   │   ├── sitemap.ts
│   │   ├── robots.ts
│   │   └── opengraph-image.tsx
│   ├── components/
│   ├── server/
│   │   ├── api/
│   │   │   ├── root.ts
│   │   │   ├── trpc.ts
│   │   │   └── routers/
│   │   ├── auth.ts
│   │   └── db.ts
│   ├── lib/
│   │   ├── moderation/
│   │   ├── translation/
│   │   ├── exif/
│   │   ├── map/
│   │   └── utils.ts
│   ├── hooks/
│   ├── styles/
│   └── proxy.ts                    # i18n 路由 + 认证检查（Next.js 16 约定，v1.1 #9）
├── tests/
│   ├── e2e/                        # Playwright
│   └── unit/                       # Vitest
├── .env.example
├── next.config.mjs
├── package.json
├── pnpm-lock.yaml
├── tailwind.config.ts
├── tsconfig.json
└── README.md
```

---

## 16. 执行注意事项（给 Claude Code）

### 16.1 关键执行原则

1. **严格按 TASK_BREAKDOWN.md 的顺序执行**，不要跨任务混用
2. **每个任务完成后运行对应的验证步骤**（见各任务末尾的 checklist）
3. **遇到歧义立即提问**，不要猜测
4. **不得自行更改技术栈选型**（如不得用 Drizzle 替换 Prisma）
5. **不得自行调整视觉设计**（颜色、字体、图标风格必须严格按 §4）

### 16.2 涉及外部服务的任务

以下任务需要人工先提供 API Key 或完成注册，Claude Code 应暂停等待：
- Google OAuth 注册（Google Cloud Console）
- Cloudflare R2 bucket 创建
- Supabase 项目创建
- DeepL API 注册（需付费方案支持中日英）
- Resend 账户注册
- Anthropic API Key（Claude Haiku 调用）

### 16.3 测试策略

- 单元测试：关键逻辑（slug 生成、权限检查、速率限制、AI 预审结果解析）
- 集成测试：tRPC procedures
- E2E 测试：关键用户旅程（注册 → 登录 → 提交厕所 → 管理员审核 → 发布 → 查看）
- 不追求 100% 覆盖率，目标 60% 以上

### 16.4 交付物清单

每个任务完成后应产出：
- 代码（通过 linter 和 typecheck）
- 测试（至少 happy path）
- 文档更新（如有必要）
- 部署验证（本地跑通 + 预览环境跑通）

---

## 17. 开放问题（需项目发起人后续决策）

以下问题 MVP 阶段未决，可延后到 V1.0：

1. 是否支持用户匿名评价（不登录也能评分）？
2. 是否支持厕所质量的"时段差异"标注（早上干净、晚上脏）？
3. 是否加入"等候时间预估"字段（女厕排队文化）？
4. 商业化方向：是否考虑 Pro 订阅（无广告、高级筛选、线下店铺推广）？
5. 数据合作：是否考虑与东京都政府开放数据、便利店品牌合作？

---

## 18. 词汇表

| 术语 | 中文 | 日文 | English |
|---|---|---|---|
| Toilet | 厕所 | トイレ | Toilet / Restroom |
| Public toilet | 公共厕所 | 公衆トイレ | Public toilet |
| Convenience store | 便利店 | コンビニ | Convenience store |
| Gate inside | 改札内 | 改札内 | Inside ticket gate |
| Gate outside | 改札外 | 改札外 | Outside ticket gate |
| Accessible | 无障碍 | 多目的 / バリアフリー | Accessible |
| Baby changing | 婴儿护理台 | おむつ交換台 | Baby changing |
| Washlet | 免治马桶 | ウォシュレット | Washlet |
| Gender-neutral | 无性别 | オールジェンダー | Gender-neutral |

---

**文档结束。执行计划参见 TASK_BREAKDOWN.md。**
