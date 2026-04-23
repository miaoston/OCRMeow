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

| 功能                  | 说明                                                      |
| :-------------------- | :-------------------------------------------------------- |
| 🎯 **划选即识别**     | 点击图标 → 屏幕冻结 → 拖拽划选 → 毫秒级 OCR 识别          |
| 🔍 **文字块筛选**     | Filter 模式下点击图像上的文字块，选择/排除特定行          |
| 🌊 **WebGL 玻璃效果** | 3D 流体扭曲 + 色散 + 霓虹选区 + 暗化背景                  |
| 🖥️ **赛博 Data Pad**  | 军工级终端风格结果面板（LED · HEX · 扫描线 · 呼吸灯动画） |
| 🎨 **多主题 & i18n**  | 5 套识别主题 + 3 套控制台主题，中英双语自动适配           |
| ☁️ **按需下载模型**   | 首次识别自动拉取（约 22MB），永久缓存至 IndexedDB         |
| 🔒 **完全本地推理**   | 所有 OCR 在浏览器内完成，数据不离开用户设备               |
| 📦 **双版本发布**     | Lean（轻量，按需下载）+ Bundled（内置模型，离线即用）     |

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
