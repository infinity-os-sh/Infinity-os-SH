---
name: replenishment-execution
description: 接收 L0-07 缺断货预警(含 carry 透传),结合 L0-01 库存事实、L0-04 店型 SKU 组合与安全库存主数据,确定性拟定补货订单(过渡公式占位,量值待 DECISION-001 配套需求模型接入),按 DECISION-001 决策树 + 三维阈值矩阵路由到 A/B/C/D/E 五个审批模型,经 MCP 调订货系统执行并跟踪订单到货闭环。凡涉及"补货、下单、订货、补货单、订单审批、改量批准、到货跟踪、补货执行"的输入都用本 Skill。它是全链路唯一下单方(L0-08)、第一个执行不可逆动作的节点——HITL 卡在下单前;L0-01/L0-07 一路透传的 hitl_required 与疑似窜货在这里落地停机。
version: v0.3
owner: <填:负责人/团队>
type: Workflow / Skill(执行节点 · 有状态订单台账 · 带 HITL · L0-08 · 执行壳 · 量值待 DECISION-001 配套模型接入)
status: v0.2 执行壳,审批路由已对齐 DECISION-001 v1.0;量值模型与矩阵数值待接入
upstream: L0-07 预警(P0/P1 + carry)/ L0-01 库存 JSON(qty/conf)/ L0-04 门店档案(sku_mix·店型)/ 安全库存与箱规主数据(经 MCP)/ DECISION-001 三维阈值矩阵与权限矩阵(经 MCP,一线不可见)/ 订单台账
downstream: 订货系统(经 MCP,执行)/ 审批人(HITL,按 A–E 模型)/ L0-07(订单状态回执)/ 城市经理(知会)/ 订单台账(回写)
backlog: L0-08
---

# 补货执行 Skill v0.3 · 执行节点(L0-08)

> 本 Skill 依据《INFINITY OS · Agent 设计标准 v1.0》编写。
> 它是一个 **Workflow**(写死轨道)+ **订单台账**(有状态)。
> **全链路第一个执行不可逆动作的节点**:单下出去就发货。HITL 卡在**下单前**——前面八个节点透传的 hitl_required / 疑似窜货,全部在这里落地。

> **⚠️ 治理覆盖(对账 DECISION-001 v1.0,锁定 2026-05-15):本文件是「执行壳」**——本节点**永久保留**的只有:取整/MOQ、拟单流程、审批路由机制、幂等、执行与到货闭环。**「补多少」的量值模型与阈值矩阵数值以 DECISION-001 v1.0 为准**(见 §4 Step B 治理声明与 §9d)。

> **v0.2 变更摘要:** ①Step B 显式声明为 **DECISION-001 量值插槽**(现行公式 = 过渡占位);§7 审批分流从「金额二分」重构为 **DECISION-001 决策树 → 三维阈值矩阵 → A/B/C/D/E 五模型路由**(矩阵数值经 MCP,一线不可见,本文件不内嵌);②新增 **modified_and_approved**(审批人授权幅度内改量并批,对接 INF-XD ±10% UI;改量重过校验,超幅自动路由上级);③**幂等键释放时点钉死**:到货核收或终态才释放,**confirmed 不释放**(修复 v0.1 自相矛盾)。原 auto/必停语义不变,仅获得模型标注。
>
> **v0.3 变更摘要(只加运行层,BEA 设计一字不动):** 末尾追加 `loop_spec` 运行层块——本节点是系统**第一个出手类节点的 Loop 化范本**。过 Loop 三条件(每日每店重复/done三类结果/2A线+压货+窜货+价异常能说不对)。**护栏先于自动化(Loop 规则 L4 铁律):acceptance_criteria + permission_boundary + human_gate 已填全,但量值待 DECISION-001,trigger 暂保持手动/半自动,绝不开自动下单**;D-001 闸门开、量值定后再切 cron。BEA 优先级高于 Loop(L1:先 BEA 后 Loop)。

---

## 1. 角色与目标 + 执行边界【先读这个】

你是全链路**唯一下单方**。上游所有节点只产事实、预警、标记;**真正花钱的动作只发生在你这里,且必须过 §7 的审批路由**。

**与上游的分工(谁的活归谁):**

| 节点 | 它做什么 | 你不重做什么 |
|---|---|---|
| L0-01 | 库存事实(qty/conf/status)+ hitl 标记 | 不重判库存、不质疑 qty |
| L0-07 | 判级、防重复、通知路由,carry 透传到你 | 不重判预警等级 |
| L0-04 | 店型 SKU 组合、店级、责任人 | 不自定该店该有什么货 |
| **DECISION-001(治理)** | 量值模型、三维阈值矩阵、权限双签结构 | **不自造阈值、不内嵌矩阵数值、不向一线展示阈值表** |
| **L0-08(本节点)** | **拟单 → 模型路由 → 审批/改量 → 下单 → 到货闭环** | — |

**机器与人的边界:**
- 机器可以:拟单(全脚本)、按决策树路由模型、模型 E 低档自动下单、提交审批、跟踪订单、重试与转人工。
- 机器不可以:**绕过 §7 决策树自行定模型、对 carry 带疑似窜货的店下任何单、修改人已驳回的单后重提、重复下在途单、让改量绕过脚本校验或超授权幅度生效**。
- 拟单数量算不出(数据缺/conf 不足)→ 停,转人工拟单,不猜数下单。

---

## 2. 输入(Input)

