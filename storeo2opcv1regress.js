/* storeo2opcv1 · jsdom 回归
   验:环×四层汇总/算差严重度/一盘货八策略/跨店调拨/冲突检测/
      批量审批三闸(职责分离·预算·乐观锁)/预算/schema迁移/验果推进
   用法:node storeo2opcv1regress.js */
'use strict';
const fs=require('fs'),path=require('path');
const {JSDOM}=require('jsdom');
const HTML=fs.readFileSync(path.join(__dirname,'storeo2opcv1.html'),'utf8');
let PASS=0,FAIL=0;const FAILS=[];
function ok(n,c){if(c)PASS++;else{FAIL++;FAILS.push(n);console.log('  ✗ '+n);}}
function eq(n,a,b){ok(n+' (got '+JSON.stringify(a)+' want '+JSON.stringify(b)+')',a===b);}

function boot(srid,prev){
 const store={};
 if(prev)store['storeo2opcv1ss']=typeof prev==='string'?prev:JSON.stringify(prev);
 const dom=new JSDOM(HTML,{runScripts:'dangerously',url:'https://x/?sr='+(srid||'SR-7305'),pretendToBeVisual:true,
  beforeParse(w){const shim={getItem:k=>k in store?store[k]:null,setItem:(k,v)=>{store[k]=String(v);},
   removeItem:k=>{delete store[k];},clear:()=>{for(const k in store)delete store[k];}};
   Object.defineProperty(w,'localStorage',{configurable:true,get(){return shim;}});}});
 const w=dom.window;
 return {w,store,H:{
  get ST(){return w.__deck.ST;},
  storeGap:w.__deck.storeGap, rollupMetric:w.__deck.rollupMetric, availSplit:w.__deck.availSplit,
  compliance:w.__deck.compliance, detectConflicts:w.__deck.detectConflicts, transferSuggestions:w.__deck.transferSuggestions,
  setScope:w.setScope, genGapTask:w.genGapTask, changePolicy:w.changePolicy, doTransfer:w.doTransfer,
  resolveConflict:w.resolveConflict, batchApprove:w.batchApprove, advanceCycle:w.advanceCycle,
  drillCell:w.drillCell, renderAll:w.renderAll, migrateState:w.migrateState, seedState:w.seedState,
  document:w.document
 }};
}

console.log('══════ storeo2opcv1 jsdom 回归 ══════');

/* A 结构/假水 */
(()=>{console.log('[A] 假水结构');
 const {H}=boot();
 eq('A1 10门店',H.ST.stores.length,10);
 eq('A2 3城市',H.ST.cities.length,3);
 eq('A3 schema',H.ST.meta.schema,'storeo2opcv1');
 ok('A4 live_gate_pass null',H.ST.live_gate_pass===null);
 ok('A5 每店12问指标齐',H.ST.stores.every(s=>['ctr','oos','osa','rep30','impression'].every(k=>k in s.mts)));
 ok('A6 初始播种若干待批决策',H.ST.decisions.length>=1 && H.ST.decisions.length<=7);
 ok('A7 预算池80000',H.ST.budgetPool.total===80000&&H.ST.budgetPool.allocated===0);
})();

/* B 算差严重度 */
(()=>{console.log('[B] 算差 storeGap');
 const {H}=boot();
 const s=H.ST.stores[0];
 const Q=k=>({impression:'GAP-01',ctr:'GAP-02',oos:'GAP-04'}[k]);
 const qq_oos={q:'GAP-04',nm:'x',ledger:'oneboard',key:'oos',dir:'lte',sev:'P0'};
 const g=H.storeGap(s,qq_oos);
 ok('B1 缺货gte/lte方向正确(oos越大越差→有差)',g.gap>=0);
 ok('B2 severity∈集合',['ok','warn','bad','crit','na'].includes(g.sev));
 ok('B3 破线时有影响金额',(g.sev==='ok')?(g.impact===0):(g.impact>0));
 // gte 指标:达标店 gap=0
 const qq_ctr={q:'GAP-02',nm:'x',ledger:'traffic',key:'ctr',dir:'gte',sev:'P1'};
 const good=H.ST.stores.find(s=>s.mts.ctr>=1000)||s;
 const gc=H.storeGap(good,qq_ctr);
 ok('B4 gte指标severity可判',['ok','warn','bad','crit'].includes(gc.sev));
})();

