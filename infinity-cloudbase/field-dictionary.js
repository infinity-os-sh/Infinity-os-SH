/* ============================================================================
 * INFINITY OS · 字段字典 v1.1 · 单一真相源 (浏览器/Node 双用·无构建步骤)
 * ----------------------------------------------------------------------------
 * 以本文件为运行时准。两类命名,泾渭分明:
 *   ① 主数据(门店/用户/拜访/SKU)= 用 SFA_Backend_v4 真名,不另造平行名。
 *      → 见 MASTER。命名约定:SFA camelCase(storeCode/visitCycleT/latitude/role/visitDate)。
 *   ② 节点新产的分析概念 = 用设计名(SFA 里没有)。
 *      → 见 CONCEPTS。命名约定:设计 snake_case(effective_stage/oos_flag/source_ref/ts...)。
 *
 * 铁律:字段名全照本字典、不准新造 → 改名只改这一处(+ 对应 schema)。
 * 每个字段都标 provenance:'sfa'(来自SFA) 或 'design'(新概念)。
 *
 * v1.1 变更:升级为单一真相源;锁定用户下发的新概念批次;主数据改用 SFA 真名。
 * ========================================================================== */
(function (root) {
  'use strict';

  // ══════════════════════════════════════════════════════════════════════════
  // ① MASTER · 主数据字段 = SFA 真名 (provenance:'sfa' · 不另造平行名)
  //    来源:SFA_Backend_v4 entity 定义。这些是"已有的表",照搬真名。
  // ══════════════════════════════════════════════════════════════════════════
  var MASTER = {
    store: { // 门店档案 L0-04 = stores 表
      code: 'storeCode', name: 'storeName', type: 'storeType',
      grade: 'grade',            // 运营分级 A/B/C (≠ strategic_tier,见 CONCEPTS)
      cycleT: 'visitCycleT',     // 拜访周期T(天)
      district: 'district', city: 'city', address: 'address',
      lat: 'latitude', lng: 'longitude', geoRadius: 'gpsRadiusM', active: 'isActive'
    },
    user: { // 组织主数据(人/岗位) = users 表
      code: 'userCode', name: 'userName', role: 'role', district: 'district',
      phone: 'phone', cbScore: 'cbScore', aiqlScore: 'aiqlScore'
    },
    visit: { // 拜访历史 = visit_reports 表
      code: 'visitCode', store: 'store', user: 'user', visitDate: 'visitDate'
      // ⚠ visit_reports 自带 checkinValid/status/positionsDone 是 SFA 执行模型;
      //   规划/盘点节点只读 visitDate,不消费也不产出这些执行/考勤态(铁律1+4)。
    },
    sku: { // SKU 主数据 = skus 表
      code: 'skuCode', name: 'skuName', brand: 'brand', spec: 'spec',
      gradeYear: 'gradeYear', gradeCoef: 'gradeCoef'
    }
  };

  // ══════════════════════════════════════════════════════════════════════════
  // ② CONCEPTS · 节点新产的分析概念 = 设计名 (provenance:'design' · SFA里没有)
  //    用户 v1.1 下发批次。def=定义, owner=哪层产出, guard=护栏。
  // ══════════════════════════════════════════════════════════════════════════
  var CONCEPTS = {
    effective_stage: { zh: '生命周期阶段', enum: ['导入', '成长', '成熟', '衰退'],
      def: '该评分用的生命周期门(卡②/L2)。是"评分的尺子本身"。', owner: 'L2门', provenance: 'design' },
    oos_flag: { zh: '缺货标记', type: 'boolean',
      def: '缺货 = !有货。ON(true)=断货/无货。与 app『有货』开关语义相反。', provenance: 'design' },
    sellthrough_rate: { zh: '动销率', type: 'number', range: [0, 1],
      def: '数值型动销率(POS算)。⚠ 区别于 sellout(布尔开关:有无动销),不可混。', owner: '地基/POS', provenance: 'design' },
    sellthrough_grade: { zh: '动销分级', type: 'string',
      def: 'sellthrough_rate 的分级。', provenance: 'design' },
    range: { zh: '区间', type: 'object', shape: { low: 'number', high: 'number' },
      def: '区间非单点。估算/阈值用 {low,high} 表达,不强压成单值。', provenance: 'design' },
    source_ref: { zh: '来源引用', type: 'object', shape: { source: 'string', submission_id: 'string', raw_ref: 'string', app: 'string' },
      def: '审计链:每条数据指回原始来源。', provenance: 'design' },
    ts: { zh: '时间戳', type: 'string', format: 'date-time',
      def: '记录/观察时间·ISO8601。审计必带。', provenance: 'design' },
    unknown: { zh: '未知(采过但拿不准)', sentinel: 'unknown',
      def: '采集过、但当时判不准/AI低置信。≠ no_data。', provenance: 'design' },
    no_data: { zh: '无数据(从未采集)', sentinel: 'no_data',
      def: '从未采集/无记录。≠ unknown。两者绝不可混(混了会把"没去过"误当"去过但没看清")。', provenance: 'design' },
    human_override: { zh: '人工干预留痕', type: 'array', shape: { by: 'string', from: 'any', to: 'any', why: 'string', at: 'date-time' },
      def: '经理/人对机器输出的调整留痕(by/原/新/why/at)。机器不锁死。', provenance: 'design' },
    lifeforce_grade: { zh: '生命力分级', type: 'string',
      def: 'SKU/节点生命力分级。', owner: '地基③', guard: '⚠ 只地基③可产出;盘点/拜访规划等节点不得计算或写此字段。', provenance: 'design' },
    strategic_tier: { zh: '战略层级', type: 'string',
      def: '战略层级分类(战略地位)。⚠ ≠ store.grade(运营A/B/C),不可混用。', owner: '战略/品牌AI顾问', provenance: 'design' }
  };

  // 哨兵值(unknown / no_data 不可混)
  var SENTINEL = { UNKNOWN: 'unknown', NO_DATA: 'no_data' };
  function isUnknown(v) { return v === SENTINEL.UNKNOWN; }
  function isNoData(v) { return v === SENTINEL.NO_DATA || v == null; }
  // 区间构造(区间非单点)
  function range(low, high) { return { low: low, high: high }; }


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

  var LIFECYCLE_STAGES = CONCEPTS.effective_stage.enum; // 单一来源:effective_stage 枚举

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

  var api = {
    VERSION: 'field-dictionary v1.1',
    // ① 主数据(SFA真名) ② 新概念(设计名) —— 单一真相源
    MASTER: MASTER,
    CONCEPTS: CONCEPTS,
    SENTINEL: SENTINEL,
    isUnknown: isUnknown,
    isNoData: isNoData,
    range: range,
    // 盘点表(第一回路)机具
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
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.InfinityDict = api;
})(typeof window !== 'undefined' ? window : this);
