/* ============================================================================
 * INFINITY OS · 拜访规划/路线编排 · 规则引擎 (SCAFFOLD · 纯函数 · 未上线)
 * ----------------------------------------------------------------------------
 * 字段名照 字段字典 v1.1(C1-C4 已裁):门店主数据=L0-04真名(store_id/store_grade/M/gps);
 *   节点新概念=设计名(plan_date/reason_code/...);跨域概念=锁定名(ts/source_ref/human_override)。
 *
 * 职责(只排程):读 门店档案(L0-04) / coverage_blindspot / org_capacity / visit_history(visitDate)
 *   → 产出"每人每日拜访清单+路线"。不采集/不判级/不算战功/不回写状态(铁律4)。
 *
 * C4 裁定:救火池只纳"有 store_id 的盲点"(未铺/数据);白区(无store_id)不进,走 L5-02/经理。
 *   调用方用 VisitDict.fireStoreSetFromBlindspots(L1-04输出) 构造 blindspotSet。
 *
 * 铁律落实:见 README 铁律落实表。三命门:
 *   · 助手非鞭子 → assertNoAttendance() 硬拦考勤字段(铁律1)
 *   · 配额保底  → allocate() 常规保底先占,救火有上限吃不掉保底(铁律2)
 *   · 不漏常规  → 缺分级 resolveCycle 兜底+tier_pending,常规店不被系统性挤掉(铁律3)
 * ⚠ 待《bas_visit_planning_skill_v0_1.md》98分定稿入库后,按它正式复核本引擎。
 * ========================================================================== */
