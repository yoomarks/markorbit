/* global App, wx */

App({
  onLaunch() {
    const ext = wx.getExtConfigSync ? wx.getExtConfigSync() : {};
    this.globalData.apiBase =
      typeof ext.apiBase === 'string' ? ext.apiBase.replace(/\/$/u, '') : '';
  },
  globalData: { apiBase: '', handoffUrl: '' }
});
