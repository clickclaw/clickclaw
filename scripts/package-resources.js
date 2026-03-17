/**
 * package-resources.js
 *
 * ClickClaw 资源打包脚本
 *
 * Step 1: 下载 Node.js 22 运行时
 * Step 2: 安装 openclaw + 裁剪（test/docs/.d.ts/.map）+ Windows 黑框补丁
 * Step 2b: 安装 clawhub CLI（skills 安装/搜索/发布工具）
 * Step 3: 并行注入插件到 openclaw/extensions/（隔离安装，自包含依赖）
 * Step 4: 注入自定义 Skills 到 openclaw/skills/
 *
 * 用法: node scripts/package-resources.js [--platform darwin|win32] [--arch arm64|x64]
 *
 * 插件版本覆盖（支持版本号 / 本地 tgz 路径 / latest）:
 *   CLICKCLAW_QQBOT_SOURCE=1.2.3
 *   CLICKCLAW_WECOM_SOURCE=./path/to/plugin.tgz
 *   CLICKCLAW_DINGTALK_SOURCE=latest
 *   OPENCLAW_PACKAGE_SOURCE=2026.3.9
 *   CLAWHUB_PACKAGE_SOURCE=0.8.0
 *
 * 添加自定义 Skill:
 *   在 resources/skills/<skill-name>/ 下创建目录，放入 SKILL.md + 其他文件
 *   打包时自动复制到 openclaw/skills/<skill-name>/，openclaw 启动时自动加载
 */

"use strict";

const fs = require("fs");
const path = require("path");
const https = require("https");
const { execSync } = require("child_process");

// ─── 常量 ───

const ROOT = path.resolve(__dirname, "..");
const TARGETS_ROOT = path.join(ROOT, "resources", "targets");
const CACHE_DIR = path.join(ROOT, ".cache");

// 自定义 skill 源目录，子目录即为一个 skill（需含 SKILL.md）
const SKILLS_SRC_DIR = path.join(ROOT, "resources", "skills");

// 裁剪规则版本 — 修改裁剪逻辑时递增，强制对缓存目录重新裁剪
const PRUNE_VERSION = "v2";

// ─── 内置插件列表 ───
//
// 国内 IM 渠道所需插件，直接注入到 openclaw/extensions/<id>/
// openclaw 启动时按 "Bundled extensions" 路径自动发现，无需 plugins.load.paths，
// 无需运行时执行 openclaw plugins install。
//
// 每个插件在独立 tmpDir 中安装，避免 peerDep 传染 gateway node_modules。
// 传递依赖收集后放入 pluginDir/node_modules/，使插件完全自包含。
// 全部并行，总耗时 ≈ 最慢那一个的安装时间。
const BUNDLED_PLUGINS = [
  {
    packageName: "@tencent-connect/openclaw-qqbot",
    id: "openclaw-qqbot",
    label: "QQ Bot",
    envVar: "CLICKCLAW_QQBOT_SOURCE",
  },
  {
    packageName: "@wecom/wecom-openclaw-plugin",
    id: "wecom-openclaw-plugin",
    label: "企业微信",
    envVar: "CLICKCLAW_WECOM_SOURCE",
  },
  {
    packageName: "@dingtalk-real-ai/dingtalk-connector",
    id: "dingtalk-connector",
    label: "钉钉",
    envVar: "CLICKCLAW_DINGTALK_SOURCE",
  },
];

// ─── npm 注册表（国内优先，官方兜底）───
const NPM_REGISTRIES = [
  "https://registry.npmmirror.com",
  "https://registry.npmjs.org",
];

// ─── 工具函数 ───

function die(msg) {
  console.error(`\n[错误] ${msg}`);
  process.exit(1);
}

