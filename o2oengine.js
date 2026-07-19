/* ══════════════════════════════════════════════════════════════════
   INFINITY OS · 渠道引擎母版 参考实现 · o2o · v2 双环交汇
   三层合并 + 双环模型:
     冻结层(V843)  不可变 reduce · commandFingerprint 幂等 · 审计 hash 链 · Registry
     运行层(v8.2)  环五步 · actualOf 现算 · actual 恒 null
     动机层(o2ov1) 战功/收入皮 · no_data 诚实
   双环交汇(本次):一家店 = 两条定标↓的交汇点
     · 盒马环:盒马定标↓ → 店长owns → 盒马发薪(店长KPI记分卡)= 客户价值
     · SH环  :SH城市切出 → SR owns → SH发薪(SR城市战功)     = 我方价值
     · 两环读同一份 facts(店的共享经营现实)· 两端都落同一消费者 · 非零和
   JBP桥(GCD/LCM):关差瞄最大公约数(共同因子动作)·定标瞄最小公倍数(最小共同目标盘)
     · GCD≈1 或 LCM≈两目标相乘 = 假双赢报警
   换渠道 = 只换 CHANNEL_FILL 块。
   ══════════════════════════════════════════════════════════════════ */
(function(root){
'use strict';

/* ────────── 冻结层:引擎件(带走·跨渠道字节一致) ────────── */
const CORE_VERSION = 'o2oref-engine-2.0.0-dualloop';

function deepFreeze(o){
  if(o && typeof o==='object' && !Object.isFrozen(o)){ Object.freeze(o); Object.keys(o).forEach(function(k){deepFreeze(o[k]);}); }
  return o;
}
function clone(o){ return JSON.parse(JSON.stringify(o)); }
function digest(str){ let h=0; for(let i=0;i<str.length;i++){ h=(h*31 + str.charCodeAt(i))|0; } return (h>>>0).toString(16).padStart(8,'0'); }
function commandFingerprint(cmd){ return 'CMD-'+digest(JSON.stringify(cmd)); }
function hashChain(prevHash, entry){ return digest((prevHash||'0') + JSON.stringify(entry)); }

/* 环:实际恒由量实↑现算(宪法:定标↓绝不倒推·gap.actual 恒 null)
   双环下 actualOf 读"店的共享 facts"——这是两环交汇的物理基础 */
function factOf(state, key){ const f=state.facts[key]; return (f==null)?null:f; }
function actualOf(gap, state){
  if(gap.actual != null) return gap.actual;              // 极少:显式写入优先
  const base = factOf(state, gap.actual_key);
  if(base == null) return null;                          // no_data — 不假装(o2ov1 诚实)
  let v;
  if(gap.formula === 'shortage') v = Math.max(0, 0.20*(1-base));           // 缺货率 = f(库存深度)·越满越低
  else if(gap.co_fact){                                                     // 复合:主事实 + 协同事实
    const co = factOf(state, gap.co_fact); if(co==null) return null;
    v = gap.w_base*base + gap.w_co*co;
  } else v = base;
  return +v.toFixed(4);
}
function gapMet(gap, state){
  const a = actualOf(gap, state);
  if(a==null) return null;
  return gap.standard.dir==='gte' ? a>=gap.standard.v : a<=gap.standard.v;
}

/* 收入(母版引擎件①·四段:底薪+功勋+Gate毕业奖+效率提成)· 结构冻结
   ★双环:同一四段结构算两次——发给谁由"角色定义(填充层)"决定,不是引擎决定 */
/* 收入守红线R2:关差DONE 已需证据齐(证据门),Gate毕业奖挂 verify.effective(标动才给·非任务做没做)·故不可验证自评无法直接换钱 */
function calcLoopIncome(loop, state){
  let merit=0, gate=0;
  for(const id in loop.gaps){
    const g=loop.gaps[id]; const met=gapMet(g,state);
    if(met===null) continue;                                 // no_data 不计功
    const a=actualOf(g,state), std=g.standard.v;
    const ratio = g.standard.dir==='gte' ? Math.min(1,a/std) : Math.min(1, std/Math.max(a,0.0001));
    merit += g.merit_weight * ratio;
    if(g.verify.status==='VERIFIED' && g.verify.effective) gate += g.merit_weight*0.5;
  }
  const ecr = merit*0.1;
  return { base:loop.income_base, merit:+merit.toFixed(2), gate_bonus:+gate.toFixed(2),
           ecr_commission:+ecr.toFixed(2), total:+(loop.income_base+merit+gate+ecr).toFixed(2),
           paid_by:loop.paid_by, owner:loop.owner };
}

/* JBP 桥:最大公约数(共同因子动作) + 最小公倍数(最小共同目标盘) + 假双赢探测
   这是给 SR 谈 JBP 的一把尺,不是自动算数节点(潜力/客群是软信息) */
function jbpIntersection(state){
  const SHARED = 'inventory_depth';                          // 两环交汇的共享事实
  const h = state.loops.hema, s = state.loops.sh;
  // 每环对共享事实的"需求水位"= 该环里读此事实的 gap 达标所需的最低 depth
  function reqOf(loop){
    let need=0;
    for(const id in loop.gaps){ const g=loop.gaps[id];
      if(g.actual_key!==SHARED && g.co_fact!==SHARED) continue;
      let r;
      if(g.formula==='shortage') r = 1 - g.standard.v/0.20;                          // 缺货≤std → depth≥
      else if(g.co_fact===SHARED){ const co=factOf(state,g.actual_key)||0; r=(g.standard.v-g.w_co*co)/g.w_base; }
      else if(g.actual_key===SHARED){ const co=g.co_fact?factOf(state,g.co_fact)||0:0; r=(g.standard.v-(g.w_co||0)*co)/(g.w_base||1); }
      else r=g.standard.v;
      need=Math.max(need, r);
    }
    return +Math.min(1,Math.max(0,need)).toFixed(3);
  }
  const hemaReq=reqOf(h), shReq=reqOf(s);
  const lcm = +Math.max(hemaReq, shReq).toFixed(3);           // 最小公倍数:同时覆盖两环的最小共同目标
  // 最大公约数:能同时喂两环的关差动作(fact_delta 触及共享事实)
  const gcdActions=[];
  [h,s].forEach(function(loop){ for(const id in loop.gaps){ (loop.gaps[id].close_menu||[]).forEach(function(m){
    if(m.gcd && m.fact_delta && m.fact_delta[SHARED]) gcdActions.push({loop:loop.loop_id, gap:id, action:m.action, delta:m.fact_delta[SHARED]});
  });}});
  const gcdStrength = gcdActions.length ? +Math.max.apply(null, gcdActions.map(function(a){return a.delta;})).toFixed(3) : 0;
  const divergence = +Math.abs(hemaReq-shReq).toFixed(3);
  // 假双赢:无共同因子动作(GCD≈0/1) 或 两环需求水位相距过大(近似互质)
  const fake = gcdStrength < 0.05 || divergence > 0.20;
  return { shared:SHARED, current:factOf(state,SHARED), hema_req:hemaReq, sh_req:shReq,
           lcm:lcm, gcd_actions:gcdActions, gcd_strength:gcdStrength, divergence:divergence,
           fake_winwin:fake, verdict: fake?'⚠假双赢(硬凑·该报警)':'✓真双赢(非零和·同源消费者)' };
}

/* 环五步 = 不可变命令。reduce 纯函数:旧态→新态(深冻结) · 关差改共享 facts → 两环同时联动 */
function recomputeIncomes(s){ s.loops.hema.income=calcLoopIncome(s.loops.hema,s); s.loops.sh.income=calcLoopIncome(s.loops.sh,s); s.jbp=jbpIntersection(s); }
function findGap(s,loopId,gapId){ const lp = loopId==='LOOP-HEMA'?s.loops.hema:s.loops.sh; return {loop:lp, gap:lp.gaps[gapId]}; }

function reduce(state, cmd, ctx){
  const s = clone(state); s.seq += 1;
  const now = (ctx&&ctx.now) || '2026-07-18T09:00:00Z';
  let detail='', before=null, after=null;
  switch(cmd.type){
    case 'SET_STANDARD': {                 // ① 定标↓ 红线·自上而下·绝不倒推
      const gp=findGap(s,cmd.loop_id,cmd.gap_id); if(!gp.gap) throw new Error('no gap');
      before=gp.gap.standard.v; gp.gap.standard.v=cmd.value; gp.gap.standard.src=cmd.src||'上层定标↓';
      after=cmd.value; detail='定标↓ '+cmd.gap_id+' → '+cmd.value; break;
    }
    case 'CALC_GAP': {                      // ③ 算差(先校准去促销/压货假,再 standard vs actual)
      const gp=findGap(s,cmd.loop_id,cmd.gap_id); const a=actualOf(gp.gap,s);
      if(a==null){ detail='算差跳过 '+cmd.gap_id+' · no_data'; break; }
      gp.gap.diag={ actual:a, standard:gp.gap.standard.v, delta:+(a-gp.gap.standard.v).toFixed(4),
        met:(gp.gap.standard.dir==='gte'? a>=gp.gap.standard.v : a<=gp.gap.standard.v), rc:cmd.rc||null, calibrated:true };
      detail='算差 '+cmd.gap_id+' Δ='+gp.gap.diag.delta; break;
    }
    case 'CLOSE_GAP': {                     // ④ 关差(硬门:先算差 + 证据门:必须带可验证证据·红线R1)
      const gp=findGap(s,cmd.loop_id,cmd.gap_id);
      if(!gp.gap.diag) throw new Error('算差前先校准:必须先 CALC_GAP 再 CLOSE_GAP');
      const m=(gp.gap.close_menu||[])[cmd.menu_i]; if(!m) throw new Error('no close option');
      // ★证据门(红线R1:证据可验证>口头自报)·关差必须交齐所需证据,否则不 DONE
      const req=m.evidence_required||[]; const got=cmd.evidence||{};
      const missing=req.filter(function(e){return !got[e.key];});
      if(missing.length) throw new Error('证据未交齐(红线R1·不可口头自报):缺 '+missing.map(function(e){return e.label;}).join('、'));
      before=gp.gap.close.status;
      gp.gap.close={ action:m.action, status:'DONE', by:gp.loop.owner, gcd:!!m.gcd,
                     evidence:req.map(function(e){return {key:e.key,label:e.label,type:e.type,value:got[e.key],verifiable:e.verifiable!==false};}) };
      if(m.fact_delta){ for(const k in m.fact_delta){ s.facts[k]=+Math.min(1, (s.facts[k]||0)+m.fact_delta[k]).toFixed(4); } }
      after='DONE'; detail='关差 '+cmd.gap_id+' · '+m.action+'(证据'+req.length+'件)'+(m.gcd?' [GCD·喂两环]':' [仅本环]'); break;
    }
    case 'VERIFY': {                        // ⑤ 验果 看标动没动(actualOf 是否达标)·非任务做没做
      const gp=findGap(s,cmd.loop_id,cmd.gap_id); const a=actualOf(gp.gap,s);
      const met=(gp.gap.standard.dir==='gte'? a>=gp.gap.standard.v : a<=gp.gap.standard.v);
      gp.gap.verify={ status:'VERIFIED', effective:met, actual_at_verify:a };
      detail='验果 '+cmd.gap_id+' → '+(met?'有效·关差成立':'无效·回根因'); break;
    }
    case 'ESCALATE': {
      const gp=findGap(s,cmd.loop_id,cmd.gap_id);
      gp.gap.close={ action:'ESCALATE', status:'ESCALATED', to:gp.loop.up };
      detail='升级 '+cmd.gap_id+' → '+gp.loop.up; break;
    }
    case 'XD_SCAN': {                       // XD 进店三拍盘点(量实↑入口·全员动作·照片写L1真源·红线R1)
      if(!cmd.photo) throw new Error('进店盘点必须拍照(红线R1:照片是SKU状态最硬证据)');
      const sw=cmd.switch, val=cmd.value;   // 盘出的开关状态(如 有货:true)
      if(sw && s.switches.on.hasOwnProperty(sw)) s.switches.on[sw]=!!val;
      // 照片→识别→更新对应 fact(mock:AI识货架待TL后端)
      if(cmd.fact_delta){ for(const k in cmd.fact_delta){ s.facts[k]=+Math.min(1,Math.max(0,(s.facts[k]||0)+cmd.fact_delta[k])).toFixed(4); } }
      s.switches.last_scan={ by:cmd.by||'进店人', photo:cmd.photo, at:now, sku:s.switches.sku };
      // 标记5类采集完成(哪一类)
      if(cmd.collect_key){ const cc=s.xd_collect.find(function(x){return x.key===cmd.collect_key;}); if(cc){cc.done=true; cc.value=cmd.collect_value||cmd.photo||'已采';} }
      detail='XD进店盘点 '+(sw?(sw+'='+val):'')+(cmd.collect_key?(' · 采集'+cmd.collect_key):'')+' · 照片写入L1真源'; break;
    }
    case 'GUANXI_TALK': {                   // 客情谈判(答应+共识)
      const t=s.guanxi.talks[cmd.idx]; if(!t) throw new Error('no talk target');
      if(cmd.he_agreed!=null) t.he_agreed=cmd.he_agreed;
      if(cmd.consensus_status) t.consensus.status=cmd.consensus_status;
      t.logged=true; t.at=now;
      t.actionable = (t.he_agreed===true && t.consensus.status==='agreed');
      // ★每次谈判自动留痕进历史(接棒看得到)
      t.history.push({ at:now.slice(0,10), by:(s.loops[ (cmd.by_loop||'sh') ]||s.loops.sh).owner, what:cmd.note||'谈判', result:(t.he_agreed===true?'谈成·落任务':t.he_agreed===false?'没谈拢·待升级':'谈判中') });
      detail='客情谈判 · '+t.who+' · 答应='+t.he_agreed+' · 共识='+t.consensus.status+(t.actionable?' → 落任务':'(软记录不换钱)')+' · 已留痕'; break;
    }
    case 'GUANXI_EDIT': {                   // 编辑三段(他的要求/我方承诺/我方要求·谈判是活的·会变)
      const t=s.guanxi.talks[cmd.idx]; if(!t) throw new Error('no talk target');
      const f=cmd.field; if(['his_ask','our_promise','our_ask','prefs','handover_note'].indexOf(f)<0) throw new Error('字段不可编辑:'+f);
      const old_v=t[f]; t[f]=cmd.value;
      if(f!=='handover_note'&&f!=='prefs') t.history.push({ at:now.slice(0,10), by:(s.loops.sh.owner), what:'更新['+f+']', result:'旧:'+String(old_v).slice(0,20)+'→新' });
      detail='客情编辑 · '+t.who+' · '+f+' 已更新'+(f==='handover_note'?'(交接语)':''); break;
    }
    case 'GUANXI_HANDOVER': {               // ★交接给新人(记经手人链·关系资产传承不断)
      const t=s.guanxi.talks[cmd.idx]; if(!t) throw new Error('no talk target');
      t.owner_chain.push((cmd.new_owner||'新SR')+'('+now.slice(0,10)+'起)');
      t.history.push({ at:now.slice(0,10), by:cmd.old_owner||'交接', what:'关系交接给 '+(cmd.new_owner||'新SR'), result:'知识库已传承' });
      if(cmd.handover_note) t.handover_note=cmd.handover_note;
      detail='客情交接 · '+t.who+' → '+(cmd.new_owner||'新SR')+' · 历史+脾性+承诺全传承'; break;
    }
    default: throw new Error('unknown command '+cmd.type);
  }
  recomputeIncomes(s);                      // ★两环收入 + JBP 同时重算
  const prev = s.audit.length ? s.audit[s.audit.length-1].hash : '0';
  const entry = {seq:s.seq, at:now, actor:(cmd.loop_id==='LOOP-HEMA'?'店长':'SR'), cmd:cmd.type, gap:cmd.gap_id||null, detail, before, after};
  entry.hash = hashChain(prev, entry);
  s.audit.push(entry);
  return deepFreeze(s);
}
function dispatch(state, cmd, ctx){
  const fp = commandFingerprint(cmd);
  if(state.idempotency[fp]) return state;
  const s2 = reduce(state, cmd, ctx);
  const s3 = clone(s2); s3.idempotency[fp]=s2.seq;
  return deepFreeze(s3);
}

/* 契约自检:真同源 + 宪法守则(对象/值双查) */
function contractHash(){
  const frozen=[deepFreeze,clone,digest,commandFingerprint,hashChain,factOf,actualOf,gapMet,calcLoopIncome,jbpIntersection,reduce,dispatch,seedState].map(function(f){return f.toString();}).join('§');
  const fillSig=JSON.stringify(Object.keys(CHANNEL_FILL))+'|'+CHANNEL_FILL.hema_gaps.map(function(g){return g.gap_id;}).join(',')+'|'+CHANNEL_FILL.sh_gaps.map(function(g){return g.gap_id;}).join(',');
  return digest(CORE_VERSION+'§'+frozen+'§'+fillSig);
}
function selfCheck(state){
  const bad=[];
  ['hema','sh'].forEach(function(k){ const gs=state.loops[k].gaps; for(const id in gs) if(gs[id].actual!==null) bad.push('ACTUAL_NOT_NULL:'+id); });
  if(state.meta.live_gate_pass!==null) bad.push('LIVE_GATE_NOT_NULL');
  if(!Object.isFrozen(state)) bad.push('STATE_NOT_FROZEN');
  if(state.meta.contract_hash && state.meta.contract_hash!==contractHash()) bad.push('CONTRACT_DRIFT');
  // 双环必须锚同一消费者(两端落消费者)
  if(state.loops.hema.anchor!==state.loops.sh.anchor) bad.push('CONSUMER_ANCHOR_MISMATCH');
  return {ok:bad.length===0, bad, contract_hash:contractHash()};
}

/* ────────── 填充层:o2o 渠道内核(回本来·换渠道只换这块) ────────── */
const CHANNEL_FILL = {
  channel_id:'hema-store-o2o', channel_name:'盒马门店O2O·店仓一体·双环交汇',
  store:{ id:'ST-HEMA-YP', name:'盒马鲜生·上海杨浦店', consumer_anchor:'consumer' },
  /* SR 挖潜力:从城市盘子给这家店切 SH 目标(定标↓·非倒推·呼应社区店 N×P×F×B×ASP) */
  city:{ population:82000, customer_type:'中产社区+园区白领', region:'上海·杨浦', 
         sh_city_target:'城市六月鲜季度 6.0M 瓶', this_store_share:'1.8%', this_store_sh_target:'本店贡献 108K 瓶' },
  /* 店的共享经营现实(两环都读·唯一事实源) */
  facts:{ inventory_depth:0.60, fulfillment_30min:0.88, liuyuexian_shelf:0.58, consumer_footfall:0.72 /* repurchase_30d 缺=no_data */ },
  /* XD 6开关主盘(SKU状态·L1晶体管)·复购/毛利未采=no_data不假装(红线·诚实) */
  switches:{
    sku:'六月鲜特级380ml', at:'@盒马·杨浦',
    on:{ 上架:true, 有货:false, 陈列:true, 动销:false }, // 有货/动销 OFF = 今天要赢的
    nodata:['复购','毛利'] // 未采集·显示"—"·不假装
  },
  /* XD 5类数据采集(红线3:①拍照②自己数据③消费者④竞品⑤门店 全进清单逐项必做) */
  xd_collect:[
    { key:'photo',      label:'① 货架拍照',   type:'photo',  hint:'进店三拍·照片是最硬证据', done:false },
    { key:'own',        label:'② 自己数据',   type:'count',  hint:'六月鲜实际货架数/库存深度', done:false },
    { key:'consumer',   label:'③ 消费者反馈', type:'note',   hint:'顾客问什么/嫌什么(反馈≠自评)', done:false },
    { key:'competitor', label:'④ 竞品情报',   type:'photo',  hint:'竞品价签照/堆头(带价格·可交叉校真)', done:false },
    { key:'store',      label:'⑤ 门店动态',   type:'note',   hint:'店内活动/促销/异常', done:false }
  ],
  /* XM 任务来源·5通道(含会员4类需求机会·o2ov1) */
  task_sources:[
    {ch:'生鲜·线上爆品', hint:'日日鲜类高频引流'},
    {ch:'生鲜·高频刚需', hint:'家庭日配补货'},
    {ch:'季节性', hint:'节令囤货窗口'},
    {ch:'场景', hint:'一人食/家庭餐场景'},
    {ch:'会员4类需求机会', hint:'新客/沉睡/高价值/流失预警'}
  ],
  /* XP 阶段驾驶舱:AIQL顾客资产 + 晋升阶梯(阶段/还差多少/方向) */
  aiql:{ stage:'Q', // 认知A→兴趣I→体验Q→忠诚L · 现在Q阶段
    note:'顾客体验建立鲜度信任·下一步履约稳+所见即所得→L忠诚→高频复购(O2O命根)' },
  ladder:{ // 晋升阶梯·SR侧(SH发薪那条)
    current:'A2', next:'A1', gap_score:9, cond:'记分卡均分持续≥80 + 履约达标',
    salary_now:18.6, salary_next:26 },
  /* 客情关系(XP软实力·红线R2:不可验证软指标·绝不直接换钱)
     升级:不只"维护谁",而是结构化"沟通谈判"——他的要求/我方承诺/我方要求+他答应 + GCD/LCM共识 */
  guanxi:{
    warn:'客情是软指标·记录用于复盘·不挂奖金(红线R2:不可验证自评直接换钱=奖励撒谎)。但谈判达成的"承诺/要求"要落成可验证任务→挂回关差(那才可换钱)。',
    /* 与关键人的结构化沟通谈判(核心补充) */
    talks:[
      { who:'门店店长·陈悦', role:'店仓一体店长(盒马雇)',
        his_ask:'线上GMV冲季度KPI·30分钟履约达标·别给我添库存压力',       // (a)他的要求·可编辑
        our_promise:'帮你把六月鲜做成能带GMV的动销爆品·补货只补真缺的不压货·共担鲜度损耗', // (b)我方承诺·可编辑
        our_ask:'给六月鲜黄金坑位+端架资源·补货优先级往前排',              // (c)我方要求·可编辑
        he_agreed:null,
        consensus:{ gcd_action:'补库存+控损耗稳履约', lcm_target:'库存深度做到LCM水位·两环都够', status:'pending' },
        logged:false,
        /* ★客户关系知识库(可交接·不锁个人) */
        prefs:'重数据不重嘴·怕压货(去年积压吃过亏)·端架资源紧张要提前两周约',  // 这个人的脾性/偏好(接棒必读)
        history:[  // 谈判历史·每次留痕·接棒看得到来龙去脉
          { at:'2026-06-20', by:'林航', what:'首次拜访·摸清他最在意履约KPI', result:'建立初步信任' },
          { at:'2026-07-05', by:'林航', what:'谈六月鲜端架·他要先看动销数据', result:'挂起·待拿数据再谈' }
        ],
        owner_chain:['林航(2026-06至今)'],       // 经手人链(换人留痕)
        handover_note:'端架还没谈下来·卡在他要动销证据·下次带XD盘的动销数据去谈' }, // 给下一棒的话
      { who:'生鲜档口主管·王姐', role:'档口主管(盒马雇)',
        his_ask:'档口鲜度不出问题·别占我理货工时',
        our_promise:'临期我提前预警帮控损·理货我配合不添乱',
        our_ask:'六月鲜补货优先级·鲜度配合前置',
        he_agreed:null,
        consensus:{ gcd_action:'控损耗+就近补货', lcm_target:'鲜度达标线两边都满意', status:'pending' },
        logged:false,
        prefs:'刀子嘴豆腐心·认可你帮她省事就好说话·早上忙别去打扰',
        history:[ { at:'2026-07-08', by:'林航', what:'帮她处理了一批临期六月鲜', result:'关系破冰·她开始配合补货' } ],
        owner_chain:['林航(2026-07至今)'],
        handover_note:'关系刚破冰·靠"帮她省事"维系·别在早高峰找她' }
    ]
  },
  /* 盒马环:店长KPI(盒马定标↓·店长owns·盒马发薪·= 客户价值) */
  hema_gaps:[
    { gap_id:'H-QH', name:'缺货率(店长KPI)', actual_key:'inventory_depth', formula:'shortage',
      standard:{v:0.05, dir:'lte', src:'盒马区域定标↓·红线'}, merit_weight:3.0,
      close_menu:[
        {action:'补库存+控损耗稳履约', fact_delta:{inventory_depth:0.20}, gcd:true,
         steps:['盘缺货SKU清单','下补货单','控临期损耗','拍库存照留证'],
         evidence_required:[ {key:'stock_photo', label:'库存照(带时间戳)', type:'photo', verifiable:true},
                             {key:'restock_qty', label:'补货件数', type:'number', verifiable:true} ]},
        {action:'仅前台改缺货标(不实补)', fact_delta:{}, gcd:false,
         steps:['改前台标'],
         evidence_required:[] } ] },
    { gap_id:'H-LX', name:'30分钟履约准时(店长KPI)', actual_key:'fulfillment_30min',
      standard:{v:0.95, dir:'gte', src:'盒马区域定标↓'}, merit_weight:2.5,
      close_menu:[ {action:'加拣货人力+优化动线', fact_delta:{fulfillment_30min:0.09}, gcd:false,
        steps:['排班加拣货人力','优化拣货动线','记录动线调整'],
        evidence_required:[ {key:'shift_note', label:'排班记录', type:'number', verifiable:true} ]} ] } ],
  /* SH环:六月鲜目标(SH城市切出·SR owns·SH发薪·= 我方价值) */
  sh_gaps:[
    { gap_id:'S-DX', name:'六月鲜动销(SR战功)', actual_key:'inventory_depth', co_fact:'liuyuexian_shelf', w_base:0.6, w_co:0.4,
      standard:{v:0.75, dir:'gte', src:'SH城市JBP切出↓'}, merit_weight:4.0,
      close_menu:[
        {action:'补库存+坑位优化(六月鲜)', fact_delta:{inventory_depth:0.20, liuyuexian_shelf:0.15}, gcd:true,
         steps:['盘六月鲜实际货架数量','按安全库存线下补货单','把六月鲜摆到黄金坑位/端架','拍陈列照留证'],
         evidence_required:[ {key:'shelf_photo', label:'陈列照(带时间戳)', type:'photo', verifiable:true},
                             {key:'restock_qty', label:'补货件数', type:'number', verifiable:true} ]},
        {action:'仅压价冲量(伤毛利)', fact_delta:{liuyuexian_shelf:0.05}, gcd:false,
         steps:['改价签'],
         evidence_required:[ {key:'price_photo', label:'新价签照', type:'photo', verifiable:true} ]} ] },
    { gap_id:'S-PW', name:'六月鲜坑位铺货(SR战功)', actual_key:'liuyuexian_shelf',
      standard:{v:0.80, dir:'gte', src:'SH城市JBP切出↓'}, merit_weight:2.5,
      close_menu:[ {action:'谈更多坑位+端架', fact_delta:{liuyuexian_shelf:0.18}, gcd:false,
        steps:['找店长谈端架资源','六月鲜上端架','拍端架照留证'],
        evidence_required:[ {key:'endcap_photo', label:'端架照(带时间戳)', type:'photo', verifiable:true} ]} ] } ]
};

function buildRegistry(){
  return { agent_id:'AGT-O2O-STORE-HEMA-YP', agent_name:'盒马杨浦店双环经营Agent', agent_type:'store_dualloop', agent_version:'2.0.0',
    loop_level:'L3', parent_agent:'AGT-O2O-CITY-SH', scope:'ST-HEMA-YP',
    business_owner:'城市经理', data_owner:'数据官', technical_owner:'平台', risk_owner:'风控',
    autonomy_level:'A1', allowed_actions:['CALC_GAP','CLOSE_GAP','VERIFY','ESCALATE'], forbidden_actions:['定价直批','跨店调拨','预算直批','给盒马员工发薪'],
    default_autonomy:'A1', autonomy_matrix:{CLOSE_GAP:'A1',VERIFY:'A1',ESCALATE:'A2'},
    service_status:'ACTIVE', schema_version:'INF-STD-001-v1.1', registered_by:'Product Architect',
    business_boundary:'盒马杨浦店双环:SH环(SR·六月鲜·SH发薪)+盒马环(店长·KPI·盒马发薪)·SH引擎帮店长做满分不代发薪',
    owned_objects:['SH环 S-DX/S-PW','盒马环视图 H-QH/H-LX','JBP双赢交集','店共享事实账'],
    input_contract:{standards:'SH城市切出↓ + 盒马区域定标↓', facts:'XD量实↑(simulation)'},
    output_contract:{std:'OBSERVATION/JUDGMENT/DECISION/ACTION/RESULT', escalation:'不可关差升L2城市'},
    escalation_path:['AGT-O2O-CITY-SH','城市经理','总部北极星'],
    effective_date:'2026-07-18', retirement_date:null,
    agent_registry_version:'AR-2.0', loop_elements:{L1:1,L2:1,L3:1,L4:4,dual_loop:2} };
}
function mkGaps(arr){ const o={}; arr.forEach(function(g){ o[g.gap_id]={ ...clone(g), actual:null, diag:null, close:{action:null,status:'OPEN'}, verify:{status:'PENDING',effective:null} }; }); return o; }
function seedState(nowISO){
  const now = nowISO || '2026-07-18T09:00:00Z';
  const s={
    meta:{ version:CORE_VERSION, channel:CHANNEL_FILL.channel_id, cycle:'C-2026W29', maturity:'M1',
           data_mode:'simulation', live_gate_pass:null, contract_hash:contractHash() },
    seq:0,
    store: clone(CHANNEL_FILL.store),
    city: clone(CHANNEL_FILL.city),
    facts: clone(CHANNEL_FILL.facts),
    switches: clone(CHANNEL_FILL.switches),
    xd_collect: clone(CHANNEL_FILL.xd_collect),
    task_sources: clone(CHANNEL_FILL.task_sources),
    aiql: clone(CHANNEL_FILL.aiql),
    ladder: clone(CHANNEL_FILL.ladder),
    guanxi: clone(CHANNEL_FILL.guanxi),
    loops:{
      hema:{ loop_id:'LOOP-HEMA', owner:'盒马店长', paid_by:'盒马', role:'store_manager',
             up:'盒马杨浦区域', anchor:'consumer', income_base:8.0, value_side:'客户价值(SH帮做满分)',
             gaps: mkGaps(CHANNEL_FILL.hema_gaps), income:null },
      sh:{ loop_id:'LOOP-SH', owner:'SH-SR(城市BD)', paid_by:'SH·欣和', role:'sr',
           up:'SH上海城市JBP', anchor:'consumer', income_base:9.0, value_side:'我方价值(SR合伙人分成)',
           gaps: mkGaps(CHANNEL_FILL.sh_gaps), income:null } },
    audit:[{seq:0, at:now, actor:'system', cmd:'SEED', gap:null, detail:'simulation_only 装假水 · 双环交汇就位 · 两端落消费者', before:null, after:'M1', hash:digest('seed')}],
    idempotency:{}, agent:buildRegistry()
  };
  recomputeIncomes(s);
  return deepFreeze(s);
}

const ENGINE={ CORE_VERSION, seedState, reduce, dispatch, actualOf, gapMet, calcLoopIncome, jbpIntersection,
               selfCheck, contractHash, commandFingerprint, deepFreeze, findGap, CHANNEL_FILL };
if(typeof module!=='undefined' && module.exports) module.exports=ENGINE;
root.O2OEngine=ENGINE;
})(typeof window!=='undefined'? window : globalThis);
