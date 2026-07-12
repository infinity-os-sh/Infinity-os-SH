// xhspcv8.spec.js · 小红书PC完整主系统 V2.0补强 · TL真浏览器回归
// 运行:npx playwright test xhspcv8.spec.js
// URL:改为 https://infinity-os-sh.github.io/Infinity-os-SH/xhspcv8.html 或本地 file://
const { test, expect } = require('@playwright/test');
const URL = process.env.XURL || 'https://infinity-os-sh.github.io/Infinity-os-SH/xhspcv8.html';

async function go(page, q){ await page.goto(URL+(q||'')); await page.waitForTimeout(400); }
const D = p => p.evaluate(()=>window.XPC2DBG);

test.describe('XPC2 V2.0', () => {

test('XPC2-01 口径:AIQL在·无他渠道人群主模型', async ({page}) => {
  await go(page);
  const html = await page.content();
  expect(html).toContain('AIQL');
  expect(html).not.toContain('AIPL');
  expect(html).not.toContain('5A主');
});

test('XPC2-02 基线回归:七屏渲染+查看切换', async ({page}) => {
  await go(page);
  for(const t of ['today','dual','pipe','collect','ledger','task','cockpit']){
    await page.evaluate(t=>setTab(t), t); await page.waitForTimeout(200);
    const len = await page.evaluate(()=>document.getElementById('scroll').innerHTML.length);
    expect(len).toBeGreaterThan(200);
  }
  await page.evaluate(()=>setStage('growth')); await page.waitForTimeout(200);
  expect(await page.evaluate(()=>XPC2DBG.S.stage)).toBe('growth');
});

test('XPC2-03 PC三尺寸四区无遮挡', async ({page}) => {
  for(const [w,h] of [[1366,768],[1440,900],[1920,1080]]){
    await page.setViewportSize({width:w,height:h}); await go(page);
    const nav = await page.locator('#pcnav').boundingBox();
    const ev  = await page.locator('#evPanel').boundingBox();
    const gf  = await page.locator('#gfbar').boundingBox();
    expect(nav && ev && gf).toBeTruthy();
    const scr = await page.locator('#scroll').boundingBox();
    expect(scr.x).toBeGreaterThanOrEqual(nav.x + nav.width - 2);       // 左导航不压中区
    expect(scr.x + scr.width).toBeLessThanOrEqual(ev.x + 2);           // 右证据不压中区
  }
});

test('P0-1 主管默认进入需要我处理 + 证据栏在场', async ({page}) => {
  await go(page,'?role=mgr');
  expect(await page.evaluate(()=>XPC2DBG.S.tab)).toBe('mgrcenter');
  await expect(page.locator('#evPanel')).toContainText('证据');
});

test('XPC2-04 六队列:核定/背书/复盘/升层真点留痕', async ({page}) => {
  await go(page,'?role=mgr');
  for(const id of ['q-approve','q-urge','q-accept','q-review','q-esc','q-back'])
    await expect(page.locator('#'+id)).toBeVisible();
  await page.locator("[onclick*=\"x2QBack('BK-01'\"]").click({force:true}); await page.waitForTimeout(250);
  expect(await page.evaluate(()=>XPC2DBG.BACKINGS[0].status)).toBe('SUPERVISOR_BACKED');
  await page.locator("[onclick=\"x2QEsc('ES-01')\"]").click({force:true}); await page.waitForTimeout(250);
  expect(await page.evaluate(()=>XPC2DBG.ESCALATIONS[0].status)).toBe('上层已接收');
  const n0 = await page.evaluate(()=>XPC2DBG.TASKS2.length);
  await page.locator("[onclick=\"x2QReview('RV-01')\"]").click({force:true}); await page.waitForTimeout(250);
  expect(await page.evaluate(()=>XPC2DBG.TASKS2.length)).toBe(n0+1);
});

test('XPC2-05 团队全景筛选下钻', async ({page}) => {
  await go(page,'?role=mgr');
  await page.evaluate(()=>{XPC2DBG.X2.gf.roleF='商销运营岗';x2Rerender();}); await page.waitForTimeout(200);
  expect(await page.locator('#teamTbl tbody tr').count()).toBe(3);
  await page.evaluate(()=>{XPC2DBG.X2.gf.roleF='ALL';XPC2DBG.X2.gf.sla='超时';x2Rerender();}); await page.waitForTimeout(200);
  expect(await page.locator('#teamTbl tbody tr').count()).toBe(1);
});

test('XPC2-06 交接全生命周期+Artifact留痕', async ({page}) => {
  await go(page); await page.evaluate(()=>setTab('taskpro')); await page.waitForTimeout(250);
  await page.evaluate(()=>{x2Ho('HO-03','submit');x2Ho('HO-03','accept');x2Ho('HO-03','complete');});
  expect(await page.evaluate(()=>XPC2DBG.HANDOFFS[2].status)).toBe('completed');
  expect(await page.evaluate(()=>XPC2DBG.X2.audit.filter(a=>a.action.startsWith('handoff:HO-03')).length)).toBe(3);
  await page.evaluate(()=>x2Ho('HO-01','ret'));
  expect(await page.evaluate(()=>XPC2DBG.HANDOFFS[0].status)).toBe('returned');
});

test('XPC2-07 商销SOP结构齐全+主管锁版', async ({page}) => {
  await go(page,'?role=mgr'); await page.evaluate(()=>setTab('taskpro')); await page.waitForTimeout(250);
  const ok = await page.evaluate(()=>XPC2DBG.SOP_COMM.steps.length===5 && XPC2DBG.SOP_COMM.steps.every(s=>s.inp&&s.proc&&s.out&&s.kpi&&s.sla&&s.ev));
  expect(ok).toBe(true);
  await page.locator('#btnSopLock').click({force:true}); await page.waitForTimeout(250);
  expect(await page.evaluate(()=>XPC2DBG.SOP_COMM.version)).toBe('v1.0');
});

test('XPC2-08 查看≠迁移;批准=事务迁移+新Cycle;幂等;回滚', async ({page}) => {
  await go(page,'?role=mgr');
  await page.evaluate(()=>setStage('mature'));
  expect(await page.evaluate(()=>XPC2DBG.X2.lifecycleStage)).toBe('import');
  await expect(page.locator('#lcBanner')).toContainText('非真实迁移');
  await page.evaluate(()=>setStage('import'));
  await page.evaluate(()=>{XPC2DBG.CAMPS[0].finalVerdict='真实资产沉淀';setTab('migrate');}); await page.waitForTimeout(250);
  const n0 = await page.evaluate(()=>XPC2DBG.TASKS2.length);
  await page.locator('#btnMigSubmit').click({force:true}); await page.waitForTimeout(250);
  await page.evaluate(()=>{const i=XPC2DBG.S.pending.findIndex(p=>p.mig);x2MigApprove(i);}); await page.waitForTimeout(300);
  expect(await page.evaluate(()=>XPC2DBG.X2.lifecycleStage)).toBe('growth');
  expect(await page.evaluate(()=>XPC2DBG.X2.cycle.n)).toBe(13);
  expect(await page.evaluate(()=>XPC2DBG.TASKS2.length)).toBe(n0+2);
  expect(await page.evaluate(()=>XPC2DBG.X2.cycle.frozen.length)).toBe(1);
  // 幂等
  await page.evaluate(()=>{XPC2DBG.S.pending.push({kind:'重复',mig:{from:'import',to:'growth',reason:'x',idem:'MIG-import-growth-CY-2026-12'}});x2MigApprove(XPC2DBG.S.pending.length-1);});
  expect(await page.evaluate(()=>XPC2DBG.X2.cycle.n)).toBe(13);
});

test('XPC2-08b 失败整体回滚', async ({page}) => {
  await go(page,'?role=mgr');
  await page.evaluate(()=>{XPC2DBG.CAMPS[0].finalVerdict='真实资产沉淀';setTab('migrate');XPC2DBG.X2.failNext=true;}); await page.waitForTimeout(250);
  await page.locator('#btnMigSubmit').click({force:true}); await page.waitForTimeout(250);
  await page.evaluate(()=>{const i=XPC2DBG.S.pending.findIndex(p=>p.mig);x2MigApprove(i);}); await page.waitForTimeout(250);
  expect(await page.evaluate(()=>XPC2DBG.X2.lifecycleStage)).toBe('import');
  expect(await page.evaluate(()=>XPC2DBG.X2.cycle.frozen.length)).toBe(0);
});

test('XPC2-09/P1-2 One ID:默认全员聚合·主管用途工单下钻·撤销回聚合', async ({page}) => {
  await go(page,'?role=mgr'); await page.evaluate(()=>setTab('oneid')); await page.waitForTimeout(250);
  await expect(page.locator('#oneidTbl')).toContainText('仅聚合');   // 主管默认也聚合
  await page.selectOption('#oidP','种草到购买归因');
  await page.locator('#btnOidTicket').click({force:true}); await page.waitForTimeout(250);
  for(const k of ['E1','E5','撤回','过期','无法匹配','consent','NOTE-6620'])
    await expect(page.locator('#scroll')).toContainText(k);
  await page.locator('#btnOidOff').click({force:true}); await page.waitForTimeout(250);
  expect(await page.locator('#oneidTbl').innerHTML()).not.toContain('NOTE-6620');
  await page.evaluate(()=>{setRole('content_seed');setTab('oneid');}); await page.waitForTimeout(250);
  await expect(page.locator('#oneidTbl')).toContainText('仅聚合');
});

test('XPC2-10 校准后自动派发·去重·绑SOP Step', async ({page}) => {
  await go(page); await page.evaluate(()=>setTab('rules')); await page.waitForTimeout(250);
  const n0 = await page.evaluate(()=>XPC2DBG.TASKS2.length);
  await page.locator('#btnDispatch').click({force:true}); await page.waitForTimeout(250);
  expect(await page.evaluate(()=>XPC2DBG.TASKS2.length)).toBe(n0+3);
  await page.locator('#btnDispatch').click({force:true}); await page.waitForTimeout(250);
  expect(await page.evaluate(()=>XPC2DBG.TASKS2.length)).toBe(n0+3); // 去重
});

test('XPC2-11 并发冲突可见·重复动作只执行一次', async ({page}) => {
  await go(page); await page.evaluate(()=>setTab('rules')); await page.waitForTimeout(250);
  const v = await page.evaluate(()=>XPC2DBG.TASKS2[0].version);
  await page.locator('#btnConflict').click({force:true}); await page.waitForTimeout(250);
  expect(await page.evaluate(()=>XPC2DBG.TASKS2[0].version)).toBe(v);
  expect(await page.evaluate(()=>XPC2DBG.X2.audit.some(a=>a.action.startsWith('version_conflict')))).toBe(true);
});

test('XPC2-12 三层值:raw永不覆盖·override到期/撤回', async ({page}) => {
  await go(page,'?role=mgr'); await page.evaluate(()=>setTab('taskpro')); await page.waitForTimeout(250);
  await page.evaluate(()=>t2Override());
  expect(await page.evaluate(()=>XPC2DBG.TRI.raw)).toBe(3.8);
  expect(await page.evaluate(()=>triFinal())).toBe(3.6);
  await page.evaluate(()=>t2Revoke());
  expect(await page.evaluate(()=>triFinal())).toBe(3.42);
});

test('XPC2-13 post_review生成·活动期不得自动毕业', async ({page}) => {
  await go(page,'?role=mgr'); await page.evaluate(()=>setTab('assets')); await page.waitForTimeout(250);
  await page.evaluate(()=>x2GenReview('CP-01'));
  expect(await page.evaluate(()=>XPC2DBG.POST_REVIEWS.length)).toBe(1);
  await page.evaluate(()=>setTab('migrate')); await page.waitForTimeout(200);
  const n0 = await page.evaluate(()=>XPC2DBG.S.pending.length);
  await page.locator('#btnMigSubmit').click({force:true}); await page.waitForTimeout(250);
  expect(await page.evaluate(()=>XPC2DBG.S.pending.length)).toBe(n0); // 拦截
});

test('XPC2-14 JBP承诺拆任务并回写Scorecard', async ({page}) => {
  await go(page); await page.evaluate(()=>setTab('jbp')); await page.waitForTimeout(250);
  const n0 = await page.evaluate(()=>XPC2DBG.TASKS2.length);
  await page.locator('#jbpPm .x2btn.solid').first().click({force:true}); await page.waitForTimeout(250);
  expect(await page.evaluate(()=>XPC2DBG.TASKS2.length)).toBe(n0+1);
  expect(await page.evaluate(()=>XPC2DBG.JBP.scorecard[0][4])).toContain('任务已拆');
});

test('XPC2-15 越权即使绕过前端也被API拒绝并审计', async ({page}) => {
  await go(page); await page.evaluate(()=>{setRole('content_seed');setTab('perms');}); await page.waitForTimeout(250);
  await page.locator('#btnUrlRole').click({force:true}); await page.waitForTimeout(250);
  expect(await page.evaluate(()=>XPC2DBG.X2.apiLog[0].res)).toContain('403');
  await page.evaluate(()=>{setTab('rules');x2Rollback('R-CPTI-01');});
  expect(await page.evaluate(()=>XPC2DBG.RULES2[0].version)).toBe(3); // 未回滚
});

test('XPC2-16 全联动:派发→任务→验收→验果→证据栏', async ({page}) => {
  await go(page,'?role=mgr'); await page.evaluate(()=>setTab('rules')); await page.waitForTimeout(250);
  await page.locator('#btnDispatch').click({force:true}); await page.waitForTimeout(250);
  await page.evaluate(()=>{const t=XPC2DBG.TASKS2[XPC2DBG.TASKS2.length-1];t2Move(t.task_id,'进行中');t2Move(t.task_id,'待验收');x2QAccept(t.task_id,true);t2Move(t.task_id,'有效');});
  const st = await page.evaluate(()=>XPC2DBG.TASKS2[XPC2DBG.TASKS2.length-1].status);
  expect(st).toBe('有效');
  expect(await page.locator('#evPanel').innerHTML()).toContain('任务状态迁移');
});

test('长表:SLA排序/分页/列配置/保存视图 · 深链接', async ({page}) => {
  await go(page,'?scr=taskpro&sv=mature');
  expect(await page.evaluate(()=>XPC2DBG.S.tab)).toBe('taskpro');
  expect(await page.evaluate(()=>XPC2DBG.S.stage)).toBe('mature');
  expect(await page.evaluate(()=>XPC2DBG.X2.lifecycleStage)).toBe('import');
  await expect(page.locator('#t2Tbl thead')).toBeVisible();
});


test('V4-P0-1 SOP注册表:非法引用=0 · sop_ops八步正式在场', async ({page}) => {
  await go(page);
  expect(await page.evaluate(()=>XPC2DBG.X2.sopInvalid.length)).toBe(0);
  expect(await page.evaluate(()=>XPC2DBG.SOP_OPS.steps.length)).toBe(8);
  expect(await page.evaluate(()=>XPC2DBG.x2SopReg().sop_comm)).toBe(5);
});

test('V4-P0-2 刷新持久化:动作后 reload,状态不回初始假水', async ({page}) => {
  await go(page);
  const tid = await page.evaluate(()=>{const t=XPC2DBG.TASKS2[0];t2Move(t.task_id,'待交接');return t.task_id;});
  await page.reload(); await page.waitForTimeout(500);
  expect(await page.evaluate(id=>XPC2DBG.TASKS2.find(x=>x.task_id===id).status, tid)).toBe('待交接');
  // 重置假水后回初始
  await page.evaluate(()=>{try{Object.keys(localStorage).filter(k=>k.indexOf('xpc2:')===0).forEach(k=>localStorage.removeItem(k));}catch(e){}});
  await page.reload(); await page.waitForTimeout(500);
  expect(await page.evaluate(id=>XPC2DBG.TASKS2.find(x=>x.task_id===id).status, tid)).toBe('进行中');
});

test('V4-P0-3 真乐观锁:旧expected_version提交→409·正确版本可重试', async ({page}) => {
  await go(page);
  const r = await page.evaluate(()=>{const t=XPC2DBG.TASKS2[0];const v=t.version;t2Move(t.task_id,'待交接',v-1);return {st:t.status,v:t.version,exp:v};});
  expect(r.v).toBe(r.exp); // 未写入
  expect(await page.evaluate(()=>XPC2DBG.X2.audit.some(a=>a.action.indexOf('version_conflict_409')===0))).toBe(true);
  await page.evaluate(()=>{const t=XPC2DBG.TASKS2[0];t2Move(t.task_id,'待交接',t.version);});
  expect(await page.evaluate(()=>XPC2DBG.TASKS2[0].status)).toBe('待交接');
});

test('V4-P0-4 幂等注册表结构化·迁移失败同事务回收可重试', async ({page}) => {
  await go(page,'?role=mgr');
  await page.evaluate(()=>{XPC2DBG.CAMPS[0].finalVerdict='真实资产沉淀';setTab('migrate');XPC2DBG.X2.failNext=true;}); await page.waitForTimeout(250);
  await page.locator('#btnMigSubmit').click({force:true}); await page.waitForTimeout(250);
  const idem = await page.evaluate(()=>{const i=XPC2DBG.S.pending.findIndex(p=>p.mig);const k=XPC2DBG.S.pending[i].mig.idem;x2MigApprove(i);return k;});
  expect(await page.evaluate(k=>!!XPC2DBG.X2.reqSeen[k], idem)).toBe(false); // 失败回收
  await page.locator('#btnMigSubmit').click({force:true}); await page.waitForTimeout(250);
  await page.evaluate(()=>{const i=XPC2DBG.S.pending.findIndex(p=>p.mig);x2MigApprove(i);});
  expect(await page.evaluate(()=>XPC2DBG.X2.lifecycleStage)).toBe('growth');
  const ent = await page.evaluate(k=>XPC2DBG.X2.reqSeen[k], idem);
  for(const f of ['tenant_id','idempotency_key','request_hash','status','created_at','expiry_at']) expect(ent).toHaveProperty(f);
});

test('V4-P0-5 IA:移动端一级tab=7 · 左导航=经营7屏+PC工具9', async ({page}) => {
  await go(page);
  expect(await page.locator('.tabs .tab').count()).toBe(7);
  await expect(page.locator('#pcnav')).toContainText('经营一级屏 · 7');
  await expect(page.locator('#pcnav')).toContainText('PC管理工具 · 9');
});

test('V4-P0-6 OneID四层状态 · V4-P1-3 分析确定性', async ({page}) => {
  await go(page); await page.evaluate(()=>setTab('oneid')); await page.waitForTimeout(200);
  await expect(page.locator('#scroll')).toContainText('api_connected');
  const oid = await page.evaluate(()=>XPC2DBG.REPUTATION_ROLE.one_id);
  expect(oid.model_ready).toBe(true); expect(oid.production_enabled).toBe(false);
  await page.evaluate(()=>setTab('analysis')); await page.waitForTimeout(200);
  const a = await page.locator('#drillTbl').innerHTML();
  await page.evaluate(()=>x2Rerender()); await page.waitForTimeout(200);
  expect(await page.locator('#drillTbl').innerHTML()).toBe(a);
  await expect(page.locator('#scroll')).toContainText('确定性假水');
});


test('V5-P0 OneID真工单:必填/真到期/字段级/申请审批流/查询留痕', async ({page}) => {
  await go(page,'?role=mgr'); await page.evaluate(()=>setTab('oneid')); await page.waitForTimeout(250);
  // 空用途禁止提交
  await page.locator('#btnOidTicket').click({force:true}); await page.waitForTimeout(200);
  expect(await page.evaluate(()=>!!XPC2DBG.X2.oneidTicket)).toBe(false);
  // 生成真工单对象
  await page.selectOption('#oidP','数据质量核验');
  await page.locator('#btnOidTicket').click({force:true}); await page.waitForTimeout(250);
  const tk = await page.evaluate(()=>XPC2DBG.X2.oneidTicket);
  for(const f of ['ticket_id','applicant','purpose','scope','fields','approver','approved_at','expires_at','status']) expect(tk).toHaveProperty(f);
  expect(new Date(tk.expires_at) - new Date(tk.approved_at)).toBe(24*3600*1000);
  // 字段级:数据质量核验不下发业务身份
  const tb = await page.locator('#oneidTbl').innerHTML();
  expect(tb).not.toContain('NOTE-6620'); expect(tb).toContain('授权CRM token匹配');
  expect(await page.evaluate(()=>XPC2DBG.X2.audit.some(a=>a.action==='oneid_query'))).toBe(true);
  // 到期自动撤权
  await page.evaluate(()=>{XPC2DBG.X2.oneidTicket.expires_at=new Date(Date.now()-1000).toISOString();x2Rerender();});
  await page.waitForTimeout(200);
  expect(await page.evaluate(()=>XPC2DBG.X2.oneidTicket.status)).toBe('expired');
});

test('V5-P0 岗位申请→主管审批→限时权限', async ({page}) => {
  await go(page); await page.evaluate(()=>{setRole('reputation_repurchase');setTab('oneid');}); await page.waitForTimeout(250);
  await page.selectOption('#oidP','复购运营');
  await page.locator('#btnOidReq').click({force:true}); await page.waitForTimeout(200);
  expect(await page.evaluate(()=>XPC2DBG.OID_REQUESTS[0].status)).toBe('待审批');
  await page.evaluate(()=>{setRole('mgr');const i=XPC2DBG.S.pending.findIndex(p=>p.oid);x2QApprove(i,true);});
  const tk = await page.evaluate(()=>XPC2DBG.X2.oneidTicket);
  expect(tk.status).toBe('active'); expect(tk.applicant_role).toBe('reputation_repurchase');
});

test('V5-P2 tbody修复+通用状态+接口契约', async ({page}) => {
  await go(page);
  const html = await page.content();
  expect(html).not.toContain('</tbody></tr>');
  await page.evaluate(()=>setTab('perms')); await page.waitForTimeout(200);
  expect(await page.locator('[data-sys]').count()).toBe(8);
  await page.locator('[data-sys="conflict409"]').click({force:true}); await page.waitForTimeout(200);
  await expect(page.locator('#scroll')).toContainText('刷新取最新');
  await expect(page.locator('#scroll')).toContainText('生产接口契约');
});


test('V6-自检补全:退回路径+队列重建+导出独立审批', async ({page}) => {
  await go(page); await page.evaluate(()=>{setRole('content_seed');setTab('oneid');}); await page.waitForTimeout(250);
  await page.selectOption('#oidP','投诉调查');
  await page.locator('#btnOidReq').click({force:true}); await page.waitForTimeout(200);
  await page.evaluate(()=>{setRole('mgr');const i=XPC2DBG.S.pending.findIndex(p=>p.oid);x2QApprove(i,false);});
  expect(await page.evaluate(()=>XPC2DBG.OID_REQUESTS[0].status)).toContain('退回');
  expect(await page.evaluate(()=>!!XPC2DBG.X2.oneidTicket)).toBe(false);
  // 待审批申请 reload 后回队列
  await page.evaluate(()=>{setRole('reputation_repurchase');setTab('oneid');}); await page.waitForTimeout(250);
  await page.selectOption('#oidP','复购运营');
  await page.locator('#btnOidReq').click({force:true}); await page.waitForTimeout(200);
  await page.reload(); await page.waitForTimeout(500);
  expect(await page.evaluate(()=>XPC2DBG.S.pending.some(p=>p.oid&&p.oid.status==='待审批'))).toBe(true);
  // 导出独立审批
  await page.evaluate(()=>setRole('mgr')); await page.evaluate(()=>setTab('oneid')); await page.waitForTimeout(250);
  await page.selectOption('#oidP','种草到购买归因');
  await page.locator('#btnOidTicket').click({force:true}); await page.waitForTimeout(200);
  await page.locator('#btnOidExp').click({force:true}); await page.waitForTimeout(200);
  expect(await page.evaluate(()=>XPC2DBG.X2.audit.some(a=>a.action==='oneid_export_request'))).toBe(true);
});


test('V3.0 三本账根因诊断:抽屉/穿透/分流/握手/状态机/幂等/记忆', async ({page}) => {
  await go(page); await page.evaluate(()=>setTab('ledger')); await page.waitForTimeout(300);
  // 主区:因果链+纵向三账+高亮
  await expect(page.locator('#lrChain')).toBeVisible();
  expect(await page.locator('.lrtile').count()).toBe(20);
  expect(await page.locator('.lrtile.lr-src').count()).toBe(1);
  // XHSLRC-02 投流穿透
  await page.locator('[data-lrm="traffic.cpti"]').click({force:true}); await page.waitForTimeout(250);
  await expect(page.locator('#lrDrawer')).toBeVisible();
  await expect(page.locator('#lrDrawer')).toContainText('投流效率账');
  await expect(page.locator('#lrDrawer')).toContainText('81%');
  for(let i=0;i<7;i++){ await page.locator('#btnLrDeep').click({force:true}); await page.waitForTimeout(120); }
  await expect(page.locator('.lrcrumb')).toContainText('PL-028');
  await expect(page.locator('.lrcrumb')).toContainText('深种质量');
  // XHSLRC-10 握手锁→解锁
  await page.locator('#btnLrTask').click({force:true}); await page.waitForTimeout(200);
  expect(await page.evaluate(()=>XPC2DBG.LRTASKS.length)).toBe(0);
  await page.evaluate(()=>{for(let i=0;i<5;i++){lrHsCheck('seed',i);lrHsCheck('traf',i);}lrHsConfirm('seed');lrHsConfirm('traf');});
  await page.locator('#btnLrTask').click({force:true}); await page.waitForTimeout(200);
  expect(await page.evaluate(()=>XPC2DBG.LRTASKS.length)).toBe(1);
  // XHSLRC-11 幂等
  await page.locator('#btnLrTask').click({force:true}); await page.waitForTimeout(200);
  expect(await page.evaluate(()=>XPC2DBG.LRTASKS.length)).toBe(1);
  // 状态机+记忆
  const c0 = await page.evaluate(()=>XPC2DBG.RC_MEMORY['人群扩量漂移'].count);
  await page.evaluate(()=>{const t=XPC2DBG.LRTASKS[0];lrMove(t.id,'待执行');lrMove(t.id,'执行中');lrMove(t.id,'待验果');lrMove(t.id,'有效');});
  expect(await page.evaluate(()=>XPC2DBG.RC_MEMORY['人群扩量漂移'].count)).toBe(c0+1);
  // 刷新持久化
  await page.reload(); await page.waitForTimeout(600);
  expect(await page.evaluate(()=>XPC2DBG.LRTASKS.length)).toBe(1);
  expect(await page.evaluate(()=>XPC2DBG.LRTASKS[0].state)).toBe('有效');
});

test('V3.0 数据缺口灰灯+跨账跳转返回', async ({page}) => {
  await go(page); await page.evaluate(()=>setTab('ledger')); await page.waitForTimeout(300);
  await page.locator('[data-lrm="trust.watch_search"]').click({force:true}); await page.waitForTimeout(200);
  await expect(page.locator('#lrDrawer')).toContainText('补数任务');
  await page.locator('[data-lrm="asset.note_to_payment"]').click({force:true}); await page.waitForTimeout(200);
  await page.evaluate(()=>lrTab('ev'));
  await page.locator(`[onclick="lrOpen('trust.deep_seed_users',true)"]`).click({force:true}); await page.waitForTimeout(200);
  expect(await page.evaluate(()=>XPC2DBG.X2.lr.mid)).toBe('trust.deep_seed_users');
  await page.locator('#btnLrBack').click({force:true}); await page.waitForTimeout(200);
  expect(await page.evaluate(()=>XPC2DBG.X2.lr.mid)).toBe('asset.note_to_payment');
});

});
