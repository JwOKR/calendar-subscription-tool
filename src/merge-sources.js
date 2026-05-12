/**
 * 合并多个 .ics 订阅源
 * 支持：本地文件、远程 URL、本工具生成的其他 .ics 文件
 *
 * 用法：
 *   1. 在 config.json 中配置 mergeSources 列表
 *   2. 命令行：node src/merge-sources.js --output merged.ics --input file1.ics file2.ics
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const { ICalCalendar } = require('ical-generator');
const axios = require('axios');

const CONFIG_FILE = path.join(__dirname, '..', 'config.json');
const OUTPUT_DIR = path.join(__dirname, '..', 'output');

/**
 * 从本地文件或 URL 读取 .ics 内容
 * @param {string} source - 文件路径或 URL
 * @returns {Promise<string>} - .ics 文件内容
 */
async function fetchICSSource(source) {
  if (source.startsWith('http://') || source.startsWith('https://')) {
    const resp = await axios.get(source, { timeout: 15000 });
    return resp.data;
  } else {
    // 本地文件
    const filePath = path.resolve(source);
    if (!fs.existsSync(filePath)) {
      throw new Error(`文件不存在：${filePath}`);
    }
    return fs.readFileSync(filePath, 'utf-8');
  }
}

/**
 * 合并多个 .ics 源为一个 .ics 文件
 * @param {Object} opts
 * @param {string[]} opts.sources   - .ics 文件路径或 URL 列表
 * @param {string}   opts.output    - 输出文件名（output/ 目录下）
 * @param {string}   [opts.calName]  - 合并后日历名称
 * @param {string}   [opts.calDesc]  - 合并后日历描述
 * @returns {Promise<string>} - 输出文件路径
 */
async function mergeSources({ sources, output, calName = '合并日历', calDesc = '多个日历源合并' }) {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const cal = new ICalCalendar({
    name: calName,
    description: calDesc,
    timezone: 'Asia/Shanghai',
    prodId: { company: 'calendar-tool', product: 'merged' },
  });

  let totalEvents = 0;

  for (const source of sources) {
    console.log(`[合并] 读取源：${source}`);
    try {
      const icsContent = await fetchICSSource(source);

      // 用 ical-generator 解析并合并（简单方式：提取 VEVENT 块）
      const veventBlocks = icsContent.match(/BEGIN:VEVENT[\s\S]*?END:VEVENT/g) || [];

      for (const block of veventBlocks) {
        const summaryMatch = block.match(/SUMMARY:(.*)/);
        const descMatch = block.match(/DESCRIPTION:(.*)/);
        const dtStartMatch = block.match(/DTSTART(?:;VALUE=DATE)?:?(\d{8})/);
        const dtEndMatch = block.match(/DTEND(?:;VALUE=DATE)?:?(\d{8})/);

        if (!dtStartMatch) continue;

        const eventOpts = {
          start: parseDate(dtStartMatch[1]),
          summary: summaryMatch ? summaryMatch[1] : '未命名事件',
          description: descMatch ? descMatch[1].replace(/\\n/g, '\n') : '',
          allDay: true,
        };

        if (dtEndMatch) {
          eventOpts.end = parseDate(dtEndMatch[1]);
        }

        cal.createEvent(eventOpts);
        totalEvents++;
      }

      console.log(`  ✓ 提取 ${veventBlocks.length} 个事件`);
    } catch (e) {
      console.error(`  ✗ 读取失败：${e.message}`);
    }
  }

  const outputPath = path.join(OUTPUT_DIR, output);
  fs.writeFileSync(outputPath, cal.toString(), 'utf-8');
  console.log(`\n✅ 合并完成：${outputPath}`);
  console.log(`   共合并 ${totalEvents} 个事件，来源 ${sources.length} 个文件`);
  return outputPath;
}

/**
 * 将 YYYYMMDD 字符串解析为 Date 对象
 */
function parseDate(dateStr) {
  const y = parseInt(dateStr.slice(0, 4));
  const m = parseInt(dateStr.slice(4, 6)) - 1;
  const d = parseInt(dateStr.slice(6, 8));
  return new Date(y, m, d);
}

/**
 * 从 config.json 读取合并配置并执行合并
 */
async function mergeFromConfig() {
  if (!fs.existsSync(CONFIG_FILE)) {
    console.error('[合并] config.json 不存在，请先配置 mergeSources');
    console.log('示例 config.json 格式：');
    console.log(JSON.stringify({
      mergeSources: [
        'output/china-holidays.ics',
        'output/lunar-calendar.ics',
        'output/solar-terms.ics',
        'https://example.com/your-custom.ics',
      ],
      mergeOutput: 'all-in-one.ics',
      mergeCalName: '我的日历订阅',
    }, null, 2));
    return null;
  }

  const config = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
  const sources = config.mergeSources;
  if (!sources || !Array.isArray(sources)) {
    console.error('[合并] config.json 中未找到 mergeSources 数组');
    return null;
  }

  return await mergeSources({
    sources,
    output: config.mergeOutput || 'all-in-one.ics',
    calName: config.mergeCalName || '合并日历',
    calDesc: config.mergeCalDesc || '多个日历源合并',
  });
}

module.exports = { mergeSources, mergeFromConfig, fetchICSSource };
