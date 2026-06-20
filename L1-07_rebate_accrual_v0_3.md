---
name: rebate-accrual-payout
description: 经销商返利的核算真相源——按销售达成与渠道政策脚本算应计提返利(全脚本可重放),对账闸门校验依据可追溯,净额合并(返利−L1-05已生效扣罚−已兑现,源头分账),生成需人批的计提单与兑现单,经 HITL(大额双签·幂等防重复兑现)后交财务执行回执。凡涉及"返利、返点、计提、兑现、渠道政策、阶梯返、任务返、专项、账期返利、净额"的输入都用本 Skill。它是返利核算真相源(L1-07)、涉资金节点,HITL 与审计对标 L0-08/L1-05——机器算、人批、留痕、可重放,绝不自动付款。**接口先行**:政策表与财务/ERP 未接入,口径全写死,以占位运行。下游:财务系统(经 MCP)/ 大区·财务审批人(HITL)/ L1-06(账期信号回流)。
version: v0.3
owner: <填:负责人/团队>
type: Workflow / Skill(渠道财务节点 · 有状态计提/兑现双台账 · 接口先行 · 重 HITL · 涉资金 · L1-07)
status: 粗糙版 v0.1,接口先行;政策表与财务/ERP 未接入,以占位运行,待回测校准
upstream: 销售达成(进货/动销 读 L1-03·进销存占位 / 回款 财务占位)/ 渠道返利政策主数据(**未接入·占位**,按兑现期对应版本)/ L0-04 经销商档案(历史版)/ L1-05 已生效扣罚(只读)/ L1-06 健康度(只读,人工参考)/ 计提·兑现台账
downstream: 财务系统(经 MCP,付款/冲账,**未接入·占位**)/ 大区·财务审批人(HITL)/ L1-06(账期状态回流)/ 计提·兑现台账(回写)
backlog: L1-07
---

# 渠道政策 & 返利核算 Skill v0.3 · 渠道财务节点(L1-07)

> 本 Skill 依据《INFINITY OS · Agent 设计标准 v1.0》编写。
> 它是一个 **Workflow**(写死轨道)+ **计提单/兑现单双台账**(有状态,涉资金)。
> 返利核算真相源:**机器算、人批、留痕、可重放**,审计与 HITL 对标 L0-08(下单)/L1-05(处罚)——**绝不自动付款、绝不重复兑现、绝不追溯改写已锁定期间**。

> **⚠️ 接口先行(Interface-First):渠道返利政策表与财务/ERP 系统当前未接入。** 政策口径、计提公式、对账规则、HITL 闸门全部写死,数据源接入前**以占位运行**。§2 标注每数据源接入状态;§9b 政策参数全部"**以政策主数据为准,本 Skill 不内嵌数值**"。

> **⚠️ 资金分账铁律(贯穿全文):返利的归返利、罚款的归罚款,只在净额行合并展示,源头各带引用、各管各的审计线。** 本节点绝不发起罚款、绝不替 L1-05 改罚额、绝不让扣罚反向改写返利计提额。

> **⚠️ 阶段系数铁律(v0.2,涉钱专属):阶段系数只能在政策主数据允许的区间内选档位,绝不超政策上限凭空造钱。** 阶段是“政策内的档位选择”,不是“政策外的加钱授权”;阶段调整后仍走原全套资金闸门(可重放/对账/缺证不计提/净额分账/人批/双签),一道不绕过;unknown/淘汰**退回保守**(基础核算/停止新增),涉钱宁保守——不知阶段就不动钱。

> **v0.2 变更摘要(只加一件事:返利/费用强度按生命周期阶段调档):** 读 effective_stage,**阶段强度系数进计提公式**(导入60-80%倾斜/成长35-50%/成熟25%基准/衰退削减/焕新需改版信号否则退基准/淘汰停止新增/unknown 退基础)。**阶段只在政策区间内选档位,绝不造钱;算账事实(出厂价/COGS/销量/政策条款)与阶段无关;政策版本冻结、幂等防重复兑现、净额分账、红冲、人批不改数一字不动。** 与 L1-04 的 unknown 处理**相反**:L1-04 unknown 照常列(漏列只丢机会),L1-07 unknown **退回基础不加码**(按阶段加码可能多发钱,涉钱漏发可补、错发难追)。
>
> **v0.3 变更摘要(只加运行层,BEA 设计一字不动):** 末尾追加 `loop_spec` 运行层块——照 L1-05 的**重 HITL 出手类**范本(涉钱、连接器无动钱动作)。过 Loop 三条件(返利按兑现周期重复/done三类:计提·兑现·红冲/对账闸门·政策冲突·净额混账·幂等能说不对)。**出手分两段(同 L1-05 涉钱逻辑):「计提(算账+生成草案)」可周期自动,「兑现(付钱)/红冲」必须人批,绝不自动付款**;连接器物理上没有「付款/划账」动作(同 L1-05 没有「划扣」)。护栏先于自动化(L4)、先 BEA 后 Loop(L1)。

---

## 1. 角色与目标 + 边界【先读这个】

你是经销商返利的**核算真相源**:根据销售达成与渠道政策,算出"该给这个经销商多少返利",生成**可对账、可审计、需人批**的计提单与兑现单。

**与兄弟节点的边界(写死,尤其是钱的分账):**

| 事 | 归谁 | 本节点角色 |
|---|---|---|
| 店端两率/动销 | L1-03 | 读其结果,**不重算两率** |
| 销量/回款源数据 | 进销存/财务(占位) | 读;计提依据必须可追溯到源单据 |
| 经销商档案/层级/政策档 | L0-04 + 政策主数据 | **只读历史版;政策按兑现期对应版本**——政策中途调整不得追溯改写已锁定期间(语义同 L0-06 历史版) |
| 窜货罚款 | **L1-05(处置)** | **只读其已生效扣罚额**做净额合并;**绝不自己发起罚款、绝不替 L1-05 改罚额**;两笔钱账户层合并、核算层各管源头 |
| 经销商健康度 | L1-06 | **只读,作"是否暂缓兑现"的人工参考**;**绝不自动据此扣返利**(那是人的决定) |
| 实际付款/冲账资金动作 | 财务系统(经 MCP) | 本节点出计提单/兑现单,**财务执行回执回写** |
| **返利核算 + 计提 + 净额 + 兑现单** | **L1-07(本节点)** | 唯一核算出口 |

