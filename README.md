# toirepo.app

东京（未来全球）公共厕所众包地图 — 专门标注"官方地图上没有但实际可用"的免费厕所。

## 本地开发

### 前置要求

- Node 22 LTS（`.nvmrc` 已声明，`nvm use` 自动切换）
- pnpm 10+（项目 `.npmrc` 启用 `engine-strict`，不符版本会被拒绝）
- Docker Desktop 或 OrbStack

### 启动

```bash
nvm use
pnpm install
# 首次：复制 env 模板（两份文件的 DATABASE_URL 必须一致）
cp .env.local.example .env.local
cp .env.local.example .env      # Prisma CLI 读 .env；应用读 .env.local
docker compose up -d            # 启动 PostgreSQL 16 + PostGIS 3.4（端口 5433）
pnpm prisma migrate dev         # 应用数据库 migration
pnpm prisma generate            # 生成 Prisma client
pnpm dev                        # 启动开发服务器
```

访问 http://localhost:3000/zh-CN/

> `.env` 与 `.env.local` 都被 `.gitignore` 忽略，不会入库。两者内容应保持一致：
> Prisma CLI（`prisma.config.ts` 里 `import 'dotenv/config'`）读 `.env`，
> 应用运行时（Next.js 默认行为）读 `.env.local`。

### 常用命令

| 命令                                | 用途                                               |
| ----------------------------------- | -------------------------------------------------- |
| `pnpm dev`                          | 启动开发服务器（Turbopack）                        |
| `pnpm build` / `pnpm start`         | 生产构建与启动                                     |
| `pnpm typecheck`                    | `tsc --noEmit` 类型检查                            |
| `pnpm lint`                         | ESLint                                             |
| `pnpm format:check` / `pnpm format` | Prettier 检查 / 自动修复                           |
| `pnpm smoke:db`                     | 数据库端到端冒烟测试（tsx + pg adapter + trigger） |
| `pnpm prisma migrate dev`           | 应用新 migration                                   |
| `pnpm prisma generate`              | 重新生成 Prisma client                             |
| `pnpm prisma studio`                | 数据库 GUI（http://localhost:5555）                |
| `docker compose up -d` / `down`     | PostgreSQL 容器启停                                |

### 本机端口

toirepo 使用 **5433**（本机 5432 被其他项目 `planning_db` 占用）。
生产 Supabase 不受影响。

## 参考文档

- `CLAUDE.md` — 项目级 AI 执行指令（所有 Claude Code session 必读）
- `docs/PROJECT_SPEC.md` — 规格总纲（v1.1，含 v1.0→v1.1 偏差说明）
- `docs/TASK_BREAKDOWN.md` — 任务拆解（v1.1，按 M1→M11 顺序执行）
- `docs/COLORS.md` — 配色快查表（SPEC §4.2 落地）

## 技术栈

Next.js 16 · Tailwind v4 · Prisma 7 (pg adapter) · PostgreSQL 16 + PostGIS · next-auth v5 · tRPC 11 · next-intl v4 · MapLibre GL 5 · shadcn/ui · Zod 4
