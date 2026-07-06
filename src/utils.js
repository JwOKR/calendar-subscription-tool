/**
 * 共享工具函数
 * 统一 emoji 处理和事件去重逻辑，供 ics-generator.js、worker.js、merge-sources.js 共用
 */

// ===== Emoji 处理 =====

/**
 * 去除字符串中的 emoji 图标（最全面的正则）
 * @param {string} str
 * @returns {string}
 */
function stripEmoji(str) {
  if (!str) return str;
  return str
    .replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F000}-\u{1F02F}\u{1F0A0}-\u{1F0FF}\u{1F100}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{1F910}-\u{1F96B}\u{1F980}-\u{1F9E0}]/gu, '')
    .replace(/[\u{2300}-\u{23FF}\u{2B50}\u{2B55}\u{2934}\u{2935}\u{2B05}\u{2B06}\u{2B07}\u{2B1B}\u{2B1C}\u{3297}\u{3299}\u{200D}\u{FE0F}\u{20E3}\u{E0020}-\u{E007F}]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * 去除 emoji 并清理括号内容（用于去重 key 生成）
 * 例如："🎉 劳动节（假期）" → "劳动节"
 * @param {string} summary
 * @returns {string}
 */
function normalizeKeyword(summary) {
  return stripEmoji(summary)
    .replace(/[（(].*?[)）]/g, '')
    .trim();
}

// ===== 事件去重 =====

/**
 * 生成事件的去重 key
 * 规则：日期 + 去 emoji 去括号的核心标题 + 结束日期
 * @param {Object} ev - { date, summary, endDate }
 * @returns {string}
 */
function dedupeKey(ev) {
  const date = ev.date || '';
  const keyword = normalizeKeyword(ev.summary || '');
  const endDate = ev.endDate || '';
  return `${date}|${keyword}|${endDate}`;
}

/**
 * 创建一个带去重功能的事件收集器
 * @returns {{ isDuplicate: (ev) => boolean, stats: () => { total: number, duplicates: number, unique: number } }}
 */
function createDeduplicator() {
  const seen = new Set();
  let total = 0;
  let duplicates = 0;

  function isDuplicate(ev) {
    const key = dedupeKey(ev);
    total++;
    if (seen.has(key)) {
      duplicates++;
      return true;
    }
    seen.add(key);
    return false;
  }

  return {
    isDuplicate,
    stats() {
      return { total, duplicates, unique: total - duplicates };
    },
  };
}

module.exports = { stripEmoji, normalizeKeyword, dedupeKey, createDeduplicator };
