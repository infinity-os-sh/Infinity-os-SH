// xhsv52spec.js · 小红书 App V0.5.2 字段命名最终清理版 · Playwright 回归测试
// 运行: npx playwright test xhsv52spec.js  (需 @playwright/test; xhsv521.html 与本文件同目录)
// 覆盖: 主模型字段 / 角色key / 账本组键 / legacy兼容 / 核心真点交互(状态真变,非弹提示)
const { test, expect } = require('@playwright/test');
const path = require('path');
const URL = 'file://' + path.resolve(__dirname, 'xhsv521.html');

test.describe('xhsv52 字段命名最终清理版', () => {

  test('加载:V0.5.2 无JS错误', async ({ page }) => {
    const errs = [];
    page.on('pageerror', e => errs.push(String(e)));
    await page.goto(URL); await page.waitForTimeout(500);
    expect(errs).toEqual([]);
    expect(await page.title()).toContain('内部残留名清理版');
    expect(await page.locator('.tab').count()).toBe(7);
  });

  test('主模型:audience_asset 五键 + LEGACY adapter', async ({ page }) => {
    await page.goto(URL); await page.waitForTimeout(400);
    const aa = await page.evaluate(() => Object.keys(curSKU().audience_asset));
    expect(aa).toEqual(['aip_reach_users','interest_users','deep_seed_users','purchase_users','loyalty_users']);
    expect(await page.evaluate(() => curSKU().fiveA === undefined)).toBe(true);
    expect(await page.evaluate(() => LEGACY_FIVEA_ADAPTER.A3)).toBe('deep_seed_users');
    expect(await page.evaluate(() => fromLegacyFiveA({A1:1}).aip_reach_users)).toBe(1);
    expect(await page.evaluate(() => LEGACY_FIVEA_LABELS.length)).toBe(5);
    // compat_5a 已移出 consumer 主结构
    expect(await page.evaluate(() => CHANNEL.consumer.compat_5a === undefined)).toBe(true);
  });

  test('指标key:新名在账本·旧名清零', async ({ page }) => {
    await page.goto(URL); await page.waitForTimeout(400);
    const lm = await page.evaluate(() => Object.keys(ledMap()));
    for (const k of ['new_deep_seed_users','cpti','note_cover_click_rate','commercial_note_click_rate','new_customer_repurchase_rate'])
      expect(lm).toContain(k);
    for (const k of ['new_a3','cpa3','retain_3s','product_ctr','new_repurchase','completion','completion_v'])
      expect(lm).not.toContain(k);
  });

  test('账本组键:content_trust/traffic_efficiency/commerce_bridge/asset_compound(六期一致)', async ({ page }) => {
    await page.goto(URL); await page.waitForTimeout(400);
    for (const stg of ['import','growth','mature','decline','renewal','retire']) {
      await page.evaluate(s => setStage(s), stg); await page.waitForTimeout(150);
      expect(await page.evaluate(() => Object.keys(led())))
        .toEqual(['content_trust','traffic_efficiency','commerce_bridge','asset_compound']);
    }
  });

  test('角色key:content_seed/commerce_ops/reputation_repurchase + 旧login链接兼容', async ({ page, browser }) => {
    await page.goto(URL); await page.waitForTimeout(400);
    const tm = await page.evaluate(() => Object.keys(TEAM));
    expect(tm).toEqual(expect.arrayContaining(['content_seed','commerce_ops','reputation_repurchase']));
    expect(await page.evaluate(() => { setRole('reputation_repurchase'); return S.role; })).toBe('reputation_repurchase');
    // 旧链接 role=seed_kol / live_room 经 LEGACY_ROLE_ALIAS 转换
    const p2 = await browser.newPage(); await p2.goto(URL + '?role=seed_kol'); await p2.waitForTimeout(400);
    expect(await p2.evaluate(() => S.role)).toBe('content_seed'); await p2.close();
    const p3 = await browser.newPage(); await p3.goto(URL + '?role=live_room'); await p3.waitForTimeout(400);
    expect(await p3.evaluate(() => S.role)).toBe('reputation_repurchase'); await p3.close();
  });

  test('真点:✎改数→Gate重判(状态真变)', async ({ page }) => {
    await page.goto(URL); await page.waitForTimeout(400);
    const before = await page.locator('#gateBox .gv').first().innerText();
    await page.locator('[data-edit="0"]').click({ force: true }); await page.waitForTimeout(300);
    expect(await page.locator('#gateBox .gv').first().innerText()).not.toBe(before);
  });

  test('真点:N4放量→HITL队列真入队 + 主管核定留痕', async ({ page }) => {
    await page.goto(URL); await page.waitForTimeout(400);
    await page.evaluate(() => setTab('pipe')); await page.waitForTimeout(300);
    const p0 = await page.evaluate(() => S.pending.length);
    await page.locator('#btnScale').click({ force: true }); await page.waitForTimeout(300);
    expect(await page.evaluate(() => S.pending.length)).toBe(p0 + 1);
    await page.evaluate(() => setRole('mgr')); await page.evaluate(() => setTab('cockpit')); await page.waitForTimeout(300);
    await page.locator('[data-appr="0"]').click({ force: true }); await page.waitForTimeout(300);
    expect(await page.evaluate(() => S.pending.length)).toBe(p0);
    expect(await page.evaluate(() => S.history.length)).toBeGreaterThan(0);
  });

  test('真点:关差闭环 派发→执行→验果→红灯熄灭(新key驱动)', async ({ page }) => {
    await page.goto(URL); await page.waitForTimeout(400);
    await page.evaluate(() => setTab('ledger')); await page.waitForTimeout(200);
    await page.evaluate(() => toggleLedger('content_trust', led().content_trust.findIndex(m => m.k === 'new_deep_seed_users')));
    await page.waitForTimeout(300);
    expect(await page.evaluate(() => firedRules().map(r => r.id))).toContain('R1');
    await page.evaluate(() => setRole('ops')); await page.evaluate(() => setTab('task')); await page.waitForTimeout(300);
    await page.locator('[data-disp^="R1-"]').first().click({ force: true }); await page.waitForTimeout(300);
    const tid = await page.evaluate(() => S.tasks[0].id);
    await page.locator(`[data-start="${tid}"]`).click({ force: true }); await page.waitForTimeout(200);
    await page.locator(`[data-finish="${tid}"]`).click({ force: true }); await page.waitForTimeout(200);
    await page.locator(`[data-rev1="${tid}"]`).click({ force: true }); await page.waitForTimeout(300);
    expect(await page.evaluate(t => findTask(t).verdict, tid)).toBe('有效');
    expect(await page.evaluate(() => firedRules().map(r => r.id))).not.toContain('R1');
  });

  test('N6输出:chain_health 用新组键', async ({ page }) => {
    await page.goto(URL); await page.waitForTimeout(400);
    await page.evaluate(() => setTab('pipe')); await page.waitForTimeout(300);
    await page.locator('[data-node="6"]').click({ force: true }); await page.waitForTimeout(300);
    const art = await page.locator('#art6').innerText();
    expect(art).toContain('content_trust_pass');
    expect(art).not.toContain('seed_pass');
  });

  test('残留词:前台无抖音/5A旧语言', async ({ page }) => {
    await page.goto(URL); await page.waitForTimeout(400);
    const body = await page.locator('body').innerText();
    for (const w of ['5A','千川','小蓝词','三秒率','商品卡','搜索商销','素材疲劳','放量衰减','无效播放'])
      expect(body).not.toContain(w);
  });
});

