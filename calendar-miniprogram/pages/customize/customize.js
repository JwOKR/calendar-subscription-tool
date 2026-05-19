const app = getApp();

Page({
  data: {
    holidayApi: 'https://timor.tech/api/holiday/year/{year}',
    sources: {
      holidays: true,
      lunar: true,
      solar: true,
      yiji: false,
      festivals: true
    },
    yearRange: '2024-2027',
    icons: true,
    resultUrl: ''
  },

  onLoad() {},

  onHolidayApiInput(e) {
    this.setData({ holidayApi: e.detail.value });
  },

  toggleSource(e) {
    const key = e.currentTarget.dataset.key;
    const sources = this.data.sources;
    sources[key] = !sources[key];
    this.setData({ sources });
  },

  onYearRangeInput(e) {
    this.setData({ yearRange: e.detail.value });
  },

  onIconsChange(e) {
    this.setData({ icons: e.detail.value === 'true' });
  },

  generate() {
    const { sources, holidayApi, yearRange, icons } = this.data;

    const selected = Object.keys(sources).filter(k => sources[k]);
    if (selected.length === 0) {
      wx.showToast({ title: '至少选择一个订阅源', icon: 'none' });
      return;
    }

    let url = `${app.globalData.workersBase}/api/calendar?sources=${selected.join(',')}`;
    if (holidayApi) {
      url += `&holidayApi=${encodeURIComponent(holidayApi)}`;
    }
    if (yearRange) {
      url += `&year=${encodeURIComponent(yearRange)}`;
    }
    if (!icons) {
      url += '&icons=false';
    }

    this.setData({ resultUrl: url });

    wx.setClipboardData({
      data: url,
      success() {
        wx.showToast({ title: '链接已生成并复制', icon: 'success' });
      }
    });
  },

  goBack() {
    wx.navigateBack();
  },

  onShareAppMessage() {
    return {
      title: '定制你的日历订阅 - 日历订阅工具',
      path: '/pages/customize/customize'
    };
  }
});
