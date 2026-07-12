// douyinpcv4.spec.js · TL真浏览器验证(Playwright Test)· 三本账根因诊断闭环
// 运行:npx playwright test douyinpcv4.spec.js
const { test, expect } = require('@playwright/test');
const URL = process.env.DPC4_URL || 'https://infinity-os-sh.github.io/Infinity-os-SH/douyinpcv4.html';

async function boot(page){ await page.goto(URL); await page.waitForTimeout(900); await page.evaluate("setTab('ledger'); window.__v4mount&&window.__v4mount();"); await page.waitForTimeout(300); }
const V = p => p.evaluate('window.V4S');
async function setLed(page, ov){ await page.evaluate(o=>{ const S=window.__S; S.ledgerEdited=S.ledgerEdited||{}; S.ledgerEdited[S.stage]=S.ledgerEdited[S.stage]||{}; Object.assign(S.ledgerEdited[S.stage],o); }, ov); }

test.describe('LRC-01/02 复合索引与字典', () => {
  test('分账本索引+复合键上下游', async ({ page }) => {
    await boot(page);
    expect(await page.evaluate("!!(ledgerIndex().seed&&ledgerIndex().sell&&ledgerIndex().joint)")).toBeTruthy();
    expect(await page.evaluate("mParse('joint.a3_to_order_conversion_rate').ledger")).toBe('joint');
    expect(await page.evaluate("METRIC_DICT['joint.a3_to_product_click_rate'].upstream.every(x=>x.indexOf('.')>0)")).toBeTruthy();
  });
});

test.describe('LRC-03 诊断抽屉(点指标打开·非Toast)', () => {
  test('🔬入口+七段A-G+关闭', async ({ page }) => {
    await boot(page);
    expect(await page.locator('.metric .v4dx').count()).toBeGreaterThan(0);
    await page.locator('[data-dx="joint.a3_to_order_conversion_rate"]').first().click({ force: true });
    await page.waitForTimeout(250);
    await expect(page.locator('#v4drawer')).toHaveClass(/open/);
    const b = await page.locator('#v4body').innerHTML();
    for (const s of ['A · 指标事实','B · 根因结论','C · 因果证据','D · 穿透路径','E · 改善方案','G · 验果设计'])
      expect(b).toContain(s);
    await page.locator('#v4drawer .v4x').click({ force: true }); await page.waitForTimeout(150);
    await expect(page.locator('#v4drawer')).not.toHaveClass(/open/);
  });
});

test.describe('DYLRC-01/02 穿透路径', () => {
  test('3秒率六层 + 加购率六层 + 继续深挖', async ({ page }) => {
    await boot(page);
    const seed = await page.evaluate("v4Engine('seed.retain_3s').drill_path.join('|')");
    for (const x of ['视频','素材','前3秒','钩子','达人','人群']) expect(seed).toContain(x);
    const sell = await page.evaluate("v4Engine('sell.add_cart').drill_path.join('|')");
    for (const x of ['SKU','商品卡','价格','规格','评价','库存']) expect(sell).toContain(x);
    await page.evaluate("v4Diagnose('seed.retain_3s')"); await page.waitForTimeout(150);
    const i0 = (await V(page)).cur.drill_ix;
    await page.evaluate("v4DrillDeeper()"); await page.waitForTimeout(150);
    expect((await V(page)).cur.drill_ix).toBe(i0 + 1);
  });
});

