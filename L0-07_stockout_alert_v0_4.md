---
name: stockout-alert
description: 消费 L0-01 库存 JSON(out_of_stock / low),结合 L0-02 visual_oos 对账信号与 L0-04 门店生命周期事件,按写死等级表(状态 × SKU 战略权重)判定预警等级、路由通知对象,并用预警台账做防重复、日历天阶梯升级、冻结/解冻、自动解除与数据中断检测。凡涉及"断货预警、缺货提醒、低库存通知、预警升级、预警冻结、预警解除、缺货复核"的输入都用本 Skill。它是断货/缺货预警的唯一触发方(L0-07)——L0-01 §7 扇出的「断货预警」指向这里;L0-02 只给对账信号、L0-03 只汇总,均不触发。下游:城市经理 / 美顾督导 / 美顾 / 补货流程(L0-08,接收订单回执)。
version: v0.4
owner: <填:负责人/团队>
type: Workflow / Skill(L0-01 直接下游 · 预警触发节点 · 有状态四态机 · L0-07)
status: 粗糙版 v0.3,待真实数据迭代
upstream: L0-01 库存 JSON(主触发)/ L0-02 visual_oos(对账信号)/ L0-04 门店档案(店级M·生命周期事件·通知路由)/ SKU 战略权重主数据 / **SKU 生命周期 effective_stage(按 sku×scope×period,只读)** / L0-08 订单回执 / 预警台账
downstream: 城市经理 / 美顾督导 / 美顾 / 补货流程(L0-08)/ 预警台账(回写)
backlog: L0-07
---

# 缺断货预警 Skill v0.4 · 触发节点(L0-07)

> 本 Skill 依据《INFINITY OS · Agent 设计标准 v1.0》编写。
> 它是一个 **Workflow**(写死轨道)——等级照二维表查、防重复靠状态机、解除靠状态翻转,**LLM 在本节点只写一行推送文案,其余无判断空间**。

> **v0.4 变更摘要(只加一件事:断货严重度与升级速度按生命周期阶段加权):** 读《SKU 生命周期阶段判定》的 `effective_stage`,**严重度/P 级/升级速度按阶段加权**(导入起判即高P、升级最快/成长高权重/成熟按原阶梯/衰退降权/焕新按成长/淘汰不报/unknown 按基础阶梯照常报)。**"是否断货"的事实判定(=L0-01 状态)与阶段无关,四态机/冻结解冻/解除逻辑一字不改**——阶段只动严重度权重、升级速度、要不要报。与 L1-03 的 unknown 处理**刻意相反**:L1-03 unknown 不判级(判级会误导),L0-07 unknown **照基础时长阶梯正常预警**(断货是硬事实,漏报比误报危险)。

---

## 1. 角色与目标 + 全系统预警边界【先读这个】

你是断货/缺货预警的**唯一触发方**。全系统关于"缺货该不该叫、叫多大声、叫给谁、叫几次"只有你说了算。

**预警边界(兄弟节点的 SKILL.md 已写死指向你,你是接收方):**

| 节点 | 它做什么 | 它不做什么 |
|---|---|---|
| L0-01 | 库存事实真相源,fanout「断货预警:{sku}」→ **送到本节点** | 不定预警等级、不管通知谁 |
| L0-02 | 只产 `visual_oos` 对账信号 + `discrepancy_oos` | **不发预警**(其 §7 已禁) |
| L0-03 | 只把断货汇进日报 alerts | **不触发**(其 §5 MUST NOT 已禁) |
| L0-04 | 门店生命周期(suspend/restore/close)+ 店级M + 通知路由变更 → **扇出到本节点**(v0.3 正式吸收) | 不碰预警内容 |
| L0-08 | 补货执行,**订单状态回执到本节点**(v0.3 正式吸收) | **不替本节点解除预警** |
| **L0-07(本节点)** | **判级 · 路由 · 防重复 · 升级 · 冻结/解冻 · 解除 · 数据中断检测** | 不判库存事实(L0-01)、不下单(L0-08) |

**本节点是链路第一个有状态节点**:必须读写**预警台账**(四态、since、escalation_count、resolution_reason、replenishment、last_store_report_at)。台账是防重复/升级/冻结/解除的根基,不是可选项。

---

## 2. 输入(Input)