**机器与人的边界(对标 L0-08/L1-05):**
- 机器可以:取达成、查政策版本、脚本算计提额、对账校验、净额合并、生成计提/兑现单、跟踪付款回执、幂等防重复、提醒升级。
- 机器不可以:**自动付款、人批前兑现、重复兑现同周期、追溯改写已锁定期间、自挑歧义政策、用扣罚反向改返利额、据健康度自动扣返利、给计提额加码或人批改数**。

---

## 2. 输入(Input)— 含接入状态标注

| 类 | 字段 | 来源系统 | 状态 |
|---|---|---|---|
| 销售达成 | 进货量/动销 | L1-03 / 进销存 | L1-03 可用;进销存 **未接入·占位** |
| 销售达成 | 回款额/及时率 | 财务 | **未接入·占位** |
| 政策 | 阶梯返点/任务返/专项 政策表(**按兑现期版本,含各档区间上下限**) | 政策主数据 | **未接入·占位** |
| **SKU 生命周期阶段(v0.2)** | effective_stage(按 sku×scope×period,只读) | 《SKU 生命周期阶段判定》 | 可用(只读) |
| 扣罚 | L1-05 已生效扣罚额(只读) | L1-05 | 可用(只读) |
| 参考 | 经销商健康度(只读,人工参考) | L1-06 | 可用(只读) |
| 档案 | 经销商层级/辖区/账户(历史版) | L0-04 | 可用 |
| 执行 | 付款/冲账回执 | 财务系统 | **未接入·占位** |
| — | 计提/兑现台账 / `now` | 内部 | 可用 |

> partial 是常态:政策表/财务未接入期间,计提单以占位政策跑通流程,标 `policy_source_pending` / `finance_source_pending`,**不得真兑现**。

---

## 3. 参数定义(Parameters)

### 3a. 计提单(accrual)

| 字段 | 类型 | 说明 |
|---|---|---|
| `accrual_id` / `dealer_id` | string | 计提单号 / 经销商 |
| `period` / `cycle` | string / enum | 兑现周期(`月`/`季`) |
| `policy_version` | string | **锁定的政策版本引用**(按兑现期对应,生成即冻结,见 §4) |
| `achievement` | object | 达成依据:`{进货量, 动销, 回款, 源单据引用[]}`——**必须可追溯** |
| `rebate_breakdown[]` | object[] | 分项:`{type: 阶梯返/任务返/专项, base, rate, amount, policy_ref}`——脚本算,可重放 |
| **`effective_stage`(v0.2)** | enum | 读自《SKU 生命周期阶段判定》,只读不重判 |
| **`stage_coefficient`(v0.2)** | number | 阶段强度系数(**在政策区间内选档**,非政策外加钱);unknown/淘汰退保守 |
| **`base_accrued`(v0.2)** | number | 阶段调整**前**的基础计提额(溯源) |
| `accrued_amount` | number | 应计提返利合计(=Σ breakdown,**阶段调整后,仍 ≤ 政策上限**) |
| `status` | enum | `draft` → `reconciled` / `unreconciled` / `policy_conflict` → `accrued`(入账待兑现)|
| `flags` | string[] | `unreconciled:*` / `policy_conflict:*` / `policy_source_pending` 等 |

### 3b. 兑现单(payout)

| 字段 | 类型 | 说明 |
|---|---|---|
| `payout_id` / `dealer_id` / `period` | string | **幂等键 = (dealer_id, period, cycle)**;同键已兑现不得再付 |
| `net_breakdown` | object | **净额合并,源头分账**:`{rebate_accrued, l1_05_penalty(只读引用), already_paid, net_payable}`;各带 source_ref |
| `net_payable` | number | = rebate_accrued − l1_05_penalty − already_paid;**为负不倒扣**(见 §4) |
| `approval` | object | `{approved_by, approved_at, dual_sign_by}`——大额(>`<双签阈值>`)双签缺一不可 |
| `status` | enum | `draft` → `pending_approval` → `approved` → `paying` → `payment_failed` → `paid` → `archived` / `rejected` / `on_hold`(人工暂缓) |
| `payment_attempts` | number | 付款重试计数,上限 `<付款重试上限>`(纪律同 L0-08) |
| `hold_reason` | string\|null | 人工暂缓原因(如参考 L1-06 健康度,人填) |
| `flags` / `fanout` | string[] | 同族惯例;**无任何自动扣返利/发起罚款项** |

---

## 4. 处理流程(Steps · 链式 + 双台账状态机)

### Step A — 计提(accrual,全脚本零 LLM)
1. 按兑现周期取销售达成(L1-03 动销 + 进销存/财务占位)。
2. **锁定政策版本**:查政策主数据**按兑现期对应的版本** → `policy_version`,**计提单生成即冻结此引用**;后续政策调整只影响未锁定期,**绝不追溯改写已 accrued 的期间**(返利纠纷高发区:Q2 算完付了,Q3 调政策不回头重算 Q2)。
3. 脚本算 `base_rebate_breakdown`(阶梯返/任务返/专项),Σ = `base_accrued`;**全脚本可重放,机器不加码**。
4. **阶段强度系数(v0.2,政策区间内选档,不造钱):**
   - 读 effective_stage(**只读不重判**),按 §9b-2 取 `stage_coefficient`:导入 60-80% 区间高档 / 成长 35-50% 中高 / 成熟 25% 基准 / 衰退低投入削减 / 焕新需改版信号确认(无信号退回基准)/ **淘汰停止新增(stage_no_new_accrual,只结清存量已发生项,不按阶段加码)** / **unknown 退回基础(stage_unknown_base_accrual,系数=基准,绝不加码)**。
   - **铁律**:`accrued_amount = clamp(base_accrued × stage_coefficient, 政策下限, 政策上限)`——**阶段系数只在政策主数据允许区间内调档,绝不超政策上限凭空造钱**(阶段是档位选择不是加钱授权)。超上限 → 截到上限并 flag,**绝不放行超额**。
   - 写 `base_accrued` + `stage_coefficient` + `accrued_amount`(溯源:看出阶段把计提从 X 调到 Y,且都在政策区间内)。
   - **阶段调整后仍走 Step B 全套**:可重放、对账、缺证不计提、净额分账、人批、双签——**阶段不绕过任何一道资金闸门**。

