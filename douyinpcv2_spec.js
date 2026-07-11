// douyinpcv2.spec.js · 抖音手机APP同源 PC宽屏版 回归(Playwright 标准版)
// 运行方式(二选一):
//   线上: APP_URL=https://infinity-os-sh.github.io/Infinity-os-SH/douyinpcv2.html npx playwright test douyinpcv2.spec.js
//   本地: APP_URL=file:///绝对路径/douyinpcv2.html npx playwright test douyinpcv2.spec.js
// 断言口径与 jsdom 版 testpcv2.js(31项)对齐;§13 必测20项全覆盖。
const { test, expect } = require('@playwright/test');
const APP = process.env.APP_URL || 'https://infinity-os-sh.github.io/Infinity-os-SH/douyinpcv2.html';
const E = (pg, x) => pg.evaluate(x);

test('01-03 标题/七Tab/手机视觉体系(非后台风)', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(APP);
  expect(await page.title()).toContain('PC同源宽屏版');
  expect(await page.locator('.tab').count()).toBe(7);
  for (const s of ['.trialbar', '.hd', '.stagestrip', '.tabs', '.card', '.metric']) await expect(page.locator(s).first()).toBeAttached();
});

test('04-05 1440/1920 进入PC三栏布局·navbar隐藏', async ({ page }) => {
  for (const wpx of [1440, 1920]) {
    await page.setViewportSize({ width: wpx, height: 900 });
    await page.goto(APP);
    const cols = await E(page, "getComputedStyle(document.getElementById('scroll')).gridTemplateColumns");
    expect(cols.split(' ').length).toBe(3);                       // 三栏
    await expect(page.locator('.navbar')).toBeHidden();           // PC 隐藏底部导航(媒询直连.navbar·navbar在body直下)
    await expect(page.locator('#pcDiag')).toBeVisible();          // 右侧诊断区
  }
});

test('06-09 颜色/组件/七屏顺序/五岗 同源', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(APP);
  expect(await E(page, "getComputedStyle(document.body).backgroundColor")).toBe('rgb(38, 40, 45)'); // #26282d
  expect(await E(page, "SCREENS.map(s=>s.id).join()")).toBe('today,dual,pipe,collect,ledger,task,cockpit');
  expect(await E(page, "Object.keys(OP_ROLES).length")).toBe(5);
});

test('10-11 种草四指标不回退 + A3桥存在', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(APP);
  const labels = await E(page, "SEED_TODAY.map(x=>x.label).join('|')");
  expect(labels).toContain('看后搜率/小蓝词点击率');
  expect(labels).toContain('CPA3');
  expect(labels).not.toContain('商品点击率');
  expect(await E(page, "led().joint.length")).toBe(3);
});

test('12-13 J0–J6 / N0–N6 横向(卡片不换表格)+ 关键卡保留', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(APP);
  await E(page, "setTab('dual')");
  expect(await page.locator('.pc-hrow .jn').count()).toBe(7);
  await E(page, "setTab('pipe')");
  expect(await page.locator('.pc-hrow .node').count()).toBe(7);
  await expect(page.locator('#cardHS')).toBeAttached();
  expect(await page.locator('#cardN3 [onclick^="toggleN3"], #cardN3 .n3row, #cardN3 div').count()).toBeGreaterThan(0);
});

test('14+19 点KPI/J/N → 右侧诊断区变化(不只是Toast)+ N6 Artifact', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(APP);
  const d0 = await page.locator('#pcDiag').innerHTML();
  await E(page, "openAttr('retain_3s')");
  expect(await page.locator('#pcDiag').innerHTML()).not.toBe(d0);
  await expect(page.locator('#pcDiag')).toContainText('归因');
  await E(page, "setTab('dual')"); await E(page, "toggleJ('J3')");
  await expect(page.locator('#pcDiag')).toContainText('J3');
  await E(page, "setTab('pipe')"); await E(page, "toggleArt(6)");
  await expect(page.locator('#pcDiag')).toContainText('Input');
});

test('15-16 未握手N2不解锁 · N3未过不放量(预算真拦截)', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(APP);
  await E(page, "setTab('ledger')");
  const bud0 = await E(page, 'S.budget');
  await E(page, 'buy(5000)');
  expect(await E(page, 'S.budget')).toBe(bud0);                 // 未握手不准花钱
  await E(page, "hsConfirm('seed');S.role='live_room';hsConfirm('live');S.role='seed_kol'");
  await E(page, 'toggleN3(2)');
  await E(page, 'buy(3000)');
  expect(await E(page, 'S.budget')).toBe(bud0);                 // N3未过不准加投
  await E(page, 'toggleN3(2)');
  await E(page, 'buy(5000)');
  expect(await E(page, 'S.budget')).toBe(bud0 - 5000);          // 双门过→真扣款
});

test('17-18 HITL留痕 + 派发→执行→验果→红灯熄灭', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(APP);
  await E(page, "hsConfirm('seed');S.role='live_room';hsConfirm('live');S.role='seed_kol'");
  await E(page, 'buy(999999)');
  const p0 = await E(page, 'S.pending.length'), h0 = await E(page, 'S.history.length');
  await E(page, 'approve(S.pending.length-1)');
  expect(await E(page, 'S.pending.length')).toBe(p0 - 1);
  expect(await E(page, 'S.history.length')).toBe(h0 + 1);
  await E(page, "setStage('growth');S.role='ops'");
  const fr0 = await E(page, 'firedRules().length');
  await E(page, "dispatch(firedRules()[0].id,0)");
  const tid = await E(page, 'S.tasks[S.tasks.length-1].id');
  await E(page, `startTask(${tid});finishTask(${tid});review(${tid},true)`);
  expect(await E(page, 'firedRules().length')).toBeLessThan(fr0);   // 红灯真熄灭
});

test('P0-07 三本账三栏同屏(metric小卡不换大表格)', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(APP);
  await E(page, "setTab('ledger')");
  expect(await page.locator('.pc-hrow3 .card').count()).toBe(3);
  expect(await page.locator('.metric').count()).toBeGreaterThan(10);
});

test('20 PC与手机端:六阶段 Gate/判据/N6 全一致(同源铁证)', async ({ browser }) => {
  const MOBILE = APP.replace('douyinpcv2.html', 'douyinv20.html');
  const pcPage = await browser.newPage(); await pcPage.setViewportSize({ width: 1440, height: 900 });
  const mbPage = await browser.newPage(); await mbPage.setViewportSize({ width: 390, height: 844 });
  await pcPage.goto(APP); await mbPage.goto(MOBILE);
  for (const st of ['import', 'growth', 'mature', 'decline', 'renewal', 'retire']) {
    await E(pcPage, `setStage('${st}')`); await E(mbPage, `setStage('${st}')`);
    expect(await E(pcPage, 'gatePass()')).toBe(await E(mbPage, 'gatePass()'));
    expect(await E(pcPage, 'JSON.stringify(n6Verdict())')).toBe(await E(mbPage, 'JSON.stringify(n6Verdict())'));
  }
});

test('稳定性:六阶段×七屏无崩(PC分栏整理不破坏渲染)', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1000 });
  await page.goto(APP);
  await E(page, "ORDER.forEach(st=>{setStage(st);['today','dual','pipe','collect','ledger','task','cockpit'].forEach(t=>setTab(t))})");
  expect(await page.locator('#scroll > *').count()).toBeGreaterThan(2);
});
