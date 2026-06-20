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
  // ⚑ 主数据命名冲突(待拍):SFA_Backend_v4(实现) vs L0-04 SKILL(真相源 spec) 同义异名。
  //   用户规则"主数据→SFA真名为准"已给裁决向;但下游 L1-03/L1-04 引用的是 L0-04 名(store_id/
  //   store_grade/M/gps)。下表 sfa↔l0_04 映射保留,等你确认 SFA-wins(则下游读时需映射)。
  // C1 裁定(2026-06-20):门店主数据以 L0-04 真相源为准(snake_case),不用 SFA 名。
  //   新后端 = CloudBase greenfield,下游节点(L1-03/L1-04…)都用 L0-04 名。
  //   SFA 名只在"从 SFA 导数据"边界做一次映射(见 MASTER_MAP_SFA),不当标准名。
  var MASTER = {
    store: { // 门店档案 = L0-04 真相源(C1)
      code: 'store_id',            // 终身不变唯一码(ST-SH-00420);版本变更不换号
      name: 'store_name', type: 'channel_type',
      grade: 'store_grade',        // 运营分级 A/B/C (≠ strategic_tier)
      cycleM: 'M',                 // 巡店节奏·静默天数(按 store_grade 派生·L0-07 按店读)
      region: 'region', city: 'city', tradeZone: 'trade_zone',
      address: 'address', gps: 'gps',          // {lat,lng} 嵌套
      trafficTier: 'traffic_tier', status: 'status',
      effectiveFrom: 'effective_from', effectiveTo: 'effective_to', version: 'version' // SCD-2
    },
    user: { // 组织主数据(人/岗位) —— 真相源 doc 未见,暂留 SFA 名 + 标记
      _pending: '组织主数据真相源未入库;C1 只裁了门店。待该 SKILL 入库再对齐。',
      code: 'userCode', name: 'userName', role: 'role', district: 'district',
      phone: 'phone', cbScore: 'cbScore', aiqlScore: 'aiqlScore'
    },
    visit: { // 拜访历史 —— 真相源(拜访节点)未见,暂留;只读 visitDate
      _pending: '拜访历史真相源未入库;暂留。规划只读 visitDate,不碰 checkin/status 执行态。',
      visitDate: 'visitDate'
    },
    sku: { // SKU 主数据(真相源未单列,暂留)
      code: 'skuCode', name: 'skuName', brand: 'brand', spec: 'spec'
    }
  };

  // SFA → L0-04 导数据边界映射(只在 ETL 入口用一次;标准名是右列 L0-04)
  var MASTER_MAP_SFA = {
    store: {
      storeCode: 'store_id', storeName: 'store_name', storeType: 'channel_type',
      grade: 'store_grade', visitCycleT: 'M',
      latitude: 'gps.lat', longitude: 'gps.lng',
      district: 'region', // SFA 单级 → L0-04 三级 region/city/trade_zone(导入时补全)
      gpsRadiusM: '(无直接对应·建档地理容差另算)'
    }
  };

  // ══════════════════════════════════════════════════════════════════════════
  // ② CONCEPTS · 节点新产的分析概念 = 设计名 (provenance:'design' · SFA里没有)
  //    用户 v1.1 下发批次。def=定义, owner=哪层产出, guard=护栏。
  // ══════════════════════════════════════════════════════════════════════════
  var CONCEPTS = {
    effective_stage: { zh: '生命周期阶段', enum: ['导入', '成长', '成熟', '衰退', '焕新', '淘汰'],
      def: '生命周期门·"评分的尺子本身"。stage=unknown 时不判级(stage_unknown_no_grading),绝不拿默认阶段顶替。',
      owner: '地基①(FOUNDATION-1)·L1-03/L1-04/地基③只读不重判', provenance: 'design',
      _v11_change: '原只列4值;按 L1-03/L1-04/FOUNDATION-3 实证补 焕新/淘汰(unknown 为哨兵,不入枚举)' },
    oos_flag: { zh: '缺货标记', type: 'boolean',
      def: '缺货 = !有货。ON(true)=断货/无货。与 app『有货』开关语义相反。L1-03 以"在售/oos证据"判铺货,口径一致。', provenance: 'design' },
    sellthrough_rate: { zh: '动销率', type: 'number', range: [0, 1],
      def: '= moving ÷ pairable_selling(pool口径)。事实·与阶段无关。⚠ ≠ sellout(布尔开关:有无动销)。',
      owner: 'L1-03', provenance: 'design', _confirmed: 'L1-03 §C5 实证一致' },
    sellthrough_grade: { zh: '动销判级', enum: ['达标', '未达标', '未判级'],
      def: '动销率按 effective_stage 阶段表判级的结果(未判级=unknown或淘汰期)。',
      owner: 'L1-03', provenance: 'design', _confirmed: 'L1-03 v0.3 实证一致',
      related: 'grading_stage = 判级所用阶段(=effective_stage,溯源用)' },
    grading_stage: { zh: '判级所用阶段', type: 'string',
      def: '判 sellthrough_grade 时所用的 effective_stage·溯源用。', owner: 'L1-03', provenance: 'design' },
    range: { zh: '区间', type: 'object', shape: { low: 'number', high: 'number' },
      def: '区间非单点。估算/阈值用 {low,high} 表达,不强压成单值。', provenance: 'design' },
    source_ref: { zh: '来源引用', type: 'object', shape: { source: 'string', submission_id: 'string', raw_ref: 'string', app: 'string' },
      def: '审计链:每条数据指回原始来源。', provenance: 'design' },
    ts: { zh: '时间戳', type: 'string', format: 'date-time',
      def: '记录/观察时间·ISO8601。审计必带。', provenance: 'design' },
    unknown: { zh: '未知(采过但拿不准)', sentinel: 'unknown',
      def: '采集过、但当时判不准/AI低置信。≠ no_data。L1-03 stage=unknown 照算事实但不判级。', provenance: 'design' },
    no_data: { zh: '无数据(从未采集)', sentinel: 'no_data',
      def: '从未采集/无记录。≠ unknown。L1-03 no_data "双不进"(不进分子分母);L1-04 数据盲点。两者绝不可混。', provenance: 'design' },
    human_override: { zh: '人工干预留痕', type: 'array', shape: { by: 'string', from: 'any', to: 'any', why: 'string', at: 'date-time' },
      def: '经理/人对机器输出的调整留痕(by/原/新/why/at)。机器不锁死。', provenance: 'design' },
    vitality: { zh: '生命力(五级)', type: 'object',
      shape: { level: 'S/A/B/C/D', prev_level: 'string', lift: 'number(净提升=level-prev_level)', attributed: 'number(归因于人的部分)' },
      def: 'SKU 生命力五级。救活濒死(D→B)的 lift 远大于维持成熟。',
      owner: '地基③(FOUNDATION-3)', guard: '⚠ 只地基③可产出;盘点/拜访规划等节点不得计算或写。', provenance: 'design',
      _resolved: 'C2(2026-06-20 用户裁定):取代 lifeforce_grade,用 FOUNDATION-3 真名 vitality.level' },
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

  // ⚑ 交叉复核冲突清单——4 条已由用户拍定(2026-06-20)。
  var CONFLICTS = [
    { id: 'C1-store-master-naming', status: 'RESOLVED',
      ruling: '门店主数据以 L0-04 为准(store_id/store_grade/gps/M/region);SFA 名只在导数据边界映射一次(MASTER_MAP_SFA)。MASTER.store 已改。' },
    { id: 'C2-lifeforce-name', status: 'RESOLVED',
      ruling: '用 vitality.level(S/A/B/C/D),弃 lifeforce_grade。CONCEPTS.vitality 已替换。' },
    { id: 'C3-effective_stage-enum', status: 'RESOLVED',
      ruling: '保留六阶段 导入/成长/成熟/衰退/焕新/淘汰(匹配地基①)+ unknown 哨兵。' },
    { id: 'C4-blindspot-consume', status: 'RESOLVED',
      ruling: '盲点按有无 store_id 切:有(未铺/数据)进拜访规划救火池;白区(无store_id)不进,走 L5-02/经理。引擎已据此调整(fireStoreSetFromBlindspots)。' }
  ];

  var api = {
    VERSION: 'field-dictionary v1.1 (+L1-04/L0-04/L1-03/F-3 复核·C1-C4 已裁)',
    CONFLICTS: CONFLICTS,
    // ① 主数据(L0-04真相源名) ② 新概念(设计名) —— 单一真相源
    MASTER: MASTER,
    MASTER_MAP_SFA: MASTER_MAP_SFA,
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
