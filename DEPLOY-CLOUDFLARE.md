# 🚀 Cloudflare Workers 部署指南

本项目支持部署到 Cloudflare Workers，提供动态日历订阅源生成服务。

## 📋 前置条件

1. Cloudflare 账号（免费版即可）
2. Node.js 已安装
3. 安装 Wrangler CLI：`npm install -g wrangler`

## 🔧 部署步骤

### 1. 登录 Cloudflare

```bash
wrangler login
```

浏览器会自动打开，完成登录授权。

### 2. 安装依赖

```bash
npm install
```

### 3. 配置 `wrangler.toml`

编辑 `wrangler.toml` 文件，修改：

```toml
name = "your-worker-name"  # 修改为你的 Worker 名称

# 可选：绑定自定义域名
# routes = [
#   { pattern = "calendar.yourdomain.com", zone_name = "yourdomain.com" }
# ]

# 可选：使用 KV 存储缓存节假日数据
# [[kv_namespaces]]
# binding = "CALENDAR_CACHE"
# id = "your-kv-namespace-id"
```

### 4. 本地测试

```bash
npm run wrangler:dev
```

本地开发服务器会启动，通常是 `http://localhost:8787`

测试访问：
```
http://localhost:8787/?sources=holidays,lunar,solar,festivals&year=2024-2027
```

### 5. 部署到 Cloudflare

```bash
npm run wrangler:deploy
```

部署成功后，你会得到类似这样的 URL：
```
https://calendar-subscription-tool.your-subdomain.workers.dev
```

## 🌐 使用方法

### API 端点

```
GET https://your-worker.workers.dev/?sources=...&year=...&icons=...
```

### 参数说明

| 参数 | 说明 | 默认值 |
|------|------|--------|
| `sources` | 数据源，逗号分隔：`holidays,lunar,solar,yiji,festivals` | `holidays,lunar,solar,festivals` |
| `year` | 年份范围，如 `2024` 或 `2024-2027` | 当前年 ~ 当前年+2 |
| `holidayApi` | 自定义节假日 API 地址 | `https://timor.tech/api/holiday/year` |
| `icons` | 是否包含 emoji | `true` |

### 示例

**1. 获取所有日历数据（2024-2027）：**
```
https://your-worker.workers.dev/?sources=holidays,lunar,solar,festivals&year=2024-2027
```

**2. 仅获取节假日和农历：**
```
https://your-worker.workers.dev/?sources=holidays,lunar
```

**3. 不带 emoji 的订阅源：**
```
https://your-worker.workers.dev/?sources=holidays,lunar,solar&icons=false
```

**4. 仅获取 2026 年数据：**
```
https://your-worker.workers.dev/?sources=holidays&year=2026
```

## 📱 订阅到日历应用

### iOS / macOS Calendar
1. 打开 **日历** 应用
2. **日历** → **添加日历** → **添加订阅日历**
3. 输入完整的 Worker URL（包含参数）
4. 点击 **订阅**

### Android (Google Calendar)
1. 打开 [Google Calendar](https://calendar.google.com)
2. **设置** → **添加日历** → **通过 URL 添加**
3. 粘贴 Worker URL

### Outlook
1. **添加日历** → **订阅日历**
2. 输入 Worker URL

## ⚙️ 高级配置

### 使用 KV 存储缓存

Cloudflare KV 可以缓存节假日数据，减少 API 调用：

1. 创建 KV namespace：
```bash
wrangler kv namespace create "CALENDAR_CACHE"
```

2. 将输出的 ID 添加到 `wrangler.toml`：
```toml
[[kv_namespaces]]
binding = "CALENDAR_CACHE"
id = "your-kv-namespace-id"
```

3. 重新部署：
```bash
npm run wrangler:deploy
```

### 自定义域名

1. 在 Cloudflare 添加你的域名
2. 修改 `wrangler.toml`：
```toml
routes = [
  { pattern = "calendar.yourdomain.com", zone_name = "yourdomain.com" }
]
```
3. 部署后访问：`https://calendar.yourdomain.com/?sources=...`

## 🐛 调试

### 查看实时日志

```bash
npm run wrangler:tail
```

### 本地调试

```bash
wrangler dev --local
```

## 📊 限制

- **免费版 Cloudflare Workers 限制：**
  - 每天 100,000 次请求
  - 每次请求 CPU 时间 10ms
  - 同时连接数 1000

- **本项目的优化：**
  - 响应缓存：`Cache-Control: s-maxage=3600`
  - 内存缓存：实例生命周期内缓存节假日数据

## 🔄 CI/CD 自动部署

可以在 GitHub Actions 中添加自动部署：

```yaml
# .github/workflows/deploy-workers.yml
name: Deploy to Cloudflare Workers

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
      - run: npm install
      - uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CF_API_TOKEN }}
```

## 📝 注意事项

1. **ical-generator 兼容性：** 项目使用 `nodejs_compat` 标志以兼容 Node.js 模块
2. **lunar-javascript：** 该库在 Cloudflare Workers 中正常运行
3. **节假日 API：** 默认使用 timor.tech，确保 Worker 可以访问外部 API

## 🔗 相关链接

- [Cloudflare Workers 文档](https://developers.cloudflare.com/workers/)
- [Wrangler 文档](https://developers.cloudflare.com/workers/wrangler/)
- [ical-generator](https://github.com/sebbo2002/ical-generator)
- [lunar-javascript](https://github.com/6tail/lunar-javascript)
