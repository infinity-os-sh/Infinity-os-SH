---
name: sku-investment-planning
description: 回答"这个 SKU 在这个阶段、这个城市该投多少资源、投得值不值"——按生命周期阶段强度区间×基数算投入建议额(规划非拨款),读 L1-03 动销/L1-04 覆盖产出回算费效比(反哺下期),投入建议 clamp 在预算池上限内,费效比低效只标诊断绝不自动砍预算。凡涉及"投入规划、资源投放、投入强度、费效比、投产比、ROI 诊断、该投多少、投得值不值、JBP 投入侧"的输入都用本 Skill。它是 SKU 投入规划的真相源(三地基②·L4 模块层)、JBP 的左手——出投入建议与费效比,**不付款(付款归 L1-07/财务)、不算返利、不判阶段(读 SKU 生命周期)、不自动砍预算(砍是人的决定)**。**接口先行**:财务/ERP 与真实费用未接入,公式全写死,阈值占位。下游:JBP 规划 / 城市经理·财务(投入决策参考)/ 人(费效比诊断后定砍不砍)。
version: v0.2
owner: <填:负责人/团队>
type: Workflow / Skill(L4 模块层 · 投入规划/核算 · 接口先行 · 涉预算规划不涉付款 · 三地基②)
status: 粗糙版 v0.1,接口先行;财务/ERP 与真实费用未接入,投入比例/费效比公式写死,阈值待真实校准
upstream: SKU 生命周期 effective_stage(按 sku×scope×period,只读)/ 预算池上限(经 MCP,占位)/ 投入基数口径(主数据,占位)/ L1-03 动销产出 / L1-04 覆盖产出 / 实际花费(财务,**未接入·占位**)/ 投入台账
downstream: JBP 规划 / 城市经理·财务(投入决策参考)/ 人(费效比诊断后定砍不砍)/ 投入台账(回写)
backlog: <填,如 L4-xx 模块层编号>
---

# SKU 财务投入模块 Skill v0.2 · L4 模块层(三地基②)

> 本 Skill 依据《INFINITY OS · Agent 设计标准 v1.0》编写。
> 它是一个 **Workflow**(写死轨道)+ **投入台账**(有状态,费效比反哺)。
> 回答"**该投多少、投得值不值**"——是 **JBP 的左手**、芯片模型 **L4 模块层**、三地基②(地基①是 SKU 生命周期阶段判定)。

> **⚠️ 三条铁律(贯穿全文):**
> ① **规划非拨款**——本模块出"投入建议额",真支出走 L1-07/财务审批,**本模块不付款、不绕审批**。
> ② **对品规划 ≠ 对人付款**——L1-07 是"给经销商付多少返利"(对象=人,钱要出账);本模块是"给这个 SKU 投多少资源"(对象=品,纸面规划)。两者都涉钱都按阶段调强度,但**绝不混**:本模块不碰兑现、不算返利。
> ③ **费效比低效是诊断不是扳机**——机器算出"投了没用"只标 `low_efficiency` + 反哺建议,**绝不自动砍预算**;砍不砍是人看诊断后的决定。

> **⚠️ 接口先行:** 财务/ERP 与真实费用未接入,投入强度区间、费效比公式全写死,阈值占位待真实校准。

> **v0.2 变更摘要(三块新增,都来自更新版《SKU生命周期经营核心大脑》;v0.1 静态强度全保留):** ①**动态投资调节(投资电流)**——静态阶段强度之上加五个动态动作(加投/减投/转投/救援/焕新淘汰已在阶段逻辑),写死 AND 触发条件,**调节是建议非自动执行,调节后仍 clamp**;②**暂停安全门(财务纪律,最高优先级)**——价格异常/窜货/库存积压/数据不实/供应链断货/渠道冲突(OR 任一)→ **先于一切阶段强度,新增投资置 0、转人工**(暂停只停新增不追回已投;风险事实读相关节点,本模块不自判);③**战略SKU救援例外**——战略价值高 AND 短期弱 → 不直接减投/淘汰,先进救援判断;但**连续 N 期无效触战略止损门转人工**(战略价值不能覆盖长期无效)。**三块都只出建议/诊断,真金白银的加减仍人定/JBP定;规划非拨款、费效比非自动砍一字不动。**

---

## 1. 角色与目标 + 边界【先读这个】

你是 **SKU 投入规划的真相源**:按阶段算"该投多少",按产出回算"投得值不值",反哺下期。产出物是**投入建议 + 费效比诊断**——**建议是 JBP 谈判的输入,不是拨款指令**。

**与兄弟节点边界(写死):**

| 事 | 归谁 | 本节点角色 |
|---|---|---|
| 生命周期阶段 | **《SKU 生命周期阶段判定》(地基①)** | **只读 effective_stage,不重判阶段** |
| 给经销商返利兑现(对人付款) | **L1-07** | 不碰;**本模块只定"对品投多少资源",绝不混入返利/兑现** |
| 实际花费/付款执行 | 财务系统(占位) | **不录支出、不付款**;只读实际花费算费效比 |
| 动销/覆盖产出 | L1-03 / L1-04 | 读其结果作费效比"产出侧",不重算 |
| **投入强度规划 + 费效比诊断 + 反哺** | **本节点** | 唯一真相源 |

**口径铁律:投入 = SKU × 阶段 × 城市/区域 × 时间**——同一 SKU 不同城市不同阶段,投入强度不同(沿用地基①口径)。

**机器与人:** 投入建议本身无 HITL(是规划,不出账)。但**"据费效比砍预算"必须人决定**——机器只标"低效"诊断,绝不自动砍。

---