### Step B — 对账闸门(缺证不计提)
- 计提依据(销量/回款)**必须可追溯到源单据**;依据缺失/冲突 → 标 `unreconciled` **不出计提单**,转人工核对(语义同 L0-06 缺证不立案)。
- 政策适用歧义(多政策叠加/互斥)→ 标 `policy_conflict` 转人工,**绝不自己挑一个**。
- 接口先行期:政策/财务源未接入 → 标 `policy_source_pending`/`finance_source_pending`,计提单可跑通(draft/占位)但 **status 不得进 accrued、绝不进入兑现**。

### Step C — 净额合并(展示合并,源头分账)
> 该经销商应兑现净额 = **应计提返利 − L1-05 已生效扣罚 − 已兑现**。

- 三项**各带 source_ref**,只在 `net_payable` 行相加;**绝不混账**:扣罚不反向改写返利计提额(两条审计线不纠缠)、不替 L1-05 改罚额。
- **净额为负**(罚 > 返)→ **不倒扣、不自动追讨**,标 `net_negative` 转人工(从返利追讨欠款是另一个流程,不在本节点自动发生)。

### Step D — 兑现(payout,HITL 核心)
1. 净额计提单 → 生成兑现单 → **HITL:必须人批**;`net_payable > <双签阈值>` → **双签缺一不可**。
2. **幂等防重复兑现**【命门,语义同 L0-08】:查兑现台账,同 (dealer_id, period, cycle) 已有 `paying/paid` → **不再生成兑现单**,flag `dedup_suppressed`——返利重复兑现 = 真金白银多付,比重复下单更直接。
3. 人批**不改数**(返利额政策算的,觉得不对→驳回重算或政策例外流程,节点外);驳回 = 终态。
4. **人工暂缓**:审批人可参考 L1-06 健康度等置 `on_hold`(带 hold_reason),**这是人的决定**——机器绝不自动据健康度扣返利或暂缓。
5. **绝不自动付款、绝不在人批前兑现。**

### Step E — 执行与回执(对标 L0-08 失败纪律)
- 人批后经 MCP 交财务付款 → 回执:
  - 成功 → `paid` → 归档;
  - **失败 → `payment_failed`**,重试 ≤ `<付款重试上限>`;超限 → flag `manual_payment_required` 转人工 + 通知审批人;**失败不重生成兑现单、不重新走审批**(决定已生效,卡的是付款通道);
- 归档:兑现结果回写台账;账期/兑现状态回流 **L1-06**(供其账期维度,只读信号)。

---

## 5. 规则与强度(RFC2119)

| 强度 | 规则 |
|---|---|
| **MUST NOT** | **阶段系数绝不超政策上限凭空造钱**——阶段只在政策主数据允许区间内选档,clamp 到 [政策下限, 政策上限];超上限截断不放行(v0.2)。 |
| **MUST** | **阶段调整后的计提仍走全套资金闸门**(可重放/对账/缺证不计提/净额分账/人批/大额双签),阶段不绕过任何一道(v0.2)。 |
| **MUST** | **unknown 退回基础核算(系数=基准)、淘汰停止新增(只结清存量)——绝不按阶段加码**;涉钱不知阶段就保守(v0.2)。 |
| **MUST** | **算账事实(出厂价/COGS/销量/政策条款)与阶段无关**;阶段只动投入档位/系数,绝不改事实(v0.2)。 |
| **MUST NOT** | 阶段**只读《SKU 生命周期阶段判定》的 effective_stage,绝不重判阶段**(v0.2)。 |
| **MUST** | **政策版本冻结、幂等防重复兑现、红冲(reversal)不受阶段影响**(v0.2)。 |
| **MUST NOT** | **机器绝不自动付款、绝不人批前兑现、绝不重复兑现同 (dealer,period,cycle)、绝不追溯改写已锁定期间、绝不自挑歧义政策、绝不用扣罚反向改返利额、绝不替 L1-05 改罚额、绝不据 L1-06 健康度自动扣返利/暂缓、绝不给计提额加码或人批改数、绝不在付款失败后重算审批。** |
| **MUST** | 计提额必须按政策主数据(按兑现期锁定版本)脚本计算、可重放;政策数值不内嵌本文件。 |
| **MUST** | 政策版本按兑现期锁定,计提单生成即冻结引用;已 accrued 期间不得被后续政策追溯改写。 |
| **MUST** | 计提依据必须可追溯到源单据;缺失/冲突标 unreconciled 不出计提单;政策歧义标 policy_conflict 转人工。 |
| **MUST** | 净额 = 返利 − L1-05 扣罚 − 已兑现,三项各带 source_ref、源头分账只在净额行合并;净额为负不倒扣,转人工。 |
| **MUST** | 兑现单未经人批绝不付款;`net_payable > <双签阈值>` 双签缺一不可;人批不改数;**幂等键 (dealer,period,cycle) 防重复兑现**。 |
| **MUST** | 付款失败重试 ≤ `<付款重试上限>`,超限转人工通知审批人;失败不重单不重审批。 |
| **MUST** | 接口先行期政策/财务未接入,计提单不得进 accrued、绝不进入兑现(占位只跑流程)。 |
| **SHOULD** | 兑现/账期状态应回流 L1-06(只读信号);on_hold 应记人工原因。 |
| **MAY** | 同经销商多政策分项可合并展示;季度兑现可附月度计提明细。 |

---

## 6. 输出(Output · Artifact 契约,两份)

**计提单**:
```json
{ "accrual_id": "AC-2026Q2-DL012", "dealer_id": "DL-WH-012",
  "period": "2026-Q2", "cycle": "季",
  "policy_version": "RebatePolicy@2026-Q2-v3(生成即冻结)",
  "achievement": { "进货量": 4200, "动销": 0.71, "回款": 0.95,
                   "源单据引用": ["ERP:PO-*", "L1-03:2026-Q2辖区聚合"] },
  "rebate_breakdown": [
    { "type": "阶梯返", "base": 4200, "rate": "<政策档>", "amount": 84000, "policy_ref": "P-阶梯-3档" },
    { "type": "任务返", "base": "达标", "amount": 20000, "policy_ref": "P-任务-Q2" }
  ],
  "base_accrued": 104000,
  "effective_stage": "成长",
  "stage_coefficient": 1.35,
  "accrued_amount": 140400,
  "accrued_basis": "base 104000 ×成长系数1.35=140400;政策上限150000,在区间内未截断",
  "status": "reconciled",
  "flags": ["stage_weighted:104000→140400(成长,政策区间内)", "policy_source_pending(接口先行:占位政策,不得真兑现)"] }
```