test.describe('DYLRC-03/04/05/06 责任分流', () => {
  test('种草判责', async ({ page }) => {
    await boot(page);
    await setLed(page, { new_a3:3000, cpa3:12, product_ctr:0.09, a3_to_product_click_rate:0.04 });
    expect(await page.evaluate("v4Engine('joint.a3_to_product_click_rate').diagnosis.primary_domain")).toBe('seed');
  });
  test('卖货判责', async ({ page }) => {
    await boot(page);
    await setLed(page, { new_a3:6800, cpa3:5.8, a3_to_product_click_rate:0.04, product_ctr:0.04, add_cart:0.021 });
    await page.evaluate("V4S.scenario.a3_quality_low=false");
    expect(await page.evaluate("v4Engine('joint.a3_to_product_click_rate').diagnosis.primary_domain")).toBe('sell');
  });
  test('联合承接判责(未握手→去完成握手)', async ({ page }) => {
    await boot(page);
    await page.evaluate("v4SetScenario('handshake_done',false)");
    const dom = await page.evaluate("v4Engine('joint.a3_to_order_conversion_rate').diagnosis.primary_domain");
    expect(dom).toBe('joint');
    await page.evaluate("v4Diagnose('joint.a3_to_order_conversion_rate')"); await page.waitForTimeout(200);
    expect(await page.locator('#v4body').innerHTML()).toContain('发起握手');
    await page.evaluate("v4SetScenario('handshake_done',true)");
  });
  test('数据异常→灰灯+补数,禁止误判', async ({ page }) => {
    await boot(page);
    await page.evaluate("v4SetScenario('data_gap',true)");
    const e = await page.evaluate("(()=>{const x=v4Engine('joint.a3_to_order_conversion_rate');return {s:x.status,d:x.diagnosis.primary_domain,g:x.diagnosis.data_gaps.length}})()");
    expect(e.s).toBe('gray'); expect(e.d).toBe('data'); expect(e.g).toBeGreaterThan(0);
    await page.evaluate("v4Diagnose('joint.a3_to_order_conversion_rate')"); await page.waitForTimeout(150);
    const t0 = (await V(page)).diagTasks.length;
    await page.evaluate("v4DataTask()"); await page.waitForTimeout(150);
    expect((await V(page)).diagTasks.length).toBe(t0 + 1);
    const t1 = (await V(page)).diagTasks.length;
    await page.evaluate("v4GenTask()"); await page.waitForTimeout(150);       // 灰灯禁止改善任务
    expect((await V(page)).diagTasks.length).toBe(t1);
    await page.evaluate("v4SetScenario('data_gap',false)");
  });
});

test.describe('DYLRC-07/08 改善方案与跨账联动', () => {
  test('红灯改善包完整', async ({ page }) => {
    await boot(page);
    await setLed(page, { add_cart:0.021, a3_to_order_conversion_rate:0.0015 });
    const pk = await page.evaluate("(()=>{const e=v4Engine('joint.a3_to_order_conversion_rate');const p=v4ImprovePack(e);return {c:e.diagnosis.primary_cause,r:e.recommendations.length,o:p.owner,s:p.sop_step,v:p.verify_metric}})()");
    expect(pk.c).toBeTruthy(); expect(pk.r).toBeGreaterThanOrEqual(2); expect(pk.o && pk.s && pk.v).toBeTruthy();
  });
  test('跨账跳转保留上下文', async ({ page }) => {
    await boot(page);
    await setLed(page, { new_a3:6800, a3_to_product_click_rate:0.09, product_ctr:0.04, add_cart:0.021, a3_to_order_conversion_rate:0.0015 });
    await page.evaluate("v4Diagnose('joint.a3_to_order_conversion_rate')"); await page.waitForTimeout(150);
    await page.evaluate("v4Evidence()"); await page.waitForTimeout(150);
    expect((await V(page)).cur).toBeTruthy();
  });
});

test.describe('DYLRC-09/10 任务闭环与幂等', () => {
  test('诊断→状态机→数据验果→记忆 + 幂等', async ({ page }) => {
    await boot(page);
    await page.evaluate("V4S.diagTasks=[];V4S.reqSeen={};V4S.scenario._forceUnshake=false;v4SeedHandshake()");
    await setLed(page, { add_cart:0.04, a3_to_order_conversion_rate:0.0015 });   // add_cart达标供主验果通过
    await page.evaluate("v4Diagnose('joint.a3_to_order_conversion_rate')"); await page.waitForTimeout(150);
    await page.evaluate("v4GenTask()"); await page.waitForTimeout(150);
    const tid = await page.evaluate("V4S.diagTasks[0].task_id");
    expect(tid).toBeTruthy();
    await page.evaluate(`v4AdvanceTask('${tid}','已确认根因');v4AdvanceTask('${tid}','待执行');v4AdvanceTask('${tid}','执行中');v4UploadEvidence('${tid}');v4ElapseWindow('${tid}');v4MgrApprove('${tid}');v4AdvanceTask('${tid}','待验果')`);
    await page.waitForTimeout(150);
    const mem0 = await page.evaluate("ROOT_CAUSE_MEMORY.length");
    await page.evaluate(`v4VerifyTask('${tid}')`); await page.waitForTimeout(150);
    expect(await page.evaluate("V4S.diagTasks[0].status")).toBe('有效');
    expect(await page.evaluate("ROOT_CAUSE_MEMORY.length")).toBe(mem0 + 1);
    const before = await page.evaluate("V4S.diagTasks.length");
    await page.evaluate("v4Diagnose('joint.a3_to_order_conversion_rate');v4GenTask()"); await page.waitForTimeout(150);
    expect(await page.evaluate("V4S.diagTasks.length")).toBe(before);   // 幂等
  });
});

