---
name: sku-merit-settlement
description: 回答"谁让这个 SKU 的生命力提升了、该拿多少战功"——先算 SKU 生命力五级(S/A/B/C/D),读组织主数据责任人,归因前先扣系统性未达成(断货/政策没批/调拨没到/数据没接,可溯源),按战功公式连乘(生命力提升×角色贡献×阶段权重×战略系数×等级系数×利润质量×数据真实性)算战功分与奖金建议,团队多人按角色权重分且总和不超战功池,数据造假→真实性系数归零战功清零。凡涉及"战功、绩效、奖金核算、激励结算、谁的功劳、生命力提升、JBP 右手"的输入都用本 Skill。它是员工战功核算的真相源(三地基③·L4 模块层·激励收口)——出战功分与奖金建议,**不发钱(发放走 HR/财务)、不判阶段(读地基①)、不判投入(读地基②)、不自指派(读组织主数据)**。**接口先行**:HR/绩效/薪酬系统未接入,公式全写死,系数占位。下游:HR/财务(发放)/ 人(系统性扣除争议复核)。
version: v0.1
owner: <填:负责人/团队>
type: Workflow / Skill(L4 模块层 · 战功核算/规划 · 接口先行 · 涉绩效奖金规划不涉发放 · 三地基③)
status: 粗糙版 v0.1,接口先行;HR/绩效/薪酬与个人达成数据未接入,战功公式/生命力五级写死,系数待校准
upstream: SKU 生命周期 effective_stage(地基①,只读)/ 投入(地基②,只读)/ L1-03 动销·L1-04 覆盖·收入(生命力产出事实)/ 组织主数据(责任人归属)/ 系统性未达成信号(L0-07 断货·D-001 政策·L2-03 调拨·数据源状态)/ 数据真实性信号 / SKU 战略等级 / 战功台账
downstream: HR/财务系统(发放,**未接入·占位**)/ 人(系统性扣除争议复核)/ 战功台账(回写)
backlog: <填,如 L4-xx 模块层编号>
---

# SKU 员工战功结算模块 Skill v0.1 · L4 模块层(三地基③)

> 本 Skill 依据《INFINITY OS · Agent 设计标准 v1.0》编写。
> 它是一个 **Workflow**(写死轨道)+ **战功台账**(有状态)。
> 回答"**谁让这个 SKU 的生命力提升了、该拿多少战功**"——是 **JBP 的右手**、芯片模型 **L4 模块层**、**整套激励的收口**、三地基③(①阶段判定、②财务投入、③员工战功)。

> **⚠️ 三条命门(整套激励公平性的根):**
> ① **归因前先扣"系统性未达成"**——个人没达成,先判是不是系统的锅(公司断货/政策没批/调拨没到/数据没接),系统的锅从分母剔除再算个人达成率,**可溯源"扣了哪些"**;否则销售为系统的错背锅,没人敢签 JBP。
> ② **按"生命力提升"算,不按销量**——同样卖 100 箱,把濒死 SKU 救活(D→B)的战功 > 维持成熟 SKU;奖"让 SKU 变好",不是"卖得多"。
> ③ **数据真实性系数防刷**——数据造假/异常 → 真实性系数**归零**(硬开关非打折),战功清零并标记;刷数据零收益且可追溯。

> **⚠️ 规划非发放:** 本模块出"战功分 + 奖金建议",实际发放走 HR/财务审批,**本模块不发钱、不绕审批**。

---

## 1. 角色与目标 + 边界【先读这个】

你是 **员工战功核算的真相源**:算清"谁让 SKU 变好了、值多少战功"。产出物是**战功分 + 奖金建议**——**建议是 HR 发放的输入,不是发放指令**。

**与兄弟节点边界(写死):**

| 事 | 归谁 | 本节点角色 |
|---|---|---|
| 生命周期阶段 | 地基①《SKU 生命周期阶段判定》 | 只读 effective_stage,不重判 |
| 投入额/费效比 | 地基②《SKU 财务投入模块》 | 只读,不重判投入 |
| 生命力产出事实(动销/覆盖/收入) | L1-03 / L1-04 / 财务 | 只读,不重算 |
| 责任人归属(谁负责 SKU×区域) | **组织主数据** | **只读,不自己指派** |
| 系统性未达成事实(断货/政策/调拨/数据) | L0-07 / D-001 / L2-03 / 数据源状态 | 只读消费,不自判 |
| 数据真实性 | 数据真实性信号 | 只读消费 |
| 实际发放 | HR/财务系统 | **不发钱、不绕审批** |
| **战功核算 + 生命力分级 + 团队分配** | **本节点** | 唯一真相源 |

