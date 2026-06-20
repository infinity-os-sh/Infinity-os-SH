---
name: visit-route-planning
description: 生成"每人每日拜访清单 + 路线"——按岗位驱动对象池(DSR→零售店/美顾→KA会员店/督导→抽查/区域经理→巡店),按店分级定频率(A周/B双周/C月,占位待D-003)、人均产能上限截断(超出进次日标overload)、盲点(L1-04)与逾期优先但配额保底不漏常规、地理就近聚类减空跑。凡涉及"拜访规划、路线编排、今日拜访、拜访清单、跑店计划、路线优化、谁今天访哪些店"的输入都用本 Skill。它是 DSR/美顾/督导 app 的 XM(今日任务)数据源、XD 系统性采集的指挥棒——**只排程:不采集(XD)、不判级(L1-03)、不算战功(地基③)、不考核打卡不记谁没访**。**接口先行**:门店分级频率/人均产能等政策数字待管理层定(DECISION-003),规则写死数字占位。排程优先级用 VPS(拜访优先级分=常规到期度+救火紧急度)排序后产能截断;救火紧急度由 CHS(门店健康,映射 L1-06)/SHS(SKU健康,映射地基③生命力)喂入,只读不重算;签退后 emit 学习记录给学习引擎 LE(评拜访有没有拨动门店状态=对事,非给销售打分)。下游:XM 今日任务 / XD 采集指挥 / 学习引擎 LE / 经理(可调整路线,留痕)。
version: v0.2
owner: <填:负责人/团队>
type: Workflow / Skill(L5增长层/行动编排 · 规则型 · 接口先行 · 助手非鞭子 · 按岗位驱动对象池 · L5-07)
status: 粗糙版 v0.2,接口先行;门店分级频率/人均产能/优先级配额待 DECISION-003,规则写死数字占位。v0.2 在 v0.1 全部命门(无考核字段/配额保底不漏常规/接口先行 D-003/只排程不越界)之上,新增 VPS 评分体系 + CHS/SHS 映射输入 + 学习接口(emit LE)+ VQS 硬约束(评事非评人)+ RAE/CAE 信号钩子(只 emit 不分配)
upstream: L0-04 门店档案(清单+分级+geo,只读)/ L1-04 覆盖盲点(优先级,只读)/ **CHS 门店健康(映射 L1-06,只读不重算)/ SHS SKU健康(映射地基③ vitality,只读不重算)** / 组织主数据(人员/岗位/产能,只读)/ 拜访历史(后端,只读)
downstream: XM 今日任务(DSR/美顾/督导 app)/ XD 系统性采集(拜访即采集触点)/ **学习引擎 LE(签退后 emit 拜访有效性学习记录)** / 经理(human_override 调整路线,留痕)
backlog: L5-07
---

# 拜访规划 / 路线编排 Skill v0.2 · L5增长层/行动编排(L5-07)

> 本 Skill 依据《INFINITY OS · Agent 设计标准 v1.0》编写。
> 它是一个 **Workflow**(写死轨道)——按岗位筛对象池,套频率/优先级/产能/地理规则,出每人每日拜访清单+路线。
> 是 **XM(今日任务)的数据源**、**XD(系统性采集)的指挥棒**——它排谁今天去哪些店,XD 在拜访时顺带把状态采回来。**规划/编排,不采集不考核。**

> **⚠️ 四条铁律:**
> ① **助手非鞭子(同 L5-05)**——排程是"建议路线",**不是打卡监工**;**绝不记录/考核"谁没访"**(那会逼一线造假、反噬数据真实性);输出物理上没有 `visited`/`checked_in`/`who_missed`/`completion` 字段。
> ② **盲点/逾期优先,但配额保底不漏常规**——救火(盲点+逾期)优先但**有产能上限**,常规店留**保底配额**;否则救火吃满产能,常规店永远排不上、越拖越逾期成恶性循环。
> ③ **只排程,不越界**——不采状态(XD)、不判动销(L1-03)、不算战功(地基③)、**不算 CHS/SHS(只读 L1-06/地基③)、不做资源/能力分配(RAE/CAE 的事)**;本节点只回答"谁今天访哪些店、什么顺序"。
> ④ **VQS 评事不评人(铁律①的学习层延伸)**——签退后 emit 的拜访有效性信号 VQS,评的是"**这次拜访有没有拨动门店状态**"(对事),**绝不是"这个销售干得好不好"(对人)**;VQS 只能作为喂学习引擎 LE 的 effectiveness 信号,**MUST NOT 变成个人绩效分/拜访质量排名/主管介入触发**。铁律①管"不记谁没访",铁律④管"就算记了拜访效果,也只评事不评人"——两道一起堵死"排程→考勤→考核"的滑坡。

> **⚠️ 接口先行:** 门店分级频率、人均日拜访产能、优先级配额比例等政策数字**待管理层定(DECISION-003 拜访政策)**;接入前用占位默认值跑通,每处标 `D-003 待定`,不硬编成像是定了。

---

## 1. 角色与目标 + 边界【先读这个】

你是 **拜访规划的编排器**:按岗位取对象池,套规则排出"每人每日访哪些店、什么顺序"。产出物是**每人每日拜访清单 + 路线**——**建议路线非考勤,经理可调,机器不锁死**。

**与兄弟节点边界(写死):**

| 事 | 归谁 | 本节点角色 |
|---|---|---|
| 门店清单 + 分级 + geo | L0-04 门店档案 | 只读,不重定分级 |
| 覆盖盲点优先级 | L1-04 | 只读作优先级输入 |
| 人员 / 岗位 / 产能 | 组织主数据 | 只读,不重定岗位 |
| 拜访历史(上次访期) | 后端 | 只读,算频率到期 |
| **CHS 门店健康分** | **L1-06 健康度(grade/health/score)** | **只读映射,不重算**——救火紧急度的输入,本节点不自己算门店健康 |
| **SHS SKU 健康分** | **地基③ vitality(生命力 S/A/B/C/D)** | **只读映射,不重算**——救火紧急度的输入,本节点不自己算 SKU 生命力 |
| 采集门店状态 | **XD 系统性采集** | **不碰**——本节点排路线,XD 在拜访时采状态 |
| 判动销/铺货 | L1-03 | **不碰** |
| 算战功 | 地基③ | **不碰** |
| **资源配置 / 能力配置** | **RAE / CAE(上层独立引擎)** | **不碰**——只在输出 emit 信号钩子(哪些客户需补资源/需什么能力的人),自己不分配 |
| 学习(什么拜访有效) | **学习引擎 LE** | **不碰**——只 emit 学习记录(VQS 有效性信号),不自己学不给人打分 |
| **排程 + 路线 + VPS 优先级配额 + emit 学习记录/信号钩子** | **本节点** | 唯一职责 |