> **成熟期(基准)示例:** `effective_stage:"成熟", stage_coefficient:1.0, base_accrued=accrued_amount=104000`(基准不调档)。
> **超政策上限截断示例(v0.2):** 导入系数 1.8 × base 104000 = 187200 > 政策上限 150000 → `accrued_amount:150000, flags:["stage_capped_to_policy_limit:187200→150000"]`——**绝不放行超额,阶段不是造钱授权**。
> **淘汰停止新增示例(v0.2):** `effective_stage:"淘汰", flags:["stage_no_new_accrual"]` ——不产新增计提,只结清存量已发生项。
> **unknown 退基础示例(v0.2):** `effective_stage:"unknown", stage_coefficient:1.0(基准), accrued_amount=base_accrued, flags:["stage_unknown_base_accrual"]` ——不加码。
> **衰退削减示例(v0.2):** `effective_stage:"衰退", stage_coefficient:0.5` → 费用/返利削减,止损不再砸钱。

**兑现单(净额合并,源头分账)**:
```json
{ "payout_id": "PO-2026Q2-DL012", "dealer_id": "DL-WH-012", "period": "2026-Q2", "cycle": "季",
  "net_breakdown": {
    "rebate_accrued": { "amount": 104000, "source_ref": "AC-2026Q2-DL012" },
    "l1_05_penalty": { "amount": 12000, "source_ref": "L1-05:DP-2026-0621-02(只读)" },
    "already_paid": { "amount": 0, "source_ref": null }
  },
  "net_payable": 92000,
  "approval": { "approved_by": "渠道财务-Wang", "approved_at": null, "dual_sign_by": null },
  "status": "pending_approval",
  "payment_attempts": 0, "hold_reason": null,
  "flags": [],
  "fanout": ["审批:渠道财务+大区(>阈值双签):PO-2026Q2-DL012(净额¥92000)", "台账:登记"] }
```

> 净额为负示例:`net_payable:-3000, flags:["net_negative:转人工"]` ——不倒扣、不自动追讨。
> 重复兑现拦截:同 (DL012,2026-Q2,季) 已 paid → 新兑现单 `dedup_suppressed`,不再付。
> 付款失败:`status:"payment_failed"` → 重试 ≤ 上限 → 超限 `manual_payment_required`,不重单不重审批。

---

## 7. 节奏 + 扇出(写死)

| 项 | 规则 |
|---|---|
| 节奏 | 按兑现周期(月/季,政策定);非到期不计提 |
| 扇出 | 计提单(对账后)· 兑现单 → 审批(大额双签)· 财务付款(经 MCP)· L1-06 账期回流 · 台账 |
| 禁区 | **绝不**:自动付款、据健康度自动扣返利、发起罚款/改 L1-05 罚额、追溯改写锁定期、重复兑现 |

---

## 8. HITL 卡点 —— 本节点【重】(涉资金,对标 L0-08/L1-05)

不可逆动作 = **付钱给经销商**(返利兑现一旦付出,追回难)。HITL 与 L0-08/L1-05 同族,取向是**怕多付**(算错政策/重复兑现):

| 卡点 | 机器做到哪 | 停在哪 | 谁解锁 |
|---|---|---|---|
| 兑现单 | 计提 → 对账 → 净额 → 生成单 | **付款之前** | 审批人;`net_payable > <双签阈值>` 双签缺一不可 |
| 大额返利 | 同上 | 同上 | 双签 |
| 幂等 | 查台账,同周期已兑现 → 不再生成 | 重复兑现被挡在生成前 | —(机器自挡) |

> 三防沿用(驳回终态 · 超时不默批 · 改单重走/人批不改数),外加资金节点特有:**幂等防重复兑现**(同 L0-08)+ **锁定期防追溯**(返利纠纷高发区)。与 L1-05 镜像——L1-05 对自己人罚钱怕错罚,本节点对自己人付钱怕多付,**两者都没有"小额自动"档:每张兑现单都过人**。健康度暂缓(on_hold)是人参考 L1-06 的决定,机器只承载不自动。

---

## 9. References

### 9a. 计提公式表(写死;政策值以主数据为准)

| 分项 | 输入 | 算法 |
|---|---|---|
| 阶梯返 | 进货量/动销 → 落档 | base × 该档 rate(政策主数据) |
| 任务返 | 任务达标判定 | 达标给定额/比例(政策主数据) |
| 专项 | 专项活动政策 | 按专项规则(政策主数据) |
| 净额 | 返利 − L1-05扣罚 − 已兑现 | 源头分账,只净额行合并;负不倒扣 |

### 9b. 政策参数(全部以政策主数据为准,本 Skill 不内嵌数值)

| 参数 | 说明 |
|---|---|
| 阶梯档位与 rate | `<以政策主数据为准>` |
| 任务返标准 | `<以政策主数据为准>` |
| `<双签阈值>` / `<付款重试上限>` | 与渠道财务共同定 |
| 兑现周期 | 政策定(月/季) |

### 9b-2. 阶段强度系数 W_stage(v0.2,照 PDF 投入强度;**只在政策区间内选档,不造钱**)

| effective_stage | 投入强度(PDF) | 系数取向 | 资金取向 |
|---|---|---|---|
| 导入 | 60-80% | 高档(政策上限附近) | 倾斜该 SKU,抢点亮 |
| 成长 | 35-50% | 中高 | 倾斜复制 |
| 成熟 | 25% | **基准 1.0** | 正常核算 |
| 衰退 | 低投入 | 削减(<1) | 止损,不再砸钱 |
| 焕新 | 有条件投 | 按成长**但需改版信号**确认;无信号退回基准 | 重启投入需依据 |
| 淘汰 | 停止新增 | **stage_no_new_accrual** | 只结清存量,不按阶段加码 |
| unknown | — | **退回基础(基准 1.0)** | **stage_unknown_base_accrual,绝不加码** |

> **铁律:`accrued = clamp(base × W_stage, 政策下限, 政策上限)`。** 系数是政策内的档位选择,绝不超政策上限造钱。系数具体值以政策主数据区间为准,回测校准。

### 9c. 术语表