**口径铁律:战功 = SKU × 责任人 × 区域 × 阶段 × 时间**。

**机器与人:** 战功分本身无 HITL(是规划,不发钱)。但**实际发放走 HR**;**系统性扣除有争议时人工复核**(扣除可溯源正是为了让争议可核)。

---

## 2. 输入(Input)— 含接入状态

| 信号 | 来源 | 状态 | 用途 |
|---|---|---|---|
| effective_stage | 地基① | 可用(只读) | 阶段激励权重 |
| 投入/费效比 | 地基② | 可用(只读) | 投入产出效率(生命力因子) |
| 动销Δ/覆盖Δ/收入Δ | L1-03/L1-04/财务 | 部分占位 | 生命力提升 |
| 责任人归属 | 组织主数据 | **占位** | 谁负责(不自指派) |
| 系统性未达成信号 | L0-07 断货 / D-001 政策 / L2-03 调拨 / 数据源状态 | 各节点(只读) | **系统责任过滤器(命门①)** |
| 数据真实性信号 | 真实性校验 | **占位** | 防刷(命门③) |
| SKU 战略等级 | SKU 主数据 | 经 MCP | 战略系数 |
| 个人达成数据 | HR/绩效 | **未接入·占位** | 达成率 |
| 战功台账 / `now` | 内部 | 可用 | 团队分配、节奏 |

> partial 常态:个人达成/真实性未接入时,战功以占位跑通(标 `source_pending`),**不得当真实奖金**;关键数据不足判 `unknown` 不硬算战功。

---

## 3. 参数定义(Parameters)

| 字段 | 类型 | 说明 |
|---|---|---|
| `sku` / `scope` / `period` | string / object | SKU × 区域 × 月/季 |
| `vitality` | object | SKU 生命力:`{level: S/A/B/C/D, prev_level, lift: 净提升, attributed: 归因于人的部分}`(§9b) |
| `owner` | object | 责任人(**读组织主数据**):`{person, role, role_weight}` |
| `systemic_deductions[]` | object[] | **系统性未达成扣除(命门①)**:`{factor: 断货/政策未批/调拨未到/数据未接, evidence_ref, excluded_from_denominator}`——逐条可溯源 |
| `personal_achievement` | object | `{raw, denominator_after_deduction, rate}`——**扣系统性后再算达成率** |
| `coefficients` | object | 各系数:`{role_contribution, stage_weight, strategic, grade, profit_quality, data_truth}` |
| `data_truth` | number | 数据真实性系数 ∈ [0,1];**造假/异常→0(归零开关,非打折)** |
| `merit_score` | number | 战功分 = 公式连乘(§9a);data_truth=0 → 0 |
| `bonus_suggestion` | number\|null | 奖金建议(战功分 × 池系数);规划非发放 |
| `team_split` | object\|null | 团队分配:`{pool, members:[{person, role_weight, share}], sum_check}`——**总和=池不超发** |
| `status` | enum | `settled` / `source_pending` / `vitality_unknown` / `truth_zeroed` |
| `flags` | string[] | `systemic_excluded:{factors}` / `merit_by_vitality_not_sales` / `data_truth_zeroed` / `team_sum_ok` / `source_pending` 等 |
| `summary_text` | string | 为什么这个人拿这个分、系统性扣了什么(可溯源,沿用 L5-01) |
| `fanout` | string[] | HR建议/看板/台账;**无任何发钱/发放项** |

---

## 4. 处理流程(Steps · 链式,月/季)

### Step A — 算 SKU 生命力五级(先算,§9b)
读阶段匹配度 × 动销 × 收入 × 利润 × 复购 × 渠道适配 × 品牌资产 × 投入产出效率(地基②)→ 定 `level: S/A/B/C/D` + `prev_level`。
- **生命力提升 `lift` = level − prev_level**(救活濒死 D→B 的 lift 远大于维持成熟)。
- **归因剥离(命门②的另一面)**:lift 中**剥离系统性顺风**(大盘回暖/上游降价等非一线功劳)→ `attributed`(归因于人的净提升)。①剥逆风不背锅、这里剥顺风不冒功,一套逻辑两面。
- 关键数据不足 → `vitality_unknown`,不硬算战功。

