/**
 * 节假日数据抓取模块
 * 支持自定义数据源 API 地址
 * 默认数据源：timor.tech 免费 API（无需 API Key）
 * 文档：https://timor.tech/doc/holiday
 * API 返回格式：
 *   { code:0, holiday:{ "MM-DD": { holiday:true/false, name, wage, date:"YYYY-MM-DD", rest } } }
 *
 * 自定义 API 要求返回格式兼容 timor.tech 格式，或配置自定义解析函数。
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');
const dayjs = require('dayjs');

const DATA_DIR = path.join(__dirname, '..', 'data');
const CACHE_FILE = path.join(DATA_DIR, 'holidays-cache.json');
const CONFIG_FILE = path.join(__dirname, '..', 'config.json');

const DEFAULT_API_BASE = 'https://timor.tech/api/holiday/year';

const AXios_CONFIG = {
  timeout: 15000,
  headers: {
    'User-Agent': 'Mozilla/5.0 (compatible; CalendarTool/1.0)',
    'Accept': 'application/json',
  },
};

/**
 * 读取配置文件中的自定义节假日 API 地址
 * config.json 格式：
 * {
 *   "holidayApi": "https://your-api.com/holiday/year/{year}",
 *   "holidayApiParse": null  // 或 "timor" 表示兼容 timor.tech 格式
 * }
 */
function getHolidayApiBase() {
  if (fs.existsSync(CONFIG_FILE)) {
    try {
      const config = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
      if (config.holidayApi) {
        return config.holidayApi;
      }
    } catch (e) {
      // 忽略配置错误，使用默认
    }
  }
  return DEFAULT_API_BASE;
}

/**
 * 解析节假日 API 返回的数据，兼容 timor.tech 格式
 * 如果配置了自定义解析函数，则使用自定义解析
 *
 * @param {Object} data - API 返回的原始数据
 * @param {number} year - 年份
 * @returns {Object} - { holidays: [...], workdays: [...], holidayRanges: [...] }
 */
function parseHolidayData(data, year) {
  // 支持两种格式：
  // 1. timor.tech 格式：{ code:0, holiday:{ "MM-DD": { holiday:true, name, ... } } }
  // 2. 简化格式：{ holidays:[{date, name, ...}], workdays:[{date, name, ...}] }

  if (data.holiday) {
    // timor.tech 格式
    return parseTimorFormat(data);
  } else if (data.holidays && Array.isArray(data.holidays)) {
    // 简化数组格式
    return parseSimpleFormat(data);
  } else if (data.code !== undefined && data.code !== 0) {
    throw new Error(`API 返回错误：code=${data.code}`);
  }

  throw new Error('不支持的 API 返回格式');
}

/**
 * 解析 timor.tech 格式数据
 */
function parseTimorFormat(data) {
  const holidayRanges = [];
  const workdays = [];
  const holidays = [];

  const holidayObj = data.holiday || {};
  const entries = Object.entries(holidayObj);
  // 修复：按日期排序，防止 API 返回顺序不对导致连续假期识别错误
  entries.sort((a, b) => a[1].date.localeCompare(b[1].date));

  let i = 0;
  while (i < entries.length) {
    const [mmdd, detail] = entries[i];
    const dateStr = detail.date;

    if (detail.holiday === true) {
      const name = detail.name;
      let rangeStart = dateStr;
      let rangeEnd = dateStr;

      let j = i + 1;
      // 修复：只检查 holiday === true，不检查 name（防止同名但 name 细微差别导致区间截断）
      while (j < entries.length && entries[j][1].holiday === true) {
        rangeEnd = entries[j][1].date;
        j++;
      }

      holidayRanges.push({
        name,
        start: rangeStart,
        end: rangeEnd,
        wage: detail.wage || 1,
      });

      let d = dayjs(rangeStart);
      const end = dayjs(rangeEnd);
      while (d.isSame(end) || d.isBefore(end)) {
        holidays.push({
          date: d.format('YYYY-MM-DD'),
          name,
          isOffDay: true,
        });
        d = d.add(1, 'day');
      }

      i = j;
    } else if (detail.holiday === false && detail.name && detail.name.includes('补班')) {
      workdays.push({
        date: dateStr,
        name: detail.name,
        isOffDay: false,
      });
      i++;
    } else {
      i++;
    }
  }

  return { holidays, workdays, holidayRanges, raw: data };
}

/**
 * 解析简化数组格式数据
 * 格式：{ holidays:[{date, name, start?, end?}], workdays:[{date, name}] }
 */
