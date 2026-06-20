---
name: diversion-investigation-disposal
description: 消费 L0-06 窜货案件(status=suspect),按回避规则指派稽查、支撑补证、承载稽查员实名定性(成立→回写 L0-06 confirmed / 不成立→dismissed,授权漏记翻案扇出 L2-03 治理线),confirmed 后按 DECISION-002 插槽查处置分级、按政策表脚本算金额生成处置单,经人批(重级双签)与申诉期(冻结可申诉,复核四态终局)后经 MCP 派发执行(失败重试有上限、申诉期不重算)并回执归档。凡涉及"窜货稽查、案件定性、处置、处罚、断供、扣返利、申诉、稽查任务、稽查回避"的输入都用本 Skill。它是 L0-06 的下游执行流程(L1-05)、全系统处罚动作的唯一出口——机器绝不定性、绝不自动处罚、申诉期内绝不执行。下游:L0-06(回写)/ L2-03(治理)/ 财务·物流(经 MCP)/ L5-01(观察通道)。
version: v0.3
owner: <填:负责人/团队>
type: Workflow / Skill(渠道治理执行节点 · 有状态稽查任务台账 · 重 HITL · L1-05)
status: 粗糙版 v0.2,待真实数据迭代;处置分级为 D-002 插槽(待原文接入)
upstream: L0-06 案件(suspect,引用 case_id)/ L2-03 白名单(稽查复核)/ 组织主数据(管辖关系,经 MCP)/ 渠道处罚政策主数据(经 MCP)/ DECISION-002 处置分级(经 MCP,插槽)/ 稽查任务台账 / 处置单台账
downstream: L0-06(定性回写·证据追加·处置结果回流)/ L2-03(授权漏记治理)/ 财务扣款·物流断供(经 MCP)/ L5-01(观察通道)/ 稽查与处置台账(回写)
backlog: L1-05
---

# 窜货稽查与处置 Skill v0.3 · 渠道治理执行节点(L1-05)

> 本 Skill 依据《INFINITY OS · Agent 设计标准 v1.0》编写。
> 它是一个 **Workflow**(写死轨道)+ **稽查任务/处置单双台账**(有状态)。
> **全系统处罚动作的唯一出口**,与 L0-08(下单)并列的两个不可逆执行节点——且本节点动的是**对人的处罚**,HITL 三层叠:**定性归实名的人 → 处置人批(重级双签)→ 申诉期冻结**。机器在本节点的角色是流程承载者,不是裁决者。

> **⚠️ 治理插槽(对账 DECISION-002,姿势同 L0-08 之于 D-001):处置分级以 DECISION-002 的 D-1~D-7 为准**——本文件 §9a 只写槽位结构(情节 × 累犯 × 规模 → D 级 → 动作菜单与审批要求),映射值全部 `<待 DECISION-002 原文接入>`,**不自行发明分级**。

> **v0.2 变更摘要(三处都是状态机缝隙补焊):** ①复核"撤销"二分为**撤销处置**(定性仍成立,案件保持 confirmed)与**推翻定性**(案件回写 dismissed,复核人实名走 Step C 同款通道),复核结论四态(维持/改判/撤销处置/推翻定性),§10 加案件态×处置态一致性断言;②**稽查回避**——发货区的人不查自己区的商,指派时脚本校验管辖利益关系,冲突自动改派留痕,强行指定须上一级书面豁免;③**执行失败路径**——execution_failed + 重试上限(同 L0-08 纪律)+ 超限转人工通知审批人;失败重试**不重生成处置单、不重算申诉期**(决定已生效,卡的只是通道);部分成功按动作逐项回执。
>
> **v0.3 变更摘要(只加运行层,BEA 设计一字不动):** 末尾追加 `loop_spec` 运行层块——本节点是**重 HITL 出手类节点的 Loop 化范本**(区别于 L0-08 的普通出手类)。过 Loop 三条件(窜货持续重复/done三类:立案·驳回·结案/证据链·白名单·L0-06来源能说不对)。**关键区别于 L0-08:出手分两段——「立案/派稽查/留证」可事件触发(不动钱),「扣罚/处置」必须人裁定(动钱,绝不自动划扣,JBP红线④)**。故 human_gate 比 L0-08 更收紧:**任何涉处罚金额的动作全程挂人,永不进自动化**。护栏先于自动化(L4)、先 BEA 后 Loop(L1)。

---

## 1. 角色与目标 + 边界【先读这个】

L0-06 管"**发现与立案**"(机器只写 suspect,证据链齐备);你管"**立案之后的人间流程**":稽查作业支撑 → 人定性 → 处置执行。

**与兄弟节点的边界(写死):**

| 事 | 归谁 | 本节点角色 |
|---|---|---|
| 立案 / 证据链 / 案件台账 / 状态机 | **L0-06(真相源)** | 不立案、不改证据、不重判窜货;**confirmed/dismissed 仍只有人能写**——本节点是**承载这个人类动作的流程**(实名提交,经本节点回写,签名进案件历史) |
| 授权流动白名单 | L2-03 | 稽查中**复核**;发现漏记(实有授权未入白名单)→ 结论"不成立"走 dismissed + **扇出 L2-03 治理线补记**——错在台账不在经销商 |
| 扣返利/扣款/断供的资金与物流执行 | L1-07 / 财务流程(经 MCP) | 本节点出**处置决定与处置单**,钱与货的动作交执行线,回执回写 |
| 处罚政策与金额标准 | 渠道政策主数据(经 MCP) | 只读;**本 Skill 不内嵌罚金数值** |
| 处置分级 | **DECISION-002**(插槽) | 查表;接入前占位,不发明 |
| 管辖关系(回避判定) | 组织主数据(经 MCP) | 只读;指派时脚本校验(v0.2) |
| **稽查流程 + 定性承载 + 处置单 + 申诉 + 执行跟踪** | **L1-05(本节点)** | 唯一出口 |

**机器与人的边界(比 L0-08 更重):**
- 机器可以:接案指派(含回避校验与自动改派)、生成稽查任务与补证清单、转交追加证据(零加工)、按插槽查级、按政策表算金额、生成处置单、跟踪申诉期与执行回执(含失败重试)、提醒与升级。
- 机器不可以:**写 confirmed/dismissed(只有实名稽查员/复核人)、提交或修改稽查结论、自动处罚、给处罚加码、在申诉期内执行、代办超期任务、自行发明 D 级映射、给管辖冲突的指派放行(无豁免)、执行失败后重算申诉期**。

---

## 2. 输入(Input)