## 2. 输入(Input)— 含接入状态

| 信号 | 来源 | 状态 | 用途 |
|---|---|---|---|
| effective_stage | 地基①(按 sku×scope×period) | 可用(只读) | 投入强度档位 |
| 预算池上限 | 财务/政策(经 MCP) | **占位** | clamp 上限 |
| 投入基数 | 主数据(收入规模/目标量等) | **占位** | 投入 = 强度 × 基数 |
| 动销产出 | L1-03 | 可用 | 费效比产出侧 |
| 覆盖产出 | L1-04 | 可用 | 费效比产出侧 |
| 实际花费 | 财务/ERP | **未接入·占位** | 费效比投入侧(实际 vs 建议) |
| 改版信号 | 产品主数据 | 占位 | 焕新期投入条件 |
| **风险信号(v0.2)** | L0-06 窜货/价格 · L0-07 断货 · 数据真实性 · 供应链 · 渠道冲突 | 各节点(只读) | **暂停安全门**:本模块不自判,只消费 |
| **动态条件信号(v0.2)** | 生命信号/动销增长/补货速度/反馈/渠道承接/毛利 趋势(L1-03/财务/反馈) | 部分占位 | 动态调节触发判定 |
| **SKU 战略等级(v0.2)** | SKU 主数据(Flagship/Core/Volume 或战略标记) | 经 MCP | 战略救援门 |
| 投入台账 / `now` | 内部 | 可用 | 反哺、节奏 |

> partial 常态:实际花费/预算池未接入时,投入建议以占位基数跑通(标 `source_pending`),**不得当真实拨款**;费效比数据不足判 `unknown`。

---

## 3. 参数定义(Parameters)

| 字段 | 类型 | 说明 |
|---|---|---|
| `sku` / `scope` / `period` | string / object | SKU × 城市/区域 × 月/季 |
| `effective_stage` | enum | 读自地基①,只读不重判 |
| `intensity` | object | `{range: "60-80%", picked: 0.70}`——阶段强度区间 + 选定档(§9a) |
| `base` | number | 投入基数(按阶段口径,§9b) |
| `suggested_investment` | number | **建议额 = clamp(intensity.picked × base, 0, 预算池上限)**;规划非拨款;**暂停门触发时新增部分置 0(v0.2)** |
| **`investment_paused`(v0.2)** | object\|null | 暂停安全门:`{triggered_by: 价格异常/窜货/库存积压/数据不实/供应链断货/渠道冲突, scope: 停新增}`——**停新增不追回已投** |
| **`dynamic_adjustment`(v0.2)** | object\|null | 投资电流:`{action: 加投/减投/转投/无, conditions_hit: [...], suggested_delta, transfer_to?}`——**建议非自动执行** |
| **`strategic_rescue`(v0.2)** | object\|null | 战略救援:`{state: pending/stoploss_reached, strategic_tier, rescue_direction, periods_ineffective}`——战略高+短期弱不自动减投 |
| `within_budget_pool` | bool | 是否在预算池上限内(超则 clamp 并 flag) |
| `cost_efficiency` | object\|null | 费效比诊断:`{investment, output:{动销Δ/覆盖Δ/收入Δ}, ratio, verdict: 高效/一般/低效/unknown}` |
| `feedback` | object | 反哺下期建议:`{next_period_hint, rationale}`——**建议非执行** |
| `status` | enum | `planned` / `source_pending` / `efficiency_unknown` |
| `flags` | string[] | `stage_no_new_investment:淘汰` / `stage_unknown_base_investment` / `over_pool_clamped` / `low_efficiency` / `source_pending` + **`investment_paused:{原因}` / `dynamic_adjust:{action}` / `strategic_rescue_pending` / `strategic_stoploss_reached`(v0.2)** |
| `summary_text` | string | 为什么这个阶段投这么多(数字可溯源,沿用 L5-01) |
| `fanout` | string[] | JBP/看板/台账;**无任何付款/拨款/砍预算项** |

---

## 4. 处理流程(Steps · 链式,月度/季度)

### Step 0 — 暂停安全门【v0.2,最高优先级,先于一切阶段强度】
> **财务纪律:出现风险信号必须先停新增投资,再谈投多少。** 这道门优先级高于阶段强度——哪怕导入期该投 70%,只要风险信号在,新增也置 0。

读风险信号(**本模块只消费不自判**:窜货/价格异常读 L0-06、断货读 L0-07、数据真实性/供应链/渠道冲突读相关节点)。**OR 任一触发即暂停**:
`价格异常 OR 窜货(立案中) OR 库存积压 OR 数据不真实 OR 供应链断货 OR 渠道冲突`
→ `investment_paused = {triggered_by, scope:"停新增"}`,**suggested_investment 的新增部分置 0**,flag `investment_paused:{原因}`,**转人工**。
- **暂停 = 停新增,不追回已投**(已投的钱是另一个处置流程,不在本模块自动发生)。
- 风险解除后,下期正常走 Step A~。

### Step A — 读阶段(只读)
读 effective_stage(按 sku×scope×period,**只读不重判**)。淘汰期 → `stage_no_new_investment`,停止新增投入建议(只核算存量已规划);unknown → 走 Step B 退基准。

### Step B — 查强度区间 × 基数 → 投入建议(脚本,可重放)
1. 按 §9a 阶段投入强度区间取 `intensity`:导入 60-80% / 成长 35-50% / 成熟 25%(基准)/ 衰退低投入 / 焕新有条件(需改版信号,无信号退基准)/ 淘汰停止新增 / **unknown 退回基准(成熟 25% 档)不按阶段加码**(涉钱保守,同 L1-07 范式)。
2. 取 §9b 基数 `base`(**按阶段口径不同**:导入低基数高占比抢点亮 / 成熟高基数低占比稳收益)。
3. `suggested_investment = clamp(intensity.picked × base, 0, 预算池上限)`——**绝不超预算池上限**;超则截断 + flag `over_pool_clamped`(同 L1-07 clamp 铁律)。

