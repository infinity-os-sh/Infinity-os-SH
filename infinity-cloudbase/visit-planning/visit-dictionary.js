/* ============================================================================
 * INFINITY OS · 拜访规划/路线编排 · 字段+政策 单一事实源 (浏览器/Node 双用)
 * ----------------------------------------------------------------------------
 * ⚠ SCAFFOLD · 未上线 · 字段名待《bas_field_dictionary_v1_0》锁定
 *   两份权威文档(visit_planning_skill 98分定稿 / field_dictionary v1.0)未入库,
 *   故:已存在的 SFA 表(stores/users/visit_reports)沿用其真实字段名(camelCase);
 *       新字段统一标 *_pending_dict,改名只改这一处。
 *
 * ⚠ D-003 未定 · 下列政策数字全是占位默认 · 标 D003_pending · 绝不当"已定"用。
 *
 * 铁律对照(照 SKILL.md):见 README.md 的"铁律落实表"。
 * ========================================================================== */
(function (root) {
  'use strict';

  // ── 已存在表的字段名(SFA_Backend_v4 实体·只读·不改名,改了断后端)──────────
  var STORE_FIELDS = {            // 门店档案 L0-04 = stores 表
    code: 'storeCode', name: 'storeName', type: 'storeType',
    grade: 'grade',               // 分级 A/B/C
    cycleT: 'visitCycleT',        // 拜访周期T(天)·门店级,优先于按分级默认
    district: 'district', city: 'city',
    lat: 'latitude', lng: 'longitude', geoRadius: 'gpsRadiusM'
  };
  var ORG_FIELDS = {              // 组织主数据 = users 表(人/岗位);产能=新字段,见下
    code: 'userCode', name: 'userName', role: 'role', district: 'district'
  };
  var HISTORY_FIELDS = {         // 拜访历史 = visit_reports 表
    store: 'store', user: 'user', visitDate: 'visitDate'  // 上次访期取 MAX(visitDate)
  };

  // ── 新表/新字段(PROPOSED · 待字典锁定 · 全部 *_pending_dict)──────────────
  // 命名约定:跟随 SFA camelCase(与拜访域同构)。字典定稿后一处改名。
  var PROPOSED = {
    // 覆盖盲点 L1-04 (新表 coverage_blindspot)
    blindspot: {
      storeCode: 'storeCode',
      isBlindspot: 'isBlindspot_pending_dict',     // 是否盲点(系统性失访/从未覆盖)
      blindReason: 'blindReason_pending_dict',     // 盲点成因(never_visited/coverage_gap/...)
      detectedAt: 'detectedAt_pending_dict'
    },
    // 组织产能扩展 (新表 org_capacity,或 users 增列)
    capacity: {
      userCode: 'userCode',
      capacityDaily: 'capacityDaily_pending_dict', // 人均日产能上限(可访店数)
      homeLat: 'homeLat_pending_dict',             // 路线起点(出发基地)
      homeLng: 'homeLng_pending_dict'
    },
    // 排程输出 (新表 visit_plan) —— 铁律1:物理上不含 visited/checked_in/who_missed/completion
    plan: {
      planId: 'planId_pending_dict',
      planDate: 'planDate_pending_dict',           // 该清单的日期 YYYY-MM-DD
      userCode: 'userCode',
      items: 'items_pending_dict',                 // 见 plan_item
      quota: 'quota_pending_dict',                 // {capacityDaily, baselineReserved, fireCap, used} 审计配额
      humanOverride: 'humanOverride_pending_dict', // 留痕数组,见 OVERRIDE_FIELDS
      generatedAt: 'generatedAt_pending_dict',
      source_ref: 'source_ref',                    // 复用第一回路审计契约
      flags: 'flags_pending_dict'                  // 如 ['D003_pending','tier_pending','capacity_default']
    },
    // 排程项 plan_item —— 只描述"排谁去哪、为什么、第几站",不含任何完成/考勤态
    planItem: {
      storeCode: 'storeCode', storeName: 'storeName',
      seq: 'seq_pending_dict',                     // 路线顺序(从1)
      pool: 'pool_pending_dict',                   // 'fire' | 'baseline'
      reasonCode: 'reasonCode_pending_dict',       // 'blindspot' | 'overdue' | 'regular'
      tier: 'tier_pending_dict',                   // A/B/C 或 null
      tierPending: 'tierPending_pending_dict',     // true=分级缺,按默认频率排(铁律3)
      cycleT: 'cycleT_pending_dict',               // 采用的周期T(天)
      daysSinceLast: 'daysSinceLast_pending_dict',
      overdueDays: 'overdueDays_pending_dict'      // <=0 表示未逾期
    }
  };

  // human_override 留痕(铁律5):by/原/新/why/at
  var OVERRIDE_FIELDS = { by: 'by', from: 'from', to: 'to', why: 'why', at: 'at' };

  // ── D-003 占位政策(全部 D003_pending,管理层定了再替换)────────────────────
  var D003 = {
    _status: 'D003_pending',
    // 分级频率(天):A周/B双周/C月 —— 占位默认
    TIER_DEFAULT_CYCLE: { A: 7, B: 14, C: 30 },
    // 门店缺分级时的兜底周期(铁律3:不漏访,标 tier_pending)
    TIER_PENDING_CYCLE: 14,
    // 人均日产能上限(可访店数)—— 占位默认
    CAPACITY_DAILY_DEFAULT: 8,
    // 配额比例:救火有上限、常规保底不被吃光(铁律2)—— 占位默认
    BASELINE_RESERVE_RATIO: 0.6,  // 常规保底:至少留这么多产能给常规店
    FIRE_CAP_RATIO: 0.4           // 救火上限:最多这么多产能给盲点+逾期
  };

  // 采用的周期 + 是否 tier_pending(门店级 cycleT 优先 > 分级默认 > 兜底)
  function resolveCycle(store) {
    var t = store[STORE_FIELDS.cycleT];
    if (t != null && t > 0) return { cycleT: t, tierPending: false, tier: store[STORE_FIELDS.grade] || null };
    var g = store[STORE_FIELDS.grade];
    if (g && D003.TIER_DEFAULT_CYCLE[g] != null)
      return { cycleT: D003.TIER_DEFAULT_CYCLE[g], tierPending: false, tier: g };
    return { cycleT: D003.TIER_PENDING_CYCLE, tierPending: true, tier: null }; // 铁律3
  }

  var api = {
    STORE_FIELDS: STORE_FIELDS, ORG_FIELDS: ORG_FIELDS, HISTORY_FIELDS: HISTORY_FIELDS,
    PROPOSED: PROPOSED, OVERRIDE_FIELDS: OVERRIDE_FIELDS, D003: D003,
    COLLECTIONS: { plan: 'visit_plan', blindspot: 'coverage_blindspot', capacity: 'org_capacity' },
    // 铁律1护栏:输出里绝不允许出现的考勤/完成态字段
    FORBIDDEN_OUTPUT_FIELDS: ['visited', 'checked_in', 'checkin', 'who_missed', 'completion', 'completed', 'done', 'status'],
    resolveCycle: resolveCycle
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.VisitDict = api;
})(typeof window !== 'undefined' ? window : this);