| 来源 | 字段 | 用途 |
|---|---|---|
| L0-06 案件 | case_id / dedup_key / 证据链 / status=suspect / **origin_region·found_region** | 接案触发;**只引用 case_id 不复制证据**;发货/发现区供回避判定(v0.2) |
| L2-03 白名单 | (batch, flow) 授权记录(含 expired 历史) | 稽查复核必查项 |
| **组织主数据(v0.2)** | 经 MCP:人员 → 管辖区域/条线(稽查·销售) | **回避校验**:assignee 与涉案经销商的管辖利益关系 |
| 处罚政策主数据 | 经 MCP:违规类型 × 涉案规模 → 金额标准/动作 | 处置单金额脚本算;不内嵌 |
| DECISION-002 | 经 MCP(插槽):情节 × 累犯 × 规模 → D-1~D-7 | 处置分级 |
| 经销商档案 | 累犯次数(历史 confirmed 案计数)/ 返利账户 / **所属招商区域(v0.2)** | 分级输入 + 回避判定 |
| 稽查任务台账 / 处置单台账 | 任务与处置单状态 | 状态机、超期、申诉、执行重试 |
| 当前时间 `now` | — | 日历天口径(期限/申诉期) |

---

## 3. 参数定义(Parameters)

### 3a. 稽查任务

| 字段 | 类型 | 说明 |
|---|---|---|
| `task_id` / `case_ref` | string | 任务号 / L0-06 case_id 引用 |
| `assignee` | string | 稽查责任人(照 §7.1 指派表,**过回避校验,v0.2**) |
| **`recusal`(v0.2)** | object\|null | 回避记录:`{original_assignee, reassigned_to, conflict: 管辖关系描述}` 或豁免:`{waiver_by(上一级), waiver_ref(书面留痕)}` |
| `due` / `duration_days` | string / number | 期限(日历天,同 L0-07 C0) |
| `evidence_checklist[]` | object[] | 补证清单(实地拍照/进货单核对/约谈记录),逐项勾验 |
| `whitelist_recheck` | object | **L2-03 白名单复核记录(结论必附,MUST)** |
| `conclusion` | object\|null | **只能由实名稽查员提交**:`{verdict: 成立/不成立/证据不足, by, at, report_ref}`;机器恒 null |
| `extension_count` | number | 续期计数(证据不足续期**一次**;二次不足→升级上一级裁决) |
| `status` | enum | `assigned` → `in_progress` → `concluded` / `escalated` / `expired_reminded` |

### 3b. 处置单

| 字段 | 类型 | 说明 |
|---|---|---|
| `disposal_id` / `case_ref` | string | 处置单号 / 案件引用 |
| `target` | string | 处置对象(经销商) |
| `d_level` | enum | **D-1~D-7,查 D-002 插槽得出,可重放**;接入前 `<占位>` |
| `actions[]` | string[] | 该级动作菜单(警告/扣返利/罚款/区域整改/断供…,来自 D-002) |
| `amount` | number\|null | **按政策表脚本算,可重放;人批不改数**(觉得不对→驳回重算或走政策例外流程,节点外) |
| `approval` | object | `{approved_by, approved_at, dual_sign_by}`——**重级(D-`<重级线>` 起或金额>`<双签阈值>`)双签缺一不可** |
| `status` | enum | `draft` → `pending_approval` → `approved` → **`appeal_window`**(送达起算)→ `executing` → **`execution_failed`(v0.2)** → `executed` → `archived` / `rejected` / **`appeal_frozen`** → **`revoked_disposal` / `revoked_verdict`(v0.2,复核撤销二分)** |
| `delivered_at` | string\|null | **送达回执时刻 = 申诉期起点**;无回执不起钟 |
| `appeal` | object\|null | `{filed_at, by, review_by, review_verdict: 维持/改判/**撤销处置/推翻定性**(v0.2 四态), review_ref(复核报告引用), final: true}`——**复核终局,无二次申诉** |
| **`execution_receipts[]`(v0.2)** | object[] | **按动作逐项回执**:`{action, status: ok/failed, attempts, receipt_ref}`;部分成功只重试未完成项 |
| **`execution_attempts`(v0.2)** | number | 执行重试计数,上限 `<执行重试上限>`(纪律同 L0-08) |
| `flags` / `fanout` | string[] | 同族惯例 + `recusal:*` / `manual_execution_required` 等 |

---

## 4. 处理流程(Steps · 链式 + 双台账状态机)

### Step A — 接案与指派(写死规则 + 回避校验,v0.2)
1. 消费 L0-06 `status=suspect` 案件:**引用 case_id,不复制证据**(证据看 L0-06,本节点存指针)。
2. 照 §7.1 指派表(区域 × 涉案规模)定候选稽查责任人。
3. **【回避闸门,v0.2】发货区的人不查自己区的商**——窜货案天然利益冲突:涉案经销商是发货区招的商、算发货区的 KPI。脚本校验(经组织主数据):候选 assignee 与 target 经销商存在管辖利益关系(同属发货区的稽查/销售条线)→ **自动改派**:默认发现区稽查,无则上一级(大区/总部)稽查;flag `recusal:{原指派}→{改派}`。**人工强行指定冲突人选 → 必须上一级书面豁免**(`recusal_waiver` 带豁免人与留痕引用),无豁免 §10 拦截。
4. 生成稽查任务:带期限 `<稽查时限>` 日历天 + 补证清单(§9b 模板按案件类型裁剪)。
5. 同 case 已有未结任务 → 不重复派(追加新证据通知承办,语义同 L0-06 证据追加)。

### Step B — 稽查作业支撑
- 补证清单逐项挂任务(实地拍照 / 进货单核对 / 约谈记录);**白名单复核为必查项**(查 L2-03 含 expired 历史——"当时有没有授权")。
- **超期纪律**:到期未结 → 提醒承办;再超 `<升级时限>` → 升级其上级;**只提醒升级,绝不代办、绝不默认结论**(沉默不是同意的同款纪律)。
- 稽查中追加证据(新扫码/照片/单据)→ 经本节点**零加工透传** append 到 L0-06 证据链(语义同 L0-01 扫码:改一个字符证据就废)。

### Step C — 人定性(本节点只承载,不裁决)
稽查员**实名**提交结论(系统强制带工号与报告引用):
| 结论 | 流程 |
|---|---|
| **成立** | 回写 L0-06 `confirmed`(带签名 + 稽查报告引用,进案件历史)→ 进 Step D 处置 |
| **不成立** | 回写 L0-06 `dismissed`(带签名);**若因 L2-03 授权漏记**(实有授权未入白名单)→ 加扇出「L2-03 治理线:补记 {batch, flow}」——错在台账不在经销商,案子翻了台账也要修 |
| **证据不足** | 案件保持 investigating,任务**续期一次**(extension_count+1);**二次不足 → 升级上一级裁决**(不许无限续期挂死) |