### Step B — 读责任人(组织主数据,不自指派)
读组织主数据定 `owner{person, role, role_weight}`——**谁负责这个 SKU×区域是组织定的,本模块不自己指派**。

### Step C — 系统性未达成过滤器【命门①,归因前先扣,可溯源】
> **个人没达成,先判是不是系统的锅。** 这是整套激励公平性的根,也是归因链的**第一道工序**(在套战功公式之前)。

逐条查系统性因素(**只读消费,不自判**),命中即从达成率分母剔除并留证据指针:
| 系统性因素 | 读 | 扣除 |
|---|---|---|
| 公司断货 | L0-07 | 断货期的目标从分母剔除,带 case_ref |
| 政策没批 | D-001 | 没批导致没法执行的部分剔除,带 ref |
| 调拨没到 | L2-03 | 货没到的部分剔除,带 transfer_ref |
| 数据源没接 | 数据状态 | 无法考核的部分剔除,标 source_pending |
→ `systemic_deductions[]`(逐条可溯源)+ `personal_achievement.rate = raw / denominator_after_deduction`。
**绝不让销售为系统的错背锅**——否则没人敢签 JBP。

### Step D — 套战功公式(脚本,可重放,§9a)
> 战功 = 生命力提升(attributed)× 角色贡献 × 阶段权重 × 战略系数 × 等级系数 × 利润质量系数 × **数据真实性系数**

- **阶段权重按激励重点(§9d)**:导入奖点亮 / 成长奖复制 / 成熟奖赚钱 / 衰退奖止损 / 焕新奖重启——同样的动作在不同阶段战功权重不同。
- **数据真实性系数(命门③)**:造假/异常 → `data_truth = 0` → **战功归零 + flag `data_truth_zeroed`**(硬开关,非打折;刷数据零收益)。
- **按生命力提升非销量(命门②)**:公式吃的是 `attributed`(生命力净提升),不是卖了多少箱;救活濒死 > 维持成熟。

### Step E — 团队分配(多人,总和=池不超发)
多人共同让 SKU 生命力提升 → 按 `role_weight` 分 `team_split`:`Σ share = 战功池`,**不超发、不重复发**(§10 sum_check 断言)。

### Step F — 出件
脚本产 vitality/deductions/merit_score → LLM 写 summary_text(为什么这个人这个分、系统性扣了什么,可溯源)→ 跑 §10 → 扇出(HR建议/看板/台账)→ 回写。

---

## 5. 规则与强度(RFC2119)

| 强度 | 规则 |
|---|---|
| **MUST** | **归因前必须先扣系统性未达成(断货/政策/调拨/数据),逐条可溯源带证据指针,从分母剔除再算达成率**;绝不让个人为系统的错背锅(命门①)。 |
| **MUST** | **战功按 SKU 生命力提升算,不按销量**;救活濒死 > 维持成熟;生命力提升须剥离系统性顺风(归因于人的净提升)(命门②)。 |
| **MUST** | **数据不真实/异常 → 数据真实性系数归零(硬开关非打折),战功清零并标记**(命门③)。 |
| **MUST NOT** | **本模块只规划不发放、不绕审批**——出战功分+奖金建议,实际发放走 HR/财务;绝不发钱。 |
| **MUST** | 团队分配总和 = 战功池,不超发、不重复发。 |
| **MUST NOT** | 阶段/投入/产出**只读地基①②与 L1-03/04,绝不重判**;责任人**读组织主数据,绝不自指派**。 |
| **MUST** | 战功公式脚本可重放;系数占位不内嵌定值;关键数据不足判 `unknown` 不硬算。 |
| **MUST** | 阶段激励重点决定权重(导入奖点亮/成长奖复制/成熟奖赚钱/衰退奖止损/焕新奖重启);算账事实(产出Δ/达成 raw)与阶段无关。 |
| **SHOULD** | 系统性扣除有争议应可人工复核;团队分配应附 role_weight 依据。 |
| **MAY** | 可附生命力时间轴;连续高战功可加注供人才盘点(仍不自动发放)。 |

---

## 6. 输出(Output · Artifact 契约)