**与 XD/XM 的关系:** 本节点 → **XM**(把清单推到一线 app 当今日任务)→ 一线照单拜访 → **XD**(拜访即采集触点,把店的状态采回)。本节点是**指挥棒**(指谁去哪),不是**采集器**(XD 才采),更不是**考勤机**(谁都不考)。

**机器与人:** 排程无强制 HITL(是建议)。但**经理可 human_override 调整路线**,留痕,机器不锁死。

---

## 2. 输入(Input)— 含接入状态

| 信号 | 来源 | 状态 | 用途 |
|---|---|---|---|
| 门店清单 + 分级(A/B/C)+ geo(lat/lng) | L0-04 | 分级部分占位 | 对象池 + 频率 + 地理排序 |
| 覆盖盲点 | L1-04 | 可用(只读) | 优先级(救火) |
| **CHS 门店健康分** | **L1-06(grade/health/score)** | 可用(只读) | **救火紧急度输入(provenance 标 L1-06)** |
| **SHS SKU 健康分** | **地基③ vitality(S/A/B/C/D)** | 可用(只读) | **救火紧急度输入(provenance 标地基③)** |
| 人员/岗位/产能 | 组织主数据 | **占位** | 按岗位筛池 + 产能截断 |
| 拜访历史(各店上次访期) | 后端 | **占位** | 频率到期判定 |
| 拜访政策(分级频率/产能/配额) | 管理层 | **未定·D-003** | 排程数字(占位) |
| `today` | 内部 | 可用 | 日节奏 |

> partial 常态:分级缺 → 按默认频率排 + 标 `tier_pending`(不漏访也不硬编);政策未定 → 占位默认值 + 标 `D-003 待定`;产能缺 → 用保守默认上限。

---

## 3. 参数定义(Parameters)

| 字段 | 类型 | 说明 |
|---|---|---|
| `date` / `person` / `role` | string | 日期 × 人 × 岗位 |
| `object_pool` | enum | 按岗位:`零售店`(DSR)/ `KA会员店`(美顾)/ `抽查`(督导)/ `巡店`(区域经理)(§9d) |
| `visit_list[]` | object[] | 拜访清单,每店:`{store_id, seq, reason, vps, vps_breakdown, est_minutes}` |
| └ `reason` | enum | `盲点`(L1-04)/ `逾期`(超频率未访)/ `常规`(频率到期)——**排程理由,可溯源** |
| └ `vps` | number | **VPS 拜访优先级分 = 常规到期度 + 救火紧急度**(§9f);排序用 |
| └ `vps_breakdown` | object | **VPS 拆解**:`{常规到期度:{分级,周期,距上次访天数}, 救火紧急度:{from_CHS, from_SHS, provenance}}`——**拆得出常规vs救火来源,可溯源** |
| └ `seq` | number | 路线顺序(地理就近) |
| `chs_shs_inputs` | object | **只读映射**:`{CHS:{value, provenance:"L1-06"}, SHS:{value, provenance:"地基③vitality"}}`——本节点不重算 |
| `route` | object | 路线:`{ordered_stops, geo_cluster, est_total_minutes}` |
| `capacity` | object | 产能:`{cap, used, 救火配额, 常规保底配额}`(§9b,占位待 D-003) |
| `overflow[]` | object[] | 超产能进次日的店:`{store_id, reason, vps, defer_to: 次日}` + flag `overload` |
| `learning_emits[]` | object[] | **签退后 emit 给 LE 的学习记录**(§9g):`{store_id, planned_vps, 实际访没访, 拜访后店状态有无拨动(Δ状态), effectiveness_signal}`——**评事(拜访有效性)非评人** |
| `signal_hooks` | object | **RAE/CAE 信号钩子(只 emit 不分配)**:`{需补资源的客户状态[], 需特定能力的客户类型[]}`——本节点不做资源/能力分配 |
| `confidence` | enum | high/mid/low(分级/历史/政策齐全度) |
| `human_override` | object\|null | 经理调整留痕:`{by, 原路线, 新路线, reason, at}`——机器不锁死 |
| `status` | enum | `planned` / `overload`(有溢出)/ `tier_pending`(缺分级默认排)/ `policy_pending`(D-003未定) |
| `flags` | string[] | `assistant_not_tracker`(非考勤)/ `vqs_effect_not_person`(VQS评事非评人)/ `overload` / `tier_pending` / `D003_pending` / `regular_quota_protected` 等 |
| `summary_text` | string | 为什么这么排(VPS=常规到期度+救火紧急度,盲点优先/产能截断/就近,可溯源) |
| `fanout` | string[] | XM今日任务 / XD采集指挥 / **LE学习引擎** / 经理;**无任何打卡/考核/谁没访/个人绩效/拜访排名/主管介入项** |

> **注意:输出里没有 `visited`/`checked_in`/`who_missed`/`completion` 字段——本节点排路线,不认"访没访"(那是 XD 采状态,且采的是店不是人的考勤)。**

---

## 4. 处理流程(Steps · 链式,日节奏)

### Step A — 按岗位取对象池(§9d)
按 `role` 定 `object_pool`:DSR→零售店 / 美顾→KA会员店 / 督导→抽查池 / 区域经理→巡店池。**规则同一套,对象池不同**(岗位决定访谁,排程规则共用)。

### Step B — 频率到期判定(读历史 × 分级,§9a)
对池内每店:读上次访期(历史)+ 分级(L0-04)→ 按 §9a 分级频率(A周/B双周/C月,**占位待 D-003**)判是否到期。
- 分级缺 → 按默认频率(占位)排 + 标 `tier_pending`(**不漏访**)。