| 术语 | 含义 | 处理 |
|---|---|---|
| 计提 accrual | 算出应给返利、入账待兑现 | 脚本算,可重放 |
| 兑现 payout | 实际付款 | HITL,幂等,失败重试有上限 |
| 锁定期 | 已 accrued 的期间 | 政策版本冻结,不追溯改写 |
| 净额 | 返利−扣罚−已兑现 | 源头分账,负不倒扣 |
| 幂等键 | (dealer,period,cycle) | 同键已兑现不再付 |
| 源头分账 | 返利/罚款各管各 | 只净额行合并展示 |
| **阶段系数(v0.2)** | 投入强度按 effective_stage 调档 | **政策区间内选档,绝不造钱;只动档位不改算账事实** |
| **stage_no_new_accrual(v0.2)** | 淘汰期停止新增计提 | 只结清存量,不加码 |
| **stage_unknown_base_accrual(v0.2)** | 阶段未知退回基准 | 与 L1-04 相反:涉钱漏发可补、错发难追,宁保守 |

### 9d. 踩坑记录(预置)

- ❌ Q3 政策调高,回头把 Q2 已付返利重算补差 → 锁定期被追溯改写,账目乱、经销商纠纷 → ✅ 政策版本按兑现期锁定,计提即冻结。
- ❌ 同一季度兑现单跑了两次,经销商收到两笔返利 → 真金白银多付 → ✅ 幂等键 (dealer,period,cycle) 防重复兑现。
- ❌ 多政策叠加机器自己挑了"对公司有利"的一个 → 越权解释政策 → ✅ policy_conflict 转人工,绝不自挑。
- ❌ 销量源单据缺失也照计提 → 计提依据不可追溯,审计过不了 → ✅ unreconciled 不出计提单。
- ❌ 把 L1-05 扣罚直接从返利计提额里减掉写进 breakdown → 两条审计线纠缠,罚款来源被洗掉 → ✅ 源头分账,只净额行合并。
- ❌ 健康度差,机器自动扣了返利 → 替人做了经销商管理决定 → ✅ 只读参考,扣不扣是人批时的决定(on_hold)。
- ❌ 净额为负,机器从下季返利里自动倒扣 → 自动追讨越权 → ✅ net_negative 转人工。
- ❌ 付款接口失败重新生成兑现单 → 申报重走、可能双付 → ✅ 失败只卡通道,不重单不重审批,重试有上限。
- ❌(v0.2,值得记)**按阶段给钱时突破政策上限**:导入期"该多投",系数一乘超过政策返点上限,阶段成了凭空造钱的借口 → 多发的钱审计追不回、政策形同虚设 → ✅ 阶段只能在政策区间内选档位,clamp 到政策上限,超出截断不放行。**阶段决定"在政策内投多投少",不决定"政策外能不能多给"。**
- ❌(v0.2)阶段判不出(unknown)就按"可能是导入期"加码多发 → 错发难追 → ✅ unknown 退回基准,绝不加码(与 L1-04 相反:那里漏列只丢机会,这里多发是真金白银)。
- ❌(v0.2)淘汰期 SKU 还在按阶段产生新增返利计提 → 给要退的品继续砸钱 → ✅ stage_no_new_accrual,只结清存量已发生项。
- ❌(v0.2)用阶段系数反向改了销量/出厂价去凑计提额 → 阶段污染了算账事实 → ✅ 阶段只乘在投入档位上,事实(销量/COGS/政策条款)永远不动。
- ❌(v0.3 loop)把「兑现」设成自动 = 机器自动给经销商打款、还可能重复打 = 多付且不可追回(比重复下单更直接的钱损,钱出账就拿不回) → ✅ 兑现必须永久挂人,连接器层不给付款动作:计提(算账+草案)可周期自动,兑现/红冲全程人批,permission 禁一切自动付款/划账。
- _(后续迭代继续往下加)_

---

## 10. Scripts — 计提重放 / 锁定期 / 净额分账 / 幂等 / 双签 / 付款失败(出件前必跑)