| 来源 | 字段 | 用途 |
|---|---|---|
| L0-07 预警 | store/sku/level/type/carry(hitl_required·flags)/status | **主触发**:P0/P1 且 notify 含本节点的预警 |
| L0-01 库存 | items[].qty / conf | 现有库存基数;**conf=low 走保守拟单(§4)** |
| L0-04 档案 | sku_mix / store_grade / advisor·supervisor | 该店该有什么货、知会谁 |
| 安全库存/目标库存主数据 | 经 MCP:SKU × 店级 → 目标量(过渡;待 D-001 需求模型替换) | 拟单目标 |
| 箱规/起订量/单价主数据 | 经 MCP:SKU → 箱规·MOQ·供货价 | 取整与金额计算 |
| **DECISION-001 主数据(v0.2)** | 经 MCP:①三维阈值矩阵(客户级 S+~D × SKU 战略等级 × 区域,每格 4 段阈值);②权限矩阵(角色 → 授权改量幅度,双签关系);③经手人档案(工龄/是否新经销商首单);④节假日日历 | **决策树路由与改量授权的唯一数值来源;一线不可见,本 Skill 不内嵌任何数值** |
| 订单台账 | (store,sku) 维度在途/历史订单 | **幂等防重复下单(命门)** |
| 当前时间 `now` | — | 日历天口径(同 L0-07/L0-06) |

---

## 3. 参数定义(Parameters)

| 字段 | 类型 | 允许值 / 说明 |
|---|---|---|
| `order_id` | string | 订单编号 |
| `store` / `sku` | string | **台账幂等键 = (store, sku)**;**保持期 = 拟单创建 → 到货核收或终态(v0.2,confirmed 不释放)** |
| `trigger_alert` | string | 来源预警引用(L0-07 alert) |
| `current_qty` / `qty_conf` | number / enum | L0-01 现有量与置信度 |
| `target_qty` | number | 目标库存(过渡主数据;待 D-001 需求模型) |
| `order_qty` | number | **= ceil_to_case(target − current),脚本算,不许 LLM 估**(过渡公式,见 Step B 治理声明) |
| `case_spec` / `moq` | number | 箱规 / 起订量 |
| `amount` | number | = order_qty × 供货价 |
| **`adj_pct`(v0.2)** | number | 本单相对 D-001 需求基准的调整幅度(基准经 MCP;决策树主输入) |
| **`approval_model`(v0.2)** | enum | `A`(公司先批)/ `B`(老板说了算)/ `C`(双轨双签)/ `D`(老板承诺+24h跟踪)/ `E`(按幅度自动分层)。**由 §7 决策树 + 矩阵得出,可重放** |
| `approval_route` | enum | `auto`(模型 E 低档自动)/ `hitl`(其余,停机等人)。语义同 v0.1,由 approval_model 推导 |
| `hitl_reason[]` | string[] | `carry:疑似窜货` / `carry:hitl_required` / `model:{A-D 或 E 高档}` / `routed_up:超授权幅度` |
| `status` | enum | `draft` → `pending_approval` / `auto_approved` → **`approved` / `modified_and_approved`(v0.2)** / `rejected` → `submitted` → `confirmed` → **`received`(到货核收,v0.2 幂等释放点)** / `failed` / `cancelled`。机器不可写 approved 系;rejected 终态 |
| **`approval` 区块(v0.2)** | object | `{approved_by, approved_at, original_qty, approved_qty, modified_by, modify_reason, dual_sign_by(模型C), tracking_task(模型D:24h跟踪任务引用)}` |
| `submit_attempts` | number | 下单重试计数(上限 `<重试次数>`) |
| `since` / `duration_days` | string / number | 日历天(同 L0-07 C0) |
| `flags` | string[] | `dedup_suppressed:*` / `conservative_qty:*` / `manual_draft_required:*` / `submit_failed_to_human:*` / **`routed_up:*` / `modify_blocked:*`(v0.2)** |
| `fanout` | string[] | 按 §7.2 |

---

## 4. 处理流程(Steps · 触发 → 拟单 → 模型路由 → 审批/改量 → 执行 → 到货闭环)

### Step A — 触发与幂等闸门【命门一:绝不重复下单】
1. 接收 L0-07 预警(P0/P1,notify 含「补货流程:L0-08」)。
2. **查订单台账**:同 (store, sku) 已有**未释放**单(draft / pending_approval / approved 系 / submitted / **confirmed**,v0.2)→ **不再拟单**,flag `dedup_suppressed:{store}-{sku}`,只把新预警引用追加到原单备注。L0-07 每天可能重发同一预警,跟着重拟 = 重复发货事故;**confirmed 后货还在路上,同样不许重拟**(v0.2)。
3. 该 SKU 不在该店 sku_mix(L0-04)→ 停,flag `manual_draft_required:不在店型配置`,转人工。

### Step B — 拟单(全脚本,LLM 零参与)

> **📐 治理声明(DECISION-001 插槽)**:本步现行公式 `target − current` 为**过渡占位**,仅用于壳体联调与评测;**量值来源待 DECISION-001 配套的需求量模型(心跳水位 / 动态 W)经 MCP 接入后整体替换**。本节点**永久保留**的只有:箱规取整、MOQ 约束、拟单流程、§7 路由、执行与到货闭环——换量值模型不动这些。**勿将下面的简化公式当成最终补货逻辑。**

1. `order_qty = ceil_to_case(target_qty − current_qty, case_spec)`,再套 `max(order_qty, moq)`;结果 ≤ 0 → 不拟单(库存已够,可能是预警滞后),通知 L0-07 复核。
2. **conf=low 的现有量 → 保守拟单**:按 `current_qty × <保守系数>` 算,flag `conservative_qty`;且路由时模型严格度升一级(§7,同"新人"规则)。
3. `amount = order_qty × 供货价`;`adj_pct` = 相对 D-001 需求基准的调整幅度(基准经 MCP;基准缺 → 按 `<过渡基准>` 并标记)。
4. 数据缺(目标库存/箱规查不到)→ 停,`manual_draft_required:{缺什么}`,**不猜数下单**。

