/**
 * 主程序入口
 * 用法：
 *   node src/index.js               - 生成当前年份的所有日历文件
 *   node src/index.js --years 2024-2027  - 指定年份范围
 *   node src/index.js --only holidays     - 只生成节假日
 *   node src/index.js --serve                 - 启动 HTTP 服务
 *   node src/index.js --set-api <url>        - 设置自定义节假日 API 地址
 *   node src/index.js --merge                - 按 config.json 合并多个订阅源
 *   node src/index.js --merge --input a.ics b.ics -o out.ics  - 合并指定文件
 */

const path = require('path');
const dayjs = require('dayjs');
const { fetchHolidays, flattenHolidays, setCustomHolidayApi, getHolidayApiBase } = require('./fetch-holidays');
const { calcLunarEventsByYears } = require('./lunar-calc');
const { getFestivalEvents } = require('./festivals');
const { generateAllICS, generateReadme } = require('./ics-generator');
const { mergeSources, mergeFromConfig } = require('./merge-sources');

const CURRENT_YEAR = dayjs().year();

/**
 * 解析命令行参数
 */
function parseArgs() {
  const args = process.argv.slice(2);
  const config = {
    startYear: CURRENT_YEAR - 5,
    endYear: CURRENT_YEAR + 2,
    only: null,
    serve: false,
    setApi: null,
    merge: false,
    mergeInput: null,
    mergeOutput: 'all-in-one.ics',
  };

  let i = 0;
  while (i < args.length) {
    const arg = args[i];
    if (arg === '--years' && args[i + 1]) {
      const [start, end] = args[i + 1].split('-').map(Number);
      config.startYear = start || CURRENT_YEAR;
      config.endYear = end || CURRENT_YEAR + 2;
      i += 2;
    } else if (arg === '--only' && args[i + 1]) {
      config.only = args[i + 1];
      i += 2;
    } else if (arg === '--serve' || arg === '-s') {
      config.serve = true;
      i++;
    } else if (arg === '--set-api' && args[i + 1]) {
      config.setApi = args[i + 1];
      i += 2;
    } else if (arg === '--merge') {
      config.merge = true;
      i++;
    } else if ((arg === '--input' || arg === '-i') && args[i + 1]) {
      config.mergeInput = [];
      i++;
      while (i < args.length && !args[i].startsWith('-')) {
        config.mergeInput.push(args[i]);
        i++;
      }
    } else if ((arg === '--output' || arg === '-o') && args[i + 1]) {
      config.mergeOutput = args[i + 1];
      i += 2;
    } else if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    } else {
      i++;
    }
  }

  return config;
}

/**
 * 校验命令行参数
 */
function validateArgs(config) {
  const VALID_ONLY = ['holidays', 'lunar', 'solar-terms', 'yiji', 'festivals'];

  if (config.startYear > config.endYear) {
    console.error('错误：起始年份不能大于结束年份');
    process.exit(1);
  }

  if (config.startYear < 1900 || config.startYear > 2100) {
    console.error(`错误：起始年份 ${config.startYear} 超出合理范围（1900-2100）`);
    process.exit(1);
  }
  if (config.endYear < 1900 || config.endYear > 2100) {
    console.error(`错误：结束年份 ${config.endYear} 超出合理范围（1900-2100）`);
    process.exit(1);
  }

  if (config.only && !VALID_ONLY.includes(config.only)) {
    console.error(`错误：未知的事件类型 "${config.only}"`);
    console.error(`  允许的值：${VALID_ONLY.join(', ')}`);
    process.exit(1);
  }
}

function printHelp() {
  console.log(`
用法：
  node src/index.js [选项]

选项：
  --years <YYYY-YYYY>   指定年份范围（默认：当前年-后两年）
  --only <type>          只生成指定类型
                           holidays   - 节假日+调休
                           lunar      - 农历日期
                           solar-terms - 二十四节气
                           yiji       - 每日宜忌
                           festivals  - 普通节日
  --set-api <url>        设置自定义节假日 API 地址
                           {year} 代表年份占位符
                           示例：--set-api "https://myapi.com/holiday/{year}"
  --merge                按 config.json 中的 mergeSources 合并多个 .ics 文件
  --input <files...>     合并指定的 .ics 文件（配合 --output 使用）
  --output <file>        合并输出文件名（默认：all-in-one.ics）
  --serve                启动 HTTP 服务（提供 .ics 订阅 URL）
  --help, -h             显示帮助

示例：
  node src/index.js
  node src/index.js --years 2024-2028
  node src/index.js --set-api "https://myapi.com/holiday/{year}"
  node src/index.js --merge
  node src/index.js --input output/a.ics output/b.ics -o my.ics
  node src/index.js --serve
`);
}

/**
 * 主函数
 */
