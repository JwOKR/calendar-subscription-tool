# 📅 日历订阅源生成工具

[![Deploy to GitHub Pages](https://github.com/用户/仓库名/actions/workflows/generate.yml/badge.svg)](https://github.com/用户/仓库名/actions/workflows/generate.yml)

中国日历订阅源自动生成工具 - 节假日·调休·农历·节气·宜忌 → .ics 文件

## ✨ 功能特性

- 🇨🇳 **中国法定节假日**：国务院办公厅发布的放假安排 + 调休
- 🌙 **农历日历**：农历日期 + 传统节日（春节、中秋、端午等）
- ☀️ **二十四节气**：完整24节气，精准到分钟
- 📋 **宜忌日历**：每日宜忌 + 吉神凶煞（传统黄历）
- 🎉 **普通节日**：公历节日 + 国际节日 + 动态日期节日
- 🚀 **全能日历**：一键合并所有日历源

## 🚀 快速部署

### 1. Fork 或克隆此仓库

```bash
git clone https://github.com/你的用户名/calendar-subscription-tool.git
cd calendar-subscription-tool
```

### 2. 启用 GitHub Pages

1. 进入仓库 **Settings** → **Pages**
2. **Source** 选择 **GitHub Actions**

### 3. 手动触发首次生成

1. 进入仓库 **Actions** 标签
2. 选择 **Generate & Deploy Calendar** 工作流
3. 点击 **Run workflow**
4. 可选：指定年份范围（如 `2024-2027`）

### 4. 获取订阅链接

部署成功后，订阅链接格式为：

```
https://你的用户名.github.io/calendar-subscription-tool/文件名.ics
```

例如：
- 中国节假日：`https://yourname.github.io/calendar-subscription-tool/china-holidays.ics`
- 全能日历：`https://yourname.github.io/calendar-subscription-tool/all-in-one.ics`

## 📱 如何使用订阅链接

### iOS / macOS Calendar
1. 打开 **日历** 应用
2. **日历** → **添加日历** → **添加订阅日历**
3. 输入 `.ics` 订阅链接
4. 点击 **订阅**

### Android (Google Calendar)
1. 打开 [Google Calendar](https://calendar.google.com)
2. **设置** → **添加日历** → **通过 URL 添加**
3. 粘贴 `.ics` 订阅链接

### Outlook
1. **添加日历** → **订阅日历**
2. 输入 `.ics` 订阅链接

## ⚙️ 自定义配置

### 修改节假日数据源

编辑 `config.json`：

```json
{
  "holidayApi": "https://你的API地址",
  "holidayApiFormat": "timor",
  "mergeSources": ["output/china-holidays.ics", "output/lunar-calendar.ics", ...],
  "mergeOutput": "all-in-one.ics",
  "mergeCalName": "全能日历",
  "mergeCalDesc": "节假日+农历+节气+节日 合并订阅",
  "festivals": {
    "includeCN": true,
    "includeIntl": true,
    "includeDynamic": true,
    "custom": []
  }
}
```

### 使用自定义节假日 API

支持两种格式：
1. **timor.tech 格式**：`{"holiday": {"YYYY-MM-DD": {"holiday": true, "name": "节日名"}}}`
2. **简化格式**：`{"holidays": ["YYYY-MM-DD"], "workdays": ["YYYY-MM-DD"]}`

本地测试：
```bash
npm run set-api https://timor.tech/api/holiday/year/{{year}}
npm start
```

## 🔄 自动更新

GitHub Actions 会：
- **每天北京时间凌晨2点**自动运行
- 生成最新的 `.ics` 文件
- 自动部署到 GitHub Pages

你也可以随时手动触发更新（Actions → Run workflow）

## 📂 项目结构

```
calendar-subscription-tool/
├── .github/workflows/  # GitHub Actions 工作流
│   └── generate.yml
├── src/                # 源代码
│   ├── index.js
│   ├── fetch-holidays.js
│   ├── lunar-calendar.js
│   ├── solar-terms.js
│   ├── yi-ji.js
│   ├── festivals.js
│   └── merge-sources.js
├── output/             # 生成的 .ics 文件（自动部署到 GitHub Pages）
│   ├── china-holidays.ics
│   ├── lunar-calendar.ics
│   ├── solar-terms.ics
│   ├── yi-ji.ics
│   ├── festivals.ics
│   ├── all-in-one.ics
│   └── index.html
├── config.json         # 配置文件
└── package.json
```

## 🛠️ 本地开发

```bash
# 安装依赖
npm install

# 生成所有日历文件
npm start

# 仅生成中国节假日
npm run build:holidays

# 生成指定年份范围
node src/index.js --years 2024-2027

# 合并订阅源
npm run merge

# 启动本地订阅服务（测试用）
npm run serve
```

访问 `http://localhost:3000` 查看本地订阅服务。

## 📋 TODO

- [ ] 支持更多节假日 API 格式
- [ ] 添加节日图标/表情符号
- [ ] 支持自定义节日颜色
- [ ] 添加 ics 文件校验

## 📄 License

ISC

## 🙏 致谢

- [ical-generator](https://github.com/sebbo2002/ical-generator) - ICS 文件生成
- [lunar-javascript](https://github.com/6tail/lunar-javascript) - 农历计算
- [timor.tech](https://timor.tech) - 节假日 API（可选）

---

**💡 提示**：部署成功后，访问 `https://你的用户名.github.io/calendar-subscription-tool/` 可以看到订阅管理页面。