### Step C — 审批模型路由(照 §7.1 决策树,全脚本可重放)【命门二:HITL 落地处】
1. **carry 优先**:含 `疑似窜货` 或 `hitl_required:true` → 无论模型必停 `pending_approval`(往疑似窜货的店继续发货 = 给漏洞续水)。
2. 否则走 **DECISION-001 决策树**(§7.1):输入(SKU 战略等级, 客户级, 区域, adj_pct, 经手人工龄, 是否新经销商首单, 是否节假日)→ 查三维阈值矩阵(经 MCP)→ 得 `approval_model ∈ A/B/C/D/E`。
3. **模型 E 低档**(幅度落在自动段)→ `auto_approved`(approved_by="auto"),直接 Step E 下单。ATM 模型:取小钱直接给。其余 → `pending_approval`,按模型通知对应审批人(模型 C 需双签人齐)。
4. pending 超 `<审批时限>` 天 → 提醒审批人(只提醒,不代批,**沉默不是同意**)。

### Step D — 审批动作处理(v0.2:三种动作)+ 下单执行
**审批人三种动作:**
- **approve** → `approved`,进下单。
- **modified_and_approve(v0.2,对接 INF-XD ✎ ±10% UI)**:审批人改量并批准。处理顺序写死:
  1. 改后量**重过 Step B 同套脚本校验**:箱规整除、≥ MOQ、≤ `<单笔上限>`;违反 → `modify_blocked:{原因}`,改量不生效,退回审批人重改(**不**自动取整替人改)。
  2. 改幅校验:|approved_qty − original_qty| / original_qty ≤ 该角色授权幅度(权限矩阵经 MCP:一线 ±10%、大区 GM ±20% 双签——数值以 D-001 为准)→ 生效,`status: modified_and_approved`,approval 区块记 `original_qty / approved_qty / modified_by / modify_reason`;
  3. **超出授权幅度 → 不生效**,自动路由**上一级审批**(按 D-001 权限矩阵),flag `routed_up:{角色}→{上级}`,原审批人动作留痕(改量意见随单上行,上级看得见但不被绑定);
  4. **改量不绕 carry**:carry 单改量后仍是必停单,且模型 C 双签缺一不可。
- **reject** → `rejected`,**终态**,机器不得修改后重提(确需重拟走新预警新单,引用被驳单号)。
- 模型 D 批准时**自动生成 24h 跟踪任务**(approval.tracking_task),到点未跟踪提醒承诺人——"老板承诺"不能批完就忘。

**下单执行(经 MCP 订货系统):**
1. 成功 → `submitted`,记订货系统单号;回执确认 → `confirmed`,记预计到货。
2. 失败:重试 ≤ `<重试次数>`(指数退避);仍失败 → `failed` + `submit_failed_to_human`,转人工,**不无限重试**。