### Step B2 — 动态投资调节(投资电流,v0.2)【静态强度之上的动态动作,建议非自动执行】
在阶段基础强度上,按写死 AND 条件判动态动作(§9e):
- **加投**:生命信号强 AND 动销增长 AND 补货加快 AND 反馈正向 AND 渠道愿接 AND 毛利没恶化 → 建议在区间内上调;
- **减投**:投入高 AND 动销弱 AND 无复购 AND 补货慢 AND 反馈弱 AND 渠道承接差 → **先过 Step B3 战略门**再决定是否建议下调;
- **转投**:SKU 本身有价值 AND 当前区域/门店/客户不匹配 → 建议**转投到更匹配处(不是砍!)**,记 `transfer_to`;
- 焕新/淘汰已在阶段逻辑(Step A/§9a)处理。
→ `dynamic_adjustment = {action, conditions_hit, suggested_delta, transfer_to?}`;**调节后投入仍 clamp 预算池上限**;**调节是建议,加减多少仍人定/JBP 定,机器不自动执行**。

### Step B3 — 战略SKU救援门(战略止损门,v0.2)【减投/淘汰判定前必过】
> **战略 SKU 短期弱不直接减投/淘汰,先进救援判断;但战略价值不能覆盖长期无效。**

- **IF 短期表现弱 AND SKU 战略等级高(读主数据)** → **不直接走减投/淘汰**,标 `strategic_rescue_pending`,进救援判断:是区域错/门店错/客户错/价格错/打法错/话术错/生命周期判断错?→ 输出 `rescue_direction`(战略加投/战术调投/区域转场/降投保留/阶段性救援),**不自动减投**。
- **战略止损门**:连续 `<救援无效期N>` 期救援仍无效(长期无效)→ 标 `strategic_stoploss_reached` **转人工**(战略价值不能覆盖长期无效,但"砍"仍是人的决定)。
- **关键**:战略救援**只对"已知战略等级高"的 SKU 生效**,不是所有弱 SKU 的免死金牌——普通 SKU 弱按正常减投走 Step B2。


### Step C — 费效比回算(反哺闭环,地基②的灵魂)
> 投入额 vs 产出(动销提升 L1-03 / 覆盖提升 L1-04 / 收入)→ "这笔投入有没有效"。

1. 读 L1-03 动销Δ、L1-04 覆盖Δ、收入Δ(产出侧)+ 实际花费(投入侧,占位)。
2. `ratio = 产出 / 投入`,按 §9c 阈值定 `verdict`:高效/一般/低效。
3. **数据不足(产出或花费缺)→ `verdict: unknown`,不硬算费效比**(`efficiency_unknown`)——**与投入建议的 unknown 独立**:阶段清楚但产出没回流时,投入建议照出,费效比单独标 unknown。
4. **费效比 = 阶段感知**:导入期投入有滞后(点亮需时间),费效比阈值按阶段宽容(§9c),**不拿成熟期标准苛求导入期**(否则新品投入永远显"低效"被误砍)。

### Step D — 反哺下期(建议非执行)
- `verdict=低效` → `feedback.next_period_hint` 建议下调 + 标 `low_efficiency` 诊断;**绝不自动砍本期或下期预算**——砍不砍是人看诊断后的决定(HITL/线下)。
- `verdict=高效` → 可建议维持/加码(仍在政策区间内,clamp)。
- `verdict=unknown` → 不反哺(没数据不瞎建议)。

### Step E — 出件
脚本产 intensity/base/suggested_investment/cost_efficiency → LLM 写 summary_text(为什么这个阶段投这么多,数字可溯源)→ 跑 §10 → 扇出(JBP/看板/台账)→ 回写投入台账。

---

## 5. 规则与强度(RFC2119)

| 强度 | 规则 |
|---|---|
| **MUST** | **暂停安全门优先于阶段强度**:价格异常/窜货/库存积压/数据不实/供应链断货/渠道冲突(OR 任一)→ 新增投资置 0、转人工;暂停只停新增不追回已投;风险事实读相关节点,本模块不自判(v0.2)。 |
| **MUST** | **动态调节须条件可重放(AND 写死)、调节后仍 clamp、是建议非自动执行**;转投是建议转到更匹配处不是砍(v0.2)。 |
| **MUST** | **战略等级高 + 短期弱不自动减投/淘汰**,先标 strategic_rescue_pending 进救援判断、出 rescue_direction;但**不得无限保护**——连续 N 期无效触 strategic_stoploss_reached 转人工(战略价值不能覆盖长期无效)(v0.2)。 |
| **MUST NOT** | **战略救援只对已知战略等级高的 SKU 生效**,不是所有弱 SKU 的免死金牌;普通弱 SKU 按正常减投(v0.2)。 |
| **MUST** | 投入建议 = 阶段强度 × 基数,照 §9a/§9b 脚本可重放;阶段强度区间不内嵌,占位待校准。 |
| **MUST** | 投入建议必须 clamp 在预算池上限内,超则截断 + flag;**绝不超预算池上限**(同 L1-07)。 |
| **MUST** | `stage=unknown` 退回基准(成熟 25%)不按阶段加码;淘汰期停止新增投入(只核算存量);涉钱保守(同 L1-07 范式)。 |
| **MUST NOT** | **本模块只规划不付款、不绕审批**——投入建议是 JBP 输入不是拨款;真支出走 L1-07/财务;绝不录支出、不算返利、不碰兑现。 |
| **MUST NOT** | **费效比低效是诊断不是自动砍预算**——机器只标 `low_efficiency` + 反哺建议,**砍不砍是人的决定**;绝不自动砍本期/下期预算。 |
| **MUST** | 算账事实(基数/产出Δ/实际花费/政策上限)与阶段无关;阶段只动强度档位,不改事实。 |
| **MUST NOT** | 阶段**只读地基① effective_stage,绝不重判阶段**。 |
| **MUST** | 费效比数据不足判 `unknown` 不硬算;费效比 unknown 与投入建议 unknown 独立(阶段清楚但产出缺时投入照出)。 |
| **SHOULD** | 费效比阈值应按阶段宽容(导入期投入有滞后,不拿成熟标准苛求);反哺建议应附 rationale。 |
| **MAY** | 可附投入-产出时间轴;连续 N 期低效可加注"持续低效"供人重点复核(仍不自动砍)。 |

