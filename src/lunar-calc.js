/**
 * 农历 / 节气 / 每日宜忌计算模块
 * 使用 lunar-javascript 库本地计算，无需外部 API
 * https://github.com/6tail/lunar-javascript
 */

const { Solar, Lunar, SolarTerm } = require('lunar-javascript');
const dayjs = require('dayjs');

/**
 * 生成指定日期范围内的所有日历事件
 * @param {string} startDate - 起始日期 'YYYY-MM-DD'
 * @param {string} endDate   - 结束日期 'YYYY-MM-DD'
 * @returns {Object} - { lunarEvents, solarTermEvents, yiJiEvents }
 */
function calcLunarEvents(startDate, endDate) {
  const lunarEvents = [];
  const solarTermEvents = [];
  const yiJiEvents = [];

  let current = dayjs(startDate);
  const end = dayjs(endDate);

  while (current.isBefore(end) || current.isSame(end, 'day')) {
    const y = current.year();
    const m = current.month() + 1;
    const d = current.date();
    const dateStr = current.format('YYYY-MM-DD');

    const solar = Solar.fromYmd(y, m, d);
    const lunar = solar.getLunar();

    // 1. 农历日期事件（每月初一显示农历月份）
    const lunarDay = lunar.getDay();
    if (lunarDay === 1) {
      lunarEvents.push({
        date: dateStr,
        summary: `🌙 农历${lunar.getMonthInChinese()}月`,
        description: `农历${lunar.getMonthInChinese()}月${lunar.getDayInChinese()}（${lunar.getYearInChinese()}年）`,
        type: 'lunar-month',
      });
    }

    // 农历节日
    const lunarFestival = lunar.getFestivals();
    if (lunarFestival.length > 0) {
      for (const f of lunarFestival) {
        lunarEvents.push({
          date: dateStr,
          summary: `🏮 农历节日：${f}`,
          description: `农历${lunar.getMonthInChinese()}月${lunar.getDayInChinese()}`,
          type: 'lunar-festival',
        });
      }
    }

    // 2. 节气事件
    const jieQi = lunar.getJieQi();
    if (jieQi) {
      const prevSolar = Solar.fromYmd(y, m, d - 1);
      const prevLunar = prevSolar.getLunar();
      const prevJieQi = prevLunar.getJieQi();
      // 只在节气当天触发（前一天不是同一个节气）
      if (jieQi !== prevJieQi) {
        solarTermEvents.push({
          date: dateStr,
          summary: `🌿 ${jieQi}`,
          description: `二十四节气：${jieQi}\n农历${lunar.getMonthInChinese()}月${lunar.getDayInChinese()}`,
          type: 'solar-term',
        });
      }
    }

    // 3. 每日宜忌事件
    const dayYi = lunar.getDayYi();
    const dayJi = lunar.getDayJi();
    const yiStr = dayYi.join('、');
    const jiStr = dayJi.join('、');

    yiJiEvents.push({
      date: dateStr,
      summary: `📅 宜忌 · ${lunar.getDayInChinese()}`,
      description: `宜：${yiStr || '无'}\n忌：${jiStr || '无'}\n农历${lunar.getYearInChinese()}年${lunar.getMonthInChinese()}月${lunar.getDayInChinese()}`,
      type: 'yiji',
    });

    current = current.add(1, 'day');
  }

  return { lunarEvents, solarTermEvents, yiJiEvents };
}

/**
 * 便捷函数：按年份范围计算
 * @param {number} startYear
 * @param {number} endYear
 */
function calcLunarEventsByYears(startYear, endYear) {
  const startDate = `${startYear}-01-01`;
  const endDate = `${endYear}-12-31`;
  return calcLunarEvents(startDate, endDate);
}

/**
 * 获取某天的完整农历信息（用于调试/预览）
 */
function getDayInfo(dateStr) {
  const d = dayjs(dateStr);
  const solar = Solar.fromYmd(d.year(), d.month() + 1, d.date());
  const lunar = solar.getLunar();

  return {
    date: dateStr,
    lunarDate: `${lunar.getYearInChinese()}年${lunar.getMonthInChinese()}月${lunar.getDayInChinese()}`,
    animal: lunar.getYearShengXiao(),
    ganZhi: `${lunar.getYearInGanZhi()}年 ${lunar.getMonthInGanZhi()}月 ${lunar.getDayInGanZhi()}日`,
    jieQi: lunar.getJieQi() || '',
    dayYi: lunar.getDayYi(),
    dayJi: lunar.getDayJi(),
    festivals: [
      ...lunar.getFestivals(),
      ...solar.getFestivals(),
    ],
  };
}

module.exports = { calcLunarEvents, calcLunarEventsByYears, getDayInfo };
