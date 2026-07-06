const app = getApp();

Page({
  data: {
    sources: ['holidays', 'lunar', 'solar', 'festivals', 'yiji'],
    sourceLabels: {
      holidays: '🇨🇳 中国节假日',
      lunar: '🌙 农历日历',
      solar: '☀️ 二十四节气',
      festivals: '🎉 普通节日',
      yiji: '📋 宜忌日历'
    },
    checkedSources: ['holidays', 'lunar', 'solar', 'festivals'],
    limit: 10,
    limitOptions: [5, 10, 20, 50],
    events: [],
    loading: false,
    error: ''
  },

  onLoad() {},

  // 切换订阅源
  onSourceChange(e) {
    const idx = e.currentTarget.dataset.idx;
    const source = this.data.sources[idx];
    let checked = [...this.data.checkedSources];
    const pos = checked.indexOf(source);
    if (pos > -1) {
      checked.splice(pos, 1);
    } else {
      checked.push(source);
    }
    this.setData({ checkedSources: checked });
  },

  // 切换数量
  onLimitChange(e) {
    const idx = e.currentTarget.dataset.idx;
    this.setData({ limit: this.data.limitOptions[idx] });
  },

  // 加载预览
  loadPreview() {
    const { checkedSources, limit } = this.data;
    if (checkedSources.length === 0) {
      wx.showToast({ title: '请至少选择一个订阅源', icon: 'none' });
      return;
    }

    this.setData({ loading: true, error: '', events: [] });

    const url = app.globalData.workersBase +
      '/api/preview?sources=' + checkedSources.join(',') +
      '&limit=' + limit;

    wx.request({
      url,
      success: (res) => {
        if (res.statusCode === 200 && res.data && res.data.events) {
          // 计算倒计时文本
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const events = res.data.events.map(ev => {
            const evDate = new Date(ev.date + 'T00:00:00');
            const diffDays = Math.ceil((evDate - today) / (1000 * 60 * 60 * 24));
            let daysText;
            if (diffDays === 0) daysText = '今天';
            else if (diffDays > 0) daysText = diffDays + '天后';
            else daysText = Math.abs(diffDays) + '天前';
            return { ...ev, daysText, diffDays };
          });
          this.setData({ events, loading: false });
        } else {
          this.setData({ error: '获取数据失败，请重试', loading: false });
        }
      },
      fail: () => {
        this.setData({ error: '网络请求失败，请检查网络', loading: false });
      }
    });
  },

  // 复制订阅链接
  copySubscribeUrl() {
    const { checkedSources } = this.data;
    const url = app.globalData.workersBase + '/api/calendar?sources=' + checkedSources.join(',');
    wx.setClipboardData({
      data: url,
      success() {
        wx.showToast({ title: '订阅链接已复制', icon: 'success' });
      }
    });
  },

  onShareAppMessage() {
    return {
      title: '日历订阅工具 - 预览事件',
      path: '/pages/preview/preview'
    };
  }
});
