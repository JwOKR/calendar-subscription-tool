/**
 * Cloudflare Workers - 动态生成/合并日历 ICS
 *
 * 用法：
 *   /api/calendar?sources=holidays,lunar,solar&holidayApi=xxx&year=2024-2027
 */

import dayjs from 'dayjs';
import { ICalCalendar } from 'ical-generator';
import axios from 'axios';

// ===== 内存缓存（实例生命周期内有效）=====
const memoryCache = new Map();

// ===== 辅助：去除字符串中的 emoji =====
function stripAllEmoji(str) {
  return str.replace(/[\u{1F300}-\u{1F5FF}]|[\u{1F600}-\u{1F64F}]|[\u{1F680}-\u{1F6FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F900}-\u{1F9FF}]|[\u{1F1E0}-\u{1F1FF}]/gu, '').replace(/\s+/g, ' ').trim();
}

// ===== 延迟加载业务模块 =====
let _lunarCalc, _festivals;

async function getLunarCalc() {
  if (!_lunarCalc) {
    const module = await import('./lunar-calc.js');
    _lunarCalc = module.default;
  }
  return _lunarCalc;
}

async function getFestivals() {
  if (!_festivals) {
    const module = await import('./festivals.js');
    _festivals = module.default;
  }
  return _festivals;
}

// ===== 节假日数据抓取（独立实现，支持自定义 API）=====

/**
 * 抓取单年节假日数据
 * @param {number} year
 * @param {string|null} apiBase - 自定义 API 模板，用 {year} 替换年份
 * @returns {Promise<Object>} - { holidays, workdays, holidayRanges }
 */
async function fetchYearHolidays(year, apiBase) {
  const cacheKey = `holiday-${year}-${apiBase || 'default'}`;
  if (memoryCache.has(cacheKey)) {
    return memoryCache.get(cacheKey);
  }

  const url = (apiBase || 'https://timor.tech/api/holiday/year/{year}').replace('{year}', year);
  console.log(`[fetch] 抓取 ${year} 节假日：${url}`);

  try {
    const resp = await axios.get(url, {
      timeout: 15000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; CalendarTool/1.0)',
        'Accept': 'application/json',
      },
    });

    const data = resp.data;
    let result;

    if (data.holiday) {
      // timor.tech 格式
      result = parseTimorFormat(data);
    } else if (data.holidays && Array.isArray(data.holidays)) {
      // 简化数组格式
      result = parseSimpleFormat(data);
    } else {
      throw new Error(`不支持的 API 返回格式（year=${year}）`);
    }

    memoryCache.set(cacheKey, result);
    return result;
  } catch (err) {
    console.error(`[fetch] ${year} 抓取失败：`, err.message);
    throw err;
  }
}

/**
 * 解析 timor.tech 格式
 * { holiday: { "01-01": { holiday:true, name:"元旦", wage:1, date:"2024-01-01" } } }
 */
function parseTimorFormat(data) {
  const holidayRanges = [];
  const workdays = [];
  const holidays = [];

  const entries = Object.entries(data.holiday || {});
  entries.sort((a, b) => a[1].date.localeCompare(b[1].date));

  let i = 0;

  while (i < entries.length) {
    const [mmdd, detail] = entries[i];

    if (detail.holiday === true) {
      const name = detail.name;
      let rangeEnd = detail.date;

      let j = i + 1;
      while (j < entries.length && entries[j][1].holiday === true) {
        const nextDate = dayjs(entries[j][1].date);
        const currentEndDate = dayjs(rangeEnd);
        // 日期必须连续（下一天 = 当前结束日期 +1 天）才合并
        if (nextDate.diff(currentEndDate.add(1, 'day'), 'day') === 0) {
          rangeEnd = entries[j][1].date;
          j++;
        } else {
          break;
        }
      }

      holidayRanges.push({ name, start: detail.date, end: rangeEnd, wage: detail.wage || 1 });

      let d = dayjs(detail.date);
      const end = dayjs(rangeEnd);
      while (d.isSame(end) || d.isBefore(end)) {
        holidays.push({ date: d.format('YYYY-MM-DD'), name, isOffDay: true });
        d = d.add(1, 'day');
      }

      i = j;
    } else if (detail.holiday === false && detail.name && detail.name.includes('补班')) {
      workdays.push({ date: detail.date, name: detail.name, isOffDay: false });
      i++;
    } else {
      i++;
    }
  }

  return { holidays, workdays, holidayRanges };
}