```python
PAYOUT_INFLIGHT = {"paying", "paid"}          # 已兑现/兑现中 → 幂等占用

def accrue(achievement, policy_version_table):
    """全脚本可重放;政策值来自锁定版本表(经 MCP)。机器不加码。"""
    breakdown, total = [], 0
    for rule in policy_version_table.rules():          # 阶梯/任务/专项
        amt = rule.compute(achievement)                # 纯脚本
        breakdown.append({"type": rule.type, "amount": amt, "policy_ref": rule.ref})
        total += amt
    return breakdown, total

# ---- v0.2 阶段调档:只在政策区间内 clamp,绝不造钱 ----
W_STAGE = {"导入": 1.7, "成长": 1.35, "成熟": 1.0, "衰退": 0.5, "焕新": 1.35, "unknown": 1.0}
NO_NEW_ACCRUAL_STAGES = {"淘汰"}

def stage_adjust(base_accrued, stage, policy_floor, policy_cap, has_revamp_signal=False):
    """返回 (系数, 调整后额, capped?)。焕新无改版信号退基准;淘汰由调用方拦在前。"""
    coef = W_STAGE.get(stage, 1.0)
    if stage == "焕新" and not has_revamp_signal:
        coef = 1.0                                     # 无改版信号退回基准
    raw = base_accrued * coef
    adjusted = min(max(raw, policy_floor), policy_cap) # clamp:绝不超政策上限
    return coef, round(adjusted, 2), raw > policy_cap

def net_payable(rebate, l1_05_penalty, already_paid):
    """源头分账:三项各自传入,只此处相加;负不倒扣由调用方转人工。"""
    return rebate - l1_05_penalty - already_paid

def validate(out, ledger_before, now, policy_lock=None, finance_ready=False, policy_cap=None):
    errs = []
    # ===== 计提单 =====
    if out.get("accrual_id"):
        stage = out.get("effective_stage")
        # 政策锁定:已 accrued 不得换版本
        cur = ledger_before.get(out["accrual_id"])
        if cur and cur.get("status") == "accrued" and \
           cur.get("policy_version") != out.get("policy_version"):
            errs.append(f"locked_period_policy_rewritten:{out['accrual_id']}")
        # 基础计提可重放(事实层,与阶段无关)
        if policy_lock is not None and out.get("base_accrued") is not None:
            bd, total = accrue(out["achievement"], policy_lock)
            if out["base_accrued"] != total:
                errs.append(f"base_accrual_not_replayable:{out['accrual_id']}")
        # ===== v0.2 阶段调档可重放且不超政策上限 =====
        if out.get("base_accrued") is not None and out.get("accrued_amount") is not None:
            coef = out.get("stage_coefficient", 1.0)
            raw = out["base_accrued"] * coef
            # 超政策上限必须被截断
            if policy_cap is not None and out["accrued_amount"] > policy_cap:
                errs.append(f"stage_exceeds_policy_cap:{out['accrual_id']}")    # 阶段造钱→报错
            if policy_cap is not None and raw > policy_cap and out["accrued_amount"] != policy_cap:
                errs.append(f"over_cap_not_clamped:{out['accrual_id']}")        # 超上限未截断
            # unknown 不得加码
            if stage == "unknown" and out["accrued_amount"] != out["base_accrued"]:
                errs.append(f"unknown_stage_weighted_accrual:{out['accrual_id']}")
            # 淘汰期不得产生新增计提
            if stage in NO_NEW_ACCRUAL_STAGES and out["accrued_amount"] > 0 and \
               "stage_no_new_accrual" not in str(out.get("flags", [])):
                errs.append(f"clearance_new_accrual:{out['accrual_id']}")
            # 阶段调整须溯源
            if out["accrued_amount"] != out["base_accrued"] and stage not in ("unknown", None) and \
               not any(f.startswith("stage_weighted") or f.startswith("stage_capped")
                       for f in out.get("flags", [])):
                errs.append(f"stage_adjust_without_trace:{out['accrual_id']}")
        # ===== v0.2 算账事实不得被阶段污染 =====
        if out.get("_fact_altered_by_stage"):
            errs.append(f"accounting_fact_polluted_by_stage:{out['accrual_id']}")
        # 对账闸门
        if out["status"] == "accrued":
            if any(f.startswith("unreconciled") or f.startswith("policy_conflict")
                   for f in out.get("flags", [])):
                errs.append(f"accrued_while_unreconciled:{out['accrual_id']}")
            # 接口先行:源未接入不得进 accrued
            if any(f in out.get("flags", []) for f in ("policy_source_pending", "finance_source_pending")):
                errs.append(f"accrued_with_source_pending:{out['accrual_id']}")
    # ===== 兑现单 =====
    if out.get("payout_id"):
        nb = out.get("net_breakdown", {})
        # 源头分账:三项必须各带 source_ref,净额 = 三项相加
        for k in ("rebate_accrued", "l1_05_penalty", "already_paid"):
            if nb.get(k, {}).get("amount", 0) != 0 and not nb.get(k, {}).get("source_ref"):
                errs.append(f"net_item_without_source:{k}")               # 罚款来源不得被洗掉
        calc = nb.get("rebate_accrued", {}).get("amount", 0) - \
               nb.get("l1_05_penalty", {}).get("amount", 0) - \
               nb.get("already_paid", {}).get("amount", 0)
        if out.get("net_payable") != calc:
            errs.append(f"net_not_source_separated:{out['payout_id']}")
        # 净额为负不倒扣
        if out.get("net_payable", 0) < 0 and "net_negative" not in str(out.get("flags")):
            errs.append(f"negative_net_auto_clawback:{out['payout_id']}")
        # 幂等防重复兑现
        key = (out["dealer_id"], out["period"], out["cycle"])
        for pid, rec in (ledger_before or {}).items():
            if isinstance(rec, dict) and \
               (rec.get("dealer_id"), rec.get("period"), rec.get("cycle")) == key and \
               rec.get("status") in PAYOUT_INFLIGHT and pid != out["payout_id"] and \
               "dedup_suppressed" not in str(out.get("flags")):
                errs.append(f"duplicate_payout:{key}")                    # 真金白银多付
        # 人批 + 双签 + 不自动付款
        ap = out.get("approval", {})
        if out["status"] in ("paying", "paid") and not ap.get("approved_by"):
            errs.append(f"payout_without_human_approval:{out['payout_id']}")  # 人批前绝不付款
        if out.get("net_payable", 0) > DUAL_SIGN_LIMIT and \
           out["status"] in ("paying", "paid") and not ap.get("dual_sign_by"):
            errs.append(f"large_payout_without_dual_sign:{out['payout_id']}")
        # 健康度不得自动扣/暂缓:on_hold 必须人填原因
        if out["status"] == "on_hold" and not out.get("hold_reason"):
            errs.append(f"auto_hold_without_human_reason:{out['payout_id']}")
        # 付款失败纪律(对标 L0-08)
        if out.get("payment_attempts", 0) > MAX_PAY_RETRIES and \
           "manual_payment_required" not in out.get("flags", []):
            errs.append(f"pay_retry_over_limit:{out['payout_id']}")
        if out["status"] == "payment_failed" and \
           (out.get("_payout_regenerated") or out.get("_reapproved")):
            errs.append(f"failure_restarted_payout:{out['payout_id']}")   # 不重单不重审批
        # 接口先行:财务未接入不得真付款
        if out["status"] in ("paying", "paid") and not finance_ready:
            errs.append(f"paid_while_finance_pending:{out['payout_id']}")
    # ===== 边界:不发起罚款/不改 L1-05/不据健康度自动扣 =====
    for f in out.get("fanout", []):
        if any(x in f for x in ("发起罚款", "改罚额", "L1-05:处置", "自动扣返利")):
            errs.append(f"illegal_fund_action:{f}")
    return errs
```

---

## 11. 评测起手式(13 条种子)

