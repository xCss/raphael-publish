# Raphael Publish - 公众号排版大师

专为**微信公众号**与**内容创作者**打造的现代 Markdown 排版引擎。

> **在线体验**：[https://rpx.pages.dev](https://rpx.pages.dev)

![Raphael Publish 截图](media/screenshot.png)


## 功能特性


### 魔法粘贴

**从飞书、Notion、Word 甚至任意网页复制富文本**，粘贴瞬间自动净化为纯净 Markdown。无需手写 Markdown 语法，粘贴即用。
同时支持**直接粘贴截图或图片（Ctrl/Cmd + V）**，自动插入 Markdown 图片语法，并使用本地 `blob:` 地址预览，避免把编辑区撑成超长 Base64 文本。

> 粘贴图片生成的 `blob:` 地址只在当前页面会话内有效；本地草稿会自动过滤这些不可恢复的临时图片引用，避免刷新后恢复成坏图。

### 30 套高定样式

告别同质化白底模板，提供 30 套精心打磨的视觉主题：

- **经典**：Mac 纯净白、Claude 燕麦色、微信原生、NYT 纽约时报、Medium 博客风、Stripe 硅谷风、飞书效率蓝、Linear 暗夜、Retro 复古羊皮纸、Bloomberg 终端机
- **潮流**：Notion、GitHub、少数派、Dracula、Nord、樱花、深海、薄荷、日落、Monokai
- **更多风格**：Solarized、Cyberpunk、水墨、薰衣草、密林、冰川、咖啡、Bauhaus、赤铜、彩虹糖

每套主题在背景色、字体、标题、代码块、引用、表格等元素上都有独立设计，切换即可感受完全不同的排版风格。

<p align="center">
  <a href="media/demo.mp4">
    <img src="media/record.gif" alt="Raphael Publish 功能演示（点击播放 MP4）" />
  </a>
</p>
<p align="center">
  <a href="https://rpx.pages.dev">
    <img src="https://img.shields.io/badge/%E2%96%B6%20Live%20Preview-Visit%20Pages-2ea44f?style=for-the-badge" alt="Live Preview on Pages" />
  </a>
  <a href="media/demo.mp4">
    <img src="https://img.shields.io/badge/%E2%AC%87%20Download%20Demo-MP4-0969da?style=for-the-badge" alt="Download MP4 demo" />
  </a>
</p>
<p align="center">
  <sub>点击上方动图或按钮，可直接跳转页面体验或观看 MP4 高清演示。</sub>
</p>

### 一键复制到公众号

点击「复制到公众号」按钮，直接粘贴到公众号后台：

- **所有外链图片自动转 Base64，不会出现"此图片来自第三方"的报错**
- 背景色、圆角、间距等样式精准还原
- 列表和表格经过底层 DOM 重塑，在微信中不会塌陷

### 多图排版

支持多图并排网格布局，通过 `wechatCompat` 引擎确保在微信公众号中完美呈现，不会被折断。

### 多端预览

编辑时实时预览，支持手机 (480px)、平板 (768px)、桌面 (PC) 三种视图切换，所见即所得。

### 导出

支持导出为 PDF 和 HTML 文件，适合存档、邮件发送或网页发布。

### 本地优先与 PWA

Raphael Publish 支持作为 PWA 安装到桌面或手机，也能在离线时继续打开和编辑：

- **本地草稿自动保存**：编辑内容会自动保存到浏览器本地，刷新或重新打开后可继续创作。
- **偏好记忆**：自动恢复上次使用的主题、明暗模式、预览设备和滚动同步状态。
- **离线可用**：核心应用资源由 Service Worker 缓存，网络不稳定时也能继续排版。
- **轻量更新提示**：新版本可用或离线状态变化时，通过右上角 Toast 提醒，不打断写作。

## 技术栈

- **React 18** + **TypeScript**
- **Vite 5** 构建
- **vite-plugin-pwa** PWA 与 Service Worker
- **Tailwind CSS 3** 样式
- **markdown-it** Markdown 解析
- **highlight.js** 代码高亮
- **turndown** 富文本转 Markdown（魔法粘贴）
- **html2pdf.js** PDF 导出
- **framer-motion** 动画

## 本地开发

```bash
pnpm install
pnpm dev
```

默认开发模式不注册 Service Worker，避免缓存干扰本地调试。如需专门调试 PWA 开发环境，可在启动前设置 `VITE_PWA_DEV=true`。

## 构建部署

```bash
pnpm build
```

构建产物输出到 `dist/` 目录，可部署到 GitHub Pages 或任意静态托管服务。
