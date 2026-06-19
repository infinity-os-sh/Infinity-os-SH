/* ============================================================================
 * INFINITY OS · 字段字典 单一事实源 (浏览器全局·无构建步骤)
 * ----------------------------------------------------------------------------
 * 盘点表(inventory_snapshot)字段名 + app内6开关 ↔ 字典字段 映射。
 * 铁律:字段名全照字典、不准新造 → 改名只改这一处 + inventory_snapshot.schema.json。
 *
 * ⚠ 缺口:《字段字典v1.0》原件未入库。on_shelf/oos_flag/display_rate 为任务明确点名;
 *   sellout/repurchase/margin 为对齐 04_l0_to_l1 的推断默认,待字典锁定。
 * ========================================================================== */
(function (root) {
  'use strict';

  // app 内 6 开关顺序 (ica-v35 SW_KEYS) ↔ 字典字段名
  // invert:true 表示 app开关ON ⇒ 字典字段false (语义反向)
  var SWITCH_MAP = [
    { app: '上架', field: 'on_shelf',     invert: false, named: true  },
    { app: '有货', field: 'oos_flag',     invert: true,  named: true  }, // 有货ON ⇒ oos_flag=false
    { app: '陈列', field: 'display_rate',  invert: false, named: true  },
    { app: '动销', field: 'sellout',      invert: false, named: false }, // 推断默认
    { app: '复购', field: 'repurchase',   invert: false, named: false }, // 推断默认
    { app: '毛利', field: 'margin',       invert: false, named: false }  // 推断默认
  ];

  var SWITCH_FIELDS = SWITCH_MAP.map(function (m) { return m.field; });

  // 字典字段 → 中文标签 (只读汇总页展示用,展示≠存储,不是新字段)
  var FIELD_LABEL = {
    on_shelf: '上架', oos_flag: '缺货', display_rate: '陈列',
    sellout: '动销', repurchase: '复购', margin: '毛利'
  };

  var LIFECYCLE_STAGES = ['导入', '成长', '成熟', '衰退']; // effective_stage 预留枚举

  /**
   * 把 app 内 6 开关布尔数组(顺序: 上架/有货/陈列/动销/复购/毛利)
   * 转成字典 switches 对象。
   */
  function appSwitchesToDict(appBools) {
    var out = {};
    SWITCH_MAP.forEach(function (m, i) {
      var v = !!appBools[i];
      out[m.field] = m.invert ? !v : v;
    });
    return out;
  }

  /** 反向:字典 switches → app 顺序布尔数组 (供 app 渲染回填) */
  function dictSwitchesToApp(switches) {
    return SWITCH_MAP.map(function (m) {
      var v = !!switches[m.field];
      return m.invert ? !v : v;
    });
  }

  /** 生成审计用 submission_id: SUB_YYYYMMDDHHMMSS_RANDOM6 */
  function newSubmissionId(d) {
    d = d || new Date();
    function p(n, w) { return String(n).padStart(w || 2, '0'); }
    var ts = '' + d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) +
             p(d.getHours()) + p(d.getMinutes()) + p(d.getSeconds());
    var rnd = '';
    var chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    for (var i = 0; i < 6; i++) rnd += chars[Math.floor(Math.random() * chars.length)];
    return 'SUB_' + ts + '_' + rnd;
  }

  /**
   * 组装一条合规盘点记录 (带 source_ref + ts,可审计)。
   * 不做任何涉钱涉权动作 —— 只产出数据快照。
   */
  function buildSnapshot(opts) {
    return {
      sku: opts.sku,
      scope: { store: opts.store },
      switches: opts.switches, // 已是字典对象
      ts: opts.ts || new Date().toISOString(),
      source_ref: {
        source: opts.source || 'sales_rep_input',
        submission_id: opts.submission_id || newSubmissionId(),
        raw_ref: opts.raw_ref || null,
        app: opts.app || null
      },
      reporter: opts.reporter || { user_id: 'unknown', role: 'ICA' },
      effective_stage: (opts.effective_stage === undefined ? null : opts.effective_stage)
    };
  }

  // ── 双轨 mock 种子 (原则4:真接前用模拟,接入后可对比) ──
  // 某店某SKU 哪些开关 ON/OFF —— 供只读汇总页/离线演示。
  var MOCK_SEED = [
    snap('SH_GT_CVS_001', '6MX-TJ-380', [true,  true,  true,  true,  true,  true ], '成熟', 'MG-0420', '赵美玲'),
    snap('SH_GT_CVS_001', '6MX-QY-500', [true,  true,  false, true,  false, true ], '成长', 'MG-0420', '赵美玲'),
    snap('SH_GT_CVS_001', '6MX-JDX',    [true,  false, true,  false, false, false], '成长', 'MG-0420', '赵美玲'),
    snap('SH_GT_CVS_002', '6MX-TJ-380', [true,  true,  true,  true,  true,  true ], '成熟', 'MG-0511', '王小芳'),
    snap('SH_GT_CVS_002', '6MX-QY-500', [false, false, false, false, false, false], '导入', 'MG-0511', '王小芳'),
    snap('SH_GT_CVS_002', '6MX-JDX',    [true,  true,  true,  true,  false, true ], '成熟', 'MG-0511', '王小芳')
  ];

  function snap(store, sku, appBools, stage, uid, name) {
    return buildSnapshot({
      sku: sku, store: store,
      switches: appSwitchesToDict(appBools),
      effective_stage: stage,
      source: 'mock_seed',
      app: 'mock',
      reporter: { user_id: uid, role: 'ICA', name: name }
    });
  }

  root.InfinityDict = {
    SWITCH_MAP: SWITCH_MAP,
    SWITCH_FIELDS: SWITCH_FIELDS,
    FIELD_LABEL: FIELD_LABEL,
    LIFECYCLE_STAGES: LIFECYCLE_STAGES,
    COLLECTION: 'inventory_snapshot',
    appSwitchesToDict: appSwitchesToDict,
    dictSwitchesToApp: dictSwitchesToApp,
    newSubmissionId: newSubmissionId,
    buildSnapshot: buildSnapshot,
    MOCK_SEED: MOCK_SEED
  };
})(typeof window !== 'undefined' ? window : this);
