/**
 * 普通节日（公历+国际+动态日期节日）定义与计算模块
 * 三类节日：
 *   1. 中国公历节日 — 元旦、妇女节、劳动节、儿童节、教师节、国庆节等
 *   2. 国际/西方节日 — 情人节、愚人节、万圣节、圣诞节等
 *   3. 动态日期节日 — 母亲节（五月第二周日）、父亲节（六月第三周日）、感恩节等
 */

const dayjs = require('dayjs');
require('dayjs/plugin/weekday');
require('dayjs/plugin/isoWeek');

/**
 * 固定日期节日（月-日 → 名称+图标）
 * key 格式 MM-DD
 */
const FIXED_FESTIVALS = {
  // 中国公历节日
  '01-01': { name: '元旦', icon: '🎆', type: 'cn' },
  '03-08': { name: '妇女节', icon: '💐', type: 'cn' },
  '03-12': { name: '植树节', icon: '🌳', type: 'cn' },
  '04-01': { name: '愚人节', icon: '🤡', type: 'intl' },
  '05-01': { name: '劳动节', icon: '🛠', type: 'cn' },
  '05-04': { name: '青年节', icon: '🌟', type: 'cn' },
  '06-01': { name: '儿童节', icon: '🎈', type: 'cn' },
  '07-01': { name: '建党节', icon: '🏴', type: 'cn' },
  '08-01': { name: '建军节', icon: '🎖', type: 'cn' },
  '09-03': { name: '抗战胜利纪念日', icon: '🕊', type: 'cn' },
  '09-10': { name: '教师节', icon: '📚', type: 'cn' },
  '10-01': { name: '国庆节', icon: '🇨🇳', type: 'cn' },
  '10-31': { name: '万圣节前夜', icon: '🎃', type: 'intl' },
  '11-11': { name: '双十一', icon: '🛒', type: 'cn' },
  '12-24': { name: '平安夜', icon: '🌲', type: 'intl' },
  '12-25': { name: '圣诞节', icon: '🎄', type: 'intl' },
  // 国际节日
  '02-14': { name: '情人节', icon: '💘', type: 'intl' },
  '03-14': { name: '白色情人节', icon: '💝', type: 'intl' },
  '03-20': { name: '国际幸福日', icon: '😊', type: 'intl' },
  '04-22': { name: '地球日', icon: '🌍', type: 'intl' },
  '05-20': { name: '520', icon: '💗', type: 'cn' },
  '06-18': { name: '618', icon: '🛒', type: 'cn' },
  '08-08': { name: '全民健身日', icon: '💪', type: 'cn' },
  '10-31': { name: '万圣节', icon: '🎃', type: 'intl' },
  '11-01': { name: '万圣节', icon: '👻', type: 'intl' },
};

/**
 * 计算某年某月的第 N 个星期 X 的日期
 * @param {number} year
 * @param {number} month - 1-12
 * @param {number} weekday - 0=周日, 1=周一, ... 6=周六
 * @param {number} nth   - 第几个（1=第一个）
 * @returns {string} YYYY-MM-DD
 */
function nthWeekday(year, month, weekday, nth) {
  let d = dayjs(`${year}-${String(month).padStart(2, '0')}-01`);
  // 找到第一个 weekday
  while (d.day() !== weekday) {
    d = d.add(1, 'day');
  }
  // 跳到 nth 个
  d = d.add((nth - 1) * 7, 'day');
  return d.format('YYYY-MM-DD');
}

/**
 * 计算感恩节（美国，11月第四个星期四）
 */
function thanksgiving(year) {
  return nthWeekday(year, 11, 4, 4);
}

/**
 * 计算复活节（西方，近似算法：Anonymous Gregorian algorithm）
 */
function easter(year) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/**
 * 动态日期节日
 * @param {number} year
 * @returns {Array} - [{ date, name, icon, type }]
 */
function getDynamicFestivals(year) {
  const result = [];

  // 母亲节：五月第二个星期日
  result.push({
    date: nthWeekday(year, 5, 0, 2),
    name: '母亲节',
    icon: '🌹',
    type: 'intl',
  });

  // 父亲节：六月第三个星期日
  result.push({
    date: nthWeekday(year, 6, 0, 3),
    name: '父亲节',
    icon: '👔',
    type: 'intl',
  });

  // 感恩节（美国）：11月第四个星期四
  result.push({
    date: thanksgiving(year),
    name: '感恩节',
    icon: '🦃',
    type: 'intl',
  });

  // 复活节
  const ed = easter(year);
  result.push({
    date: ed,
    name: '复活节',
    icon: '🐣',
    type: 'intl',
  });

  // 世界地球日已在固定节日里，此处省略

  return result;
}

/**
 * 生成指定年份范围的普通节日事件列表
 * @param {number} startYear
 * @param {number} endYear
 * @param {Object} [options]
 * @param {boolean} [options.includeCN=true]   - 包含中国公历节日
 * @param {boolean} [options.includeIntl=true]  - 包含国际/西方节日
 * @param {boolean} [options.includeDynamic=true] - 包含动态日期节日
 * @returns {Array} - 事件列表（可直接写入 .ics）
 */
function getFestivalEvents(startYear, endYear, options = {}) {
  const { includeCN = true, includeIntl = true, includeDynamic = true } = options;

  const events = [];
  const typeFilter = [];
  if (includeCN) typeFilter.push('cn');
  if (includeIntl) typeFilter.push('intl');

  for (let year = startYear; year <= endYear; year++) {
    // 1. 固定日期节日
    for (const [mmdd, info] of Object.entries(FIXED_FESTIVALS)) {
      if (!typeFilter.includes(info.type)) continue;
      const dateStr = `${year}-${mmdd}`;
      // 简单校验日期是否合法（闰年等）
      if (!dayjs(dateStr).isValid()) continue;
      events.push({
        date: dateStr,
        summary: `${info.icon} ${info.name}`,
        description: `${info.name}（${year}年）`,
        type: `festival-${info.type}`,
      });
    }

    // 2. 动态日期节日
    if (includeDynamic) {
      const dynamic = getDynamicFestivals(year);
      for (const f of dynamic) {
        if (!typeFilter.includes(f.type)) continue;
        events.push({
          date: f.date,
          summary: `${f.icon} ${f.name}`,
          description: `${f.name}（${year}年）`,
          type: `festival-dynamic`,
        });
      }
    }
  }

  return events;
}

module.exports = { getFestivalEvents, FIXED_FESTIVALS, getDynamicFestivals, nthWeekday, easter, thanksgiving };

module.exports = { getFestivalEvents, FIXED_FESTIVALS, getDynamicFestivals, nthWeekday, easter, thanksgiving };