function log(msg) {
  console.log(`[资源打包] ${msg}`);
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function rmDir(dir) {
  if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
}

function safeUnlink(p) {
  try { if (fs.existsSync(p)) fs.unlinkSync(p); } catch {}
}

// Node 16.7+ 内置 fs.cpSync，C++ 实现比手写递归快
// dereference: true 自动解符号链接（避免 asar/签名问题）
function copyDir(src, dest) {
  fs.cpSync(src, dest, { recursive: true, dereference: true });
}

// 生成并发安全的临时目录（进程号 + 时间戳防冲突）
function makeTmpDir(base, label) {
  const dir = path.join(base, `_tmp_${label}_${process.pid}_${Date.now()}`);
  rmDir(dir);
  ensureDir(dir);
  return dir;
}

function readEnv(name) {
  return (process.env[name] || "").trim();
}

// ─── 下载工具 ───

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const fetch = (reqUrl) => {
      https
        .get(reqUrl, (res) => {
          if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
            return fetch(res.headers.location);
          }
          if (res.statusCode !== 200) {
            return reject(new Error(`HTTP ${res.statusCode} — ${reqUrl}`));
          }
          const total = parseInt(res.headers["content-length"] || "0", 10);
          let received = 0;
          const file = fs.createWriteStream(dest);
          let settled = false;
          const fail = (err) => {
            if (settled) return;
            settled = true;
            res.destroy();
            file.destroy();
            safeUnlink(dest);
            reject(err);
          };
          res.on("data", (chunk) => {
            received += chunk.length;
            if (total > 0) {
              process.stdout.write(
                `\r  进度: ${(received / 1048576).toFixed(1)} MB (${((received / total) * 100).toFixed(1)}%)`
              );
            }
          });
          res.on("error", fail);
          file.on("error", fail);
          file.on("finish", () => {
            file.close((err) => {
              if (settled) return;
              settled = true;
              if (err) { safeUnlink(dest); return reject(err); }
              if (total > 0) process.stdout.write("\n");
              resolve();
            });
          });
          res.pipe(file);
        })
        .on("error", (err) => { safeUnlink(dest); reject(err); });
    };
    fetch(url);
  });
}

async function downloadWithFallback(urls, dest) {
  const errors = [];
  for (const url of urls) {
    try {
      log(`尝试下载: ${url}`);
      await downloadFile(url, dest);
      return;
    } catch (err) {
      errors.push(`${url} → ${err.message}`);
      safeUnlink(dest);
    }
  }
  throw new Error(`所有下载源均失败:\n${errors.join("\n")}`);
}