### Step C — 算 VPS(常规到期度 + 救火紧急度)+ 标 reason(§9f)
给到期店算 **VPS(拜访优先级分)= 常规到期度 + 救火紧急度**:
- **常规到期度** = 门店分级 × 周期 × 距上次访天数(逾期越久越高,重点店权重高);
- **救火紧急度** = f(CHS, SHS)——**读 L1-06 健康度(CHS)/ 地基③ vitality(SHS),只读不重算**(铁律③);健康越差/生命力越低 → 救火紧急度越高;
- 同时标 `reason`:盲点(L1-04)/ 逾期(超频率)→ 救火;常规(频率到期)→ 常规;
- `vps_breakdown` **拆得出常规vs救火来源 + CHS/SHS provenance**(可溯源,铁律对应)。
- **配额保底(铁律②)**:VPS 高的优先,但产能仍切两块——救火配额(盲点+逾期,**有上限**)+ **常规保底配额**(留给常规,不被救火吃光);`regular_quota_protected`。

### Step D — VPS 排序 → 产能截断(不超上限,§9b)
按 **VPS 降序**排,再按 §9b 人均日产能上限(**占位待 D-003**)截断:配额内择优,排不下的进 `overflow` → `defer_to:次日` + flag `overload`。**绝不超人均产能硬塞**(超载会让一线敷衍每一家)。

### Step E — 地理就近排序(减空跑)
对入选店按 geo(L0-04 lat/lng)聚类 + 就近排 `seq` → `route`。减少空跑里程。

### Step F — 出件(助手非鞭子)
脚本产 visit_list(含 vps/vps_breakdown)/route/overflow → LLM 写 summary_text(为什么这么排:VPS=常规到期度+救火紧急度,可溯源)→ 跑 §10 → 扇出(XM/XD/LE/经理)。
- **绝不记/考核谁没访**;`flags+=assistant_not_tracker`。经理调整走 `human_override` 留痕。

### Step G — 签退后 emit 学习记录 + 信号钩子(§9g,评事非评人)
拜访签退后(下一周期 / 拜访闭环时):
- **emit 学习记录给 LE**:每店 `{store_id, planned_vps, 实际访没访, 拜访后该店状态有无拨动(Δ状态), effectiveness_signal}`——给系统学"**什么样的拜访有效**"。
- **铁律④**:这是 **VQS 拜访有效性信号**,评的是"**这次拜访有没有拨动门店状态**"(对事);**MUST NOT 变成个人绩效分/拜访质量排名/主管介入触发**(对人);`flags+=vqs_effect_not_person`。
- **emit RAE/CAE 信号钩子(只 emit 不分配,铁律③)**:`signal_hooks{需补资源的客户状态[], 需特定能力的客户类型[]}`——告诉上层 RAE(资源配置)/CAE(能力配置)引擎"哪里需要什么",但**本节点自己不分配资源、不派能力**。

---

## 5. 规则与强度(RFC2119)

| 强度 | 规则 |
|---|---|
| **MUST** | **按店分级定频率排**(A周/B双周/C月)——**数字占位待 DECISION-003**,接入前用默认值并标 D003_pending。 |
| **MUST** | **不超人均日产能上限**(占位待 D-003);排不下进次日 + 标 overload,绝不超载硬塞。 |
| **MUST** | **盲点/逾期优先,但配额保底不漏常规**——救火有上限、常规留保底配额,不被救火吃光。 |
| **MUST NOT** | **不考核打卡、不记/上报"谁没访"**——纯助手(同 L5-05);输出无 visited/checked_in/who_missed/completion 字段(变考勤→一线造假→反噬数据真实性)。 |
| **MUST** | 缺分级 → 按默认频率排 + 标 tier_pending,**不漏访也不硬编**。 |
| **MUST NOT** | **只排程,不采集(XD)、不判级(L1-03/不重定分级)、不算战功(地基③)**;只读 L0-04/L1-04/组织主数据,不重定。 |
| **MUST** | **经理调整路线 human_override 留痕**(by/原/新/why/at),机器不锁死。 |
| **MUST** | **VPS = 常规到期度 + 救火紧急度,且可溯源**——vps_breakdown 拆得出常规vs救火来源 + CHS/SHS provenance。 |
| **MUST NOT** | **CHS/SHS 只读不重算**——CHS 映射 L1-06、SHS 映射地基③ vitality,本节点不自己算门店健康/SKU生命力(守唯一真相源)。 |
| **MUST** | **签退后 emit 学习记录给 LE**:{planned_vps / 实际访没访 / 拜访后店状态有无拨动}——给系统学"什么拜访有效"。 |
| **MUST NOT** | **不产个人绩效分 / 拜访质量排名 / 主管介入触发字段**——VQS 延伸自助手非鞭子,这些考核/排名字段一律不产。 |
| **MUST** | **VQS 仅作 LE 有效性信号(评事非评人)**——VQS 评"这次拜访有没有拨动门店状态",MUST NOT 作为考核/排名销售的分数。 |
| **MUST NOT** | **不做资源/能力分配(RAE/CAE 的事)**——只在输出 emit 信号钩子(需补资源的客户状态/需能力的客户类型),自己不分配。 |
| **SHOULD** | 路线应地理就近减空跑;排程理由(盲点/逾期/常规)与 VPS 应可溯源;CHS/SHS 应带 provenance。 |
| **MAY** | 可附预计时长/里程;多人批量排班视图。 |

---

## 6. 输出(Output · Artifact 契约)