(function (root) {
  'use strict';
  var Dict = (typeof require !== 'undefined') ? require('./visit-dictionary.js') : root.VisitDict;
  var SF = Dict.STORE_FIELDS, D = Dict.D003;

  function dayDiff(a, b) { // 天数差(b - a)
    var ms = (new Date(b)).setHours(0,0,0,0) - (new Date(a)).setHours(0,0,0,0);
    return Math.round(ms / 86400000);
  }

  // 应访状态。lastVisitDate=null → no_data(从未访)·按盲点/逾期处理(no_data ≠ unknown)
  function dueState(store, lastVisitDate, today) {
    var cyc = Dict.resolveCycle(store);
    var days_since_last = lastVisitDate ? dayDiff(lastVisitDate, today) : null;
    var overdue_days = (days_since_last == null) ? cyc.cycle_t : (days_since_last - cyc.cycle_t);
    return {
      cycle_t: cyc.cycle_t, grade: cyc.grade, tier_pending: cyc.tier_pending,
      days_since_last: days_since_last, overdue_days: overdue_days,
      due: (days_since_last == null) || (days_since_last >= cyc.cycle_t)
    };
  }

  // 归池:盲点 或 逾期 → fire;到期未逾期 → baseline(铁律2两块)
  function classify(store, ds, blindspotSet) {
    var isBlind = blindspotSet && blindspotSet.has(store[SF.code]);
    if (isBlind) return { pool: 'fire', reason_code: 'blindspot' };
    if (ds.overdue_days > 0) return { pool: 'fire', reason_code: 'overdue' };
    if (ds.due) return { pool: 'baseline', reason_code: 'regular' };
    return null; // 未到期 → 今日不排
  }

  // 路线排序:从出发基地最近邻(scaffold)。无 geo 保持原序。
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
   * person: { userCode, capacity_daily?, home:{lat,lng} }
   * candidates: [{ store(=stores行), lastVisitDate }]
   * blindspotSet: Set<store_id>  (C4:只含有 store_id 的盲点·见 VisitDict.fireStoreSetFromBlindspots)
   * today: ISO date
   */
  function planForPerson(person, candidates, blindspotSet, today) {
    var flags = ['D003_pending'];
    var capacity = person.capacity_daily;
    if (capacity == null) { capacity = D.CAPACITY_DAILY_DEFAULT; flags.push('capacity_default'); }

    var fire = [], baseline = [];
    candidates.forEach(function (c) {
      var ds = dueState(c.store, c.lastVisitDate, today);
      var cl = classify(c.store, ds, blindspotSet);
      if (!cl) return;
      var item = buildItem(c.store, ds, cl);
      if (item.tier_pending && flags.indexOf('tier_pending') < 0) flags.push('tier_pending');
      (cl.pool === 'fire' ? fire : baseline).push(item);
    });

    fire.sort(function (a, b) {
      var ab = (a.reason_code === 'blindspot') ? 1 : 0, bb = (b.reason_code === 'blindspot') ? 1 : 0;
      return (bb - ab) || (b.overdue_days - a.overdue_days);
    });
    baseline.sort(function (a, b) { return ratio(b) - ratio(a); });

    var sel = allocate(fire, baseline, capacity);
    var ordered = orderRoute(sel.items, person.home);
    ordered.forEach(function (it) { delete it._geo; });

    var plan = {
      plan_id: (person.userCode || 'U') + '_' + today,
      plan_date: today,
      userCode: person.userCode,
      items: ordered,
      quota: {
        capacity_daily: capacity,
        baseline_reserved: sel.baseline_reserved,
        fire_cap: sel.fire_cap,
        used_fire: sel.used_fire,
        used_baseline: sel.used_baseline
      },
      human_override: [],
      ts: new Date().toISOString(),
      source_ref: { source: 'visit_planner_scaffold', app: 'visit-planning' },
      flags: flags
    };
    assertNoAttendance(plan); // 铁律1 硬校验
    return plan;
  }

  function ratio(it) { return it.cycle_t ? (it.days_since_last == null ? 99 : it.days_since_last / it.cycle_t) : 1; }

  function buildItem(store, ds, cl) {
    var gps = store[SF.gps] || null;             // L0-04 gps:{lat,lng} 嵌套
    return {
      store_id: store[SF.code], store_name: store[SF.name],
      pool: cl.pool, reason_code: cl.reason_code,
      store_grade: ds.grade, tier_pending: ds.tier_pending,
      cycle_t: ds.cycle_t, days_since_last: ds.days_since_last, overdue_days: ds.overdue_days,
      _geo: (gps && gps.lat != null) ? { lat: +gps.lat, lng: +gps.lng } : null
      // 绝不含 visited/checkin/completion(铁律1)
    };
  }

  /**
   * 配额分配(铁律2核心):
   *   baseline_reserved = ceil(capacity * BASELINE_RESERVE_RATIO)  常规保底,救火吃不掉
   *   fire_cap          = floor(capacity * FIRE_CAP_RATIO)         救火上限
   * 先占常规保底,再放救火(≤fire_cap),最后剩余产能补位(救火优先,因更紧急)。
   */
  function allocate(fire, baseline, capacity) {
    var baseline_reserved = Math.min(baseline.length, Math.ceil(capacity * D.BASELINE_RESERVE_RATIO));
    var fire_cap = Math.floor(capacity * D.FIRE_CAP_RATIO);

    var baseTaken = baseline.slice(0, baseline_reserved);            // ① 常规保底先占
    var fireRoom = Math.min(fire_cap, capacity - baseTaken.length);  // ② 救火不超上限且不挤保底
    var fireTaken = fire.slice(0, Math.max(0, fireRoom));
    var remain = capacity - baseTaken.length - fireTaken.length;     // ③ 剩余补位
    if (remain > 0) {
      var moreFire = fire.slice(fireTaken.length, fireTaken.length + remain);
      fireTaken = fireTaken.concat(moreFire); remain -= moreFire.length;
    }
    if (remain > 0) baseTaken = baseTaken.concat(baseline.slice(baseTaken.length, baseTaken.length + remain));

    return {
      items: fireTaken.concat(baseTaken),
      baseline_reserved: baseline_reserved, fire_cap: fire_cap,
      used_fire: fireTaken.length, used_baseline: baseTaken.length
    };
  }

  // 经理改路线 → 留痕,机器不锁死(铁律5)·字段照字典 human_override{by,from,to,why,at}
  function applyOverride(plan, override) {
    var rec = {
      by: override.by, why: override.why || null,
      at: override.at || new Date().toISOString(),
      from: plan.items.map(function (i) { return i.store_id; }), to: null
    };
    if (override.action === 'reorder' && Array.isArray(override.payload)) {
      var idx = {}; plan.items.forEach(function (i) { idx[i.store_id] = i; });
      plan.items = override.payload.map(function (code, n) { var it = idx[code]; if (it) it.seq = n + 1; return it; }).filter(Boolean);
    } else if (override.action === 'remove') {
      plan.items = plan.items.filter(function (i) { return i.store_id !== override.payload; });
      plan.items.forEach(function (i, n) { i.seq = n + 1; });
    } else if (override.action === 'add' && override.payload) {
      override.payload.seq = plan.items.length + 1; plan.items.push(override.payload);
    }
    rec.to = plan.items.map(function (i) { return i.store_id; });
    plan.human_override.push(rec);
    assertNoAttendance(plan);
    return plan;
  }

  // 铁律1 硬护栏:任何禁字段出现即抛错
  function assertNoAttendance(plan) {
    var bad = Dict.FORBIDDEN_OUTPUT_FIELDS;
    (function scan(o, path) {
      if (!o || typeof o !== 'object') return;
      Object.keys(o).forEach(function (k) {
        if (bad.indexOf(k) >= 0) throw new Error('铁律1违反:输出含考勤/完成字段 "' + path + k + '" — 拜访规划不当打卡');
        scan(o[k], path + k + '.');
      });
    })(plan, '');
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