---

## 6. 输出(Output · Artifact 契约)

```json
{
  "sku": "6MX-QY-500", "scope": { "city": "成都" }, "period": "2026-Q2",
  "effective_stage": "导入",
  "intensity": { "range": "60-80%", "picked": 0.70 },
  "base": 200000,
  "suggested_investment": 140000,
  "investment_basis": "导入强度0.70 × 基数200000 = 140000;预算池上限180000,在池内未截断",
  "within_budget_pool": true,
  "cost_efficiency": {
    "investment": 120000, "output": { "动销Δ": "+18%(L1-03)", "覆盖Δ": "+9店(L1-04)" },
    "ratio": "<按§9c>", "verdict": "一般",
    "stage_tolerance": "导入期阈值宽容:点亮有滞后,不按成熟标准判低效"
  },
  "feedback": { "next_period_hint": "维持导入强度,覆盖已起势", "rationale": "动销+覆盖双正,点亮中" },
  "investment_paused": null,
  "dynamic_adjustment": { "action": "加投", "conditions_hit": ["生命信号强","动销增长","补货加快","反馈正向","渠道愿接","毛利未恶化"], "suggested_delta": "+区间内上调至上限80%", "transfer_to": null },
  "strategic_rescue": null,
  "status": "planned",
  "flags": ["dynamic_adjust:加投"],
  "summary_text": "加点鲜500ml@成都(导入期):按导入强度70%×基数20万=建议投入14万(预算池上限18万内)。六项动态条件全满足→建议加投至区间上限。上期投12万换来动销+18%、覆盖+9店,导入期阈值下评'一般'(点亮有滞后,不苛求);建议维持加投。注:本额为JBP规划建议,加减多少与实际支出走财务审批,机器不自动执行。"
}
```

> 成熟基准示例:`effective_stage:"成熟", intensity:{range:"25%",picked:0.25}` ——基准档正常核算。
> 超池截断示例:`intensity.picked×base=200000 > 池上限180000 → suggested_investment:180000, flags:["over_pool_clamped:200000→180000"]` ——绝不超池。
> 淘汰停增示例:`effective_stage:"淘汰", suggested_investment:0, flags:["stage_no_new_investment"]` ——只核算存量。
> unknown 退基准示例:`effective_stage:"unknown", intensity:{picked:0.25}(成熟基准), flags:["stage_unknown_base_investment"]` ——不加码。
> 费效比低效示例:`cost_efficiency:{verdict:"低效"}, feedback:{next_period_hint:"建议下调"}, flags:["low_efficiency"]` ——**仅诊断+建议,不自动砍;砍不砍人定**。
> 费效比数据不足示例:`cost_efficiency:{verdict:"unknown"}, status:"efficiency_unknown"` ——投入建议仍照出,费效比单独标 unknown。
> **暂停门示例(v0.2):** `investment_paused:{triggered_by:"窜货(L0-06立案中)",scope:"停新增"}, suggested_investment:0(新增部分), flags:["investment_paused:窜货"]` ——**先于阶段强度,停新增不追回已投,转人工**。
> **转投示例(v0.2):** `dynamic_adjustment:{action:"转投", transfer_to:"邻区高匹配门店", conditions_hit:["SKU有价值","当前区域不匹配"]}` ——**建议转投不是砍**。
> **战略救援示例(v0.2):** 战略 Flagship 短期弱 → `strategic_rescue:{state:"pending", strategic_tier:"Flagship", rescue_direction:"区域转场"}, 不自动减投`;连续 N 期无效 → `strategic_rescue:{state:"stoploss_reached"}, 转人工`。

---

## 7. 节奏 + 扇出(写死)

| 项 | 规则 |
|---|---|
| 节奏 | 月度/季度(投入规划周期);非周期不重算 |
| 扇出 | JBP 规划 · 城市经理/财务看板(投入决策参考)· 投入台账回写 · 费效比诊断给人 |
| 禁区 | **绝不**:付款/拨款、绕 L1-07/财务审批、录支出、算返利/碰兑现、据费效比自动砍预算、重判阶段、超预算池上限;**自动执行动态调节、自判风险事实、自动减投战略SKU、无限保护战略SKU(v0.2)** |

---

## 8. HITL 卡点 —— 本节点【投入建议无,砍预算有】

- **投入建议无 HITL**:它是规划不出账,不可逆性为零(真支出在 L1-07/财务那条线卡 HITL)。
- **"据费效比砍预算"必须人决定**:机器只标 `low_efficiency` 诊断 + 反哺建议,砍不砍、砍多少由人(HITL 或线下决策)定。**机器绝不自动砍**——理由见 §9d 死亡螺旋:很多投入(尤其导入期点亮)有滞后效应,机器按短期费效比自动砍会扼杀本该见效的投入。

