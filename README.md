# MMWX Probe

妙妙屋 X（MiaoMiaoWuX）的独立服务器探针前端。项目将 React 静态页面、只读 API 代理和 WebSocket 代理部署到同一个 Cloudflare Worker，访客只接触探针域名，无需直接访问主控域名。

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/mmwx-group/mmwx-probe)

## 功能

- 卡片和列表两种服务器视图
- CPU、内存、硬盘、流量及实时网速
- 延迟、丢包率及 1h/6h/24h 趋势图
- WebSocket 实时更新，断线后自动回退到 HTTP 轮询
- 自动同步主控的 Pixel、Flat、Anime 默认主题
- Worker Secret 保护主控探针接口，浏览器无法读取访问密钥

## 工作方式

```text
浏览器 ──HTTPS/WS──> Cloudflare Worker ──携带 PROBE_TOKEN──> 妙妙屋 X 主控
```

Worker 仅代理三个固定路径，不接受访客指定上游地址，因此不会形成开放代理：

| 对外路径 | 主控路径 | 用途 |
| --- | --- | --- |
| `/api/probe` | `/api/public/probe-servers` | 服务器状态 |
| `/api/series` | `/api/public/probe-series` | 24 小时延迟、丢包率及系统指标历史；追加 `metric=system` 获取 CPU、内存、网速和累计流量序列 |

服务器列表中的每个 `servers[]` 对象还会返回当前计费周期的 `daily_traffic`，元素包含 `date`、`uplink`、`downlink` 和 `total`（字节）。周期汇总字段包括 `traffic_used_up`、`traffic_used_down`、`traffic_used_total`，周期边界为 `period_start`（含）和 `period_end`（不含）。兼容字段 `traffic_used` 仍表示按主控服务器统计模式计算的计费用量。
| `/api/stream` | `/api/public/probe-ws` | 实时 WebSocket |

## 准备工作

- 已部署支持独立探针访问密钥的妙妙屋 X 主控
- Cloudflare 账户及可用的 Workers 服务
- Node.js 22 或更高版本、npm 10 或更高版本
- 主控具有可由 Cloudflare 访问的 HTTPS 地址

先进入主控的“系统设置 → 探针”，启用探针、选择展示服务器和指标，然后生成“独立探针访问密钥”。密钥明文只显示一次，请立即保存，切勿提交到 Git。

## Cloudflare 网页部署（推荐）

整个过程由 Cloudflare 从 GitHub 拉取、编译和部署，不需要在本地 clone，也不需要安装 Node.js：

1. 点击上方 **Deploy to Cloudflare**。如果按钮暂时不可用，进入 Cloudflare Dashboard 的 **Workers & Pages → Create application → Import a repository**，选择 `iluobei/mmwx-probe`。
2. 保持以下构建设置：
   - Production branch：`main`
   - Build command：`npm run build`
   - Deploy command：`npx wrangler deploy`
   - Root directory：独立仓库留空；从主项目部署时填写 `mmwx-probe`
3. 首次部署后，进入 Worker 的 **Settings → Variables and Secrets**，添加运行时变量：

   | 名称 | 类型 | 值 |
   | --- | --- | --- |
   | `MMWX_ORIGIN` | Text | 主控 HTTPS 地址，例如 `https://panel.example.com` |
   | `PROBE_TOKEN` | Secret | 主控“系统设置 → 探针”生成的访问密钥 |

   注意这里是 Worker 的运行时 **Variables and Secrets**，不是 **Build Variables and Secrets**。保存后点击 Deploy，使变量进入当前部署。
4. 打开 Worker 地址，确认服务器列表、趋势图和实时更新正常。
5. 最后回到主控，开启“仅允许独立探针访问”。此后直接访问主控的探针接口会返回 `404`。

连接 GitHub 后，每次推送到 `main` 分支都会由 Workers Builds 自动构建和部署。

## Wrangler 命令行部署

1. 克隆项目并安装依赖：

   ```bash
   git clone https://github.com/你的用户名/mmwx-probe.git
   cd mmwx-probe
   npm ci
   npx wrangler login
   ```

