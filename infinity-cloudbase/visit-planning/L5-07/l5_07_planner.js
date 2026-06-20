/* ============================================================================
 * INFINITY OS · 拜访规划/路线编排 L5-07 · 实现 (SCAFFOLD · 未上线)
 * ----------------------------------------------------------------------------
 * 依 bas_visit_planning_skill_v0_2.md(98分定稿)实现:输入 → 排程 → 输出 dict。
 * 输出 dict 喂给 conftest_validator.validate() 必须返回 []（见 l5_07_bridge.py 桥）。
 *
 * 对齐 字段字典 v1.1(../../field-dictionary.js):
 *   - 门店主数据用 L0-04 真名 store_id(C1);
 *   - CHS → L1-06(provenance 'L1-06');SHS → 地基③ vitality(provenance '地基③vitality',C2);
 *   - human_override 留痕;no_data/unknown 哨兵语义沿用。
 *
 * 四铁律(SKILL §0):①助手非鞭子(输出无考勤字段)②配额保底不漏常规
 *   ③只排程不越界(不采集/判级/算战功/重算CHS-SHS/做资源能力分配)④VQS评事非评人。
 * ⚠ 政策数字(频率/产能/配额/权重)= DECISION-003 占位,flags 标 D003_pending。
 * ========================================================================== */