/**
 * 解析简化数组格式
 * { holidays: [{ date?, start?, end?, name }], workdays: [{ date, name }] }
 */
function parseSimpleFormat(data) {
  const holidayRanges = [];
  const workdays = [];
  const holidays = [];

  for (const h of data.holidays || []) {
    if (h.start && h.end) {
      holidayRanges.push({ name: h.name, start: h.start, end: h.end, wage: h.wage || 1 });
      let d = dayjs(h.start);
      const end = dayjs(h.end);
      while (d.isSame(end) || d.isBefore(end)) {
        holidays.push({ date: d.format('YYYY-MM-DD'), name: h.name, isOffDay: true });
        d = d.add(1, 'day');
      }
    } else {
      holidayRanges.push({ name: h.name, start: h.date, end: h.date, wage: h.wage || 1 });
      holidays.push({ date: h.date, name: h.name, isOffDay: true });
    }
  }

  for (const w of data.workdays || []) {
    workdays.push({ date: w.date, name: w.name || '调休上班', isOffDay: false });
  }

  return { holidays, workdays, holidayRanges };
}

/**
 * 将节假日数据转为日历事件列表
 */
function flattenHolidays(holidaysData, icons = true) {
  const prefix = icons ? '🎉 ' : '';
  const workPrefix = icons ? '💼 ' : '';
  const events = [];
  for (const [, data] of Object.entries(holidaysData)) {
    for (const range of data.holidayRanges || []) {
      events.push({
        date: range.start,
        endDate: range.end,
        summary: `${prefix}${range.name}（假期）`,
        description: `${range.name}假期 ${range.start} ~ ${range.end}`,
        type: 'holiday',
        busy: 'free',
      });
    }
    for (const wd of data.workdays || []) {
      events.push({
        date: wd.date,
        summary: `${workPrefix}${wd.name}`,
        description: '调休安排：需要上班',
        type: 'workday',
        busy: 'busy',
      });
    }
  }
  return events;
}

// ===== 事件去重 + 添加辅助 =====

/**
 * 生成事件的去重 key
 * 同一天 + 同标题视为重复（忽略 emoji 前缀差异）
 */
function dedupeKey(ev) {
  const date = ev.date || '';
  const summary = (ev.summary || '').replace(/^[\s\S]{0,4}?\s/, ''); // 去掉前 2 个字符（emoji+空格）
  const endDate = ev.endDate || '';
  return `${date}|${summary}|${endDate}`;
}

/**
 * 创建一个带去重功能的事件收集器
 * @returns {{ add: (cal, ev) => void, stats: () => { total: number, duplicates: number } }}
 */
function createEventCollector() {
  const seen = new Set();
  let total = 0;
  let duplicates = 0;

  function add(cal, ev) {
    const key = dedupeKey(ev);
    total++;
    if (seen.has(key)) {
      duplicates++;
      return;
    }
    seen.add(key);
    try {
      const opts = {
        summary: ev.summary || '',
        description: ev.description || '',
        allDay: true,
      };

      if (ev.endDate) {
        opts.start = dayjs(ev.date).toDate();
        opts.end = dayjs(ev.endDate).add(1, 'day').toDate();
      } else {
        opts.start = dayjs(ev.date).toDate();
      }

      if (ev.busy === 'busy') opts.busyStatus = 'BUSY';
      else if (ev.busy === 'free') opts.busyStatus = 'FREE';

      cal.createEvent(opts);
    } catch (e) {
      // 跳过无效事件
    }
  }

  return {
    add,
    stats() {
      return { total, duplicates, unique: total - duplicates };
    },
  };
}

// ===== 主生成逻辑 =====