2. 在 Cloudflare Dashboard 的 **Settings → Variables and Secrets** 添加文本变量 `MMWX_ORIGIN`。地址必须是固定的 HTTPS 源站，不要包含路径或结尾斜杠。

3. 将主控生成的密钥保存为 Worker Secret：

   ```bash
   npx wrangler secret put PROBE_TOKEN
   ```

4. 构建并部署：

   ```bash
   npm run deploy
   ```

5. 打开 Wrangler 输出的 `workers.dev` 地址，确认列表、趋势图和实时更新正常。最后回到主控，开启“仅允许独立探针访问”。开启后，未携带 Worker 密钥直接访问主控探针接口会返回 `404`。

### 绑定自定义域名

在 Cloudflare Dashboard 中进入 **Workers & Pages → mmwx-probe → Settings → Domains & Routes**，添加自定义域名。DNS、TLS 和 WebSocket 均由 Cloudflare 处理，无需修改前端代码。

## 本地开发

复制本地环境变量示例，填写主控地址和同一份访问密钥：

```bash
cp .dev.vars.example .dev.vars
```

在 `.dev.vars` 中填写：

```dotenv
MMWX_ORIGIN=https://panel.example.com
PROBE_TOKEN=主控生成的访问密钥
```

分别启动 Worker 和 Vite：

```bash
# 终端 1
npx wrangler dev

# 终端 2
npm run dev
```

访问 `http://localhost:5173`。Vite 会把 `/api/*` 转发到本地 Worker 的 `8787` 端口。

## 常用命令

```bash
npm run dev        # 启动 Vite 开发服务器
npm run typecheck  # TypeScript 类型检查
npm run build      # 生成 dist 生产文件
npm run preview    # 本地预览生产构建
npm run deploy     # 构建并部署到 Cloudflare Workers
```

## 更新与密钥轮换

通过 Cloudflare 按钮创建的 GitHub 仓库内置“Sync upstream”工作流。启用后，它每天北京时间 11:23 检查 `mmwx-group/mmwx-probe` 的 `main` 分支，无冲突时自动合并并推送；Cloudflare Workers Builds 随后会自动重新部署。也可以在仓库的 **Actions → Sync upstream → Run workflow** 中立即检查更新。

GitHub 会默认禁用公共 fork 中的定时工作流。首次部署后，请进入仓库的 **Actions** 页面启用工作流，并在 **Settings → Actions → General → Workflow permissions** 中确认允许 **Read and write permissions**。若用户分支与上游发生合并冲突，或分支保护禁止 GitHub Actions 推送，工作流会停止且不会覆盖用户更改，需要手动解决冲突。

手动更新仍可执行 `npm ci && npm run deploy`。轮换密钥时，先在主控生成新密钥，立即执行 `npx wrangler secret put PROBE_TOKEN` 并重新部署；在 Worker 更新完成前，探针可能短暂返回 `404`。主控只保存密钥的 SHA-256 哈希，无法找回旧密钥。

## 故障排查

- `503 Probe access secret is not configured`：尚未设置 `PROBE_TOKEN`。
- Worker 返回 `404`：Worker Secret 与主控生成的密钥不一致，或主控探针未启用。
- 页面无实时更新：检查 Cloudflare 与源站反向代理是否允许 WebSocket；页面会自动使用 HTTP 轮询。
- `MMWX_ORIGIN must use HTTPS`：生产源站不是 HTTPS。本地调试仅允许 `localhost` 或 `127.0.0.1`。
- 页面没有服务器：在主控探针设置中选择需要展示的服务器。

## 发布到 GitHub

如果当前目录尚未初始化为独立仓库：

```bash
git init
git add .
git commit -m "Initial release"
git branch -M main
git remote add origin https://github.com/你的用户名/mmwx-probe.git
git push -u origin main
```

提交前确认 `.dev.vars`、`wrangler.local.jsonc`、`node_modules/` 和 `dist/` 未被纳入版本控制。

## 许可证

本项目采用 [Miaomiaowu X Source Available License v1.0](LICENSE)。允许非商业使用、学习、修改和按许可证要求分发；商业使用需取得授权。