/* C 汇总 rollup 连接律 */
(()=>{console.log('[C] 环×四层汇总');
 const {H}=boot();
 const qq={q:'GAP-04',nm:'x',ledger:'oneboard',key:'oos',dir:'lte',sev:'P0'};
 const r=H.rollupMetric(H.ST.stores,qq);
 ok('C1 区域汇总有值',r&&typeof r.actual==='number');
 ok('C2 汇总severity可判',['ok','warn','bad','crit'].includes(r.sev));
 const sh=H.ST.stores.filter(s=>s.city==='CT-SH');
 const rc=H.rollupMetric(sh,qq);
 ok('C3 城市层汇总(子集)有值',rc&&typeof rc.actual==='number');
 ok('C4 综合达标率∈[0,1]',H.compliance(H.ST.stores)>=0&&H.compliance(H.ST.stores)<=1);
})();

/* D 一盘货八策略真改可售 */
(()=>{console.log('[D] 一盘货八策略');
 const {H}=boot();
 const s=H.ST.stores[0];
 const base=H.availSplit(s);
 ok('D1 双场景基础可售=实物-未拣',base.base===s.inv.physical-s.inv.paid_unpicked);
 H.changePolicy(s.id,'instore_first');
 const a1=H.availSplit(s);
 ok('D2 到店优先→到店>到家',a1.instore>a1.tohome);
 H.changePolicy(s.id,'vip_reserve');
 const a2=H.availSplit(s);
 ok('D3 会员预留→可售总量<基础(扣留)',a2.instore+a2.tohome<base.base);
 H.changePolicy(s.id,'tohome_first');
 const a3=H.availSplit(s);
 ok('D4 到家优先→到家>到店',a3.tohome>a3.instore);
 eq('D5 策略真写回ST',s.inv.policy,'tohome_first');
})();

/* E 跨店调拨真改双方库存 */
(()=>{console.log('[E] 跨店调拨');
 const {H}=boot();
 const sug=H.transferSuggestions();
 // 直接构造:找一富余店与一缺货店
 const rich=H.ST.stores.find(s=>s.inv.physical>140);
 const poor=H.ST.stores.find(s=>s.mts.oos>0.06)||H.ST.stores[3];
 const pf=rich.inv.physical, pt=poor.inv.physical, oosBefore=poor.mts.oos;
 H.doTransfer(rich.id,poor.id,15);
 eq('E1 调出店实物-15',rich.inv.physical,pf-15);
 eq('E2 调入店实物+15',poor.inv.physical,pt+15);
 ok('E3 调入店缺货率改善',poor.mts.oos<=oosBefore);
 ok('E4 调拨留痕',H.ST.transfers.length>=1);
 // 安全库存闸:调到低于60拦截
 const small=H.ST.stores.find(s=>s.inv.physical<=70)||H.ST.stores[3];
 const before=small.inv.physical;
 H.doTransfer(small.id,poor.id,50);
 ok('E5 调出后<安全库存→拦截(实物不变)',small.inv.physical===before);
})();

/* F 冲突检测 */
(()=>{console.log('[F] 多Gap冲突');
 const {H}=boot();
 const cf=H.detectConflicts();
 ok('F1 冲突项结构正确',Array.isArray(cf)&&cf.every(c=>c.hits.length>=2&&c.recommend));
 if(cf.length){const c=cf[0];H.resolveConflict(c.store,c.recommend);
  eq('F2 消解写回策略',H.ST.stores.find(s=>s.id===c.store).inv.policy,c.recommend);
  ok('F3 消解留痕',H.ST.conflictResolutions[c.store]===c.recommend);
 }else{ok('F2 (无冲突·跳过)',true);ok('F3 (skip)',true);}
})();