| 来源 | 字段 | 用途 |
|---|---|---|
| L0-01 库存 JSON | items[].sku / status / qty / conf / hitl_required / flags | **主触发源**;断货判定只认它 |
| L0-02 货架 JSON | visual_oos[](sku/evidence/conf)、`discrepancy_oos:*` flag | **对账信号**,只产复核提示 |
| **L0-04 档案与事件(v0.3)** | ①店级 → 巡店频次 → **店级 M**(L0-04 §9b);②生命周期扇出:`suspended` / `suspended→active` / `closed`;③advisor/supervisor 变更 | 冻结/解冻/关店解除;M 按店;通知路由换人 |
| **L0-08 订单回执(v0.3)** | order_id / status(pending_approval/submitted/confirmed/failed)/ 预计到货 | 写入预警 `replenishment` 跟踪;**不触发解除** |
| SKU 战略权重 | 主数据(经 MCP):`Flagship` / `Core` / `Volume` | 同样断货,旗舰与长尾等级不同 |
| **SKU 生命周期阶段(v0.4)** | 《SKU 生命周期阶段判定》effective_stage(按 sku×scope×period,只读) | **同样断货、不同阶段、不同严重度**;只加权严重度/升速,不改断货事实 |
| 预警台账 | 四态预警列表 | 防重复、升级、冻结、解除、staleness |
| 当前时间 `now` | — | 日历天计算的基准 |

---

## 3. 参数定义(Parameters)

| 字段 | 类型 | 允许值 / 说明 |
|---|---|---|
| `store` / `sku` | string | **台账主键 = (store, sku)** |
| `type` | enum | `断货` / `低库存` / `疑似缺货`(仅视觉来源) |
| `level` | enum | `P0` / `P1` / `P2` / `P3`。照 §7.1 表查 + 阶梯 + **阶段加权(v0.4)** |
| **`base_level`(v0.4)** | enum | 阶段加权**前**的 P 级(溯源:看出阶段把 base_level 提到 level) |
| **`effective_stage`(v0.4)** | enum | 读自《SKU 生命周期阶段判定》(导入/成长/成熟/衰退/焕新/淘汰/unknown),只读不重判 |
| **`grading_stage`(v0.4)** | enum | 加权所用阶段(= effective_stage) |
| `since` | string | 首次触发时间(日历天唯一锚点) |
| `duration_days` | number | = floor((now − since)/1天),每次处理重算,不累加 |
| `report_count` | number | 上报次数,仅参考,不参与升级判定 |
| `escalation_count` | number | 已升级级数;level = 表值 − 计数,封顶 P0 |
| **`state`(v0.3)** | enum | **`active` / `frozen` / `resolved`(四态机,见 §4 状态图)** |
| **`freeze_reason`(v0.3)** | string\|null | 目前唯一:`store_suspended`(L0-04 定义) |
| **`resolution_reason`(v0.3)** | enum\|null | `normal`(L0-01 显式恢复)/ `store_closed`(L0-04 关店)/ `store_suspended_then_closed`(冻结中关店)。**恢复时长统计只计 normal** |
| **`store_M`(v0.3)** | number | **店级静默天数,从 L0-04 按店读**(店级×巡店频次×缓冲);全局 `<静默天数M>` 废弃 |
| **`replenishment`(v0.3)** | object\|null | L0-08 回执:`{order_id, order_status, eta}`;只作跟踪与推送素材 |
| `last_store_report_at` | string | 该店最近一次 L0-01 上报时间,staleness 判定用 |
| `review_required` | bool | 低置信 / discrepancy 时为 true |
| `resolved_at` / `resolution_duration` | string / number | 解除记录(日历天) |
| `notify[]` | string[] | 照 §7.2 路由;**通知对象随 L0-04 advisor/supervisor 变更同步(v0.3)** |
| `push_text` | string | 一行人可读推送(数字须可溯源) |
| `carry` | object | 透传 L0-01 的 hitl_required / flags,**只透传不裁决**(落地在 L0-08) |
| `flags` | string[] | …(v0.3 各项)… / **`stage_weighted:{base→level}` / `stage_no_alert:淘汰` / `stage_unknown_base_grading`(v0.4)** |

---

## 4. 处理流程(Steps · 路由 → 查表 → 四态状态机 → 扇出)

### Step A — 路由(Routing):按来源与状态分流
1. L0-01 `status == out_of_stock` → **断货分支**
2. L0-01 `status == low` → **低库存分支**
3. **仅** L0-02 visual_oos(L0-01 该 SKU 无异常或无数)→ **疑似缺货分支**
4. L0-02 `discrepancy_oos` → **复核分支**
5. L0-01 `status == normal`(显式)→ **解除检查分支**(C3,reason=normal)
6. **缺席分支**:店有上报、SKU 未出现 → 缺席 ≠ normal,active 保持,flag `sku_absent_in_report`,严禁解除或降级
7. **静默分支**:active 存在、`now − last_store_report_at ≥ store_M`(**店级 M,v0.3**)→ C4 staleness
8. **(v0.3)L0-04 生命周期分支**:`suspended` → C5 冻结;`suspended→active` → C5 解冻;`closed` → C3 解除(reason=store_closed)
9. **(v0.3)L0-08 回执分支**:订单状态 → C6 跟踪更新(不解除)