```json
{
  "sku": "6MX-JDX", "scope": { "region": "华东", "store_tier": "KA" }, "period": "2026-Q2",
  "vitality": { "level": "B", "prev_level": "D", "lift": "+2级(D→B)", "attributed": "+1.6级(剥离大盘回暖0.4)" },
  "owner": { "person": "DSR-Chen", "role": "DSR", "role_weight": 0.5 },
  "systemic_deductions": [
    { "factor": "公司断货", "evidence_ref": "L0-07:SO-2026-0521(断货11天)", "excluded_from_denominator": true },
    { "factor": "调拨未到", "evidence_ref": "L2-03:TR-2026-0508(未达)", "excluded_from_denominator": true }
  ],
  "personal_achievement": { "raw": 0.72, "denominator_after_deduction": "剔除断货11天+调拨缺口", "rate": 0.91 },
  "coefficients": { "role_contribution": 0.5, "stage_weight": "成长奖复制1.3", "strategic": "Flagship1.5",
                    "grade": "KA1.2", "profit_quality": 1.0, "data_truth": 1.0 },
  "merit_score": 168.5,
  "merit_basis": "生命力净提升1.6 × 角色0.5 × 阶段1.3 × 战略1.5 × 等级1.2 × 利润1.0 × 真实性1.0",
  "bonus_suggestion": 8400,
  "team_split": { "pool": 168.5, "members": [
      { "person": "DSR-Chen", "role_weight": 0.5, "share": 84.25 },
      { "person": "美顾-Li", "role_weight": 0.3, "share": 50.55 },
      { "person": "城市经理-Wang", "role_weight": 0.2, "share": 33.70 }
    ], "sum_check": "84.25+50.55+33.70=168.5=池,未超发" },
  "data_truth": 1.0,
  "status": "settled",
  "flags": ["systemic_excluded:断货+调拨", "merit_by_vitality_not_sales", "team_sum_ok"],
  "summary_text": "DSR-Chen@华东KA(加点鲜):本季把濒死的加点鲜从生命力D救到B(净提升1.6级,已剥离大盘回暖)。个人达成72%→剔除公司断货11天+调拨未到后达成率91%(系统的锅不算他)。成长期奖复制权重1.3、Flagship战略1.5,战功168.5分,建议奖金¥8400(团队3人按角色分,总和=池)。注:本为HR规划建议,实际发放走HR审批。"
}
```

> 救活濒死示例:D→B(lift+2)战功 **远大于** 维持成熟(A→A,lift 0)——奖"让 SKU 变好"。
> 系统性扣除示例:断货导致没达成 → 从分母剔除带 L0-07 ref,达成率回升,**不扣个人**。
> 数据造假示例:`data_truth:0, merit_score:0, status:"truth_zeroed", flags:["data_truth_zeroed"]` ——**归零非打折**。
> 团队不超发示例:`Σ share = pool`,多一分都报错。
> unknown 示例:`vitality_unknown` → 不硬算战功,转人工/待数据。

---

## 7. 节奏 + 扇出(写死)

| 项 | 规则 |
|---|---|
| 节奏 | 月/季(绩效周期) |
| 扇出 | HR 发放建议 · 看板 · 战功台账回写 · 系统性扣除争议给人复核 |
| 禁区 | **绝不**:发钱/发放、绕 HR/财务审批、自指派责任人、重判阶段/投入/产出、按销量算战功、超发战功池、漏扣系统性未达成 |

---

## 8. HITL 卡点 —— 本节点【战功分无,发放与争议有】

- **战功分本身无 HITL**:是规划不发钱(真发放在 HR/财务那条线卡)。
- **实际发放走 HR**;**系统性扣除有争议时人工复核**——这正是 §5 要求扣除逐条可溯源的原因:争议要可核,过滤器不能是黑箱。机器只算、只标、只溯源,发不发、扣得对不对的终判在人。

---

## 9. References

### 9a. 战功公式(写死,系数占位)

```
员工SKU战功 = SKU生命力提升(attributed)
            × 员工角色贡献(role_weight)
            × 生命周期阶段权重(§9d)
            × SKU战略系数
            × 门店/区域等级系数
            × 利润质量系数
            × 数据真实性系数(0或1区间,造假归0)
```
> 先算生命力(§9b),再扣系统性(§9c 命门①),再套公式。

### 9b. SKU 生命力五级(写死,占位)