(function (root) {
  'use strict';
  var Dict = (typeof require !== 'undefined') ? safeReq('../../field-dictionary.js') : root.InfinityDict;
  function safeReq(p){ try { return require(p); } catch(e){ return null; } }
  var STORE_ID = (Dict && Dict.MASTER && Dict.MASTER.store.code) || 'store_id'; // 'store_id'(L0-04/C1)

  // ── D-003 政策(provisional 草拟值·绝不当已定;flags 仍标 D003_pending)──────
  //   数字 = 我们草拟的 provisional,让 scaffold 跑得像真的;最终由管理层 DECISION-003 定。
  var D003 = {
    _status: 'D003_pending',                  // 仍待管理层 DECISION-003 定
    _provenance: 'provisional草拟值·非最终',
    FREQ_DAYS: { A: 7, B: 14, C: 30 },        // 分级频率:A级7天/B级14天/C级30天
    DEFAULT_FREQ_DAYS: 14,                     // 缺分级兜底:14天
    TIER_WEIGHT: { A: 30, B: 20, C: 10 },     // 常规到期度·分级权重(相对)
    CAP_DAILY: 16,                            // 人均产能:16家/日(城区基准)
    FIREFIGHT_CAP: 5,                          // 救火配额:5(对齐产能16·约30%)
    REGULAR_MIN: 11,                          // 常规保底:11(对齐产能16·约70%)
    VPS_WEIGHT: { 常规到期度: 1, 救火紧急度: 1 }, // VPS权重 常规:救火 = 1:1 占位
    CHS_SCORE: { A: 0, B: 15, C: 30, D: 45 }, // 门店健康越差→救火越高(读 L1-06)
    SHS_SCORE: { S: 0, A: 0, B: 15, C: 30, D: 45 } // SKU生命力越低→救火越高(读地基③ vitality)
  };

  var OBJECT_POOL = { DSR: '零售店', 美顾: 'KA会员店', 督导: '抽查', 区域经理: '巡店' };

  function freqDays(tier) {
    if (tier && D003.FREQ_DAYS[tier] != null) return { days: D003.FREQ_DAYS[tier], tier_pending: false };
    return { days: D003.DEFAULT_FREQ_DAYS, tier_pending: true }; // 缺分级→默认频率,不漏访
  }
  function cyclLabel(tier){ return tier==='A'?'周':tier==='B'?'双周':tier==='C'?'月':'默认'; }

  // 救火紧急度 = f(CHS, SHS)·只读不重算(读 L1-06 / 地基③ vitality)
  function firefightScore(chs, shs) {
    var c = D003.CHS_SCORE[(chs||'').charAt(0)] || 0;
    var s = D003.SHS_SCORE[(shs||'').charAt(0)] || 0;
    return { score: c + s, from_CHS: chs, from_SHS: shs };
  }

  function nearestRoute(items) { // geo 就近(最近邻),无 geo 保持原序
    if (!items.length || !items[0]._geo) { items.forEach(function(it,i){ it.seq=i+1; }); return items.map(function(i){return i[STORE_ID];}); }
    var pool=items.slice(), out=[], cur=items[0]._geo;
    function d2(a,b){var dx=a.lat-b.lat,dy=a.lng-b.lng;return dx*dx+dy*dy;}
    while(pool.length){ var bi=0; for(var i=1;i<pool.length;i++) if(pool[i]._geo&&d2(pool[i]._geo,cur)<d2(pool[bi]._geo||{lat:1e9,lng:1e9},cur)) bi=i;
      var nx=pool.splice(bi,1)[0]; nx.seq=out.length+1; cur=nx._geo||cur; out.push(nx); }
    return out.map(function(i){return i[STORE_ID];});
  }

  /**
   * 主入口:input → L5-07 输出 dict。
   * input: { date, person, role,
   *   stores:[{store_id, tier:'A'|'B'|'C'|null, geo:{lat,lng}, lastVisitDays:int, blindspot:bool}],
   *   health:{ store_id:{CHS:'C', SHS:'D'} }   // 原始值,读自 L1-06 / 地基③(只读)
   * }
   */
  function planL507(input) {
    var pool = OBJECT_POOL[input.role] || '零售店';
    var chs_shs_inputs = {};
    var candidates = [];
    var hasRegularCandidate = false;
    var anyTierPending = false;

    input.stores.forEach(function (st) {
      var sid = st[STORE_ID] || st.store_id;
      var h = (input.health && input.health[sid]) || {};
      // CHS/SHS 只读映射(provenance 必带)——本节点不重算(铁律③/亮点B)
      if (h.CHS || h.SHS) chs_shs_inputs[sid] = {
        CHS: { value: h.CHS, provenance: 'L1-06' },
        SHS: { value: h.SHS, provenance: '地基③vitality' }
      };
      var fq = freqDays(st.tier); if (fq.tier_pending) anyTierPending = true;
      var due = (st.lastVisitDays == null) || (st.lastVisitDays >= fq.days);
      var reason = null;
      if (st.blindspot) reason = '盲点';
      else if (st.lastVisitDays != null && st.lastVisitDays > fq.days) reason = '逾期';
      else if (due) reason = '常规';
      if (!reason) return; // 未到期·今日不排
      if (reason === '常规') hasRegularCandidate = true;

      var ff = firefightScore(h.CHS, h.SHS);
      var dueDeg = Math.round((D003.TIER_WEIGHT[st.tier] || D003.TIER_WEIGHT.B) *
                   ((st.lastVisitDays != null ? st.lastVisitDays : fq.days) / fq.days));
      // VPS = 常规到期度 + 救火紧急度,按 D-003 VPS_WEIGHT(provisional 1:1)
      var vps = Math.round(D003.VPS_WEIGHT['常规到期度'] * dueDeg + D003.VPS_WEIGHT['救火紧急度'] * ff.score);
      candidates.push({
        store_id: sid, reason: reason, vps: vps,
        vps_breakdown: {
          '常规到期度': { '分级': st.tier || null, '周期': cyclLabel(st.tier), '距上次访天数': st.lastVisitDays },
          '救火紧急度': { from_CHS: ff.from_CHS, from_SHS: ff.from_SHS, provenance: 'L1-06+地基③' }
        },
        est_minutes: 30,
        _geo: st.geo || null,
        _tier_pending: fq.tier_pending,
        _fire: (reason === '盲点' || reason === '逾期')
      });
    });

    // 配额保底(铁律②):常规保底先占,救火封顶,总不超产能;其余进 overflow
    candidates.sort(function (a, b) { return b.vps - a.vps; });
    var fireCands = candidates.filter(function (c) { return c._fire; });
    var regCands  = candidates.filter(function (c) { return !c._fire; });
    var cap = D003.CAP_DAILY, fcap = D003.FIREFIGHT_CAP, rmin = D003.REGULAR_MIN;

    var selected = [], overflow = [];
    var regReserve = Math.min(rmin, regCands.length);              // 常规保底名额
    var fireRoom = Math.min(fcap, cap - regReserve);               // 救火封顶且不挤保底
    var takenFire = fireCands.slice(0, Math.max(0, fireRoom));
    var takenReg  = regCands.slice(0, regReserve);
    // 剩余产能补位(救火优先,因更紧急),仍不破救火封顶
    var remain = cap - takenFire.length - takenReg.length;
    if (remain > 0) { var mf = fireCands.slice(takenFire.length, Math.min(fcap, takenFire.length + remain)); takenFire = takenFire.concat(mf); remain -= mf.length; }
    if (remain > 0) { var mr = regCands.slice(takenReg.length, takenReg.length + remain); takenReg = takenReg.concat(mr); }
    selected = takenFire.concat(takenReg);
    // overflow = 未入选的候选
    candidates.forEach(function (c) { if (selected.indexOf(c) < 0) overflow.push({ store_id: c.store_id, reason: c.reason, vps: c.vps, defer_to: '次日' }); });

    // 入选按 VPS 降序 → 地理就近 seq
    selected.sort(function (a, b) { return b.vps - a.vps; });
    nearestRoute(selected);
    selected.sort(function (a, b) { return a.seq - b.seq; });

    var visit_list = selected.map(function (c) {
      return { store_id: c.store_id, seq: c.seq, reason: c.reason, vps: c.vps, vps_breakdown: c.vps_breakdown, est_minutes: c.est_minutes };
    });

    // 学习记录 emit(签退后回填)·评事非评人(铁律④)
    var learning_emits = selected.map(function (c) {
      return { store_id: c.store_id, planned_vps: c.vps, '实际访没访': 'pending(签退回填·事实非考核)',
               '拜访后店状态有无拨动': 'pending(下周期回填·陈列/动销Δ)',
               effectiveness_signal: '对事:这次拜访有没有拨动门店状态(VQS,非对人)' };
    });

    // RAE/CAE 信号钩子(只 emit 不分配,铁律③)
    var needRes = selected.filter(function (c) { return c.reason === '盲点' || (c.vps_breakdown['救火紧急度'].from_CHS || '').charAt(0) === 'C' || (c.vps_breakdown['救火紧急度'].from_CHS || '').charAt(0) === 'D'; })
      .map(function (c) { return { store_id: c.store_id, '状态': '救火(健康差/盲点)', '指向': 'emit给RAE,本节点不分配' }; });
    var signal_hooks = { '需补资源的客户状态': needRes,
      '需特定能力的客户类型': (pool === 'KA会员店' ? [{ '类型': 'KA大店谈判', '指向': 'emit给CAE,本节点不派人' }] : []) };

    var flags = ['assistant_not_tracker', 'vqs_effect_not_person', 'regular_quota_protected', 'D003_pending'];
    var status = 'planned';
    if (overflow.length) { flags.push('overload'); status = 'overload'; }
    if (anyTierPending) flags.push('tier_pending');

    var ordered = visit_list.map(function (v) { return v.store_id; });
    return {
      date: input.date, person: input.person, role: input.role, object_pool: pool,
      chs_shs_inputs: chs_shs_inputs,
      visit_list: visit_list,
      route: { ordered_stops: ordered, geo_cluster: input.geo_cluster || '就近聚类', est_total_minutes: visit_list.reduce(function (a, v) { return a + (v.est_minutes || 0); }, 0) },
      capacity: { cap: cap, used: visit_list.length, '救火配额': '≤' + fcap + '(D-003待定)', '常规保底配额': '≥' + rmin + '(D-003待定)', _firefight_cap: fcap },
      overflow: overflow,
      learning_emits: learning_emits,
      signal_hooks: signal_hooks,
      confidence: 'mid',
      human_override: null,
      status: status,
      flags: flags,
      summary_text: buildSummary(input, visit_list, pool),
      fanout: ['XM今日任务', 'XD采集指挥', 'LE学习引擎', '经理可调整留痕'],
      _candidate_regular: hasRegularCandidate
    };
  }

  function buildSummary(input, vl, pool) {
    var fire = vl.filter(function (v) { return v.reason === '盲点' || v.reason === '逾期'; }).length;
    var reg = vl.length - fire;
    return (input.person || '') + '@' + (input.date || '') + ' 排 ' + vl.length + ' 家(对象池=' + pool +
      '),按 VPS 降序。VPS=常规到期度+救火紧急度(CHS读L1-06、SHS读地基③ vitality,只读不重算)。' +
      '救火 ' + fire + ' 家(盲点/逾期)未占满配额,常规 ' + reg + ' 家有保底名额,没只顾救火漏常规。' +
      '按 geo 就近排顺序减空跑。签退后 emit 学习记录给 LE 学"什么拜访有效"(评拜访有没有拨动店状态·对事非对人)。' +
      '资源/能力需求只 emit 给 RAE/CAE,本节点不分配。建议路线非强制,经理可调留痕,机器不锁死。';
  }

  // 演示输入(对齐 SKILL §6 示例形状)——bridge/CLI 用
  function demoInput() {
    return {
      date: '2026-06-15', person: 'DSR-Chen', role: 'DSR', geo_cluster: '武侯区西片',
      stores: [
        { store_id: 'CD-WHQ-001', tier: 'A', geo: { lat: 30.63, lng: 104.04 }, lastVisitDays: 9,  blindspot: true  },
        { store_id: 'CD-WHQ-008', tier: 'B', geo: { lat: 30.64, lng: 104.05 }, lastVisitDays: 18, blindspot: false },
        { store_id: 'CD-WHQ-003', tier: 'B', geo: { lat: 30.65, lng: 104.06 }, lastVisitDays: 14, blindspot: false },
        { store_id: 'CD-WHQ-005', tier: 'C', geo: { lat: 30.66, lng: 104.07 }, lastVisitDays: 30, blindspot: false },
        { store_id: 'CD-WHQ-009', tier: 'A', geo: { lat: 30.67, lng: 104.08 }, lastVisitDays: 3,  blindspot: false } // 未到期·不排
      ],
      health: {
        'CD-WHQ-001': { CHS: 'C', SHS: 'D' }, 'CD-WHQ-008': { CHS: 'B', SHS: 'C' },
        'CD-WHQ-003': { CHS: 'A', SHS: 'B' }, 'CD-WHQ-005': { CHS: 'A', SHS: 'A' }
      }
    };
  }

  var api = { planL507: planL507, demoInput: demoInput, D003: D003, STORE_ID: STORE_ID };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.VisitPlannerL507 = api;

  // CLI:node l5_07_planner.js → 打印演示输出 JSON(供 python 桥校验)
  if (typeof require !== 'undefined' && require.main === module) {
    process.stdout.write(JSON.stringify(planL507(demoInput())));
  }
})(typeof window !== 'undefined' ? window : this);