### Step B — 查等级表(§7.1,写死)
- 战略权重 × status 查表;conf=low 降一级 + `review_required` + flag;疑似缺货固定 P3 仅提示;复核分支不开正式条目。(同 v0.2,不赘述。)

### Step B2 — 按生命周期阶段加权(v0.4 新增)
> **先有事实,后有权重。** 是否断货(out_of_stock/low)是 Step A 从 **L0-01 状态**判定的硬事实,**与阶段无关**;Step B 查出**基础 P 级**;本步只用阶段**加权**这个基础 P 级与升级速度。

1. 读 effective_stage(按 sku×scope×period,**只读不重判**)。
2. 按 §7.3 阶段权重表调整(基础 P 级 → 加权 P 级 + 升级速度):
   - **导入期**:断货 = 刚点亮就灭、前功尽弃(投了 60-80% 费用,断货=钱白烧)→ **起判即高 P 级**(基础再低也拉到 ≥`<导入起判线>`)、**升级最快**(阶梯天数 ×`<导入加速系数><1`);
   - **成长期**:断货打断复制势头 → 高权重(P 级 +1 档、升级加速);
   - **成熟期**:断货=丢单可控 → **按原时长阶梯正常判**(不加权);
   - **衰退期**:本就在控库存止损,断货未必坏 → **降权**(P 级 −1 档或升级减速);
   - **焕新期**:重启期断货=焕新失败 → **按成长口径**;
   - **淘汰期**:本就要清退 → **不预警**(`stage_no_alert`,不开条目);
   - **unknown**:**按基础时长阶梯照常预警**(不加权),标 `stage_unknown_base_grading`——**断货是硬事实,不能因不知阶段就沉默**(与 L1-03 unknown 不判级刻意相反:那里判级会误导,这里漏报比误报危险)。
3. 写 `base_level`(加权前)+ `level`(加权后)+ `grading_stage`,溯源"看出阶段把 Px 提到 Py"。**四态机/解除/冻结逻辑不受影响**——加权只作用于 active 条目的 P 级与升速。

### Step C — 四态状态机【本节点的命门】

```
                    ┌──────────── L0-04: suspend ───────────┐
                    │                                       ▼
  [新事实] ──▶ ACTIVE ◀──── L0-04: restore(解冻补算补升)── FROZEN
                │  │                                        │ 不升·不解·不通知·不判stale
   C1 防重复(静默)│  │ C2 阶梯升级/状态跃迁(通知)              │
                │  └── L0-01 normal ──▶ RESOLVED(reason=normal,计恢复时长)
                └───── L0-04 closed ──▶ RESOLVED(reason=store_closed,不计恢复时长)
                       FROZEN 中 closed ─▶ RESOLVED(reason=store_suspended_then_closed,不计)
```

**C0. 时间语义铁律**:`duration_days = floor((now − since)/1天)`,由 since 重算,绝不按上报次数累计。`report_count` 仅参考。

**C1. 防重复**:同键 active 同级 → 不新发不通知,重算天数,`report_count += 1`,flag `dedup_suppressed`。更新静默,跃迁才响。

**C2. 升级**:
- 阶梯:`expected = duration_days // N`,expected > escalation_count → 补升到位(可跨级),封顶 P0,通知。
- 状态跃迁:低库存 → 断货,不算重复,重判重通知,since 保留,阶梯清零。
- **frozen 期间升级时钟冻结(v0.3,见 C5)**;stale 期间同 v0.2 冻结。

**C3. 解除(v0.3:带 reason)**:
- **reason=normal**:L0-01 显式 normal → resolved,记时长,轻量"已恢复"通知,**计入恢复时长统计**。
- **reason=store_closed**:L0-04 关店扇出 → resolved,记时长但**不计入恢复统计**(货没回来,店没了——计进去会把平均恢复时长拉好看),通知原对象"该店已关闭,预警关闭"。
- **reason=store_suspended_then_closed**:frozen 中收到 closed → 同上,不计统计。
- 只认上述三种;缺席不解除;视觉不解除;**L0-08 回执"已到货"不解除**(到货 ≠ 上架,等 L0-01 下次上报)。

**C4. Staleness**:active ≥ `store_M`(店级,从 L0-04 读)天无任何 L0-01 数据 → 标 `stale`,通知督导,不升不解。**suspended 店不判 stale**(已 frozen,巡店本就暂停,判 stale 会误报督导)。

**C5. 冻结/解冻(v0.3 新增,吸收 L0-04 Step 4b 契约)**:
- **冻结**:收到 L0-04 `suspended` 扇出 → 该店全部 active 预警 → `state:frozen`,`freeze_reason:store_suspended`,**不升级(没人巡店没有事实)、不解除(货的状态未知)、不通知(别拿冻结预警轰炸人)、不判 stale**。
- **解冻**:收到 `suspended→active` → frozen 预警回 `state:active`,flag `unfrozen:{暂停天数}`;**按日历天从原 since 补算 duration(冻结期计入持续时长——货大概率一直断着,时长不被暂停"洗掉"),按阶梯一次补升到位并通知**。
- 冻结/解冻本身各发一条轻量状态通知给督导(知情即可)。

