# R2 CORS · 配置参考

> 两个 R2 bucket（`toirepo-tiles` 和 `toirepo-photos`）都需要独立的 CORS
> 白名单。本文档收纳所有 origin 配置 + 修改步骤，替代旧的 LAN_ACCESS.md
> （LAN 访问随 M10 部署后过时，PWA 在 prod 域名直接装即可）。

---

## 1. 背景

R2 用 origin-allowlist 而非 wildcard。每个浏览器访问 toirepo 资源（pmtiles
basemap / photo presigned URL）的 origin 都必须在白名单里，否则浏览器在
preflight 阶段拒绝。

不在白名单的实际症状：
- 地图加载但底图渲染不出 / 只有 marker 没底色 → tiles bucket CORS 缺
- photo `<img>` 加载 GET 失败 / upload PUT 403 → photos bucket CORS 缺

R2 即时生效，不需重建。改完直接刷新浏览器测。

---

## 2. Prod 切换（M10 P1 落地配置）

> Cloudflare Dashboard → R2 → 选 bucket → Settings → CORS Policy →
> Edit → 粘贴下面对应 JSON → Save。

### 2.1 `toirepo-tiles`

```json
[
  {
    "AllowedOrigins": ["http://localhost:3000", "https://toirepo.com"],
    "AllowedMethods": ["GET", "HEAD"],
    "AllowedHeaders": ["range", "if-match", "if-none-match"],
    "ExposeHeaders": ["etag", "content-range", "accept-ranges"],
    "MaxAgeSeconds": 3600
  }
]
```

为什么保留 `http://localhost:3000`：本地 dev 仍要用 prod R2 (M10 后没有
local pmtiles fallback)。

为什么去掉 `192.168.151.5:3000`：DHCP 漂移过的 LAN IP，PWA 可以直接装在
`https://toirepo.com`，不再需要 LAN 访问。

### 2.2 `toirepo-photos`

```json
[
  {
    "AllowedOrigins": ["http://localhost:3000", "https://toirepo.com"],
    "AllowedMethods": ["GET", "HEAD", "PUT", "POST"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["etag"],
    "MaxAgeSeconds": 3600
  }
]
```

photos bucket 比 tiles 多 PUT/POST（用户上传走 createUploadUrl 直传 R2）。
`AllowedHeaders: ["*"]` 因为 sharp/exif 处理后的 PUT 请求带不固定 headers
（Content-Type / Content-Length 等），用 wildcard 不再维护具体列表。

---

## 3. Preview deployment 限制

Vercel preview URL（`toirepo-git-<branch>.vercel.app`）每次部署不同，**不**
加进 R2 白名单。

后果：preview 部署可以打开页面、运行 trpc API、登录、看 CRUD UI——但
**地图底图加载会 CORS 失败**（看不到 tiles），**用户上传照片也会失败**
（PUT 403）。

PR 视觉/上传测试请切到 prod URL。代码功能层（评论提交逻辑、Appeal 表
单校验、admin queue 操作）preview 仍可测。

---

## 4. 修改 CORS 后的验证

```bash
# tiles
curl -I -H "Origin: https://toirepo.com" \
  https://photos.toirepo.com/tokyo.pmtiles \
  | grep -i 'access-control'

# photos
curl -I -H "Origin: https://toirepo.com" \
  https://photos.toirepo.com/submissions/<some-key> \
  | grep -i 'access-control'
```

期望响应头含：
- `Access-Control-Allow-Origin: https://toirepo.com`
- `Access-Control-Allow-Methods: GET, HEAD` (tiles) / `GET, HEAD, PUT, POST` (photos)

---

## 5. 历史

- M5 起 photos bucket 才开始用，CORS 与 tiles 分开维护
- M9 P1 实机装机暴露 R2 不支持 IP 段通配符（每个 LAN IP 都得手动加），
  详见 KNOWN_ISSUES.md M9 P1 段
- M10 P1：从混合 dev+LAN 配置切到 dev+prod 配置，删除 LAN IP

---

## 6. 关联

- `docs/DEPLOYMENT.md` §2 — prod CORS 切换在部署流程的位置
- `docs/MAP_DATA.md` — pmtiles + R2 bucket 总览
- 旧 `docs/LAN_ACCESS.md` 已被本文档替代
