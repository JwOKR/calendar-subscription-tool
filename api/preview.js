/**
 * Vercel Serverless Function - 日历事件预览
 *
 * 用法：
 *   /api/preview?sources=holidays,lunar,solar&year=2024-2027&limit=50
 *
 * 返回 JSON 格式的事件预览列表
 */

const path = require('path');
const dayjs = require('dayjs');

// ===== 路径配置 =====
const ROOT_DIR = path.join(__dirname, '..');
const SRC_DIR = path.join(ROOT_DIR, 'src');

// ===== 内存缓存 =====
const memoryCache = new Map();

// ===== 延迟加载业务模块 =====
let _lunarCalc, _festivals;

function getLunarCalc() {
  if (!_lunarCalc) {
    _lunarCalc = require(path.join(SRC_DIR, 'lunar-calc.js'));
  }
  return _lunarCalc;
}

function getFestivals() {
  if (!_festivals) {
    _festivals = require(path.join(SRC_DIR, 'festivals.js'));
  }
  return _festivals;
}

// ===== 节假日数据抓取 =====
async function fetchYearHolidays(year, apiBase) {
  const cacheKey = `holiday-${year}-${apiBase || 'default'}`;
  if (memoryCache.has(cacheKey)) {
    return memoryCache.get(cacheKey);
  }

  const axios = require('axios');
  const url = (apiBase || 'https://timor.tech/api/holiday/year').replace('{year}', year);

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
      result = parseTimorFormat(data);
    } else if (data.holidays && Array.isArray(data.holidays)) {
      result = parseSimpleFormat(data);
    } else {
      throw new Error(`不支持的 API 返回格式（year=${year}）`);
    }

    memoryCache.set(cacheKey, result);
    return result;
  } catch (err) {
    console.error(`[preview] ${year} 抓取失败：`, err.message);
    throw err;
  }
}

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

function flattenHolidays(holidaysData) {
  const events = [];
  for (const [, data] of Object.entries(holidaysData)) {
    for (const range of data.holidayRanges || []) {
      events.push({
        date: range.start,
        endDate: range.end,
        summary: `🎉 ${range.name}（假期）`,
        type: 'holiday',
      });
    }
    for (const wd of data.workdays || []) {
      events.push({
        date: wd.date,
        summary: `💼 ${wd.name}`,
        type: 'workday',
      });
    }
  }
  return events;
}

// ===== 主预览逻辑 =====

async function generatePreview({ sources, holidayApi, year, limit = 50 }) {
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

  const allEvents = [];

  // 1. 节假日
  if (sources.includes('holidays')) {
    try {
      const years = [];
      for (let y = startYear; y <= endYear; y++) years.push(y);

      const holidaysData = {};
      for (const y of years) {
        holidaysData[y] = await fetchYearHolidays(y, holidayApi || null);
      }

      const events = flattenHolidays(holidaysData);
      allEvents.push(...events);
    } catch (e) {
      console.error('[preview] 节假日抓取失败：', e.message);
    }
  }

  // 2. 农历 + 节气 + 宜忌
  const { calcLunarEventsByYears } = getLunarCalc();
  const lunarData = calcLunarEventsByYears(startYear, endYear);

  if (sources.includes('lunar') && lunarData.lunarEvents) {
    allEvents.push(...lunarData.lunarEvents.map(ev => ({
      date: ev.date,
      summary: ev.summary,
      type: 'lunar',
    })));
  }
  if (sources.includes('solar') && lunarData.solarTermEvents) {
    allEvents.push(...lunarData.solarTermEvents.map(ev => ({
      date: ev.date,
      summary: ev.summary,
      type: 'solar-term',
    })));
  }
  if (sources.includes('yiji') && lunarData.yiJiEvents) {
    allEvents.push(...lunarData.yiJiEvents.map(ev => ({
      date: ev.date,
      summary: ev.summary,
      type: 'yiji',
    })));
  }

  // 3. 普通节日
  if (sources.includes('festivals')) {
    try {
      const { getFestivalEvents } = getFestivals();
      const events = getFestivalEvents(startYear, endYear);
      allEvents.push(...events.map(ev => ({
        date: ev.date,
        summary: ev.summary,
        type: 'festival',
      })));
    } catch (e) {
      console.error('[preview] 节日生成失败：', e.message);
    }
  }

  // 按日期排序
  allEvents.sort((a, b) => a.date.localeCompare(b.date));

  // 过滤：只显示从今天开始的事件
  const today = dayjs().format('YYYY-MM-DD');
  const upcomingEvents = allEvents.filter(ev => ev.date >= today);

  // 限制数量
  const limitedEvents = upcomingEvents.slice(0, limit);

  return {
    total: upcomingEvents.length,
    showing: limitedEvents.length,
    dateRange: {
      start: startYear,
      end: endYear,
    },
    events: limitedEvents,
  };
}

// ===== Vercel Handler =====

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const { sources, holidayApi, year, limit: limitStr } = req.query;

    const sourceList = sources
      ? sources.split(',').map(s => s.trim().toLowerCase())
      : ['holidays', 'lunar', 'solar', 'festivals'];

    const validSources = ['holidays', 'lunar', 'solar', 'yiji', 'festivals'];
    const filtered = sourceList.filter(s => validSources.includes(s));

    if (filtered.length === 0) {
      return res.status(400).json({ error: '至少需要一个有效的 sources 参数' });
    }

    const limit = limitStr ? parseInt(limitStr, 10) : 50;

    console.log(`[Preview API] 请求：sources=${filtered.join(',')} year=${year || 'default'} limit=${limit}`);

    const preview = await generatePreview({
      sources: filtered,
      holidayApi: holidayApi || null,
      year: year || null,
      limit,
    });

    res.setHeader('Cache-Control', 's-maxage=1800, stale-while-revalidate=3600');

    return res.status(200).json(preview);

  } catch (error) {
    console.error('[Preview API] 错误：', error);
    return res.status(500).json({ error: error.message });
  }
};