---

## 9. References

### 9a. 阶段投入强度区间(写死,占位待校准;照 PDF)

| effective_stage | 投入强度 | 取向 |
|---|---|---|
| 导入 | 60-80% | 高占比抢点亮 |
| 成长 | 35-50% | 倾斜复制放大 |
| 成熟 | 25%(**基准**) | 稳收益正常核算 |
| 衰退 | 低投入 `<占位>` | 削减止损 |
| 焕新 | 按成长**但需改版信号**;无信号退基准 | 重启需依据 |
| 淘汰 | **停止新增(stage_no_new_investment)** | 只核算存量 |
| unknown | **退回基准(成熟25%)不加码** | 涉钱保守(同 L1-07) |

### 9b. 投入基数口径(按阶段不同;占位)

| 阶段 | 基数取向 |
|---|---|
| 导入 | **低基数 × 高占比**(盘子小但敢砸,抢点亮) |
| 成熟 | **高基数 × 低占比**(盘子大但克制,稳收益) |

> 基数具体口径(收入规模/目标量/历史投入)接入主数据后定。

### 9c. 费效比公式(写死;阈值按阶段宽容,占位)

`ratio = 产出(动销Δ×权重 + 覆盖Δ×权重 + 收入Δ×权重) / 投入(实际花费)`

| verdict | 条件(阶段宽容) | 处理 |
|---|---|---|
| 高效 | ratio ≥ `<阶段高效线>` | 可建议维持/加码(clamp) |
| 一般 | 区间内 | 维持 |
| 低效 | ratio < `<阶段低效线>` | **标诊断+反哺建议,不自动砍** |
| unknown | 产出或花费数据不足 | 不硬算,不反哺 |

> 导入期低效线**更宽容**(点亮有滞后);成熟期最严(该见效了)。阈值占位回测校准。

### 9e. 动态投资调节条件表(v0.2,写死 AND 条件;占位待校准)

| 动作 | 触发条件(全部 AND) | 建议 |
|---|---|---|
| **加投** | 生命信号强 AND 动销增长 AND 补货加快 AND 反馈正向 AND 渠道愿接 AND 毛利未恶化 | 区间内上调 |
| **减投** | 投入高 AND 动销弱 AND 无复购 AND 补货慢 AND 反馈弱 AND 渠道承接差 | **先过 §9f 战略门**再议下调 |
| **转投** | SKU 有价值 AND 当前区域/门店/客户不匹配 | **转投更匹配处(不是砍)**,记 transfer_to |
| 焕新/淘汰 | 已在阶段逻辑(§9a) | — |

> 调节是**建议非自动执行**;调节后仍 clamp 预算池上限;加减多少人定/JBP 定。

### 9f. 战略SKU救援门(v0.2,战略止损门)

| 判定 | 条件 | 处理 |
|---|---|---|
| 进救援 | 短期弱 AND **战略等级高**(主数据) | `strategic_rescue_pending`,**不自动减投/淘汰**,出 rescue_direction |
| 救援方向 | 区域错/门店错/客户错/价格错/打法错/话术错/生命周期判断错 | 战略加投/战术调投/区域转场/降投保留/阶段性救援 |
| 战略止损 | 连续 `<救援无效期N>` 期仍无效 | `strategic_stoploss_reached` **转人工**(战略不能覆盖长期无效;砍仍人定) |

> **战略救援只对已知战略等级高的 SKU 生效**,不是所有弱 SKU 的免死金牌;普通弱 SKU 走正常减投。

### 9d. 术语 / 踩坑

| 术语 | 含义 |
|---|---|
| 对品规划 vs 对人付款 | 本模块投 SKU 资源(规划)≠ L1-07 给经销商付返利(出账) |
| 费效比 | 产出/投入,反哺下期(地基②灵魂) |
| 投入 unknown vs 费效比 unknown | 阶段判不出退基准 / 产出缺判费效比 unknown,两者独立 |
| **投资电流(v0.2)** | 静态强度之上的动态调节(加/减/转投),建议非自动执行 |
| **暂停安全门(v0.2)** | 风险信号 OR 任一即停新增,优先级高于阶段强度 |
| **战略救援(v0.2)** | 战略高+短期弱不自动砍,先救援;长期无效触止损转人工 |

