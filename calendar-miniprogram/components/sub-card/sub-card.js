Component({
  properties: {
    name: { type: String, value: '' },
    icon: { type: String, value: '' },
    desc: { type: String, value: '' },
    badge: { type: String, value: '' },
    badgeType: { type: String, value: '' },
    tags: { type: Array, value: [] },
    sources: { type: String, value: '' },
    // 'icon' = 带图标版，'noicon' = 无图标版
    iconMode: { type: String, value: 'noicon' }
  },

  data: {
    displayUrl: '',
    linkLabel: ''
  },

  lifetimes: {
    attached() {
      this.updateUrl();
    },
    detached() {}
  },

  observers: {
    'sources, iconMode': function () {
      this.updateUrl();
    }
  },

  methods: {
    updateUrl() {
      const app = getApp();
      const base = app.globalData.githubPagesBase;
      const { sources, iconMode } = this.properties;
      const suffix = iconMode === 'icon' ? '' : '-noicon';
      const url = `${base}/${sources}${suffix}.ics`;
      const label = iconMode === 'icon' ? '🎨 带图标版' : '📝 无图标版';
      this.setData({ displayUrl: url, linkLabel: label });
    },

    onCopyUrl() {
      wx.setClipboardData({
        data: this.data.displayUrl,
        success() {
          wx.showToast({ title: '链接已复制', icon: 'success' });
        }
      });
    }
  }
});
