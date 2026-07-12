// douyinpcv3.spec.js · TL真浏览器验证(Playwright Test)
// 运行:npx playwright test douyinpcv3.spec.js
// URL 可换 file:// 或 https://infinity-os-sh.github.io/Infinity-os-SH/douyinpcv3.html
const { test, expect } = require('@playwright/test');
const URL = process.env.DPC3_URL || 'https://infinity-os-sh.github.io/Infinity-os-SH/douyinpcv3.html';

async function boot(page){ await page.goto(URL); await page.waitForTimeout(900); }
const V = p => p.evaluate('window.__V3S');
const Sb = p => p.evaluate('window.__S');

test.describe('A 基线回归+P0-1壳', () => {
  test('壳注入:11维筛选+10导航+主区互斥', async ({ page }) => {
    await boot(page);
    for (const id of ['fRole','fShop','fSku','fStage','fCycle','fCampaign','fKol','fSession','fPlan','fMat','fDate'])
      await expect(page.locator('#'+id)).toHaveCount(1);
    await expect(page.locator('.v3n')).toHaveCount(10);
    await page.evaluate("v3Go('sup')"); await page.waitForTimeout(200);
    expect(await page.evaluate("document.getElementById('v3main').style.display")).toBe('block');
    expect(await page.evaluate("document.getElementById('scroll').style.display")).toBe('none');
  });
  test('P0-6:点阶段条只改stage_view,真实阶段不动', async ({ page }) => {
    await boot(page);
    await page.locator('[data-stg="growth"]').click({ force: true }); await page.waitForTimeout(300);
    expect((await Sb(page)).stage).toBe('growth');
    expect((await V(page)).lifecycle.real).toBe('import');
  });
  test('P0-1/DPC2-05:团队全景多维筛选真subset(非死表)', async ({ page }) => {
    await boot(page);
    await page.evaluate("setRole('mgr');v3Go('sup')"); await page.waitForTimeout(250);
    const n0 = await page.evaluate('window.__panoRows().length');
    const agg0 = await page.evaluate('window.__panoAgg().reduce((s,x)=>s+x.today,0)');
    await page.selectOption('#fCampaign', { label: '日常Always-on' }); await page.waitForTimeout(250);
    const n1 = await page.evaluate('window.__panoRows().length');
    const agg1 = await page.evaluate('window.__panoAgg().reduce((s,x)=>s+x.today,0)');
    expect(n1).toBeLessThan(n0); expect(agg1).toBeLessThan(agg0); expect(n1).toBeGreaterThan(0);
    // DOM 计数真随之变化
    expect(await page.locator('[data-panorama-n]').textContent()).toBe(String(n1));
    await page.selectOption('#fCampaign', { label: '全部活动' }); await page.waitForTimeout(250);
    expect(await page.evaluate('window.__panoRows().length')).toBe(n0);
    // sku 收窄:每行命中
    await page.selectOption('#fSku', { index: 1 }); await page.waitForTimeout(250);
    const pure = await page.evaluate('window.__panoRows().every(r=>r.sku===window.__V3S.filters.sku)');
    expect(pure).toBeTruthy();
  });
});

