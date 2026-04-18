# toirepo.app

> 东京（未来全球）的公共厕所众包地图 · 让你找到别的地图不会告诉你的免费厕所。

## 本目录说明

这是一个项目规格包，包含两份文档：

1. **PROJECT_SPEC.md** — 规格总纲，定义项目所有"是什么"
2. **TASK_BREAKDOWN.md** — 任务拆解，定义项目所有"怎么做"

## 使用方式

### 第一步：项目发起人（人工）

1. 通读 PROJECT_SPEC.md，重点关注：
   - §2 功能范围（确认 MVP 是否符合预期）
   - §4 视觉设计规范（确认配色、图标方向）
   - §5 数据模型（确认字段无遗漏）
   - §17 开放问题（可选决策）
2. 如需调整，直接编辑 PROJECT_SPEC.md 对应章节，并在文件顶部修改"文档版本"
3. 准备以下外部资源（Claude Code 执行到相应任务时需要）：
   - 购买域名 `toirepo.app`（或选定的替代域名）
   - 注册：Supabase、Cloudflare R2、Vercel、Anthropic API、DeepL API、Resend、Upstash、Sentry、PostHog、Google Cloud Console（OAuth）

### 第二步：交给 Claude Code 执行

推荐方式：在本地新建空目录，把这两个文件放进去作为项目根的参考文档，然后启动 Claude Code：

```bash
mkdir ~/projects/toirepo
cd ~/projects/toirepo
cp /path/to/PROJECT_SPEC.md .
cp /path/to/TASK_BREAKDOWN.md .
claude
```

然后向 Claude Code 发送：

> 请先阅读 PROJECT_SPEC.md 和 TASK_BREAKDOWN.md，理解整个项目。
> 然后从任务 T1.1 开始执行。执行前请简要说明你理解的任务目标，等我确认后再开始。

### 第三步：逐任务推进

- 每完成一个任务，验证清单逐项检查
- 每个里程碑（M1/M2/...）完成后人工整体验收
- 遇到外部服务接入的任务，Claude Code 会暂停等待你提供 API Key

## 预计耗时

57-76 小时（由 Claude Code 执行），分 41 个任务。
如果你每天让 Claude Code 执行 2-3 小时，约 1 个月可完成 MVP。

## 文档版本

- PROJECT_SPEC.md: v1.0 (2026-04-18)
- TASK_BREAKDOWN.md: v1.0 (2026-04-18)

## 修订建议

当你实际执行过程中发现 SPEC 与现实有偏差时：
- 小改动（字段调整、文案修改）：直接改 SPEC，递增小版本号（v1.1, v1.2...）
- 大改动（架构、功能范围变化）：与 Claude 重新对话确认后再改
