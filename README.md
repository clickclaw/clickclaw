<p align="center">
  <img src="src/renderer/src/assets/logo.svg" width="128" height="128" alt="ClickClaw Logo" />
</p>

<h1 align="center">ClickClaw</h1>

<p align="center">
  <strong>一键部署 OpenClaw，小白轻松上手</strong><br/>
  <sub>无需环境配置，无需终端命令，扫码即可创建飞书/企微机器人</sub>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/platform-macOS%20%7C%20Windows-blue" alt="Platform" />
  <img src="https://img.shields.io/badge/electron-40+-47848F?logo=electron" alt="Electron" />
  <img src="https://img.shields.io/badge/react-19-61DAFB?logo=react" alt="React" />
  <img src="https://img.shields.io/badge/antd-6.x-1677FF?logo=antdesign" alt="Ant Design" />
  <img src="https://img.shields.io/badge/license-GPL--3.0-blue" alt="License" />
</p>

<p align="center">
  简体中文 | <a href="README.en.md">English</a>
</p>

---

## ClickClaw 是什么

[OpenClaw](https://github.com/OpenClaw) 是一款强大的 AI 助手框架，但对普通用户来说安装配置门槛较高——需要 Node.js 环境、命令行操作、手动编辑 JSON 配置。

**ClickClaw** 就是为了消除这道门槛而生的桌面工具。它把繁琐的部署流程封装成可视化操作，内置 Node.js 22 + OpenClaw 运行时，让任何人都能在几分钟内拥有自己的 AI 全能助手。

**核心特性：**

- **零依赖安装** — 内置运行时，下载即用，不需要安装 Node.js 或任何命令行工具
- **全程可视化** — 模型接入、渠道对接、配对审批、Agent 管理，所有操作都在图形界面完成
- **扫码创建机器人** — 飞书/企业微信只需扫一下二维码，自动完成应用创建和凭证回填
- **崩溃自动恢复** — Gateway 挂了自动重试，用尽后引导从历史快照一键恢复
- **AI 安全审查** — 安装技能前 AI 自动分析代码风险等级和权限清单，保障使用安全
- **应用内配对审批** — IM 用户发起配对请求，桌面端实时弹窗，一键批准或拒绝
- **多 Agent 多渠道** — 不同渠道、不同账号可绑定不同 AI 人格，各司其职
- **HTTP 代理支持** — 内置代理配置，国内用户轻松访问 OpenAI、Telegram 等国外服务

---

## 截图

<table>
  <tr>
    <td align="center"><strong>仪表板</strong></td>
    <td align="center"><strong>实时聊天</strong></td>
  </tr>
  <tr>
    <td><img src="screenshot/dashboard.png" alt="仪表板" /></td>
    <td><img src="screenshot/chat.png" alt="实时聊天" /></td>
  </tr>
  <tr>
    <td align="center"><strong>模型配置</strong></td>
    <td align="center"><strong>渠道管理</strong></td>
  </tr>
  <tr>
    <td><img src="screenshot/model.png" alt="模型配置" /></td>
    <td><img src="screenshot/channel.png" alt="渠道管理" /></td>
  </tr>
  <tr>
    <td align="center"><strong>Agent 管理</strong></td>
    <td align="center"><strong>Skills 市场</strong></td>
  </tr>
  <tr>
    <td><img src="screenshot/agents.png" alt="Agent 管理" /></td>
    <td><img src="screenshot/skill.png" alt="Skills 市场" /></td>
  </tr>
  <tr>
    <td align="center"><strong>定时任务</strong></td>
    <td align="center"><strong>配置备份</strong></td>
  </tr>
  <tr>
    <td><img src="screenshot/cron.png" alt="定时任务" /></td>
    <td><img src="screenshot/backup.png" alt="配置备份" /></td>
  </tr>
</table>

---

## 功能一览

<table>
  <tr>
    <td width="50%">

**🚀 5 步 Setup 向导**

环境检测 → 模型配置 → 渠道配置 → 确认 → 启动。从零到运行，全程引导，无需终端。

</td>
    <td width="50%">

**💬 实时聊天**

WebSocket 直连 Gateway，多会话管理，流式 Markdown 渲染，`/` 快捷指令。

</td>
  </tr>
  <tr>
    <td>

**🤖 Agent 管理**

创建多个 AI 人格，编辑工作区文件（AGENTS.md / SOUL.md / MEMORY.md），精细控制工具权限和 Skills 白名单。

</td>
    <td>

**📡 IM 渠道**

飞书、企微、QQ Bot、钉钉、Telegram、Discord、Slack。飞书/企微扫码创建，多账户管理，配对审批。

</td>
  </tr>
  <tr>
    <td>

**🔧 模型配置**

国内（Moonshot / 通义千问 / 智谱 / DeepSeek …）、国际（Claude / GPT / Gemini）、自定义端点。API Key 一键验证，远程模型批量导入。

</td>
    <td>

**🧩 Skills 市场**

浏览 ClawHub 技能市场，AI 安全审查后一键安装。已安装技能支持启用/禁用、API Key 内联编辑、导出。

</td>
  </tr>
  <tr>
    <td>

**⏰ 定时任务**

间隔 / Cron / 单次三种调度方式，指定 Agent 自动执行，运行历史追踪。

</td>
    <td>

**⚙️ 设置与运维**

语言切换、代理配置、自动更新（桌面端 + 引擎）、实时日志、智能快照备份与崩溃恢复。

</td>
  </tr>
</table>

---

## 快速上手

### 下载安装

从 [Releases](https://github.com/clickclaw/clickclaw/releases) 下载适合你平台的安装包：

| 平台 | 架构 |
|------|------|
| macOS | Apple Silicon (arm64) / Intel (x64) |
| Windows | x64 / arm64 |

### 首次启动

Setup 向导会引导你完成所有配置：

1. **环境检测** — 自动扫描本机环境，检测已有 OpenClaw 和端口占用
2. **配置模型** — 选择 Provider（国内/国际/自定义），填入 API Key 并验证
3. **配置渠道** — 选择 IM 渠道，飞书/企微可扫码快速创建（可跳过）
4. **确认** — 检查配置汇总
5. **启动** — 写入配置，启动 Gateway，进入主界面

---

## 从源码构建

### 前置要求

- Node.js 22+
- npm 10+

### 开发

```bash
git clone https://github.com/clickclaw/clickclaw.git
cd clickclaw
npm install
npm run dev
```

### 常用命令

| 命令 | 说明 |
|------|------|
| `npm run dev` | 热重载开发模式 |
| `npm run lint` | ESLint + TypeScript 类型检查 |
| `npm run typecheck` | 仅类型检查 |
| `npm test` | Vitest 单次运行 |
| `npm run build:win` | Windows 打包 |
| `npm run build:mac` | macOS 打包 |

### 技术栈

| 层级 | 技术 |
|------|------|
| 桌面框架 | Electron 40+ |
| 构建工具 | electron-vite 5 |
| UI | React 19 + Ant Design 6 |
| 状态管理 | Zustand |
| 国际化 | i18next |
| 打包 | electron-builder |
| 测试 | Vitest |

---

## 参与贡献

欢迎各种形式的贡献——Bug 修复、新功能、文档改进、翻译。

1. Fork 本仓库
2. 创建功能分支（`git checkout -b feature/xxx`）
3. 提交变更
4. 创建 Pull Request

> 贡献规范：遵循 ESLint + Prettier 代码风格，所有 UI 文本使用 i18n，新功能需附带测试。

---

## 致谢

- [OpenClaw](https://github.com/OpenClaw) — AI 智能体运行时
- [Electron](https://www.electronjs.org/) — 跨平台桌面框架
- [React](https://react.dev/) — UI 组件库
- [Ant Design](https://ant.design/) — 企业级 UI 设计体系

---

## 许可证

ClickClaw 基于 [GPL-3.0 许可证](LICENSE) 发布。

---

<p align="center">
  <sub>ClickClaw — 点击即装 OpenClaw</sub>
</p>