```
SKU生命力 = 阶段匹配度 × 动销 × 收入 × 利润 × 复购 × 渠道适配 × 品牌资产 × 投入产出效率(地基②)
```
| 级 | 含义 |
|---|---|
| S | 强心跳,标杆 |
| A | 健康 |
| B | 正常 |
| C | 弱心跳,需关注 |
| D | 濒死/无心跳 |

> 提升 lift = 级差;救活(D→B)远高于维持(A→A)。具体打分口径接入数据后定。

### 9c. 系统性未达成清单(命门①,写死;只读消费不自判)

| 因素 | 读 | 处理 |
|---|---|---|
| 公司断货 | L0-07 | 断货期目标剔出分母,带 case_ref |
| 政策没批 | D-001 | 没批部分剔出,带 ref |
| 调拨没到 | L2-03 | 货没到部分剔出,带 transfer_ref |
| 数据源没接 | 数据状态 | 无法考核部分剔出,标 source_pending |

> 逐条可溯源;扣完再算个人达成率。**绝不让个人背系统的锅。**

### 9d. 阶段激励重点表(战功权重随阶段;占位)

| 阶段 | 激励重点 | 权重取向 |
|---|---|---|
| 导入 | 点亮(上架/陈列/首购/试吃/首次补货) | 奖点亮动作 |
| 成长 | 复制(动销增长/区域复制/补货频率) | 奖复制 |
| 成熟 | 赚钱(收入/毛利/费用率/复购) | 奖利润 |
| 衰退 | 止损(清库存/控费用/替代) | 奖止损 |
| 焕新 | 重启(新包装/新场景/老客激活) | 奖重启 |

### 9e. 术语 / 踩坑

| 术语 | 含义 |
|---|---|
| 系统性未达成过滤器 | 归因前先扣系统的锅(命门①) |
| 生命力提升非销量 | 奖让SKU变好,不奖卖得多(命门②) |
| 数据真实性归零 | 造假→系数0战功清零(命门③,硬开关) |
| 剥逆风/剥顺风 | 不背锅(扣系统逆风)/不冒功(扣系统顺风) |
| 战功池不超发 | 团队总和=池 |

- ❌(命门①,值得记)**系统性未达成不扣就归因到个人**:公司断货11天导致没达成,板子打在 DSR 头上 → 销售为系统的错背锅,没人敢签 JBP → ✅ 归因前先扣系统性,逐条可溯源,扣完再算达成率。
- ❌(命门②,值得记)**按销量算战功**:卖 100 箱成熟 SKU 的战功 = 把濒死 SKU 救活的战功 → 没人愿意干"救活"的苦活,都去维持好卖的 → ✅ 按生命力提升算,救活 > 维持。
- ❌(命门③,值得记)**数据造假只打折不归零**:刷数据骗战功,系数打 0.5 还能拿一半 → 有人愿意赌 → ✅ 真实性归零(硬开关),刷数据零收益且留痕。
- ❌ 生命力 D→B 全记个人头上,其实是大盘回暖 → 冒功 → ✅ 剥离系统性顺风,只算 attributed 净提升。
- ❌ 本模块直接把"奖金¥8400"发出去 → 绕过 HR 审批 → ✅ 规划非发放,走 HR。
- ❌ 团队 3 人各按满分算,总和 > 池 → 超发 → ✅ 总和=池,不超发不重复发。
- ❌ 本模块自己指派"这个 SKU 算谁的" → 越权 → ✅ 读组织主数据。
- _(后续迭代继续往下加)_

---

## 10. Scripts — 生命力分级 / 系统性扣除 / 战功重放 / 团队不超发 / 真实性 / 溯源(出件前必跑)

