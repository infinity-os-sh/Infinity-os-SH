/* ============================================================================
 * INFINITY OS · 拜访规划 → XM(今日任务) 推送适配器 (SCAFFOLD · 未上线)
 * ----------------------------------------------------------------------------
 * ③ 今日清单怎么进 DSR/美顾/督导 app 的 XM(今日任务)数据源。
 *
 * 方向(单向·只读投影):visit_plan ──projection──▶ XM 任务卡。
 *   planner 只供给"排谁去哪、第几站、为什么";XM 卡里没有完成/打卡态(铁律1)。
 *   app 端的 XD(采集)在拜访时另采状态 —— planner 不回读、不汇总(铁律4)。
 *
 * 怎么落到 app:不改 app 写死,沿用第一回路的"拉数据合并"增量模式——
 *   app 的 XM(今日任务)启动时 fetch 本人当日 visit_plan → 渲染任务卡。
 *   未配 CloudBase 环境ID 时走 mock(与 cloudbase-client 同款双轨)。
 * ========================================================================== */
(function (root) {
  'use strict';
  var Dict = (typeof require !== 'undefined') ? require('./visit-dictionary.js') : root.VisitDict;

  // visit_plan → XM 任务卡数组(纯投影,无副作用)
  function planToXM(plan) {
    if (!plan || !plan.items) return [];
    return plan.items.map(function (it) {
      return {
        taskId: (plan.userCode || 'U') + '_' + plan.planDate + '_' + it.seq, // 稳定可幂等
        taskType: 'visit',
        seq: it.seq,
        storeCode: it.storeCode,
        storeName: it.storeName,
        // 给一线"为什么排你来"的可解释信号(非考核):
        reasonCode: it.reasonCode,            // blindspot | overdue | regular
        pool: it.pool,                        // fire | baseline
        tier: it.tier, tierPending: it.tierPending,
        cycleT: it.cycleT, overdueDays: it.overdueDays,
        planDate: plan.planDate,
        flags: plan.flags
        // ✗ 不含 done/checked_in/completion/progress —— XM 只显示"今天去哪",不显示考勤
      };
    });
  }

  /**
   * app XM 启动时调:取本人当日清单 → XM 卡。
   * cb: 可传入第一回路的 InfinityCB(真接);未传或 mock 时用本地/种子。
   * 返回 Promise<XM[]>。
   */
  function fetchTodayXM(opts) {
    opts = opts || {};
    var userCode = opts.userCode, planDate = opts.planDate || new Date().toISOString().slice(0, 10);
    var cb = opts.cb || root.InfinityCB;
    var coll = Dict.COLLECTIONS.plan;

    // 真接:从 visit_plan 集合查本人当日 plan
    if (cb && cb.mode && cb.mode() === 'real' && cb._db) {
      return cb._db.collection(coll)
        .where({ userCode: userCode, planDate: planDate })
        .limit(1).get().then(function (r) { return planToXM((r.data || [])[0]); });
    }
    // 双轨·mock:用传入的 plan 或本地缓存(scaffold 阶段离线可演示)
    var plan = opts.plan || readMock(userCode, planDate);
    return Promise.resolve(planToXM(plan));
  }

  function readMock(userCode, planDate) {
    try {
      var raw = (typeof localStorage !== 'undefined') && localStorage.getItem('vp_mock_plan_' + userCode + '_' + planDate);
      if (raw) return JSON.parse(raw);
    } catch (e) {}
    return null;
  }
  function writeMock(plan) {
    try {
      if (typeof localStorage !== 'undefined')
        localStorage.setItem('vp_mock_plan_' + plan.userCode + '_' + plan.planDate, JSON.stringify(plan));
    } catch (e) {}
  }

  var api = { planToXM: planToXM, fetchTodayXM: fetchTodayXM, writeMock: writeMock };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.VisitXM = api;
})(typeof window !== 'undefined' ? window : this);