async function generateCalendar({ sources, holidayApi, year, icons = true }) {
  const current = dayjs().year();
  let startYear, endYear;

  if (year) {
    if (year.includes('-')) {
      [startYear, endYear] = year.split('-').map(Number);
    } else {
      startYear = endYear = Number(year);
    }
  } else {
    startYear = current - 5;
    endYear = current + 2;
  }

  const cal = new ICalCalendar({ name: `定制日历 ${startYear}-${endYear}` });
  const collector = createEventCollector();

  // 1. 节假日
  if (sources.includes('holidays')) {
    console.log('[generate] 抓取节假日数据...');
    try {
      const years = [];
      for (let y = startYear; y <= endYear; y++) years.push(y);

      const holidaysData = {};
      for (const y of years) {
        holidaysData[y] = await fetchYearHolidays(y, holidayApi || null);
      }

      const events = flattenHolidays(holidaysData, icons);
      events.forEach(ev => collector.add(cal, ev));
      console.log(`[generate] 节假日事件：${events.length} 条`);
    } catch (e) {
      console.error('[generate] 节假日抓取失败：', e.message);
    }
  }

  // 2. 农历 + 节气 + 宜忌
  const { calcLunarEventsByYears } = await getLunarCalc();
  const lunarData = calcLunarEventsByYears(startYear, endYear);

  function processEvents(evList) {
    if (!icons) evList.forEach(ev => { ev.summary = stripAllEmoji(ev.summary); });
    evList.forEach(ev => collector.add(cal, ev));
  }

  if (sources.includes('lunar') && lunarData.lunarEvents) {
    console.log(`[generate] 农历事件：${lunarData.lunarEvents.length} 条`);
    processEvents(lunarData.lunarEvents);
  }
  if (sources.includes('solar') && lunarData.solarTermEvents) {
    console.log(`[generate] 节气事件：${lunarData.solarTermEvents.length} 条`);
    processEvents(lunarData.solarTermEvents);
  }
  if (sources.includes('yiji') && lunarData.yiJiEvents) {
    console.log(`[generate] 宜忌事件：${lunarData.yiJiEvents.length} 条`);
    processEvents(lunarData.yiJiEvents);
  }

  // 3. 普通节日
  if (sources.includes('festivals')) {
    console.log('[generate] 生成普通节日...');
    try {
      const { getFestivalEvents } = await getFestivals();
      const events = getFestivalEvents(startYear, endYear);
      if (!icons) events.forEach(ev => { ev.summary = stripAllEmoji(ev.summary); });
      events.forEach(ev => collector.add(cal, ev));
      console.log(`[generate] 节日事件：${events.length} 条`);
    } catch (e) {
      console.error('[generate] 节日生成失败：', e.message);
    }
  }

  const { unique, duplicates: dupCount } = collector.stats();
  if (dupCount > 0) {
    console.log(`[generate] 去重完成：共 ${unique} 条唯一事件，移除 ${dupCount} 条重复`);
  }

  return cal.toString();
}

// ===== GitHub Pages 静态文件代理（标准请求走静态文件，更可靠）=====

const GITHUB_PAGES_BASE = 'https://jwokr.github.io/calendar-subscription-tool/';

// 标准 sources 组合 → 静态文件名映射
const STATIC_FILE_MAP = {
  'holidays': 'china-holidays',
  'lunar': 'lunar-calendar',
  'solar': 'solar-terms',
  'yiji': 'yi-ji',
  'festivals': 'festivals',
  'holidays,lunar,solar,festivals': 'all-in-one',
};

/**
 * 尝试从 GitHub Pages 获取静态 ICS 文件
 * 仅适用于标准请求（无自定义 year/holidayApi）
 * @returns {Promise<string|null>}
 */
async function fetchStaticICS(sourcesKey, icons) {
  const baseName = STATIC_FILE_MAP[sourcesKey];
  if (!baseName) return null;

  const suffix = icons ? '' : '-noicon';
  const url = `${GITHUB_PAGES_BASE}${baseName}${suffix}.ics`;

  console.log(`[静态代理] 请求：${url}`);
  try {
    const resp = await fetch(url, {
      headers: { 'User-Agent': 'CalendarTool/1.0' },
    });
    if (!resp.ok) {
      console.log(`[静态代理] 失败：HTTP ${resp.status}`);
      return null;
    }
    const text = await resp.text();
    // 简单校验：确保是有效的 ICS
    if (!text.includes('BEGIN:VCALENDAR')) {
      console.log('[静态代理] 返回内容非 ICS');
      return null;
    }
    console.log(`[静态代理] 成功，${text.length} 字节`);
    return text;
  } catch (e) {
    console.log(`[静态代理] 异常：${e.message}`);
    return null;
  }
}

