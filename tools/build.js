// 產生 editor.html（編輯器）、blocks/*.html（各區塊嵌入碼）與 site-preview.html（整站預覽）
// 用法：node tools/build.js
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const root = path.join(__dirname, '..');
const body = fs.readFileSync(path.join(root, 'src/editor-body.html'), 'utf8');
const page =
  '<!doctype html>\n<html lang="zh-Hant">\n<head>\n<meta charset="utf-8">\n' +
  '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n</head>\n<body>\n' +
  body + '\n</body>\n</html>\n';
fs.writeFileSync(path.join(root, 'editor.html'), page);

const names = {
  stats: '01-信任數字列', services: '02-服務項目卡片', why: '03-為什麼選擇我們', process: '04-施工流程時間軸',
  ba: '05-施工前後對比滑桿', reviews: '06-客戶評價輪播', products: '07-精選商品', faq: '08-常見問題手風琴',
  contact: '09-聯絡按鈕列', promo: '10-公告優惠橫幅',
};

(async () => {
  const browser = await chromium.launch();
  const p = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  p.on('pageerror', e => errors.push(e.message));
  p.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await p.goto('file://' + path.join(root, 'editor.html'));
  await p.waitForTimeout(500);
  const ids = await p.evaluate(() => window.JIAAN.blocks);
  const outDir = path.join(root, 'blocks');
  fs.mkdirSync(outDir, { recursive: true });
  const report = [];
  for (const id of ids) {
    // 讓編輯器預覽並測量這個區塊
    await p.evaluate(id => { location.hash = id; }, id);
    await p.click(`nav button[data-id="${id}"]`);
    await p.waitForTimeout(1500);
    const code = await p.evaluate(id => window.JIAAN.buildCode(id, true), id);
    const m = await p.evaluate(id => window.JIAAN.measures[id] || {}, id);
    fs.writeFileSync(path.join(outDir, names[id] + '.html'), code);
    report.push(`${names[id]}: 桌機 ${m.d}px / 手機 ${m.m}px`);
  }
  console.log(report.join('\n'));
  // 網站預覽：把每個區塊的程式碼放進模擬的協作平台頁面
  const codes = {};
  for (const id of ids) codes[id] = await p.evaluate(id => window.JIAAN.buildCode(id, false), id);
  const tpl = fs.readFileSync(path.join(root, 'src/site-template.html'), 'utf8');
  const siteBody = tpl.replace('/*__CODES__*/', JSON.stringify(codes).replace(/</g, '\\u003c'));
  fs.writeFileSync(path.join(root, 'src/site-preview-body.html'), siteBody);
  fs.writeFileSync(path.join(root, 'site-preview.html'),
    '<!doctype html>\n<html lang="zh-Hant">\n<head>\n<meta charset="utf-8">\n' +
    '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n</head>\n<body>\n' + siteBody + '\n</body>\n</html>\n');
  if (errors.length) { console.error('ERRORS:\n' + errors.join('\n')); process.exitCode = 1; }
  await browser.close();
})();
