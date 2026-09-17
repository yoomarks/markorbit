import { access, readFile } from 'node:fs/promises';

const files = [
  'project.config.json',
  'miniprogram/app.js',
  'miniprogram/app.json',
  'miniprogram/lib/projection.js',
  'miniprogram/pages/site/index.js',
  'miniprogram/pages/site/index.wxml',
  'miniprogram/pages/site/index.wxss',
  'miniprogram/pages/handoff/index.js',
  'miniprogram/pages/handoff/index.wxml'
];

await Promise.all(files.map((file) => access(new URL(`../${file}`, import.meta.url))));
const project = JSON.parse(
  await readFile(new URL('../project.config.json', import.meta.url), 'utf8')
);
if (project.appid !== '') throw new Error('Repository project config must not contain an AppID.');
const app = JSON.parse(await readFile(new URL('../miniprogram/app.json', import.meta.url), 'utf8'));
for (const page of ['pages/site/index', 'pages/handoff/index']) {
  if (!app.pages.includes(page)) throw new Error(`Missing native page: ${page}`);
}
const runtimeSources = await Promise.all(
  files
    .filter((file) => /\.(?:js|wxml)$/u.test(file))
    .map((file) => readFile(new URL(`../${file}`, import.meta.url), 'utf8'))
);
const runtime = runtimeSources.join('\n');
for (const forbidden of [
  '/api/markreg/',
  '/api/site/markreg/',
  'wx.login',
  'wx.requestPayment',
  'openid',
  'unionid',
  'setStorage'
]) {
  if (runtime.includes(forbidden)) {
    throw new Error(`Mini Program renderer crosses a forbidden owner boundary: ${forbidden}`);
  }
}
for (const state of ['loading', 'empty', 'error', 'partial', 'success']) {
  if (!runtime.includes(`'${state}'`) && !runtime.includes(`=== '${state}'`)) {
    throw new Error(`Mini Program renderer is missing UI state: ${state}`);
  }
}
process.stdout.write('WeChat Mini Program project boundary validated.\n');
