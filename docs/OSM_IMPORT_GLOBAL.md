# 全球 OSM toilets 导入 · Playbook

## 背景

`scripts/osm-import.ts` 是东京 23 区专用脚本（M11 落地），导入
`amenity=toilets` + 便利店 / 商场 / 百货店 约 10,106 条。

`scripts/osm-import-global.ts`（M10 P2 / M12 prep）把作业扩展到全球：

- 7 块大洲级 bbox 顺序查 Overpass
- 只抓 `amenity=toilets`（全球 shop 语义不一致，不跟 Tokyo 的
  konbini/mall 做法对齐）
- 每次查询之间 sleep 30s 避免 rate limit
- 每块结果落盘 `logs/osm-global-<region>.json`（断点续传）
- 按 osmId upsert，沿用 Tokyo 脚本的 10m 冲突保护

## 预估

- 总量：OSM 2024 数据 ~350-400k `amenity=toilets`
- 大洲排序：大洋洲 / 南美 / 非洲 / 北美 / 欧洲 / 俄罗斯东部 / 亚洲
- 单块最大：亚洲 + 欧洲 + 北美各 ~80-100k
- Overpass 响应时间：大洲级 bbox 可能 2-5 分钟；**504 Gateway Timeout 常见**，需重试或细分 sub-bbox
- 单次全球扫：理论 4-6 小时（含 30s × 6 = 3min sleep）
- DB 写入：upsert 批量 500/次，400k 全部写完约 2-3 分钟

## 运行指令

**Ming 本地跑 prod DB**（Claude Code 不碰 prod）：

```bash
# 1. 指向 prod direct connection URI（pooler URI 不支持多并发 upsert）
export DATABASE_URL='postgresql://postgres.xxx:PASSWORD@aws-xxx.pooler.supabase.com:5432/postgres'

# 2. 先 dry-run 看 plan
pnpm osm:import-global:dryrun

# 3. 分大洲先跑少量确认
pnpm osm:import-global -- --regions=oceania

# 4. 确认 OK 后跑剩余
pnpm osm:import-global -- --regions=south_america,africa,north_america,europe,russia_east,asia

# 5. 或一次跑全部
pnpm osm:import-global
```

## 断点续传

每个大洲的 Overpass 响应落盘 `logs/osm-global-<region>.json`（~10-50MB
per region）。下次跑同 region：

- 默认走 cache（不重新打 Overpass）
- `--no-cache` 强制重跑 Overpass

中断时安全：已写入 DB 的 row 下次跑会命中 osmId upsert → 幂等。

## Overpass timeout 应对

**504 Gateway Timeout** 是大洲级查询的常见故障（本地实测亚洲 / 北美会
被拒）。应对：

1. **重跑**：Overpass 公网服务器负载波动，等 5-10 分钟重跑通常能过
2. **细分 bbox**：把失败区域手动拆 4 块（经度中线 + 纬度中线），用
   `curl -X POST` 直接查 + 写 `logs/osm-global-<region>.json`，再
   `--regions=<region>` 读 cache 继续
3. **换 mirror**：Overpass 有欧洲和北美多个 mirror，可改
   `src/server/osm/client.ts` 的 `OVERPASS_ENDPOINT`

## 已知问题

### toilet.list 2000-row limit vs 400k rows in prod

`toilet.list` 当前 default limit=2000、max=5000。prod 导入 400k 后，
客户端默认只拉前 2000 条（ORDER 未显式，Prisma 走 DB 顺序）。

**影响**：zoom out 看到的 marker 密度只是总量 ~0.5%，大部分 PoP 缺失。

**M12 必须完成的架构改造**（>50 commits 级别）：

1. MapCanvas 监听 `moveend`，获取当前 viewport bounds
2. 把 bounds 传入 `toilet.list({ bbox: [west, south, east, north] })`
3. `toilet.list` 的 bbox 分支已经有（M4 设计时就留了 PostGIS
   `ST_Intersects` 的 RAW SQL 路径），只需客户端触发
4. 每次 `moveend` 后 refetch（debounce 300ms）
5. cluster 仍在 MapLibre 侧完成，server 只负责 viewport 内的 row 子集

**当前 MVP 取舍**：导入全球数据后保持 `limit: 2000` 默认，客户端看到的是
"first 2000 rows by insertion order"（Tokyo 优先，因为最早导入）。海外用户
打开地图会看到 Tokyo 密密麻麻 + 自己所在地空白。M12 bbox-aware 改造前
属于**功能缺陷但不崩溃**。

## 回滚

需要撤销本次全球导入：

```sql
-- Supabase SQL editor
DELETE FROM "Toilet" WHERE source = 'OSM_IMPORT' AND osmId NOT LIKE 'node/%tokyo%';
-- 或按 bbox 精确回滚特定大洲
DELETE FROM "Toilet"
WHERE source = 'OSM_IMPORT'
  AND latitude BETWEEN -48 AND 0
  AND longitude BETWEEN 110 AND 180;
```

**不要在 prod 跑不带 WHERE 的 DELETE**。东京的 10,106 条 OSM + 用户
提交的 22 条 seed/user submission 不能牵连。
