/* ============================================================================
 * INFINITY OS · SKU 状态评分 SKU Scorecard · 实现 (SCAFFOLD · 未上线)
 * ----------------------------------------------------------------------------
 * 依 SKILL_SKU_Scorecard.md(实现自《SKU 状态评分表规格 V0.1》)实现:
 *   输入(某SKU×某店×某时的实际+目标)→ 状态分(0–100→L1–5)+ 差距分解
 *   + 战术指向 + 任务种子 + 置信度 + 闸状态。它是关差引擎的 P(算差距)。
 *
 * BEA 归类 = Workflow 主体(确定性计算·公式写死),不是 Agent;判级类范式
 *   (unknown 不判→标 no_data + 降置信度,绝不拿缺数据当差)。
 *
 * 自主边界(SKILL §1⑥):只算、只建议。不改目标/评分表、不派钱、不判退场、
 *   不改权重表(人来调)。产出"差距+建议",不产出"指令"。
 *
 * 对齐 字段字典 v1.1(../field-dictionary.js):
 *   - effective_stage 阶段名沿用 ['导入','成长','成熟','衰退','焕新','淘汰'];
 *   - no_data/unknown 哨兵语义沿用(no_data ≠ 0,绝不当差);
 *   - 输出 sku_state_level = 本表 L1–L5(状态分映射),≠ FOUNDATION-3 vitality.level
 *     (S/A/B/C/D)。命名已由 C5(2026-06-21 用户裁定)消歧:弃 SKILL §3 原名
 *     vitality_level,改用字典 CONCEPTS.sku_state_level。
 * ⚠ 政策数字(权重表/封顶/L切点)= provisional 草拟,绝不当已定;flags 标 SKU_SCORE_pending。
 * ========================================================================== */