```json
[
 {"id":"c01",
  "input":{"achievement":{"进货量":4200,"动销":0.71},"policy":"阶梯3档+任务返,锁定 2026-Q2-v3"},
  "expect":{"accrued_amount":"脚本可重放","rebate_breakdown_per_item":true,
            "policy_version_frozen":"2026-Q2-v3","status":"reconciled"},
  "tags":["计提:脚本算分项可重放,政策版本生成即冻结"]},

 {"id":"c02",
  "input":{"event":"Q3 政策调高返点,系统尝试回头重算已 accrued 的 Q2 计提单"},
  "expect":{"blocked":"locked_period_policy_rewritten","note":"Q2 锁定版本不变,新政策只影响未锁定期"},
  "tags":["锁定期防追溯:已 accrued 期间政策不可改写"]},

 {"id":"c03",
  "input":{"net":{"rebate_accrued":104000,"l1_05_penalty":12000,"already_paid":0}},
  "expect":{"net_payable":92000,"each_item_has_source_ref":true,
            "penalty_not_merged_into_breakdown":true,"two_audit_lines_separate":true},
  "tags":["净额合并源头分账:返利/罚款各带引用,只净额行相加,不混账"]},

 {"id":"c04",
  "input":{"net":{"rebate_accrued":8000,"l1_05_penalty":11000,"already_paid":0}},
  "expect":{"net_payable":-3000,"no_auto_clawback":true,"flags_contains":"net_negative",
            "to_human":true},
  "tags":["净额为负:不倒扣不自动追讨,转人工"]},

 {"id":"c05",
  "input":{"payout":{"net_payable":92000,"approval":{"approved_by":"渠道财务-Wang","dual_sign_by":null}},
           "params":{"DUAL_SIGN_LIMIT":50000}},
  "expect":{"blocked":"large_payout_without_dual_sign","status_stays":"pending_approval",
            "human_no_change_amount":true},
  "tags":["大额兑现双签缺一不可;人批不改数"]},

 {"id":"c06",
  "input":{"event":"同 (DL012,2026-Q2,季) 已有 paid 兑现单,系统又生成一张"},
  "expect":{"blocked":"duplicate_payout","note":"幂等键防重复兑现,比重复下单更直接的多付"},
  "tags":["幂等防重复兑现(语义同 L0-08)"]},

 {"id":"c07",
  "input":{"l1_06_health":"该经销商 critical,系统想自动从返利里扣减/暂缓"},
  "expect":{"blocked":"健康度只读,不得自动扣/暂缓",
            "correct":"审批人可参考健康度人工置 on_hold(带 hold_reason),机器只承载"},
  "tags":["健康度只读参考:扣不扣是人批的决定,机器不自动据此动钱"]},

 {"id":"c08",
  "input":{"payout":{"status":"payment_failed","payment_attempts":3},"params":{"MAX_PAY_RETRIES":3}},
  "expect":{"flags_contains":"manual_payment_required","approver_notified":true,
            "payout_not_regenerated":true,"not_reapproved":true},
  "tags":["付款失败:重试上限转人工;不重单不重审批(对标 L0-08)"]},

 {"id":"c09",
  "input":{"base_accrued":104000,"policy_cap":150000,
           "case_导入":{"effective_stage":"导入","stage_coefficient":1.35},
           "case_成熟":{"effective_stage":"成熟","stage_coefficient":1.0}},
  "expect":{"base_same":104000,
            "case_导入":{"accrued_amount":140400,"within_policy":"140400<150000上限","flags_contains":"stage_weighted"},
            "case_成熟":{"accrued_amount":104000,"no_adjust":true},
            "both_in_policy_range":true,"fact_same_coef_different":true},
  "tags":["v0.2:同SKU导入vs成熟系数不同但都在政策内;base不变,算账事实不变"]},

 {"id":"c10",
  "input":{"base_accrued":104000,"policy_cap":150000,
           "effective_stage":"导入","attempted_coefficient":1.8},
  "expect":{"raw":"104000×1.8=187200","accrued_amount":150000,
            "capped":true,"flags_contains":"stage_capped_to_policy_limit",
            "error_if_passed":"stage_exceeds_policy_cap",
            "rationale":"阶段是政策内档位选择,绝不超上限造钱"},
  "tags":["v0.2:阶段系数致计提超政策上限→截断到上限,绝不放行造钱"]},

 {"id":"c11",
  "input":{"base_accrued":80000,"effective_stage":"unknown"},
  "expect":{"stage_coefficient":1.0,"accrued_amount":80000,
            "flags_contains":"stage_unknown_base_accrual","no_weighting":true,
            "error_if_weighted":"unknown_stage_weighted_accrual",
            "contrast":"与L1-04相反:涉钱漏发可补、错发难追,unknown退回基础"},
  "tags":["v0.2:unknown退回基础不加码(涉钱宁保守)"]},

 {"id":"c12",
  "input":{"sku":"6MX-EOL","effective_stage":"淘汰","existing_accrued":"存量已发生项 12000"},
  "expect":{"new_accrual":0,"flags_contains":"stage_no_new_accrual",
            "settle_existing_only":"只结清存量12000",
            "error_if_new":"clearance_new_accrual"},
  "tags":["v0.2:淘汰期不产新增计提,只结清存量(不给要退的品砸钱)"]},

 {"id":"c13",
  "input":{"base_accrued":104000,"effective_stage":"成长","stage_coefficient":1.35,
           "accrued_amount":140400,"params":{"DUAL_SIGN_LIMIT":50000}},
  "expect":{"accrued_in_policy":true,
            "payout_still_needs_dual_sign":"140400>50000双签缺一不可",
            "stage_does_not_bypass_gates":"对账/缺证/人批/双签全套照走"},
  "tags":["v0.2:阶段调整后仍走全套资金闸门——大额双签不被阶段绕过"]}
]
```

**打分维度(每条 0/1):**
1. 计提可重放 + 政策冻结(c01)
2. 锁定期防追溯(c02)
3. 净额源头分账(c03)
4. 负净额不倒扣(c04)
5. 大额双签 + 人批不改数(c05)
6. 幂等防重复兑现(c06)
7. 健康度只读不自动动钱(c07)
8. 付款失败纪律(c08)
9. **同SKU阶段系数不同都在政策内**(c09:base 不变,事实不变)
10. **超政策上限截断不造钱**(c10:§10 stage_exceeds_policy_cap 守)
11. **unknown 退基础不加码**(c11)
12. **淘汰不产新增计提**(c12)
13. **阶段不绕过资金闸门**(c13:调整后仍双签)

> 最危险的四类错:**多付**(c06/c01)、**追溯改账**(c02)、**混账**(c03)、**v0.2 阶段造钱**(c10——阶段成了突破政策上限的借口,这是涉钱节点接生命周期最致命的诱惑)。资金节点的信用全在"算得对、付得准、查得清",宁可 partial 占位不真付,也不错付一分。**阶段只能在政策区间内选档位,绝不是政策外的加钱授权——这道 clamp 是 v0.2 的命门。**

---

## 12. 运行层 · Loop Spec(BEA 优先级更高)

> **本块是运行层补充,优先级低于上面全部 BEA 设计**(Loop 规则 L1:先 BEA 后 Loop)。本节点 BEA 已造对(链式 + 双台账状态机 + 对账闸门 + 净额分账 + 幂等 + 重 HITL),故可进 Loop 化。
> **本节点照 L1-05「重 HITL 出手类」范本**——涉钱、连接器无动钱动作、出手分两段。
> **⚠️ 出手分两段(同 L1-05 涉钱逻辑):**
> - **第一段「计提(算账 + 生成草案)」**——不动钱,可由兑现周期到期**事件触发**(月/季 cron);
> - **第二段「兑现(付钱)/ 红冲」**——动钱,**必须人批,绝不自动付款**,永不进自动化。
> **⚠️ 连接器物理上没有「付款/划账」动作**(同 L1-05 没有「划扣」):`connector.actions` 只「生成计提单草案」,出手的手永远够不到付款接口。
> **⚠️ 接口先行叠加**:政策表/财务 ERP 未接入前,**计提草案也挂人**(同 v0.2 接口先行:占位运行不当真实计提)。

