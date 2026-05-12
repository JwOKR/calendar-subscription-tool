/**
 * .ics 日历文件生成模块
 * 使用 ical-generator 库
 */

const { ICalCalendar, ICalEventStatus } = require('ical-generator');
const fs = require('fs');
const path = require('path');
const dayjs = require('dayjs');

const OUTPUT_DIR = path.join(__dirname, '..', 'output');

/**
 * 确保输出目录存在
 */
function ensureOutputDir() {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }
}

/**
 * 将事件列表写入 .ics 文件
 * @param {Object} opts
 * @param {string}   opts.filename  - 输出文件名（不含路径）
 * @param {string}   opts.calName   - 日历名称
 * @param {string}   opts.calDesc   - 日历描述
 * @param {Array}    opts.events    - 事件列表
 * @param {string}   [opts.color]   - 日历颜色（X-APPLE-CALENDAR-COLOR）
 */
function writeICS({ filename, calName, calDesc, events, color }) {
  ensureOutputDir();

  const cal = new ICalCalendar({
    name: calName,
    description: calDesc,
    timezone: 'Asia/Shanghai',
    prodId: { company: 'calendar-tool', product: 'subscription' },
  });

  if (color) {
    cal.x('X-APPLE-CALENDAR-COLOR', color);
  }

  for (const ev of events) {
    const eventOpts = {
      start: dayjs(ev.date).toDate(),
      summary: ev.summary,
      description: ev.description || '',
      allDay: true,
    };

    // 多日事件（节假日区间）
    // ical-generator 的 end 是独占的，所以 +1 天
    if (ev.endDate) {
      eventOpts.end = dayjs(ev.endDate).add(1, 'day').toDate();
    }

    // 忙闲状态
    if (ev.busy === 'free') {
      eventOpts.busyStatus = 'FREE';
    } else if (ev.busy === 'busy') {
      eventOpts.busyStatus = 'BUSY';
    }

    cal.createEvent(eventOpts);
  }

  const filePath = path.join(OUTPUT_DIR, filename);
  fs.writeFileSync(filePath, cal.toString(), 'utf-8');
  console.log(`[ICS] 已生成：${filePath}（${events.length} 个事件）`);
  return filePath;
}

/**
 * 生成所有日历文件
 * @param {Object} allData - { holidayEvents, lunarEvents, solarTermEvents, yiJiEvents }
 * @returns {string[]} - 生成的文件路径列表
 */
function generateAllICS(allData) {
  const files = [];

  // 1. 节假日 + 调休
  if (allData.holidayEvents && allData.holidayEvents.length > 0) {
    files.push(writeICS({
      filename: 'china-holidays.ics',
      calName: '中国节假日·调休',
      calDesc: '中国法定节假日与调休安排（数据源：timor.tech）',
      events: allData.holidayEvents,
      color: '#E74C3C',
    }));
  }

  // 2. 农历日期提醒
  if (allData.lunarEvents && allData.lunarEvents.length > 0) {
    files.push(writeICS({
      filename: 'lunar-calendar.ics',
      calName: '农历日期',
      calDesc: '农历初一及农历节日提醒（本地计算）',
      events: allData.lunarEvents,
      color: '#8E44AD',
    }));
  }

  // 3. 二十四节气
  if (allData.solarTermEvents && allData.solarTermEvents.length > 0) {
    files.push(writeICS({
      filename: 'solar-terms.ics',
      calName: '二十四节气',
      calDesc: '中国二十四节气（本地计算）',
      events: allData.solarTermEvents,
      color: '#27AE60',
    }));
  }

  // 4. 每日宜忌（数据量较大，可选）
  if (allData.yiJiEvents && allData.yiJiEvents.length > 0) {
    files.push(writeICS({
      filename: 'yi-ji.ics',
      calName: '每日宜忌',
      calDesc: '老黄历每日宜忌（本地计算）',
      events: allData.yiJiEvents,
      color: '#F39C12',
    }));
  }

  // 5. 普通节日（公历+国际+动态日期）
  if (allData.festivalEvents && allData.festivalEvents.length > 0) {
    files.push(writeICS({
      filename: 'festivals.ics',
      calName: '普通节日',
      calDesc: '中国公历节日、国际节日及动态日期节日（本地计算）',
      events: allData.festivalEvents,
      color: '#E67E22',
    }));
  }

  return files;
}

/**
 * 生成订阅版 .ics（含 URL，可用于 HTTP 订阅）
 * 将文件写入 output/ 目录，同时生成说明文件
 */
function generateReadme(files) {
  ensureOutputDir();
  const readmePath = path.join(OUTPUT_DIR, 'README.txt');
  const lines = [
    '=== 日历订阅源文件 ===',
    '',
    '将这些 .ics 文件导入你的日历应用即可订阅：',
    '',
  ];

  const descriptions = {
    'china-holidays.ics': '中国节假日·调休 — 导入后显示法定节假日和调休上班日',
    'lunar-calendar.ics': '农历日期 — 每月初一及农历节日提醒',
    'solar-terms.ics':  '二十四节气 — 每个节气当天提醒',
    'yi-ji.ics':        '每日宜忌 — 每日老黄历宜忌（事件较多，可选导入）',
  };

  for (const f of files) {
    const name = path.basename(f);
    lines.push(`  📅 ${name}`);
    lines.push(`     ${descriptions[name] || ''}`);
    lines.push('');
  }

  lines.push('=== 导入方式 ===');
  lines.push('iOS / macOS 日历：在「文件」>「导入」中选择 .ics 文件');
  lines.push('Google Calendar：设置 > 导入和导出 > 导入');
  lines.push('Outlook：文件 > 打开和导出 > 导入/导出 > 导入 iCalendar (.ics)');
  lines.push('');
  lines.push('如需订阅（自动更新），请将 .ics 文件放到可访问的 HTTP 服务器，');
  lines.push('然后在日历应用中选择「订阅」并填入 URL。');
  lines.push('');

  fs.writeFileSync(readmePath, lines.join('\n'), 'utf-8');
  console.log(`[ICS] 说明文件已生成：${readmePath}`);
}

module.exports = { writeICS, generateAllICS, generateReadme };
