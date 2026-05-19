Component({
  properties: {
    name: { type: String, value: '' },
    icon: { type: String, value: '' },
    desc: { type: String, value: '' },
    badge: { type: String, value: '' },
    badgeType: { type: String, value: '' },
    tags: { type: Array, value: [] },
    sources: { type: String, value: '' }
  },

  data: {
    iconUrl: '',
    noIconUrl: ''
  },

  lifetimes: {
    attached() {
      const app = getApp();
      const base = app.globalData.githubPagesBase;
      const sources = this.properties.sources;
      this.setData({
        iconUrl: `${base}/${sources}.ics`,
        noIconUrl: `${base}/${sources}-noicon.ics`
      });
    }
  },

  methods: {
    onCopyIcon() {
      const url = this.data.iconUrl;
      wx.setClipboardData({
        data: url,
        success() {
          wx.showToast({ title: '带图标版链接已复制', icon: 'success' });
        }
      });
    },

    onCopyNoIcon() {
      const url = this.data.noIconUrl;
      wx.setClipboardData({
        data: url,
        success() {
          wx.showToast({ title: '纯文字版链接已复制', icon: 'success' });
        }
      });
    }
  }
});