```json
{
  "date": "2026-06-15", "person": "DSR-Chen", "role": "DSR",
  "object_pool": "零售店",
  "chs_shs_inputs": {
    "CD-WHQ-001": { "CHS": { "value": "C(差)", "provenance": "L1-06" }, "SHS": { "value": "D", "provenance": "地基③vitality" } },
    "CD-WHQ-008": { "CHS": { "value": "B", "provenance": "L1-06" }, "SHS": { "value": "C", "provenance": "地基③vitality" } }
  },
  "visit_list": [
    { "store_id": "CD-WHQ-001", "seq": 1, "reason": "盲点", "vps": 92,
      "vps_breakdown": { "常规到期度": { "分级": "A", "周期": "周", "距上次访天数": 9 },
                         "救火紧急度": { "from_CHS": "C差→高", "from_SHS": "D→高", "provenance": "L1-06+地基③" } },
      "est_minutes": 40 },
    { "store_id": "CD-WHQ-008", "seq": 2, "reason": "逾期", "vps": 74,
      "vps_breakdown": { "常规到期度": { "分级": "B", "周期": "双周", "距上次访天数": 18 },
                         "救火紧急度": { "from_CHS": "B→中", "from_SHS": "C→中", "provenance": "L1-06+地基③" } },
      "est_minutes": 30 },
    { "store_id": "CD-WHQ-003", "seq": 3, "reason": "常规", "vps": 41,
      "vps_breakdown": { "常规到期度": { "分级": "B", "周期": "双周", "距上次访天数": 14 },
                         "救火紧急度": { "from_CHS": "A→低", "from_SHS": "B→低", "provenance": "L1-06+地基③" } },
      "est_minutes": 25 },
    { "store_id": "CD-WHQ-005", "seq": 4, "reason": "常规", "vps": 38,
      "vps_breakdown": { "常规到期度": { "分级": "C", "周期": "月", "距上次访天数": 30 },
                         "救火紧急度": { "from_CHS": "A→低", "from_SHS": "A→低", "provenance": "L1-06+地基③" } },
      "est_minutes": 25 }
  ],
  "route": { "ordered_stops": ["CD-WHQ-001","CD-WHQ-008","CD-WHQ-003","CD-WHQ-005"],
             "geo_cluster": "武侯区西片", "est_total_minutes": 120 },
  "capacity": { "cap": "8家/日(D-003待定)", "used": 4,
                "救火配额": "≤5家(盲点+逾期)", "常规保底配额": "≥2家" },
  "overflow": [],
  "learning_emits": [
    { "store_id": "CD-WHQ-001", "planned_vps": 92, "实际访没访": "(签退后回填)",
      "拜访后店状态有无拨动": "(下周期回填:陈列OFF→ON?动销Δ?)",
      "effectiveness_signal": "(评:这次拜访拨动了店状态吗 — 对事非对人)" }
  ],
  "signal_hooks": {
    "需补资源的客户状态": [{ "store_id": "CD-WHQ-001", "状态": "C差+盲点", "→": "emit给RAE,本节点不分配" }],
    "需特定能力的客户类型": [{ "类型": "KA大店谈判", "→": "emit给CAE,本节点不派人" }]
  },
  "confidence": "mid",
  "human_override": null,
  "status": "planned",
  "flags": ["assistant_not_tracker", "vqs_effect_not_person", "regular_quota_protected", "D003_pending"],
  "summary_text": "DSR-Chen@武侯区 6/15:排4家(对象池=零售店),按VPS降序。CD-WHQ-001 VPS最高92(A店逾期9天=常规到期度 + 健康C差/生命力D=救火紧急度,CHS读L1-06、SHS读地基③),盲点排第1;008逾期VPS74排第2;003/005常规。救火2家未占满配额,留了常规保底,没只顾救火漏常规。VPS拆得出常规vs救火来源。签退后会emit学习记录给LE学'什么拜访有效'(评拜访有没有拨动店状态,非给我打分)。资源/能力需求只emit给RAE/CAE,本节点不分配。建议路线非考核,经理可调留痕。"
}
```

> VPS 拆解示例:每店 `vps = 常规到期度 + 救火紧急度`,`vps_breakdown` 拆得出两部分来源 + CHS/SHS provenance(L1-06/地基③)。
> CHS/SHS 映射示例:`chs_shs_inputs` 标 provenance,值读自 L1-06/地基③,**本节点不重算**;若节点自己算了健康/生命力 → §10 报错。
> 学习 emit 示例:`learning_emits` 评"拜访后店状态有无拨动"(对事),**翻遍输出无个人绩效分/拜访排名**;若出现 → §10 报错。
> RAE/CAE 信号示例:`signal_hooks` 只 emit "哪些客户需补资源/需什么能力的人",**本节点不分配**;若做了分配 → §10 报错。
> 盲点优先示例:L1-04 命中的店 `reason:盲点` + VPS 高 → 排在前(seq 小)。
> 配额保底示例:救火店占满救火配额后,常规店仍有保底名额入选,`flags:regular_quota_protected`。
> 超产能示例:排不下的店进 `overflow:[{defer_to:次日}]`,`status:overload`。
> 缺分级示例:某店无分级 → 按默认频率排,`flags:tier_pending`,不漏访。
> 换岗位示例:同一人若 role=美顾 → object_pool=KA会员店,排程规则不变对象池变。
> 经理调整示例:`human_override:{by:"经理Wang",原路线,新路线,reason,at}` 留痕,机器不锁死。
> 不记谁没访示例:输出**无** visited/checked_in/who_missed 字段 → §10 通过;若有 → 报错。

---

## 7. 节奏 + 扇出(写死)

| 项 | 规则 |
|---|---|
| 节奏 | 日(每日排次日/当日拜访清单) |
| 扇出 | XM 今日任务(一线 app)· XD 采集指挥(拜访即采触点)· **LE 学习引擎(签退后 emit 有效性记录)** · **RAE/CAE 信号钩子(只 emit 需求,不分配)** · 经理(可调整,留痕) |
| 禁区 | **绝不**:采集门店状态(XD 的事)、判动销/重定分级、算战功、**重算 CHS/SHS(读 L1-06/地基③)**、考核打卡、记/上报谁没访、**产个人绩效分/拜访排名/主管介入字段**、**做资源/能力分配(RAE/CAE 的事)**、超人均产能硬塞、漏常规只顾救火 |

---

## 8. HITL 卡点 —— 本节点【无强制,经理可调】

排程是建议、不出账不考核、不可逆性为零,**无强制 HITL**。但**经理可 human_override 调整路线**(改顺序/增删店/换人),全程留痕(by/原/新/why/at),机器不锁死——人比机器懂临时情况(临时活动、店休、突发)。这是"机器排建议、人有最终调整权"的协作,不是机器替人定死。

---

## 9. References

### 9a. 分级频率表(写死,数字占位待 D-003)

