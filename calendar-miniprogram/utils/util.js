/**
 * 工具函数
 */

const app = getApp();

/**
 * 生成订阅链接（带图标版）
 */
function getIconUrl(sources) {
  return `${app.globalData.githubPagesBase}/${sources}.ics`;
}

/**
 * 生成订阅链接（纯文字版）
 */
function getNoIconUrl(sources) {
  return `${app.globalData.githubPagesBase}/${sources}-noicon.ics`;
}

/**
 * 生成 CF Workers 定制链接
 */
function getWorkersUrl(params) {
  let url = `${app.globalData.workersBase}/api/calendar?sources=${params.sources}`;
  if (params.holidayApi) {
    url += `&holidayApi=${encodeURIComponent(params.holidayApi)}`;
  }
  if (params.year) {
    url += `&year=${encodeURIComponent(params.year)}`;
  }
  if (params.icons === false) {
    url += '&icons=false';
  }
  return url;
}

/**
 * 复制文本到剪贴板
 */
function copyToClipboard(text, successMsg) {
  wx.setClipboardData({
    data: text,
    success() {
      wx.showToast({
        title: successMsg || '已复制',
        icon: 'success',
        duration: 1500
      });
    },
    fail() {
      wx.showToast({
        title: '复制失败',
        icon: 'none'
      });
    }
  });
}

/**
 * 获取当前时间字符串（北京时间）
 */
function getNowString() {
  const now = new Date();
  const offset = 8 * 60; // 北京时间 UTC+8
  const beijingTime = new Date(now.getTime() + (offset + now.getTimezoneOffset()) * 60000);
  return beijingTime.toISOString().replace('T', ' ').substring(0, 19);
}

module.exports = {
  getIconUrl,
  getNoIconUrl,
  getWorkersUrl,
  copyToClipboard,
  getNowString
};
