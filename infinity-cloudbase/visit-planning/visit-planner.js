/* ============================================================================
 * INFINITY OS · 拜访规划/路线编排 · 规则引擎 (SCAFFOLD · 纯函数 · 未上线)
 * ----------------------------------------------------------------------------
 * 职责(只排程):读 L0-04(stores)/L1-04(coverage_blindspot)/组织主数据(org_capacity)
 *   /拜访历史(visit_history) → 产出"每人每日拜访清单+路线"。
 * 不做:不采集(XD)、不判级(L1-03)、不算战功。只读输入,不回写状态。(铁律4)
 *
 * 铁律落实(逐条):
 *  1. 输出物理上不含 visited/checked_in/who_missed/completion —— 见 assertNoAttendance()
 *  2. 产能切两块:常规保底先占,救火有上限,救火吃不掉保底 —— allocate()
 *  3. 缺分级按默认频率排 + 标 tierPending,不漏访 —— VisitDict.resolveCycle()
 *  4. 只读上面四类输入,不碰采集/判级/战功
 *  5. 经理改路线 → applyOverride() 留痕(by/from/to/why/at),机器不锁死
 *  6. 字段名全照 visit-dictionary(待字典锁定)
 *
 * D-003 数字全是占位(VisitDict.D003),plan.flags 带 'D003_pending'。
 * ========================================================================== */