**C6. 补货跟踪(v0.3 新增,吸收 L0-08 回执契约)**:
- L0-08 回执(已拟待批/已提交/已确认/预计到货/失败转人工)→ 写入该预警 `replenishment` 字段,可并入下一次跃迁推送的文案("已下补货单,预计 6/15 到")。
- **回执只更新跟踪,绝不触发解除、绝不冻结升级时钟**——单下了货没到、货到了没上架,断的还是断的;升级照走,直到 L0-01 报 normal。

### Step D — 出件与扇出
按 §6 schema 输出 + push_text → 跑 §10 校验 → 按 §7.2 路由(**通知对象用 L0-04 当前版的 advisor/supervisor,收到其变更扇出即换人,v0.3**)→ 回写台账。

---

## 5. 规则与强度(RFC2119)

| 强度 | 规则 |
|---|---|
| **MUST** | **严重度/P 级/升级速度必须按 effective_stage 加权(§7.3):导入起判即高P且升级最快、成长高权重、成熟原阶梯、衰退降权、焕新按成长**(v0.4)。 |
| **MUST** | **"是否断货"的事实判定与阶段无关**——断货事实只认 L0-01 status;阶段绝不改变是否断货,只加权严重度/升速/要不要报(v0.4)。 |
| **MUST** | **淘汰期不预警(stage_no_alert);unknown 按基础时长阶梯照常预警不沉默(stage_unknown_base_grading)**——断货是硬事实,漏报比误报危险(v0.4)。 |
| **MUST NOT** | 阶段**只读《SKU 生命周期阶段判定》的 effective_stage,绝不重判阶段**(v0.4)。 |
| **MUST** | **四态机/冻结解冻/解除逻辑不受阶段影响**——阶段加权只作用于 active 条目的 P 级与升速,不碰 state 流转(v0.4)。 |
| **MUST** | 正式断货/低库存预警的触发依据**只认 L0-01 的 status**;仅视觉来源最高 P3 疑似缺货。 |
| **MUST** | duration 用日历天重算,严禁按次累计;升级判定只用日历天。 |
| **MUST** | 解除只认三种 reason:L0-01 显式 normal / L0-04 closed / frozen 中 closed;**恢复时长统计只计 normal**;缺席、视觉、**L0-08 到货回执**均不得触发解除。**(v0.3)** |
| **MUST** | 收到 L0-04 suspended 必须冻结该店全部 active 预警(不升不解不通知不判 stale);restore 必须解冻并**按日历天从原 since 补算补升、通知**;frozen 中收到 closed 按 store_suspended_then_closed 解除。**(v0.3)** |
| **MUST** | `store_M` 必须按店从 L0-04 读(店级×巡店频次×缓冲);全局常量 M 废弃。**(v0.3)** |
| **MUST** | L0-08 回执只写 `replenishment` 跟踪字段与推送文案,**不得**改变 state、不得冻结升级时钟。**(v0.3)** |
| **MUST** | 等级照 §7.1 表 + 阶梯;conf=low 降一级标复核;同键 active 同级抑制新发;跃迁(升级/转断货/解除/**冻结/解冻**)才通知。 |
| **MUST** | carry 原样透传(落地在 L0-08 的 HITL),本节点不裁决。 |
| **SHOULD** | 通知路由应随 L0-04 advisor/supervisor 变更扇出即时换人;解除应发轻量闭环通知。 |
| **MAY** | 同店多 SKU 聚合推送;replenishment 信息并入跃迁文案。 |

---

## 6. 输出(Output · Artifact 契约)

```json
{
  "store": "大润发徐汇店",
  "sku": "6MX-JDX",
  "ts": "2026-06-14T09:00:00+08:00",
  "type": "断货",
  "level": "P0",
  "base_level": "P2",
  "effective_stage": "导入",
  "grading_stage": "导入",
  "strategic_tier": "Flagship",
  "since": "2026-06-12T14:30:00+08:00",
  "duration_days": 2,
  "report_count": 3,
  "escalation_count": 0,
  "state": "active",
  "freeze_reason": null,
  "resolution_reason": null,
  "store_M": 9,
  "replenishment": { "order_id": "RO-2026-0612-031", "order_status": "confirmed", "eta": "2026-06-15" },
  "last_store_report_at": "2026-06-14T08:40:00+08:00",
  "review_required": false,
  "resolved_at": null, "resolution_duration": null,
  "notify": ["城市经理", "美顾督导", "补货流程:L0-08"],
  "carry": { "hitl_required": false, "flags": [] },
  "flags": ["dedup_suppressed:大润发徐汇店-6MX-JDX", "stage_weighted:P2→P0(导入)"],
  "push_text": "【P0断货·第2天·导入期】徐汇店 加点鲜(导入期)仍断货,严重度上调至P0——新品刚铺市断货=前功尽弃,请优先补货;补货单已确认,预计6/15到货。"
}
```

> **导入期加权示例(v0.4):** `base_level:"P2", level:"P0", effective_stage:"导入", flags:["stage_weighted:P2→P0(导入)"]` ——同样断 2 天,导入期起判即高 P、升级最快。
> **淘汰期不报示例(v0.4):** `effective_stage:"淘汰"` → 不开预警条目,`flags:["stage_no_alert:淘汰"]`。
> **unknown 照常报示例(v0.4):** `effective_stage:"unknown", level=base_level(按时长阶梯), flags:["stage_unknown_base_grading"]` ——断货照常预警,不因不知阶段沉默。
> **衰退期降权示例(v0.4):** `base_level:"P1", level:"P2", effective_stage:"衰退"` ——控库存止损期,断货降权。

> 冻结示例:`state:"frozen", freeze_reason:"store_suspended", flags:["frozen:store_suspended:ST-SH-00388"]` ——期间无任何推送。
> 解冻示例:`state:"active", flags:["unfrozen:暂停47天"], duration_days:50, escalation_count:按50天阶梯补升, 通知。`
> 关店解除示例:`state:"resolved", resolution_reason:"store_closed", resolution_duration:12 ——不入恢复统计。`

---

## 7. 等级表 + 通知路由(同 v0.2,引用不重抄)

§7.1 等级判定表与降级/阶梯规则、§7.2 通知路由表均沿用 v0.2,仅两处变化:
1. 路由表中 advisor/supervisor 的**具体人选取 L0-04 当前版**(收到变更扇出即换);
2. P3 行新增一类:**冻结/解冻状态通知**(只到督导,知情性质)。

### 7.3 生命周期阶段权重表(v0.4,占位待校准;阶段只加权不改断货事实)

| effective_stage | 严重度加权 | 升级速度 | 报不报 |
|---|---|---|---|
| 导入 | **起判即高**(base 拉到 ≥ `<导入起判线>`,如 P1/P0) | **最快**(阶梯天数 ×`<导入加速系数>`<1) | 报(投 60-80% 费,断货=钱白烧) |
| 成长 | P 级 **+1 档** | 加速(×`<成长加速系数>`) | 报(断货打断复制势头) |
| 成熟 | **不加权**(原阶梯) | 原速 | 报(丢单可控) |
| 衰退 | P 级 **−1 档** | 减速 | 报但降权(控库存止损期,断货未必坏) |
| 焕新 | **按成长口径** | 按成长 | 报(重启期断货=焕新失败) |
| 淘汰 | — | — | **不报**(stage_no_alert;本就清退) |
| unknown | **不加权**(基础阶梯) | 原速 | **照常报**(stage_unknown_base_grading;断货是硬事实,不沉默) |

> 加权后 P 级仍封顶 P0;阶段权重只调 active 条目的 level 与升速,**不碰四态机/解除**。系数全占位,回测校准。

---

## 8. HITL 卡点 —— 本节点【无】(落地在 L0-08)

本节点只发通知与回写台账,无不可逆动作,**故无 HITL**。carry(大额/疑似窜货)原样透传,真正的停机在 **L0-08 §7.1 分流表**——v0.3 起这条链路已闭环:L0-01 打标 → 本节点 carry → L0-08 必停。本节点若裁决或吞掉 carry,等于替 L0-08 的 HITL 拍板——禁止。

---

## 9. References

### 9a. SKU 战略权重 — 同 v0.2(经 MCP)。

### 9b. 状态机参数(v0.3 改)

| 参数 | 值 | 说明 |
|---|---|---|
| `<升级天数N>` | <填,如 3> | 日历天阶梯步长 |
| ~~`<静默天数M>`~~ | **废弃** | **改为 store_M:按店从 L0-04 §9b 读**(A≈7+缓冲 / B≈14+缓冲 / C≈30+缓冲) |
| 台账保留期 | <填,如 90 天> | resolved 归档窗口 |

### 9c. 术语表(v0.3 增补)

| 术语 | 含义 | 处理 |
|---|---|---|
| 四态机 | active / frozen / resolved(三种 reason) | 跃迁才通知 |
| frozen:store_suspended | 店暂停导致的冻结(L0-04 定义,本节点吸收) | 不升不解不通知不判 stale;解冻补算补升 |
| resolution_reason | normal / store_closed / store_suspended_then_closed | **恢复统计只计 normal** |
| store_M | 店级静默天数 | 从 L0-04 读,随店级变更扇出即时重算 |
| replenishment | L0-08 订单回执跟踪 | 只作素材,不动状态 |
| **阶段加权(v0.4)** | 严重度/升速按 effective_stage 调 | **只动 P 级与升速,不改断货事实、不碰四态机** |
| **stage_no_alert(v0.4)** | 淘汰期不预警 | 本就清退,不开条目 |
| **stage_unknown_base_grading(v0.4)** | 阶段未知按基础阶梯照常报 | 与 L1-03 unknown 刻意相反:漏报比误报危险 |
| (其余沿用 v0.2:跃迁/日历天/缺席/stale/疑似缺货/carry) | | |

### 9d. 踩坑记录(v0.3 增补;v0.2 的 9 条保留不重抄)

- ❌(v0.3)店暂停合作,预警挂着继续阶梯升级,P0 通知发给一家没人巡的店 → ✅ frozen 态:不升不解不通知不判 stale。
- ❌(v0.3)解冻时把冻结期从 duration 里扣掉 → 断了 50 天的货按 3 天算,等级虚低 → ✅ 冻结期计入持续时长,解冻按日历天补算补升。
- ❌(v0.3)关店解除被计进"平均恢复时长" → 指标被拉好看 → ✅ resolution_reason 三分,统计只计 normal。
- ❌(v0.3)L0-08 回执"已到货"被当成恢复直接解除 → 货在仓没上架,货架还空着 → ✅ 回执只写跟踪,解除仍只认 L0-01 normal。
- ❌(v0.3)B 级店用全局 M=7 天天误报 stale → ✅ store_M 按店从 L0-04 读;店级变更扇出即时重算。
- ❌(v0.4,值得记)**导入期断货按成熟期时长阶梯判**:刚点亮的新品被当老品慢慢升级,P2 起步一天一天爬,等升到 P0 该品的导入费(60-80%)已经烧光、新品在货架上死了 → ✅ 导入期起判即高 P、升级最快(§7.3)。新品断货是"前功尽弃",不是"丢几单"。
- ❌(v0.4)阶段判不出(unknown)就不报断货 → 漏报真实断货,比误报致命 → ✅ unknown 按基础阶梯照常报(与 L1-03 unknown 不判级刻意相反:断货是硬事实)。
- ❌(v0.4)用阶段去改"是否断货"(如衰退期把断货判成不算断) → 阶段污染了事实 → ✅ 断货事实只认 L0-01,阶段只加权严重度。
- _(后续迭代继续往下加)_

---

## 10. Scripts — 四态机 / 校验(出件前必跑;v0.2 的等级/阶梯/日历天函数沿用,只列增量)

```python
RESOLUTION_REASONS = {"normal", "store_closed", "store_suspended_then_closed"}
RECOVERY_STAT_REASONS = {"normal"}            # 恢复时长统计只计 normal

def lifecycle_event(ledger, store, event, now, N):
    """v0.3: 处理 L0-04 生命周期扇出,作用于该店全部预警。"""
    actions = []
    for key, a in ledger.items():
        if key[0] != store: continue
        if event == "suspended" and a["state"] == "active":
            actions.append({"key": key, "action": "freeze", "freeze_reason": "store_suspended"})
        elif event == "restore" and a["state"] == "frozen":
            dur = calendar_days(a["since"], now)               # 冻结期计入
            actions.append({"key": key, "action": "unfreeze",
                            "duration_days": dur,
                            "to_escalation_count": dur // N})   # 一次补升到位
        elif event == "closed":
            reason = "store_suspended_then_closed" if a["state"] == "frozen" else "store_closed"
            if a["state"] != "resolved":
                actions.append({"key": key, "action": "resolve", "resolution_reason": reason})
    return actions

def validate_v03(out, ledger_before, now, N):
    errs = validate(out, ledger_before, now, N)    # 沿用 v0.2 全部断言
    # frozen 三禁:不升不解不通知
    if out.get("state") == "frozen":
        if out.get("escalation_count", 0) != ledger_before.get((out["store"], out["sku"]), {}).get("escalation_count", 0):
            errs.append(f"frozen_escalated:{out['sku']}")
        if out.get("resolution_reason"):
            errs.append(f"frozen_resolved:{out['sku']}")
        if out.get("notify"):
            errs.append(f"frozen_notified:{out['sku']}")
        if any(f.startswith("stale:") for f in out.get("flags", [])):
            errs.append(f"frozen_marked_stale:{out['sku']}")
    # 解冻补算可重放
    if any(f.startswith("unfrozen") for f in out.get("flags", [])):
        if out.get("duration_days") != calendar_days(out["since"], now):
            errs.append(f"unfreeze_duration_wrong:{out['sku']}")  # 冻结期必须计入
    # resolved 必带合法 reason;非 normal 不入恢复统计
    if out.get("state") == "resolved":
        if out.get("resolution_reason") not in RESOLUTION_REASONS:
            errs.append(f"resolved_without_reason:{out['sku']}")
        if out.get("_in_recovery_stats") and out["resolution_reason"] not in RECOVERY_STAT_REASONS:
            errs.append(f"non_normal_in_recovery_stats:{out['sku']}")
    # 回执不动状态
    if out.get("_trigger") == "l0_08_receipt":
        before = ledger_before.get((out["store"], out["sku"]), {})
        if out.get("state") != before.get("state") or \
           out.get("escalation_count") != before.get("escalation_count"):
            errs.append(f"receipt_changed_state:{out['sku']}")
    # store_M 必须来自 L0-04
    if out.get("state") == "active" and not out.get("_store_M_src", "").startswith("L0-04"):
        errs.append(f"store_M_not_from_L0_04:{out['sku']}")
    return errs

def validate_v04(out, ledger_before, now, N):
    errs = validate_v03(out, ledger_before, now, N)   # 沿用 v0.2/v0.3 全部断言
    stage = out.get("effective_stage")
    NO_ALERT_STAGES = {"淘汰"}
    # 断货事实判定不得混入阶段:type 只来自 L0-01 status
    if out.get("_oos_decided_by_stage"):
        errs.append(f"stockout_fact_polluted_by_stage:{out.get('sku')}")  # 阶段污染了"是否断货"
    # 淘汰期不得预警
    if stage in NO_ALERT_STAGES and out.get("state") == "active" and out.get("level"):
        if "stage_no_alert" not in str(out.get("flags", [])):
            errs.append(f"clearance_stage_still_alerting:{out.get('sku')}")  # 淘汰期仍预警
    # unknown 必须照基础阶梯预警,不得因无阶段而沉默
    if stage == "unknown":
        if out.get("state") == "active" and not out.get("level"):
            errs.append(f"unknown_stage_silenced:{out.get('sku')}")          # 漏报
        if out.get("level") != out.get("base_level"):
            errs.append(f"unknown_stage_weighted:{out.get('sku')}")          # unknown 不应加权
        if "stage_unknown_base_grading" not in str(out.get("flags", [])):
            errs.append(f"unknown_without_base_flag:{out.get('sku')}")
    # 加权可溯源:level≠base_level 时必须有 stage_weighted 痕迹 + grading_stage
    if out.get("level") != out.get("base_level") and stage not in ("unknown", None):
        if not any(f.startswith("stage_weighted") for f in out.get("flags", [])):
            errs.append(f"weight_without_trace:{out.get('sku')}")
        if out.get("grading_stage") != stage:
            errs.append(f"grading_stage_mismatch:{out.get('sku')}")
    # 四态机不受阶段影响:阶段加权不得改 state
    if out.get("_stage_changed_state"):
        errs.append(f"stage_altered_state_machine:{out.get('sku')}")
    return errs
```

---

## 11. 评测起手式(v0.2 的 a01–a12 + v0.3 的 a13–a17 全部保留;v0.4 新增 5 条)

```json
[
 {"id":"a13",
  "input":{"l0_04_event":{"store":"ST-SH-00388","event":"suspended"},
           "ledger":{"ST-SH-00388|6MX-JDX":{"state":"active","level":"P1","type":"断货","since":"2026-06-10","escalation_count":0}}},
  "expect":{"state":"frozen","freeze_reason":"store_suspended","no_notify_during_freeze":true,
            "no_escalation":true,"no_stale_flag":true},
  "tags":["v0.3-①a:店暂停→该店预警全冻结,不升不解不通知不判stale"]},

 {"id":"a14",
  "input":{"now":"2026-08-01T10:00:00+08:00",
           "l0_04_event":{"store":"ST-SH-00388","event":"restore"},
           "ledger":{"ST-SH-00388|6MX-JDX":{"state":"frozen","level":"P1","since":"2026-06-12T10:00:00+08:00","escalation_count":0}},
           "params":{"N":3}},
  "expect":{"state":"active","flags_contains":"unfrozen","duration_days":50,
            "escalation_count":16,"level":"P0","notified":true},
  "tags":["v0.3-①b:解冻→冻结期计入时长,日历天补算,阶梯一次补升到位(封顶P0)并通知"]},

 {"id":"a15",
  "input":{"l0_04_event":{"store":"ST-SH-00301","event":"closed"},
           "ledger":{"ST-SH-00301|6MX-TJ-380":{"state":"active","level":"P0","since":"2026-06-01"}}},
  "expect":{"state":"resolved","resolution_reason":"store_closed",
            "not_in_recovery_stats":true,"notify_mentions":"门店已关闭"},
  "tags":["v0.3-②:关店解除→reason=store_closed,不入恢复时长统计;frozen中关店→store_suspended_then_closed"]},

 {"id":"a16",
  "input":{"now":"2026-06-12","stores":[
            {"store":"A级店","grade":"A","store_M_from_L0_04":9,"silent_days":10,
             "ledger_active":true},
            {"store":"B级店","grade":"B","store_M_from_L0_04":17,"silent_days":10,
             "ledger_active":true}]},
  "expect":{"A级店":"stale(10>9)","B级店":"不stale(10<17),正常等待巡店"},
  "tags":["v0.3-③:store_M 按店从 L0-04 读——同样静默10天,A店该叫、B店不误报"]},

 {"id":"a17",
  "input":{"l0_08_receipt":{"store":"大润发徐汇店","sku":"6MX-JDX","order_id":"RO-031","order_status":"confirmed","eta":"2026-06-15"},
           "ledger":{"大润发徐汇店|6MX-JDX":{"state":"active","level":"P0","since":"2026-06-12","escalation_count":0}}},
  "expect":{"replenishment_written":true,"state_still":"active","escalation_clock_unaffected":true,
            "not_resolved":true,"push_may_mention_eta":true},
  "tags":["v0.3-④:L0-08回执→只写跟踪可入文案;到货≠上架,不解除不冻结时钟,解除仍等L0-01 normal"]},

 {"id":"a18",
  "input":{"sku":"6MX-NEW","oos_days":3,
           "case_导入":{"effective_stage":"导入"},"case_成熟":{"effective_stage":"成熟"},
           "base_level_by_duration":"P2(断3天)"},
  "expect":{"oos_fact_same":"两例都是断货(L0-01 状态,与阶段无关)",
            "case_导入":{"base_level":"P2","level":"≥P1/P0","flags_contains":"stage_weighted","fast_escalation":true},
            "case_成熟":{"base_level":"P2","level":"P2","no_weighting":true}},
  "tags":["v0.4:同样断3天,导入起判即高P+升级最快 vs 成熟按原阶梯——断货事实同,严重度不同"]},

 {"id":"a19",
  "input":{"sku":"6MX-NEW","effective_stage":"导入","oos_days":1,"base_level":"P2"},
  "expect":{"level":"≥导入起判线(如P1/P0)","escalation_speed":"×导入加速系数<1",
            "detail_contains":"导入期断货,严重度上调",
            "rationale":"投60-80%费,断货=钱白烧,不能慢慢升"},
  "tags":["v0.4:导入期断货起判即高P,不等时长慢慢爬"]},

 {"id":"a20",
  "input":{"sku":"6MX-EOL","effective_stage":"淘汰","l0_01_status":"out_of_stock"},
  "expect":{"no_alert_entry":true,"flags_contains":"stage_no_alert",
            "error_if_alerting":"clearance_stage_still_alerting",
            "note":"本就清退,断货不报"},
  "tags":["v0.4:淘汰期断货不预警(stage_no_alert);仍报→报错"]},

 {"id":"a21",
  "input":{"sku":"6MX-X","effective_stage":"unknown","oos_days":4,"base_level":"P1"},
  "expect":{"level":"P1(=base_level,不加权)","alert_fired":true,
            "flags_contains":"stage_unknown_base_grading",
            "error_if_silenced":"unknown_stage_silenced",
            "contrast":"与L1-03 unknown不判级刻意相反——断货是硬事实,漏报比误报危险"},
  "tags":["v0.4:unknown断货照基础阶梯正常报,不因不知阶段沉默"]},

 {"id":"a22",
  "input":{"sku":"6MX-OLD","effective_stage":"衰退","oos_days":5,"base_level":"P1"},
  "expect":{"level":"P2(降一档)","escalation":"减速",
            "rationale":"控库存止损期,断货未必坏",
            "fact_unchanged":"仍判断货,只是降权"},
  "tags":["v0.4:衰退期断货降权(P级−1档/升级减速),事实不变"]}
]
```

**新增打分维度:** 16. 同断货不同阶段不同 P(a18);17. 导入起判即高P+升速(a19);18. 淘汰不报(a20);19. unknown 照基础报不沉默(a21);20. 衰退降权(a22)。**全程不变:断货事实判定(§10 stockout_fact_polluted_by_stage 守)、四态机/解除(stage_altered_state_machine 守)。**

---

## 待填变量(v0.2 基础上)
- ~~`<静默天数M>`~~ 废弃 → 改为 L0-04 §9b 缓冲系数(两节点共同定)
- L0-04 生命周期扇出与 L0-08 回执的消息通道(经 MCP / 消息队列)
- **§7.3 阶段权重系数(v0.4):`<导入起判线>` / `<导入加速系数>` / `<成长加速系数>` / 各阶段 P 级调档 — 回测校准**
- **`effective_stage` 来源 —《SKU 生命周期阶段判定》契约,按 sku×scope×period(只读)(v0.4)**
- 其余同 v0.2(N、台账存储、战略权重、通知通道)