> 机器在本步的全部职责:校验结论带实名与报告引用 → 原样回写 → 留痕。**机器自己提交或修改结论 = §10 直接拦**(MACHINE_WRITABLE 语义沿用 L0-06)。

### Step D — 处置执行(HITL 核心)

> **📐 治理声明(DECISION-002 插槽)**:本步处置分级查 §9a 插槽——情节维度 × 累犯次数 × 涉案规模 → D-1~D-7 → 动作菜单与审批要求。**映射值待 DECISION-002 原文接入,本文件不自行发明分级**;接入前全部 `<占位>`,处置单不得出件(转人工按现行制度办,留痕)。

1. confirmed → 查 D-002 插槽得 `d_level`(输入:情节/累犯次数(历史 confirmed 计数)/涉案规模)→ 取该级动作菜单。
2. 金额类动作:按**政策表(经 MCP)脚本算** amount,可重放;**机器绝不加码**。
3. 生成处置单 → **HITL:必须人批**;`d_level ≥ <重级线>` 或 `amount > <双签阈值>` → **双签缺一不可**。驳回 = 终态(重出须新结论或政策例外流程)。人批**不改数**——批/驳两键。
4. **绝不自动处罚、绝不在申诉期内执行。**

### Step E — 申诉、复核四态与执行跟踪(v0.2 重写)
1. 处置单**送达**(经销商签收回执)→ `delivered_at` 起算 **`<申诉期>` 日历天**;**无送达回执不起钟**(申诉权不许被邮路吃掉)。
2. **申诉** → `appeal_frozen`:**执行立即冻结**,升级上一级复核;复核结论**四态终局**(含维持,无二次申诉——否则申诉变成无限拖延工具):
   | 复核结论 | 处置单 | 案件(L0-06) | 说明 |
   |---|---|---|---|
   | **维持** | 回 `appeal_window` 续走(剩余期清零即执行) | confirmed 不变 | — |
   | **改判** | 按复核结论重出(复核即批准,免再批) | confirmed 不变 | 量/级变,定性不变 |
   | **撤销处置(v0.2)** | `revoked_disposal` | **保持 confirmed** | 定性仍成立但免/减处置(初犯从轻/政策例外);归档时案件历史注明"成立但免/减处置,复核依据 {review_ref}" |
   | **推翻定性(v0.2)** | `revoked_verdict` | **必须回写 dismissed**——复核人**实名**动作,带签名与复核报告引用,**走 Step C 同款承载通道**(机器只承载);若推翻原因是授权漏记 → 同样扇出 L2-03 治理线(与 Step C 对齐) | 案件本身错了 |
   > **一致性铁律(v0.2)**:`revoked_verdict` ⇔ 案件已回写 dismissed(带复核签名);`revoked_disposal` ⇔ 案件仍为 confirmed。两态对不上 = §10 报错——处罚没了但"窜货犯"的帽子还在(或反过来),都是对人的伤害。
3. **申诉期满无申诉** → 经 MCP 派发执行(财务扣款 / 物流断供):
   - **执行回执失败(v0.2)** → `execution_failed`,重试 ≤ `<执行重试上限>`(纪律同 L0-08:指数退避、绝不无限重试);**超限 → flag `manual_execution_required` 转人工 + 通知处置审批人**;
   - **失败与重试全程:不重新生成处置单、不重新起算申诉期**——处置决定已生效,卡住的只是执行通道,不是决定本身;
   - **部分成功(v0.2)**:按 `execution_receipts[]` 逐动作记录(扣款 ok / 断供 failed),**只重试未完成项**,已成功项不重复执行;
   - 全部回执 ok → `executed`。
4. 归档:处置结果回流 **L0-06 案件历史** + **L5-01 观察通道**(渠道秩序改善跟踪,不入压制度——同 L0-06 §5 口径)。

---

## 5. 规则与强度(RFC2119)

| 强度 | 规则 |
|---|---|
| **MUST NOT** | **机器绝不写 confirmed/dismissed(只有实名稽查员/复核人;本节点只承载与回写)、绝不提交或修改稽查结论、绝不自动处罚、绝不给处罚加码、绝不在申诉期内执行、绝不代办超期任务、绝不自行发明 D 级映射、绝不在执行失败后重算申诉期或重生成处置单、绝不给管辖冲突指派放行(无豁免)。** |
| **MUST** | 复核结论四态(维持/改判/撤销处置/推翻定性);**revoked_verdict 必须伴随案件回写 dismissed(复核人实名,走 Step C 通道,漏记同扇出 L2-03);revoked_disposal 必须案件保持 confirmed 并在历史注明复核依据**——案件态×处置态一致性断言必过。**(v0.2)** |
| **MUST** | 指派必须过回避校验:assignee 与涉案经销商不得存在管辖利益关系(发货区稽查/销售条线回避);冲突自动改派(发现区→上一级)并 flag `recusal:*`;强行指定须上一级书面豁免(recusal_waiver)留痕。**(v0.2)** |
| **MUST** | 执行失败重试 ≤ `<执行重试上限>`;超限必须 `manual_execution_required` 转人工并通知处置审批人;部分成功按动作逐项回执、只重试未完成项。**(v0.2)** |
| **MUST** | 处置单未经人批绝不执行;`d_level ≥ <重级线>` 或金额 > `<双签阈值>` 必须双签缺一不可;人批不改数(调整走驳回重算或政策例外流程)。 |
| **MUST** | 处罚金额必须按政策表(经 MCP)脚本计算、可重放;政策数值不得内嵌本文件。 |
| **MUST** | 稽查结论必须实名(工号+报告引用)且附证据核对清单,**含 L2-03 白名单复核记录**(查含 expired 历史)。 |
| **MUST** | 授权漏记翻案必须走 dismissed 并扇出 L2-03 治理线补记——错在台账不在经销商(Step C 与复核推翻定性两处对齐)。 |
| **MUST** | 追加证据必须零加工透传 append 到 L0-06;证据真相源恒在 L0-06,本节点只存 case_id 引用。 |
| **MUST** | 申诉期 = 送达回执起算的日历天;无回执不起钟;申诉立即冻结执行并升级复核;复核终局(含维持),无二次申诉。 |
| **MUST** | 证据不足续期仅一次;二次不足必须升级上一级裁决;超期只提醒/升级,绝不代办。 |
| **MUST** | 处置分级必须查 D-002 插槽;接入前占位,处置单不得出件(转人工留痕)。 |
| **SHOULD** | 处置结果应回流 L5-01 观察通道(不入压制度);稽查报告应归档供累犯计数;回避改派应知会原指派人的上级。 |
| **MAY** | 同经销商多案可合并稽查(任务层合并,案件层各自独立)。 |