(function (root) {
  'use strict';
  var Dict = (typeof require !== 'undefined') ? require('./visit-dictionary.js')
            : (root.VisitDict);
  var SF = Dict.STORE_FIELDS, D = Dict.D003;

  function dayDiff(a, b) { // 天数差(b - a),按本地日历日
    var ms = (new Date(b)).setHours(0,0,0,0) - (new Date(a)).setHours(0,0,0,0);
    return Math.round(ms / 86400000);
  }

  // 某店应访状态:逾期天数 = 距上次访 - 周期T(>0=逾期)
  function dueState(store, lastVisitDate, today) {
    var cyc = Dict.resolveCycle(store);
    var daysSince = lastVisitDate ? dayDiff(lastVisitDate, today) : null; // null=从无记录
    var overdueDays = (daysSince == null) ? cyc.cycleT : (daysSince - cyc.cycleT);
    return {
      cycleT: cyc.cycleT, tier: cyc.tier, tierPending: cyc.tierPending,
      daysSince: daysSince, overdueDays: overdueDays,
      due: (daysSince == null) || (daysSince >= cyc.cycleT)
    };
  }

  // 归池:盲点 或 逾期 → fire;到期但未逾期 → baseline(铁律2两块)
  function classify(store, ds, blindspotSet) {
    var isBlind = blindspotSet && blindspotSet.has(store[SF.code]);
    if (isBlind) return { pool: 'fire', reasonCode: 'blindspot' };
    if (ds.overdueDays > 0) return { pool: 'fire', reasonCode: 'overdue' };
    if (ds.due) return { pool: 'baseline', reasonCode: 'regular' };
    return null; // 未到期 → 今日不排
  }

  // 路线排序:从出发基地起最近邻(scaffold;真优化器后置)。无 geo 则保持原序。
  function orderRoute(items, home) {
    if (!home || home.lat == null) return items.map(function (it, i) { return (it.seq = i + 1, it); });
    var pool = items.slice(), out = [], cur = { lat: home.lat, lng: home.lng };
    function d2(a, b) { var dx = a.lat - b.lat, dy = a.lng - b.lng; return dx*dx + dy*dy; }
    while (pool.length) {
      var bi = 0;
      for (var i = 1; i < pool.length; i++)
        if (pool[i]._geo && cur && d2(pool[i]._geo, cur) < d2(pool[bi]._geo || {lat:1e9,lng:1e9}, cur)) bi = i;
      var nx = pool.splice(bi, 1)[0]; nx.seq = out.length + 1; cur = nx._geo || cur; out.push(nx);
    }
    return out;
  }

  /**
   * 为一个人排今日清单。
   * person: { userCode, capacityDaily?, home:{lat,lng} }
   * candidates: [{ store, lastVisitDate }]  (store = stores 行)
   * blindspotSet: Set<storeCode>  (来自 coverage_blindspot)
   * today: ISO date
   */
  function planForPerson(person, candidates, blindspotSet, today) {
    var flags = ['D003_pending'];
    var capacity = person.capacityDaily;
    if (capacity == null) { capacity = D.CAPACITY_DAILY_DEFAULT; flags.push('capacity_default'); }

    var fire = [], baseline = [];
    candidates.forEach(function (c) {
      var ds = dueState(c.store, c.lastVisitDate, today);
      var cl = classify(c.store, ds, blindspotSet);
      if (!cl) return;
      var item = buildItem(c.store, ds, cl);
      if (item.tierPending && flags.indexOf('tier_pending') < 0) flags.push('tier_pending');
      (cl.pool === 'fire' ? fire : baseline).push(item);
    });

    // 排序:救火按逾期/盲点最严重优先;常规按"距上次/周期"比例(越接近超期越前)
    fire.sort(function (a, b) {
      var ab = (a.reasonCode === 'blindspot') ? 1 : 0, bb = (b.reasonCode === 'blindspot') ? 1 : 0;
      return (bb - ab) || (b.overdueDays - a.overdueDays);
    });
    baseline.sort(function (a, b) { return ratio(b) - ratio(a); });

    var sel = allocate(fire, baseline, capacity);

    var ordered = orderRoute(sel.items, person.home);
    ordered.forEach(function (it) { delete it._geo; }); // 内部字段不外泄

    var plan = {
      planDate: today,
      userCode: person.userCode,
      items: ordered,
      quota: {
        capacityDaily: capacity,
        baselineReserved: sel.baselineReserved,  // 保底名额
        fireCap: sel.fireCap,                     // 救火上限
        usedFire: sel.usedFire, usedBaseline: sel.usedBaseline
      },
      humanOverride: [],
      generatedAt: new Date().toISOString(),
      source_ref: { source: 'visit_planner_scaffold', app: 'visit-planning' },
      flags: flags
    };
    assertNoAttendance(plan); // 铁律1 硬校验
    return plan;
  }

  function ratio(it) { return it.cycleT ? (it.daysSince == null ? 99 : it.daysSince / it.cycleT) : 1; }

  function buildItem(store, ds, cl) {
    return {
      storeCode: store[SF.code], storeName: store[SF.name],
      pool: cl.pool, reasonCode: cl.reasonCode,
      tier: ds.tier, tierPending: ds.tierPending,
      cycleT: ds.cycleT, daysSinceLast: ds.daysSince, overdueDays: ds.overdueDays,
      _geo: (store[SF.lat] != null) ? { lat: +store[SF.lat], lng: +store[SF.lng] } : null
      // 注意:无 seq 之外的状态字段;绝不含 visited/checkin/completion(铁律1)
    };
  }

  /**
   * 配额分配(铁律2核心):
   *   baselineReserved = ceil(capacity * BASELINE_RESERVE_RATIO)  常规保底,救火吃不掉
   *   fireCap          = floor(capacity * FIRE_CAP_RATIO)         救火上限
   * 先给常规保底名额,再放救火(不超 fireCap),最后用剩余产能补位。
   */
  function allocate(fire, baseline, capacity) {
    var baselineReserved = Math.min(baseline.length, Math.ceil(capacity * D.BASELINE_RESERVE_RATIO));
    var fireCap = Math.floor(capacity * D.FIRE_CAP_RATIO);

    var items = [];
    // ① 先占常规保底,确保常规店不被救火系统性挤掉
    var baseTaken = baseline.slice(0, baselineReserved);
    // ② 救火不超上限,且不超过 capacity - 已占常规保底
    var fireRoom = Math.min(fireCap, capacity - baseTaken.length);
    var fireTaken = fire.slice(0, Math.max(0, fireRoom));
    // ③ 剩余产能两边补位(救火优先填,因更紧急),不破坏②的上限语义
    var used = baseTaken.length + fireTaken.length;
    var remain = capacity - used;
    if (remain > 0) {
      var moreFire = fire.slice(fireTaken.length, fireTaken.length + remain);
      fireTaken = fireTaken.concat(moreFire);
      remain -= moreFire.length;
    }
    if (remain > 0) {
      var moreBase = baseline.slice(baseTaken.length, baseTaken.length + remain);
      baseTaken = baseTaken.concat(moreBase);
    }
    items = fireTaken.concat(baseTaken);
    return {
      items: items, baselineReserved: baselineReserved, fireCap: fireCap,
      usedFire: fireTaken.length, usedBaseline: baseTaken.length
    };
  }

  // 经理改路线 → 留痕,机器不锁死(铁律5)
  function applyOverride(plan, override) {
    // override: { by, action:'reorder'|'add'|'remove', payload, why, at? }
    var rec = {
      by: override.by, why: override.why || null,
      at: override.at || new Date().toISOString(),
      from: plan.items.map(function (i) { return i.storeCode; }),
      to: null
    };
    if (override.action === 'reorder' && Array.isArray(override.payload)) {
      var idx = {}; plan.items.forEach(function (i) { idx[i.storeCode] = i; });
      plan.items = override.payload.map(function (code, n) {
        var it = idx[code]; if (it) it.seq = n + 1; return it;
      }).filter(Boolean);
    } else if (override.action === 'remove') {
      plan.items = plan.items.filter(function (i) { return i.storeCode !== override.payload; });
      plan.items.forEach(function (i, n) { i.seq = n + 1; });
    } else if (override.action === 'add' && override.payload) {
      override.payload.seq = plan.items.length + 1;
      plan.items.push(override.payload);
    }
    rec.to = plan.items.map(function (i) { return i.storeCode; });
    plan.humanOverride.push(rec);
    assertNoAttendance(plan);
    return plan;
  }

  // 铁律1 硬护栏:任何禁字段出现即抛错(防有人后来悄悄塞考勤态)
  function assertNoAttendance(plan) {
    var bad = Dict.FORBIDDEN_OUTPUT_FIELDS;
    function scan(o, path) {
      if (!o || typeof o !== 'object') return;
      Object.keys(o).forEach(function (k) {
        if (bad.indexOf(k) >= 0) throw new Error('铁律1违反:输出含考勤/完成字段 "' + path + k + '" — 拜访规划不当打卡');
        scan(o[k], path + k + '.');
      });
    }
    scan(plan, '');
    return true;
  }

  var api = {
    planForPerson: planForPerson, applyOverride: applyOverride,
    dueState: dueState, classify: classify, allocate: allocate,
    assertNoAttendance: assertNoAttendance
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.VisitPlanner = api;
})(typeof window !== 'undefined' ? window : this);