```python
LEVELS = {"S": 5, "A": 4, "B": 3, "C": 2, "D": 1}

def vitality_lift(level, prev_level, systemic_tailwind=0.0):
    """净提升 = 级差 − 系统性顺风(剥离冒功)。"""
    raw = LEVELS[level] - LEVELS[prev_level]
    return round(raw - systemic_tailwind, 2)        # attributed

def achievement_rate(raw, denom_total, systemic_excluded):
    """命门①:扣系统性未达成后再算达成率。"""
    denom = denom_total - systemic_excluded         # 系统的锅剔出分母
    return round(raw / denom, 3) if denom > 0 else None

def merit(attributed, role_w, stage_w, strategic, grade, profit_q, data_truth):
    """命门③:data_truth=0 → 归零(非打折)。"""
    if data_truth == 0:
        return 0.0                                   # 数据造假战功清零
    return round(attributed * role_w * stage_w * strategic * grade * profit_q * data_truth, 2)

def validate(out, org_master=None):
    errs = []
    # ===== 命门①:系统性必须先扣且可溯源 =====
    pa = out.get("personal_achievement", {})
    if out.get("_has_systemic_factor") and not out.get("systemic_deductions"):
        errs.append("systemic_not_deducted")             # 有系统性因素却没扣
    for d in out.get("systemic_deductions", []):
        if not d.get("evidence_ref"):
            errs.append(f"systemic_deduction_without_evidence:{d.get('factor')}")  # 扣除必带证据指针
    if out.get("_achievement_before_deduction"):
        errs.append("achievement_not_after_deduction")   # 必须扣完再算达成率
    # ===== 命门②:按生命力提升非销量 =====
    if out.get("_merit_by_sales"):
        errs.append("merit_by_sales_not_vitality")       # 按销量算=禁
    v = out.get("vitality", {})
    if v.get("_lift_includes_tailwind"):
        errs.append("vitality_lift_not_attributed")      # 未剥离系统性顺风=冒功
    if "merit_by_vitality_not_sales" not in str(out.get("flags", [])) and out.get("merit_score"):
        errs.append("missing_vitality_basis_flag")
    # ===== 命门③:数据真实性归零(非打折) =====
    dt = out.get("data_truth")
    if dt == 0:
        if out.get("merit_score", 0) != 0:
            errs.append("truth_zero_but_merit_nonzero")  # 造假却还有战功
        if "data_truth_zeroed" not in str(out.get("flags", [])):
            errs.append("truth_zeroed_without_flag")
    if dt is not None and 0 < dt < 1 and out.get("_truth_discounted_not_zeroed"):
        errs.append("truth_discounted_should_zero")      # 造假应归零不是打折
    # ===== 战功公式可重放 =====
    if out.get("merit_score") is not None and dt != 0:
        c = out.get("coefficients", {})
        exp = merit(v.get("_attributed_num", 0), c.get("role_contribution", 0),
                    c.get("_stage_w_num", 0), c.get("_strategic_num", 0),
                    c.get("_grade_num", 0), c.get("profit_quality", 0), dt)
        if out["merit_score"] != exp:
            errs.append("merit_not_replayable")
    # ===== 团队分配总和=池不超发 =====
    ts = out.get("team_split")
    if ts:
        total = round(sum(m["share"] for m in ts.get("members", [])), 2)
        if total != round(ts.get("pool", 0), 2):
            errs.append(f"team_sum_mismatch:{total}≠{ts.get('pool')}")   # 超发/漏发
    # ===== 责任人读组织主数据不自指派 =====
    if org_master is not None and out.get("owner", {}).get("person"):
        if out["owner"]["person"] != org_master.owner_of(out["sku"], out.get("scope")):
            errs.append("owner_self_assigned")           # 不自指派
    # ===== 规划不发放 =====
    for f in out.get("fanout", []):
        if any(x in f for x in ("发钱", "发放", "打款", "转账", "HR:发", "实发")):
            errs.append(f"illegal_payout:{f}")           # 越界到发放
    # ===== unknown 不硬算 =====
    if v.get("level") is None and out.get("merit_score") is not None:
        errs.append("merit_on_vitality_unknown")         # 生命力未知却出战功
    return errs
```

---

## 11. 评测起手式(9 条种子)