function parseSimpleFormat(data) {
  const holidayRanges = [];
  const workdays = [];
  const holidays = [];

  for (const h of data.holidays) {
    if (h.start && h.end) {
      // 区间格式
      holidayRanges.push({
        name: h.name,
        start: h.start,
        end: h.end,
        wage: h.wage || 1,
      });
      let d = dayjs(h.start);
      const end = dayjs(h.end);
      while (d.isSame(end) || d.isBefore(end)) {
        holidays.push({
          date: d.format('YYYY-MM-DD'),
          name: h.name,
          isOffDay: true,
        });
        d = d.add(1, 'day');
      }
    } else {
      // 单日格式
      holidayRanges.push({
        name: h.name,
        start: h.date,
        end: h.date,
        wage: h.wage || 1,
      });
      holidays.push({
        date: h.date,
        name: h.name,
        isOffDay: true,
      });
    }
  }

  if (data.workdays) {
    for (const w of data.workdays) {
      workdays.push({
        date: w.date,
        name: w.name || '调休上班',
        isOffDay: false,
      });
    }
  }

  return { holidays, workdays, holidayRanges, raw: data };
}

/**
 * 获取指定年份的节假日数据（含调休）
 * @param {number} year - 年份，如 2026
 * @returns {Promise<Object>} - { holidays: [...], workdays: [...], holidayRanges: [...] }
 */
async function fetchYearHolidays(year) {
  const apiBase = getHolidayApiBase();
  const url = apiBase.replace('{year}', year);
  const resp = await axios.get(url, AXios_CONFIG);
  const data = resp.data;

  return parseHolidayData(data, year);
}

/**
 * 获取多个年份的节假日数据，带缓存
 * @param {number[]} years - 年份数组
 * @param {boolean} useCache - 是否使用缓存
 * @returns {Promise<Object>} - 按 year 组织的数据
 */
async function fetchHolidays(years = [2024, 2025, 2026, 2027], useCache = true) {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  // 读缓存
  let cache = {};
  if (useCache && fs.existsSync(CACHE_FILE)) {
    try {
      cache = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf-8'));
    } catch (e) {
      cache = {};
    }
  }

  const result = {};
  for (const year of years) {
    if (useCache && cache[year] && cache[year].fetchedAt) {
      const age = Date.now() - cache[year].fetchedAt;
      if (age < 7 * 24 * 3600 * 1000) {
        result[year] = cache[year].data;
        continue;
      }
    }

    console.log(`[节假日] 抓取 ${year} 年数据...`);
    try {
      const yearData = await fetchYearHolidays(year);
      result[year] = yearData;
      cache[year] = { fetchedAt: Date.now(), data: yearData };
    } catch (e) {
      console.error(`[节假日] ${year} 年抓取失败：${e.message}`);
      if (cache[year]) {
        result[year] = cache[year].data;
      }
    }
  }

  fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2), 'utf-8');
  return result;
}

/**
 * 将节假日数据扁平化为日历事件列表
 */
function flattenHolidays(holidaysData) {
  const events = [];

  for (const [year, data] of Object.entries(holidaysData)) {
    for (const range of data.holidayRanges) {
      const startDate = range.start;
      const endDate = range.end;
      events.push({
        date: startDate,
        endDate: endDate,
        summary: `🎉 ${range.name}（假期）`,
        description: `${range.name}假期 ${startDate} ~ ${endDate}`,
        type: 'holiday',
        busy: 'free',
      });
    }

    for (const wd of data.workdays) {
      events.push({
        date: wd.date,
        summary: `💼 ${wd.name}`,
        description: '调休安排：需要上班',
        type: 'workday',
        busy: 'busy',
      });
    }
  }

  return events;
}

/**
 * 设置自定义节假日 API 地址（写入 config.json）
 * @param {string} apiUrl - API 地址模板，用 {year} 代替年份
 * @param {string} [format] - 数据格式："timor" | "simple"
 */
function setCustomHolidayApi(apiUrl, format = 'timor') {
  let config = {};
  if (fs.existsSync(CONFIG_FILE)) {
    try {
      config = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
    } catch (e) {
      config = {};
    }
  }

  config.holidayApi = apiUrl;
  config.holidayApiFormat = format;

  if (!fs.existsSync(path.dirname(CONFIG_FILE))) {
    fs.mkdirSync(path.dirname(CONFIG_FILE), { recursive: true });
  }
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8');
  console.log(`[配置] 节假日 API 已设置为：${apiUrl}`);
}

module.exports = { fetchHolidays, flattenHolidays, setCustomHolidayApi, getHolidayApiBase };
