const app = getApp();

Page({
  data: {
    subscriptions: []
  },

  onLoad() {
    this.setData({
      subscriptions: app.globalData.subscriptions
    });
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