function httpGetText(url) {
  return new Promise((resolve, reject) => {
    const fetch = (reqUrl) => {
      https
        .get(reqUrl, (res) => {
          if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
            return fetch(res.headers.location);
          }
          if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}`));
          const chunks = [];
          res.on("data", (c) => chunks.push(c));
          res.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")));
          res.on("error", reject);
        })
        .on("error", reject);
    };
    fetch(url);
  });
}

// ─── 参数解析 ───

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = {
    platform: process.platform === "win32" ? "win32" : "darwin",
    arch: process.arch === "arm64" ? "arm64" : "x64",
  };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--platform" && args[i + 1]) opts.platform = args[++i];
    else if (args[i] === "--arch" && args[i + 1]) opts.arch = args[++i];
  }
  if (!["darwin", "win32"].includes(opts.platform)) die(`不支持的平台: ${opts.platform}`);
  if (!["arm64", "x64"].includes(opts.arch)) die(`不支持的架构: ${opts.arch}`);
  return opts;
}

// ─── Step 1: Node.js 22 运行时 ───

async function getLatestNode22Version() {
  const cacheFile = path.join(CACHE_DIR, "node", "versions.json");
  ensureDir(path.dirname(cacheFile));
  if (fs.existsSync(cacheFile) && Date.now() - fs.statSync(cacheFile).mtimeMs < 86_400_000) {
    log("使用缓存的 Node.js 版本列表");
    return pickV22(JSON.parse(fs.readFileSync(cacheFile, "utf-8")));
  }
  log("正在获取 Node.js 版本列表...");
  const text = await httpGetText("https://nodejs.org/dist/index.json");
  fs.writeFileSync(cacheFile, text);
  return pickV22(JSON.parse(text));
}

function pickV22(versions) {
  const v = versions.find((v) => v.version.startsWith("v22."));
  if (!v) die("未找到 Node.js v22.x 版本");
  return v.version.slice(1);
}

async function downloadAndExtractNode(version, platform, arch, runtimeDir) {
  const stampFile = path.join(runtimeDir, ".node-stamp");
  const stamp = `${version}-${platform}-${arch}`;
  if (fs.existsSync(stampFile) && fs.readFileSync(stampFile, "utf-8").trim() === stamp) {
    log(`runtime 已是 v${version}（${platform}-${arch}），跳过`);
    return;
  }

  const filename =
    platform === "darwin"
      ? `node-v${version}-darwin-${arch}.tar.gz`
      : `node-v${version}-win-${arch}.zip`;
  const urls = [
    `https://npmmirror.com/mirrors/node/v${version}/${filename}`,
    `https://nodejs.org/dist/v${version}/${filename}`,
  ];
  const nodeCache = path.join(CACHE_DIR, "node");
  ensureDir(nodeCache);
  const cachedFile = path.join(nodeCache, filename);

  if (!fs.existsSync(cachedFile)) {
    log(`下载 ${filename}...`);
    await downloadWithFallback(urls, cachedFile);
  } else {
    log(`使用缓存: ${filename}`);
  }

  rmDir(runtimeDir);
  ensureDir(runtimeDir);
  platform === "darwin"
    ? extractDarwin(cachedFile, runtimeDir, version, arch)
    : extractWin32(cachedFile, runtimeDir, version, arch);
  fs.writeFileSync(stampFile, stamp);
}

function extractDarwin(tarPath, runtimeDir, version, arch) {
  log("解压 macOS Node.js 运行时...");
  const tmpDir = makeTmpDir(path.dirname(tarPath), `node-darwin-${arch}`);
  execSync(`tar xzf "${tarPath}" -C "${tmpDir}"`, { stdio: "inherit" });
  const src = path.join(tmpDir, `node-v${version}-darwin-${arch}`);

  // bin/node — constants.ts 期望 runtime/bin/node
  const binDest = path.join(runtimeDir, "bin");
  ensureDir(binDest);
  fs.copyFileSync(path.join(src, "bin", "node"), path.join(binDest, "node"));
  fs.chmodSync(path.join(binDest, "node"), 0o755);

  // lib/node_modules/npm — 供 OPENCLAW_NPM_BIN 使用
  const npmSrc = path.join(src, "lib", "node_modules", "npm");
  if (fs.existsSync(npmSrc)) {
    ensureDir(path.join(runtimeDir, "lib", "node_modules"));
    copyDir(npmSrc, path.join(runtimeDir, "lib", "node_modules", "npm"));
  }

  rmDir(tmpDir);
  log("macOS 运行时提取完成");
}

function extractWin32(zipPath, runtimeDir, version, arch) {
  log("解压 Windows Node.js 运行时...");
  const tmpDir = makeTmpDir(path.dirname(zipPath), `node-win32-${arch}`);

  // WSL / macOS 交叉打包用 unzip，Windows 宿主用内置 tar（不依赖 Expand-Archive）
  if (process.platform === "win32") {
    execSync(`tar -xf "${zipPath}" -C "${tmpDir}"`, { stdio: "inherit" });
  } else {
    execSync(`unzip -o -q "${zipPath}" -d "${tmpDir}"`, { stdio: "inherit" });
  }

  const src = path.join(tmpDir, `node-v${version}-win-${arch}`);

  // node.exe — constants.ts 期望 runtime/node.exe
  fs.copyFileSync(path.join(src, "node.exe"), path.join(runtimeDir, "node.exe"));

  // node_modules/npm — Windows Node.js 使用 node_modules/（非 lib/）
  const npmSrc = path.join(src, "node_modules", "npm");
  if (fs.existsSync(npmSrc)) {
    ensureDir(path.join(runtimeDir, "node_modules"));
    copyDir(npmSrc, path.join(runtimeDir, "node_modules", "npm"));
  }

  rmDir(tmpDir);
  log("Windows 运行时提取完成");
}

// ─── Step 2: 安装 openclaw + clawhub ───

function resolveOpenclaw() {
  const explicit = readEnv("OPENCLAW_PACKAGE_SOURCE");
  if (explicit) {
    log(`使用 OPENCLAW_PACKAGE_SOURCE: ${explicit}`);
    return { source: explicit, stamp: `explicit:${explicit}` };
  }
  for (const reg of NPM_REGISTRIES) {
    try {
      const version = execSync(`npm view openclaw version --registry ${reg}`, {
        encoding: "utf-8",
        timeout: 30_000,
        stdio: ["pipe", "pipe", "pipe"],
      }).trim();
      log(`openclaw 最新版本: ${version}（来源: ${reg}）`);
      return { source: version, stamp: `openclaw@${version}` };
    } catch {}
  }
  die("无法获取 openclaw 版本，请设置 OPENCLAW_PACKAGE_SOURCE");
}

function installOpenclaw(opts, gatewayDir) {
  const stampPath = path.join(gatewayDir, ".gateway-stamp");
  const { source, stamp } = resolveOpenclaw();

  // stamp 中含裁剪版本 —— 修改裁剪逻辑时递增 PRUNE_VERSION 即可强制重装
  const targetStamp = `${opts.platform}-${opts.arch}|${stamp}|prune:${PRUNE_VERSION}`;
  const existing = fs.existsSync(stampPath) ? fs.readFileSync(stampPath, "utf-8").trim() : "";
  const openclawExists = fs.existsSync(path.join(gatewayDir, "node_modules", "openclaw"));

  if (existing === targetStamp && openclawExists) {
    log(`openclaw 已是最新（${stamp}），跳过安装`);
    return;
  }

  log(`安装 openclaw@${source}（${opts.platform}-${opts.arch}）...`);
  rmDir(gatewayDir);
  ensureDir(gatewayDir);
  fs.writeFileSync(
    path.join(gatewayDir, "package.json"),
    JSON.stringify({ name: "clickclaw-gateway", version: "1.0.0", private: true }, null, 2)
  );

  const npmEnv = {
    ...process.env,
    NODE_ENV: "production",
    npm_config_os: opts.platform,
    npm_config_cpu: opts.arch,
    OPENCLAW_NO_RESPAWN: "1",
    // 跳过 node-llama-cpp 在交叉打包时触发的 postinstall 下载/编译
    NODE_LLAMA_CPP_SKIP_DOWNLOAD: "true",
  };

  let installed = false;
  for (const reg of NPM_REGISTRIES) {
    try {
      execSync(
        `npm install openclaw@${source} --omit=dev --install-links --legacy-peer-deps` +
          ` --os=${opts.platform} --cpu=${opts.arch} --registry ${reg}`,
        { cwd: gatewayDir, stdio: "inherit", env: npmEnv, timeout: 300_000 }
      );
      installed = true;
      break;
    } catch (err) {
      log(`注册表 ${reg} 安装失败: ${err.message}`);
    }
  }
  if (!installed) die("openclaw 安装失败，请检查网络连接");

  log("openclaw 安装完成，开始裁剪...");
  pruneNodeModules(path.join(gatewayDir, "node_modules"));
  patchWindowsSpawn(gatewayDir, opts.platform);
  fs.writeFileSync(stampPath, targetStamp);
  log("openclaw 就绪");
}

// ─── Step 2b: 安装 clawhub CLI ───
//
// clawhub 是独立 CLI 工具（install/search/publish agent skills）。
// 安装到与 openclaw 相同的 gatewayDir，共享 node_modules，
// 入口：node_modules/clawhub/bin/clawdhub.js
//
// 版本覆盖: CLAWHUB_PACKAGE_SOURCE=1.2.3

function resolveClawhub() {
  const explicit = readEnv("CLAWHUB_PACKAGE_SOURCE");
  if (explicit) {
    log(`使用 CLAWHUB_PACKAGE_SOURCE: ${explicit}`);
    return { source: explicit, stamp: `explicit:${explicit}` };
  }
  for (const reg of NPM_REGISTRIES) {
    try {
      const version = execSync(`npm view clawhub version --registry ${reg}`, {
        encoding: "utf-8",
        timeout: 30_000,
        stdio: ["pipe", "pipe", "pipe"],
      }).trim();
      log(`clawhub 最新版本: ${version}（来源: ${reg}）`);
      return { source: version, stamp: `clawhub@${version}` };
    } catch {}
  }
  die("无法获取 clawhub 版本，请设置 CLAWHUB_PACKAGE_SOURCE");
}

function installClawhub(opts, gatewayDir) {
  const stampPath = path.join(gatewayDir, ".clawhub-stamp");
  const { source, stamp } = resolveClawhub();
  const existing = fs.existsSync(stampPath) ? fs.readFileSync(stampPath, "utf-8").trim() : "";
  const entryExists = fs.existsSync(
    path.join(gatewayDir, "node_modules", "clawhub", "bin", "clawdhub.js")
  );

  if (existing === stamp && entryExists) {
    log(`clawhub 已是最新（${stamp}），跳过安装`);
    return;
  }

  log(`安装 clawhub@${source}...`);

  // 安装到已有 gatewayDir，与 openclaw 共享 node_modules（减少重复依赖）
  let installed = false;
  for (const reg of NPM_REGISTRIES) {
    try {
      execSync(
        `npm install clawhub@${source} --omit=dev --install-links --legacy-peer-deps` +
          ` --registry ${reg}`,
        {
          cwd: gatewayDir,
          stdio: "inherit",
          env: { ...process.env, NODE_ENV: "production" },
          timeout: 120_000,
        }
      );
      installed = true;
      break;
    } catch (err) {
      log(`注册表 ${reg} 安装失败: ${err.message}`);
    }
  }
  if (!installed) die("clawhub 安装失败，请检查网络连接");

  // 裁剪 clawhub 自身的 node_modules（它的依赖不需要类型声明/文档）
  pruneNodeModules(path.join(gatewayDir, "node_modules", "clawhub", "node_modules"));

  fs.writeFileSync(stampPath, stamp);
  log("clawhub 安装完成");
}

// ─── 裁剪：删除 test/docs/benchmark 目录、.d.ts/.map/文档文件 ───

function pruneNodeModules(nmDir) {
  if (!fs.existsSync(nmDir)) return;

  const junkDirs = new Set([
    "test", "tests", "__tests__", "coverage",
    "docs", "examples", ".github", ".vscode",
    "benchmark", "benchmarks",
  ]);
  const junkDocBases = new Set([
    "readme", "changelog", "history", "authors",
    "license", "licence", "contributing",
  ]);
  const junkDocExts = new Set(["", ".md", ".txt", ".markdown", ".rst"]);

  let removedDirs = 0;
  let removedFiles = 0;

  function walk(dir, depth, rootPkg) {
    if (depth > 8) return;
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }

    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        // depth=0 时 entry.name 就是包名；更深层继承上层包名
        const nextRootPkg = depth === 0 ? entry.name : rootPkg;
        if (junkDirs.has(entry.name) && !isProtectedDir(nextRootPkg, entry.name)) {
          rmDir(full); removedDirs++;
        } else {
          walk(full, depth + 1, nextRootPkg);
        }
      } else {
        const lower = entry.name.toLowerCase();
        const ext = path.extname(lower);
        const base = path.basename(lower, ext);
        const isDoc = junkDocBases.has(base) && junkDocExts.has(ext);
        const isDecl = lower.endsWith(".d.ts") || lower.endsWith(".d.mts") || lower.endsWith(".d.cts");
        const isMap = ext === ".map";
        const isTestFile = lower.includes(".test.") || lower.includes(".spec.");
        if (isDoc || isDecl || isMap || isTestFile) {
          try { fs.unlinkSync(full); removedFiles++; } catch {}
        }
      }
    }
  }

  // 某些包的特定目录不能删（运行时必需）
  function isProtectedDir(pkgName, dirName) {
    // openclaw 的 docs 目录包含运行时模板（如 AGENTS.md），不能删
    if (pkgName === 'openclaw' && dirName === 'docs') return true;
    return false;
  }

  walk(nmDir, 0, null);

  // 清理 .bin 悬挂符号链接（避免 afterPack 拷贝时 ENOENT）
  const binDir = path.join(nmDir, ".bin");
  if (fs.existsSync(binDir)) {
    for (const entry of fs.readdirSync(binDir, { withFileTypes: true })) {
      if (!entry.isSymbolicLink()) continue;
      const lp = path.join(binDir, entry.name);
      try { fs.realpathSync(lp); } catch { try { fs.unlinkSync(lp); } catch {} }
    }
  }

  log(`裁剪完成: 删除 ${removedDirs} 个目录、${removedFiles} 个无用文件`);
}