| 门店分级 | 拜访频率 | 占位 |
|---|---|---|
| A 店 | 每周 | `<D-003: A频率>` |
| B 店 | 每双周 | `<D-003: B频率>` |
| C 店 | 每月 | `<D-003: C频率>` |
| 缺分级 | 默认频率 + tier_pending | `<D-003: 默认>` |

### 9b. 产能上限 + 配额(写死,占位待 D-003)

| 项 | 规则 | 占位 |
|---|---|---|
| 人均日产能上限 | 超出进次日标 overload | `<D-003: 日上限>` |
| 救火配额(盲点+逾期) | 优先但有上限,不吃光产能 | `<D-003: 救火上限>` |
| 常规保底配额 | 留给常规店,不被救火挤光 | `<D-003: 常规保底>` |

> 配额是"优先"与"不漏"能同时成立的机制:救火优先但封顶,常规有保底名额。

### 9c. 优先级规则(写死)

| 优先级 | reason | 来源 |
|---|---|---|
| 高(救火) | 盲点 | L1-04 命中 |
| 高(救火) | 逾期 | 超频率未访 |
| 常规 | 常规 | 频率到期 |

> 救火优先排前(seq 小),但受救火配额封顶;常规受保底配额保护。

### 9d. 岗位对象池表(写死)

| 岗位 | 对象池 |
|---|---|
| DSR | 零售店 |
| 美顾 | KA / 会员店 |
| 督导 | 抽查池(按规则抽样) |
| 区域经理 | 巡店池 |

> 排程规则(频率/产能/优先级/地理)**四岗共用**,只换对象池。

### 9f. VPS 拜访优先级分(写死,数字占位待 D-003)

**VPS = 常规到期度 + 救火紧急度**

| 分量 | 算法 | 输入来源 |
|---|---|---|
| 常规到期度 | 门店分级权重 × 周期 × 距上次访天数(逾期越久越高,重点店权重高) | L0-04 分级 + 拜访历史 |
| 救火紧急度 | f(CHS, SHS)——健康越差/生命力越低越高 | **CHS 读 L1-06、SHS 读地基③ vitality(只读不重算)** |

| 字段 | 映射(不另造平行字典) |
|---|---|
| **CHS** 门店/客户健康分 | → **L1-06 健康度**(grade/health/score),provenance 标 `L1-06` |
| **SHS** SKU 健康分 | → **地基③ vitality**(生命力 S/A/B/C/D),provenance 标 `地基③` |

> VPS 排序 → 产能(D-003)截断 → 今日清单。每条 `vps_breakdown` 拆得出常规vs救火来源 + provenance。权重数字占位待 D-003。

### 9g. 学习接口(emit LE)+ VQS 评事非评人(写死)

签退后 emit 给学习引擎 LE 的记录:

| 字段 | 含义 |
|---|---|
| `planned_vps` | 当时排的 VPS |
| `实际访没访` | 签退回填(事实,非考核) |
| `拜访后店状态有无拨动` | Δ状态(陈列 OFF→ON?动销Δ?——读 XD 采回的店状态) |
| `effectiveness_signal` | **VQS:这次拜访有没有拨动门店状态(对事)** |

> **VQS 硬约束(铁律④):** VQS 评的是"**拜访有效性**"(对事——这次拜访拨动了店状态吗),**MUST NOT 变成个人绩效分/拜访质量排名/主管介入触发(对人)**。用途是给 LE 学"什么样的拜访有效",不是给销售打分排名。
>
> **RAE/CAE 信号钩子:** 本节点只 emit `signal_hooks{需补资源的客户状态, 需特定能力的客户类型}` 给上层 RAE(资源配置)/CAE(能力配置)引擎,**自己不分配资源、不派能力**——那是上层独立引擎的事。

### 9e. 术语 / 踩坑

| 术语 | 含义 |
|---|---|
| 助手非鞭子 | 排建议路线,不考核谁没访(铁律①) |
| **VPS** | 拜访优先级分 = 常规到期度 + 救火紧急度(§9f) |
| **CHS/SHS** | 门店健康(映射 L1-06)/ SKU健康(映射地基③ vitality),只读不重算 |
| **VQS 评事非评人** | 评拜访有没有拨动店状态(对事),非给销售打分(对人,铁律④) |
| 救火 vs 常规 | 盲点/逾期(救火)/ 频率到期(常规) |
| 配额保底 | 救火封顶 + 常规保底,优先不漏两全 |
| 指挥棒非采集器 | 排谁去哪(本节点)/ 采状态(XD) |
| **信号钩子非分配** | emit 资源/能力需求(本节点)/ 分配(RAE/CAE) |

- ❌(铁律④,值得记)**把 VQS 拜访有效性变成销售个人绩效分/拜访质量排名**:本来是评"这次拜访拨动了店状态吗"(对事),一旦变成"张三拜访质量分 82、李四 75"排名 → 又滑回考核监工,一线为分数造假拜访记录,和铁律①一个下场 → ✅ VQS 只 emit 给 LE 当有效性信号(对事非对人),输出无个人绩效/拜访排名/主管介入字段。
- ❌(值得记)**本节点自己算了 CHS/SHS**:重算了门店健康/SKU生命力,和 L1-06/地基③ 算的不一致 → 两个版本的真相,且越界 → ✅ CHS 读 L1-06、SHS 读地基③ vitality,只读不重算,带 provenance。
- ❌(值得记)**顺手做了资源/能力分配**:看哪个客户状态差就直接派资源/调能力强的人 → 越权干了 RAE/CAE 的活 → ✅ 只 emit 信号钩子(哪里需要什么),分配是 RAE/CAE 上层引擎的事。
- ❌(铁律①,值得记)**排程顺手记"谁没访完清单"上报考核**:变考勤监工 → 一线为达标造假打卡、乱填拜访 → XD 采回的状态全是假的,反噬整个数据真实性(同 L5-05 反噬战功的链条)→ ✅ 纯助手,输出无打卡字段,只排"建议访哪些",访没访 XD 采状态(采店不采人考勤)。
- ❌(铁律②,值得记)**只按优先级排,盲点+逾期吃满产能**:常规店永远排不上 → 越拖越逾期 → 全变成救火 → 恶性循环,常规经营彻底荒废 → ✅ 配额保底:救火封顶,常规留保底名额。
- ❌ 超人均产能硬塞 12 家:一线敷衍每一家、走马观花 → 拜访质量崩 → ✅ 超上限进次日标 overload,不硬塞。
- ❌ 缺分级就跳过该店不排:数据没接的店永远没人访 → ✅ 缺分级按默认频率排+标 tier_pending,不漏访。
- ❌ 本节点顺手采了门店状态/判了动销:越界干了 XD/L1-03 的活 → ✅ 只排程,采集是 XD、判级是 L1-03。
- ❌ 经理改了路线机器又改回去:机器锁死覆盖人工 → ✅ human_override 留痕,机器不锁死,人有最终调整权。
- _(后续迭代继续往下加)_

