# toirepo 配色快查

本文件由 T1.3 落地生成，与 `src/app/globals.css` 的 `@theme` 块保持一致。
Hex 值以 `globals.css` 为唯一真相源，本文件仅为查询便捷。

## 地图底图

| 变量                 | Hex       | Tailwind class                     | 用途                       |
| -------------------- | --------- | ---------------------------------- | -------------------------- |
| --color-paper        | `#FDFCF9` | `bg-paper` / `text-paper`          | 纸色主背景                 |
| --color-street-main  | `#B8B4A8` | `bg-street-main` / `border-street-main` | 主干街道线           |
| --color-street-minor | `#D8D4C8` | `bg-street-minor`                  | 次要街道线                 |
| --color-water        | `#E8E4D8` | `bg-water`                         | 水域（**绝对不用蓝色**）   |
| --color-rail         | `#C4A8A0` | `bg-rail` / `border-rail`          | 铁路虚线                   |
| --color-map-label    | `#8A8578` | `text-map-label`                   | 地图文字标注               |
| --color-park         | `#E8EBE0` | `bg-park`                          | 公园/绿地                  |

## 厕所图标（§4.2）

| 变量                    | Hex       | Tailwind class                                  | 形状       | 字母 |
| ----------------------- | --------- | ----------------------------------------------- | ---------- | ---- |
| --color-toilet-public   | `#D4573A` | `bg-toilet-public` / `text-toilet-public`       | 圆形       | P    |
| --color-toilet-mall     | `#2C6B8F` | `bg-toilet-mall` / `text-toilet-mall`           | 圆角方形   | M    |
| --color-toilet-konbini  | `#5C8A3A` | `bg-toilet-konbini` / `text-toilet-konbini`     | 三角形     | C    |
| --color-toilet-purchase | `#B8860B` | `bg-toilet-purchase` / `text-toilet-purchase`   | 五边形     | ¥    |

选色逻辑：日式陶器釉色（朱砂／青花／苔绿／赭石金），色相区分度高、饱和度中等，与纸色底图协调。

## UI 控件（§4.2）

| 变量                    | Hex       | Tailwind class                              | 用途                      |
| ----------------------- | --------- | ------------------------------------------- | ------------------------- |
| --color-ink-primary     | `#2C2C2A` | `text-ink-primary`                          | 主文字                    |
| --color-ink-secondary   | `#5F5E5A` | `text-ink-secondary`                        | 次要文字                  |
| --color-ink-tertiary    | `#888780` | `text-ink-tertiary`                         | 辅助文字                  |
| --color-border-soft     | `#E0DCD0` | `border-border-soft`                        | 通用边框                  |
| --color-btn-primary     | `#2C2C2A` | `bg-btn-primary`                            | 主按钮底                  |
| --color-btn-on-primary  | `#FDFCF9` | `text-btn-on-primary`                       | 主按钮文字                |
| --color-link            | `#2C6B8F` | `text-link`                                 | 链接（与商场图标同色）    |
| --color-error           | `#C5432A` | `text-error` / `bg-error`                   | 错误红                    |
| --color-success         | `#4A7A2C` | `text-success` / `bg-success`               | 成功绿                    |

## shadcn 语义 token 映射（`:root` 覆盖）

shadcn 组件依赖 `--primary`/`--background`/`--accent` 等语义 token。这些在 `:root` 里被覆盖为 toirepo 值，因此 shadcn 组件（Button、Card、Dialog 等）自动渲染 toirepo 配色：

| shadcn token          | 当前值    | 等价于                                 |
| --------------------- | --------- | -------------------------------------- |
| `--background`        | `#FDFCF9` | paper                                  |
| `--foreground`        | `#2C2C2A` | ink-primary                            |
| `--primary`           | `#2C2C2A` | ink-primary / btn-primary              |
| `--primary-foreground`| `#FDFCF9` | paper / btn-on-primary                 |
| `--secondary`         | `#E0DCD0` | border-soft                            |
| `--muted`             | `#E0DCD0` | border-soft                            |
| `--muted-foreground`  | `#5F5E5A` | ink-secondary                          |
| `--accent`            | `#2C6B8F` | link / toilet-mall                     |
| `--destructive`       | `#C5432A` | error                                  |
| `--border` / `--input`| `#E0DCD0` | border-soft                            |
| `--ring`              | `#2C6B8F` | link                                   |
| `--chart-1..5`        | 4 图标 + 中性灰 | public/mall/konbini/purchase/ink-tertiary |

## 字体（§4.3）

| 变量          | Class         | 值（回退链）                                                                        | 用途         |
| ------------- | ------------- | ----------------------------------------------------------------------------------- | ------------ |
| `--font-sans` | `font-sans`   | PingFang SC → Hiragino Sans → Noto Sans JP → Noto Sans SC → system-ui → sans-serif | 中日英衣架字 |
| `--font-brand`| `font-brand`  | Inter → system-ui → sans-serif                                                      | 数字与品牌字 |

不使用衬线体（SPEC §4.3）。

## 暗色模式

MVP 阶段不实施（SPEC §4.6）。`globals.css` 的 `.dark {}` 块保留 shadcn 默认值，但不触发——页面不应添加 `class="dark"` 切换逻辑。V1.0 再考虑"深夜模式"设计。

## 如何修改

- **单一事实来源**：`src/app/globals.css` 的 `@theme {}` 块
- 本文件为 mirror；改配色只改 globals.css，更新本文件仅作为索引表跟进
- 不得自改 Hex 值（CLAUDE.md 红线 §4.2）——任何修改需先与项目发起人确认