(function (root) {
  'use strict';
  var Dict = (typeof require !== 'undefined') ? safeReq('../field-dictionary.js') : root.InfinityDict;
  function safeReq(p){ try { return require(p); } catch(e){ return null; } }
  var NO_DATA = (Dict && Dict.SENTINEL && Dict.SENTINEL.NO_DATA) || 'no_data';
  function isNoData(v){ return v === NO_DATA || v == null; }

  // ── provisional 政策旋钮(SKILL §2.3/§2.4/§6)·绝不当已定 ─────────────────────
  var POLICY = {
    _status: 'SKU_SCORE_pending',               // 待业务拍板·~500样本校准
    _provenance: 'provisional草拟值·非最终·绝不用实际倒推',
    // §2.3 权重表(角色无关·仅按阶段)。买得到权重递减、动销权重递增。
    WEIGHTS: {
      '导入': { buy: 50, see: 35, sell: 15 },
      '成长': { buy: 30, see: 35, sell: 35 },
      '成熟': { buy: 25, see: 30, sell: 45 },
      '衰退': { buy: 20, see: 20, sell: 60 }
    },
    DEFAULT_STAGE: '成熟',                        // 阶段缺失/未在表→按成熟算+标 flag(不报错)
    CAP: 60,                                     // §2.4 毛利破底线→总分封顶60(最高L3)
    L_CUTS: [                                    // §2.4 L 切点·下界含
      { L: 'L5', min: 85 }, { L: 'L4', min: 70 },
      { L: 'L3', min: 55 }, { L: 'L2', min: 40 }, { L: 'L1', min: -Infinity }
    ],
    OVERSTOCK_RATIO: 1.5,                        // 铺货实际/目标 >1.5 → 疑压货·标待人工核
    CONF_PENALTY_PER_NODATA: 0.25               // 每个 no_data 维 → 置信度 -0.25
  };

  // §3 战术映射:最大缺口维 → 战术构面
  var TACTIC = {
    buy:  '补货 / 范围(L5-07)',
    see:  '货架(大卖场②③ + INF-VL)',
    sell: '促销 + 价格(★动销差常需翻因果墙·U层)'
  };
  var DIM_ZH = { buy: '买得到', see: '看得到', sell: '动销' };

  function clamp01(x){ return x > 1.0 ? 1.0 : (x < 0 ? 0 : x); }

  // 取某维达成率 r_i:显式 r(<name>) 优先(黄金例口径);否则由 actual/target 推。
  //   实际/目标 >1 → 封顶 1.0(§4 边界);任一为 no_data → 该维 nd=true(判级类:不计0)。
  function dimR(input, name) {
    if (input[name] !== undefined) {              // 显式达成率(0–1),黄金例走这条
      if (isNoData(input[name])) return { r: null, nd: true };
      return { r: clamp01(+input[name]), nd: false, over: false };
    }
    var a = input[name + '_actual'], t = input[name + '_target'];
    if (name === 'sell') { a = input.sell_r; t = input.sell_r_target; } // 动销=日销率 r=a÷T
    if (isNoData(a) || isNoData(t) || !t) return { r: null, nd: true };
    var raw = (+a) / (+t);
    return { r: Math.min(raw, 1.0), nd: false, over: raw > 1.0, raw: raw };
  }

  function mapL(score) {
    for (var i = 0; i < POLICY.L_CUTS.length; i++) if (score >= POLICY.L_CUTS[i].min) return POLICY.L_CUTS[i].L;
    return 'L1';
  }

  /* 主入口:算一个 SKU 在某店某时的状态分。输入见 SKILL §3。
   *   { sku_id, store_id, role, stage, buy|buy_actual/buy_target,
   *     see|see_actual/see_target, sell|sell_r/sell_r_target, margin_broken } */
  function scoreSku(input) {
    input = input || {};
    var flags = [POLICY._status];
    var stage = input.stage;
    var W = POLICY.WEIGHTS[stage];
    if (!W) { flags.push('stage_unknown_default_' + POLICY.DEFAULT_STAGE); W = POLICY.WEIGHTS[POLICY.DEFAULT_STAGE]; }

    var dims = ['buy', 'see', 'sell'];
    var present = [], ndDims = [], overstock = false;
    dims.forEach(function (d) {
      var x = dimR(input, d);
      if (x.nd) { ndDims.push(d); return; }
      if (d === 'buy' && x.over && x.raw >= POLICY.OVERSTOCK_RATIO) overstock = true; // §5 tracker:疑压货
      present.push({ dim: d, w: W[d], r: x.r });
    });

    // §2.2 + §2.5:权重和归一化(权重表≠100 容错 + no_data 维权重分摊给其余维,重归一)
    var wSum = present.reduce(function (s, p) { return s + p.w; }, 0);
    var score_raw = 0;
    if (wSum > 0) { present.forEach(function (p) { score_raw += p.w * p.r; }); score_raw = score_raw * 100 / wSum; }

    // §2.4 毛利闸:破底线→封顶 CAP(最高L3,永不健康)
    var broken = input.margin_broken === true;
    var capApplied = broken && score_raw > POLICY.CAP;
    var score = capApplied ? POLICY.CAP : (broken ? Math.min(score_raw, POLICY.CAP) : score_raw);
    score = Math.round(score * 100) / 100;       // 2位小数·不引浮点噪声

    // §2.2 差距分解:gap_i = w_i × (1 − r_i)(用原始权重·只在有数据维上算)
    var gap_breakdown = present.map(function (p) {
      return { dim: p.dim, dim_zh: DIM_ZH[p.dim], gap: Math.round(p.w * (1 - p.r) * 100) / 100, r: p.r, weight: p.w };
    });
    ndDims.forEach(function (d) { gap_breakdown.push({ dim: d, dim_zh: DIM_ZH[d], gap: null, r: NO_DATA, weight: W[d] }); });
    var gap_total = Math.round(gap_breakdown.reduce(function (s, g) { return s + (g.gap || 0); }, 0) * 100) / 100;
    var top = present.slice().sort(function (a, b) { return (b.w * (1 - b.r)) - (a.w * (1 - a.r)); })[0];
    var top_gap_dim = top ? top.dim : null;

    // §2.5 置信度:每 no_data 维降一档;疑压货也降并标待人工核
    var confidence = Math.max(0, 1 - ndDims.length * POLICY.CONF_PENALTY_PER_NODATA);
    if (overstock) { confidence = Math.max(0, confidence - 0.25); flags.push('suspect_overstock_human_review'); }
    if (ndDims.length) flags.push('no_data_dims:' + ndDims.join(','));

    // §3 战术指向 + 任务种子(只建议·不指令·不派钱)。三类:无差/待批/已派(§5 inbox)
    var tactic = top_gap_dim ? TACTIC[top_gap_dim] : null;
    var seedType = (gap_total < 0.5) ? '无差'
                 : (capApplied || overstock || confidence < 0.6) ? '待批'  // 触闸/疑压货/低置信→人工核
                 : '已派';
    var task_seed = {
      type: seedType, dim: top_gap_dim, dim_zh: top_gap_dim ? DIM_ZH[top_gap_dim] : null,
      tactic: tactic, gap: top ? Math.round(top.w * (1 - top.r) * 100) / 100 : 0,
      note: '建议·非指令(只关差不派钱;改目标/权重/退场=人工)'
    };

    return {
      sku_id: input.sku_id || null, store_id: input.store_id || null,
      role: input.role || null, stage: stage || POLICY.DEFAULT_STAGE,
      state_score: score, sku_state_level: mapL(score),
      gap_total: gap_total, gap_breakdown: gap_breakdown, top_gap_dim: top_gap_dim,
      tactic: tactic, task_seed: task_seed, confidence: Math.round(confidence * 100) / 100,
      margin_gate: { broken: broken, cap: POLICY.CAP, cap_applied: capApplied },
      flags: flags
    };
  }

  // §4 黄金例(来自规格·已验证可复现)——bridge/CLI/测试用。买/看/动=显式达成率 r。
  function goldenCases() {
    return [
      { name: '1a', input: { sku_id: 'S1', store_id: 'X', role: '明星', stage: '导入', buy: .95, see: .70, sell: .45, margin_broken: false }, expect_score: 78.75, expect_L: 'L4' },
      { name: '1b', input: { sku_id: 'S1', store_id: 'X', role: '明星', stage: '成熟', buy: .95, see: .70, sell: .45, margin_broken: false }, expect_score: 65,    expect_L: 'L3' },
      { name: '2',  input: { sku_id: 'S2', store_id: 'X', role: '攻击', stage: '成长', buy: .95, see: .80, sell: .95, margin_broken: true  }, expect_score: 60,    expect_L: 'L3' },
      { name: '3',  input: { sku_id: 'S3', store_id: 'X', role: '防御', stage: '成熟', buy: .90, see: .95, sell: .85, margin_broken: false }, expect_score: 89.25, expect_L: 'L5' },
      { name: '4',  input: { sku_id: 'S4', store_id: 'X', role: '现金流', stage: '衰退', buy: .70, see: .50, sell: .25, margin_broken: false }, expect_score: 39,    expect_L: 'L1' }
    ];
  }

  var api = { scoreSku: scoreSku, goldenCases: goldenCases, mapL: mapL, POLICY: POLICY, TACTIC: TACTIC };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.SkuScorecard = api;

  // CLI:
  //   node sku_scorecard.js            → 打印黄金例评分输出 JSON(供桥/测试校验)
  //   node sku_scorecard.js --score '<json>' → 打印任意输入的 scoreSku 输出(边界测试用)
  if (typeof require !== 'undefined' && require.main === module) {
    if (process.argv[2] === '--score') {
      var inp = JSON.parse(process.argv[3] || '{}');
      process.stdout.write(JSON.stringify(scoreSku(inp)));
    } else {
      var out = goldenCases().map(function (g) { return { name: g.name, expect_score: g.expect_score, expect_L: g.expect_L, got: scoreSku(g.input) }; });
      process.stdout.write(JSON.stringify(out));
    }
  }
})(typeof window !== 'undefined' ? window : this);