---

## 10. Scripts — 筛池 / 频率到期 / 配额产能截断 / 地理聚类 / 溯源(出件前必跑)

```python
ROLE_POOL = {"DSR":"零售店","美顾":"KA会员店","督导":"抽查","区域经理":"巡店"}  # §9d
FREQ_DAYS = {"A": None, "B": None, "C": None, "默认": None}  # §9a 占位待 D-003(如 A=7/B=14/C=30)
DAILY_CAP = None        # <D-003: 日上限> 占位
FIREFIGHT_CAP = None    # <D-003: 救火上限> 占位
REGULAR_FLOOR = None    # <D-003: 常规保底> 占位
# 禁止出现的考勤/考核字段(助手非鞭子)
FORBIDDEN_FIELDS = {"visited","checked_in","check_in","who_missed","not_visited",
                    "completion","completion_rate","考勤","打卡","谁没访"}

def pick_pool(role, all_stores):
    """按岗位筛对象池。"""
    pool = ROLE_POOL.get(role)
    return [s for s in all_stores if s.get("pool") == pool]

def is_due(store, today, history):
    """频率到期判定;缺分级用默认 + 标 tier_pending。"""
    tier = store.get("tier")
    days = FREQ_DAYS.get(tier) if tier else FREQ_DAYS["默认"]
    last = history.get(store["store_id"])
    if days is None:        # D-003 未定,占位:无法精确判,标 pending 但仍纳入候选(不漏访)
        return True, ("tier_pending" if not tier else "D003_pending")
    if last is None:
        return True, None   # 从没访过,纳入
    return (today - last).days >= days, (None if tier else "tier_pending")

def assign_reason(store, blindspots, overdue_set):
    if store["store_id"] in blindspots: return "盲点"
    if store["store_id"] in overdue_set: return "逾期"
    return "常规"

def schedule(candidates):
    """配额产能截断:救火封顶 + 常规保底,超出进次日。"""
    fire = [c for c in candidates if c["reason"] in ("盲点","逾期")]
    reg  = [c for c in candidates if c["reason"] == "常规"]
    chosen, overflow = [], []
    cap = DAILY_CAP or 8                 # 占位默认
    fcap = FIREFIGHT_CAP or (cap - (REGULAR_FLOOR or 2))   # 救火封顶
    floor = REGULAR_FLOOR or 2           # 常规保底
    # 救火先排但封顶
    chosen += fire[:fcap]; overflow += fire[fcap:]
    # 常规至少保底名额,且不超总 cap
    room = cap - len(chosen)
    take_reg = max(min(room, len(reg)), 0)
    chosen += reg[:take_reg]; overflow += reg[take_reg:]
    return chosen, overflow

def geo_order(stores):
    """地理就近排序(占位:按 lat/lng 简单聚类)。"""
    return sorted(stores, key=lambda s: (round(s.get("lat",0),2), s.get("lng",0)))

# ===== v0.2 新增 =====
W_TIER = {"A": None, "B": None, "C": None}   # 分级权重,占位待 D-003
# VQS/考核类禁止字段(铁律④:评事非评人)
VQS_FORBIDDEN = {"个人绩效","绩效分","拜访质量排名","质量分","主管介入","performance_score",
                 "rank","ranking","介入触发","sales_score"}

def read_chs_shs(store_id, l1_06_out, foundation3_out):
    """只读映射:CHS←L1-06、SHS←地基③vitality。本节点不重算,带 provenance。"""
    chs = l1_06_out.get(store_id)          # 读 L1-06 grade/health/score
    shs = foundation3_out.get(store_id)    # 读 地基③ vitality(S/A/B/C/D)
    return {"CHS": {"value": chs, "provenance": "L1-06"},
            "SHS": {"value": shs, "provenance": "地基③vitality"}}

def vps(store, today, history, chs_shs):
    """VPS = 常规到期度 + 救火紧急度;拆得出来源 + provenance。"""
    # 常规到期度:分级权重 × 周期 × 距上次访天数
    tier = store.get("tier")
    w = W_TIER.get(tier) or 1.0            # 占位
    last = history.get(store["store_id"])
    overdue_days = (today - last).days if last else 999
    regular = w * overdue_days             # 占位算法
    # 救火紧急度:f(CHS, SHS),健康差/生命力低 → 高(只读,不重算)
    fire = severity_from(chs_shs["CHS"]["value"]) + severity_from(chs_shs["SHS"]["value"])
    return {"vps": regular + fire,
            "vps_breakdown": {"常规到期度": {"分级": tier, "距上次访天数": overdue_days},
                              "救火紧急度": {"from_CHS": chs_shs["CHS"]["value"],
                                            "from_SHS": chs_shs["SHS"]["value"],
                                            "provenance": "L1-06+地基③"}}}

def severity_from(grade):
    """健康/生命力越差→紧急度越高(占位映射)。"""
    return {"D": 40, "C": 25, "B": 10, "A": 0}.get(str(grade)[:1], 15)

def validate(out):
    errs = []
    # ===== 铁律①:助手非鞭子,绝无考勤字段 =====
    blob = str(out)
    for ff in FORBIDDEN_FIELDS:
        if ff in blob:
            errs.append(f"attendance_field_present:{ff}")   # 出现打卡/考核字段
    for f in out.get("fanout", []):
        if any(x in f for x in ("打卡","考核","谁没访","上报完成","考勤")):
            errs.append(f"planner_became_tracker:{f}")
    if "assistant_not_tracker" not in str(out.get("flags", [])):
        errs.append("missing_assistant_flag")
    # ===== 铁律②:配额保底,不漏常规 =====
    vl = out.get("visit_list", [])
    fire = [v for v in vl if v.get("reason") in ("盲点","逾期")]
    reg  = [v for v in vl if v.get("reason") == "常规"]
    cand_reg = out.get("_candidate_regular", None)   # 候选里有常规店
    if cand_reg and not reg and fire:
        errs.append("regular_starved_by_firefight")  # 救火吃光、常规一个没排
    if fire and FIREFIGHT_CAP and len(fire) > FIREFIGHT_CAP:
        errs.append("firefight_over_quota")          # 救火超配额
    # ===== 不超产能 =====
    cap = out.get("capacity", {}).get("cap")
    if isinstance(cap, int) and len(vl) > cap:
        errs.append("over_daily_capacity")           # 超人均产能硬塞
    if out.get("overflow") and out.get("status") != "overload":
        errs.append("overflow_without_flag")
    # ===== 缺分级不漏访 =====
    for v in vl:
        if v.get("_tier_missing") and v.get("reason") is None:
            errs.append(f"missing_tier_dropped:{v.get('store_id')}")
    # ===== 排程理由可溯源 =====
    for v in vl:
        if v.get("reason") not in ("盲点","逾期","常规"):
            errs.append(f"visit_without_reason:{v.get('store_id')}")
    # ===== 只排程不越界 =====
    if out.get("_collected_state") or out.get("_graded_sellthrough") or out.get("_computed_merit"):
        errs.append("out_of_scope_action")           # 越界采集/判级/算战功
    # ===== D-003 占位标注 =====
    if FREQ_DAYS["A"] is None and "D003_pending" not in str(out.get("flags", [])) \
       and "tier_pending" not in str(out.get("flags", [])):
        errs.append("policy_pending_not_flagged")    # 政策占位未标
    # ===== 经理调整留痕 =====
    ho = out.get("human_override")
    if ho and (not ho.get("by") or not ho.get("reason")):
        errs.append("override_without_trace")        # 调整无留痕
    # ===== v0.2 VPS:常规+救火且可溯源 =====
    for v in vl:
        if v.get("vps") is None:
            errs.append(f"vps_missing:{v.get('store_id')}")
        bd = v.get("vps_breakdown") or {}
        if "常规到期度" not in bd or "救火紧急度" not in bd:
            errs.append(f"vps_not_decomposable:{v.get('store_id')}")  # 拆不出常规vs救火
        if bd.get("救火紧急度") and not bd["救火紧急度"].get("provenance"):
            errs.append(f"vps_firefight_no_provenance:{v.get('store_id')}")
    # ===== v0.2 CHS/SHS 只读不重算 + 用映射名不另造 =====
    ci = out.get("chs_shs_inputs") or {}
    for sid, m in ci.items():
        if m.get("CHS") and m["CHS"].get("provenance") != "L1-06":
            errs.append(f"chs_not_mapped_to_L1-06:{sid}")   # 另造平行字典/没映射
        if m.get("SHS") and m["SHS"].get("provenance") not in ("地基③vitality","地基③"):
            errs.append(f"shs_not_mapped_to_foundation3:{sid}")
    if out.get("_recomputed_chs") or out.get("_recomputed_shs"):
        errs.append("chs_shs_recomputed")              # 自己算了健康/生命力
    # ===== v0.2 学习记录 emit(MUST) =====
    le = out.get("learning_emits")
    if le is None:
        errs.append("no_learning_emit")                # 没 emit 给 LE
    else:
        for e in le:
            for k in ("planned_vps","实际访没访","拜访后店状态有无拨动"):
                if k not in e:
                    errs.append(f"learning_record_incomplete:{k}")
    # ===== v0.2 铁律④:VQS 评事非评人,绝无个人绩效/排名/介入字段 =====
    for ff in VQS_FORBIDDEN:
        if ff in blob:
            errs.append(f"person_perf_or_rank_field:{ff}")   # 出现考核/排名/介入字段
    if out.get("_vqs_as_person_score"):
        errs.append("vqs_used_as_person_score")        # VQS 被当个人分用
    if le and "vqs_effect_not_person" not in str(out.get("flags", [])):
        errs.append("missing_vqs_effect_flag")
    # ===== v0.2 RAE/CAE 只 emit 不分配 =====
    sh = out.get("signal_hooks") or {}
    if out.get("_allocated_resource") or out.get("_assigned_capability"):
        errs.append("did_resource_or_capability_allocation")  # 越权做了分配
    for f in out.get("fanout", []):
        if any(x in f for x in ("分配资源","派能力","调配","resource_allocation","capability_assign")):
            errs.append(f"allocation_in_fanout:{f}")
    return errs
```

