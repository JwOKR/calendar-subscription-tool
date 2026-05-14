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

  const url = (apiBase || 'https://timor.tech/api/holiday/year').replace('{year}', year);
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
        rangeEnd = entries[j][1].date;
        j++;
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

// ===== 事件添加辅助 =====

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
  } catch (e) {
    // 跳过无效事件
  }
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
    startYear = current;
    endYear = current + 2;
  }

  const cal = new ICalCalendar({ name: `定制日历 ${startYear}-${endYear}` });

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
      events.forEach(ev => addEvent(cal, ev));
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
    evList.forEach(ev => addEvent(cal, ev));
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
      events.forEach(ev => addEvent(cal, ev));
      console.log(`[generate] 节日事件：${events.length} 条`);
    } catch (e) {
      console.error('[generate] 节日生成失败：', e.message);
    }
  }

  return cal.toString();
}

// ===== Cloudflare Workers Handler =====

export default {
  async fetch(request, env, ctx) {
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

    const url = new URL(request.url);
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

      const icsContent = await generateCalendar({
        sources: filtered,
        holidayApi: holidayApi || null,
        year: year || null,
        icons,
      });

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