### Step E — 到货闭环与幂等释放(v0.2 钉死)
- **幂等键释放时点(铁律)**:键从拟单创建起保持,**直到「到货核收回执」(status→received)或订单终态(rejected / failed / cancelled)才释放;confirmed 不释放**。confirmed 只是订货系统认了单,货还没到——此时放键,确认后到货前来一条新预警就是双重下单。释放后才允许同 (store,sku) 新拟单。
- 状态变更全程回执 **L0-07**(已拟/已批/已下/已确认/**已到货**);到货回执同时扇出 L0-07(既有逻辑保留);**预警的解除仍只认 L0-01 的 normal**(到货 ≠ 上架)。
- 知会责任美顾/督导(到货后及时上架理货);台账回写。

---

## 5. 规则与强度(RFC2119)

| 强度 | 规则 |
|---|---|
| **MUST NOT** | **机器绝不绕过 §7 决策树自行定模型或下单;carry 带疑似窜货/hitl_required 的绝不自动下单(无论模型);人驳回的单绝不修改后重提;绝不超时视为默批;绝不在本文件内嵌阈值矩阵数值或向一线展示阈值表。** |
| **MUST** | 审批模型必须由 §7.1 决策树 + 三维阈值矩阵(经 MCP)得出,**可重放**;矩阵数值占位待 3-6 月真实订单数据校准(D-001 §未解决事项)。**(v0.2)** |
| **MUST** | 审批人改量必须重过脚本校验(箱规/MOQ/上限),违反不生效;改幅超该角色授权(权限矩阵)必须不生效并自动路由上一级,原审批人留痕;改量不得绕过 carry 必停与模型 C 双签。**(v0.2)** |
| **MUST** | 幂等键必须保持到「到货核收」或终态(rejected/failed/cancelled)才释放;**confirmed 不释放**;释放前同 (store,sku) 新预警一律 suppress 追加引用。**(v0.2)** |
| **MUST** | 同 (store, sku) 有未释放单必须抑制新拟单(幂等),新预警只追加引用。 |
| **MUST** | `order_qty` 必须由 §10 脚本计算,可重放;**严禁 LLM 估数**;算不出转人工。量值公式为过渡占位,接 D-001 需求模型后整体替换(Step B 治理声明)。 |
| **MUST** | conf=low 必须保守拟单并标 `conservative_qty`,且路由严格度升一级。 |
| **MUST** | 模型 C 必须双签齐才生效;模型 D 批准必须自动生成 24h 跟踪任务;新经销商首单必须强制走模型 C(无关幅度)。**(v0.2)** |
| **MUST** | auto 单(模型 E 低档)必须留 approved_by="auto" 审计痕迹;下单失败重试 ≤ `<重试次数>` 后转人工;不在 sku_mix 不得自动下单。 |
| **SHOULD** | pending 超 `<审批时限>` 提醒;订单全程回执 L0-07 与责任人;order_qty ≤ 0 通知 L0-07 复核。 |
| **MAY** | 同店多 SKU 合并下单(同模型内)。 |

---

## 6. 输出(Output · Artifact 契约)

```json
{
  "order_id": "RO-2026-0612-031",
  "store": "大润发徐汇店",
  "sku": "6MX-JDX",
  "trigger_alert": "L0-07:大润发徐汇店|6MX-JDX|P0断货",
  "current_qty": 0, "qty_conf": "high",
  "target_qty": 24, "case_spec": 12, "moq": 12,
  "order_qty": 24, "amount": 549.6, "adj_pct": 0.08,
  "approval_model": "C",
  "approval_route": "hitl",
  "hitl_reason": ["model:C(战略SKU×S+客户,矩阵指定)"],
  "status": "modified_and_approved",
  "approval": {
    "approved_by": "城市经理-Wang", "approved_at": "2026-06-12T16:10:00+08:00",
    "original_qty": 24, "approved_qty": 22, "modified_by": "城市经理-Wang",
    "modify_reason": "门店库位紧张,下调一档",
    "dual_sign_by": "大区GM-Li", "tracking_task": null
  },
  "submit_attempts": 0,
  "since": "2026-06-12T15:00:00+08:00", "duration_days": 0,
  "flags": [],
  "fanout": ["订货系统:提交:RO-2026-0612-031(22)", "回执:L0-07:补货单已批(改量24→22)", "知会:美顾:MG-0420"]
}
```

> auto 示例:`approval_model:"E", approval_route:"auto", approved_by:"auto"`(幅度落自动段、carry 干净)。
> 必停示例:`hitl_reason:["carry:疑似窜货"]` ——无论模型必停。
> 路由上级示例:`flags:["routed_up:督导→城市经理"], status 仍 pending_approval`,approval 区块留原审批人改量意见。
> 到货示例:`status:"received"` ——**此刻幂等键才释放**;同时扇出 L0-07 到货回执。

---

## 7. 审批路由 + 扇出(DECISION-001 对齐,v0.2 重构)

### 7.1 审批模型路由(决策树写死;矩阵数值经 MCP,一线不可见,本表不嵌值)

**第 0 道(无关模型):**

| 条件 | 处理 |
|---|---|
| carry 含 `疑似窜货` / `hitl_required:true` | **必停 pending_approval**(优先级最高) |
| 数据缺 / 不在 sku_mix / order_qty 算不出 | 转人工拟单 |

**决策树(D-001 v1.0 原文对齐):**

| 判定顺序 | 条件 | 路由 |
|---|---|---|
| 1. 战略品类优先判 | SKU 战略等级 = 战略 | **查三维矩阵该格指定模型**(客户级 × 战略等级 × 区域,每格 4 段阈值,经 MCP) |
| 2. 强制规则 | 新经销商首单 | **强制模型 C(双轨双签)**,无关幅度 |
| 3. 一般品类按调整幅度 | adj_pct ≤ `<±5%段>` | **模型 B**(老板说了算) |
| | `<5-15%段>` | **模型 D**(老板承诺 + 24h 跟踪) |
| | `<15-30%段>` | **模型 E**(按幅度自动分层:低档 auto / 高档人批) |
| | `<30-50%段>` | <矩阵定,占位——D-001 §未解决事项> |
| | > `<50%段>` | **模型 A**(公司先批) |
| 4. 升级修饰(可叠加) | 经手人工龄 < 6 月 / qty_conf=low | 模型严格度**升一级**(阶梯 B→D→E→C→A,占位,以 D-001 权限矩阵为准) |
| 5. 放宽修饰 | 节假日 | 各档幅度界限**放宽 20%**(界限 ×1.2) |

> **全部阈值段留 <占位>,待 3-6 月真实订单数据校准(DECISION-001 §未解决事项)。** 权限双签结构:总部定矩阵结构与战略 SKU 数值;大区 GM ±20% 微调需双签;**一线不可见阈值表**(本 Skill 只回"走哪个模型",不回"线在哪")。

**五模型行为(本节点的执行语义):**

| 模型 | 含义 | 本节点行为 |
|---|---|---|
| A | 公司先批 | pending,路由总部审批链 |
| B | 老板说了算 | pending,单人批即生效 |
| C | 双轨双签 | pending,**双签齐才生效**(approval.dual_sign_by 必填) |
| D | 老板承诺 + 24h 跟踪 | pending,批准即自动生成 24h 跟踪任务 |
| E | 按幅度自动分层 | **低档 auto(approved_by="auto")/ 高档 pending** |

### 7.2 扇出规则

| 条件 | 触发下游 | 性质 |
|---|---|---|
| 模型 A–D / E 高档 / carry | 审批人(按模型与 D-001 权限矩阵;沿 L0-07 路由知会) | **HITL:停机等人** |
| 改量超授权幅度 | **上一级审批**(routed_up,原审批人留痕) | HITL 升级(v0.2) |
| 模型 D 批准 | 24h 跟踪任务(承诺人) | 跟踪闭环(v0.2) |
| E 低档 auto / 人批后 | 订货系统(经 MCP) | **执行(不可逆)** |
| 状态变更(含**到货 received**) | L0-07 回执 + 责任美顾知会 | 闭环 |
| order_qty ≤ 0 | L0-07:请复核预警 | 对账 |
| failed 达重试上限 | 人工下单通道 | 兜底 |
| — | **绝不**替 L0-07 解除预警(解除只认 L0-01 normal) | 边界 |

---

## 8. HITL 卡点 —— 本节点【有】(执行前,全链路的落地点)

按《Agent 设计标准 §6》,HITL 卡在**高风险不可逆动作执行前**——本节点的不可逆动作就是**下单**。

| 卡点 | 机器做到哪 | 停在哪 | 谁解锁 |
|---|---|---|---|
| 模型 A–D / E 高档 | 拟单 → 决策树路由 → pending → 通知 | **提交订货系统之前** | 对应模型审批人(C 双签齐) |
| carry 疑似窜货/hitl_required | 拟单 → 必停(无关模型) | 同上;驳回即终态 | 同上(必要时先等 L0-06 稽查结论) |
| 改量超授权幅度 | 改量不生效 → 自动路由上级 | 上级批前 | 上一级审批人(v0.2) |
| 模型 E 低档 | **自动下单,不停** | 不停(ATM 取小钱) | — |

> 这正是 L0-01 §8 那句话的兑现:"hitl_required: true 时,下游补货 Skill 必须停机等人点 OK 才能下单"——标记在 L0-01 打、经 L0-07 carry 透传、在本节点落地。HITL 不滥设:E 低档自动放行,人只在钱要出去且风险够大的那一刻出现。**改量路径(v0.2)给了人第三种动作——不必在"全批"和"全驳"之间二选一,但改量本身也在校验和授权幅度的轨道里。**

---

## 9. References

### 9a. 本节点保留参数(回测/财务共同定)

| 参数 | 建议初值 | 说明 |
|---|---|---|
| `<保守系数>` | 0.5 | conf=low 时 current_qty 折算 |
| `<重试次数>` | 3 | 下单失败重试上限 |
| `<审批时限>` | 1 天 | pending 提醒线(日历天) |
| `<单笔上限>` | <填> | 改量校验的量上限 |
| `<过渡基准>` | <填> | D-001 需求基准缺时的 adj_pct 兜底口径 |

> v0.1 的 `<自动下单阈值>` / `<低置信阈值>` **已废弃**——金额二分被 §7.1 决策树取代;conf=low 改为"严格度升一级"修饰。

### 9b. 术语表

| 术语 | 含义 | 处理 |
|---|---|---|
| 幂等键 | (store, sku) 未释放期内唯一 | **到货核收或终态才释放;confirmed 不释放(v0.2)** |
| ATM 模型 | 小事自动、大事人批 | 模型 E 低档 = 取小钱 |
| carry 落地 | L0-01→L0-07→本节点的 hitl 透传终点 | 必停,无关模型 |
| 改量批准 | 审批人授权幅度内改量并批(v0.2) | 重过校验;超幅路由上级;不绕 carry/双签 |
| 决策树路由 | D-001 五模型的选择逻辑 | 全脚本可重放;矩阵数值经 MCP 不内嵌 |
| 沉默不是同意 | pending 超时只提醒不默批 | 防 HITL 被时间绕过 |
| 保守拟单 | conf=low 按悲观库存算量 | 防低置信上报导致超量下单 |

### 9c. 踩坑记录(每次撞墙补一条)

- ❌ L0-07 每天重发预警,跟着每天拟一张单 → 同店同品三张在途单,重复发货 → ✅ 幂等键:未释放单存在只追加引用。
- ❌ 疑似窜货的店因为单子金额小被自动放行 → 给漏洞续水 → ✅ carry 优先级高于模型,必停。
- ❌ 人驳回后机器把数量改小重新提交 → 绕过否决 → ✅ rejected 终态,重拟须新预警新单。
- ❌ 审批人三天没看,系统"超时默认通过" → HITL 形同虚设 → ✅ 只提醒不默批,沉默不是同意。
- ❌ conf=low 的"大概剩8瓶"按 8 算,实际剩 20,下单后爆仓 → ✅ 保守系数折算 + 路由升一级。
- ❌ 下单接口超时无限重试 → 订货系统成了三张重复单 → ✅ 重试上限 + 转人工。
- ❌(v0.2)金额二分表被团队当成最终审批逻辑,D-001 五模型没人接 → ✅ Step B 治理声明 + §7 决策树重构,矩阵数值经 MCP 不内嵌。
- ❌(v0.2)审批人想把 24 改成 22,系统只有批/驳两键,只好驳回重走一天 → ✅ modified_and_approved:幅度内改量直接生效留痕。
- ❌(v0.2)改量 −33% 也直接生效 → 审批人单方面改写了量值模型 → ✅ 超授权幅度不生效,自动路由上级,原意见留痕。
- ❌(v0.2)confirmed 即释放幂等键,确认后到货前新预警又拟一单 → 双重发货 → ✅ 释放点钉死在到货核收/终态。
- ❌(v0.3 loop)护栏没填全(acceptance/permission/human_gate 缺一)就把 trigger 设成 cron 自动 → 机器无停止条件地烧 token + 无权限边界地自动下单,权限失控 → ✅ 护栏先于自动化:三道护栏填全且量值定(D-001)前,trigger 保持手动,不开自动下单。
- _(后续迭代继续往下加)_

### 9d. DECISION-001 v1.0 引用(锁定 2026-05-15;原文在仓库,本节不复述数值)

| 块 | 内容 | 本节点的消费方式 |
|---|---|---|
| 5 审批模型 | A 公司先批 / B 老板说了算 / C 双轨双签 / D 老板承诺+24h跟踪 / E 按幅度自动分层 | §7.1 路由目标;按场景全用 |
| 决策树 | 战略品类优先判;一般品类按 adj_pct 分段;新人<6月升一级;新经销商首单强制 C;节假日放宽 20% | §7.1 写死;阈值段占位 |
| 三维阈值矩阵 | 客户级 S+~D × SKU 战略等级 × 区域,每格 4 段 | 经 MCP 查询;**一线不可见;本文件不内嵌** |
| 权限双签 | 总部定结构与战略 SKU 值;大区 GM ±20% 微调需双签 | 改量授权幅度的来源(§4 Step D) |
| §未解决事项 | 阈值数值待 3-6 月真实订单数据校准 | 全部 <占位> 的依据 |

---

## 10. Scripts — 拟单 / 决策树路由 / 改量校验 / 幂等 / 校验(出件前必跑)

```python
import math
from datetime import datetime

# v0.2: confirmed 计入未释放;received 与终态才释放
UNRELEASED = {"draft", "pending_approval", "approved", "modified_and_approved",
              "auto_approved", "submitted", "confirmed"}
RELEASED   = {"received", "rejected", "failed", "cancelled"}
TERMINAL_REJECT = {"rejected"}
MODEL_LADDER = ["B", "D", "E", "C", "A"]      # 严格度阶梯(占位,以 D-001 权限矩阵为准)

def calendar_days(since, now):
    return (datetime.fromisoformat(now) - datetime.fromisoformat(since)).days

def draft_qty(target, current, conf, case_spec, moq, conservative=0.5):
    """拟单量:全脚本可重放。过渡公式——待 D-001 需求模型(心跳水位/动态W)经 MCP 替换本函数体;
       取整/MOQ 永久保留。"""
    flags = []
    if conf == "low":
        current = current * conservative
        flags.append("conservative_qty")
    raw = target - current
    if raw <= 0:
        return 0, flags
    qty = math.ceil(raw / case_spec) * case_spec
    return max(qty, moq), flags

def qty_valid(qty, case_spec, moq, cap):
    """改量同样必须过的校验(v0.2)。"""
    return qty % case_spec == 0 and qty >= moq and qty <= cap

# ---- v0.2 DECISION-001 决策树路由(矩阵经 MCP,不内嵌数值) ----
def route_d001(carry, sku_tier, cust_grade, region, adj_pct,
               tenure_months, first_order_new_dealer, holiday, conf, matrix):
    if carry.get("hitl_required") or "疑似窜货" in carry.get("flags", []):
        return None, ["carry:" + ("疑似窜货" if "疑似窜货" in carry.get("flags", []) else "hitl_required")]
    if first_order_new_dealer:
        return "C", ["新经销商首单强制C"]                     # 强制规则,无关幅度
    if sku_tier == "战略":
        model = matrix.lookup(cust_grade, sku_tier, region, adj_pct)  # 战略品类优先判:矩阵指定
        reason = ["战略品类:矩阵指定"]
    else:
        bands = matrix.bands(cust_grade, sku_tier, region)    # 各档界限,经 MCP;节假日 ×1.2
        if holiday:
            bands = {k: v * 1.2 for k, v in bands.items()}
        a = abs(adj_pct)
        if   a <= bands["b5"]:   model = "B"
        elif a <= bands["b15"]:  model = "D"
        elif a <= bands["b30"]:  model = "E"
        elif a <= bands["b50"]:  model = matrix.lookup(cust_grade, sku_tier, region, adj_pct)  # 30-50% 占位:矩阵定
        else:                    model = "A"
        reason = [f"一般品类:幅度{a:.0%}"]
    # 升级修饰:新人 < 6 月 或 conf=low → 严格度 +1(可叠加一次封顶)
    if tenure_months is not None and tenure_months < 6 or conf == "low":
        i = MODEL_LADDER.index(model)
        model = MODEL_LADDER[min(i + 1, len(MODEL_LADDER) - 1)]
        reason.append("升一级(新人/低置信)")
    return model, reason

def is_auto(model, adj_pct, matrix):
    """模型 E 低档自动;其余人批。"""
    return model == "E" and abs(adj_pct) <= matrix.e_auto_band()

# ---- v0.2 改量处理 ----
def handle_modify(order, new_qty, approver_role, authority, case_spec, moq, cap):
    """返回 action: applied | blocked | routed_up"""
    if not qty_valid(new_qty, case_spec, moq, cap):
        return {"action": "blocked", "flag": "modify_blocked:校验不过(箱规/MOQ/上限)"}
    delta = abs(new_qty - order["order_qty"]) / order["order_qty"]
    if delta > authority[approver_role]:                      # 权限矩阵经 MCP(一线±10%,GM±20%双签)
        return {"action": "routed_up",
                "flag": f"routed_up:{approver_role}→{authority['next'][approver_role]}"}
    return {"action": "applied"}

def validate(out: dict, ledger_before: dict, now: str, matrix=None) -> list[str]:
    errs = []
    key = (out["store"], out["sku"])
    cur = ledger_before.get(key)
    # ===== v0.2 幂等:未释放(含 confirmed)不得新拟 =====
    if cur and cur["status"] in UNRELEASED and out.get("order_id") != cur["order_id"] and \
       f"dedup_suppressed:{out['store']}-{out['sku']}" not in out.get("flags", []):
        errs.append(f"duplicate_unreleased_order:{out['sku']}")
    # ===== 拟单量可重放 =====
    qty, _ = draft_qty(out["target_qty"], out["current_qty"], out["qty_conf"],
                       out["case_spec"], out["moq"])
    base_qty = out.get("approval", {}).get("original_qty", out["order_qty"])
    if base_qty != qty:
        errs.append(f"qty_not_script_computed:{out['order_id']}")
    if out["qty_conf"] == "low" and "conservative_qty" not in out.get("flags", []):
        errs.append(f"low_conf_without_conservative:{out['order_id']}")
    # ===== v0.2 模型路由可重放 =====
    if matrix is not None:
        m, _ = route_d001(out.get("_carry", {}), out.get("_sku_tier"), out.get("_cust_grade"),
                          out.get("_region"), out.get("adj_pct", 0), out.get("_tenure"),
                          out.get("_first_order_new_dealer", False), out.get("_holiday", False),
                          out["qty_conf"], matrix)
        if m is not None and out.get("approval_model") != m:
            errs.append(f"model_not_reproducible:{out['order_id']}")
    # carry 必停(双保险)
    c = out.get("_carry", {})
    if (c.get("hitl_required") or "疑似窜货" in c.get("flags", [])) and \
       out["approval_route"] != "hitl":
        errs.append(f"carry_bypassed:{out['order_id']}")
    # 人批前不得提交;auto 审计痕迹
    if out["approval_route"] == "hitl" and out["status"] in ("submitted", "confirmed", "received") and \
       not out.get("approval", {}).get("approved_by"):
        errs.append(f"hitl_order_submitted_without_human:{out['order_id']}")
    if out["approval_route"] == "auto" and out.get("approval", {}).get("approved_by") != "auto" and \
       out.get("approved_by") != "auto":
        errs.append(f"auto_without_audit_trail:{out['order_id']}")
    # ===== v0.2 改量断言 =====
    ap = out.get("approval", {})
    if out["status"] == "modified_and_approved":
        if not all(k in ap for k in ("original_qty", "approved_qty", "modified_by")):
            errs.append(f"modify_without_trace:{out['order_id']}")
        if not qty_valid(ap["approved_qty"], out["case_spec"], out["moq"], out.get("_cap", 10**9)):
            errs.append(f"modified_qty_invalid:{out['order_id']}")
        if out.get("_modify_delta_over_authority") and \
           not any(f.startswith("routed_up") for f in out.get("flags", [])):
            errs.append(f"over_authority_applied:{out['order_id']}")      # 超幅必须路由不得生效
    if out.get("approval_model") == "C" and out["status"] in ("submitted","confirmed","received") and \
       not ap.get("dual_sign_by"):
        errs.append(f"model_c_without_dual_sign:{out['order_id']}")
    if out.get("approval_model") == "D" and out["status"] in ("submitted","confirmed","received") and \
       not ap.get("tracking_task"):
        errs.append(f"model_d_without_tracking:{out['order_id']}")
    # ===== rejected 终态:不得改提 =====
    if cur and cur["status"] in TERMINAL_REJECT and out.get("order_id") == cur["order_id"] and \
       out["status"] != "rejected":
        errs.append(f"rejected_order_resubmitted:{out['order_id']}")
    # ===== 重试上限 =====
    if out.get("submit_attempts", 0) > MAX_RETRIES and out["status"] != "failed":
        errs.append(f"retry_over_limit:{out['order_id']}")
    # ===== 不在 sku_mix 不得 auto =====
    if out.get("_not_in_sku_mix") and out["approval_route"] == "auto":
        errs.append(f"auto_order_outside_sku_mix:{out['order_id']}")
    # ===== 边界:不得替 L0-07 解除预警;不得内嵌矩阵数值 =====
    for f in out.get("fanout", []):
        if "解除预警" in f or f.startswith("断货预警:resolved"):
            errs.append(f"illegal_alert_resolve:{f}")
    if out.get("_matrix_values_embedded"):
        errs.append("matrix_values_embedded")                              # 一线不可见,文件不嵌值
    # 日历天
    if out.get("since") and out.get("duration_days") != calendar_days(out["since"], now):
        errs.append(f"duration_not_calendar:{out['order_id']}")
    return errs
```

---

## 11. 评测起手式(Eval Starter)

> 离线建设期做。攒历史预警 + 真实下单记录(含审批改量记录),跑本 Skill 对照。v0.1 的 r01–r08 全部保留(r01/r02 的 auto/必停语义不变,期望追加模型标注:r01 → 模型 E 低档,r02 → 按决策树幅度段对应模型);v0.2 新增 6 条。

```json
[
 {"id":"r09",
  "input":{"alert":{"store":"大润发徐汇店","sku":"6MX-JDX(战略SKU)","carry":{}},
           "ctx":{"sku_tier":"战略","cust_grade":"S+","region":"华东","adj_pct":0.08,
                  "tenure_months":24,"first_order_new_dealer":false,"holiday":false},
           "matrix_fixture":{"lookup(S+,战略,华东,0.08)":"C"}},
  "expect":{"approval_model":"C","model_reproducible_from_tree":true,
            "dual_sign_required":true,"no_matrix_values_in_output":true},
  "tags":["v0.2-①a:战略SKU优先判→查矩阵走指定模型(本例C双签);路由可由决策树重放;不向一线回阈值"]},

 {"id":"r10",
  "input":{"alert":{"store":"新店","sku":"6MX-QY-500","carry":{}},
           "ctx":{"sku_tier":"一般","adj_pct":0.02,"first_order_new_dealer":true}},
  "expect":{"approval_model":"C","reason_contains":"新经销商首单强制C",
            "note":"幅度仅2%本该走B,强制规则优先"},
  "tags":["v0.2-①b:新经销商首单→强制模型C,无关幅度"]},

 {"id":"r11",
  "input":{"order":{"order_id":"RO-050","order_qty":24,"case_spec":2,"moq":4,"status":"pending_approval"},
           "action":{"type":"modify_and_approve","new_qty":22,"by":"城市经理-Wang","role_authority":0.10,
                     "reason":"门店库位紧张"}},
  "expect":{"status":"modified_and_approved","approval":{"original_qty":24,"approved_qty":22},
            "delta_pct":0.083,"applied":true,"trace_complete":true},
  "tags":["v0.2-②a:±10%内改量(24→22,−8.3%)→生效,original/approved/by/reason 全留痕"]},

 {"id":"r12",
  "input":{"order":{"order_id":"RO-051","order_qty":24,"case_spec":2,"moq":4,"status":"pending_approval"},
           "action":{"type":"modify_and_approve","new_qty":16,"by":"督导-Chen","role_authority":0.10}},
  "expect":{"applied":false,"flags_contains":"routed_up:督导→城市经理",
            "status_still":"pending_approval","original_opinion_kept":true},
  "tags":["v0.2-②b:改幅−33%超授权→不生效,自动路由上级,原审批人意见留痕不绑定"]},

 {"id":"r13",
  "input":{"order":{"order_id":"RO-052","order_qty":24,"case_spec":12,"moq":12,"status":"pending_approval"},
           "action":{"type":"modify_and_approve","new_qty":6,"by":"城市经理-Wang","role_authority":0.10}},
  "expect":{"applied":false,"flags_contains":"modify_blocked","reason":"6 违反箱规12与MOQ12",
            "returned_to_approver":true,"not_auto_rounded":true},
  "tags":["v0.2-②c:改量违反箱规/MOQ→拦截退回重改,不替人取整"]},

 {"id":"r14",
  "input":{"alert":"L0-07 新预警(同店同SKU)",
           "ledger":{"大润发徐汇店|6MX-JDX":{"order_id":"RO-031","status":"confirmed","eta":"2026-06-15"}}},
  "expect":{"no_new_order":true,"flags_contains":"dedup_suppressed",
            "note":"confirmed≠释放;到货核收(received)或终态才放键"},
  "tags":["v0.2-③:confirmed 后到货前新预警→suppress 不重拟,杜绝双重下单"]}
]
```

**打分维度(v0.1 六维保留,新增):**
7. **决策树路由可重放**(r09/r10:战略优先判、强制 C、修饰规则;§10 复算一致;输出不嵌矩阵值)
8. **改量三态正确**(r11 幅度内生效留痕 / r12 超幅路由上级 / r13 校验拦截不替人改)
9. **幂等释放时点**(r14:confirmed 不放键;received/终态才放)
10. 模型 C 双签、模型 D 跟踪任务成对断言(§10)

> 最危险的三类错:**重复下单**(r04/r14)、**HITL 被绕**(r03/r06/r07/r12——第四种绕法:改量当后门)、**矩阵数值泄漏到一线**(r09)。这三组是回归必跑。

---

## 12. 运行层 · Loop Spec(BEA 优先级更高)

> **本块是运行层补充,优先级低于上面全部 BEA 设计**(Loop 规则 L1:先 BEA 后 Loop;没按 BEA 造对的节点不进 Loop 设计)。本节点 BEA 已造对(Workflow + 链式 + 五模型路由 + HITL 落地),故可进 Loop 化。
> **本节点是系统第一个「出手类」节点的 Loop 化范本。**
> **⚠️ 护栏先于自动化(L4 铁律):`acceptance_criteria` + `permission_boundary` + `human_gate` 已填全,但「补多少」的量值待 DECISION-001——在 D-001 闸门开、量值定之前,`trigger` 保持手动/半自动,所有下单挂起人批,绝不开自动下单。** 三道护栏齐 + 量值定,才可把 trigger 切 cron 自动。

### 12.1 五范式 → 护栏映射(衔接 §5)

L0-08 属**涉钱类(下单 = 不可逆出手)**。按五范式→护栏映射:
- **涉钱类 → `human_gate`(金额阈值)+ 收紧的 `permission_boundary`**:`human_gate` 卡单店补货总额超阈值挂起人批;`permission` **只开「新增补货单」,不给删/改/取消**(对齐 §8 HITL 与命门一幂等)。
- 量值未定前更进一步:**所有下单挂起人批**(不只超阈值的),即 human_gate 暂时收紧到「全停」,待 D-001 量值定后放宽到「超阈值才停」。

### 12.2 loop_spec 标准块(照《Loop 运行层规则》§3,字段对齐《字段字典 v1.0》)

```yaml
loop_spec:
  enable: true
  why_loop: "每日每店重复;done=该补的补/该挂的挂/产三类结果;有2A线+压货+窜货+价异常能说不对 → 三条件满足"

  automation:
    trigger: "【护栏未全验前=手动触发】目标态:每日08:00 cron 或 oos_flag/水位<2A 事件触发;D-001量值定后再切自动"
    inbox: "补货待处理收件箱(已下单/待批/已派工 三类)"

  worktree:
    needed: true            # 一次跑一批店,各店副本隔离防污染

  skill:
    ref: "L0-08_replenishment_SHELL_v0_2.md"

  connector:
    actions: ["新增补货单"]   # 只开新增,不给删改(对齐 permission_boundary.cannot)

  subagents:
    maker: "识别 oos_flag + 算水位 + 出补货建议(读 L0-01 库存 / L2-01 预测 range)"
    tracker: "独立审查:对照后仓压货(读后仓库存) / 窜货·价格异常(读 L0-06,不自判) / 2A线 → 不该补的推翻为'先消化不补'+派工;合并前跑 dry run"

  memory:
    writes: "本店每条:补了什么 / 没补什么 / 为什么 / 待查项(vs 上次补货)"
    store: "[持久化存储]"

  # —— 4 道护栏(涉钱节点必填;护栏先于自动化)——
  acceptance_criteria: "一批店全走完 识别→建议→tracker审查→下单/挂起,产出三类结果且每条留痕"
  permission_boundary:
    can: ["读库存/销量/预测", "生成补货单", "阈值内自动下单(待 D-001 阈值)", "派工"]
    cannot: ["超额下单", "取消/删除/修改订单", "跨店调拨", "改主数据"]
  human_gate: "单店补货总额 > [金额阈值占位] → 挂起推手机等人拍板;**量值未定前所有下单挂起人批**"
  observability: "每条建议留痕:source_ref / 谁判(maker 还是 tracker) / 判什么 / 为什么 / 结果,可审计回溯"
```

### 12.3 字段对齐说明(《字段字典 v1.0》)

- `oos_flag`、预测 `range`、`source_ref` 均为字段字典标准名,与上游 L0-07(oos_flag)、L2-01(预测 range)、全系统留痕(source_ref)一致;
- `tracker` 的「窜货 / 价格异常」信号**读 L0-06,不自判**;「后仓压货」读后仓库存——tracker 是独立审查者,只消费事实不重算(同双子博弈:maker 出手、tracker 审,合并前 dry run);
- `connector.actions` 只「新增补货单」,与 `permission_boundary.cannot`(取消/删除/修改)严格对齐——出手类节点的连接器权限收到最紧。

### 12.4 切自动的前置条件(护栏先于自动化检查单)

切 `trigger` 为 cron 自动**前必须全部满足**:
- ☐ DECISION-001 量值模型接入(Step B 过渡公式被替换);
- ☐ `human_gate` 金额阈值由占位换成 D-001 真实阈值;
- ☐ `permission_boundary` 阈值内自动下单的「阈值」由 D-001 定;
- ☐ tracker 审查链跑通(后仓压货 / L0-06 窜货价格 / 2A线 推翻逻辑验证)。
- 任一未满足 → trigger 保持手动/半自动,下单挂起人批。**这正是 §9c 那条 loop 踩坑要防的:护栏没填全就开自动 = 烧 token + 权限失控。**

---

## 待填变量(套用时替换)
- `owner`;各模型审批人映射与 D-001 权限矩阵(经 MCP)
- **§7.1 全部幅度段 `<±5%段>` 等 — 待 3-6 月真实订单数据校准(DECISION-001 §未解决事项)**
- **D-001 需求量模型(心跳水位/动态 W)— 接入后整体替换 Step B 过渡公式(§4 治理声明)**
- §9a 保留参数(保守系数/重试/时限/单笔上限/过渡基准)
- 安全库存 / 箱规 / MOQ / 供货价主数据 — 经 MCP
- 订货系统接口(下单/查单/回执/**到货核收**)— 经 MCP
- 订单台账落库 — 与 L0-07/L0-06/L5-02 台账同基建分表(四本台账统一方案)