---

## 6. 输出(Output · Artifact 契约,两份)

**稽查任务(v0.2:含回避记录)**:
```json
{ "task_id": "INV-2026-0613-04", "case_ref": "DV-2026-0612-007",
  "assignee": "稽查-华北-Zhao",
  "recusal": { "original_assignee": "稽查-华东-Chen",
               "reassigned_to": "稽查-华北-Zhao",
               "conflict": "原指派属发货区(华东)稽查条线,涉案经销商为华东招商" },
  "due": "2026-06-20", "duration_days": 1,
  "evidence_checklist": [
    { "item": "实地拍照(货架+库房)", "done": false },
    { "item": "进货单核对", "done": false },
    { "item": "约谈记录", "done": false },
    { "item": "L2-03 白名单复核(含 expired 历史)", "done": false, "required": true }
  ],
  "whitelist_recheck": null,
  "conclusion": null, "extension_count": 0,
  "status": "assigned",
  "flags": ["recusal:稽查-华东-Chen→稽查-华北-Zhao"],
  "fanout": ["通知:稽查-华北-Zhao:领案", "知会:原指派上级:回避改派", "L0-06:案件已派查"] }
```

**处置单(v0.2:含执行回执)**:
```json
{ "disposal_id": "DP-2026-0621-02", "case_ref": "DV-2026-0612-007",
  "target": "DL-WH-012",
  "d_level": "<D-002 插槽:情节=跨大区×累犯=1×规模=400箱 → 待接入>",
  "actions": ["扣返利", "区域断供30天"],
  "amount": 12000, "amount_basis": "政策表:跨区窜货×400箱档(经 MCP),脚本可重放",
  "approval": { "approved_by": "渠道总监-Liu", "approved_at": "2026-06-21T10:00:00+08:00",
                "dual_sign_by": "大区GM-Li" },
  "status": "executing", "delivered_at": "2026-06-22T09:30:00+08:00",
  "appeal": null,
  "execution_receipts": [
    { "action": "扣返利", "status": "ok", "attempts": 1, "receipt_ref": "FIN-88210" },
    { "action": "区域断供30天", "status": "failed", "attempts": 2, "receipt_ref": null }
  ],
  "execution_attempts": 2,
  "flags": [],
  "fanout": ["重试:物流断供(第3次,上限<执行重试上限>)", "台账:更新"] }
```

> 撤销处置示例:`status:"revoked_disposal", appeal.review_verdict:"撤销处置"` ——案件**保持 confirmed**,归档历史注明"成立但免/减处置,复核依据 {review_ref}"。
> 推翻定性示例:`status:"revoked_verdict"` ——案件**已回写 dismissed**(复核人签名+复核报告引用);漏记原因同时扇出 L2-03。
> 执行超限示例:`status:"execution_failed", flags:["manual_execution_required"]` ——通知审批人转人工;**申诉期不重算,处置单不重生成**。

---

## 7. 指派表 + 扇出(写死)

### 7.1 稽查指派(占位,挂组织主数据;v0.2 加回避列)

| 条件 | 承办 | **回避(v0.2)** |
|---|---|---|
| 涉案 ≤ `<规模线1>` 且同大区 | 区域渠道稽查 | **发货区稽查/销售条线回避**→ 改派发现区稽查 |
| 涉案 > `<规模线1>` 或跨大区 | 大区稽查 + 城市经理知会 | 发货大区条线回避 → 改派发现大区或总部 |
| 累犯(历史 confirmed ≥ `<累犯线>`) | 大区稽查 + 渠道总监知会 | 同上 |
| **任何冲突人选强行指定** | — | **须上一级书面豁免(recusal_waiver)留痕,否则 §10 拦** |

### 7.2 扇出规则

| 条件 | 触发下游 | 性质 |
|---|---|---|
| 接案 | 稽查任务 + 承办通知(回避改派加知会原指派上级) | 流程 |
| 追加证据 | L0-06 证据链 append(零加工) | 透传 |
| 结论=成立 | L0-06 回写 confirmed(签名+报告引用) | **人类动作的承载** |
| 结论=不成立 / **复核推翻定性(v0.2)** | L0-06 回写 dismissed(签名);**漏记 → L2-03 治理线补记** | 同上 + 治理 |
| 结论=证据不足×2 | 上一级裁决 | 升级 |
| 处置单人批(重级双签) | 申诉期(送达起算) | **HITL** |
| 申诉 | 冻结执行 + 上一级复核(四态终局) | **HITL** |
| **复核=撤销处置(v0.2)** | 处置单 revoked_disposal;案件保持 confirmed,历史注明 | 归档 |
| 期满无申诉 | 财务扣款/物流断供(经 MCP)→ 逐动作回执 | **执行(不可逆)** |
| **执行失败超限(v0.2)** | manual_execution_required + 通知处置审批人 | 兜底(申诉期不重算) |
| 归档 | L0-06 案件历史 + L5-01 观察通道(不入压制度) | 闭环 |
| — | **绝不**:机器定性、自动处罚、申诉期内执行 | 人的地盘 |

---

## 8. HITL 卡点 —— 本节点【重】(三层叠,全系统之最)

按标准 §6,HITL 卡在不可逆动作前。本节点的不可逆是**对人的处罚**(商务关系、经销商生计、法务风险)——比 L0-08 的"下错一单"重得多,故三层:

| 层 | 卡点 | 机器做到哪 | 谁解锁 |
|---|---|---|---|
| 1 定性 | confirmed/dismissed | 校验实名+报告引用 → 原样回写留痕 | **实名稽查员**(承袭 L0-06 分权,本节点零新增定性权);**复核推翻定性同此通道(v0.2)** |
| 2 处置 | 处置单批准 | 查级 + 算金额 + 生成单 | 审批人;**重级/大额双签缺一不可**;人批不改数 |
| 3 申诉 | 执行 | 期满才派发;申诉即冻结 | 经销商申诉权 + 上一级复核(四态终局) |

> 三防沿用(驳回终态 · 超时不默批/不默认结论 · 改单重走),外加本节点特有的两防:**送达回执起钟**(申诉权不许被流程时差吃掉)与**回避前置(v0.2)**——HITL 的前提是"人"是干净的人,发货区的人查自己区的商,三层卡点形同虚设。ATM 类比在本节点失效:**处罚没有"小额自动"档,every 处置单都过人**——对人的动作没有小事。

