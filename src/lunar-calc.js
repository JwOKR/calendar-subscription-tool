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
      // 检测闰月：lunar-javascript 中闰月的 getMonth() 返回负值
      const isLeap = lunar.getMonth() < 0;
      const monthLabel = isLeap ? `闰${lunar.getMonthInChinese()}` : lunar.getMonthInChinese();
      lunarEvents.push({
        date: dateStr,
        summary: `🌙 农历${monthLabel}月`,
        description: `农历${monthLabel}月${lunar.getDayInChinese()}（${lunar.getYearInChinese()}年）${isLeap ? '【闰月】' : ''}`,
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

    // 补充农历节日（库未覆盖或需单独标注的）
    const lm = lunar.getMonth();
    const ld = lunar.getDay();

    // 龙抬头（二月初二）
    if (lm === 2 && ld === 2) {
      lunarEvents.push({
        date: dateStr,
        summary: '龙抬头',
        description: '农历二月初二，春龙节',
        type: 'lunar-festival',
      });
    }

    // 七夕（七月初七）
    if (lm === 7 && ld === 7) {
      lunarEvents.push({
        date: dateStr,
        summary: '七夕',
        description: '农历七月初七，乞巧节',
        type: 'lunar-festival',
      });
    }

    // 重阳节（九月初九）
    if (lm === 9 && ld === 9) {
      lunarEvents.push({
        date: dateStr,
        summary: '重阳节',
        description: '农历九月初九，登高节',
        type: 'lunar-festival',
      });
    }

    // 腊八节（腊月初八）
    if (lm === 12 && ld === 8) {
      lunarEvents.push({
        date: dateStr,
        summary: '腊八节',
        description: '农历腊月初八',
        type: 'lunar-festival',
      });
    }

    // 小年（腊月二十三/二十四）
    if (lm === 12 && (ld === 23 || ld === 24)) {
      lunarEvents.push({
        date: dateStr,
        summary: '小年',
        description: `农历腊月${ld}，${ld === 23 ? '北方' : '南方'}小年，祭灶节`,
        type: 'lunar-festival',
      });
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
      description: `宜：${yiStr || '无'}\n忌：${jiStr || '无'}\n农历${lunar.getYearInChinese()}年${lunar.getMonthInChinese()}月${lunar.getDayInChinese()}\n天干地支：${lunar.getYearInGanZhi()}年 ${lunar.getMonthInGanZhi()}月 ${lunar.getDayInGanZhi()}日`,
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
