/* global Page, getApp */

Page({
  data: { url: '' },
  onLoad() {
    const url = getApp().globalData.handoffUrl;
    if (
      typeof url === 'string' &&
      url.startsWith('https://') &&
      /[?&]utm_source=wechat-mini-program(?:&|$)/u.test(url)
    ) {
      this.setData({ url });
    }
  }
});
