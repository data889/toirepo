# LAN Access · 局域网访问运维指南

为什么这份文档存在：M9 P1 实机装机过程中暴露了"Next 16 dev server 默认阻挡
LAN origin"和"R2 CORS 不支持 IP 段通配符"两个摩擦点。本文档把两处维护归
拢到一起，避免未来 IP 漂移时重新踩坑。

M10 部署后（正式域名 `toirepo.app` 上线）本文档绝大部分内容会过期 ——
生产环境只有一个 origin，下方"M10 后的脱敏"章节会收掉所有白名单。

---

## 1. 为什么需要 LAN 访问

在 M10 部署前，**唯一把 toirepo 装进 iPhone 主屏幕**的路径是局域网访问：

- Mac 跑 `pnpm dev`（端口 3000）
- iPhone 和 Mac 同 Wi-Fi
- iPhone Safari 打开 `http://<Mac 的 LAN IP>:3000/zh-CN`
- 分享 → 添加到主屏幕 → PWA 装机（步骤见 `docs/M9-pwa-install.md`）

没有 LAN 访问就只能在 Mac 浏览器里看，失去 PWA 实机验证 + 手机真实用户视角。

---

## 2. 查 Mac 当前 LAN IP

```bash
# Wi-Fi（多数情况）
ipconfig getifaddr en0

# 有线网卡（MacBook 外接 Dock 等场景）
ipconfig getifaddr en1

# 全部接口扫一遍
ifconfig | grep "inet " | grep -v 127.0.0.1
```

常见结果示例：`192.168.151.5`（当前 Ming 的 IP）。

---

## 3. IP 漂移时的 2 步维护流程

DHCP 在路由器重启 / 长假未连 / 换 Wi-Fi 后可能给 Mac 换新 IP。本节是 IP
变化时的"两分钟维护清单"。

### Step 1 · 改 `next.config.ts`

Next 16 在 Turbopack 模式下默认阻挡非 localhost origin 访问 dev resource
（HMR chunk / client bundle 等）。必须显式白名单：

```ts
// next.config.ts
const nextConfig: NextConfig = {
  allowedDevOrigins: ['192.168.151.5'], // ← 改成当前 Mac 的 LAN IP
  // ...其他字段保持不变
}
```

改动后**必须重启 dev server**：

```bash
lsof -i :3000 -t | xargs kill -9 2>/dev/null
pnpm dev
```

### Step 2 · 改 R2 bucket CORS

Cloudflare Dashboard → 选 `toirepo-tiles` bucket → Settings → CORS Policy
→ Edit，把新 IP 加进 `AllowedOrigins`。

当前 CORS Policy（保持这个结构，只改 AllowedOrigins 数组）：

```json
[
  {
    "AllowedOrigins": ["http://localhost:3000", "http://192.168.151.5:3000"],
    "AllowedMethods": ["GET", "HEAD"],
    "AllowedHeaders": ["range", "if-match", "if-none-match"],
    "ExposeHeaders": ["etag", "content-range", "accept-ranges"],
    "MaxAgeSeconds": 3600
  }
]
```

R2 CORS 改动**即时生效**，不需要等 bucket 重建或重启 dev。

**注意**：R2 CORS 不支持 IP 段通配符（`192.168.*` 或 `http://192.168.*:3000`
都会被拒）。每个新 IP 都要精确加一条。

### Step 3 · `toirepo-photos` bucket CORS 同步（M7 P1.5 起必需）

两个 bucket 的 CORS 白名单独立维护。Step 2 改的是 `toirepo-tiles`（底图
pmtiles）。`toirepo-photos`（用户上传 + 评论 + 申诉证据照片）从 M5 P1
开始就需要自己的白名单；M7 P1.5 起评论 + 申诉都会上传照片，照片相关
功能在 LAN IP 访问时必走这一条。

`toirepo-photos` 当前 CORS（与 tiles 相比多一个 `PUT`）:

```json
[
  {
    "AllowedOrigins": ["http://localhost:3000", "http://192.168.151.5:3000"],
    "AllowedMethods": ["GET", "HEAD", "PUT"],
    "AllowedHeaders": ["content-type", "content-length", "x-amz-*"],
    "ExposeHeaders": ["etag"],
    "MaxAgeSeconds": 3600
  }
]
```

**每次 LAN IP 漂移时两个 bucket 都要改**。遗漏 `toirepo-photos` 会导致：
- M5 提交新厕所时照片上传 CORS 403
- M7 P2 评论附图上传 CORS 403
- M7 申诉附证据照片上传 CORS 403

---

## 4. iPhone PWA 装机（详见 `docs/M9-pwa-install.md`）

确认 Step 1 + Step 2 都做完后：

```bash
# 打印 LAN IP，在 iPhone Safari 里打开
echo "http://$(ipconfig getifaddr en0):3000/zh-CN"
```

装机步骤（`docs/M9-pwa-install.md` 完整版）:

1. iPhone Safari 打开 URL
2. 等地图加载完，确认 marker 正常
3. 分享按钮 → "添加到主屏幕"
4. 命名 "toirepo" → 完成
5. 主屏幕点图标 → 验证 standalone + 地图交互

---

## 5. 常见故障快查

| 症状 | 诊断 | 修复 |
|---|---|---|
| iPhone Safari 页骨架加载但地图空白、无 marker | Next dev 拒绝 LAN origin | 查 Mac Chrome DevTools Network，看到 `_next/static/*` 403 → Step 1 加白 |
| 地图容器加载但 basemap 渲染不出 / 只有标签没底色 | R2 CORS 拒 pmtiles 请求 | DevTools Network 看到 pmtiles 请求 `cors` 错 → Step 2 加白 |
| iPhone Safari 长按分享没有"添加到主屏幕" | manifest 没加载成功 | Mac Chrome DevTools Application → Manifest 看是否 200 |
| 装完打开仍显示 Safari 地址栏 | manifest.display 非 standalone，或 iOS 缓存 | 删 app 重装；清 Safari 缓存 |
| 图标显示为网页截图而非设计图 | iOS 安装时 manifest 还没拉到 | 删装重来 |

---

## 6. M10 部署后的脱敏策略

正式域名 `toirepo.app` 上线后，本文档的 LAN 白名单全都需要清：

### next.config.ts
```ts
// 删掉 allowedDevOrigins 整行（dev 用不到；prod 构建不读这个）
```

### R2 CORS（两个 bucket 都改）
```json
[
  {
    "AllowedOrigins": ["https://toirepo.app"],
    "AllowedMethods": ["GET", "HEAD"],
    "AllowedHeaders": ["range", "if-match", "if-none-match"],
    "ExposeHeaders": ["etag", "content-range", "accept-ranges"],
    "MaxAgeSeconds": 3600
  }
]
```

（`toirepo-photos` 的 AllowedMethods 多一个 `PUT`，保留；生产也要。）

M10 prompt 会有专门子步骤做这个切换 + verify。本文档在 M10 后可标 archived
或直接删。

---

## 7. 关联文档

- `docs/M9-pwa-install.md` — iPhone PWA 安装详细步骤 + 验证清单
- `docs/KNOWN_ISSUES.md` M9 P1 段 — IP 漂移 + CORS 通配符两条债务的出处
- `docs/MAP_DATA.md` — R2 bucket 组织 / pmtiles 流程总览