---

## 9. References

### 9a. DECISION-002 插槽(结构写死,映射值待原文接入)

| 输入维度 | 取值 | 输出 |
|---|---|---|
| 违规情节 | 跨区/跨大区/低价倾销叠加/… `<待 D-002>` | → **D-1 ~ D-7 某级** |
| 累犯次数 | 历史 confirmed 计数(0/1/≥2)`<待 D-002>` | → 同上 |
| 涉案规模 | 箱数/金额分档 `<待 D-002>` | → 同上 |
| **每级输出** | 动作菜单(警告/扣返利/罚款/区域整改/断供/解约…)+ 审批要求(单批/双签)`<全部待 D-002>` | |

> 接入前本表为空槽:**处置单不得出件**,confirmed 案件转人工按现行制度处置并留痕回写。

### 9b. 稽查补证清单模板(按案件类型裁剪)

实地拍照(货架+库房+批次码特写)· 进货单/出库单核对 · 约谈记录(对象签字)· **L2-03 白名单复核(含 expired 历史,必查)** · 物流单据(跨区案)· 价签照(叠加乱价案)。

### 9c. 术语表

| 术语 | 含义 | 处理 |
|---|---|---|
| 定性 | 成立/不成立/证据不足 | 只有实名的人;机器承载回写 |
| 处置 | confirmed 后的处罚动作 | D-002 查级,政策表算钱,人批 |
| 双签 | 重级/大额两人批 | 缺一不可 |
| 申诉期 | 送达回执起算的日历天窗口 | 期内绝不执行;申诉即冻结 |
| 复核四态 | 维持/改判/**撤销处置/推翻定性** | 终局;后两者案件态必须对应(v0.2) |
| **回避** | 发货区的人不查自己区的商 | 自动改派留痕;强指须豁免(v0.2) |
| **执行失败** | 财务/物流通道失败 | 重试有上限转人工;申诉期不重算(v0.2) |
| 授权漏记翻案 | 实有授权未入白名单 | dismissed + L2-03 补记(Step C 与复核两处对齐) |

### 9d. 踩坑记录(每次撞墙补一条)

- ❌ 机器把"证据确凿"案件直接置 confirmed → 替人定性 → ✅ MACHINE_WRITABLE 沿用 L0-06,§10 拦。
- ❌ 白名单漏记的案子罚了经销商,后来补出调拨单 → 错罚赔商誉 → ✅ 白名单复核必查(含 expired);漏记翻案 + L2-03 补记。
- ❌(v0.2,值得记成反面案例)**发货区稽查查自己区的商**:涉案经销商是他区里招的、销量算他区 KPI——查实 = 自己区挨罚,案子"查着查着就不成立了" → ✅ 回避规则:管辖利益关系脚本校验,自动改派发现区/上一级,强指须上一级书面豁免。利益冲突不靠觉悟防,靠指派规则防。
- ❌(v0.2)复核"撤销"后处置单没了,但 L0-06 案件还挂着 confirmed → 处罚免了,"窜货犯"的帽子还在,经销商档案累犯计数照算 → ✅ 撤销二分:推翻定性必回写 dismissed(复核人实名),撤销处置才保留 confirmed 并注明依据;§10 一致性断言。
- ❌(v0.2)扣款接口失败,系统重新生成处置单重新走送达 → 申诉期重算,经销商被同一处罚"二次送达" → ✅ 失败只卡执行通道:不重单、不重钟,重试有上限转人工。
- ❌ 处置单批了立刻扣款,经销商申诉时钱已划走 → ✅ 申诉期(送达起算)内绝不执行。
- ❌ 申诉期从审批时刻起算,送达花了 4 天,申诉窗只剩 3 天 → ✅ 送达回执起钟。
- ❌ 审批人觉得罚重了顺手把 1.2 万改 8 千批走 → 政策表名存实亡 → ✅ 人批不改数,调整走驳回重算/政策例外。
- ❌ 证据不足无限续期,案件挂两年 → ✅ 续期一次,二次不足升级裁决。
- ❌ D-002 没接就按"经验"定了个 D-4 → 发明分级 → ✅ 插槽空 = 处置单不出件,转人工留痕。
- ❌(v0.3 loop)把"扣罚"也设成自动 = 机器替人裁定处罚、自动划扣经销商的钱 → 重大权限失控,机器越权动了别人账户、绕过申诉期与人裁红线 → ✅ 扣罚必须永久挂人:立案/派稽查/标记冻结可事件自动(不动钱),但任何涉处罚金额的动作 human_gate 全程人裁,permission 禁一切自动划扣,永不进自动化。
- _(后续迭代继续往下加)_

---

## 10. Scripts — 状态机 / 回避 / 撤销一致性 / 执行重试 / 机器写人态拦截(出件前必跑)

```python
from datetime import datetime

HUMAN_ONLY_CONCLUSIONS = {"成立", "不成立", "证据不足"}
HUMAN_ONLY_CASE_STATUS = {"confirmed", "dismissed", "investigating"}   # 沿用 L0-06 分权
REVIEW_VERDICTS = {"维持", "改判", "撤销处置", "推翻定性"}              # v0.2 四态
MACHINE_WRITABLE_DISPOSAL = {"draft", "pending_approval", "appeal_window",
                             "executing", "execution_failed", "executed", "archived"}

def calendar_days(a, b):
    return (datetime.fromisoformat(b) - datetime.fromisoformat(a)).days

# ---- v0.2 回避校验 ----
def recusal_check(assignee, target_dealer, org):
    """org: 组织主数据(经 MCP)。返回 conflict 描述或 None。"""
    if org.jurisdiction_of(assignee) == org.recruiting_region_of(target_dealer) and \
       org.line_of(assignee) in ("稽查", "销售"):
        return f"{assignee} 属发货区({org.jurisdiction_of(assignee)})条线,涉案经销商为该区招商"
    return None

def validate(out, ledger_before, now, policy=None, d002=None, org=None, case_state=None):
    errs = []
    # ===== 稽查任务 =====
    if out.get("task_id"):
        # ---- v0.2 回避 ----
        if org is not None:
            conflict = recusal_check(out["assignee"], out.get("_target_dealer"), org)
            if conflict:
                rc = out.get("recusal") or {}
                if not rc.get("waiver_by"):
                    errs.append(f"recusal_conflict_unwaived:{out['task_id']}")   # 冲突且无豁免
            if out.get("recusal") and out["recusal"].get("reassigned_to") and \
               not any(f.startswith("recusal:") for f in out.get("flags", [])):
                errs.append(f"recusal_unflagged:{out['task_id']}")
        c = out.get("conclusion")
        if c is not None:
            if not (c.get("by") and c.get("report_ref")):
                errs.append(f"conclusion_without_identity:{out['task_id']}")
            if c.get("_submitted_by") == "machine":
                errs.append(f"machine_submitted_conclusion:{out['task_id']}")
            if c["verdict"] not in HUMAN_ONLY_CONCLUSIONS:
                errs.append(f"unknown_verdict:{out['task_id']}")
            if not out.get("whitelist_recheck"):
                errs.append(f"conclusion_without_whitelist_recheck:{out['task_id']}")
            if c["verdict"] == "不成立" and out.get("_dismiss_reason") == "授权漏记" and \
               not any("L2-03" in f for f in out.get("fanout", [])):
                errs.append(f"missed_l2_03_governance_fanout:{out['task_id']}")
        if out.get("extension_count", 0) > 1 and out.get("status") != "escalated":
            errs.append(f"over_extension_without_escalation:{out['task_id']}")
        if out.get("_overdue_auto_concluded"):
            errs.append(f"overdue_auto_action:{out['task_id']}")
    # ===== L0-06 回写拦截 =====
    if out.get("_case_status_write"):
        w = out["_case_status_write"]
        if w["status"] in HUMAN_ONLY_CASE_STATUS and not w.get("signed_by"):
            errs.append(f"machine_wrote_human_status:{w['case_id']}")
        if w.get("evidence_append") and w.get("evidence_append") != w.get("evidence_raw"):
            errs.append(f"evidence_mutated_in_transit:{w['case_id']}")
    # ===== 处置单 =====
    if out.get("disposal_id"):
        ap = out.get("approval", {})
        appeal = out.get("appeal") or {}
        # 复核四态合法性
        if appeal.get("review_verdict") is not None and \
           appeal["review_verdict"] not in REVIEW_VERDICTS:
            errs.append(f"unknown_review_verdict:{out['disposal_id']}")
        # ---- v0.2 撤销二分一致性(案件态 × 处置态) ----
        if case_state is not None:
            if out["status"] == "revoked_verdict":
                cs = case_state.get(out["case_ref"], {})
                if cs.get("status") != "dismissed" or not cs.get("signed_by"):
                    errs.append(f"revoked_verdict_case_not_dismissed:{out['disposal_id']}")
                if not appeal.get("review_ref"):
                    errs.append(f"revoked_verdict_without_review_ref:{out['disposal_id']}")
            if out["status"] == "revoked_disposal":
                cs = case_state.get(out["case_ref"], {})
                if cs.get("status") != "confirmed":
                    errs.append(f"revoked_disposal_case_not_confirmed:{out['disposal_id']}")
                if not out.get("_archive_note_review_ref"):
                    errs.append(f"revoked_disposal_without_note:{out['disposal_id']}")
        # D-002 插槽:接入前不得出件
        if d002 is None or not d002.get("loaded"):
            errs.append(f"disposal_without_d002:{out['disposal_id']}")
        elif out.get("d_level") != d002.lookup(out["_severity"], out["_repeat_count"], out["_scale"]):
            errs.append(f"d_level_not_replayable:{out['disposal_id']}")
        # 金额重放;机器不加码;人批不改数
        if policy is not None and out.get("amount") is not None:
            std = policy.amount(out["_violation_type"], out["_scale"])
            if out["amount"] != std:
                errs.append(f"amount_not_from_policy:{out['disposal_id']}")
        # 人批 + 双签
        if out["status"] in ("appeal_window", "executing", "executed") and not ap.get("approved_by"):
            errs.append(f"disposal_without_human_approval:{out['disposal_id']}")
        if (out.get("_is_heavy_level") or out.get("amount", 0) > DUAL_SIGN_LIMIT) and \
           out["status"] in ("appeal_window", "executing", "executed") and not ap.get("dual_sign_by"):
            errs.append(f"heavy_disposal_without_dual_sign:{out['disposal_id']}")
        # 申诉期纪律
        if out["status"] == "appeal_window" and not out.get("delivered_at"):
            errs.append(f"appeal_clock_without_delivery:{out['disposal_id']}")
        if out["status"] in ("executing", "executed"):
            if out.get("appeal") and appeal.get("review_verdict") is None:
                errs.append(f"executed_during_appeal:{out['disposal_id']}")
            if not out.get("appeal") and out.get("delivered_at") and \
               calendar_days(out["delivered_at"], now) < APPEAL_DAYS:
                errs.append(f"executed_within_appeal_window:{out['disposal_id']}")
        if appeal.get("second_appeal"):
            errs.append(f"second_appeal_not_allowed:{out['disposal_id']}")
        # ---- v0.2 执行失败纪律 ----
        if out.get("execution_attempts", 0) > MAX_EXEC_RETRIES and \
           "manual_execution_required" not in out.get("flags", []):
            errs.append(f"exec_retry_over_limit_unrouted:{out['disposal_id']}")  # 超限必转人工
        if out["status"] == "execution_failed":
            if out.get("_appeal_clock_restarted") or out.get("_disposal_regenerated"):
                errs.append(f"failure_restarted_decision:{out['disposal_id']}")  # 不重单不重钟
        for r in out.get("execution_receipts", []):
            if r["status"] == "ok" and r.get("_retried_after_ok"):
                errs.append(f"ok_action_re_executed:{r['action']}")              # 已成功项不重复执行
        # 驳回终态
        cur = ledger_before.get(out["disposal_id"])
        if cur and cur["status"] == "rejected" and out["status"] != "rejected":
            errs.append(f"rejected_disposal_resubmitted:{out['disposal_id']}")
    return errs
```

---

## 11. 评测起手式(11 条种子)

```json
[
 {"id":"i01",
  "input":{"l0_06_case":{"case_id":"DV-2026-0612-007","status":"suspect","scale":"400箱","flow":"跨大区"}},
  "expect":{"task_created":true,"assignee_per_7_1":"大区稽查","due_in_calendar_days":"<稽查时限>",
            "evidence_checklist_contains":"L2-03 白名单复核","case_evidence_not_copied":true},
  "tags":["接案派稽查带期限;证据只引用不复制;白名单复核必在清单"]},

 {"id":"i02",
  "input":{"investigator_uploads":"新扫码记录 XD-scan-99001 + 库房照片 ph_501"},
  "expect":{"forwarded_to_l0_06":"append 原样","zero_mutation":true,"handler_of_record_notified":true},
  "tags":["追加证据零加工透传 L0-06,改一字证据废"]},

 {"id":"i03",
  "input":{"recheck":"L2-03 白名单查到一张 expired 前有效的调拨单覆盖该批次该流向,立案时漏记",
           "conclusion":{"verdict":"不成立","by":"稽查-华北-Zhao","report_ref":"RPT-077"}},
  "expect":{"l0_06_written":"dismissed(带签名)","fanout_contains":"L2-03 治理线:补记"},
  "tags":["白名单漏记翻案:dismissed + 扇出 L2-03 补记,错在台账不在经销商"]},

 {"id":"i04",
  "input":{"conclusion":{"verdict":"成立","by":"稽查-华北-Zhao","report_ref":"RPT-078"},
           "whitelist_recheck":"已查,无授权"},
  "expect":{"l0_06_written":"confirmed","signature_in_case_history":true,"next":"进处置 Step D"},
  "tags":["结论成立→回写 confirmed 带签名与报告引用;机器只承载"]},

 {"id":"i05",
  "input":{"disposal":{"d_level":"D-6(示例)","amount":12000,"_is_heavy_level":true,
                       "approval":{"approved_by":"渠道总监-Liu","dual_sign_by":null}}},
  "expect":{"blocked":"heavy_disposal_without_dual_sign","status_stays":"pending_approval",
            "also":"人批改数即 amount_not_from_policy"},
  "tags":["重级处置双签缺一不可;人批不改数"]},

 {"id":"i06",
  "input":{"disposal":{"status":"appeal_window","delivered_at":"2026-06-22"},"event":"经销商 6/25 申诉"},
  "expect":{"status":"appeal_frozen","execution_blocked":true,"review_escalated":"上一级",
            "review_verdict_is_final":true,"no_second_appeal":true},
  "tags":["申诉冻结执行,升级复核,复核终局(含维持)"]},

 {"id":"i07",
  "input":{"disposal":{"status":"appeal_window","delivered_at":"2026-06-22","appeal":null},
           "now":"2026-06-24","params":{"APPEAL_DAYS":7}},
  "expect":{"execution_blocked":true,"error_if_executed":"executed_within_appeal_window",
            "counter":"6/29 期满无申诉→executing→executed→归档回流 L0-06+L5-01 观察"},
  "tags":["申诉期满才执行;送达回执起钟"]},

 {"id":"i08",
  "input":{"event":"机器流程尝试把 case DV-007 置为 confirmed(无 signed_by)"},
  "expect":{"validation_error":"machine_wrote_human_status","write_rejected":true},
  "tags":["机器写人态必须报错——定性权零新增,承袭 L0-06 分权"]},

 {"id":"i09",
  "input":{"case_a":{"review_verdict":"推翻定性","review_by":"渠道VP","review_ref":"RV-031","原因":"授权漏记"},
           "case_b":{"review_verdict":"撤销处置","review_ref":"RV-032","原因":"初犯从轻"}},
  "expect":{"case_a":{"disposal_status":"revoked_verdict",
                      "l0_06_case":"dismissed(复核人实名签名+RV-031,走 Step C 同款通道)",
                      "fanout_contains":"L2-03 治理线:补记",
                      "consistency_error_if_case_still_confirmed":"revoked_verdict_case_not_dismissed"},
            "case_b":{"disposal_status":"revoked_disposal",
                      "l0_06_case":"保持 confirmed","archive_note_contains":"成立但免/减处置,复核依据 RV-032",
                      "consistency_error_if_case_dismissed":"revoked_disposal_case_not_confirmed"}},
  "tags":["v0.2-①:撤销二分——推翻定性⇔案件 dismissed;撤销处置⇔案件保持 confirmed;两态对不上必报错"]},

 {"id":"i10",
  "input":{"case":{"origin_region":"华东","found_region":"华北","target_dealer":"DL-SH-009(华东招商)"},
           "candidate_assignee":"稽查-华东-Chen(华东稽查条线)"},
  "expect":{"auto_reassigned_to":"发现区(华北)稽查或大区/总部",
            "flags_contains":"recusal:稽查-华东-Chen→",
            "original_supervisor_informed":true,
            "force_assign_without_waiver":"recusal_conflict_unwaived 报错",
            "force_assign_with_waiver":"recusal_waiver{豁免人+留痕}通过"},
  "tags":["v0.2-②:回避——发货区的人不查自己区的商;冲突自动改派留痕;强指须上一级书面豁免"]},

 {"id":"i11",
  "input":{"case_a":"扣款 MCP 第1/2次失败,第3次成功(上限3)",
           "case_b":"三次全失败","case_c":"扣款 ok + 断供 failed(部分成功)"},
  "expect":{"case_a":{"status":"executed","execution_attempts":3,"appeal_clock_untouched":true},
            "case_b":{"status":"execution_failed","flags_contains":"manual_execution_required",
                      "approver_notified":true,"disposal_not_regenerated":true,"appeal_clock_untouched":true},
            "case_c":{"receipts":"扣返利 ok / 断供 failed","retry_only":"断供","ok_action_not_re_executed":true}},
  "tags":["v0.2-③:执行失败——重试有上限转人工;不重单不重钟;部分成功只补未完成项"]}
]
```

**打分维度(每条 0/1):**
1. 接案与指派(i01)+ **回避规则**(i10:自动改派留痕、无豁免必拦)
2. 证据零加工(i02)
3. 漏记翻案双动作(i03,**复核推翻定性同款对齐**)
4. 定性承载(i04 / i08 机器写人态必拦)
5. 处置纪律(i05:D-002 可重放、金额重放、双签、人批不改数)
6. 申诉纪律(i06/i07:送达起钟、冻结、终局、期满才执行)
7. **撤销二分一致性**(i09:两个方向的对照断言都过)
8. **执行失败纪律**(i11:上限转人工、不重单不重钟、部分成功不重复执行)
9. 续期一次/超期不代办/驳回终态(§10 断言)+ 全件过校验

> 最危险的三类错:**错罚**(i03/i09——白名单漏查或撤销后帽子还在)、**申诉权被吃**(i06/i07/i11——批后即执行、时差吃窗、失败重钟二次送达)、**利益冲突的稽查**(i10——查着查着就不成立了)。处罚动作的信用比补货金额贵一个量级,宁慢勿错。

---

## 12. 运行层 · Loop Spec(BEA 优先级更高)

> **本块是运行层补充,优先级低于上面全部 BEA 设计**(Loop 规则 L1:先 BEA 后 Loop)。本节点 BEA 已造对(链式 + 双台账状态机 + 回避闸门 + 撤销二分 + 重 HITL),故可进 Loop 化。
> **本节点是系统第一个「重 HITL 出手类」节点的 Loop 化范本**——区别于 L0-08(普通出手类:下单可阈值内自动)。
> **⚠️ 出手分两段(本范本的核心,区别于 L0-08):**
> - **第一段「立案/派稽查/留证/标记冻结」**——不动钱,可由 L0-06 窜货信号**事件触发**;
> - **第二段「扣罚/处置」**——动钱,**必须人裁定,绝不自动划扣(JBP 红线④)**,永不进自动化。
> **⚠️ human_gate 比 L0-08 更收紧:任何涉处罚金额的动作全程挂人。** L0-08 的钱是「补货下单」(阈值内可自动),L1-05 的钱是「罚别人的钱」(机器碰都不碰,全程人裁)——同为涉钱,处罚的红线比采购紧一个量级。

### 12.1 五范式 → 护栏映射(衔接 §5)

L1-05 属**涉钱类(扣罚 = 划别人的钱)+ 重 HITL**,两重叠加 → 护栏收到全系统最紧:
- **human_gate 收到最紧**:不是「超阈值才停」,而是**任何涉处罚金额的处置全程人裁**;立案后处置方案必须人批,机器只到「立案/留证/出处置建议」为止,**绝不替人裁定处罚**。
- **permission_boundary 禁一切自动划扣**:`can` 只含不动钱的可逆动作(立案/派稽查/标记冻结);`cannot` 明列「自动扣罚/划扣任何金额、自动结案处罚」——出手的手永远够不到别人的账户。
- 对照 L0-08:L0-08 的 human_gate 是「金额超阈值挂起」(量值定后可放宽到阈值内自动);**L1-05 的 human_gate 是「处罚全程人裁」(永不放宽,处罚不存在「阈值内自动」)**。

### 12.2 loop_spec 标准块(照《Loop 运行层规则》§3,字段对齐《字段字典 v1.0》)

```yaml
loop_spec:
  enable: true
  why_loop: "窜货持续重复;done=立案/驳回/结案三类;证据链/白名单/L0-06来源能说不对 → 三条件满足"

  automation:
    trigger: "L0-06 窜货信号事件触发(suspected_diversion 事件);非 cron"
    inbox: "稽查待处理收件箱(已立案/已驳回/待人裁 三类)"

  worktree:
    needed: true            # 多案件并行,各案副本隔离

  skill:
    ref: "L1-05_diversion_disposal_v0_2.md"

  connector:
    actions: ["立案", "派稽查任务", "标记冻结"]   # 只开立案/派工/标记(均不动钱);绝不开自动扣罚/划扣

  subagents:
    maker: "识别窜货模式 + 建议处置方向(读 L0-06 来源/白名单/价格异常)"
    tracker: "独立审查:证据链是否够立案门槛 / 是否白名单内合法流通 / L0-06 来源是否可溯 → 证据不足驳回(缺证不立案);合并前跑 dry run"

  memory:
    writes: "本案每条:立案/驳回/为什么/证据指针/待查项"
    store: "[持久化存储]"

  # —— 4 道护栏(涉钱+重HITL,收到最紧)——
  acceptance_criteria: "一批疑似案走完 识别→tracker审查→立案或驳回,处置建议待人裁,每条留痕"
  permission_boundary:
    can: ["读L0-06窜货/价格信号", "立案", "派稽查任务", "标记冻结(可逆)", "生成处置建议"]
    cannot: ["自动扣罚/划扣任何金额", "自动结案处罚", "改经销商主数据", "撤销人已裁定的案"]
  human_gate: "任何涉处罚金额的处置 → 全程人裁定(重HITL,绝不自动划扣);立案后处置方案必须人批"
  observability: "每案留痕:source_ref / 谁判(maker/tracker/人) / 证据链 / 裁定理由 / 结果,可审计"
```

### 12.3 字段对齐说明(《字段字典 v1.0》)

- `suspected_diversion`(L0-06 窜货信号事件)、`source_ref`(全系统留痕)均为字段字典标准名,与上游 L0-06、全系统审计一致;
- `tracker` 的「窜货来源 / 白名单」**读 L0-06,不自判**(L0-06 是窜货/价格信号的唯一来源,tracker 只消费不重算);白名单复核读 L2-03(同 §1 边界);maker 出手、tracker 审、合并前 dry run(双子博弈,防过拟合);
- `connector.actions` 三项「立案/派稽查/标记冻结」**全部不动钱、且标记冻结可逆**——与 `permission_boundary.cannot`(自动扣罚/划扣/结案处罚)严格对齐:连接器物理上没有「划扣」这个动作。

### 12.4 切自动检查单(护栏先于自动化;处罚动作永久挂人)

**可事件自动化的只有第一段(立案/派稽查/留证/标记冻结)**,且切自动前必须满足:
- ☐ tracker 审查链跑通(证据门槛 / 白名单 L2-03 / L0-06 来源溯源 三项验证);
- ☐ 回避闸门(§4 Step A)在自动指派路径上生效(自动改派不绕过回避);
- ☐ 缺证不立案逻辑验证(tracker 能驳回证据不足的案)。
- 任一未满足 → 立案也保持手动/半自动。

**第二段(扣罚/处置)永久挂人,不进自动化检查单——它没有「切自动」这一项**:
- 任何涉处罚金额的动作,无论证据多硬、案情多明,**机器只到「出处置建议」为止,处罚由人裁定**;
- 这是 §8 HITL「机器绝不定性、绝不自动处罚、申诉期内绝不执行」在运行层的延续,也是 §9 那条 loop 踩坑要防的:**把「扣罚」设成自动 = 机器替人裁定处罚、自动划扣经销商的钱 = 重大权限失控。扣罚必须永久挂人。**

---

## 待填变量(套用时替换)
- `owner`;§7.1 指派表(规模线/累犯线,挂组织主数据)
- **DECISION-002 原文** — D-1~D-7 映射 + 各级动作菜单与审批要求(经 MCP;接入前处置单不出件)
- 处罚政策表 — 经 MCP(违规类型 × 规模 → 金额;本文件不内嵌)
- `<稽查时限>` `<升级时限>` `<申诉期>` `<重级线>` `<双签阈值>` `<执行重试上限>` — 与渠道/法务共同定
- 管辖关系口径 — 组织主数据(回避判定的"发货区条线"边界,与 HR/渠道共同定)
- 送达回执通道 — 签收方式(电子签收/物流回执)
- 稽查任务台账 + 处置单台账落库 — 与既有六本台账同基建分表(第七、八本)