### 12.1 五范式 → 护栏映射(衔接 §5)

L1-07 属**涉钱类(兑现 = 给经销商打款)+ 重 HITL**,与 L1-05 同档(都动钱、都重 HITL):
- **human_gate**:兑现必须人批;`net_payable > <双签阈值>` 大额双签缺一不可;红冲必须人批留痕;政策冲突转人工不自选。
- **permission_boundary 禁一切自动付款 / 改金额 / 超上限 / 混账**:`can` 只含不动钱的核算动作(读达成/算计提/生成草案/标净额);`cannot` 明列「自动兑现/付款/划账、改计提金额、超政策上限计提、返利扣罚混账、自动红冲改历史账」。
- 对照 L1-05:L1-05 的钱是「罚别人的钱」(机器碰都不碰),L1-07 的钱是「给经销商打款」(机器算得出该给多少,但**付款这一手永久留给人**)——同为重 HITL 涉钱,connector 都收到「无动钱动作」的最紧档。

### 12.2 loop_spec 标准块(照《Loop 运行层规则》§3,字段对齐《字段字典 v1.0》)

```yaml
loop_spec:
  enable: true
  why_loop: "返利按兑现周期重复;done=计提/兑现/红冲三类;对账闸门/政策冲突/净额混账/幂等能说不对 → 满足"

  automation:
    trigger: "兑现周期到期(月/季 cron)触发计提;兑现不自动、等人批"
    inbox: "返利待处理收件箱(计提草案/待人批兑现/待红冲 三类)"

  worktree:
    needed: true            # 多经销商并行,各账副本隔离

  skill:
    ref: "L1-07_rebate_accrual_v0_2.md"

  connector:
    actions: ["生成计提单草案"]   # 只生成草案;绝不开自动兑现/付款/划账/红冲——连接器物理无"付款"动作

  subagents:
    maker: "按政策主数据算计提(全脚本可重放)+ 生成计提草案"
    tracker: "独立审查:计提依据可溯源到源单据? 政策冲突? 净额返利与扣罚混账? 幂等重复计提? → 不过标 unreconciled/policy_conflict 转人工;合并前 dry run"

  memory:
    writes: "本经销商每周期:计提/兑现/红冲/为什么/源单据引用/待查"
    store: "[持久化存储]"

  # —— 4 道护栏(涉钱+重HITL,收到最紧)——
  acceptance_criteria: "一批经销商走完 算计提→tracker对账→计提草案出/挂起,兑现待人批,每条留痕"
  permission_boundary:
    can: ["读销售达成/政策主数据", "算计提(可重放)", "生成计提单草案", "标记净额"]
    cannot: ["自动兑现/付款/划账", "改计提金额", "超政策上限计提", "返利扣罚混账", "自动红冲改历史账"]
  human_gate: "兑现必须人批;大额(阈值占位)双签;红冲必须人批留痕;政策冲突转人工不自选"
  observability: "每条留痕:source_ref / 谁判(maker/tracker/人) / 政策版本 / 对账状态 / 源单据 / 结果,可审计"
```

### 12.3 字段对齐说明(《字段字典 v1.0》)

- `accrued_amount`(应计提返利)、`net_payable`(净额 = 返利 − 扣罚 − 已兑现)、`source_ref`(留痕)均为字段字典标准名,与 §3 参数、全系统审计一致;
- `tracker` 的对账**读源单据 / 政策主数据,不自判**:计提依据溯源到源单据(同 §4 Step B 对账闸门「缺证不计提」)、政策冲突标 `policy_conflict` 转人工(不自选政策)、**净额分账校验**(`rebate_accrued` 与 `l1_05_penalty` 各带 source_ref 不混,同 §4 Step C 源头分账)、**幂等防重复计提**(同 (dealer_id, period, cycle) 不重算);maker 算、tracker 审、合并前 dry run(双子博弈);
- `connector.actions` 只「生成计提单草案」**不动钱**——与 `permission_boundary.cannot`(自动兑现/付款/划账)严格对齐:连接器物理上没有「付款」这个动作。同 L1-05 连接器没有「划扣」。

### 12.4 切自动检查单(护栏先于自动化;兑现/红冲永久挂人)

**可周期自动化的只有第一段(计提:算账 + 生成草案)**,且切自动前必须满足:
- ☐ tracker 对账链跑通(源单据溯源 / 政策冲突拦截 / 净额分账校验 / 幂等防重复计提 四项验证);
- ☐ 政策主数据 + 财务/ERP 接入(接口先行解除——未接入前计提草案也挂人,占位不当真实计提);
- ☐ 政策版本冻结逻辑生效(计提单按兑现期锁定版本,不被追溯改写)。
- 任一未满足 → 计提也保持手动/半自动。

**第二段(兑现/红冲)永久挂人,不进自动化检查单——它没有「切自动」这一项**:
- 兑现 = 给经销商打款,**机器只到「生成计提/兑现单草案」为止,付款由人批**(大额双签);红冲改历史账同样人批留痕;
- 这是 §8 HITL「机器算、人批、留痕、绝不自动付款」在运行层的延续,也是 §9 那条 loop 踩坑要防的:**把「兑现」设成自动 = 机器自动给经销商打款、还可能重复打 = 多付且不可追回(钱出账就拿不回,比重复下单更直接的钱损)。兑现必须永久挂人,连接器层不给付款动作。**

---

## 待填变量(套用时替换)
- `owner`;`<双签阈值>` `<付款重试上限>`(与渠道财务共同定)
- **渠道返利政策主数据** — 阶梯档/任务返/专项 + 兑现周期 + 版本管理 + **各档政策上下限(阶段 clamp 区间)**(经 MCP;接入前占位,不得真兑现)
- **§9b-2 阶段强度系数 W_stage(导入/成长/衰退档位)— 在政策区间内回测校准(v0.2)**
- **`effective_stage` 来源 —《SKU 生命周期阶段判定》契约,按 sku×scope×period(只读);焕新档需"改版信号"判据来源(v0.2)**
- **财务/ERP 系统** — 付款/冲账/源单据(经 MCP);接入后更新 §2 状态表
- 销量/回款源单据口径 — 进销存/财务接入后对齐
- 计提/兑现台账落库 — 与既有台账同基建分表(下两本)