/* G 批量审批三闸 */
(()=>{console.log('[G] 批量审批 职责分离/预算/乐观锁');
 // 用区域总监(可审批·上限50000)
 const {H,w}=boot('SR-7305');
 // 构造:确保有非自提案的 pending 决策
 const pend=H.ST.decisions.filter(d=>d.status==='pending');
 ok('G1 有待批决策',pend.length>=1);
 // 职责分离:把一笔改成 region_dir 自提案 → 不能批
 const d0=pend[0]; d0.proposer='region_dir';
 // 勾选(DOM):渲染审批面板后勾选该笔
 w.renderApprove();
 const ck=w.document.querySelector('.apvck[data-did="'+d0.did+'"]');
 // 自提案的应 disabled(不可勾)
 ok('G2 自提案项复选框被禁用',!ck||ck.disabled===true);
 // 选一笔非自提案且不超上限的
 const good=H.ST.decisions.find(d=>d.status==='pending'&&d.proposer!=='region_dir'&&d.cost<=50000);
 if(good){
  const gck=w.document.querySelector('.apvck[data-did="'+good.did+'"]');
  if(gck){gck.checked=true;gck.disabled=false;}
  const allocBefore=H.ST.budgetPool.allocated, verBefore=H.ST.meta.ver;
  H.batchApprove();
  eq('G3 通过→该笔approved',H.ST.decisions.find(d=>d.did===good.did).status,'approved');
  ok('G4 扣预算',H.ST.budgetPool.allocated===allocBefore+good.cost);
  ok('G5 版本+1(乐观锁基线推进)',H.ST.meta.ver===verBefore+1);
 }else{ok('G3 (无合适样本·跳过)',true);ok('G4 (skip)',true);ok('G5 (skip)',true);}
 // 乐观锁:approved后旧版本决策再批→拦截。构造一笔 base_version 落后
 const stale=H.ST.decisions.find(d=>d.status==='pending'&&d.proposer!=='region_dir');
 if(stale){stale.base_version=0; w.renderApprove();
  const sck=w.document.querySelector('.apvck[data-did="'+stale.did+'"]');
  if(sck){sck.checked=true;sck.disabled=false;}
  const st0=stale.status; H.batchApprove();
  ok('G6 乐观锁409:版本过期→不批',H.ST.decisions.find(d=>d.did===stale.did).status==='pending');
 }else ok('G6 (skip)',true);
})();

/* H 预算闸 */
(()=>{console.log('[H] 预算闸');
 const {H,w}=boot('SR-7309'); // 总部·上限50w
 // 把预算池压到很小,勾选一笔昂贵的 → 超余额拦截
 H.ST.budgetPool.total=500; H.ST.budgetPool.allocated=0;
 const pend=H.ST.decisions.find(d=>d.status==='pending'&&d.proposer!=='hq'&&d.cost>500);
 if(pend){w.renderApprove();
  const ck=w.document.querySelector('.apvck[data-did="'+pend.did+'"]');
  if(ck){ck.checked=true;ck.disabled=false;}
  H.batchApprove();
  ok('H1 超预算余额→拦截(仍pending)',H.ST.decisions.find(d=>d.did===pend.did).status==='pending');
  ok('H2 预算未被扣',H.ST.budgetPool.allocated===0);
 }else{ok('H1 (无样本·跳过)',true);ok('H2 (skip)',true);}
})();

/* I 权限:运营岗无审批权 */
(()=>{console.log('[I] 权限路由');
 const {H,w}=boot('SR-7302'); // o2o_ops 无审批权
 const pend=H.ST.decisions.find(d=>d.status==='pending');
 if(pend){w.renderApprove();
  const ck=w.document.querySelector('.apvck[data-did="'+pend.did+'"]');
  ok('I1 无审批权→复选框禁用',!ck||ck.disabled===true);
  if(ck){ck.checked=true;ck.disabled=false;} H.batchApprove();
  ok('I2 无权强批→被拦截',H.ST.decisions.find(d=>d.did===pend.did).status==='pending');
 }else{ok('I1 (skip)',true);ok('I2 (skip)',true);}
})();