// ─── Windows 黑框补丁 ───
//
// openclaw 在 Windows 上 spawn 子进程时缺少 windowsHide: true
// 会导致用户看到黑色 CMD 窗口一闪而过，必须在打包阶段注入到编译产物中
// 补丁已做幂等校验，重复打包不会重复注入

function patchWindowsSpawn(gatewayDir, platform) {
  if (platform !== "win32") return;

  const distDir = path.join(gatewayDir, "node_modules", "openclaw", "dist");
  if (!fs.existsSync(distDir)) {
    die(`openclaw dist 不存在，无法应用 Windows 补丁: ${distDir}`);
  }

  const entries = fs.readdirSync(distDir);
  const execFiles = entries.filter((f) => /^exec-.*\.js$/.test(f));
  const cliFiles = entries.filter((f) => /^gateway-cli-.*\.js$/.test(f));

  // 补丁 1：exec helper — 在 stdio 前插入 windowsHide: true
  const execR = applySpawnPatch(
    distDir,
    execFiles,
    (s) =>
      s.replace(
        /(\] : finalArgv\.slice\(1\), \{)(\r?\n)(\s*)stdio,/,
        (_, a, nl, indent) => `${a}${nl}${indent}windowsHide: true,${nl}${indent}stdio,`
      ),
    (s) => /finalArgv\.slice\(1\)[\s\S]{0,200}windowsHide: true/.test(s)
  );

  // 补丁 2：gateway-cli respawn — 在 env: process.env 前插入 windowsHide: true
  const cliR = applySpawnPatch(
    distDir,
    cliFiles,
    (s) =>
      s.replace(
        /(spawn\(process\.execPath, args, \{)(\r?\n)(\s*)env: process\.env,/,
        (_, a, nl, indent) => `${a}${nl}${indent}windowsHide: true,${nl}${indent}env: process.env,`
      ),
    (s) => /spawn\(process\.execPath, args[\s\S]{0,200}windowsHide: true/.test(s)
  );

  if (!execFiles.length || !execR.ready) {
    die("exec spawn 补丁未能应用 —— openclaw 版本可能已更新，请检查正则是否仍匹配");
  }
  if (!cliFiles.length || !cliR.ready) {
    die("gateway-cli respawn 补丁未能应用 —— openclaw 版本可能已更新，请检查正则是否仍匹配");
  }

  log(`Windows 补丁已应用: exec=${execR.patched}/${execR.ready} cli=${cliR.patched}/${cliR.ready}`);
}

function applySpawnPatch(dir, files, transform, isReady) {
  let patched = 0, ready = 0;
  for (const f of files) {
    const fp = path.join(dir, f);
    const before = fs.readFileSync(fp, "utf-8");
    const after = transform(before);
    if (after !== before) {
      fs.writeFileSync(fp, after);
      patched++;
      ready++;
    } else if (isReady(before)) {
      ready++; // 已打过补丁，幂等
    }
  }
  return { patched, ready };
}

// ─── Step 3: 插件并行注入 ───

function resolvePluginSource(plugin) {
  const explicit = readEnv(plugin.envVar);
  if (explicit) {
    log(`  ${plugin.label}: 使用 ${plugin.envVar}=${explicit}`);
    return { depSpec: explicit, stamp: `explicit:${explicit}` };
  }
  for (const reg of NPM_REGISTRIES) {
    try {
      const version = execSync(`npm view "${plugin.packageName}" version --registry ${reg}`, {
        encoding: "utf-8",
        timeout: 30_000,
        stdio: ["pipe", "pipe", "pipe"],
      }).trim();
      return { depSpec: version, stamp: `${plugin.packageName}@${version}` };
    } catch {}
  }
  die(`无法获取 ${plugin.packageName} 版本，请设置 ${plugin.envVar}`);
}

async function bundlePlugin(plugin, gatewayDir, opts) {
  const openclawDir = path.join(gatewayDir, "node_modules", "openclaw");
  if (!fs.existsSync(openclawDir)) die(`openclaw 未安装，无法注入插件 ${plugin.id}`);

  const extRoot = path.join(openclawDir, "extensions");
  const pluginDir = path.join(extRoot, plugin.id);
  ensureDir(extRoot);

  const { depSpec, stamp } = resolvePluginSource(plugin);

  // 增量检测：stamp 匹配 + manifest 存在 → 跳过
  const stampFile = path.join(pluginDir, ".clickclaw-stamp.json");
  if (fs.existsSync(stampFile) && fs.existsSync(path.join(pluginDir, "openclaw.plugin.json"))) {
    try {
      const saved = JSON.parse(fs.readFileSync(stampFile, "utf-8"));
      if (saved.stamp === stamp) {
        log(`  ✓ ${plugin.label}（${stamp}）已是最新，跳过`);
        return;
      }
    } catch {}
  }

  log(`  安装 ${plugin.label}（${plugin.packageName}@${depSpec}）...`);

  // 独立临时目录安装，防止传递依赖污染 gateway node_modules
  const tmpDir = makeTmpDir(TARGETS_ROOT, `plugin_${plugin.id}`);
  fs.writeFileSync(
    path.join(tmpDir, "package.json"),
    JSON.stringify({ dependencies: { [plugin.packageName]: depSpec } }, null, 2)
  );

  try {
    let installed = false;
    for (const reg of NPM_REGISTRIES) {
      try {
        execSync(
          `npm install --omit=dev --install-links --legacy-peer-deps --ignore-scripts` +
            ` --os=${opts.platform} --cpu=${opts.arch} --registry ${reg}`,
          {
            cwd: tmpDir,
            stdio: "inherit",
            env: {
              ...process.env,
              NODE_ENV: "production",
              npm_config_os: opts.platform,
              npm_config_cpu: opts.arch,
              NODE_LLAMA_CPP_SKIP_DOWNLOAD: "true",
            },
            timeout: 180_000,
          }
        );
        installed = true;
        break;
      } catch {}
    }
    if (!installed) throw new Error("所有注册表均失败");
  } catch (err) {
    rmDir(tmpDir);
    die(`插件 ${plugin.label} 安装失败: ${err.message}`);
  }

  // 定位已安装的插件包（@scope/name → node_modules/@scope/name）
  const installedPkgDir = path.join(tmpDir, "node_modules", ...plugin.packageName.split("/"));
  if (!fs.existsSync(installedPkgDir)) {
    rmDir(tmpDir);
    die(`安装 ${plugin.id} 后未找到包目录: ${installedPkgDir}`);
  }
  if (!fs.existsSync(path.join(installedPkgDir, "openclaw.plugin.json"))) {
    rmDir(tmpDir);
    die(`${plugin.id} 包缺少 openclaw.plugin.json，插件无效`);
  }

  // 把插件包本身拷贝到 extensions/<id>/
  rmDir(pluginDir);
  copyDir(installedPkgDir, pluginDir);

  // 收集 npm 提升到 tmpDir/node_modules/ 的传递依赖
  // 放入 pluginDir/node_modules/ 使插件完全自包含
  const tmpNm = path.join(tmpDir, "node_modules");
  const pluginNm = path.join(pluginDir, "node_modules");
  ensureDir(pluginNm);

  for (const entry of fs.readdirSync(tmpNm, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name.startsWith(".")) continue;

    if (entry.name.startsWith("@")) {
      // scoped 包：逐个子包处理
      const scopeDir = path.join(tmpNm, entry.name);
      for (const child of fs.readdirSync(scopeDir, { withFileTypes: true })) {
        if (!child.isDirectory()) continue;
        const fullName = `${entry.name}/${child.name}`;
        if (fullName === plugin.packageName) continue; // 跳过插件包自身
        const dest = path.join(pluginNm, entry.name, child.name);
        if (!fs.existsSync(dest)) {
          ensureDir(path.join(pluginNm, entry.name));
          copyDir(path.join(scopeDir, child.name), dest);
        }
      }
    } else {
      const dest = path.join(pluginNm, entry.name);
      if (!fs.existsSync(dest)) {
        copyDir(path.join(tmpNm, entry.name), dest);
      }
    }
  }

  // 对插件自身的 node_modules 也裁剪一遍，减小体积
  pruneNodeModules(pluginNm);
  rmDir(tmpDir);

  // 写版本戳
  fs.writeFileSync(
    stampFile,
    JSON.stringify({ stamp, bundledAt: new Date().toISOString() }, null, 2)
  );
  log(`  ✅ ${plugin.label} 注入完成`);
}

async function bundleAllPlugins(gatewayDir, opts) {
  // 并行安装所有插件，总时间 ≈ 最慢那一个
  await Promise.all(BUNDLED_PLUGINS.map((p) => bundlePlugin(p, gatewayDir, opts)));
  log("所有插件注入完成");
}

// ─── Step 4: 自定义 Skills 注入 ───
//
// 添加 skill 的方法：
//   1. 在 resources/skills/<skill-name>/ 下创建目录
//   2. 放入 SKILL.md（必须）和其他 skill 文件
//   3. 重新运行 package-resources.js 即可
//
// skill 文件会被复制到 gateway/node_modules/openclaw/skills/<skill-name>/
// openclaw 启动时自动发现并加载，无需额外配置

function bundleSkills(gatewayDir) {
  if (!fs.existsSync(SKILLS_SRC_DIR)) {
    log("resources/skills/ 不存在，跳过（如需添加 skill，创建该目录后重新打包）");
    return;
  }

  const skillEntries = fs.readdirSync(SKILLS_SRC_DIR, { withFileTypes: true }).filter(
    (e) => e.isDirectory()
  );

  if (skillEntries.length === 0) {
    log("resources/skills/ 为空，跳过 skills 注入");
    return;
  }

  const openclawDir = path.join(gatewayDir, "node_modules", "openclaw");
  if (!fs.existsSync(openclawDir)) die("openclaw 未安装，无法注入 skills");

  const skillsRoot = path.join(openclawDir, "skills");
  ensureDir(skillsRoot);

  let injected = 0;
  for (const entry of skillEntries) {
    const srcDir = path.join(SKILLS_SRC_DIR, entry.name);
    const destDir = path.join(skillsRoot, entry.name);

    if (!fs.existsSync(path.join(srcDir, "SKILL.md"))) {
      log(`  ⚠️  跳过 ${entry.name}（缺少 SKILL.md，该文件是 skill 的必要入口）`);
      continue;
    }

    rmDir(destDir);
    copyDir(srcDir, destDir);
    log(`  ✓ skill: ${entry.name}`);
    injected++;
  }

  log(`Skills 注入完成: ${injected}/${skillEntries.length} 个`);
}

// ─── 主流程 ───

async function main() {
  const opts = parseArgs();
  const targetId = `${opts.platform}-${opts.arch}`;
  const targetBase = path.join(TARGETS_ROOT, targetId);
  const runtimeDir = path.join(targetBase, "runtime");
  const gatewayDir = path.join(targetBase, "gateway");

  log(`目标平台: ${targetId}`);
  log(`输出目录: ${targetBase}\n`);
  ensureDir(targetBase);

  // Step 1: Node.js 运行时
  log("── Step 1: Node.js 22 ──");
  const nodeVersion = await getLatestNode22Version();
  log(`Node.js 版本: v${nodeVersion}`);
  await downloadAndExtractNode(nodeVersion, opts.platform, opts.arch, runtimeDir);

  // Step 2: 安装 openclaw + 裁剪 + Windows 黑框补丁
  log("\n── Step 2: openclaw ──");
  installOpenclaw(opts, gatewayDir);

  // Step 2b: 安装 clawhub CLI（与 openclaw 共享 gateway node_modules）
  log("\n── Step 2b: clawhub ──");
  installClawhub(opts, gatewayDir);

  // Step 3: 并行注入插件（隔离安装，注入 openclaw/extensions/，自动发现）
  log("\n── Step 3: 插件注入 ──");
  await bundleAllPlugins(gatewayDir, opts);

  // Step 4: 注入自定义 Skills（复制 resources/skills/ → openclaw/skills/）
  log("\n── Step 4: Skills 注入 ──");
  bundleSkills(gatewayDir);

  const extDir = path.join(gatewayDir, "node_modules", "openclaw", "extensions");
  const skillsDir = path.join(gatewayDir, "node_modules", "openclaw", "skills");
  const clawhubBin = path.join(gatewayDir, "node_modules", "clawhub", "bin", "clawdhub.js");

  log(`\n✅ 资源打包完成: ${targetId}`);
  log(`   运行时: ${runtimeDir}`);
  log(`   Gateway: ${gatewayDir}`);
  log(`   插件目录: ${extDir}`);
  log(`   Skills 目录: ${skillsDir}`);
  log(`   clawhub: ${clawhubBin}`);
}

main().catch((err) => {
  console.error("\n[资源打包] 失败:", err.message || err);
  process.exit(1);
});
