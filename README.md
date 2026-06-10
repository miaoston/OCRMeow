<div align="center">
  <img src="public/logo.svg" width="120" alt="OCRMeow Logo" />
  <h1>OCRMeow</h1>
  <p><strong>纯前端 · 零后端 · 隐私优先</strong><br/>基于 PaddleOCR.js + WebGL 3D 流体玻璃拟态的 Chrome OCR 扩展</p>

[![CI Workflow](https://github.com/miaoston/OCRMeow/actions/workflows/ci.yml/badge.svg)](https://github.com/miaoston/OCRMeow/actions)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript)
![WebGL](https://img.shields.io/badge/Rendering-WebGL%20%2B%20GLSL-red)
![PaddleOCR](https://img.shields.io/badge/AI-PaddleOCR.js-blue)
![License](https://img.shields.io/badge/License-MIT-green)

[Live Demo](https://miaoston.github.io/OCRMeow/)

</div>

---

## ✨ Features

| 功能                  | 说明                                                         |
| :-------------------- | :----------------------------------------------------------- |
| 🎯 **划选即识别**     | 点击图标 → 屏幕冻结 → 拖拽划选 → 毫秒级 OCR 识别             |
| 🔍 **文字块筛选**     | Filter 模式下点击图像上的文字块，选择/排除特定行             |
| 🌊 **WebGL 玻璃效果** | 3D 流体扭曲 + 色散 + 霓虹选区 + 暗化背景                     |
| 🖥️ **赛博 Data Pad**  | 军工级终端风格结果面板（LED · HEX · 扫描线 · 呼吸灯动画）    |
| 🎨 **多主题 & i18n**  | 5 套识别主题 + 3 套控制台主题，中英双语自动适配              |
| ☁️ **按需下载模型**   | 首次识别自动拉取（约 22MB），永久缓存至 IndexedDB            |
| 🔒 **完全本地推理**   | 所有 OCR 在浏览器内完成，数据不离开用户设备                  |
| 📦 **轻量化包分发**   | 纯前端轻量安装（首次使用按需缓存），支持本地模型离线手动导入 |

---

## 🏗️ Architecture

```
Content Script (Orchestrator)
├── state.ts              ← 集中状态管理 (OcrItem[], activeTab)
├── selection.ts          ← 鼠标划选 + 裁剪 + OCR 请求
├── interaction-layer.ts  ← 文字块渲染 + 点击交互 + DPR 坐标投影
├── data-pad.ts           ← 军工级赛博终端 UI
├── overlay.ts            ← Shadow DOM 隔离 + UI 层工厂
├── projector.ts          ← 坐标系转换 (Physical ↔ CSS ↔ DPR)
├── i18n.ts               ← 国际化模块
└── index.ts              ← ~100 行轻量协调器（乐观截图预加载）

Background (Service Worker)
└── worker.ts             ← 乐观截图（click 即 capture）+ 消息路由 + 历史存储

Offscreen Document
├── ocr-engine.ts         ← Offscreen ↔ Sandbox 消息桥（静默生产日志）
└── sandbox/index.ts      ← PaddleOCR.js 引擎（Blob URL 生命周期管理）

UI
└── gl-renderer.ts        ← WebGL 背景渲染（VRAM 完整回收：detachShader → deleteProgram → lose_context）

Utils
├── db.ts                 ← IndexedDB（历史记录 + AI 模型 Blob 存储）
└── models.ts             ← 模型下载与校验逻辑
```

---

## 🔧 Tech Stack

| 层       | 技术                                            |
| :------- | :---------------------------------------------- |
| AI 引擎  | `@paddleocr/paddleocr-js` (ONNX Runtime WASM)   |
| 核心逻辑 | TypeScript (strict mode)                        |
| 视觉渲染 | WebGL + GLSL Shaders                            |
| UI 隔离  | Shadow DOM                                      |
| 存储     | IndexedDB (Raw implementation)                  |
| 构建     | Vite + @crxjs/vite-plugin                       |
| CI/CD    | GitHub Actions (Release + Pages + Smoke Test)   |
| 代码质量 | oxlint · oxfmt · tsc --noEmit · check-try-catch |

---

## 📦 Distribution Strategy

OCRMeow deliberately separates **runtime code** from **model data**:

| Target                             | ORT WASM Runtime                                  | OCR Models                                              |
| :--------------------------------- | :------------------------------------------------ | :------------------------------------------------------ |
| Chrome Web Store / extension build | Bundle the single required local JSEP runtime     | Fetch on demand from CDN/Release fallback, cache in IDB |
| Local unpacked extension           | Same as Chrome Web Store for parity               | Fetch on demand or import manually                      |
| Web Demo / GitHub Pages            | May use local runtime; remote runtime is web-only | Fetch on demand from CORS-capable CDN, cache in IDB     |

The extension package keeps `ort-wasm-simd-threaded.jsep.wasm` local because ORT
WASM is executable runtime code. Remotely downloading it after installation is
risky for Chrome Web Store Manifest V3 review. Model `.tar` files are data
assets, so they remain fetch-on-demand and are persisted in IndexedDB. GitHub
Release model assets are valid for extension/background fetches, CI fixtures,
and manual downloads, but GitHub Pages browser fetches must prefer a
CORS-capable CDN because Release asset redirects can fail browser CORS.

## 🔐 First-Run & Privacy UX

首次使用 OCRMeow 时，网页 Demo 和 Chrome 扩展都会明确提示用户：OCR
需要先下载约 22MB 的本地模型。模型下载完成后会缓存到当前浏览器的
IndexedDB，后续识别无需重复下载；如果用户正在执行识别，本次请求会在模型准备好后自动继续。

请放心，OCRMeow 会保护用户隐私：所有识别操作都在浏览器本地完成，不会上传到云端。历史记录会按用户设置保存在本地
IndexedDB，内容包括识别文本和源图片 data URL；用户可以在 Settings 中清空历史，或者清除站点数据来同时删除历史与模型缓存。

---

## 📦 Quick Start

```bash
# 安装依赖
npm install

# 生产构建（内含 check → lint → type-check → build 全链路）
npm run build

# 将 dist/ 目录以"加载已解压的扩展程序"方式载入 Chrome
# 或直接从 GitHub Releases 下载预构建的 zip 包
```

### CI Pipeline

每次提交必须通过以下关卡：

```bash
npm run check-try-catch   # 禁止 try-catch 滥用
npm run format            # oxfmt 代码格式化
npm run lint              # oxlint 逻辑缺陷检测
npm run type-check        # tsc --noEmit 类型安全审计
node tests/run_ocr_test.js # Puppeteer 冒烟测试
npm run build             # Vite 生产构建
```

---

## 🔄 Recent Milestones

- **Milestone 21 (2026-06-10)**: Pruned the Lean package runtime payload from ~165MB to ~46MB by hiding `public/wasm` during production builds, copying back only the ORT JSEP runtime actually used by PaddleOCR (`ort-wasm-simd-threaded.jsep.wasm/.mjs`), and deleting Vite's duplicate hashed ORT wasm fallback. Kept ORT wasm local for Chrome Web Store MV3 compliance because it is executable runtime code; model `.tar` files remain fetch-on-demand data. Hardened CI to download real model fixtures from GitHub Releases when local developer model files are absent, while Web Demo model sync keeps the CORS-capable primary CDN first. History deletion now waits for IndexedDB completion before updating UI.
- **Milestone 20 (2026-06-10)**: Canonicalized all public GitHub-facing project links to `OCRMeow`. Verified `OCRMeow/releases` returns directly while the legacy misspelled releases path redirects, then updated visible model backup links in both Studio entry points to avoid redirect-dependent URLs and future agent confusion.
- **Milestone 18 (2026-05-30)**: Eradicated high-priority architectural defects. Replaced stale coordinate caching in `projector.ts` with live browser pixel ratio getters to support dynamic page zoom/resolution screen swaps. Prevented global keyboard listener memory leaks in the dashboard lightbox overlay through unified event closures. Declared missing Shadow DOM `@keyframes` to animate the cyber scanline and led pulses, and introduced an off-screen clipboard fallback for insecure HTTP environments.
- **Milestone 17 (2026-05-30)**: Transitioned CI pipeline and build pipeline exclusively to a Lean-Only architecture, avoiding weight bloat by hosting model weight assets in GitHub Release drafts and integrating smart, auto-failover, multi-CDN model syncing gateways.
- **Milestone 16 (2026-05-29)**: Fixed sub-path deployment 404 errors (like GitHub Pages) by switching to relative model fetching paths (`models/det.tar`, etc.). Fully unlocked and enabled History Limit controls, Export History, and Clear History on the Web Dashboard using local IndexedDB + JSZip, providing complete feature parity for static web deployments.
- **Milestone 15 (2026-05-28)**: Decoupled automatic history saving from the background worker to ensure statelessness. Extracted all CSS from HTML files into a shared Vite asset pipeline, and decomposed the 1380+ line god-file into 7 highly-focused, single-responsibility modules.