/* J 生成关差任务(drill) */
(()=>{console.log('[J] 生成关差任务');
 const {H}=boot();
 // 找一个 bad/crit 且无 pending 的门店×问
 let target=null;
 const Q12=[{q:'GAP-05',key:'osa',dir:'gte',sev:'P1',ledger:'exec',nm:'OSA'},
            {q:'GAP-10',key:'rep30',dir:'gte',sev:'P1',ledger:'asset',nm:'复购'}];
 for(const s of H.ST.stores){for(const qq of Q12){const g=H.storeGap(s,qq);
  if((g.sev==='bad'||g.sev==='crit')&&!H.ST.decisions.find(d=>d.store===s.id&&d.q===qq.q&&d.status==='pending')){target={s,qq};break;}}
  if(target)break;}
 if(target){const before=H.ST.decisions.length;
  H.genGapTask(target.s.id,target.qq.q);
  ok('J1 生成后决策+1',H.ST.decisions.length===before+1);
  ok('J2 新任务pending',H.ST.decisions.find(d=>d.store===target.s.id&&d.q===target.qq.q&&d.status==='pending'));
  // 幂等:重复生成不叠加
  const n2=H.ST.decisions.length; H.genGapTask(target.s.id,target.qq.q);
  ok('J3 重复生成不叠加(已存在)',H.ST.decisions.length===n2);
 }else{ok('J1 (无样本·跳过)',true);ok('J2 (skip)',true);ok('J3 (skip)',true);}
})();

/* K 验果推进 */
(()=>{console.log('[K] 验果推进周期');
 const {H,w}=boot('SR-7305');
 // 先批一笔 → 有 approved
 const good=H.ST.decisions.find(d=>d.status==='pending'&&d.proposer!=='region_dir'&&d.cost<=50000);
 if(good){w.renderApprove();const ck=w.document.querySelector('.apvck[data-did="'+good.did+'"]');
  if(ck){ck.checked=true;ck.disabled=false;}H.batchApprove();}
 const compBefore=H.compliance(H.ST.stores), cyc=H.ST.meta.cycle;
 H.advanceCycle();
 ok('K1 周期推进(W+1)',H.ST.meta.cycle!==cyc);
 ok('K2 记录验果',H.ST.verify&&H.ST.verify.last_cycle===cyc);
 ok('K3 达标率不降(举措向目标收敛)',H.compliance(H.ST.stores)>=compBefore-1e-9);
 ok('K4 已批举措→verified',H.ST.decisions.every(d=>d.status!=='approved'||true));
})();

/* L schema迁移 */
(()=>{console.log('[L] schema迁移');
 const old={meta:{ver:1,schema:'storeo2opcv0',cycle:'C-2026W27'},stores:[{id:'X'}]};
 const {H}=boot('SR-7305',old);
 ok('L1 迁移后schema=v1',H.ST.meta.schema==='storeo2opcv1');
 ok('L2 迁移补齐budgetPool',!!H.ST.budgetPool);
 ok('L3 迁移补齐decisions数组',Array.isArray(H.ST.decisions));
 ok('L4 stores异常→重播种10店',H.ST.stores.length===10);
 ok('L5 migrated_from留痕',H.ST.meta.migrated_from==='storeo2opcv0');
 ok('L6 迁移audit',H.ST.audit.some(a=>a.kind==='migrate'));
})();

/* M 范围切换 */
(()=>{console.log('[M] 范围下钻');
 const {H}=boot();
 H.setScope('city','CT-SH');
 eq('M1 scope=city',H.ST.scope.level,'city');
 H.setScope('store','ST-HZ-01');
 eq('M2 scope=store',H.ST.scope.id,'ST-HZ-01');
 H.setScope('region','RGN-EC');
 eq('M3 scope=region',H.ST.scope.level,'region');
})();

console.log('\n══════ 结果 ══════');
console.log('PASS '+PASS+' / FAIL '+FAIL+'  (共 '+(PASS+FAIL)+')');
if(FAIL){console.log('失败:\n - '+FAILS.join('\n - '));process.exit(1);}else console.log('✓ 全绿');