test.describe('C P0-2 主管六队列(DPC2-04)', () => {
  test('越权拦截→主管核定→幂等→督办→验收→复盘→升层→背书', async ({ page }) => {
    await boot(page);
    await page.evaluate("setRole('ops');v3Go('sup')"); await page.waitForTimeout(250);
    await expect(page.locator('#v3main .qtab')).toHaveCount(6);
    await page.locator('[data-ap="AP-01"]').click({ force: true }); await page.waitForTimeout(200);
    expect((await V(page)).queues.approve.length).toBe(3); // 越权未减
    await page.evaluate("setRole('mgr')"); await page.waitForTimeout(200);
    await page.locator('[data-ap="AP-01"]').click({ force: true }); await page.waitForTimeout(200);
    let v = await V(page);
    expect(v.queues.approve.length).toBe(2);
    expect(v.audit[0].reason).toContain('止损');
    const a0 = v.audit.length;
    await page.evaluate("v3Approve('AP-01',true)"); await page.waitForTimeout(150);
    expect((await V(page)).audit.length).toBe(a0); // 幂等
    await page.evaluate("v3SupQ('urge')"); await page.waitForTimeout(150);
    await page.locator('[data-urge="UG-01"]').click({ force: true }); await page.waitForTimeout(200);
    await expect(page.locator('[data-ust="UG-01"]')).toHaveText('已催办');
    await page.evaluate("v3SupQ('accept')"); await page.waitForTimeout(150);
    const r0 = (await V(page)).queues.review.length;
    await page.locator('[data-ac="AC-01"]').click({ force: true }); await page.waitForTimeout(200);
    expect((await V(page)).queues.review.length).toBe(r0 + 1);
    await page.evaluate("v3SupQ('review')"); await page.waitForTimeout(150);
    const t0 = (await V(page)).v3tasks.length;
    await page.locator('[data-rv="RV-01"]').click({ force: true }); await page.waitForTimeout(200);
    expect((await V(page)).v3tasks.length).toBe(t0 + 1);
    await page.evaluate("v3SupQ('esc')"); await page.waitForTimeout(150);
    await page.locator('[data-es="ES-01"]').click({ force: true }); await page.waitForTimeout(200);
    await page.evaluate("v3SupQ('back')"); await page.waitForTimeout(150);
    await page.locator('[data-bk="BK-01"]').click({ force: true }); await page.waitForTimeout(250);
    await expect(page.locator('[data-backed="BK-01"]')).toHaveCount(1);
    expect((await V(page)).queues.recheck.length).toBeGreaterThan(0);
  });
});

test.describe('D P0-3 交接状态机(DPC2-06)', () => {
  test('draft→submitted;非法跳转拦截;退回可再提交', async ({ page }) => {
    await boot(page);
    await page.evaluate("setRole('mgr');v3Go('sup')"); await page.waitForTimeout(250);
    await page.evaluate("v3Handoff('HF-03','submitted')"); await page.waitForTimeout(150);
    expect((await V(page)).handoffs.find(h=>h.id==='HF-03').st).toBe('submitted');
    await page.evaluate("v3Handoff('HF-03','completed')"); await page.waitForTimeout(150);
    expect((await V(page)).handoffs.find(h=>h.id==='HF-03').st).toBe('submitted');
    await page.evaluate("v3Handoff('HF-03','returned');v3Handoff('HF-03','submitted')"); await page.waitForTimeout(150);
    expect((await V(page)).handoffs.find(h=>h.id==='HF-03').st).toBe('submitted');
  });
});

test.describe('E P0-4 直播场次(DPC2-07)', () => {
  test('断点/阻断放量/事件/切片/复盘/幂等/data_gap', async ({ page }) => {
    await boot(page);
    await page.evaluate("v3Go('live')"); await page.waitForTimeout(250);
    await expect(page.locator('#lvId')).toHaveText('LS-001');
    await page.locator('[data-fr="6"]').click({ force: true }); await page.waitForTimeout(200);
    expect((await V(page)).liveBp['LS-001-6']).toBeTruthy();
    await page.evaluate("seedQueuesGuard=1"); // no-op
    const u0 = await page.evaluate("(window.__V3S.queues||{urge:[]}).urge.length");
    await page.locator('#btnScale').click({ force: true }); await page.waitForTimeout(250);
    expect(await page.evaluate("window.__V3S.queues.urge.length")).toBeGreaterThan(u0);
    await page.locator('#btnEvent').click({ force: true }); await page.waitForTimeout(200);
    expect((await V(page)).liveEvents.length).toBe(1);
    await page.locator('#btnSlice').click({ force: true }); await page.waitForTimeout(200);
    expect((await V(page)).liveSlices.length).toBe(1);
    const t0 = (await V(page)).v3tasks.length;
    await page.locator('#btnLsRev').click({ force: true }); await page.waitForTimeout(250);
    expect((await V(page)).v3tasks.length).toBe(t0 + 1);
    await expect(page.locator('#lsRevOut')).toHaveCount(1);
    await page.evaluate("v3LiveReview()"); await page.waitForTimeout(150);
    expect((await V(page)).v3tasks.length).toBe(t0 + 1); // 幂等
    await page.evaluate("v3PickSession('LS-002')"); await page.waitForTimeout(250);
    expect(await page.evaluate("document.getElementById('v3main').innerHTML.indexOf('data_gap')>=0")).toBeTruthy();
  });
});