- ❌ 本模块直接把"建议投入14万"当拨款付出去 → 绕过 L1-07/财务审批 → ✅ 规划非拨款,真支出走财务线。
- ❌ 把对经销商的返利和对 SKU 的投入混在一个数里 → 对人付款和对品规划纠缠 → ✅ 两轴正交,本模块不碰返利。
- ❌(地基②灵魂,值得记)**费效比低就自动砍预算**:导入期投了 5 万动销没立刻动 → 机器自动砍 → 点亮投入有滞后,砍了新品就死了 → 陷入"投→短期没效→砍→更没效→再砍"死亡螺旋 → ✅ 低效只标诊断+反哺建议,砍不砍人定;费效比阈值按阶段宽容,不拿成熟标准苛求导入。
- ❌(v0.2,值得记)**只有静态强度没动态调节**:该加投时(六条件全满足)还按固定 70% 投,错失加速窗口;或当前区域不匹配时直接减投,把一个本该转投别处的好 SKU 砍了 → ✅ 投资电流:满足加投条件建议加投、不匹配建议转投(不是砍)。
- ❌(v0.2,值得记)**没暂停门**:窜货立案中/数据不真实时还在按阶段砸钱 → 给问题区域继续输血、基于假数据决策 → ✅ 暂停安全门优先于一切阶段强度,风险信号 OR 任一即停新增,转人工。
- ❌(v0.2,值得记)**战略SKU被当普通SKU按ROI砍**:一个用来对抗竞品/占位货架的战略 Flagship,短期 ROI 难看就被自动减投/淘汰 → 砍掉了战略阵地,竞品趁虚而入 → ✅ 战略救援门:战略高+短期弱先救援不自动砍;但也不无限保护,长期无效触止损转人工。
- ❌ 阶段判不出按"可能导入期"投 70% → 多投了钱 → ✅ unknown 退回基准 25%,涉钱保守。
- ❌ 投入建议超预算池上限照出 → 规划脱离盘子 → ✅ clamp 不超池(同 L1-07)。
- ❌ 淘汰期 SKU 还在按阶段产生新增投入建议 → 给要退的品规划砸钱 → ✅ stage_no_new_investment 只核算存量。
- ❌ 用阶段改了产出Δ/实际花费去凑费效比 → 阶段污染算账事实 → ✅ 阶段只动强度档位,事实不动。
- _(后续迭代继续往下加)_

---

## 10. Scripts — 投入重放 / clamp / 费效比 / unknown / 溯源(出件前必跑)

```python
INTENSITY = {  # §9a 占位
  "导入": (0.60, 0.80), "成长": (0.35, 0.50), "成熟": (0.25, 0.25),
  "衰退": (0.05, 0.15), "焕新": (0.35, 0.50), "unknown": (0.25, 0.25),  # unknown=成熟基准
}
NO_NEW_INVEST_STAGES = {"淘汰"}
BASE_STAGE = "成熟"  # 退基准锚点
STOPLOSS_N = 3       # v0.2 战略救援无效期上限(占位)

def suggest_investment(stage, base, pool_cap, picked=None, has_revamp=False):
    if stage in NO_NEW_INVEST_STAGES:
        return 0, "stage_no_new_investment"
    if stage == "焕新" and not has_revamp:
        stage = BASE_STAGE                       # 无改版信号退基准
    lo, hi = INTENSITY.get(stage, INTENSITY[BASE_STAGE])   # unknown/缺失→基准
    p = picked if picked is not None else (lo + hi) / 2
    raw = p * base
    capped = min(raw, pool_cap)                  # clamp 不超池
    return round(capped, 2), ("over_pool_clamped" if raw > pool_cap else None)

def cost_efficiency(output, investment, stage, thresholds):
    """数据不足→unknown,不硬算。阈值按阶段宽容。"""
    if investment in (None, 0) or output is None:
        return {"verdict": "unknown"}            # 费效比 unknown,独立于投入 unknown
    ratio = output / investment
    hi, lo = thresholds[stage]["high"], thresholds[stage]["low"]   # 导入 lo 更宽容
    verdict = "高效" if ratio >= hi else ("低效" if ratio < lo else "一般")
    return {"ratio": round(ratio, 3), "verdict": verdict}

def validate(out, pool_cap, policy=None):
    errs = []
    stage = out.get("effective_stage")
    inv = out.get("suggested_investment")
    # ===== v0.2 暂停安全门(最高优先级):风险信号在→新增必须为 0 =====
    PAUSE_SIGNALS = {"价格异常","窜货","库存积压","数据不实","供应链断货","渠道冲突"}
    paused = out.get("investment_paused")
    if paused:
        if (out.get("_new_investment", inv) or 0) > 0:
            errs.append("risk_signal_but_new_investment")      # 有风险仍出新增→报错
        if "investment_paused" not in str(out.get("flags", [])):
            errs.append("paused_without_flag")
        if out.get("_clawback_existing"):
            errs.append("pause_clawed_back_existing")          # 暂停只停新增不追回
    if out.get("_risk_signal_self_judged"):
        errs.append("risk_fact_self_judged")                   # 风险事实须读节点不自判
    # ===== 投入可重放 + clamp =====
    if inv is not None and not paused:
        exp, flag = suggest_investment(stage, out.get("base", 0), pool_cap,
                                       out.get("intensity", {}).get("picked"),
                                       out.get("_has_revamp", False))
        if inv != exp:
            errs.append("investment_not_replayable")
        if inv > pool_cap:
            errs.append("over_pool_cap")                       # 绝不超池
        if inv > pool_cap and "over_pool_clamped" not in str(out.get("flags", [])):
            errs.append("over_cap_not_clamped")
    # ===== unknown 退基准不加码 =====
    if stage == "unknown":
        lo, hi = INTENSITY[BASE_STAGE]
        if out.get("intensity", {}).get("picked", 0) > hi:
            errs.append("unknown_stage_over_base")             # unknown 超基准=加码
        if "stage_unknown_base_investment" not in str(out.get("flags", [])):
            errs.append("unknown_without_base_flag")
    # ===== 淘汰停止新增 =====
    if stage in NO_NEW_INVEST_STAGES and (inv or 0) > 0 and \
       "stage_no_new_investment" not in str(out.get("flags", [])):
        errs.append("clearance_new_investment")
    # ===== v0.2 动态调节:条件可重放、仍 clamp、建议非自动执行 =====
    dyn = out.get("dynamic_adjustment")
    if dyn and dyn.get("action") in ("加投","减投","转投"):
        if not dyn.get("conditions_hit"):
            errs.append("dynamic_without_conditions")          # AND 条件须留痕可重放
        if dyn.get("_auto_executed"):
            errs.append("dynamic_auto_executed")               # 调节是建议非自动执行
        if dyn.get("_adjusted_over_pool"):
            errs.append("dynamic_over_pool")                   # 调节后仍 clamp
        if dyn.get("action") == "转投" and dyn.get("_treated_as_cut"):
            errs.append("transfer_treated_as_cut")             # 转投不是砍
    # ===== v0.2 战略救援门 =====
    sr = out.get("strategic_rescue")
    # 战略高+短期弱被自动减投 → 报错
    if out.get("_strategic_tier_high") and out.get("_short_term_weak"):
        if out.get("_auto_cut_or_eliminated"):
            errs.append("strategic_sku_auto_cut")              # 战略SKU被自动砍
        if not sr or sr.get("state") not in ("pending","stoploss_reached"):
            errs.append("strategic_not_rescued_first")         # 未先进救援
    # 救援只对战略高生效:普通SKU不得借救援免死
    if sr and sr.get("state") == "pending" and not out.get("_strategic_tier_high"):
        errs.append("non_strategic_rescue_abuse")              # 普通SKU滥用救援免死
    # 长期无效仍自动保护 → 报错
    if sr and sr.get("periods_ineffective", 0) >= STOPLOSS_N:
        if sr.get("state") != "stoploss_reached":
            errs.append("infinite_protection_no_stoploss")     # 长期无效仍保护
    # ===== 规划不付款:绝无付款/拨款扇出 =====
    for f in out.get("fanout", []):
        if any(x in f for x in ("付款", "拨款", "兑现", "返利", "L1-07:付", "砍预算", "扣预算")):
            errs.append(f"illegal_fund_action:{f}")            # 越界到付款/砍预算
    # ===== 费效比低效不得自动砍 =====
    if out.get("cost_efficiency", {}).get("verdict") == "低效":
        if out.get("_budget_auto_cut"):
            errs.append("low_efficiency_auto_cut")             # 自动砍预算=禁
        if "low_efficiency" not in str(out.get("flags", [])):
            errs.append("low_efficiency_without_diagnosis_flag")
    # ===== 费效比 unknown 独立:产出缺不阻断投入建议 =====
    ce = out.get("cost_efficiency") or {}
    if ce.get("verdict") == "unknown" and inv is None and stage not in NO_NEW_INVEST_STAGES \
       and not paused:
        errs.append("efficiency_unknown_blocked_investment")   # 费效比 unknown 不该挡投入建议
    # ===== 算账事实不被阶段污染 =====
    if out.get("_fact_altered_by_stage"):
        errs.append("accounting_fact_polluted_by_stage")
    # ===== 阶段调整须溯源 =====
    if inv and stage not in ("unknown", None, "淘汰") and not out.get("investment_basis"):
        errs.append("investment_without_basis")
    return errs
```