test.describe('LRC-07/11/12 因果链·记忆·Toast', () => {
  test('因果链banner+高亮+记忆段', async ({ page }) => {
    await boot(page);
    await expect(page.locator('#v4chain')).toHaveCount(1);
    await page.evaluate("v4Diagnose('sell.add_cart')"); await page.waitForTimeout(200);
    expect(await page.locator('.v4chainline').count()).toBeGreaterThan(0);
    await page.evaluate("v4Diagnose('joint.a3_to_order_conversion_rate')"); await page.waitForTimeout(200);
    expect(await page.locator('#v4body').innerHTML()).toContain('根因记忆');
  });
});

test.describe('开箱可演示性 + 祈使强制卡(五.5/六.4/六.5)', () => {
  test('旗舰联合账开箱即红→卖货侧诊断(无需手改数据)', async ({ page }) => {
    await boot(page);
    expect(await page.evaluate("ledgerIndex().joint.a3_to_order_conversion_rate.pass")).toBe(false);
    const e = await page.evaluate("(()=>{const x=v4Engine('joint.a3_to_order_conversion_rate');return {s:x.status,d:x.diagnosis.primary_domain}})()");
    expect(e.s).toBe('red'); expect(e.d).toBe('sell');
  });
  test('F段标签 + CPA3假效率六项 + GMV拆解 + ROI多口径', async ({ page }) => {
    await boot(page);
    await page.evaluate("v4Diagnose('joint.a3_to_order_conversion_rate')"); await page.waitForTimeout(150);
    expect(await page.locator('#v4body').innerHTML()).toContain('F · 行动按钮');
    await page.evaluate("v4Diagnose('seed.cpa3')"); await page.waitForTimeout(150);
    let b = await page.locator('#v4body').innerHTML();
    for (const x of ['A3人数','A3→商品点击','A3→复购','人群有效率']) expect(b).toContain(x);
    await page.evaluate("v4Diagnose('sell.gmv')"); await page.waitForTimeout(150);
    b = await page.locator('#v4body').innerHTML();
    expect(b).toContain('贡献拆解'); expect(b).toContain('负向拖累');
    await page.evaluate("v4Diagnose('sell.roi')"); await page.waitForTimeout(150);
    b = await page.locator('#v4body').innerHTML();
    for (const x of ['平台归因','增量归因','贡献利润率']) expect(b).toContain(x);
  });
});