// xhsv521 追加:lowercase 旧字段黑名单(反馈四 P1)· 运行时主路径对象里不得出现旧内部名
test.describe('xhsv521 lowercase legacy tail clean', () => {
  const BLACKLIST = ['a3_to_a4','a4_to_a5','a4_to_ltv','a5_usage','a5_wakeup','a5_migrate_ready',
    'hook_3s','play_3s_rate','sop_live','a1_grow','a2_grow',
    'new_a3','cpa3','retain_3s','product_ctr','seed_kol','commerce_kol','live_room','fiveA'];

  test('运行时主路径无旧内部名(六期全查)', async ({ page }) => {
    await page.goto(URL); await page.waitForTimeout(400);
    for (const stg of ['import','growth','mature','decline','renewal','retire']) {
      await page.evaluate(s => setStage(s), stg); await page.waitForTimeout(150);
      const dump = await page.evaluate(() => JSON.stringify({
        stage: STAGES[S.stage], mock: MOCK_DATA[S.stage], // 全阶段结构+数据(metrics/nodes/gate_result/node_outputs)
        ledKeys: Object.keys(ledMap()),
        attrKeys: Object.keys(ATTR),
        jumpKeys: Object.keys(KPI_JUMP),
        sopIds: SOPS.map(s => s.id),
        teamKeys: Object.keys(TEAM),
        twin: LEDGER_TWIN
      }));
      for (const bad of BLACKLIST) expect(dump, `${stg} 阶段含旧字段 ${bad}`).not.toContain(bad);
    }
  });

  test('新名在位:loyalty系/purchase系/sop_reputation', async ({ page }) => {
    await page.goto(URL); await page.waitForTimeout(400);
    expect(await page.evaluate(() => SOPS.some(s => s.id === 'sop_reputation'))).toBe(true);
    await page.evaluate(() => setStage('renewal')); await page.waitForTimeout(200);
    const dump = await page.evaluate(() => JSON.stringify(MOCK_DATA[S.stage]));
    for (const good of ['loyalty_wakeup_rate','loyalty_usage','restart_cover_click_rate'])
      expect(dump).toContain(good);
    await page.evaluate(() => setStage('import')); await page.waitForTimeout(200);
    expect(await page.evaluate(() => JSON.stringify(MOCK_DATA[S.stage]))).toContain('note_hook');
    await page.evaluate(() => setStage('decline')); await page.waitForTimeout(200);
    expect(await page.evaluate(() => JSON.stringify(MOCK_DATA[S.stage]))).toContain('loyalty_migration_ready');
  });
});
