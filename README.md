# 🔄 图片格式转换工具 · Image Format Converter

上传一张图片 → 转成目标格式 → 下载一张图片。**全流程在你的浏览器里完成，图片不上传任何服务器。**

> 语言：**中文** | [English](en/)

[![Deploy: GitHub Pages](https://img.shields.io/badge/deploy-GitHub%20Pages-222?logo=github)](https://pages.github.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Privacy: 100% local](https://img.shields.io/badge/privacy-100%25%20local-success)](#-隐私)

## ✨ 特性

- **🔄 全格式互转** — JPG ⇄ PNG ⇄ WebP ⇄ BMP，任意方向
- **🎨 透明通道智能处理** — PNG 转 JPEG 时透明区域可自选填充色，不会变黑块
- **🔍 源格式自动识别** — 并智能推荐合适的目标格式
- **1️⃣ 一张进，一张出** — 不打包、不解压，文件名自动带正确扩展名
- **🎚️ 质量可调** — JPEG/WebP 质量 1-100（默认 92）
- **📐 可选缩放** — 指定最大边长等比缩小
- **📋 支持粘贴** — 截图后 Ctrl+V 直接转换
- **🔐 纯本地处理** — 图片不离开设备，无后端、无上传
- **🕵️ 自动去除 EXIF** — 顺带移除 GPS 位置隐私
- **🆓 零依赖** — 纯原生 JS + Canvas，无第三方库

## 🚀 使用

**在线版：**
- 中文：https://haixiansheng.github.io/image-converter/
- English：https://haixiansheng.github.io/image-converter/en/

**本地运行：**
```bash
git clone https://github.com/haixiansheng/image-converter.git
cd image-converter
python -m http.server 8080
# 打开 http://127.0.0.1:8080
```

## 🏗 技术实现

| 模块 | 方案 |
|---|---|
| 解码 | 浏览器原生 `Image` 解码 |
| 重绘 | Canvas 2D `drawImage`（高质量插值） |
| 透明检测 | 采样 alpha 通道（约 4 万点，够快够准） |
| 编码 | `canvas.toBlob(mime, quality)` |
| 依赖 | **零依赖** |

### 转换流程

```
上传一张图片
   ↓
识别源格式 → （可选）等比缩放 → 画到 Canvas
   ↓
若无损格式（PNG） → 直接编码
若有损且源有透明 → 先铺用户选的底色，再编码
   ↓
生成 Blob → 左右对比预览 → 下载（扩展名自动匹配）
```

### 透明通道处理（核心差异点）
PNG/WebP 支持 alpha，JPEG 不支持。PNG→JPEG 时透明区域必须合成到某个底色。
很多工具不做这一步，结果出现**黑块/杂色块**。本工具：
1. 采样检测是否存在透明像素
2. 若有且目标是 JPEG → 提示用户并显示颜色选择器（默认白色）
3. 先铺底色再绘制，透明区域干净合成

## 📁 目录结构

```
image-converter/
├── index.html / about.html / privacy.html
├── en/                  # 英文
├── style.css
├── app.js               # 全部逻辑
├── ads.txt / sitemap.xml / robots.txt
└── scripts/indexnow_submit.py
```

## ⚠️ 已知限制

| 限制 | 说明 |
|---|---|
| 输出仅 3 种格式 | PNG / JPEG / WebP（BMP 可输入不可输出，Canvas 不支持） |
| HEIC 取决于浏览器 | Safari 可解码，Chrome/Edge 通常不行 |
| JPG 无法变透明 | JPEG 不存 alpha，转 PNG 也只是换容器 |
| 一次一张 | 刻意设计，保证流程最简单 |

## 🔐 隐私

- 图片**从不上传**，全部在浏览器内存中处理
- 无后端、无数据库、无埋点、无第三方库、无 CDN 依赖
- 可断网使用（首次加载后）
- 源码公开可审计（F12 → Network 面板即可自查）

## 📄 License

MIT
