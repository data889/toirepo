@AGENTS.md

# toirepo.app · 项目级 AI 指令

> 本文件是本仓库所有 Claude Code / AI 协作会话的"永久执行背景"。每次新会话启动都会自动加载。
> 修改本文件需谨慎，任何规则调整都应先与项目发起人确认。

---

## 1. 项目是什么

**toirepo.app** 是东京（未来全球）的公共厕所众包地图，专门标注"官方地图上没有但实际可用"的免费厕所。核心差异化价值：填补现有地图（Google/Apple/Yahoo）的三类盲区——商业建筑内的免费厕所、进入路径细节（几楼/哪部电梯/要不要问店员）、实时有效性。

---

## 2. 必读文档（任何编码前先读相关章节）

所有实施决策以下列文档为唯一真相来源：

- `docs/PROJECT_SPEC.md` — 规格总纲（"是什么"）。v1.1，顶部有 v1.0→v1.1 变更说明。
- `docs/TASK_BREAKDOWN.md` — 任务拆解（"怎么做"）。v1.1，按 M1→M11 顺序执行。
- `docs/README.md` — 文档使用说明。

SPEC 与推断冲突时以 SPEC 为准。发现 SPEC 有歧义或缺失，**停下来问人**，不得自行假设。

---

## 3. 与 SPEC v1.0 文本的已知偏差（v1.1 事实状态）

1. **Next.js = 16.2.4**（SPEC 文 §3.1 写的 v15 已升级，接受）。API 与 v15 高度兼容，但仍属"非你训练数据里的 Next.js"——写代码前读 `node_modules/next/dist/docs/` 对应章节。
2. **Tailwind CSS = 4.2.2**（SPEC 文 §3.1 写的 v3 已升级，接受）。配置方式从 `tailwind.config.ts` 迁移到 `globals.css` 的 `@theme` CSS 指令。§4.2 的 Hex 值不变，仅落地位置改为 CSS 变量声明。**不得生成 `tailwind.config.ts`**。
3. **本地 PostgreSQL 端口 = 5433**（SPEC §3、§13 默认的 5432 已被本机其他项目占用）。`DATABASE_URL` 形如 `postgresql://toirepo:toirepo@localhost:5433/toirepo`。生产环境（Supabase）不受此影响。

---

## 4. 绝对不得自行做的决定

违反以下任何一条都算"擅自决策"，必须先停下问人：

1. **不得更换技术栈选型**。Prisma 不换 Drizzle；Auth.js 不换 Clerk；MapLibre 不换 Mapbox GL；pnpm 不换 npm/yarn；Vercel + Supabase 架构不动。某库单一版本兼容问题可选兼容版本，但不能替换整个选型。
2. **不得修改视觉设计**。§4 的配色 Hex、字体、图标形状一字不改。特别地：**水域绝对不用蓝色**；四种厕所图标形状固定（圆/方圆角/三角/五边形）。
3. **不得修改数据库 schema**。§5.2 发现问题先停下问人。不得自行增减字段、改类型、改关系。
4. **不得跳过 AI 预审层**。即使调试麻烦也不得绕过。
5. **不得硬编码 API Key、密码、密钥**。涉及外部服务 API Key 的任务暂停等人提供，不用假 key 绕过。
6. **不得跨任务混用**。严格按 `docs/TASK_BREAKDOWN.md` 的顺序，每个任务完成并通过验证后才进入下一个。

---

## 5. 遇到下列情况立即停下问人

- SPEC 歧义、缺失、与代码冲突
- 命令执行失败、版本不兼容、配置冲突
- 本地环境与 SPEC 假设不一致（端口占用、依赖缺失等）
- 任何"看似该这么做但 SPEC 没说"的决策点
- 需要外部 API Key / 账户的任务

宁可多问一次，不要猜测，不要"尽力而为"。

---

## 6. 本机环境假设（2026-04-18 状态）

- macOS + Apple Silicon (M2)
- Node.js v22.22.2（nvm 管理，`.nvmrc` 固定为 `22`）
- pnpm v10.33.0（**唯一包管理器**，不用 npm/yarn）
- Docker Desktop 运行中
- Git 已初始化

**已占用端口（toirepo 不得使用）**：
- 5432（planning_db）→ toirepo PostgreSQL 用 **5433**
- 6379（planning_redis）→ 未来如需本地 Redis 另议
- 9000-9001（planning_minio）→ 未来如需本地 S3 兼容另议

---

## 7. 每个子步骤完成后

1. 跑 `pnpm lint && pnpm typecheck`（代码类子步骤）。
2. 做一次 git commit，**Conventional Commits** 格式：
   - `feat(M{n}-T{n.m}): ...`（新增功能）
   - `chore(M{n}-T{n.m}): ...`（脚手架/配置）
   - `docs(scope): ...`（文档）
   - `fix(scope): ...`（修复）
3. 向项目发起人报告（做了什么、验证结果、下一步），等确认后再进入下一个子步骤。

---

## 8. 执行规则速查

- 📖 动手前读 SPEC 对应章节
- 🔢 按 TASK_BREAKDOWN 顺序执行
- ✅ 每任务完成跑验证清单
- 💬 歧义立即问，不猜
- 🎨 视觉/颜色/图标/schema 不自改
- 📦 pnpm only
- 🔌 端口冲突用 5433/其他，不抢占
- 🔐 无假 key、无硬编码密钥
- 📝 每子步骤一个 commit

---

**本文档结束。详细规格见 `docs/PROJECT_SPEC.md`，详细任务见 `docs/TASK_BREAKDOWN.md`。**
