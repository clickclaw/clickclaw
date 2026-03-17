<p align="center">
  <img src="src/renderer/src/assets/logo.svg" width="128" height="128" alt="ClickClaw Logo" />
</p>

<h1 align="center">ClickClaw</h1>

<p align="center">
  <strong>One-click OpenClaw deployment for everyone</strong><br/>
  <sub>No environment setup, no terminal commands — scan a QR code to create Feishu/WeCom bots</sub>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/platform-macOS%20%7C%20Windows-blue" alt="Platform" />
  <img src="https://img.shields.io/badge/electron-40+-47848F?logo=electron" alt="Electron" />
  <img src="https://img.shields.io/badge/react-19-61DAFB?logo=react" alt="React" />
  <img src="https://img.shields.io/badge/antd-6.x-1677FF?logo=antdesign" alt="Ant Design" />
  <img src="https://img.shields.io/badge/license-GPL--3.0-blue" alt="License" />
</p>

<p align="center">
  <a href="README.md">简体中文</a> | English
</p>

---

## What is ClickClaw

[OpenClaw](https://github.com/OpenClaw) is a powerful AI agent framework, but its installation and configuration can be challenging — requiring Node.js, command-line operations, and manual JSON editing.

**ClickClaw** exists to eliminate that barrier. It wraps the entire deployment process into a visual desktop app, bundling Node.js 22 + OpenClaw runtime, so anyone can have their own AI assistant up and running in minutes.

**Core features:**

- **Zero-dependency install** — Bundled runtime, download and run, no Node.js or CLI tools needed
- **Fully visual** — Model setup, channel connection, pairing approval, Agent management — all through a GUI
- **QR code bot creation** — For Feishu and WeCom, just scan a QR code to auto-create apps and fill in credentials
- **Auto crash recovery** — Gateway auto-retries on failure, then guides one-click restore from healthy snapshots
- **AI security vetting** — Automatically analyzes code risk level and permission scope before skill installation
- **In-app pairing approval** — IM users send pairing requests, desktop app pops up real-time approval with one-click accept or deny
- **Multi-Agent multi-channel** — Different channels and accounts can bind to different AI personas, each with its own role
- **HTTP proxy support** — Built-in proxy settings for accessing international services like OpenAI and Telegram

---

## Screenshots

<table>
  <tr>
    <td align="center"><strong>Dashboard</strong></td>
    <td align="center"><strong>Live Chat</strong></td>
  </tr>
  <tr>
    <td><img src="screenshot/dashboard.png" alt="Dashboard" /></td>
    <td><img src="screenshot/chat.png" alt="Live Chat" /></td>
  </tr>
  <tr>
    <td align="center"><strong>Model Config</strong></td>
    <td align="center"><strong>Channels</strong></td>
  </tr>
  <tr>
    <td><img src="screenshot/model.png" alt="Model Config" /></td>
    <td><img src="screenshot/channel.png" alt="Channels" /></td>
  </tr>
  <tr>
    <td align="center"><strong>Agent Management</strong></td>
    <td align="center"><strong>Skills Marketplace</strong></td>
  </tr>
  <tr>
    <td><img src="screenshot/agents.png" alt="Agent Management" /></td>
    <td><img src="screenshot/skill.png" alt="Skills Marketplace" /></td>
  </tr>
  <tr>
    <td align="center"><strong>Cron Tasks</strong></td>
    <td align="center"><strong>Backup</strong></td>
  </tr>
  <tr>
    <td><img src="screenshot/cron.png" alt="Cron Tasks" /></td>
    <td><img src="screenshot/backup.png" alt="Backup" /></td>
  </tr>
</table>

---

## Features

<table>
  <tr>
    <td width="50%">

**🚀 5-Step Setup Wizard**

Environment detection → Model config → Channel config → Confirm → Launch. Fully guided, no terminal needed.

</td>
    <td width="50%">

**💬 Live Chat**

WebSocket direct to Gateway, multi-session management, streaming Markdown rendering, `/` slash commands.

</td>
  </tr>
  <tr>
    <td>

**🤖 Agent Management**

Create multiple AI personas, edit workspace files (AGENTS.md / SOUL.md / MEMORY.md), fine-grained tool permissions and Skills allowlist.

</td>
    <td>

**📡 IM Channels**

Feishu, WeCom, QQ Bot, DingTalk, Telegram, Discord, Slack. QR quick-create for Feishu/WeCom, multi-account, pairing approval.

</td>
  </tr>
  <tr>
    <td>

**🔧 Model Config**

Domestic (Moonshot / Qwen / Zhipu / DeepSeek …), international (Claude / GPT / Gemini), custom endpoints. One-click API Key verification, batch import from remote model lists.

</td>
    <td>

**🧩 Skills Marketplace**

Browse ClawHub marketplace, AI security vetting before install. Installed skills support enable/disable, inline API Key editing, export.

</td>
  </tr>
  <tr>
    <td>

**⏰ Cron Tasks**

Interval / cron expression / one-shot scheduling, assign Agent for auto-execution, run history tracking.

</td>
    <td>

**⚙️ Settings & Operations**

Language switch, proxy config, auto-update (desktop + engine), live logs, smart snapshot backup & crash recovery.

</td>
  </tr>
</table>

---

## Getting Started

### Download

Grab the installer for your platform from [Releases](https://github.com/clickclaw/clickclaw/releases):

| Platform | Architectures |
|----------|--------------|
| macOS | Apple Silicon (arm64) / Intel (x64) |
| Windows | x64 / arm64 |

### First Launch

The Setup Wizard guides you through all configuration:

1. **Environment Detection** — Auto-scan for existing OpenClaw and port usage
2. **Configure Model** — Choose a Provider (domestic / international / custom), enter and verify API Key
3. **Configure Channels** — Select IM channels, Feishu/WeCom support QR quick-create (skippable)
4. **Confirm** — Review configuration summary
5. **Launch** — Write config, start Gateway, enter main UI

---

## Build from Source

### Prerequisites

- Node.js 18+
- npm 9+

### Development

```bash
git clone https://github.com/clickclaw/clickclaw.git
cd clickclaw
npm install
npm run dev
```

### Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Hot-reload dev mode |
| `npm run lint` | ESLint + TypeScript type checking |
| `npm run typecheck` | Type checking only |
| `npm test` | Vitest single run |
| `npm run build:win` | Windows package |
| `npm run build:mac` | macOS package |

### Tech Stack

| Layer | Technology |
|-------|-----------|
| Desktop Framework | Electron 40+ |
| Build Tool | electron-vite 5 |
| UI | React 19 + Ant Design 6 |
| State Management | Zustand |
| i18n | i18next |
| Packaging | electron-builder |
| Testing | Vitest |

---

## Contributing

Contributions of all kinds are welcome — bug fixes, features, docs, translations.

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/xxx`)
3. Commit your changes
4. Create a Pull Request

> Guidelines: Follow ESLint + Prettier code style, all UI text must use i18n, new features need tests.

---

## Acknowledgements

- [OpenClaw](https://github.com/OpenClaw) — AI agent runtime
- [Electron](https://www.electronjs.org/) — Cross-platform desktop framework
- [React](https://react.dev/) — UI library
- [Ant Design](https://ant.design/) — Enterprise UI design system

---

## License

ClickClaw is released under the [GPL-3.0 License](LICENSE).

---

<p align="center">
  <sub>ClickClaw — Click to deploy OpenClaw</sub>
</p>
