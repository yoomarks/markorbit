/* global Page, getApp, wx */

const { buildAdapterUrl, presentProjection } = require('../../lib/projection');

Page({
  data: {
    viewState: 'loading',
    site: null,
    errorMessage: ''
  },

  onLoad(options) {
    this.entry = {
      campaign: options.campaign || options.scene,
      content: options.content,
      referral: options.referral
    };
    this.load();
  },

  onShareAppMessage() {
    return {
      title: this.data.site ? this.data.site.brandName : 'Trademark services',
      path: '/pages/site/index?campaign=wechat-share&content=shared-site-entry'
    };
  },

  onPullDownRefresh() {
    this.load(() => wx.stopPullDownRefresh());
  },

  load(done) {
    this.setData({ viewState: 'loading', errorMessage: '' });
    let url;
    try {
      url = buildAdapterUrl(getApp().globalData.apiBase, this.entry || {});
    } catch {
      this.setData({
        viewState: 'error',
        errorMessage: 'This Mini Program is not connected to an authorized service Site.'
      });
      if (done) done();
      return;
    }
    wx.request({
      url,
      method: 'GET',
      success: (response) => {
        if (response.statusCode !== 200) {
          this.setData({
            viewState: 'error',
            errorMessage: 'The service Site is currently unavailable.'
          });
          return;
        }
        try {
          const site = presentProjection(response.data);
          wx.setNavigationBarTitle({ title: site.brandName });
          this.setData({ viewState: site.state, site });
        } catch {
          this.setData({
            viewState: 'error',
            errorMessage: 'The service Site returned an invalid projection.'
          });
        }
      },
      fail: () =>
        this.setData({
          viewState: 'error',
          errorMessage: 'The service Site could not be reached.'
        }),
      complete: () => {
        if (done) done();
      }
    });
  },

  retry() {
    this.load();
  },

  startService(event) {
    const url = event.currentTarget.dataset.url;
    if (typeof url !== 'string') return;
    getApp().globalData.handoffUrl = url;
    wx.navigateTo({ url: '/pages/handoff/index' });
  }
});