---

## 11. 评测起手式(8 条种子)

```json
[
 {"id":"f01",
  "input":{"effective_stage":"导入","base":200000,"pool_cap":180000,"picked":0.70},
  "expect":{"intensity_range":"60-80%","suggested_investment":140000,"within_pool":true,
            "basis_replayable":"0.70×200000=140000"},
  "tags":["导入期高投:强度×基数可重放,在池内"]},

 {"id":"f02",
  "input":{"effective_stage":"成熟","base":400000,"pool_cap":200000,"picked":0.25},
  "expect":{"intensity_range":"25%基准","suggested_investment":100000,"no_stage_premium":true},
  "tags":["成熟期基准:25%正常核算,不加码"]},

 {"id":"f03",
  "input":{"effective_stage":"衰退","base":300000,"picked":0.10},
  "expect":{"suggested_investment":30000,"reduced":true,"note":"低投入止损"},
  "tags":["衰退期削减:低投入"]},

 {"id":"f04",
  "input":{"effective_stage":"淘汰","base":300000},
  "expect":{"suggested_investment":0,"flags_contains":"stage_no_new_investment",
            "error_if_new":"clearance_new_investment","settle_existing_only":true},
  "tags":["淘汰期停止新增:只核算存量,不产新投入建议"]},

 {"id":"f05",
  "input":{"effective_stage":"unknown","base":300000,"pool_cap":200000},
  "expect":{"intensity_picked":0.25,"suggested_investment":75000,
            "flags_contains":"stage_unknown_base_investment","no_premium":true,
            "error_if_over_base":"unknown_stage_over_base",
            "contrast":"涉钱保守,同L1-07:不知阶段退基准不加码"},
  "tags":["unknown退基准:成熟25%档不按阶段加码"]},

 {"id":"f06",
  "input":{"effective_stage":"导入","base":300000,"pool_cap":180000,"picked":0.70},
  "expect":{"raw":"0.70×300000=210000","suggested_investment":180000,
            "capped":true,"flags_contains":"over_pool_clamped",
            "error_if_passed":"over_pool_cap"},
  "tags":["超预算池上限→clamp截断,绝不超池(同L1-07)"]},

 {"id":"f07",
  "input":{"effective_stage":"导入","investment":50000,"output":"动销+2%覆盖+1店(导入期早期)",
           "attempted":"机器据低费效比自动砍下期预算"},
  "expect":{"verdict":"按导入宽容阈值评(可能仍'一般')","flags_contains":"low_efficiency 仅当真低",
            "blocked":"low_efficiency_auto_cut","budget_not_cut":true,
            "to_human":"砍不砍人定","rationale":"导入点亮有滞后,自动砍=死亡螺旋"},
  "tags":["费效比低效=诊断非自动砍:机器只标,砍是人决定;阶段宽容防误砍导入"]},

 {"id":"f08",
  "input":{"suggested_investment":140000,"event":"模块试图直接付款/拨款这14万"},
  "expect":{"blocked":"illegal_fund_action","note":"规划非拨款,真支出走L1-07/财务审批",
            "no_payment_no_rebate":true},
  "tags":["规划不触发付款:不绕审批、不碰返利兑现"]},

 {"id":"f09",
  "input":{"effective_stage":"成长","picked":0.40,"pool_cap":300000,"base":500000,
           "dynamic_conditions":"生命信号强+动销增长+补货加快+反馈正向+渠道愿接+毛利未恶化(全满足)"},
  "expect":{"dynamic_adjustment":{"action":"加投","conditions_hit":"六条全列"},
            "suggested_delta":"区间内上调","still_clamped":"≤300000","not_auto_executed":true},
  "tags":["v0.2:满足加投六条件→建议加投;仍clamp;建议非自动执行"]},

 {"id":"f10",
  "input":{"sku":"6MX-X有价值","case":"当前区域不匹配但SKU本身有价值"},
  "expect":{"dynamic_adjustment":{"action":"转投","transfer_to":"更匹配区域/门店"},
            "not_a_cut":true,"error_if_cut":"transfer_treated_as_cut"},
  "tags":["v0.2:转投不是砍——好SKU换地方,不砍掉"]},

 {"id":"f11",
  "input":{"effective_stage":"导入","picked":0.70,"risk_signal":"窜货 L0-06 立案中"},
  "expect":{"investment_paused":{"triggered_by":"窜货"},"new_investment":0,
            "flags_contains":"investment_paused","to_human":true,
            "priority":"高于导入70%强度","error_if_invested":"risk_signal_but_new_investment"},
  "tags":["v0.2:窜货立案中→暂停新增(优先于阶段强度);数据不实同理"]},

 {"id":"f12",
  "input":{"risk_signal":"数据不真实","existing_invested":"已投80000"},
  "expect":{"new_investment":0,"flags_contains":"investment_paused",
            "existing_not_clawed_back":"已投80000不追回","error_if_clawback":"pause_clawed_back_existing"},
  "tags":["v0.2:暂停只停新增不追回已投;风险事实读节点不自判"]},

 {"id":"f13",
  "input":{"sku":"战略Flagship","strategic_tier":"high","short_term":"弱(ROI难看)"},
  "expect":{"strategic_rescue":{"state":"pending","rescue_direction":"区域转场/战术调投等"},
            "not_auto_cut":true,"error_if_cut":"strategic_sku_auto_cut",
            "note":"战略高+短期弱先救援不直接砍"},
  "tags":["v0.2:战略SKU短期弱→救援pending不砍(对抗竞品/占位的品)"]},

 {"id":"f14",
  "input":{"case_普通":{"sku":"Volume普通","short_term":"弱"},
           "case_战略长期":{"sku":"战略Flagship","periods_ineffective":3,"params":{"STOPLOSS_N":3}}},
  "expect":{"case_普通":{"normal_reduction":true,"no_rescue_immunity":true,"error_if_abuse":"non_strategic_rescue_abuse"},
            "case_战略长期":{"flags":"strategic_stoploss_reached","to_human":true,
                          "error_if_protected":"infinite_protection_no_stoploss"}},
  "tags":["v0.2:普通SKU弱正常减投(非免死);战略SKU长期无效→止损转人工(不无限保护)"]}
]
```

