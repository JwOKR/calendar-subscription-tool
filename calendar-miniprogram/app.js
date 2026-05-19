App({
  globalData: {
    // GitHub Pages 静态文件基础 URL
    githubPagesBase: 'https://jwokr.github.io/calendar-subscription-tool',
    // CF Workers 基础 URL
    workersBase: 'https://calendar-subscription-tool.1669443179.workers.dev',
    // 订阅源配置（顺序即展示顺序）
    subscriptions: [
      {
        id: 'all-in-one',
        name: '全能日历',
        icon: '🃏',
        desc: '合并所有日历源，一个订阅搞定所有',
        badge: 'ALL-IN-ONE',
        badgeType: 'allinone',
        sources: 'holidays,lunar,solar,festivals',
        tags: ['🇨🇳 中国节假日', '🌙 农历日历', '☀️ 二十四节气', '🎉 普通节日'],
        section: 'recommend'
      },
      {
        id: 'yiji',
        name: '宜忌日历',
        icon: '📋',
        desc: '每日宜忌 + 吉神凶煞（传统黄历）',
        sources: 'yiji',
        section: 'yiji'
      },
      {
        id: 'holidays',
        name: '中国节假日',
        icon: '🇨🇳',
        desc: '国务院办公厅发布的法定节假日 + 调休安排',
        badge: '推荐',
        badgeType: 'recommend',
        sources: 'holidays',
        section: 'combined'
      },
      {
        id: 'lunar',
        name: '农历日历',
        icon: '🌙',
        desc: '农历日期 + 传统节日（春节、中秋、端午等）',
        sources: 'lunar',
        section: 'combined'
      },
      {
        id: 'solar',
        name: '二十四节气',
        icon: '☀️',
        desc: '完整二十四节气，精准到分钟',
        sources: 'solar',
        section: 'combined'
      },
      {
        id: 'festivals',
        name: '普通节日',
        icon: '🎉',
        desc: '公历节日 + 国际节日 + 动态日期节日',
        sources: 'festivals',
        section: 'combined'
      }
    ],
    // 分区标题映射
    sectionTitles: {
      recommend: '🃏 推荐',
      yiji: '📋 宜忌日历',
      combined: '🇨🇳 中国节假日 · 农历 · 节气 · 节日'
    }
  },

  onLaunch() {
    console.log('日历订阅小程序启动');
  }
});