```json
[
 {"id":"m01",
  "input":{"caseA":"救活濒死:生命力D→B,卖100箱","caseB":"维持成熟:A→A,卖100箱"},
  "expect":{"caseA_merit":"远高于caseB","reason":"按生命力提升非销量",
            "flags_contains":"merit_by_vitality_not_sales"},
  "tags":["命门②:救活濒死战功>维持成熟,同样100箱不同战功"]},

 {"id":"m02",
  "input":{"personal":"没达成目标","cause":"公司断货11天(L0-07)+调拨未到(L2-03)"},
  "expect":{"systemic_deductions":"断货+调拨逐条带ref","rate_after_deduction":"回升",
            "not_blamed_on_person":true,"error_if_not_deducted":"systemic_not_deducted"},
  "tags":["命门①:系统性断货导致没达成→剔出分母不扣个人,可溯源"]},

 {"id":"m03",
  "input":{"data_signal":"动销数据造假/异常"},
  "expect":{"data_truth":0,"merit_score":0,"status":"truth_zeroed",
            "flags_contains":"data_truth_zeroed","not_discounted":"非打折是归零",
            "error_if_nonzero":"truth_zero_but_merit_nonzero"},
  "tags":["命门③:数据造假→真实性系数归零,战功清零(硬开关非打折)"]},

 {"id":"m04",
  "input":{"team":"3人共同让SKU生命力提升,池168.5","weights":[0.5,0.3,0.2]},
  "expect":{"shares":[84.25,50.55,33.70],"sum":168.5,"sum_equals_pool":true,
            "error_if_over":"team_sum_mismatch"},
  "tags":["团队分配总和=池不超发不重复发"]},

 {"id":"m05",
  "input":{"caseA":{"stage":"导入","action":"首购+陈列"},"caseB":{"stage":"成熟","action":"控费率+复购"}},
  "expect":{"caseA":"导入奖点亮权重高","caseB":"成熟奖赚钱权重高",
            "same_action_different_weight":true},
  "tags":["阶段激励重点:导入奖点亮vs成熟奖赚钱,权重随阶段"]},

 {"id":"m06",
  "input":{"vitality":"D→B lift+2,但其中+0.4来自大盘回暖(系统性顺风)"},
  "expect":{"attributed":"+1.6(剥离0.4顺风)","not_full_credit":true,
            "error_if_full":"vitality_lift_not_attributed"},
  "tags":["命门②另一面:生命力提升剥离系统性顺风,不冒功"]},

 {"id":"m07",
  "input":{"merit_score":168.5,"bonus":8400,"event":"模块试图直接发这8400"},
  "expect":{"blocked":"illegal_payout","note":"规划非发放,走HR审批","no_payout":true},
  "tags":["规划不触发发放:不发钱不绕HR审批"]},

 {"id":"m08",
  "input":{"vitality_data":"动销/复购数据缺,无法定级"},
  "expect":{"status":"vitality_unknown","merit_not_computed":true,
            "error_if_forced":"merit_on_vitality_unknown"},
  "tags":["缺数据→生命力unknown不硬算战功"]},

 {"id":"m09",
  "input":{"deductions":"断货+政策未批+调拨未到三条"},
  "expect":{"each_has_evidence_ref":true,"traceable":"逐条可溯源给人复核",
            "error_if_no_evidence":"systemic_deduction_without_evidence"},
  "tags":["命门①可溯源:系统性扣除逐条带证据指针,争议可核"]}
]
```

**打分维度(每条 0/1):**
1. **命门②:救活>维持**(m01)
2. **命门①:系统性扣除不背锅**(m02)
3. **命门③:造假归零**(m03)
4. 团队不超发(m04)
5. 阶段激励重点(m05)
6. **命门②另一面:剥顺风不冒功**(m06)
7. 规划不发放(m07)
8. unknown 不硬算(m08)
9. **命门①可溯源**(m09)

> 最危险的三类错(都是激励公平性的根):**系统性不扣**(m02——销售背系统的锅,没人敢签 JBP)、**按销量算**(m01——没人愿意干"救活"的苦活)、**造假能拿到战功**(m03——刷数据骗钱)。三条命门的共性:**奖的是"真实地让 SKU 变好",而不是"卖得多/数字好看/运气好"**。战功核算一旦失了公平,整套激励就崩了——所以系统性扣除可溯源、生命力提升剥顺风、数据造假归零,三道都是硬约束。而**真金白银的发放永远在人和 HR 那条线**,本模块只算清"谁该拿多少",不碰发放。

---

## 待填变量(套用时替换)
- `owner` / backlog 编号(L4 模块层)
- §9a 战功公式各系数 / §9b 生命力五级打分口径 / §9d 阶段激励权重 — 全部回测校准
- §9c 系统性未达成读取口径(L0-07/D-001/L2-03/数据状态)— 各源对齐
- 数据真实性信号来源(命门③归零触发)— 接入
- 责任人归属 — 组织主数据(不自指派)
- 个人达成数据 / HR·绩效·薪酬系统 — 接入(经 MCP);接入后更新 §2 状态
- effective_stage 地基① / 投入费效比 地基② / L1-03·L1-04 产出 — 只读契约对齐
- 战功池系数(战功分→奖金建议)/ 团队 role_weight 口径 — HR 共同定
- 战功台账落库 — 与既有台账同基建分表
