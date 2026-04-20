# 已知限制 · 按里程碑累计

每条目记录"不紧急但要记着"的技术债 / 浏览器限制 / 临时绕过。修复或确认无关时
划掉条目并保留删除注记，方便回溯演化。

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