---

## 11. 评测起手式(12 条种子)

```json
[
 {"id":"v01",
  "input":{"store":"A店","last_visit":"8天前","freq":"周(占位7天)"},
  "expect":{"in_visit_list":true,"reason":"常规","note":"A店到周期出现在清单"},
  "tags":["A店到频率周期→出现在拜访清单"]},

 {"id":"v02",
  "input":{"stores":["盲点店(L1-04)","常规店"],"capacity":"够"},
  "expect":{"盲点店_seq":"排前(小)","reason":"盲点","priority_high":true},
  "tags":["盲点(L1-04)优先排前"]},

 {"id":"v03",
  "input":{"candidates":"10家","daily_cap":"8家"},
  "expect":{"visit_list_len":8,"overflow":"2家进次日","status":"overload",
            "error_if_oversqueeze":"over_daily_capacity"},
  "tags":["超人均产能→进次日标overload,不硬塞"]},

 {"id":"v04",
  "input":{"store":"无分级","freq":"缺"},
  "expect":{"in_visit_list":true,"flags_contains":"tier_pending","not_dropped":true,
            "error_if_dropped":"missing_tier_dropped"},
  "tags":["缺分级→按默认频率排,不漏访"]},

 {"id":"v05",
  "input":{"person":"同一人","role切换":["DSR","美顾"]},
  "expect":{"DSR":"对象池=零售店","美顾":"对象池=KA会员店","rules_same":true},
  "tags":["按岗位换对象池,排程规则不变"]},

 {"id":"v06",
  "input":{"event":"排程想记录'张三今天没访完清单'并上报"},
  "expect":{"blocked":"attendance_field_present / planner_became_tracker",
            "no_who_missed_field":true,"note":"纯助手,记谁没访会逼一线造假"},
  "tags":["铁律①:不记谁没访不考核(变考勤→造假→反噬数据真实性)"]},

 {"id":"v07",
  "input":{"event":"经理把CD-008从路线删掉、加了CD-020"},
  "expect":{"human_override":{"by":"经理","原路线":"有008","新路线":"有020","reason":"有","at":"有"},
            "machine_not_lock":true,"error_if_no_trace":"override_without_trace"},
  "tags":["经理调整路线→human_override留痕,机器不锁死"]},

 {"id":"v08",
  "input":{"candidates":"盲点3+逾期4+常规5","daily_cap":"8","常规保底":"≥2"},
  "expect":{"firefight_capped":"救火≤6","regular_in_list":"≥2家常规",
            "flags_contains":"regular_quota_protected",
            "error_if_starved":"regular_starved_by_firefight"},
  "tags":["铁律②:救火配额封顶+常规保底,不只顾救火漏常规"]},

 {"id":"v09",
  "input":{"store":"A店逾期9天+健康C差(CHS)+生命力D(SHS)"},
  "expect":{"vps":"高","vps_breakdown":{"常规到期度":"A×周期×9天","救火紧急度":"f(CHS=C,SHS=D)"},
            "decomposable":true,"error_if_flat":"vps_not_decomposable"},
  "tags":["VPS拆得出常规到期度vs救火紧急度两个来源"]},

 {"id":"v10",
  "input":{"CHS":"读L1-06健康度","SHS":"读地基③vitality"},
  "expect":{"chs_provenance":"L1-06","shs_provenance":"地基③vitality","no_recompute":true,
            "no_parallel_dict":"用映射名不另造","error_if_recompute":"chs_shs_recomputed"},
  "tags":["CHS/SHS用映射名(L1-06/地基③),只读不重算,不另造平行字典"]},

 {"id":"v11",
  "input":{"签退后":"emit学习记录","record":"{planned_vps,实际访没访,店状态有无拨动}"},
  "expect":{"learning_emit":"present","翻遍输出":"无个人绩效分/拜访排名/主管介入字段",
            "vqs_about_event":"评拜访拨动店状态(对事)非评销售(对人)",
            "error_if_person_score":"person_perf_or_rank_field"},
  "tags":["学习记录emit给LE,但翻遍输出无个人绩效/排名(VQS评事非评人)"]},

 {"id":"v12",
  "input":{"event":"某客户状态差,节点想直接派资源/调能力强的人"},
  "expect":{"signal_hooks":"只emit'需补资源/需能力'","no_allocation":true,
            "note":"RAE/CAE上层分配,本节点只emit不分配",
            "error_if_allocate":"did_resource_or_capability_allocation"},
  "tags":["RAE/CAE信号只emit不分配:本节点不做资源/能力配置"]}
]
```

