/* ============================================================================
 * INFINITY OS · 拜访规划 · 字段+政策 单一事实源 (浏览器/Node 双用)
 * ----------------------------------------------------------------------------
 * 命名遵从 字段字典 v1.1(../field-dictionary.js):
 *   主数据 = SFA 真名(camelCase);节点新概念 = 设计名(snake_case);
 *   跨域概念(source_ref/ts/human_override/effective_stage...)直接用字典锁定名。
 *
 * v1.1 解析:之前 *_pending_dict 的字段——
 *   · 对得到 SFA 真名 → 改真名(storeCode/userCode/grade/visitDate)
 *   · 命中字典锁定概念 → 用锁定名(ts/source_ref/human_override)
 *   · 节点自有结构字段 → 落 snake_case 设计名(plan_date/reason_code/...)
 *   · 对不到且表未建(盲点/产能)→ 保留 *_pending_dict,等建表
 *
 * ⚠ D-003 未定 · 政策数字全是占位 · 标 D003_pending · 绝不当"已定"用。
 * ⚠ 规则引擎待《bas_visit_planning_skill_v0_1.md》(98分定稿)入库后正式复核。
 * ========================================================================== */
(function (root) {
  'use strict';

  // ── 已存在表的字段名(SFA 真名·provenance:'sfa'·照搬不改名)──────────────
  var STORE_FIELDS = {            // 门店档案 L0-04 = stores
    code: 'storeCode', name: 'storeName', type: 'storeType',
    grade: 'grade', cycleT: 'visitCycleT',
    district: 'district', city: 'city',
    lat: 'latitude', lng: 'longitude', geoRadius: 'gpsRadiusM'
  };
  var ORG_FIELDS = {              // 组织主数据 = users
    code: 'userCode', name: 'userName', role: 'role', district: 'district'
  };
  var HISTORY_FIELDS = {         // 拜访历史 = visit_reports
    store: 'store', user: 'user', visitDate: 'visitDate'
  };

  // ── 字段名注册(已解析 + 仍 pending)─────────────────────────────────────
  var FIELDS = {
    // 覆盖盲点 L1-04 (coverage_blindspot) —— pending 已用 L1-04 SKILL 真名全解锁
    // ⚑ C4 架构待裁:L1-04"只出清单不派任务/不触发L5-02";拜访规划消费它作日清救火池需经裁定。
    blindspot: {
      type: 'type',                                  // L1-04 真名(未铺/数据/白区)·原 isBlindspot/blindReason 解为此
      sku: 'sku', scope: 'scope',
      store_ids: 'store_ids',                         // L1-04 真名(对齐 L0-04 store_id)
      count: 'count', gap_count: 'gap_count',
      effective_stage: 'effective_stage',            // 字典 v1.1
      score: 'score', base_score: 'base_score',
      suggested_action: 'suggested_action',          // L1-04 真名
      ts: 'ts', source_ref: 'source_ref'             // 字典锁定
    },
    // 组织产能扩展 (org_capacity) —— 产能概念无字典项、表未建 → 保留 pending
    capacity: {
      userCode: 'userCode',                          // sfa(已解析)
      capacityDaily: 'capacityDaily_pending_dict',   // pending(产能·等建表)
      homeLat: 'homeLat_pending_dict',               // pending(产能·等建表)
      homeLng: 'homeLng_pending_dict'                // pending(产能·等建表)
    },
    // 排程输出 (visit_plan) —— 节点自有结构字段落 snake_case 设计名(已解析)
    // 铁律1:物理上不含 visited/checked_in/who_missed/completion
    plan: {
      plan_id: 'plan_id',                            // 设计名
      plan_date: 'plan_date',                        // 设计名
      userCode: 'userCode',                          // sfa
      items: 'items',
      quota: 'quota',
      human_override: 'human_override',              // 字典锁定
      ts: 'ts',                                      // 字典锁定(原 generatedAt)
      source_ref: 'source_ref',                      // 字典锁定
      flags: 'flags'
    },
    planItem: {
      storeCode: 'storeCode', storeName: 'storeName',// sfa
      seq: 'seq', pool: 'pool',
      reason_code: 'reason_code',                    // 设计名
      grade: 'grade',                                // sfa(门店运营分级 A/B/C)
      tier_pending: 'tier_pending',                  // 铁律3 术语(缺分级标记)
      cycle_t: 'cycle_t',                            // 设计名(采用周期T)
      days_since_last: 'days_since_last',            // 设计名
      overdue_days: 'overdue_days'                   // 设计名
    },
    quota: {
      capacity_daily: 'capacity_daily', baseline_reserved: 'baseline_reserved',
      fire_cap: 'fire_cap', used_fire: 'used_fire', used_baseline: 'used_baseline'
    }
  };

  // human_override 留痕字段(字典锁定:by/from/to/why/at)
  var OVERRIDE_FIELDS = { by: 'by', from: 'from', to: 'to', why: 'why', at: 'at' };

  // ── D-003 占位政策(全部 D003_pending,管理层定了再替换)────────────────────
  var D003 = {
    _status: 'D003_pending',
    TIER_DEFAULT_CYCLE: { A: 7, B: 14, C: 30 }, // 分级频率(天):A周/B双周/C月·占位
    TIER_PENDING_CYCLE: 14,                      // 缺分级兜底(铁律3)·占位
    CAPACITY_DAILY_DEFAULT: 8,                   // 人均日产能上限·占位
    BASELINE_RESERVE_RATIO: 0.6,                 // 常规保底(救火吃不掉)·占位
    FIRE_CAP_RATIO: 0.4                          // 救火上限·占位
  };

  // 采用周期 + 是否 tier_pending(门店级 cycleT > 分级默认 > 兜底)
  function resolveCycle(store) {
    var t = store[STORE_FIELDS.cycleT];
    if (t != null && t > 0) return { cycle_t: t, tier_pending: false, grade: store[STORE_FIELDS.grade] || null };
    var g = store[STORE_FIELDS.grade];
    if (g && D003.TIER_DEFAULT_CYCLE[g] != null)
      return { cycle_t: D003.TIER_DEFAULT_CYCLE[g], tier_pending: false, grade: g };
    return { cycle_t: D003.TIER_PENDING_CYCLE, tier_pending: true, grade: null }; // 铁律3
  }

  var api = {
    VERSION: 'visit-dictionary v1.1 (字段字典 v1.1 对齐)',
    STORE_FIELDS: STORE_FIELDS, ORG_FIELDS: ORG_FIELDS, HISTORY_FIELDS: HISTORY_FIELDS,
    FIELDS: FIELDS, OVERRIDE_FIELDS: OVERRIDE_FIELDS, D003: D003,
    COLLECTIONS: { plan: 'visit_plan', blindspot: 'coverage_blindspot', capacity: 'org_capacity' },
    // 铁律1护栏:输出里绝不允许出现的考勤/完成态字段
    FORBIDDEN_OUTPUT_FIELDS: ['visited', 'checked_in', 'checkin', 'who_missed', 'completion', 'completed', 'done', 'status'],
    resolveCycle: resolveCycle
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.VisitDict = api;
})(typeof window !== 'undefined' ? window : this);