test.describe('复盘修复 P0-1~7 + 业务1/2', () => {
  test('P0-1 发起握手跳pipe屏cardHS+返回上下文', async ({ page }) => {
    await boot(page);
    await page.evaluate("v4Diagnose('joint.a3_to_order_conversion_rate')"); await page.waitForTimeout(150);
    await page.evaluate("v4GoHandshake()"); await page.waitForTimeout(400);
    expect(await page.evaluate("__S.tab")).toBe('pipe');
    expect(await page.evaluate("!!document.getElementById('cardHS')")).toBeTruthy();
    expect(await page.evaluate("V4S.returnContext.metric_id")).toBe('joint.a3_to_order_conversion_rate');
  });
  test('P0-3 Toast蓝≠绿+可关闭', async ({ page }) => {
    await boot(page);
    const cls = await page.evaluate("(()=>{const e=v4Toast('测试蓝','blue');const c=e.className;const x=!!e.querySelector('.v4tx');e.remove();return c+'|'+x})()");
    expect(cls).toContain('blue'); expect(cls).toContain('|true');
  });
  test('P0-4 全核心指标有专属根因树', async ({ page }) => {
    await boot(page);
    const miss = await page.evaluate(`(()=>{const need=['seed.exposure','seed.completion','seed.post_search','seed.cpa3','sell.cvr','sell.gmv','sell.refund_rate','sell.repurchase','sell.live_cvr','sell.roi'];return need.filter(m=>!ROOT_CAUSE_TREE[m]||ROOT_CAUSE_TREE[m].path.length<3)})()`);
    expect(miss).toEqual([]);
  });
  test('P0-5 状态机禁跳步 + P0-6 数据验果 + P0-7 统一任务中心', async ({ page }) => {
    await boot(page);
    await page.evaluate("V4S.diagTasks=[];V4S.reqSeen={};V4S.scenario._forceUnshake=false;v4SeedHandshake()");
    await setLed(page, { add_cart:0.04, a3_to_order_conversion_rate:0.0015 });
    await page.evaluate("v4Diagnose('joint.a3_to_order_conversion_rate');v4GenTask()"); await page.waitForTimeout(150);
    const tid = await page.evaluate("V4S.diagTasks[0].task_id");
    // P0-7 已进统一任务中心
    expect(await page.evaluate("__V3S.v3tasks.some(x=>x.source==='root_cause')")).toBeTruthy();
    // P0-5 跳步被拦
    await page.evaluate(`v4VerifyTask('${tid}')`); await page.waitForTimeout(100);
    expect(await page.evaluate("V4S.diagTasks[0].status")).toBe('待确认根因');
    // 合法走到待验果
    await page.evaluate(`v4AdvanceTask('${tid}','已确认根因');v4AdvanceTask('${tid}','待执行');v4AdvanceTask('${tid}','执行中');v4UploadEvidence('${tid}');v4ElapseWindow('${tid}');v4MgrApprove('${tid}');v4AdvanceTask('${tid}','待验果')`);
    await page.waitForTimeout(150);
    expect(await page.evaluate("V4S.diagTasks[0].status")).toBe('待验果');
    // P0-6 数据验果通过→有效+写记忆
    const mem0 = await page.evaluate("ROOT_CAUSE_MEMORY.length");
    await page.evaluate(`v4VerifyTask('${tid}')`); await page.waitForTimeout(150);
    expect(await page.evaluate("V4S.diagTasks[0].status")).toBe('有效');
    expect(await page.evaluate("ROOT_CAUSE_MEMORY.length")).toBe(mem0 + 1);
  });
  test('业务1 A3→成交口径六项+澄清', async ({ page }) => {
    await boot(page);
    await page.evaluate("v4Diagnose('joint.a3_to_order_conversion_rate')"); await page.waitForTimeout(150);
    const b = await page.locator('#v4body').innerHTML();
    for (const x of ['分子','分母','归因窗口','One ID 确认','口径澄清']) expect(b).toContain(x);
  });
});

