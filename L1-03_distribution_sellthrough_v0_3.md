---
name: distribution-sellthrough-monitor
description: 消费 L0-01 库存快照(含历史)、L0-08 到货回执、L0-02 排面与 L0-04 门店档案,按写死公式计算自家产品的铺货率(有售门店÷应覆盖门店,按 SKU×区域/渠道切)与动销率(动销门店÷可判定有售门店,跨窗锚定巡访对净流出判定),pool 口径聚合、同店 cohort 趋势,按写死阈值表产指标预警(台账防疲劳),no_data 超线自带数据薄弱旗。凡涉及"铺货率、动销率、铺市、卖不动、滞销、两率监控、渠道指标、铺货预警"的输入都用本 Skill。它是两率的计算真相源(L1-03)、L1 层地基——L1-04 覆盖盲点、L1-06 经销商健康度都消费它的口径;不采集、不触发断货预警、不下单。下游:城市经理/大区看板、L1-04、L1-06。
version: v0.3
owner: <填:负责人/团队>
type: Workflow / Skill(渠道层指标节点 · 消费/分析 · 有状态预警台账 · L1-03)
status: 粗糙版 v0.3,待真实数据迭代
upstream: L0-01 库存快照(含历史)/ L0-08 到货回执(received)/ L0-02 排面 / L0-04 门店档案(按窗口日期取历史版;店级巡店节奏 M)/ SKU 战略等级主数据(经 MCP)/ **SKU 生命周期阶段判定的 effective_stage(按 sku×scope×period,只读)** / 阈值表(按阶段) / 指标预警台账
downstream: 城市经理·大区看板 / L1-04 覆盖盲点(待建)/ L1-06 经销商健康度(待建)/ 指标预警台账(回写)
backlog: L1-03
---

# 铺货率 / 动销率监控 Skill v0.3 · 渠道指标节点(L1-03)

> 本 Skill 依据《INFINITY OS · Agent 设计标准 v1.0》编写。
> 它是一个 **Workflow**(写死轨道)+ **指标预警台账**(有状态,语义沿用 L0-07/L0-06)。
> 两率是 L1 层的地基口径:**公式写死、聚合 pool、趋势 cohort、预警照表**——LLM 只写给管理层的一行人话,数字全部出自脚本。

> **v0.2 变更摘要(三处都是样本与可信度修正):** ①巡访对改为**跨窗锚定**——prev 允许取窗口前最近一次合格快照(回看上限 = 该店巡店节奏 M + 宽限,从 L0-04 按店读),双周店不再被系统性踢出周动销率;②**一店一窗一判**——窗口内多快照只取(锚定 prev,窗口内最后一次合格快照)唯一一对,期间到货全加回,严禁多对重复计数;③**数据薄弱旗**——no_data 占比超线,出件必带 `data_quality_weak` 旗且 summary 必含覆盖提示,指标不许被安静相信(旗只提示,不改计算不进判级)。

> **v0.3 变更摘要(只加一件事:动销率判级按生命周期阶段切标准):** 读《SKU 生命周期阶段判定》的 `effective_stage`,**动销率达标线改为按阶段查表**(导入低不算病/成长要快增/成熟低=病危/衰退降属预期/焕新按成长/淘汰不判),不再全局一条线;**动销率事实计算(分子分母、四桶、净流出、锚定、pool/cohort)一律不变,只变判定线**;`stage=unknown` 时动销率照算但**不判级**(`stage_unknown_no_grading`),绝不拿默认阶段顶替——否则导入期被当成熟期误报病危。铺货率判级不受影响。

---

## 1. 角色与目标 + 边界【先读这个】

你是"**铺没铺到店**"(铺货率)和"**铺了卖不卖得动**"(动销率)两个渠道核心指标的**计算真相源**。L1-04、L1-06 将直接消费你的口径——你算错一处,整个渠道层跟着错。

**与兄弟节点的边界(写死):**