async function main() {
  const config = parseArgs();
  validateArgs(config);

  // 处理 --set-api
  if (config.setApi) {
    setCustomHolidayApi(config.setApi);
    return;
  }

  // 处理 --merge（无 input 参数时从 config.json 读取）
  if (config.merge) {
    if (config.mergeInput && config.mergeInput.length > 0) {
      console.log(`[合并] 合并指定文件：${config.mergeInput.join(', ')}`);
      await mergeSources({
        sources: config.mergeInput,
        output: config.mergeOutput,
        calName: '合并日历',
        calDesc: '多个日历源合并',
      });
    } else {
      console.log('[合并] 按 config.json 配置合并...');
      await mergeFromConfig();
    }
    return;
  }

  console.log(`[主程序] 开始生成日历订阅文件...`);
  console.log(`  年份范围：${config.startYear} ~ ${config.endYear}`);
  if (config.only) {
    console.log(`  仅生成：${config.only}`);
  }

  const allData = {};
  const apiBase = getHolidayApiBase();
  if (apiBase !== 'https://timor.tech/api/holiday/year') {
    console.log(`  节假日 API：${apiBase}`);
  }

  // 1. 节假日 + 调休
  if (!config.only || config.only === 'holidays') {
    console.log(`\n[主程序] 抓取节假日数据...`);
    const years = [];
    for (let y = config.startYear; y <= config.endYear; y++) {
      years.push(y);
    }
    const holidaysData = await fetchHolidays(years);
    allData.holidayEvents = flattenHolidays(holidaysData);
    console.log(`  ✓ 获取到 ${Object.keys(holidaysData).length} 年的节假日数据`);
  }

  // 2. 农历 + 节气 + 宜忌
  if (!config.only || ['lunar', 'solar-terms', 'yiji'].includes(config.only)) {
    console.log(`\n[主程序] 计算农历/节气/宜忌数据...`);
    const { lunarEvents, solarTermEvents, yiJiEvents } = calcLunarEventsByYears(
      config.startYear,
      config.endYear
    );

    if (!config.only || config.only === 'lunar') {
      allData.lunarEvents = lunarEvents;
    }
    if (!config.only || config.only === 'solar-terms') {
      allData.solarTermEvents = solarTermEvents;
    }
    if (!config.only || config.only === 'yiji') {
      allData.yiJiEvents = yiJiEvents;
    }

    console.log(`  ✓ 农历事件：${lunarEvents.length} 条`);
    console.log(`  ✓ 节气事件：${solarTermEvents.length} 条`);
    console.log(`  ✓ 宜忌事件：${yiJiEvents.length} 条`);
  }

  // 3. 普通节日
  if (!config.only || config.only === 'festivals') {
    console.log(`\n[主程序] 生成普通节日数据...`);
    const festivalEvents = getFestivalEvents(config.startYear, config.endYear);
    allData.festivalEvents = festivalEvents;
    console.log(`  ✓ 普通节日：${festivalEvents.length} 条`);
  }

  // 4. 生成 .ics 文件
  console.log(`\n[主程序] 生成 .ics 文件...`);
  const files = generateAllICS(allData);

  // 5. 生成说明文件
  generateReadme(files);

  console.log(`\n✅ 全部完成！文件已保存至 output/ 目录`);
  console.log(`   共生成 ${files.length} 个 .ics 文件`);

  // 6. 如果指定了 --serve，启动 HTTP 服务
  if (config.serve) {
    startServer();
  }
}

/**
 * 启动简易 HTTP 服务，提供 .ics 文件订阅
 */
function startServer() {
  const http = require('http');
  const fs = require('fs');
  const path = require('path');

  const PORT = 3000;
  const OUTPUT_DIR = path.join(__dirname, '..', 'output');

  const server = http.createServer((req, res) => {
    let urlPath = req.url.split('?')[0];
    if (urlPath === '/') urlPath = '/index.html';
    const filePath = path.join(OUTPUT_DIR, urlPath);

    // 安全检查：只允许访问 output 目录下的文件
    if (!filePath.startsWith(OUTPUT_DIR)) {
      res.writeHead(403);
      res.end('Forbidden');
      return;
    }

    const ext = path.extname(filePath);
    if (!['.ics', '.txt', '.html'].includes(ext)) {
      res.writeHead(403);
      res.end('Forbidden');
      return;
    }

    fs.readFile(filePath, (err, data) => {
      if (err) {
        res.writeHead(404);
        res.end('Not Found');
        return;
      }

      const contentType = ext === '.ics' ? 'text/calendar; charset=utf-8'
                          : ext === '.txt' ? 'text/plain; charset=utf-8'
                          : 'text/html; charset=utf-8';
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(data);
    });
  });

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`\n🌐 HTTP 服务已启动：`);
    console.log(`   本地访问：http://localhost:${PORT}/`);
    console.log(`   订阅 URL（本机）：`);
    console.log(`     http://localhost:${PORT}/china-holidays.ics`);
    console.log(`     http://localhost:${PORT}/lunar-calendar.ics`);
    console.log(`     http://localhost:${PORT}/solar-terms.ics`);
    console.log(`     http://localhost:${PORT}/yi-ji.ics`);
    console.log(`     http://localhost:${PORT}/festivals.ics`);
    console.log(`     http://localhost:${PORT}/all-in-one.ics`);
    console.log(`\n  如需局域网其他设备访问，将 localhost 替换为本机 IP 地址`);
  });
}

main().catch(err => {
  console.error('[主程序] 错误：', err);
  process.exit(1);
});
