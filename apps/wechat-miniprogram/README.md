# WeChat Mini Program Site renderer

This package is one native WeChat renderer for the existing Workspace Site runtime. It owns no
Customer, Quote, Order, Matter, Payment, catalog, content, attribution, or Site configuration truth.

The operator must provide `apiBase` through WeChat ext config. The Gateway deployment must bind
`WECHAT_MINIPROGRAM_SITE_HOSTNAME` to the already active Site hostname. The adapter resolves that
hostname server-side; launch/query input cannot choose a Site or Workspace.

`project.config.json` intentionally contains no AppID. Real Developer Tools/device acceptance
requires an operator AppID plus registered request and web-view domains. Repository contract tests
are not evidence of real-platform acceptance.