| 事 | 归谁 | 本节点角色 |
|---|---|---|
| 库存事实(qty/status/conf) | L0-01 | 只读,不重判 qty |
| 货架/排面事实 | L0-02 | 只读(在售证据之一) |
| 单店断货预警 | **L0-07(唯一触发方)** | 不碰;本节点的"铺货率跌破阈值"是**指标预警**,与单店断货预警两回事,各管各的 |
| 对手对比/统治力差距 | L5-01 | 不碰;本节点只算**自家绝对指标**;两者都用 pool 口径但互不重算 |
| 经销商进销存/周转 | L1-06(待建) | 不碰;本节点只看**店端**两率 |
| 门店分母/店型配置/区域归属/**巡店节奏 M** | L0-04 | 只读,**按窗口日期取历史版本**;M 用作锚定回看上限(v0.2) |
| **两率计算与指标预警** | **L1-03(本节点)** | 唯一计算与触发方 |

---

## 2. 输入(Input)

| 来源 | 字段 | 用途 |
|---|---|---|
| L0-01 库存快照(含历史,**含窗口前**) | store/sku/qty/conf/status/ts | 在售证据 + 巡访对主料(prev 可跨窗取,v0.2);**conf=low 的端点不做动销判定** |
| L0-08 到货回执 | store/sku/received_qty/received_at | **净流出还原**(到货推高库存会掩盖动销) |
| L0-02 货架 | own_facings(排面>0) | 在售证据之二 |
| L0-04 档案 | status / sku_mix / channel_type / region·city / store_grade / **巡店节奏 M(店级,v0.2)** | 分母真相源(按窗口日期取历史版);**M = 锚定回看上限基数**(语义同 L0-07 店级 M) |
| SKU 主数据 | 战略等级 Flagship/Core/Volume(经 MCP) | 阈值表维度 |
| 阈值表 | §9b(占位,经 MCP 或回测后定) | 分级 |
| 指标预警台账 | (指标,sku,scope) active/resolved | 防重复、升级、解除 |
| 窗口参数 | `window`:`weekly`(主)/ `monthly`(结构) | 节奏路由 |
| 当前时间 `now` | — | 日历天口径 |

---

## 3. 参数定义(Parameters)

| 字段 | 类型 | 说明 |
|---|---|---|
| `window` / `period` | enum / string | weekly / monthly;窗口标识 |
| `scope` | object | region/city/channel_type 切片 |
| `sku` | string | 指标按 SKU 计 |
| **铺货率块** | object | ↓ 四桶分类,口径 §4 Step B |
| ├ `eligible_stores` | number | 应覆盖分母 = L0-04 active(窗口日期历史版)∩ sku_mix 含该 SKU ∩ 窗口内有数据 |
| ├ `selling_stores` | number | 在售分子(qty>0 / normal / low / 排面>0 任一) |
| ├ `stocked_but_oos` | number | **铺过但断**(oos,分母内单列,≠未铺) |
| ├ `not_stocked` | number | 未铺(有数据但无该 SKU 任何在售/oos 证据) |
| ├ `no_data_stores` | number | 窗口内无任何上报,**双不进**(不进分子不进分母) |
| └ `distribution_rate` | number | = selling ÷ eligible(**pool 口径**) |
| **动销率块** | object | ↓ |
| ├ **`pair_anchor`(v0.2)** | object/店级 | `{prev_ts, prev_source: in_window/cross_window, lookback_days}`——prev 允许**跨窗锚定**(窗口前最近一次合格快照);**回看上限 = 该店 M + `<宽限天数>`**,超限仍判 no_pair |
| ├ `pairable_selling_stores` | number | **可判定有售店**(有合格巡访对)= 动销率分母;**一店一窗恒一判(v0.2)** |
| ├ `moving_stores` / `stagnant_stores` | number | 净流出>容差 / \|净流出\|≤容差 |
| ├ `no_pair` / `low_conf_excluded` / `data_anomaly` | number | 三类排除,单独计数**不进分母** |
| └ `sellthrough_rate` | number | = moving ÷ pairable_selling(pool)**(事实,与阶段无关)** |
| `effective_stage` | enum | **读自《SKU 生命周期阶段判定》**(导入/成长/成熟/衰退/焕新/淘汰/unknown),只读不重判(v0.3) |
| `sellthrough_grade` | enum | **达标 / 未达标 / 未判级**(unknown 或淘汰期)(v0.3) |
| `grading_stage` | enum | 判级所用阶段(= effective_stage;溯源用)(v0.3) |
| `trend` | object | 同店 cohort 环比(沿用 L5-01 §4 Step C 全套语义) |
| `alerts[]` | object[] | 指标预警(台账语义沿用 L0-07) |
| `summary_text` | string | 给管理层的一行人话(数字可溯源;**数据薄弱时必含覆盖提示,v0.2**) |
| `flags` | string[] | 同族惯例 + **`data_quality_weak:{占比}`(v0.2)** + **`stage_unknown_no_grading` / `stage_no_grading:淘汰`(v0.3)** |
| `fanout` | string[] | 同族惯例 |

---

## 4. 处理流程(Steps · 链式 + 节奏路由)

### Step A — 取数与分母构建
1. 按窗口取 L0-01 快照(**含窗口前历史,供锚定**)、L0-08 received 回执、L0-02 排面。
2. **分母**:查 L0-04 **按窗口日期的历史版本**——`status==active` 的店(suspended/closed 剔除,直接引用 L0-04 v0.2 级联语义)∩ `sku_mix` 含该 SKU(Volume 店本就不配旗舰品,不进旗舰品分母)。
3. **no_data 闸门**:窗口内该店无任何上报(L0-01/L0-02 都没有)→ `no_data`,**不进分子也不进分母**(沿用 L5-01 "no_data ≠ 0"原则:没报 ≠ 没铺)。

### Step B — 铺货判定(四桶,写死)
对分母内每店:
| 桶 | 判定(任一命中) | 进哪 |
|---|---|---|
| **在售** | L0-01 显式 qty>0 或 status∈{normal,low};或 L0-02 该 SKU 排面>0 | 分子 |
| **铺过但断** | 窗口内 status==out_of_stock(且无在售证据) | 分母内单列 `stocked_but_oos`,**不算未铺**——这是补货问题不是铺市问题 |
| **未铺** | 有数据但该 SKU 无任何在售/oos 证据 | 分母内,`not_stocked` |
| no_data | 无任何上报 | **双不进**(Step A3) |

`distribution_rate = selling ÷ eligible`(pool:Σ分子÷Σ分母,严禁平均店级比率——口径与校验**直接沿用 L5-01 §4 B0**)。

### Step C — 动销判定(跨窗锚定巡访对 + 净流出还原)【本节点的命门】

**C1. 配对规则(v0.2 重写,两条铁律):**

**铁律一 · 跨窗锚定**:
- `current` = 窗口内**最后一次**合格快照;
- `prev` = 优先窗口内更早快照;窗口内只有一次 → **允许取窗口开始前最近一次合格快照**(跨窗锚定,`prev_source: cross_window`);
- **回看上限**:prev 距窗口起点 > 该店 **M**(L0-04 店级巡店节奏,语义同 L0-07)+ `<宽限天数>` → 仍判 `no_pair`——太陈旧的锚定没有意义,35 天前的库存和今天之间发生了什么说不清。
- 为什么必须跨窗:严格窗口内配对会让 B 级双周店**永远** no_pair,周动销率长期只代表 A 级高频店——样本系统性偏差,指标看着健康,半数门店从未进过样本。

**铁律二 · 一店一窗一判**:
- 每店每窗口**只做一次判定**:唯一一对 = (锚定后的 prev, 窗口内最后一次合格快照);
- 期间**全部**到货(L0-08 received,received_at ∈ (prev.ts, current.ts])加回;
- **中间快照不单独配对**——逐对判再合 vs 取首末,结果不同,不钉死必漂;中间快照只剩一个用途:无(conf 闸门只看对的**两端**,中间快照的 conf 不影响);
- **严禁同店同窗多对重复计数**(§10 有断言)。

**C2. conf 闸门**:对的两端任一 conf==low → `low_conf_excluded`,不做判定(宁缺勿错判),不进分母。

**C3. 净流出(到货还原,写死公式)**:
> `net = prev_qty + Σ期间到货量(received_at ∈ (prev.ts, current.ts]) − current_qty`
> 期间到货会推高库存掩盖动销——不加回到货量,"卖了 8 瓶又到了 24 瓶"会被算成净增、误判滞销甚至异常。跨窗锚定后期间更长,**到货加回更不能漏**。

**C4. 三态判定**:`net > <动销容差>` → 动销;`|net| ≤ <动销容差>` → 滞销;`net < −<异常容差>` → `data_anomaly`(盘点误差/货损/漏记到货,**不硬判**,单独计数转数据质量清单)。

**C5.** `sellthrough_rate = moving ÷ pairable_selling`(**分母 = 可判定有售店**:有售且有合格巡访对。no_pair/low_conf/anomaly 三类排除单独计数——留在分母就是变相算滞销)。

> **事实与判级分离(v0.3 铁律):** C1–C5 算出的 `sellthrough_rate` 是**事实**,与生命周期阶段**无关**——分子分母、四桶、净流出、锚定一个字不改。阶段只影响下一步的**达标线**(这条率算高还是算低)。

### Step C6 — 动销率按生命周期判级(v0.3 新增)
1. 读《SKU 生命周期阶段判定》的 `effective_stage`(按 sku×scope×period 对齐,**只读不重判阶段**)。
2. **达标线按阶段查 §9b 阶段表**(不再全局一条线):
   - 导入期:看铺货点亮,**动销达标线放低,低不算病**;
   - 成长期:**动销快增才达标**;
   - 成熟期:动销稳 + 复购,**低 = 病危**;
   - 衰退期:**动销降属预期,不误报**;
   - 焕新期:**按成长口径**;
   - 淘汰期:**不判达标**(stage_no_grading)。
3. **`stage=unknown` 防错闸**:动销率**照算**(事实不变),但**不判达标/未达标**,标 `stage_unknown_no_grading` —— **绝不拿默认阶段顶替**(否则导入期被当成熟期,动销低误报病危)。
4. 判级结果写 `sellthrough_grade`(达标/未达标/未判级)+ `grading_stage`(所用阶段)。**铺货率判级不受影响**(仍照 §9b 铺货率行)。

### Step D — 聚合与趋势
- 聚合:scope × SKU 维度 **pool**(Σ分子÷Σ分母);by_region / by_channel 同理。
- 趋势:**同店 cohort**(两窗口都有有效数据的同一批店),全套语义与校验沿用 **L5-01 §4 Step C**。

### Step E — 指标预警(台账,语义沿用 L0-07/L0-06)+ 节奏路由
- 铺货率照 §9b 铺货率行判级;**动销率预警随阶段(v0.3)**:导入期动销低**不报警**(正常),成熟期动销低才报;衰退期动销降不误报;淘汰期/unknown 不产动销预警。判级用的阶段写进 alert.detail。
- **weekly 跑两率主预警,monthly 跑结构项**,日窗口不跑(急性归 L0-07)。
- 台账:同 (指标, sku, scope) active 未恶化不新发(`dedup_suppressed`,日历天重算);恶化才升(`<恶化_pp>`);阶梯升级封顶 P0;恢复 `<R_天>` 自动解除记时长。
- **预警只通知城市经理/大区,不触发任何执行动作**。

### Step F — 出件(v0.2 加数据薄弱旗)
1. **数据薄弱旗(写死)**:`no_data_stores ÷ (eligible_stores + no_data_stores) > <数据薄弱线>` → 出件 flag **`data_quality_weak:{占比}`**,且 `summary_text` **必须含一句数据覆盖提示**(如"另有 N 店本窗口无数据,占 X%")。
   - 旗**只提示**:不改变指标计算(no_data 仍双不进)、不进预警判级——铺货率 81% 配三成店无数据,81% 照算照报,但**不许被安静相信**。
2. 脚本产全部数字 → LLM 写 `summary_text`(每个数字必须在 JSON 找得到,沿用 L5-01 溯源校验)→ 跑 §10 → 扇出 → 回写台账。

---

## 5. 规则与强度(RFC2119)

| 强度 | 规则 |
|---|---|
| **MUST** | **动销率达标线必须按 `effective_stage` 查 §9b 阶段表,不可全局一刀切**(v0.3)。 |
| **MUST** | **`stage=unknown` 不得用默认阶段判级**,只算事实不判达标(`stage_unknown_no_grading`);淘汰期不判达标(v0.3)。 |
| **MUST** | **动销率事实计算与阶段无关**:分子分母、四桶、净流出、锚定、pool/cohort 一字不改,阶段只影响达标线(v0.3)。 |
| **MUST NOT** | 阶段**只读《SKU 生命周期阶段判定》的 effective_stage,绝不重判阶段**(v0.3)。 |
| **MUST** | 两率必须照 §9a 写死公式计算,**pool 口径**,严禁平均店级比率(沿用 L5-01 B0)。 |
| **MUST** | 巡访对的 prev 允许**跨窗锚定**(窗口前最近一次合格快照);**回看上限 = 该店 M(L0-04 店级)+ `<宽限天数>`**,超限必判 no_pair;期间到货必须全部加回。**(v0.2)** |
| **MUST** | **一店一窗一判**:唯一一对 =(锚定 prev, 窗口内最后合格快照);中间快照不单独配对、不影响 conf 闸门(只看两端);严禁同店同窗多对重复计数。**(v0.2)** |
| **MUST** | no_data 占比 > `<数据薄弱线>` 必须出 `data_quality_weak` 旗且 summary 含覆盖提示;旗不改变计算、不进判级。**(v0.2)** |
| **MUST** | 分母必须取 **L0-04 按窗口日期历史版**的 active 店并按 sku_mix 过滤;suspended/closed 剔除;**no_data 店双不进**。 |
| **MUST** | oos 必须计入"铺过但断"单列,**不得算未铺**。 |
| **MUST** | 动销判定必须用净流出公式,期间到货(L0-08 received)必须加回;net<−异常容差只标 data_anomaly,不硬判。 |
| **MUST** | no_pair **绝不当滞销**、conf=low(端点)不做判定、anomaly 排除——三类均不进动销率分母,单独计数。 |
| **MUST** | 趋势同店 cohort(沿用 L5-01);预警照 §9b 表且台账防重复(同键 active 未恶化不新发、恶化才升、R 天自动解除、日历天)。 |
| **MUST** | 本节点不得触发断货预警(归 L0-07)、不得触发任何执行动作、不得重算对手对比(归 L5-01)。 |
| **MUST** | summary_text 中每个数字必须可溯源(沿用 L5-01 校验)。 |
| **SHOULD** | data_anomaly 应汇总进数据质量清单;no_data 高占比的 scope 应同时提示采集薄弱(指向巡店,不指向指标)。 |
| **MAY** | 可附 by_store 明细;monthly 可附"连续 N 窗口未铺店清单"供 L1-04 消费。 |

---

## 6. 输出(Output · Artifact 契约)

```json
{
  "window": "weekly", "period": "2026-W24",
  "scope": { "region": "华东", "channel_type": "KA大卖场" },
  "sku": "6MX-JDX", "strategic_tier": "Flagship",
  "distribution": {
    "eligible_stores": 96, "selling_stores": 78, "stocked_but_oos": 6,
    "not_stocked": 12, "no_data_stores": 14,
    "rate": 0.81, "basis": "pooled_stores",
    "denominator_basis": "L0-04@窗口日期历史版:active∩sku_mix"
  },
  "sellthrough": {
    "pairable_selling_stores": 64, "moving_stores": 45, "stagnant_stores": 19,
    "no_pair": 11, "low_conf_excluded": 2, "data_anomaly": 1,
    "rate": 0.70, "basis": "pooled_stores",
    "pair_policy": "跨窗锚定·一店一窗一判·回看上限=店级M+宽限"
  },
  "effective_stage": "成熟",
  "sellthrough_grade": "未达标",
  "grading_stage": "成熟",
  "trend": {
    "distribution": { "cohort_stores": 82, "prev": 0.85, "delta": -0.04, "direction": "down" },
    "sellthrough":  { "cohort_stores": 58, "prev": 0.72, "delta": -0.02, "direction": "down" }
  },
  "alerts": [
    { "metric": "distribution_rate", "sku": "6MX-JDX", "scope": "华东|KA大卖场",
      "level": "P1", "detail": "旗舰品铺货率 81%,跌破 85% 线且 cohort 周降 4pp",
      "since": "2026-06-08", "duration_days": 4, "escalation_count": 0, "status": "active" },
    { "metric": "sellthrough_rate", "sku": "6MX-JDX", "scope": "华东|KA大卖场",
      "level": "P2", "detail": "成熟期动销率 70%,低于成熟期达标线(按成熟期标准判,成熟低=病危信号)",
      "grading_stage": "成熟", "since": "2026-06-08", "duration_days": 4, "escalation_count": 0, "status": "active" }
  ],
  "flags": ["data_quality_weak:0.13 以下未触发(示例线 0.25)"],
  "summary_text": "华东 KA 渠道加点鲜:铺货率 81%(78/96 在售,另 6 店铺过但断、12 店未铺),跌破旗舰品 85% 线〔P1〕;动销率 70%(45/64 可判定店动销),按成熟期标准判为未达标〔P2,成熟期低动销=病危〕。另有 14 店本窗口无数据,占 12.7%,未计入指标。",
  "fanout": ["看板:城市经理/大区:两率", "L1-04:未铺店清单(上线后)", "台账:登记"]
}
```

> 薄弱示例:no_data 40 店、eligible 96 → 占比 40/136=29.4% > 线 25% → `flags:["data_quality_weak:0.29"]`,summary 必含"另有 40 店本窗口无数据,占 29.4%——本期指标覆盖薄弱,解读请谨慎"。

> **导入 vs 成熟同率反判示例(v0.3):** 同一动销率 0.55 —— 在**导入期**该 SKU 达标线放低,`sellthrough_grade:"达标"`,不报警(铺货还在点亮,动销低正常);在**成熟期**低于成熟达标线,`sellthrough_grade:"未达标"`〔P2 病危〕。**率是同一个事实,判定相反**。
> **unknown 示例(v0.3):** `effective_stage:"unknown"` → 动销率照算(如 0.55),但 `sellthrough_grade:"未判级", flags:["stage_unknown_no_grading"]`,不产动销预警,summary 注明"生命周期阶段未知,动销率暂不判达标"。**绝不拿默认阶段顶替**。
> **衰退期示例(v0.3):** 衰退期动销环比下降属预期,`sellthrough_grade` 按衰退口径不报"恶化",不误报。

---

## 7. 节奏路由 + 扇出(写死)

| window | 跑什么 | 预警 |
|---|---|---|
| weekly(主) | 两率全量 + cohort 趋势 | §9b weekly 行 |
| monthly(结构) | 长期未达标 / 连续未铺清单 | §9b monthly 行 |
| daily | **不跑**——急性问题归 L0-07,指标节点不掺和 | — |

扇出:看板(城市经理/大区)· L1-04/L1-06(上线后按契约读本节点输出)· 台账回写。**绝不**:触发 L0-07/L0-08、回头指挥采集。

---

## 8. HITL 卡点 —— 本节点【无】

纯计算与指标预警,通知非不可逆,**故无 HITL**。铺市/经销商动作的发起与花钱在别处卡(同 L5-01 §8 的口径:本节点只把指标摆上桌)。

---

## 9. References

### 9a. 指标公式表(写死)

| 指标 | 公式 | 分母口径 |
|---|---|---|
| 铺货率 | selling ÷ eligible | L0-04 历史版 active ∩ sku_mix ∩ 窗口有数据;no_data 双不进 |
| 动销率 | moving ÷ pairable_selling | 有售 ∩ 有合格巡访对(**跨窗锚定,一店一窗一判**);no_pair/low_conf/anomaly 排除 |
| 净流出 | prev_qty + Σ期间到货 − current_qty | 到货取 L0-08 received,received_at ∈ (prev, current];prev 可跨窗,回看上限 = 店级 M + 宽限 |

### 9b. 阈值表(占位,回测后定;改阈值只改这张表)

| window | 指标 | 条件(× 战略等级) | 等级 |
|---|---|---|---|
| weekly | 铺货率 | Flagship < `<旗舰铺货线>`(如 85%)/ Core < `<核心线>` / Volume < `<量贩线>` | P1 / P2 / P2 |
| weekly | 铺货率 | cohort 周降 ≥ `<铺货降幅pp>` | P1 |
| monthly | 铺货率 | 连续 `<N_窗口>` 未达标 | P1 |
| 任意 | 任意 | 覆盖不足(no_data 占比 > `<数据薄弱线>`) | 观察 + **data_quality_weak 旗**,不产 P0/P1,提示采集薄弱 |

**动销率达标线(v0.3,按 `effective_stage` 查,各阶段一组,待真实分布校准):**

| effective_stage | 达标线 / 判级口径 | 低于线 |
|---|---|---|
| 导入期 | 达标线**放低** `<导入动销线>`(看铺货点亮,动销低正常) | **不算病,不报警** |
| 成长期 | **动销快增**才达标:环比增 ≥ `<成长动销增幅>` 且 ≥ `<成长动销线>` | 未达标 P2 |
| 成熟期 | 动销稳 ≥ `<成熟动销线>`(+复购) | **低 = 病危,P2(连续/恶化升 P1)** |
| 衰退期 | 动销降**属预期**,按 `<衰退口径>`(只看是否崩塌,不看常规下滑) | 常规下滑**不误报**;崩塌才 P2 |
| 焕新期 | **按成长期口径** | 未达标 P2 |
| 淘汰期 | **不判达标**(stage_no_grading) | — |
| unknown | **不判级**(stage_unknown_no_grading),动销率照算不报警 | — |

> 同一动销率值,导入期可达标、成熟期可病危——**判定线随阶段变,事实不变**。

> 台账叠加规则(沿用 L0-07/L0-06):恶化线 `<恶化_pp>`、阶梯 `<升级天数>`、解除 `<R_天>`,全日历天。

### 9c. 术语表

| 术语 | 含义 | 处理 |
|---|---|---|
| 铺货率 | 铺没铺到店 | 在售÷应覆盖,四桶分类 |
| 动销率 | 铺了卖不卖得动 | 动销÷可判定有售 |
| 巡访对 | (锚定 prev, 窗口内最后合格快照) | 动销判定唯一单元 |
| **跨窗锚定** | prev 取窗口前最近合格快照 | 回看上限 = 店级 M + 宽限;超限 no_pair(v0.2) |
| **一店一窗一判** | 每店每窗唯一一对 | 中间快照不配对;禁多对重复计数(v0.2) |
| 净流出 | prev + 期间到货 − current | 到货必须加回,否则掩盖动销 |
| 铺过但断 | oos 店 | ≠未铺;补货问题不是铺市问题 |
| no_pair | 锚定后仍无合格对 | **绝不当滞销** |
| 可判定有售店 | 动销率的真实分母 | 把"判不了"从"卖不动"里摘出来 |
| **数据薄弱旗** | no_data 占比超线的出件提醒 | 只提示,不改计算不进判级(v0.2) |
| **按阶段判级** | 动销达标线随 effective_stage 切 | 事实不变,只变判定线(v0.3) |
| **stage_unknown_no_grading** | 阶段未知不判达标 | 只算事实,绝不默认阶段顶替(v0.3) |
| **按阶段判级** | 动销达标线随 effective_stage 切 | 事实不变,只变判定线(v0.3) |
| **stage_unknown_no_grading** | 阶段未知不判达标 | 只算事实,绝不默认阶段顶替(v0.3) |

### 9d. 踩坑记录(每次撞墙补一条)

- ❌(v0.3,值得记)**全国/全生命周期一个动销达标线**:导入期新品动销自然低,套成熟期的线 → 被判"病危"误报警,城市经理被叫去抢救一个其实健康的新品;反过来成熟期衰退被导入期的低线掩盖 → ✅ 达标线按 effective_stage 查表,事实不变只变判定线。
- ❌(v0.3)阶段判不出(unknown)时拿"成熟期"当默认线判级 → 导入期新品全被误报病危 → ✅ unknown 不判级(stage_unknown_no_grading),只算事实。
- ❌(v0.3)衰退期动销下降被当"恶化"报警 → 衰退期降本就是预期,报了也没用 → ✅ 衰退口径只看崩塌不看常规下滑。
- ❌ 把各店铺货率简单平均 → 大区数字失真(同 L5-01 g09 教训)→ ✅ pool 口径,沿用 L5-01 校验。
- ❌ 期间到货 24 瓶没加回,库存 4→20 被判"没卖" → 实际卖了 8 瓶 → ✅ 净流出公式加回 L0-08 received。
- ❌(v0.2,值得记)**严格窗口内配对 = 高频店偏差**:B 级双周店周窗口内永远只有一次快照 → 永远 no_pair → 周动销率长期只代表 A 级店,样本系统性偏差,指标看着健康但半数门店从未进样本 → ✅ 跨窗锚定 + 回看上限(店级 M+宽限)。
- ❌(v0.2)A 级店一窗 3 次快照,逐对判出 2 个结果合不到一起,两次跑数不一致 → ✅ 一店一窗一判:唯一首末对,全期到货加回,口径不漂。
- ❌(v0.2)铺货率 81% 配三成店无数据,被管理层当满覆盖数字引用 → 决策建立在 0.7 个样本上没人知道 → ✅ 数据薄弱旗 + summary 强制覆盖提示。
- ❌ B 级店两周一巡凑不出巡访对,被当滞销 → 半数门店"假滞销" → ✅ no_pair 排除分母单独计数。
- ❌ 店没报数当未铺 → 铺货率虚低,指标指向铺市、实际是巡店没去 → ✅ no_data 双不进 + 数据薄弱提示。
- ❌ oos 店算进未铺 → 城市经理拿着名单去谈铺市,到店发现是断货 → ✅ 铺过但断单列。
- ❌ suspended 店还在分母 → 指标被暂停合作的店拖低 → ✅ 分母取 L0-04 历史版 active(级联语义直接引用)。
- ❌ 区域调整后用现行归属算上月指标 → 指标跳变被读成业务波动 → ✅ 按窗口日期取 L0-04 历史版(同 L0-06)。
- _(后续迭代继续往下加)_

---

## 10. Scripts — 锚定配对 / 净流出 / 四桶 / pool / 薄弱旗 / 阶段判级 / 校验(出件前必跑)

```python
from datetime import datetime

def calendar_days(a, b):
    return (datetime.fromisoformat(b) - datetime.fromisoformat(a)).days

# ---- 净流出(命门公式) ----
def net_outflow(prev, current, receipts, tol_move, tol_anom):
    """receipts: 期间 L0-08 received 量合计(received_at ∈ (prev.ts, current.ts])"""
    net = prev["qty"] + receipts - current["qty"]
    if net > tol_move:      return "moving", net
    if net >= -tol_anom:    return "stagnant", net
    return "data_anomaly", net

# ---- v0.2 跨窗锚定 + 一店一窗一判 ----
def build_pair(in_window, pre_window, window_start, store_M, grace):
    """in_window/pre_window: 该店该 SKU 快照按 ts 升序。
       返回 (prev, current, anchor_meta) 或 ("no_pair", reason)。每店每窗只调用一次、只产一对。"""
    if not in_window:
        return None, None, {"verdict": "no_pair", "reason": "窗口内无快照"}
    current = in_window[-1]                                  # 窗口内最后一次合格快照
    if len(in_window) >= 2:
        prev, src = in_window[0], "in_window"                # 窗口内有更早 → 首末对
    elif pre_window:
        prev, src = pre_window[-1], "cross_window"           # 跨窗锚定:窗口前最近一次
        lookback = calendar_days(prev["ts"], window_start)
        if lookback > store_M + grace:                       # 回看上限:店级 M + 宽限
            return None, None, {"verdict": "no_pair",
                                "reason": f"锚定过陈旧:{lookback}d > M{store_M}+{grace}"}
    else:
        return None, None, {"verdict": "no_pair", "reason": "无可锚定历史"}
    return prev, current, {"prev_source": src,
                           "lookback_days": calendar_days(prev["ts"], window_start)}

def judge_store(in_window, pre_window, window_start, store_M, grace,
                receipts_fn, tol_move, tol_anom):
    prev, cur, meta = build_pair(in_window, pre_window, window_start, store_M, grace)
    if prev is None:
        return meta["verdict"], meta
    if prev["conf"] == "low" or cur["conf"] == "low":        # conf 闸门只看两端
        return "low_conf_excluded", meta
    verdict, net = net_outflow(prev, cur, receipts_fn(prev["ts"], cur["ts"]),
                               tol_move, tol_anom)           # 全期到货加回
    return verdict, {**meta, "net": net}

# ---- 四桶铺货分类 ----
def classify_distribution(store_window):
    if store_window["no_reports"]:
        return "no_data"                                     # 双不进
    if store_window["qty_pos_or_normal_low"] or store_window["facings_pos"]:
        return "selling"
    if store_window["has_oos"]:
        return "stocked_but_oos"                             # ≠未铺
    return "not_stocked"

def pooled(numer, denom):
    return round(numer / denom, 2) if denom else None        # Σ分子÷Σ分母;禁 mean(店级比率)

def validate(out, ledger_before, now, pair_log=None):
    errs = []
    d, s = out["distribution"], out["sellthrough"]
    # 公式可重放
    if d["rate"] != pooled(d["selling_stores"], d["eligible_stores"]):
        errs.append("distribution_not_pooled")
    if s["rate"] != pooled(s["moving_stores"], s["pairable_selling_stores"]):
        errs.append("sellthrough_not_pooled")
    # no_data 双不进:分母恒等式
    if d["eligible_stores"] != d["selling_stores"] + d["stocked_but_oos"] + d["not_stocked"]:
        errs.append("denominator_buckets_mismatch")
    # 排除类不漏不重
    if s["pairable_selling_stores"] + s["no_pair"] + s["low_conf_excluded"] + s["data_anomaly"] \
       != d["selling_stores"]:
        errs.append("sellthrough_denominator_leak")
    if s["pairable_selling_stores"] != s["moving_stores"] + s["stagnant_stores"]:
        errs.append("pairable_split_mismatch")
    # ---- v0.2 配对断言 ----
    if pair_log is not None:
        for store, pairs in pair_log.items():
            if len(pairs) > 1:
                errs.append(f"multiple_judgements_per_store_window:{store}")  # 一店一窗一判
            for p in pairs:
                if p.get("prev_source") == "cross_window" and \
                   p.get("lookback_days", 0) > p["store_M"] + p["grace"]:
                    errs.append(f"pair_prev_over_lookback:{store}")           # 回看上限
    # ---- v0.2 数据薄弱旗 ----
    total = d["eligible_stores"] + d["no_data_stores"]
    ratio = d["no_data_stores"] / total if total else 0
    weak_flagged = any(f.startswith("data_quality_weak") for f in out.get("flags", []))
    if ratio > WEAK_LINE and not weak_flagged:
        errs.append("weak_data_unflagged")
    if ratio > WEAK_LINE and "无数据" not in out.get("summary_text", ""):
        errs.append("weak_data_not_in_summary")
    # 旗不改判级:薄弱旗存在时 alerts 等级仍须可由阈值表重放(由等级重放断言覆盖)
    # 分母来源必须是 L0-04 历史版
    if not d.get("denominator_basis", "").startswith("L0-04@"):
        errs.append("denominator_not_versioned")
    # 趋势 cohort 口径(沿用 L5-01 断言)
    for t in (out.get("trend") or {}).values():
        if t and not t.get("insufficient_data") and "cohort_stores" not in t:
            errs.append("trend_without_cohort")
    # 预警台账(沿用 L0-07/L0-06 断言)
    for a in out.get("alerts", []):
        key = (a["metric"], a["sku"], a["scope"])
        cur = ledger_before.get(key)
        if cur and cur["status"] == "active" and a["status"] == "active" and \
           a.get("level") == cur.get("level") and \
           not any(f.startswith("worsened") for f in out.get("flags", [])) and \
           "dedup_suppressed" not in str(out.get("flags", [])):
            errs.append(f"duplicate_metric_alert:{key}")
        if a["status"] == "active" and a.get("duration_days") != calendar_days(a["since"], now):
            errs.append(f"duration_not_calendar:{key}")
        if a["status"] == "resolved" and a.get("resolution_duration") is None:
            errs.append(f"resolve_without_record:{key}")
    # 边界:不触发执行/采集/断货预警
    for f in out.get("fanout", []):
        if any(f.startswith(p) for p in ("补货", "断货预警", "L0-07", "L0-08", "补拍", "重报")):
            errs.append(f"illegal_fanout:{f}")
    # ===== v0.3 动销率按阶段判级 =====
    stage = out.get("effective_stage")
    grade = out.get("sellthrough_grade")
    NO_GRADE_STAGES = {"unknown", "淘汰"}
    # unknown/淘汰 仍判达标 → 报错
    if stage in NO_GRADE_STAGES and grade not in (None, "未判级"):
        errs.append(f"graded_under_no_grade_stage:{stage}")        # unknown 仍判级
    if stage == "unknown" and "stage_unknown_no_grading" not in out.get("flags", []):
        errs.append("unknown_stage_without_flag")
    # 事实计算与阶段无关:sellthrough.rate 必须 = moving/pairable(不被阶段改写)
    st = out.get("sellthrough", {})
    if st.get("pairable_selling_stores") and \
       st.get("rate") != round(st["moving_stores"] / st["pairable_selling_stores"], 2):
        errs.append("sellthrough_rate_altered_by_stage")          # 阶段动了事实=错
    # 判级必须声明所用阶段(可重放),且 = effective_stage(不得全局单线)
    if grade in ("达标", "未达标"):
        if out.get("grading_stage") != stage:
            errs.append("grading_stage_mismatch")
        if out.get("grading_stage") is None:
            errs.append("global_single_line_grading")             # 全局单线判级(无阶段)→报错
    # 动销预警必须带 grading_stage(随阶段)
    for a in out.get("alerts", []):
        if a.get("metric") == "sellthrough_rate" and not a.get("grading_stage"):
            errs.append(f"sellthrough_alert_without_stage:{a.get('scope')}")
    # summary 数字溯源(沿用 L5-01)
    import re, json
    body = json.dumps([out["distribution"], out["sellthrough"], out.get("alerts", [])], ensure_ascii=False)
    for num in re.findall(r"\d+\.?\d*", out.get("summary_text", "")):
        if num not in body and num not in out.get("period", ""):
            errs.append(f"summary_number_unsourced:{num}")
    return errs
```

---

## 11. 评测起手式(14 条种子)

```json
[
 {"id":"d01",
  "input":{"window":"weekly","sku":"6MX-JDX",
           "stores":"96 应覆盖:78 在售、6 oos、12 有数据无证据;另 14 店无上报;64 店有合格巡访对其中 45 动销"},
  "expect":{"distribution":{"rate":0.81,"selling_stores":78,"eligible_stores":96},
            "sellthrough":{"rate":0.70,"moving_stores":45,"pairable_selling_stores":64},
            "buckets_sum_check":true},
  "tags":["正常两率:四桶分类+pool 计算,分母恒等式成立"]},

 {"id":"d02",
  "input":{"pair":{"prev_qty":4,"current_qty":20},"receipts_between":24,
           "params":{"tol_move":1,"tol_anom":3}},
  "expect":{"net":8,"verdict":"moving",
            "naive_without_receipts":"4−20=−16 会被误判 anomaly/滞销"},
  "tags":["到货掩盖动销:净流出公式必须加回 L0-08 received"]},

 {"id":"d03",
  "input":{"store":"远郊店,窗口内 L0-01/L0-02 均无任何上报"},
  "expect":{"bucket":"no_data","in_numerator":false,"in_denominator":false},
  "tags":["no_data 双不进:没报≠没铺"]},

 {"id":"d04",
  "input":{"store":"窗口内仅 1 次快照,且窗口前无任何可锚定历史"},
  "expect":{"sellthrough_verdict":"no_pair","not_stagnant":true,
            "in_sellthrough_denominator":false,"in_distribution_numerator":true},
  "tags":["no_pair 绝不当滞销:进铺货分子、不进动销分母"]},

 {"id":"d05",
  "input":{"pair":{"prev":{"qty":8,"conf":"low"},"current":{"qty":3,"conf":"high"}}},
  "expect":{"verdict":"low_conf_excluded","no_judgement":true},
  "tags":["conf=low(端点)不做动销判定:宁缺勿错判"]},

 {"id":"d06",
  "input":{"window_date":"2026-06-10",
           "l0_04":"店甲 2026-06-15 起 suspended(窗口日期历史版 active);店乙窗口日期历史版已 suspended"},
  "expect":{"店甲_in_denominator":true,"店乙_excluded":true,
            "denominator_basis_contains":"L0-04@"},
  "tags":["分母按窗口日期取 L0-04 历史版"]},

 {"id":"d07",
  "input":{"trend":"本窗口 96 店(新进 10 店未铺拉低全量);cohort 82 店:本 0.84 vs 上 0.85"},
  "expect":{"trend":{"cohort_stores":82,"delta":-0.01},"no_big_drop_alert":true},
  "tags":["同店 cohort:门店进出不伪装成铺货崩塌(沿用 L5-01 g10)"]},

 {"id":"d08",
  "input":{"now":"2026-06-12","rate":0.81,
           "ledger":{"distribution_rate|6MX-JDX|华东|KA":{"status":"active","level":"P1","since":"2026-06-08"}},
           "case2":"次日仍 0.81 未恶化;case3:连续 R 天回到 0.86"},
  "expect":{"replay_level":"P1","case2":{"no_new_alert":true,"flags_contains":"dedup_suppressed"},
            "case3":{"status":"resolved","light_notify":true}},
  "tags":["阈值重放+台账:未恶化静默、恢复 R 天自动解除"]},

 {"id":"d09",
  "input":{"window":"2026-06-08~06-14",
           "店B级":{"M":14,"grace":3,"in_window":[{"ts":"2026-06-11","qty":5,"conf":"high"}],
                   "pre_window_last":{"ts":"2026-06-05","qty":12,"conf":"high"},"receipts":0},
           "店C远郊":{"M":14,"grace":3,"in_window":[{"ts":"2026-06-12","qty":9}],
                    "pre_window_last":{"ts":"2026-05-04","qty":15},"lookback":"35天"}},
  "expect":{"店B级":{"prev_source":"cross_window","lookback_days":3,"net":7,"verdict":"moving",
                    "note":"上周五锚定→本周四,跨窗配对成功,双周店进样本"},
            "店C远郊":{"verdict":"no_pair","reason_contains":"锚定过陈旧:35d > M14+3"}},
  "tags":["v0.2-①:跨窗锚定——双周店不被踢出样本;回看超 M+宽限仍 no_pair"]},

 {"id":"d10",
  "input":{"店A级":{"in_window":[{"ts":"06-09","qty":20,"conf":"high"},
                               {"ts":"06-11","qty":14,"conf":"low"},
                               {"ts":"06-13","qty":6,"conf":"high"}],
                   "receipts_total_period":12,"params":{"tol_move":1}}},
  "expect":{"pairs_produced":1,"pair":"(06-09, 06-13) 首末对",
            "middle_snapshot_conf_low_ignored":true,
            "net":"20+12−6=26","verdict":"moving",
            "no_double_count":true},
  "tags":["v0.2-②:一店一窗一判——3 快照只产首末一对,全期到货加回,中间快照 conf 不影响"]},

 {"id":"d11",
  "input":{"distribution":{"eligible_stores":96,"selling_stores":78,"rate":0.81},
           "no_data_stores":40,"params":{"WEAK_LINE":0.25}},
  "expect":{"ratio":0.294,"flags_contains":"data_quality_weak:0.29",
            "summary_contains":"40 店本窗口无数据","rate_unchanged":0.81,
            "alerts_grading_unchanged":true},
  "tags":["v0.2-③:数据薄弱旗——81% 照算照报但不许被安静相信;旗不改计算不进判级"]},

 {"id":"d12",
  "input":{"sku":"6MX-QY-500","sellthrough_rate":0.55,
           "case_导入":{"effective_stage":"导入"},"case_成熟":{"effective_stage":"成熟"}},
  "expect":{"rate_same":0.55,
            "case_导入":{"sellthrough_grade":"达标","no_alert":true,"grading_stage":"导入"},
            "case_成熟":{"sellthrough_grade":"未达标","alert_level":"P2","grading_stage":"成熟"},
            "fact_identical_grade_opposite":true},
  "tags":["v0.3-①:同动销率0.55,导入达标不报警 vs 成熟未达标病危——事实不变判定相反"]},

 {"id":"d13",
  "input":{"sku":"6MX-QY-500","scope":{"city":"成都"},"sellthrough_rate":0.55,
           "effective_stage":"unknown"},
  "expect":{"rate_computed":0.55,"sellthrough_grade":"未判级",
            "flags_contains":"stage_unknown_no_grading","no_sellthrough_alert":true,
            "not_using_default_stage":true,
            "error_if_graded":"graded_under_no_grade_stage"},
  "tags":["v0.3-③:stage=unknown→动销率照算但不判级,绝不拿默认阶段顶替误报病危"]},

 {"id":"d14",
  "input":{"sku":"6MX-OLD","effective_stage":"衰退","sellthrough":"环比 0.62→0.55 常规下滑(非崩塌)"},
  "expect":{"sellthrough_grade":"按衰退口径未恶化","no_false_alert":true,
            "note":"衰退期动销降属预期,常规下滑不报警;若崩塌才 P2"},
  "tags":["v0.3-②:衰退期动销降属预期,常规下滑不误报"]}
]
```

**打分维度(每条 0/1):**
1. 四桶分类与分母恒等式(d01/d03)
2. 净流出到货还原(d02/d10)
3. **跨窗锚定与回看上限**(d09;§10 pair_prev_over_lookback 断言过)
4. **一店一窗一判**(d10;multiple_judgements 断言过;中间快照 conf 不影响)
5. no_pair/low_conf/anomaly 三类排除(d04/d05;denominator_leak 断言过)
6. 分母历史版口径(d06)
7. pool 不平均 + cohort 趋势(d01/d07,沿用 L5-01 校验)
8. 阈值重放 + 台账防疲劳(d08)
9. **数据薄弱旗**(d11:超线必旗 + summary 必提 + 计算判级不变)
10. **按阶段判级**(d12:同率反判;d13:unknown 不判级;d14:衰退不误报;§10 stage 断言全过)
11. 边界与 summary 溯源、过 §10 校验

> 最常错的会是 d09/d10 这对"配对规则"的缝——锚定上限和一窗一判都是防口径漂移的,两次跑数不一致就从这里查。两率指标一旦失真,L1-04/L1-06 整层跟着错,回归优先跑 d02/d09/d10。

---

## 待填变量(套用时替换)
- `owner` — 本 Skill 负责人/团队
- §9b 全部阈值(各战略等级铺货线/降幅/恶化/升级/R 天)— 回测后定
- **§9b 各阶段动销达标线**(导入动销线/成长动销增幅+线/成熟动销线/衰退口径)— 待真实分布按阶段校准(v0.3)
- `<动销容差>` / `<异常容差>` — 按盘点误差水平定(运营共同)
- **`<宽限天数>`** — 锚定回看上限的缓冲(建议 2~3 天,与巡店排班弹性匹配)(v0.2)
- **`<数据薄弱线>`** — no_data 占比提醒线(建议 25%,回测调)(v0.2)
- `<最小样本量>` — cohort 趋势门槛
- SKU 战略等级主数据 — 经 MCP(与 L0-07 §9a 同源)
- **`effective_stage` 来源 —《SKU 生命周期阶段判定》契约,按 sku×scope×period 对齐(只读)(v0.3)**
- 指标预警台账落库 — 与既有台账同基建分表
