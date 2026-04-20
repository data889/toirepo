# M9 P1 · PWA 安装指南（iPhone）

本文档写给 Ming 把 toirepo 作为 PWA 装到 iPhone 主屏幕做实机验证。

---

## 前置

- Mac 跑着 `pnpm dev`（port 3000）
- iPhone 和 Mac 在**同一 Wi-Fi**
- iPhone Safari（不是 Chrome / Firefox —— iOS 只允许 Safari 装 PWA）
- 拿到 Mac 的局域网 IP：

  ```bash
  ipconfig getifaddr en0        # Wi-Fi 常见接口
  # 或
  ifconfig | grep "inet " | grep -v 127.0.0.1
  ```

  示例：`192.168.1.42`

---

## 装机步骤

1. iPhone Safari 打开 `http://192.168.x.x:3000/zh-CN`
2. 地图加载完，确认能看到大量 marker（10k+ OSM 数据）
3. 点底部"分享"按钮（iOS Safari 中间那个方块带上箭头图标）
4. 向下滚，找 **"添加到主屏幕"**
5. 图标预览应显示 **橙色 T + 白色 pin + 深青背景**（而不是网页截图缩略图）
6. 右上角"添加"
7. 回主屏幕，找到 toirepo 图标，点击打开

---

## 验证清单

打开后检查：

- [ ] 图标是橙 T + 白 pin + 深青底（不是 Safari 截图的默认样式）
- [ ] **无地址栏**（进入 standalone 模式；只有状态栏）
- [ ] **无 Safari 标签栏**
- [ ] 地图正常加载，10k+ marker 出现
- [ ] 点 marker → drawer 正常
- [ ] FAB "+ 提交厕所" 在右下
- [ ] 关掉 app 再打开，不是重启 Safari 而是直接跳回 toirepo

---

## 如果装出来是"网页截图"而非设计图标

最常见原因：Safari 缓存了首次访问时的 HTML（那会儿 manifest/icons 还没生效）。

修复：
1. 长按主屏 toirepo 图标 → 删除
2. 回 Safari 关闭当前 tab
3. 在 Safari 设置里清缓存（`设置 > Safari > 清除历史记录与网站数据`）
4. 重新打开 `http://192.168.x.x:3000/zh-CN` 走步骤 1-7 重装

---

## 如果"添加到主屏幕"按钮没出现

可能原因：
1. 当前在 Chrome / Firefox iOS —— 切 Safari
2. 打开的是非 `/zh-CN` 路径，manifest 的 `scope` 是 `/` 覆盖所有，应不受影响；但极端情况下可以手动先访问 `/zh-CN` 再装
3. manifest 没加载成功 —— Mac 端浏览器打开 DevTools Network 看 `manifest.webmanifest` 是否 200

---

## 已知限制（M9 P1 阶段）

- **Service Worker 在局域网 IP（非 HTTPS）上不会注册**。iOS Safari 只在安全
  上下文（HTTPS 或 `localhost`）注册 SW。装机 + standalone 显示不需要 SW，
  但离线能力 + 地图数据缓存要等 **M10 Vercel 部署后 HTTPS** 自动打开。
- **iOS 不支持 maskable icon**，统一用 apple-touch-icon.png（180×180，已
  flatten 深青背景）。设计上看起来和 Android 的 maskable 视觉一致。
- **Manifest 改动后 iOS 已装 PWA 不会自动更新**。每次 manifest 字段或 icon
  换新，需要按上面"装出来是网页截图"的流程删装重来。

---

## Android 流程（作对照，Ming 可选测）

- Chrome 打开 `http://192.168.x.x:3000/zh-CN`
- 浏览器自动弹 "Install app" banner（或右上菜单里手动选"添加到主屏幕"）
- 安装后图标应为 maskable 版本（Android 圆形或水滴 mask）

---

## 非 MVP 的 PWA 能力（延后）

- Web Push 通知：M10+
- 后台数据同步：M10+
- 完整离线访问（打开 app 在地铁上无网络看缓存）：需 SW 注册生效 = M10 HTTPS
- 安装到 Android app store (TWA)：非 MVP

---

**如果装完 3 项验证都通过（图标正确 / 无地址栏 / 10k marker），M9 P1 签字。**
