# 地图数据生成流程（toirepo）

## 当前数据（M10 P2 切换后）

- **来源**：Protomaps 公开 pmtiles **sample dataset**（基于 OpenStreetMap，全球覆盖）
- **URL**：`https://r2-public.protomaps.com/protomaps-sample-datasets/protomaps-basemap-opensource-20240814.pmtiles`
- **覆盖**：**全球**（M10 P2 从东京子集切到全球）
- **客户端加载**：`public/map-style/toirepo-paper.json` source URL 硬编码；MapLibre GL JS + pmtiles.js 通过 `pmtiles://` protocol 触发 HTTP Range 按需读取
- **带宽成本**：零（走 Protomaps 的 R2 public bucket，我们不付 egress）

## 为什么切换（M10 P2 决策）

旧方案（M3 设计 / M11 落地）是 R2 自托管东京子集 237MB pmtiles。iPhone 装机 + LAN 测试跑通后，M10 P2 部署前评估：

1. **覆盖范围需要扩大**：M12 全球 toilet 数据计划要求底图先达到全球
2. **维护成本**：自托管每季度需重跑 Planetiler / pmtiles extract 工作流（docs/MAP_DATA.md 下半段记载）
3. **带宽风险**：生产流量未知前自托管有 R2 egress 成本悬疑（虽 R2 号称免费 egress 但大流量下仍有 tiered 限制）
4. **Protomaps 公共 sample dataset 可接受**：Protomaps 官方允许 demo / 中小规模使用；MVP 阶段流量在其容忍度内

切换保留 R2 的 `toilet-tiles` bucket + `tokyo.pmtiles` object 作为零成本 fallback，M12 时评估是否清理。

## 旧方案保留档案（仅供 fallback 与参考）

以下章节描述**原自托管流水线**，M10 P2 后**不再常用**。保留用于：

- 如果未来 Protomaps 公共 URL 废弃或有性能问题，快速切回自托管
- 未来切到 Planetiler 自建流水线时的参考

---

## 方案背景

为什么 Protomaps 公开 pmtiles + R2 自托管，而非 Planetiler 自建：

1. **成本/速度权衡**：从原始 OSM planet PBF 用 Planetiler 生成 pmtiles 需要
   数小时计算 + 100GB+ 临时磁盘 + 调优配置；Protomaps 每日构建免费提供
   一份"官方标准 schema"的产物，下载 135GB 后 pmtiles extract 东京子集只
   需几分钟。
2. **可复现性**：Protomaps 的 build 有确定版本号（日期）+ BLAKE3 哈希；
   Planetiler 跑的参数和数据源版本要自己管。
3. **R2 Range support**：pmtiles 的设计就是 HTTP Range 读取单文件，R2 原生
   支持 Range + 零出口流量费。
4. **更新频率**：MVP 阶段每季度更新一次 basemap 即可——每日 planet 构建
   的开销不是我们需要承担的。

若将来要完全自建（为了特殊 schema、额外 layer 或删除某些 OSM 数据集），
切到 Planetiler 方案即可，pmtiles 文件格式不变。

## 本地磁盘要求

所有大文件**必须放外接 SSD** `/Volumes/T7 Shield/toirepo-data/`。项目根
目录 `data/` 被 `.gitignore` 防御性忽略。

- `raw/planet.pmtiles` ≈ 135 GB（Protomaps 原始 planet）
- `processed/tokyo.pmtiles` ≈ 几百 MB（东京子集）

下载完成 + 上传 R2 之后，如果要释放 T7 Shield 空间：

```bash
rm "/Volumes/T7 Shield/toirepo-data/raw/planet.pmtiles"       # 135 GB
rm "/Volumes/T7 Shield/toirepo-data/processed/tokyo.pmtiles"  # 几百 MB
```

下次更新时重跑流程即可。

## 工具依赖

- **pmtiles CLI v1.30.1** — 通过 `pnpm pmtiles:install` 从 GitHub
  Releases 安装到 `~/.local/bin/`。**Protomaps 未维护官方 Homebrew
  tap**（`protomaps/homebrew-tap` 返回 404，2026-04-19 验证），
  GitHub Releases 是官方分发路径（见 docs.protomaps.com/pmtiles/cli）。
- **Node 22 + pnpm 10**（项目默认）
- **R2 credentials** 在 `.env.local`：`R2_ACCOUNT_ID`、`R2_ACCESS_KEY_ID`、
  `R2_SECRET_ACCESS_KEY`、`R2_BUCKET_NAME`、`R2_PUBLIC_URL`

## 更新流程

```bash
# 0. 首次或升级 pmtiles CLI
pnpm pmtiles:install

# 1. 下载 Protomaps 最新 planet 到 T7 Shield
#    （135 GB，curl -C - 支持断点续传）
pnpm pmtiles:download

# 2. 提取东京子集到 T7 Shield
pnpm pmtiles:extract

# 3. 上传到 R2
pnpm pmtiles:upload

# 4. 验证 Range request 和 magic bytes
pnpm pmtiles:verify
```

`pmtiles:download` 默认用 `scripts/download-pmtiles.sh` 里写死的
`PMTILES_BUILD_DATE`。更新到新 build 时改这一行即可——Protomaps 只保留
最近 ~1 周的 daily build，过期 URL 会返回 404。

## 故障排查

| 症状 | 原因 | 解决 |
|---|---|---|
| `T7 Shield is not mounted` | 外接盘掉盘 / 未插 | 重新挂载 `/Volumes/T7 Shield` |
| `pmtiles: command not found` | CLI 未装或 `~/.local/bin` 不在 PATH | `pnpm pmtiles:install` 重跑（幂等） |
| `download` HTTP 404 | Protomaps 已轮换过期 build | 改 `PMTILES_BUILD_DATE` 到最近 1 周内 |
| `upload` 403 / 401 | R2 credentials 错 | `.env.local` 用的应是 **S3 Access Key / Secret**（R2 控制台 "Manage R2 API Tokens" → "Create API Token" 给 bucket 权限），**不是** Cloudflare API Token |
| `verify` Range 返回 200 而非 206 | R2 bucket 未开启 public access，或走的是非 R2 URL | 检查 bucket Public Bucket 设置，`R2_PUBLIC_URL` 必须是 `pub-xxx.r2.dev` 或 custom domain |
| Magic bytes 返回非 `PMTiles` | 上传失败 / 上传到错的 key / CloudFront 缓存了旧 404 页 | 重新 `pmtiles:upload` 覆盖 |

## 维护节奏

MVP 阶段每季度更新一次 basemap 即可。新一轮：

1. 检查最近一周哪天的 Protomaps build 可用（`curl -sI https://build.protomaps.com/YYYYMMDD.pmtiles`）
2. 改 `scripts/download-pmtiles.sh` 的 `PMTILES_BUILD_DATE`
3. 跑完整流程
4. 在 commit body 记录新的 build 日期和 tokyo.pmtiles 新大小