**打分维度(每条 0/1):**
1. 导入高投可重放(f01)
2. 成熟基准不加码(f02)
3. 衰退削减(f03)
4. 淘汰停增(f04)
5. unknown 退基准(f05)
6. 超池 clamp(f06)
7. **费效比低效=诊断非自动砍**(f07)
8. 规划不付款不绕审批(f08)
9. **动态加投/转投建议非自动执行**(f09/f10:转投不是砍)
10. **暂停安全门优先级 + 只停新增不追回**(f11/f12)
11. **战略救援不自动砍 + 不无限保护 + 非免死金牌**(f13/f14)

> 最危险的错(v0.1 两类 + v0.2 三类):**越界付款**(f08)、**费效比自动砍**(f07)、**没暂停门照砸钱**(f11——窜货/数据不实时还在输血)、**战略SKU被当普通SKU按ROI砍**(f13——砍掉对抗竞品/占位货架的战略品)、**战略SKU被无限保护**(f14——战略价值不能覆盖长期无效)。三道新增逻辑的共性:**机器只出建议/诊断/暂停标记,真金白银的加减永远在人和 L1-07/财务那条线**。暂停门是唯一的例外——它优先级最高,因为"先别在出问题的地方继续砸钱"是财务纪律的底线。

---

## 待填变量(套用时替换)
- `owner` / backlog 编号(L4 模块层)
- §9a 各阶段投入强度区间 / §9b 基数口径 / §9c 费效比阈值(按阶段宽容)— 全部回测校准
- **§9e 动态调节六条件阈值 / §9f 战略救援方向判据 + `<救援无效期N>`(战略止损门)— 回测校准(v0.2)**
- **风险信号读取口径(v0.2):窜货/价格 L0-06、断货 L0-07、数据真实性/供应链/渠道冲突各源——本模块只消费不自判**
- **SKU 战略等级来源(v0.2)— SKU 主数据(经 MCP)**
- 预算池上限来源 — 财务/政策(经 MCP)
- **实际花费数据源 / ERP** — 接入(经 MCP);接入后更新 §2 状态,费效比从占位转真实
- L1-03/L1-04 产出读取口径对齐
- `effective_stage` 来源 — 地基①《SKU 生命周期阶段判定》契约(只读)
- 投入台账落库 — 与既有台账同基建分表
