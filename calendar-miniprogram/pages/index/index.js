const app = getApp();

Page({
  data: {
    subscriptions: [],
    iconMode: 'noicon',   // 'icon' = 带图标版，'noicon' = 无图标版（默认）
    // 分区标题：{ [sectionKey]: { show: bool, title: string } }
    sectionMeta: {}
  },

  onLoad() {
    const subscriptions = app.globalData.subscriptions;
    const sectionTitles = app.globalData.sectionTitles;
    // 计算每个 section 第一个卡片的索引，以及对应的标题
    const seen = {};
    const sectionMeta = {};
    subscriptions.forEach((item, idx) => {
      if (!seen[item.section]) {
        seen[item.section] = true;
        sectionMeta[idx] = {
          show: true,
          title: sectionTitles[item.section] || ''
        };
      }
    });
    this.setData({
      subscriptions,
      sectionMeta
    });
  },

  // 切换图标版本
  switchIconMode() {
    const mode = this.data.iconMode === 'icon' ? 'noicon' : 'icon';
    this.setData({ iconMode: mode });
  },

  onShareAppMessage() {
    return {
      title: '日历订阅工具 - 一键订阅节假日/农历/节气',
      path: '/pages/index/index'
    };
  },

  goTutorial() {
    wx.navigateTo({ url: '/pages/tutorial/tutorial' });
  },

  goCustomize() {
    wx.navigateTo({ url: '/pages/customize/customize' });
  },

  goGitHub() {
    wx.setClipboardData({
      data: 'https://github.com/JwOKR/calendar-subscription-tool',
      success() {
        wx.showToast({ title: '链接已复制', icon: 'success' });
      }
    });
  }
});