test.describe('F P0-5 素材/达人/千川(DPC2-08/09)', () => {
  test('疲劳扫描/处置任务/白名单/层级下钻/止损HITL/混算拦截', async ({ page }) => {
    await boot(page);
    await page.evaluate("v3Go('asset')"); await page.waitForTimeout(250);
    await page.locator('#btnDecay').click({ force: true }); await page.waitForTimeout(250);
    await expect(page.locator('[data-decay="MAT-002"]')).toHaveCount(1);
    const t0 = (await V(page)).v3tasks.length;
    await page.locator('[data-mt="MAT-002-refresh"]').click({ force: true }); await page.waitForTimeout(200);
    expect((await V(page)).v3tasks.length).toBe(t0 + 1);
    await page.evaluate("v3MatTask('MAT-002','refresh')"); await page.waitForTimeout(150);
    expect((await V(page)).v3tasks.length).toBe(t0 + 1); // 幂等
    await page.evaluate("v3AssetTab('kol')"); await page.waitForTimeout(200);
    await page.locator('[data-wlbtn="KOL-03"]').click({ force: true }); await page.waitForTimeout(200);
    await expect(page.locator('[data-wl="KOL-03"]')).toHaveCount(1);
    await page.evaluate("v3AssetTab('ad')"); await page.waitForTimeout(200);
    await page.locator('[data-ad="AC-欣和抖音广告户"]').click({ force: true }); await page.waitForTimeout(200);
    await expect(page.locator('[data-ad="CAMP-716大促"]')).toHaveCount(1);
    const p0 = (await Sb(page)).pending.length;
    await page.locator('#btnStoploss').click({ force: true }); await page.waitForTimeout(200);
    expect((await Sb(page)).pending.length).toBe(p0 + 1); // 涉钱进HUMAN_GATE_QUEUE
    await page.locator('#btnAdMix').click({ force: true }); await page.waitForTimeout(200);
    expect((await V(page)).audit[0].action).toContain('混算');
  });
});

test.describe('G P0-6 真迁移(DPC2-10)', () => {
  test('乱序拦截/HITL角色/六步事务/重复幂等/失败回滚', async ({ page }) => {
    await boot(page);
    await page.evaluate("v3Go('lc')"); await page.waitForTimeout(250);
    await page.evaluate("v3MigStep(3)");
    expect((await V(page)).lifecycle.real).toBe('import');
    await page.evaluate("setRole('seed_kol');v3MigStep(0);v3MigStep(1);v3MigStep(2)"); await page.waitForTimeout(200);
    expect(await page.evaluate("window.__V3S.audit.some(a=>a.action.indexOf('越权')>=0)")).toBeTruthy();
    await page.evaluate("setRole('mgr');v3MigStep(2);v3MigStep(3);v3MigStep(4);v3MigStep(5)"); await page.waitForTimeout(300);
    let v = await V(page);
    expect(v.lifecycle.real).toBe('growth');
    expect(v.lifecycle.frozen.length).toBeGreaterThanOrEqual(5);
    const cyc = v.lifecycle.cycle;
    await page.evaluate("for(let i=0;i<6;i++)v3MigStep(i)"); await page.waitForTimeout(200);
    expect((await V(page)).lifecycle.cycle).toBe(cyc); // 重复迁移幂等
    await page.evaluate("v3MigTarget('mature');v3MigFail();v3MigStep(0);v3MigStep(1);v3MigStep(2);v3MigStep(3);v3MigStep(4)"); await page.waitForTimeout(250);
    expect((await V(page)).lifecycle.real).toBe('growth'); // 失败回滚
  });
});

