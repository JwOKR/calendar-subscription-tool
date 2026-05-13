/**
 * Cloudflare Workers - 日历订阅源生成工具
 *
 * 用法：
 *   /           → 网页界面（选择订阅源）
 *   /calendar.ics?sources=holidays,lunar,solar → 下载 ICS 文件
 *
 * iOS 兼容：使用 webcal:// 协议订阅
 */

import dayjs from 'dayjs';
import { ICalCalendar } from 'ical-generator';
import { Lunar, Solar } from 'lunar-javascript';

// ===== 配置 =====
const DEFAULT_HOLIDAY_API = 'https://timor.tech/api/holiday/year';
const CACHE_TTL = 3600;

// ===== HTML 网页界面 =====

function renderHTMLPage() {
  const currentYear = dayjs().year();
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>📅 日历订阅源生成工具</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 20px; }
    .container { background: white; border-radius: 16px; box-shadow: 0 20px 60px rgba(0,0,0,0.3); max-width: 600px; width: 100%; overflow: hidden; }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; }
    .header h1 { font-size: 28px; margin-bottom: 8px; }
    .header p { opacity: 0.9; font-size: 14px; }
    .content { padding: 30px; }
    .section { margin-bottom: 25px; }
    .section h3 { font-size: 16px; color: #333; margin-bottom: 12px; padding-bottom: 8px; border-bottom: 2px solid #667eea; }
    .checkbox-group { display: flex; flex-direction: column; gap: 10px; }
    .checkbox-item { display: flex; align-items: center; padding: 12px 15px; background: #f8f9fa; border-radius: 8px; cursor: pointer; transition: all 0.2s; }
    .checkbox-item:hover { background: #e9ecef; transform: translateX(5px); }
    .checkbox-item input[type="checkbox"] { width: 18px; height: 18px; margin-right: 12px; cursor: pointer; }
    .checkbox-item label { cursor: pointer; flex: 1; font-size: 15px; }
    .checkbox-item .desc { font-size: 12px; color: #666; margin-left: 10px; }
    .year-input { display: flex; gap: 10px; align-items: center; }
    .year-input input { padding: 10px 15px; border: 2px solid #ddd; border-radius: 8px; font-size: 14px; width: 100px; transition: border-color 0.2s; }
    .year-input input:focus { outline: none; border-color: #667eea; }
    .year-input span { color: #666; }
    .buttons { display: flex; gap: 10px; margin-top: 25px; }
    .btn { flex: 1; padding: 14px 20px; border: none; border-radius: 8px; font-size: 15px; font-weight: 600; cursor: pointer; transition: all 0.2s; }
    .btn-primary { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; }
    .btn-primary:hover { transform: translateY(-2px); box-shadow: 0 5px 15px rgba(102,126,234,0.4); }
    .btn-secondary { background: #f8f9fa; color: #333; border: 2px solid #ddd; }
    .btn-secondary:hover { background: #e9ecef; }
    .result { margin-top: 20px; padding: 15px; background: #d4edda; border-radius: 8px; display: none; }
    .result.show { display: block; }
    .result a { color: #155724; font-weight: 600; word-break: break-all; }
    .ios-tip { margin-top: 15px; padding: 12px; background: #cce5ff; border-radius: 8px; font-size: 13px; color: #004085; display: none; }
    .ios-tip.show { display: block; }
    .footer { text-align: center; padding: 20px; color: #999; font-size: 12px; border-top: 1px solid #eee; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>📅 日历订阅源生成工具</h1>
      <p>选择你需要的中文日历订阅源，一键生成 ICS 文件</p>
    </div>
    <div class="content">
      <form id="calendarForm">
        <div class="section">
          <h3>📋 选择日历数据源</h3>
          <div class="checkbox-group">
            <div class="checkbox-item">
              <input type="checkbox" id="holidays" name="sources" value="holidays" checked>
              <label for="holidays">🇨🇳 中国法定节假日</label>
              <span class="desc">国务院办公厅放假安排 + 调休</span>
            </div>
            <div class="checkbox-item">
              <input type="checkbox" id="lunar" name="sources" value="lunar" checked>
              <label for="lunar">🌙 农历日历</label>
              <span class="desc">农历日期 + 传统节日</span>
            </div>
            <div class="checkbox-item">
              <input type="checkbox" id="solar" name="sources" value="solar" checked>
              <label for="solar">☀️ 二十四节气</label>
              <span class="desc">完整24节气</span>
            </div>
            <div class="checkbox-item">
              <input type="checkbox" id="yiji" name="sources" value="yiji">
              <label for="yiji">📅 宜忌日历</label>
              <span class="desc">每日宜忌 + 天干地支</span>
            </div>
            <div class="checkbox-item">
              <input type="checkbox" id="festivals" name="sources" value="festivals" checked>
              <label for="festivals">🎉 公历节日</label>
              <span class="desc">元旦、劳动节、国庆节等</span>
            </div>
          </div>
        </div>

        <div class="section">
          <h3>📆 选择年份范围</h3>
          <div class="year-input">
            <input type="number" id="startYear" value="${currentYear}" min="1900" max="2100">
            <span>至</span>
            <input type="number" id="endYear" value="${currentYear + 2}" min="1900" max="2100">
          </div>
        </div>

        <div class="section">
          <h3>⚙️ 高级选项</h3>
          <div class="checkbox-group">
            <div class="checkbox-item">
              <input type="checkbox" id="icons" checked>
              <label for="icons">🎨 包含 Emoji 图标</label>
            </div>
          </div>
        </div>

        <div class="buttons">
          <button type="button" class="btn btn-secondary" onclick="selectAll()">全选</button>
          <button type="button" class="btn btn-secondary" onclick="selectNone()">清空</button>
          <button type="submit" class="btn btn-primary">📥 生成订阅链接</button>
        </div>
      </form>

      <div id="result" class="result">
        <strong>✅ 订阅链接已生成！</strong>
        <p style="margin-top: 10px;">复制以下链接到日历应用：</p>
        <p style="margin-top: 8px;"><a id="subscribeUrl" href="#" target="_blank"></a></p>
        <p style="margin-top: 10px;">
          <button class="btn btn-primary" onclick="copyLink()" style="padding: 8px 15px; font-size: 13px;">📋 复制链接</button>
          <button class="btn btn-secondary" onclick="copyWebcal()" style="padding: 8px 15px; font-size: 13px; margin-left: 10px;">🍎 iOS 订阅链接</button>
        </p>
      </div>

      <div id="iosTip" class="ios-tip">
        💡 <strong>iOS 用户：</strong>复制上方「iOS 订阅链接」，然后在「日历」App 中选择「添加日历」→「添加订阅日历」，粘贴链接即可。
      </div>
    </div>
    <div class="footer">
      Powered by Cloudflare Workers | <a href="https://github.com/JwOKR/calendar-subscription-tool" style="color: #667eea;">GitHub</a>
    </div>
  </div>

  <script>
    function selectAll() {
      document.querySelectorAll('input[name="sources"]').forEach(cb => cb.checked = true);
    }
    function selectNone() {
      document.querySelectorAll('input[name="sources"]').forEach(cb => cb.checked = false);
    }

    document.getElementById('calendarForm').addEventListener('submit', function(e) {
      e.preventDefault();

      const sources = [];
      document.querySelectorAll('input[name="sources"]:checked').forEach(cb => {
        sources.push(cb.value);
      });

      if (sources.length === 0) {
        alert('请至少选择一个数据源！');
        return;
      }

      const startYear = document.getElementById('startYear').value;
      const endYear = document.getElementById('endYear').value;
      const icons = document.getElementById('icons').checked;

      let url = '/calendar.ics?sources=' + sources.join(',');
      if (startYear && endYear && startYear !== endYear) {
        url += '&year=' + startYear + '-' + endYear;
      } else if (startYear) {
        url += '&year=' + startYear;
      }
      if (!icons) url += '&icons=false';

      const fullUrl = window.location.origin + url;
      const webcalUrl = 'webcal://' + window.location.host + url;

      const resultDiv = document.getElementById('result');
      const urlLink = document.getElementById('subscribeUrl');
      urlLink.href = fullUrl;
      urlLink.textContent = fullUrl;
      resultDiv.classList.add('show');

      // 存储 webcal URL 供复制使用
      document.getElementById('result').dataset.webcalUrl = webcalUrl;
      document.getElementById('iosTip').classList.add('show');
    });

    function copyLink() {
      const url = document.getElementById('subscribeUrl').href;
      navigator.clipboard.writeText(url).then(() => {
        alert('✅ 链接已复制到剪贴板！');
      });
    }

    function copyWebcal() {
      const url = document.getElementById('result').dataset.webcalUrl;
      navigator.clipboard.writeText(url).then(() => {
        alert('✅ iOS 订阅链接已复制！\\n\\n请在 iOS 日历 App 中：\\n1. 点击「日历」→「添加日历」\\n2. 选择「添加订阅日历」\\n3. 粘贴此链接');
      });
    }
  </script>
</body>
</html>`;
}

// ===== 辅助函数 =====

function stripEmoji(str) {
  return str.replace(/[\u{1F300}-\u{1F5FF}]|[\u{1F600}-\u{1F64F}]|[\u{1F680}-\u{1F6FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F900}-\u{1F9FF}]|[\u{1F1E0}-\u{1F1FF}]/gu, '').replace(/\s+/g, ' ').trim();
}

async function fetchHolidays(year, apiBase = null) {
  const url = (apiBase || DEFAULT_HOLIDAY_API).replace('{year}', year);
  console.log(`[fetch] 抓取 ${year} 节假日：${url}`);

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; CalendarTool/1.0)',
        'Accept': 'application/json',
      },
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const data = await response.json();
    return parseHolidayData(data, year);
  } catch (err) {
    console.error(`[fetch] ${year} 抓取失败：`, err.message);
    throw err;
  }
}

function parseHolidayData(data, year) {
  if (data.holiday) return parseTimorFormat(data, year);
  if (data.holidays && Array.isArray(data.holidays)) return parseSimpleFormat(data);
  throw new Error(`不支持的 API 返回格式（year=${year}）`);
}

function parseTimorFormat(data, year) {
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
        rangeEnd = entries[j][1].date;
        j++;
      }
      const start = fixYear(detail.date, year);
      const end = fixYear(rangeEnd, year);
      holidayRanges.push({ name, start, end, wage: detail.wage || 1 });
      let d = dayjs(start);
      const endDate = dayjs(end);
      while (d.isSame(endDate) || d.isBefore(endDate)) {
        holidays.push({ date: d.format('YYYY-MM-DD'), name, isOffDay: true });
        d = d.add(1, 'day');
      }
      i = j;
    } else if (detail.holiday === false && detail.name && detail.name.includes('班')) {
      workdays.push({ date: fixYear(detail.date, year), name: detail.name, isOffDay: false });
      i++;
    } else {
      i++;
    }
  }
  return { holidays, workdays, holidayRanges };
}

function fixYear(dateStr, expectedYear) {
  if (!dateStr || typeof dateStr !== 'string') return dateStr;
  const yearPrefix = String(expectedYear);
  if (dateStr.startsWith(yearPrefix)) return dateStr;
  return yearPrefix + dateStr.slice(4);
}

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

// ===== 日历计算函数 =====

function getLunarFestivals(year) {
  const events = [];
  const lunarFestivals = [
    { month: 1, day: 1, name: '春节' },
    { month: 1, day: 15, name: '元宵节' },
    { month: 2, day: 2, name: '龙抬头' },
    { month: 5, day: 5, name: '端午节' },
    { month: 7, day: 7, name: '七夕' },
    { month: 7, day: 15, name: '中元节' },
    { month: 8, day: 15, name: '中秋节' },
    { month: 9, day: 9, name: '重阳节' },
    { month: 12, day: 8, name: '腊八节' },
    { month: 12, day: 23, name: '北方小年' },
    { month: 12, day: 24, name: '南方小年' },
    { month: 12, day: 30, name: '除夕' },
    { month: 12, day: 29, name: '除夕' },
  ];

  for (let month = 1; month <= 12; month++) {
    for (let day = 1; day <= 30; day++) {
      try {
        const solar = Solar.fromYmd(year, month, day);
        const lunar = solar.getLunar();
        const lunarMonth = lunar.getMonth();
        const lunarDay = lunar.getDay();
        const isLeap = lunarMonth < 0;
        const absMonth = Math.abs(lunarMonth);

        for (const f of lunarFestivals) {
          if (absMonth === f.month && lunarDay === f.day) {
            const lunarDateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            let summary = f.name;
            if (isLeap) summary += '（闰月）';
            events.push({
              date: lunarDateStr,
              summary,
              description: `${f.name} ${lunarDateStr}`,
              type: 'lunar-festival',
              busy: 'free',
            });
          }
        }
      } catch (e) { break; }
    }
  }
  return events;
}

function getSolarTerms(year) {
  const events = [];
  const terms = [
    '小寒', '大寒', '立春', '雨水', '惊蛰', '春分',
    '清明', '谷雨', '立夏', '小满', '芒种', '夏至',
    '小暑', '大暑', '立秋', '处暑', '白露', '秋分',
    '寒露', '霜降', '立冬', '小雪', '大雪', '冬至',
  ];

  for (const term of terms) {
    try {
      const solar = Solar.fromYmd(year, 1, 1);
      const t = solar.getJieQiByName(term);
      if (t) {
        const dateStr = `${t.getYear()}-${String(t.getMonth()).padStart(2, '0')}-${String(t.getDay()).padStart(2, '0')}`;
        events.push({
          date: dateStr,
          summary: `${term}`,
          description: `二十四节气：${term}\n日期：${dateStr}`,
          type: 'solar-term',
          busy: 'free',
        });
      }
    } catch (e) {}
  }
  return events;
}

function getYiJiEvents(year) {
  const events = [];
  for (let month = 1; month <= 12; month++) {
    for (let day = 1; day <= 31; day++) {
      try {
        const solar = Solar.fromYmd(year, month, day);
        const lunar = solar.getLunar();
        const yearZhi = lunar.getYearZhi();
        const yearGan = lunar.getYearGan();
        const dayGanZhi = lunar.getDayGanZhi();
        const yi = lunar.getDayYi().join('、');
        const ji = lunar.getDayJi().join('、');
        const lunarMonth = lunar.getMonth();
        const isLeap = lunarMonth < 0;
        const absMonth = Math.abs(lunarMonth);
        const lunarDay = lunar.getDay();
        const lunarDateStr = `农历${isLeap ? '闰' : ''}${absMonth}月${lunarDay}日`;
        const desc = `天干地支：${yearGan}${yearZhi}年 ${dayGanZhi}日\n宜：${yi}\n忌：${ji}`;
        const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        events.push({
          date: dateStr,
          summary: `${lunarDateStr}`,
          description: desc,
          type: 'yiji',
          busy: 'free',
        });
      } catch (e) { break; }
    }
  }
  return events;
}

function getSolarFestivals(year) {
  const events = [];
  const solarFestivals = [
    { month: 1, day: 1, name: '元旦' },
    { month: 3, day: 8, name: '妇女节' },
    { month: 3, day: 12, name: '植树节' },
    { month: 4, day: 1, name: '愚人节' },
    { month: 5, day: 1, name: '劳动节' },
    { month: 5, day: 4, name: '青年节' },
    { month: 6, day: 1, name: '儿童节' },
    { month: 7, day: 1, name: '建党节' },
    { month: 8, day: 1, name: '建军节' },
    { month: 9, day: 10, name: '教师节' },
    { month: 10, day: 1, name: '国庆节' },
    { month: 10, day: 31, name: '万圣节' },
    { month: 11, day: 11, name: '双十一' },
    { month: 12, day: 24, name: '平安夜' },
    { month: 12, day: 25, name: '圣诞节' },
  ];

  for (const f of solarFestivals) {
    try {
      const dateStr = `${year}-${String(f.month).padStart(2, '0')}-${String(f.day).padStart(2, '0')}`;
      events.push({
        date: dateStr,
        summary: f.name,
        description: `${f.name} ${dateStr}`,
        type: 'solar-festival',
        busy: 'free',
      });
    } catch (e) {}
  }
  return events;
}

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

function addEvent(cal, ev) {
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
  } catch (e) {}
}

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
    startYear = current;
    endYear = current + 2;
  }

  const cal = new ICalCalendar({ name: `定制日历 ${startYear}-${endYear}` });
  const strip = (str) => icons ? str : stripEmoji(str);

  if (sources.includes('holidays')) {
    console.log('[generate] 抓取节假日数据...');
    try {
      const holidaysData = {};
      for (let y = startYear; y <= endYear; y++) {
        holidaysData[y] = await fetchHolidays(y, holidayApi || null);
      }
      const events = flattenHolidays(holidaysData, icons);
      events.forEach(ev => addEvent(cal, ev));
      console.log(`[generate] 节假日事件：${events.length} 条`);
    } catch (e) {
      console.error('[generate] 节假日抓取失败：', e.message);
    }
  }

  if (sources.includes('lunar')) {
    console.log('[generate] 生成农历事件...');
    try {
      let events = [];
      for (let y = startYear; y <= endYear; y++) {
        events = events.concat(getLunarFestivals(y));
      }
      events.forEach(ev => { ev.summary = strip(ev.summary); addEvent(cal, ev); });
      console.log(`[generate] 农历事件：${events.length} 条`);
    } catch (e) {
      console.error('[generate] 农历生成失败：', e.message);
    }
  }

  if (sources.includes('solar')) {
    console.log('[generate] 生成节气事件...');
    try {
      let events = [];
      for (let y = startYear; y <= endYear; y++) {
        events = events.concat(getSolarTerms(y));
      }
      events.forEach(ev => { ev.summary = strip(ev.summary); addEvent(cal, ev); });
      console.log(`[generate] 节气事件：${events.length} 条`);
    } catch (e) {
      console.error('[generate] 节气生成失败：', e.message);
    }
  }

  if (sources.includes('yiji')) {
    console.log('[generate] 生成宜忌事件...');
    try {
      let events = [];
      for (let y = startYear; y <= endYear; y++) {
        events = events.concat(getYiJiEvents(y));
      }
      events.forEach(ev => { ev.summary = strip(ev.summary); addEvent(cal, ev); });
      console.log(`[generate] 宜忌事件：${events.length} 条`);
    } catch (e) {
      console.error('[generate] 宜忌生成失败：', e.message);
    }
  }

  if (sources.includes('festivals')) {
    console.log('[generate] 生成公历节日...');
    try {
      let events = [];
      for (let y = startYear; y <= endYear; y++) {
        events = events.concat(getSolarFestivals(y));
      }
      events.forEach(ev => { ev.summary = strip(ev.summary); addEvent(cal, ev); });
      console.log(`[generate] 节日事件：${events.length} 条`);
    } catch (e) {
      console.error('[generate] 节日生成失败：', e.message);
    }
  }

  return cal.toString();
}

// ===== Cloudflare Workers 入口 =====

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 200, headers: corsHeaders });
    }

    try {
      const path = url.pathname;

      // 根路径：返回网页界面
      if (path === '/' || path === '/index.html') {
        return new Response(renderHTMLPage(), {
          status: 200,
          headers: {
            'Content-Type': 'text/html; charset=utf-8',
            ...corsHeaders,
          },
        });
      }

      // /calendar.ics：返回 ICS 文件（iOS 兼容）
      const sources = url.searchParams.get('sources') || 'holidays,lunar,solar,festivals';
      const holidayApi = url.searchParams.get('holidayApi') || null;
      const year = url.searchParams.get('year') || null;
      const iconsStr = url.searchParams.get('icons');
      const icons = iconsStr !== 'false';

      const sourceList = sources.split(',').map(s => s.trim().toLowerCase());
      const validSources = ['holidays', 'lunar', 'solar', 'yiji', 'festivals'];
      const filtered = sourceList.filter(s => validSources.includes(s));

      if (filtered.length === 0) {
        return new Response(JSON.stringify({ error: '至少需要一个有效的 sources 参数' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }

      console.log(`[Worker] 请求：sources=${filtered.join(',')} year=${year || 'default'} icons=${icons}`);

      const icsContent = await generateCalendar({
        sources: filtered,
        holidayApi: holidayApi || null,
        year: year || null,
        icons,
      });

      const filename = `calendar-${filtered.join('-')}.ics`;

      return new Response(icsContent, {
        status: 200,
        headers: {
          'Content-Type': 'text/calendar; charset=utf-8',
          // iOS 日历 App 需要 attachment 而不是 inline
          'Content-Disposition': `attachment; filename="${filename}"`,
          'Cache-Control': `s-maxage=${CACHE_TTL}, stale-while-revalidate=86400`,
          ...corsHeaders,
        },
      });

    } catch (error) {
      console.error('[Worker] 错误：', error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  },
};