// ===== Cloudflare Workers Handler =====

/**
 * 生成美化版 HTML 页面
 */
function renderHTML(origin) {
  const repoUrl = `${origin}/api/calendar`;

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>📅 日历订阅源 (Cloudflare Workers)</title>
    <style>
        * { margin:0; padding:0; box-sizing:border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); min-height:100vh; padding:20px; }
        .container { max-width:800px; margin:0 auto; }
        .header-card { background:white; border-radius:20px; padding:40px; margin-bottom:20px; box-shadow:0 20px 60px rgba(0,0,0,0.3); text-align:center; }
        h1 { color:#667eea; margin-bottom:10px; font-size:28px; }
        .update-time { color:#999; font-size:14px; }
        .section-title { color:white; font-size:20px; font-weight:700; margin:30px 0 15px 5px; text-shadow:0 2px 4px rgba(0,0,0,0.2); }
        .card { background:white; border-radius:16px; padding:24px; margin-bottom:15px; border-left:5px solid #667eea; box-shadow:0 4px 12px rgba(0,0,0,0.1); transition:transform 0.2s, box-shadow 0.2s; }
        .card:hover { transform:translateX(6px); box-shadow:0 8px 20px rgba(0,0,0,0.15); }
        .card h3 { color:#333; margin-bottom:8px; font-size:17px; }
        .card p { color:#666; font-size:14px; margin-bottom:14px; line-height:1.5; }
        .card.a-allinone { border-left-color:#48bb78; background:linear-gradient(135deg, #f0fff4 0%, #c6f6d5 100%); }
        .subscription-url { background:#f8f9fa; border:2px solid #e9ecef; border-radius:10px; padding:12px 16px; font-family:'Courier New',monospace; font-size:13px; color:#667eea; word-break:break-all; cursor:pointer; transition:all 0.2s; user-select:all; }
        .subscription-url:hover { background:#e7f0ff; border-color:#667eea; }
        .badge { display:inline-block; background:#667eea; color:white; padding:3px 10px; border-radius:12px; font-size:11px; margin-left:8px; font-weight:600; vertical-align:middle; }
        .btn { display:inline-block; padding:14px 32px; border-radius:12px; text-decoration:none; font-weight:600; font-size:15px; transition:all 0.2s; cursor:pointer; border:none; }
        .btn-primary { background:linear-gradient(135deg, #667eea 0%, #764ba2 100%); color:white; box-shadow:0 4px 12px rgba(102,126,234,0.4); }
        .btn-primary:hover { transform:translateY(-2px); box-shadow:0 6px 20px rgba(102,126,234,0.5); }
        .guide-card { background:white; border-radius:16px; padding:30px; margin-bottom:20px; box-shadow:0 4px 12px rgba(0,0,0,0.1); }
        .guide-card h2 { color:#667eea; margin-bottom:20px; font-size:22px; }
        .step { display:flex; margin-bottom:20px; align-items:flex-start; }
        .step-num { background:linear-gradient(135deg, #667eea 0%, #764ba2 100%); color:white; width:36px; height:36px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-weight:700; font-size:16px; flex-shrink:0; margin-right:16px; margin-top:2px; }
        .step-content { flex:1; }
        .step-content h4 { color:#333; margin-bottom:6px; font-size:15px; }
        .step-content p { color:#666; font-size:14px; line-height:1.6; }
        .tab-bar { display:flex; border-bottom:2px solid rgba(255,255,255,0.3); margin-bottom:20px; }
        .tab { padding:12px 24px; cursor:pointer; color:rgba(255,255,255,0.7); font-weight:500; border-bottom:2px solid transparent; margin-bottom:-2px; transition:all 0.2s; }
        .tab.active { color:white; border-bottom-color:white; font-weight:600; }
        .tab-content { display:none; }
        .tab-content.active { display:block; }
        .copy-toast { position:fixed; bottom:30px; left:50%; transform:translateX(-50%) translateY(100px); background:#333; color:white; padding:12px 24px; border-radius:10px; font-size:14px; transition:transform 0.3s; z-index:999; }
        .copy-toast.show { transform:translateX(-50%) translateY(0); }
        .footer { text-align:center; color:rgba(255,255,255,0.8); font-size:13px; margin-top:30px; padding-bottom:20px; }
        .footer a { color:white; text-decoration:underline; }
    </style>
</head>
<body>
    <div class="container">
        <!-- 头部 -->
        <div class="header-card">
            <h1>📅 日历订阅源</h1>
            <div class="update-time">⚡ 由 Cloudflare Workers 动态生成</div>
        </div>

        <!-- 标签栏 -->
        <div class="tab-bar">
            <div class="tab active" onclick="switchTab('subscribe')">📡 订阅日历</div>
            <div class="tab" onclick="switchTab('customize')">⚙️ 定制我的日历</div>
            <div class="tab" onclick="switchTab('guide')">📱 使用教程</div>
        </div>

        <!-- 订阅标签页 -->
        <div id="tab-subscribe" class="tab-content active">
            <div style="background:white; border-radius:12px; padding:14px 20px; margin-bottom:20px; box-shadow:0 4px 12px rgba(0,0,0,0.1); display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:10px;">
                <span style="color:#333; font-weight:600; font-size:15px;">🎨 事件名称显示图标</span>
                <label style="position:relative; display:inline-block; width:48px; height:26px; cursor:pointer;">
                    <input type="checkbox" id="globalIconsToggle" checked style="opacity:0; width:0; height:0;" onchange="toggleIcons()">
                    <span style="position:absolute; inset:0; background:#ccc; border-radius:26px; transition:0.3s;"></span>
                    <span id="toggleDot" style="position:absolute; left:3px; top:3px; width:20px; height:20px; background:white; border-radius:50%; transition:0.3s; box-shadow:0 2px 4px rgba(0,0,0,0.2); transform:translateX(22px);"></span>
                </label>
            </div>

            <div class="section-title">🇨🇳 中国节假日 <span class="badge">推荐</span></div>
            <div class="card">
                <h3>🇨🇳 中国节假日</h3>
                <p>国务院办公厅发布的法定节假日 + 调休安排</p>
                <div class="subscription-url" onclick="copyToClipboard(this)">${repoUrl}?sources=holidays</div>
            </div>

            <div class="section-title">🌙 农历 · 节气 · 宜忌</div>
            <div class="card">
                <h3>🌙 农历日历</h3>
                <p>农历日期 + 传统节日（春节、中秋、端午等）</p>
                <div class="subscription-url" onclick="copyToClipboard(this)">${repoUrl}?sources=lunar</div>
            </div>
            <div class="card">
                <h3>☀️ 二十四节气</h3>
                <p>完整二十四节气，精准到分钟</p>
                <div class="subscription-url" onclick="copyToClipboard(this)">${repoUrl}?sources=solar</div>
            </div>
            <div class="card">
                <h3>📋 宜忌日历</h3>
                <p>每日宜忌 + 吉神凶煞（传统黄历）</p>
                <div class="subscription-url" onclick="copyToClipboard(this)">${repoUrl}?sources=yiji</div>
            </div>

            <div class="section-title">🎉 节日 · 全能</div>
            <div class="card">
                <h3>🎉 普通节日</h3>
                <p>公历节日 + 国际节日 + 动态日期节日</p>
                <div class="subscription-url" onclick="copyToClipboard(this)">${repoUrl}?sources=festivals</div>
            </div>
            <div class="card a-allinone">
                <h3>🚀 全能日历 <span class="badge" style="background:#48bb78;">ALL-IN-ONE</span></h3>
                <p>合并所有日历源，一个订阅搞定所有</p>
                <div style="display:flex; flex-wrap:wrap; gap:6px; margin-bottom:14px;">
                    <span style="background:rgba(72,187,120,0.15); color:#2f855a; padding:3px 10px; border-radius:8px; font-size:12px; font-weight:600;">🇨🇳 中国节假日</span>
                    <span style="background:rgba(72,187,120,0.15); color:#2f855a; padding:3px 10px; border-radius:8px; font-size:12px; font-weight:600;">🌙 农历日历</span>
                    <span style="background:rgba(72,187,120,0.15); color:#2f855a; padding:3px 10px; border-radius:8px; font-size:12px; font-weight:600;">☀️ 二十四节气</span>
                    <span style="background:rgba(72,187,120,0.15); color:#2f855a; padding:3px 10px; border-radius:8px; font-size:12px; font-weight:600;">🎉 普通节日</span>
                </div>
                <div class="subscription-url" onclick="copyToClipboard(this)">${repoUrl}?sources=holidays,lunar,solar,festivals</div>
            </div>
        </div>

        <!-- 定制标签页 -->
        <div id="tab-customize" class="tab-content">
            <div class="guide-card">
                <h2>⚙️ 定制我的日历</h2>
                <p style="color:#666; margin-bottom:24px; line-height:1.6;">填写以下配置，生成属于你的个性化日历订阅链接：</p>
                
                <!-- 配置表单 -->
                <div style="background:#f8f9fa; padding:20px; border-radius:12px; margin-bottom:20px;">
                    <div style="margin-bottom:16px;">
                        <label style="display:block; color:#333; font-weight:600; margin-bottom:6px;">📡 自定义节假日 API（可选）</label>
                        <input type="text" id="holidayApi" placeholder="例如：https://timor.tech/api/holiday/year/{year}" value="https://timor.tech/api/holiday/year/{year}" style="width:100%; padding:10px; border:2px solid #e9ecef; border-radius:8px; font-size:14px;">
                        <small style="color:#999; margin-top:4px; display:block;">留空使用默认 API。{year} 会被替换为年份。</small>
                    </div>
                    
                    <div style="margin-bottom:16px;">
                        <label style="display:block; color:#333; font-weight:600; margin-bottom:8px;">📋 选择要包含的订阅源</label>
                        <label style="display:block; margin-bottom:8px; cursor:pointer;">
                            <input type="checkbox" id="src-holidays" checked style="margin-right:8px;"> 🇨🇳 中国节假日（法定假日 + 调休）
                        </label>
                        <label style="display:block; margin-bottom:8px; cursor:pointer;">
                            <input type="checkbox" id="src-lunar" checked style="margin-right:8px;"> 🌙 农历日历
                        </label>
                        <label style="display:block; margin-bottom:8px; cursor:pointer;">
                            <input type="checkbox" id="src-solar" checked style="margin-right:8px;"> ☀️ 二十四节气
                        </label>
                        <label style="display:block; margin-bottom:8px; cursor:pointer;">
                            <input type="checkbox" id="src-yiji" style="margin-right:8px;"> 📋 宜忌日历
                        </label>
                        <label style="display:block; margin-bottom:8px; cursor:pointer;">
                            <input type="checkbox" id="src-festivals" checked style="margin-right:8px;"> 🎉 普通节日
                        </label>
                    </div>
                    
                    <div style="margin-bottom:16px;">
                        <label style="display:block; color:#333; font-weight:600; margin-bottom:6px;">📅 年份范围</label>
                        <input type="text" id="yearRange" value="2024-2027" placeholder="例如：2024-2027" style="width:200px; padding:10px; border:2px solid #e9ecef; border-radius:8px; font-size:14px;">
                    </div>

                    <div style="margin-bottom:16px;">
                        <label style="display:block; color:#333; font-weight:600; margin-bottom:8px;">🎨 显示图标</label>
                        <label style="display:inline-flex; align-items:center; cursor:pointer; margin-right:20px;">
                            <input type="radio" name="icons" value="true" checked style="margin-right:6px;"> 显示 emoji 图标（🎉 元旦（假期））
                        </label>
                        <label style="display:inline-flex; align-items:center; cursor:pointer;">
                            <input type="radio" name="icons" value="false" style="margin-right:6px;"> 不显示图标（元旦（假期））
                        </label>
                    </div>
                    
                    <button onclick="generateCustomSubscription()" class="btn btn-primary" style="width:100%;">🚀 生成我的订阅链接</button>
                </div>
                
                <!-- 生成的订阅链接 -->
                <div id="custom-result" style="display:none; background:linear-gradient(135deg, #f0fff4 0%, #c6f6d5 100%); padding:20px; border-radius:12px; border-left:5px solid #48bb78;">
                    <h4 style="color:#2f855a; margin-bottom:10px;">✅ 你的个性化订阅链接已生成！</h4>
                    <div class="subscription-url" id="custom-url" onclick="copyToClipboard(this)" style="margin-bottom:12px;"></div>
                    <p style="color:#666; font-size:13px;">💡 将此链接添加到你的日历应用（iOS 日历、Google Calendar、Outlook 等）</p>
                </div>
            </div>
        </div>

        <!-- 教程标签页 -->
        <div id="tab-guide" class="tab-content">
            <div class="guide-card">
                <h2>📱 如何订阅日历？</h2>

                <div class="step">
                    <div class="step-num">1</div>
                    <div class="step-content">
                        <h4>🍎 iOS / iPadOS</h4>
                        <p>打开 "日历" 应用 → 点击 "日历" → "添加日历" → "订阅日历" → 粘贴链接</p>
                    </div>
                </div>

                <div class="step">
                    <div class="step-num">2</div>
                    <div class="step-content">
                        <h4>🤖 Android (Google Calendar)</h4>
                        <p>打开 <a href="https://calendar.google.com" target="_blank">calendar.google.com</a> → 设置 → 添加日历 → 通过 URL → 粘贴链接</p>
                    </div>
                </div>

                <div class="step">
                    <div class="step-num">3</div>
                    <div class="step-content">
                        <h4>📧 Outlook</h4>
                        <p>打开 Outlook → "添加日历" → "从互联网" → 粘贴 ICS 链接</p>
                    </div>
                </div>
            </div>
        </div>

        <div class="footer">
            <p>⚡ 由 Cloudflare Workers 动态生成 | 支持自定义参数</p>
            <p style="margin-top:8px;">💡 点击订阅链接可复制 | <a href="https://github.com/JwOKR/calendar-subscription-tool" target="_blank">GitHub 仓库</a></p>
        </div>
    </div>

    <div class="copy-toast" id="copyToast">✅ 已复制到剪贴板！</div>

    <script>
        const BASE_API = '${repoUrl}';
        const SUBSCRIBE_URLS = [
            { sources: 'holidays' },
            { sources: 'lunar' },
            { sources: 'solar' },
            { sources: 'yiji' },
            { sources: 'festivals' },
            { sources: 'holidays,lunar,solar,festivals' },
        ];

        function toggleIcons() {
            const checked = document.getElementById('globalIconsToggle').checked;
            const dot = document.getElementById('toggleDot');
            const track = dot.previousElementSibling;
            if (checked) {
                dot.style.transform = 'translateX(22px)';
                track.style.background = '#667eea';
            } else {
                dot.style.transform = 'translateX(0)';
                track.style.background = '#ccc';
            }
            updateSubscribeUrls(checked);
        }

        function updateSubscribeUrls(showIcons) {
            const urls = document.querySelectorAll('#tab-subscribe .subscription-url');
            urls.forEach((el, i) => {
                if (i < SUBSCRIBE_URLS.length) {
                    let url = BASE_API + '?sources=' + SUBSCRIBE_URLS[i].sources;
                    if (!showIcons) url += '&icons=false';
                    el.textContent = url;
                }
            });
        }

        function switchTab(tabName) {
            document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            if (tabName === 'subscribe') {
                document.querySelectorAll('.tab')[0].classList.add('active');
                document.getElementById('tab-subscribe').classList.add('active');
            } else if (tabName === 'customize') {
                document.querySelectorAll('.tab')[1].classList.add('active');
                document.getElementById('tab-customize').classList.add('active');
            } else {
                document.querySelectorAll('.tab')[2].classList.add('active');
                document.getElementById('tab-guide').classList.add('active');
            }
        }
        function copyToClipboard(element) {
            const text = element.textContent;
            navigator.clipboard.writeText(text).then(() => {
                const toast = document.getElementById('copyToast');
                toast.classList.add('show');
                setTimeout(() => toast.classList.remove('show'), 2000);
            });
        }
        // 初始化：开关默认开启（蓝色）
        document.getElementById('globalIconsToggle').nextElementSibling.style.background = '#667eea';
        function generateCustomSubscription() {
            const holidayApi = document.getElementById('holidayApi').value.trim();
            const yearRange = document.getElementById('yearRange').value.trim();
            
            // 获取选中的订阅源
            const sources = [];
            if (document.getElementById('src-holidays').checked) sources.push('holidays');
            if (document.getElementById('src-lunar').checked) sources.push('lunar');
            if (document.getElementById('src-solar').checked) sources.push('solar');
            if (document.getElementById('src-yiji').checked) sources.push('yiji');
            if (document.getElementById('src-festivals').checked) sources.push('festivals');
            
            if (sources.length === 0) {
                alert('请至少选择一个订阅源！');
                return;
            }
            
            // 构建 API URL
            let apiUrl = '/api/calendar?sources=' + sources.join(',');
            if (holidayApi) {
                apiUrl += '&holidayApi=' + encodeURIComponent(holidayApi);
            }
            if (yearRange) {
                apiUrl += '&year=' + encodeURIComponent(yearRange);
            }
            if (document.querySelector('input[name="icons"]:checked').value === 'false') {
                apiUrl += '&icons=false';
            }
            
            // 显示结果
            const resultDiv = document.getElementById('custom-result');
            const urlDiv = document.getElementById('custom-url');
            urlDiv.textContent = window.location.origin + apiUrl;
            resultDiv.style.display = 'block';
            resultDiv.scrollIntoView({ behavior: 'smooth' });
        }
    </script>
</body>
</html>`;
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    // 根路径返回网页界面
    if (path === '/' || path === '') {
      const html = renderHTML(url.origin);
      return new Response(html, {
        status: 200,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      });
    }

    // CORS 头部
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 200,
        headers: corsHeaders,
      });
    }

    const { searchParams } = url;

    try {
      const sources = searchParams.get('sources');
      const holidayApi = searchParams.get('holidayApi');
      const year = searchParams.get('year');
      const iconsStr = searchParams.get('icons');

      // icons 参数：默认 true；显式传 false 才关闭
      const icons = iconsStr !== 'false';

      const sourceList = sources
        ? sources.split(',').map(s => s.trim().toLowerCase())
        : ['holidays', 'lunar', 'solar', 'festivals'];

      const validSources = ['holidays', 'lunar', 'solar', 'yiji', 'festivals'];
      const filtered = sourceList.filter(s => validSources.includes(s));

      if (filtered.length === 0) {
        return new Response(JSON.stringify({ error: '至少需要一个有效的 sources 参数' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }

      console.log(`[API] 请求：sources=${filtered.join(',')} year=${year || 'default'} icons=${icons}`);

      // 判断是否为标准请求（无自定义 year/holidayApi），优先走静态文件代理
      const sourcesKey = filtered.join(',');
      const isStandardRequest = !year && !holidayApi;
      let icsContent = null;

      if (isStandardRequest) {
        icsContent = await fetchStaticICS(sourcesKey, icons);
      }

      // 静态代理失败或非标准请求，走动态生成
      if (!icsContent) {
        if (isStandardRequest) {
          console.log('[API] 静态代理未命中，回退动态生成...');
        }
        icsContent = await generateCalendar({
          sources: filtered,
          holidayApi: holidayApi || null,
          year: year || null,
          icons,
        });
      }

      const filename = `calendar-${filtered.join('-')}.ics`;
      const headers = {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 's-maxage=3600, stale-while-revalidate=86400',
        ...corsHeaders,
      };

      return new Response(icsContent, {
        status: 200,
        headers,
      });

    } catch (error) {
      console.error('[API] 错误：', error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }
  },
};