test.describe('H–K OneID/后效应/JBP/激励', () => {
  test('DPC2-11/14/15+激励门槛', async ({ page }) => {
    await boot(page);
    await page.evaluate("v3Go('oneid')"); await page.waitForTimeout(250);
    await expect(page.locator('[data-oi="OI-005"]')).toHaveText('unmatchable');
    await page.locator('#btnConsent').click({ force: true }); await page.waitForTimeout(200);
    await expect(page.locator('[data-oi="OI-001"]')).toHaveText('revoked');
    await page.evaluate("v3Go('post')"); await page.waitForTimeout(250);
    await page.selectOption('[data-pv="video_post_review"]', '真实资产'); await page.waitForTimeout(200);
    await expect(page.locator('[data-pvout="video_post_review"]')).toHaveCount(1);
    await page.locator('#btnBurst').click({ force: true }); await page.waitForTimeout(200);
    expect((await V(page)).audit[0].action).toContain('爆发申请毕业');
    await page.evaluate("v3Go('jbp')"); await page.waitForTimeout(250);
    const t0 = (await V(page)).v3tasks.length;
    await page.locator('[data-jbp="JC-01"]').click({ force: true }); await page.waitForTimeout(200);
    expect((await V(page)).v3tasks.length).toBe(t0 + 1);
    await page.locator('[data-jbpw="JC-01"]').click({ force: true }); await page.waitForTimeout(200);
    await expect(page.locator('[data-sc="0"]')).toHaveText('10');
    await page.evaluate("v3Go('ana')"); await page.waitForTimeout(250);
    await page.locator('#btnRedline').click({ force: true }); await page.waitForTimeout(150);
    await page.locator('#btnPayout').click({ force: true }); await page.waitForTimeout(150);
    expect((await V(page)).audit[0].after).toBe('DENIED');
    await page.locator('#btnRedline').click({ force: true }); await page.waitForTimeout(150);
    await page.locator('#btnPayout').click({ force: true }); await page.waitForTimeout(150);
    expect((await V(page)).audit[0].after).toBe('APPROVED');
  });
});

test.describe('L P0-8 工程底座(DPC2-12/13)', () => {
  test('规则扫描去重/乐观锁/幂等/回滚/data_gap/持久化/深链接', async ({ page }) => {
    await boot(page);
    await page.evaluate("v3Go('eng');setRole('ops')"); await page.waitForTimeout(250);
    const t0 = (await V(page)).v3tasks.length;
    await page.locator('#btnRuleScan').click({ force: true }); await page.waitForTimeout(200);
    expect((await V(page)).v3tasks.length).toBe(t0 + 1);
    await page.evaluate("v3RuleScan()"); await page.waitForTimeout(150);
    expect((await V(page)).v3tasks.length).toBe(t0 + 1); // 去重
    const v0 = (await V(page)).lockDemo.version;
    await page.locator('#btnLockOk').click({ force: true }); await page.waitForTimeout(150);
    expect((await V(page)).lockDemo.version).toBe(v0 + 1);
    await page.locator('#btnLockStale').click({ force: true }); await page.waitForTimeout(150);
    expect((await V(page)).lockDemo.version).toBe(v0 + 1); // 409拒绝
    await page.locator('#btnIdem').click({ force: true }); await page.waitForTimeout(150);
    const a0 = (await V(page)).audit.length;
    await page.locator('#btnIdem').click({ force: true }); await page.waitForTimeout(150);
    expect((await V(page)).audit.length).toBe(a0);
    await page.evaluate("setRole('mgr')"); await page.waitForTimeout(150);
    await page.locator('#btnRollback').click({ force: true }); await page.waitForTimeout(200);
    await expect(page.locator('#ruleCur')).toHaveText('v2.0');
    await page.locator('[data-gap="0"]').click({ force: true }); await page.waitForTimeout(200);
    await page.locator('#btnStoreSave').click({ force: true }); await page.waitForTimeout(150);
    expect(await page.evaluate("!!localStorage.getItem('douyinpcv3_state_v1')")).toBeTruthy();
    await page.locator('#btnDeepLink').click({ force: true }); await page.waitForTimeout(150);
    expect(await page.evaluate("location.hash")).toContain('session=');
  });
});

test.describe('M DPC2-01/03 口径与三尺寸', () => {
  for (const [wd, ht] of [[1366, 768], [1440, 900], [1920, 1080]]) {
    test(`四区布局 ${wd}x${ht}`, async ({ page }) => {
      await page.setViewportSize({ width: wd, height: ht });
      await boot(page);
      expect(await page.evaluate("getComputedStyle(document.getElementById('v3nav')).position")).toBe('fixed');
      await page.evaluate("v3Go('sup')"); await page.waitForTimeout(200);
      expect(await page.evaluate("document.getElementById('v3main').style.display")).toBe('block');
      expect(await page.evaluate("!!document.getElementById('pcDiag')")).toBeTruthy(); // 右证据区
    });
  }
  test('平台口径:无AIQL/AIPL主线泄漏,5A双前线在位', async ({ page }) => {
    await boot(page);
    const h = await page.evaluate("document.body.innerHTML");
    expect(h).not.toContain('AIQL'); expect(h).not.toContain('AIPL');
    expect(h).toContain('双前线'); expect(h).toContain('种草达人');
  });
});