**打分维度(每条 0/1):**
1. A店到周期进清单(v01)
2. 盲点优先排前(v02)
3. **超产能进次日标overload**(v03:§10 over_daily_capacity 守)
4. 缺分级不漏访(v04)
5. 按岗位换对象池(v05)
6. **铁律①不记谁没访**(v06:attendance_field_present 守)
7. 经理调整留痕(v07)
8. **铁律②配额保底不漏常规**(v08:regular_starved_by_firefight 守)
9. **VPS 拆得出常规vs救火来源**(v09:vps_not_decomposable 守)
10. **CHS/SHS 用映射名不另造、只读不重算**(v10:chs_shs_recomputed 守)
11. **学习记录 emit 但无个人绩效分**(v11:person_perf_or_rank_field 守)
12. **RAE/CAE 信号只 emit 不分配**(v12:did_resource_or_capability_allocation 守)

> 最危险的几类错,v0.1 的两条(变考勤监工 v06、只顾救火漏常规 v08)仍在,v0.2 又加了一条同源的:**VQS 从"评事"滑成"评人"**(v11——拜访有效性本是评"这次拜访拨动了店状态吗",一旦变成"销售拜访质量分排名",又滑回考核监工,一线为分数造假拜访记录,和铁律①一个下场)。这三条其实是同一个病的不同变种:**工具一旦开始盯人(记谁没访 / 给拜访打质量分 / 排名销售),人就会喂工具假数据,反噬整个系统的数据真实性**。所以 v0.2 把"助手非鞭子"从"不记谁没访"(铁律①)延伸到"VQS 评事非评人"(铁律④)——堵死从排程滑向考核的两个入口。拜访规划的定位始终是:**指挥棒(指 XD 去哪采)+ 优先级器(VPS 排序)+ 学习信号源(emit 拜访有效性给 LE)**,但绝不是考勤机、不是绩效尺、不是资源分配器(那是 RAE/CAE)。CHS/SHS 只读映射(不另造真相)、信号钩子只 emit(不越权分配)——每个新增能力都守着"不重算别人的真相、不替别人做分配"的边界。

---

## 待填变量(套用时替换)
- `owner`(backlog 编号已定 L5-07)
- **DECISION-003 拜访政策**(单列待管理层定):§9a 分级频率(A/B/C)、§9b 人均日产能上限 + 救火配额 + 常规保底配额、优先级权重 — 全部占位待定
- L0-04 门店分级 + geo / L1-04 盲点 / 组织主数据(人员·岗位·产能)/ 拜访历史 — 只读契约对齐
- 地理聚类算法(占位:简单经纬排序 → 接入路径规划服务可升级)
- XM 今日任务推送通道 / XD 采集触点对接
- **CHS 映射 L1-06 / SHS 映射地基③ vitality** — 只读契约对齐,本节点不重算
- **学习引擎 LE 接口** — 签退后 emit 拜访有效性记录(VQS,评事非评人)
- **RAE/CAE 信号钩子对接** — 只 emit 资源/能力需求,分配由上层引擎做
- §9f VPS 权重(分级权重/周期/到期度系数)、救火紧急度 f(CHS,SHS) 映射 — 待 D-003/校准
