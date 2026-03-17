# ClickClaw — 项目规则

> 本文件是 AI 开发助手的持久记忆。每次打开项目时自动加载。

---

## 产品信息

- **产品名称：** ClickClaw（Click + Claw — "点击即装 OpenClaw"）
- **包名 / App ID：** `cn.clickclaw.app`
- **域名：** clickclaw.cn / clickclaw.cloud 
- **版本策略：** 日历版本 `YYYY.M.D`（与 OpenClaw 保持一致）
- **目标平台：** macOS（arm64 + x64）、Windows（x64 + arm64）

## 产品定位

ClickClaw 是面向**小白用户**的 OpenClaw 桌面管理工具，内置 Node.js 22 + openclaw，零依赖安装即用。

---

## 技术栈（必须遵守）

| 层级 | 技术 | 版本 |
|------|------|------|
| 桌面框架 | Electron | 40+ |
| 构建工具 | electron-vite | 5 |
| 渲染层 | React + TypeScript | 19 / 5.9+ |
| UI 组件库 | **Ant Design** | **6.x** |
| 状态管理 | Zustand | 5 |
| 路由 | react-router-dom | 7 |
| 国际化 | i18next + react-i18next | latest |
| JSON5 解析 | json5 | latest |
| 打包 | electron-builder | 26+ |
| 更新 | electron-updater (generic CDN) | latest |
| 日志 | electron-log | 5 |
| 单元测试 | Vitest | 4.x |

### 严禁使用

- Tailwind CSS（使用 Ant Design token 主题系统替代）
- 原生 CSS-in-JS 方案
- 其他 UI 组件库（MUI、Chakra 等）

### Ant Design 规范

- **版本：6.x**
- **AI 文档索引：** https://ant.design/llms.txt
- **AI 完整文档：** https://ant.design/llms-full.txt
- **使用组件时务必先查询上述文档**，确保 API 用法与 6.x 版本一致

---

## 品牌色

| 用途 | 色值 | 名称 |
|------|------|------|
| **主色** | `#FF4D2A` | 活力橙红 |
| 辅色 | `#FF7A5C` | 浅橙 |
| 深色 | `#CC3D21` | 深橙红 |
| 背景深色 | `#7A1A0F` | 龙虾棕 |

```typescript
// 主题配置基准
{
  token: { colorPrimary: '#FF4D2A', borderRadius: 8 },
  algorithm: isDark ? theme.darkAlgorithm : theme.defaultAlgorithm,
  locale: zhCN,
}
```

---

## 核心架构约束

### OpenClaw 配置格式（极其重要）

- 配置文件：`~/.openclaw/openclaw.json`，格式为 **JSON5**（支持注释和尾逗号）
- OpenClaw **严格校验**配置，**未知字段会导致 Gateway 拒绝启动**
- 模型引用格式：`provider/model`（如 `anthropic/claude-opus-4-6`）
- Gateway 端口解析顺序：env `OPENCLAW_GATEWAY_PORT` > config `gateway.port` > 默认 `18789`
- 内置 Provider 无需 `models.providers`，只需 `.env` 中设 auth 环境变量
- Auth 凭证写入 `~/.openclaw/.env`，**不写入 openclaw.json**

### Runtime 接口

```typescript
interface OpenclawRuntime {
  getNodePath(): string
  getGatewayEntry(): string
  getEnv(): Record<string, string>
  install?(): Promise<void>  // 仅 BundledRuntime
}
```

上层代码通过此接口操作，不感知是系统模式还是内置模式。

### 自定义协议 app://

打包后使用 `app://localhost` 协议加载页面（非 `file://`），解决 WebSocket origin 被拒问题。通过 `registerSchemesAsPrivileged` + `protocol.handle` 注册。

---

## 项目结构概览

```
src/
├── main/                  # Electron 主进程
│   ├── index.ts           #   入口、生命周期、单实例锁
│   ├── ipc-handlers.ts    #   IPC 注册中心（所有 handler）
│   ├── config/            #   配置管理（JSON5 读写、.env、快照、预设）
│   ├── gateway/           #   Gateway 进程管理 + 认证
│   ├── runtime/           #   Runtime 抽象（System / Bundled）
│   └── services/          #   业务服务（更新、CLI、Skills、扫码等）
├── preload/               # contextBridge API（index.ts + index.d.ts）
├── renderer/src/          # React 渲染层
│   ├── App.tsx            #   路由 + Theme
│   ├── MainLayout.tsx     #   侧边栏导航布局
│   ├── contexts/          #   GatewayContext（全局 WS 状态）
│   ├── hooks/             #   useGatewayWs（WebSocket 连接）
│   ├── pages/             #   各页面（每个页面遵循模块化规范）
│   ├── components/        #   通用组件
│   └── i18n/              #   中英双语
├── shared/                # 主进程与渲染层共享类型
└── test/                  # Vitest 单元测试
```

---

## 构建与运行

```bash
npm run dev              # electron-vite 开发服务（热更新）
npm run build:win        # Windows 完整打包
npm run lint             # ESLint + TypeScript 类型检查
npm run typecheck        # 仅 TypeScript 类型检查
npm test                 # Vitest 单次运行
```
---

## 代码规范

- TypeScript strict 模式
- ESM 模块（renderer）/ CommonJS（main + preload，Electron 要求）
- 中文注释优先
- 组件文件名：PascalCase（如 `SetupPage.tsx`）
- 工具/服务文件名：kebab-case（如 `gateway-process.ts`）
- i18n key 格式：`page.section.label`（如 `setup.provider.title`）
- 所有 UI 文本必须使用 i18n，不得硬编码中文/英文字符串到组件中

### 页面模块化规范

页面拆分遵循统一模式（详见 `.rule/page-architecture-rules.md`）：

```
pages/<name>/
├── <Name>Page.tsx              # 编排层（仅状态连接 + 渲染拼装）
├── <name>-page.types.ts        # 页面局部类型
├── <name>-page.utils.ts        # 纯函数
├── hooks/
│   ├── use<Name>Page.ts        # 组合层 hook
│   └── use<SubDomain>.ts       # 子域 hook
└── components/
    └── <ComponentName>.tsx      # 拆出的子组件
```

---

## 测试规范（Vitest）

```bash
npm test              # 单次运行
npm run test:watch    # 监听模式
npm run test:coverage # 覆盖率
```

**必须测试：** 配置读写、.env 解析、CLI RC 注入/清除、复杂条件分支纯函数

**不需要测试：** Gateway 进程启停、Windows PATH 修改、文件系统完整流程

### Mock 规范

- `electron` 和 `electron-log` 在 `src/test/mocks/` 全局 mock，**不在单个测试文件中重复**
- 纯函数测试不 mock 文件系统，直接传入字符串参数
- 需要文件 I/O 的测试使用临时目录（`os.tmpdir()`），测试后清理

### 纯函数导出约定

main 进程中需要测试的内部函数，**添加 `export` 导出**（不新建 utils 文件）。

---

## 文档约定

- 讨论/方案/功能文档 → `discuss/` 目录
- 开发规则文档 → `.rule/` 目录
- 所有文档使用简体中文