test.describe('第4轮复盘 96→98:返回入口/恢复动作/动态目标/守线', () => {
  test('P0-1/P0-2 握手返回横幅+恢复被阻断投放(进HITL)', async ({ page }) => {
    await boot(page);
    await page.evaluate("V4S.scenario._forceUnshake=false;v4SeedHandshake()");
    await page.evaluate("v4Diagnose('joint.a3_to_order_conversion_rate')"); await page.waitForTimeout(150);
    await page.evaluate("v4GoHandshake('提交¥20,000投放审批','千川QC-PLAN-31')"); await page.waitForTimeout(300);
    await expect(page.locator('#v4hsback')).toHaveCount(1);
    expect(await page.locator('#v4hsback').innerHTML()).toContain('返回原诊断');
    const p0 = await page.evaluate("(__S.pending||[]).length");
    await page.evaluate("v4ResumeAction()"); await page.waitForTimeout(150);
    expect(await page.evaluate("(__S.pending||[]).length")).toBe(p0 + 1);
  });
  test('P0-3 验果目标动态读当前指标t', async ({ page }) => {
    await boot(page);
    await page.evaluate("V4S.diagTasks=[];V4S.reqSeen={}");
    await setLed(page, { add_cart:0.021, a3_to_order_conversion_rate:0.0015 });
    await page.evaluate("v4Diagnose('joint.a3_to_order_conversion_rate');v4GenTask()"); await page.waitForTimeout(150);
    expect(await page.evaluate("(()=>{const dt=V4S.diagTasks[0];return dt.verify_target_dynamic===mParse(dt.verify_metric).obj.t})()")).toBeTruthy();
  });
  test('P0-4 退款率显示≤', async ({ page }) => {
    await boot(page);
    await page.evaluate("V4S.diagTasks=[];V4S.reqSeen={}");
    await setLed(page, { refund_rate:0.12 });
    await page.evaluate("v4Diagnose('sell.refund_rate');v4GenTask();__v4mount()"); await page.waitForTimeout(150);
    expect(await page.locator('#v4tasks').innerHTML()).toContain('≤');
  });
  test('P0-5 守线破位→无效(ROI达标但GMV暴跌)', async ({ page }) => {
    await boot(page);
    await page.evaluate("V4S.diagTasks=[];V4S.reqSeen={};V4S.scenario._forceUnshake=false;v4SeedHandshake()");
    await setLed(page, { roi:1.3, gmv:120000 });
    await page.evaluate("v4Diagnose('sell.roi');v4GenTask()"); await page.waitForTimeout(150);
    const tid = await page.evaluate("V4S.diagTasks[0].task_id");
    expect(await page.evaluate("(V4S.diagTasks[0].guard_metrics||[]).length")).toBeGreaterThan(0);
    await page.evaluate(`v4AdvanceTask('${tid}','已确认根因');v4AdvanceTask('${tid}','待执行');v4AdvanceTask('${tid}','执行中');v4UploadEvidence('${tid}');v4ElapseWindow('${tid}');v4MgrApprove('${tid}');v4AdvanceTask('${tid}','待验果')`);
    await setLed(page, { roi:1.3, gmv:70000 });
    await page.evaluate(`v4VerifyTask('${tid}')`); await page.waitForTimeout(150);
    expect(await page.evaluate("V4S.diagTasks[0].status")).toBe('无效');
  });
});

test.describe('第5轮:复合键规则/A3→加购正式入账/Consolidation', () => {
  test('ledMap复合键+RULES迁移+R2照常触发', async ({ page }) => {
    await boot(page);
    expect(await page.evaluate("!!(ledMap()['sell.product_ctr']&&ledMap()['joint.a3_to_order_conversion_rate'])")).toBeTruthy();
    expect(await page.evaluate("String(__RULES.find(r=>r.id==='R2').when).includes(\"sell.product_ctr\")")).toBeTruthy();
    expect(await page.evaluate("__RULES.find(r=>r.id==='R2').when(ledMap())")).toBe(true);
  });
  test('joint.a3_to_add_cart_rate 六阶段入账+可诊断+链上有环', async ({ page }) => {
    await boot(page);
    const missing = await page.evaluate(`(()=>{const out=[];['import','growth','mature','decline','renewal','retire'].forEach(st=>{setStage(st);if(!ledgerIndex().joint.a3_to_add_cart_rate)out.push(st)});setStage('import');return out})()`);
    expect(missing).toEqual([]);
    const e = await page.evaluate("(()=>{const x=v4Engine('joint.a3_to_add_cart_rate');return {s:x.status,r:x.recommendations.length}})()");
    expect(e.s).toBe('red'); expect(e.r).toBeGreaterThanOrEqual(2);
    expect(await page.locator('[data-chain="joint.a3_to_add_cart_rate"]').count()).toBe(1);
    // 🔬入口自动出现在联合账新指标上
    expect(await page.locator('[data-dx="joint.a3_to_add_cart_rate"]').count()).toBeGreaterThan(0);
  });
  test('Consolidation:唯一TREE(扩展树与新条目同对象)', async ({ page }) => {
    await boot(page);
    expect(await page.evaluate("!!(ROOT_CAUSE_TREE['seed.exposure']&&ROOT_CAUSE_TREE['joint.a3_to_add_cart_rate']&&ROOT_CAUSE_TREE['seed.retain_3s'])")).toBeTruthy();
  });
});

test.describe('口径与非破坏', () => {
  test('无跨渠道词+基线翻转demo保留', async ({ page }) => {
    await boot(page);
    const b = await page.evaluate("document.body.innerHTML");
    for (const x of ['小红书','盒马','天猫','AIQL','AIPL']) expect(b).not.toContain(x);
    expect(await page.evaluate("typeof window.toggleLedger")).toBe('function');
  });
});
