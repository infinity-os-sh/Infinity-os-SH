---
name: store-master-data
description: 把建档/季度复核/变更时采集的门店信息(美顾实地填报 + 门头/货架全景照)归一成标准门店档案 JSON,并管理档案全生命周期(新建/变更/暂停/恢复/停用,SCD-2 版本化带生效日期)。凡涉及"门店建档、门店档案、新店录入、门店信息变更、店级调整、暂停合作、关店/停用、门店主数据、季度复核、巡店频次配置、货架规格登记"的输入都用本 Skill。它是门店档案的真相源(L0-04)——低频缓变档案节点,不是高频日报;L5-01 的覆盖分母、L0-07 的巡店节奏、L0-02 的货架规格与陈列位清单、L0-08 的店型 SKU 组合全部读它。
version: v0.2
owner: <填:负责人/团队>
type: Workflow / Skill(主数据维护节点 · 缓变维度 SCD · L0-04)
status: 粗糙版 v0.2,待真实数据迭代
upstream: 美顾建档/复核填报(表单+门头照+货架全景照)/ 渠道与店级枚举主数据 / 地理编码服务(经 MCP)
downstream: L5-01(应覆盖店数+区域层级)/ L0-07(巡店节奏→店级M)/ L0-02(货架规格+陈列位清单)/ L0-08(店型SKU组合)/ 门店档案库(回写)
backlog: L0-04
---

# 门店基础数据采集 Skill v0.2 · 主数据节点(L0-04)

> 本 Skill 依据《INFINITY OS · Agent 设计标准 v1.0》编写。
> 它是一个 **Workflow**(写死轨道)——但和三个高频采集源性质不同:这是**缓变档案(SCD)节点**,低频(建档/季度复核/变更触发)、有版本、有生命周期。要的是**准、不重、不丢历史**。

> **v0.2 变更摘要:** ①补全 `suspended`(暂停合作)级联语义——分母剔除但单独计数、预警冻结 `frozen:store_suspended`、暂停不排巡、恢复回补解冻,不再是幽灵状态;②**update 敏感字段也过查重闸门**(改名/改址撞现存店 → 停),堵住绕行;③`effective_from` **倒填拒绝**——早于或等于当前版生效日的变更不出件,转人工治理。

---

## 1. 角色与目标 + 谁在等本节点的字段【先读这个】

你是门店档案的**真相源**。一切"这家店是什么样的店"的问题只有你说了算。

**下游字段消费表(改任何字段前先查这张表,§7 扇出由它驱动):**

| 下游 | 读什么字段 | 用来干什么 |
|---|---|---|
| L5-01 | `status==active` 店数、`region/city` 层级 | coverage 分母、by_region 聚合;`suspended` 单独计数(v0.2) |
| L0-07 | `store_grade` → 巡店节奏;`status` 变更 | **店级 `<静默天数M>`**(A 周巡 M≈7;B 双周巡 M≈14+缓冲)——M 不是全局常量,**按店读本节点**(对 L0-07 v0.2 的契约细化);suspended → 预警冻结(v0.2) |
| L0-02 | `shelf_spec`(节数/层数)、`display_slots`(端架/堆头清单) | 排面换算基准、segment 界定、选拍清单 |
| L0-08(未来) | `sku_mix`(Flagship/Core/Volume 配置) | 该店该有什么货、补什么货 |

- 你管**档案与版本**,不管日常库存/陈列/竞品(那是 L0-01/02/05 的事件流)。
- 变更不覆盖历史:下游趋势分析要历史口径(上月的分母得用上月的档案)。
- 拿不准的不要自动合并、不要猜:疑似重复、地理不符、倒填生效日 → 停、标记、转人工。

---

## 2. 输入(Input)

| 来源 | 形式 | 说明 |
|---|---|---|
| 建档/复核表单 | 结构化字段 + 口语备注 | 美顾实地填报 |
| 门头照 / 货架全景照 | 照片 | 视觉辅助核对店名、货架规格、陈列位 |
| 触发类型 | `create` / `update` / `suspend` / `restore` / `close` / `review`(季度复核) | 决定走哪条分支(v0.2 补 suspend/restore) |
| 渠道/店级枚举 | 主数据(经 MCP) | 与合纵 7 棒对齐(§9a) |
| 地理编码服务 | 经 MCP | 地址 ↔ GPS 互验 |
| 现有档案库 | 全量当前版 | 查重与版本化基准 |

---

## 3. 参数定义(Parameters)

| 字段 | 类型 | 允许值 / 说明 |
|---|---|---|
| `store_id` | string | **终身不变的唯一编码**;查重通过后才分配,版本变更不换号 |
| `store_name` | string | 归一后店名(连锁名+分店名规范化,查重键之一;**update 改它须重过查重 v0.2**) |
| `channel_type` | enum | `KA大卖场` / `社区超市` / `会员店` / `便利店` / `批发流通` / `餐饮` / `电商前置仓`(与 7 棒对齐,§9a) |
| `store_grade` | enum | `A` / `B` / `C`(决定巡店频次,§9b) |
| `region` / `city` / `trade_zone` | string | 区域-城市-商圈三级(挂组织主数据) |
| `address` / `gps` | string / {lat,lng} | 地址与坐标互验;不符 → `geo_mismatch`;**update 改它须重过查重(v0.2)** |
| `shelf_spec` | object | `{main_sections, layers, notes}` 主货架节数/层数(L0-02 排面换算基准) |
| `display_slots[]` | object[] | `{type: 端架/堆头/收银区/主通道, count}` 陈列位清单(L0-02 选拍依据) |
| `sku_mix` | object | `{Flagship:[], Core:[], Volume:[]}` 本店 SKU 组合 |
| `traffic_tier` | enum | `high` / `mid` / `low` 客流档位 |
| `advisor_id` / `supervisor_id` | string | 责任美顾 / 督导 |
| `status` | enum | `active` / `suspended`(暂停合作,**完整级联见 §4 Step 4b,v0.2**)/ `closed` |
| `version` | number | 版本号,从 1 起 |
| `effective_from` / `effective_to` | string / string\|null | **SCD-2 版本链**:当前版 effective_to = null;变更时旧版封口、新版开口;**新版 effective_from 必须 > 当前版 effective_from,倒填拒绝(v0.2)** |
| `change_set[]` | string[] | 本版相对上版改了哪些字段(扇出依据) |
| `flags` | string[] | `dup_suspect:*` / `geo_mismatch:*` / `enum_unresolved:*` / `backdated_effective_from:*` |
| `fanout` | string[] | 按 §7 字段驱动生成 |

---

## 4. 处理流程(Steps · 链式:采集 → 归一 → 查重闸门 → 版本化 → 出件)

### Step 1 — 采集解析
从表单 + 口语备注 + 照片抽全字段;门头照辅助核对店名,货架全景照辅助核对 shelf_spec / display_slots。

### Step 2 — 归一
- 店名规范化:连锁主名 + 分店名(如"大润发 杨浦店"→"大润发杨浦店"),去口语后缀("那家大润发")。
- 渠道/店级/客流档:归一到 §9 枚举。**【闸门】归不进枚举 → 停,标 `enum_unresolved:{字段}`,不许自创类目**(类目乱了,7 棒对不上)。
- 地理互验:地址经地理编码 → 坐标,与上报 GPS 距离 > `<地理容差>`(如 500m)→ 标 `geo_mismatch:{store_name}` 复核,**档案照常出件**(地理不符不阻塞建档,但必须留迹)。

### Step 3 — 查重闸门(v0.2 扩展:create 与敏感字段 update 都过)【本节点的命门之一】
- 查重键:**归一店名 + 归一地址**(双键)对现有档案库模糊匹配。
- **create**:对全库查重,命中规则写死:
  - 同名同址 → **重复**,不建新档,返回既有 store_id 提示走 update。
  - **同址异名**(店名对不上但坐标/地址重合)→ 疑似换牌/录入差异 → **停**,标 `dup_suspect:同址异名:{新名}vs{旧名}`,转人工确认。
  - **同名异址**(连锁同分店名但地址不同)→ 疑似搬迁/重复录入 → **停**,标 `dup_suspect:同名异址`,转人工确认。
- **(v0.2)update 涉及 `store_name` / `address` / `gps` 任一字段** → 必须对**全库(排除自身 store_id)**重跑同一套查重:
  - 命中同址异名 / 同名异址 → **停**,标 `dup_suspect:update_collision:{自身id}vs{命中id}`,转人工,**本次变更不出件、不产新版**。
  - 改名/改址绕过 create 闸门撞上现存店,和重复建档同样污染分母——闸门必须双向把。
- **严禁自动合并**:合并是不可逆的数据治理动作,只能人来。本节点只停 + 标记。

### Step 4 — 版本化(SCD-2)【命门之二】
- **(v0.2)生效日闸门(一切产新版的分支先过)**:新版 `effective_from` ≤ 当前版 `effective_from` → **拒绝出件**,标 `backdated_effective_from:{store_id}:{新日}vs{现日}`,转人工。
  - **小于** = 倒填,版本链会重叠——历史重写是治理动作,不归本节点;
  - **等于** = 零长度版本,同样拒绝(同日二次变更应合并为一次提交,或由治理通道处理)。
- `create`(查重通过):分配新 store_id,version=1,effective_from=生效日,effective_to=null。
- `update` / `review` 有变化(且过 Step 3 查重 + 生效日闸门):**不覆盖**——旧版 `effective_to = 新版 effective_from`(封口归档),新版 version+1、effective_to=null;`change_set` 列出变更字段。
- `review` 无变化:不产新版,只记复核时间(档案"心跳")。

**(v0.2)Step 4b — suspended 完整生命周期(不许当幽灵状态):**
- **suspend(active→suspended)**:产新版 `status:suspended` + effective_from,扇出三路(§7):
  1. **L5-01**:剔出覆盖分母(自生效日),但**单独计数 `suspended_stores`**——暂停 ≠ 关死,看板要能看到"暂停了几家、随时可能回来"。
  2. **L0-07**:该店 active 预警冻结为 **`frozen:store_suspended`**——不升级(暂停期没人巡店,没有事实)、不解除(货的状态未知)、不通知(别拿冻结预警轰炸人)。
  3. **巡店排班**:暂停期不排该店巡店任务。
- **restore(suspended→active)**:产新版 `status:active` + effective_from,扇出两路:
  1. **L5-01**:分母回补(自生效日),`suspended_stores` 减计。
  2. **L0-07**:冻结预警**解冻**——按日历天从原 since 补算 duration(冻结期计入持续时长,货大概率一直断着),按阶梯一次补升到位并通知。
- `close`:产新版 `status:closed` + effective_from;**旧版本链全部保留**。suspended 店也可直接 close(级联同 close)。
- **store_id 在任何变更中不换号**——下游全靠它串历史。

### Step 5 — 出件与扇出
按 §6 schema 输出 → 跑 §10 校验(版本链完整性/查重/扇出配对/生效日)→ 按 §7 **字段驱动扇出**变更通知 → 回写档案库。

---

## 5. 规则与强度(RFC2119)

| 强度 | 规则 |
|---|---|
| **MUST** | create 必须先过查重闸门;同址异名/同名异址必须停标 `dup_suspect` 转人工;**严禁自动合并、严禁带疑建档**。 |
| **MUST** | **update 涉及 store_name / address / gps 任一字段必须对全库(排除自身)重过查重**;命中必须停标 `dup_suspect:update_collision` 且本次变更不出件。**(v0.2)** |
| **MUST** | 一切变更走 SCD-2:旧版封口归档、新版带 effective_from;**严禁覆盖或删除历史版本**;store_id 终身不换。 |
| **MUST** | **新版 effective_from ≤ 当前版 effective_from 必须拒绝出件**,标 `backdated_effective_from` 转人工;历史重写归治理通道,不归本节点。**(v0.2)** |
| **MUST** | **suspended 必须完整级联**:L5-01 剔分母+单独计数、L0-07 预警冻结 `frozen:store_suspended`(不升不解不通知)、暂停不排巡;restore 必须回补分母+解冻补算。**(v0.2)** |
| **MUST** | 档案变更必须按 §7 字段驱动表扇出:店级变→L0-07;陈列位/货架规格变→L0-02;status 变 closed→L5-01 + L0-07。**改了不通知 = 下游拿旧档跑错**。 |
| **MUST** | 渠道/店级归不进枚举必须停标 `enum_unresolved`,不许自创类目(与 7 棒对齐是硬约束)。 |
| **MUST** | `close` 扇出给 L0-07 时必须注明:该店 active 预警按 **`resolved:store_closed`** 关闭(第三种解除原因),**不得**计入正常恢复时长统计。 |
| **SHOULD** | GPS 与地址不符应标 `geo_mismatch` 复核(不阻塞出件);门头照应留档(查重佐证)。 |
| **SHOULD** | 季度复核应全字段过一遍;无变化也应记复核时间(档案心跳,防档案僵死)。 |
| **MAY** | 商圈备注、竞店环境等软信息可记 notes,非核心必需项。 |

---

## 6. 输出(Output · Artifact 契约)

档案库与下游唯一认这份结构。字段缺失用 `null`,不省略键。(示例:店级 B→A 的 update)

```json
{
  "store_id": "ST-SH-00420",
  "store_name": "大润发徐汇店",
  "channel_type": "KA大卖场",
  "store_grade": "A",
  "region": "华东", "city": "上海", "trade_zone": "徐汇滨江",
  "address": "上海市徐汇区XX路100号", "gps": { "lat": 31.17, "lng": 121.43 },
  "shelf_spec": { "main_sections": 6, "layers": 5, "notes": "酱油主货架在3-4节" },
  "display_slots": [
    { "type": "端架", "count": 2 }, { "type": "堆头", "count": 1 }, { "type": "收银区", "count": 1 }
  ],
  "sku_mix": { "Flagship": ["6MX-JDX"], "Core": ["6MX-TJ-380"], "Volume": ["6MX-QY-500"] },
  "traffic_tier": "high",
  "advisor_id": "MG-0420", "supervisor_id": "SV-011",
  "status": "active",
  "version": 3,
  "effective_from": "2026-06-12",
  "effective_to": null,
  "change_set": ["store_grade:B→A"],
  "flags": [],
  "fanout": ["L0-07:巡店节奏变更:ST-SH-00420:B→A(店级M随之变)"]
}
```

> 关店示例:`status:"closed", change_set:["status:active→closed"], fanout:["L5-01:覆盖分母变更:ST-SH-00420 自2026-07-01剔除", "L0-07:关店处理:ST-SH-00420 active预警按 resolved:store_closed 关闭"]`
> **(v0.2)暂停示例**:`status:"suspended", change_set:["status:active→suspended"], fanout:["L5-01:分母剔除+suspended_stores计数:ST-SH-00388 自2026-06-15", "L0-07:预警冻结:ST-SH-00388 按 frozen:store_suspended 处理", "巡店排班:暂停:ST-SH-00388"]`
> **(v0.2)恢复示例**:`status:"active", change_set:["status:suspended→active"], fanout:["L5-01:分母回补:ST-SH-00388 自2026-08-01", "L0-07:预警解冻:ST-SH-00388 按日历天补算并补升"]`
> 历史查询口径:给定日期 d,取该 store_id 满足 `effective_from ≤ d < effective_to(或 null)` 的那一版。

---

## 7. 扇出规则(字段驱动,写死)

| 变更字段(change_set 命中) | 通知下游 | 内容 |
|---|---|---|
| `store_grade` | L0-07 | 巡店节奏变更 → 该店 `<静默天数M>` 重算(§9b) |
| `display_slots` / `shelf_spec` | L0-02 | 选拍清单 / 排面换算基准变更 |
| `sku_mix` | L0-08(上线后) | 店型配置变更 |
| `region` / `city` | L5-01 | 区域聚合归属变更(自 effective_from) |
| `status → closed` | **L5-01 + L0-07** | 覆盖分母剔除(自生效日)+ active 预警按 `resolved:store_closed` 关闭 |
| **`status → suspended`(v0.2)** | **L5-01 + L0-07 + 巡店排班** | 分母剔除但 `suspended_stores` 单独计数 + 预警冻结 `frozen:store_suspended`(不升不解不通知)+ 暂停不排巡 |
| **`status: suspended → active`(v0.2)** | **L5-01 + L0-07** | 分母回补(自生效日)+ 冻结预警解冻:按日历天从原 since 补算并按阶梯补升、通知 |
| `advisor_id` / `supervisor_id` | L0-07 通知路由 | 预警通知对象换人 |
| 新建(create) | L5-01 | 覆盖分母 +1(自生效日) |

> 没命中表里任何行的变更(如 notes)→ 不扇出。扇出消息一律带 store_id + effective_from,下游按日期生效,不立刻回溯历史。

---

## 8. HITL 卡点 —— 本节点【无】

本节点建档/变更**可通过版本链回退**,非不可逆动作,**故无 HITL**。

- 这不是漏写。按《Agent 设计标准 §6》,HITL 卡在"高风险不可逆动作执行前"。
- **疑似重复转人工确认是数据治理流程,不是 HITL 卡点**(参照 L0-05 §8 对主数据审批的同一区分):本节点照常停止该条建档并标记,不停机等批;人工确认走档案治理通道,归 <档案Owner>。**(v0.2)倒填生效日转人工同理**——历史重写归治理通道。
- 唯一接近不可逆的是**人工合并重复档案**——那发生在治理通道里、由人执行,本节点根本无权合并(§5 MUST 已禁)。

---

## 9. References

### 9a. 渠道类型枚举(与合纵 7 棒对齐;接组织主数据替换)

| 渠道枚举 | 对应棒 |
|---|---|
| KA大卖场 / 会员店 | <填:对应棒> |
| 社区超市 / 便利店 | <填:对应棒> |
| 批发流通 | <填:对应棒> |
| 餐饮 | <填:对应棒> |
| 电商前置仓 | <填:对应棒> |

> 枚举与棒的映射是硬约束:类目自创会让渠道报表对不上 7 棒口径。

### 9b. 店级 × 巡店频次表(L0-07 的店级 M 由此推)

| 店级 | 巡店频次 | 建议店级 M(= 频次 × 缓冲系数) |
|---|---|---|
| A | 每周 ≥1 次 | ≈ 7 + 缓冲 |
| B | 每两周 1 次 | ≈ 14 + 缓冲 |
| C | 每月 1 次 | ≈ 30 + 缓冲 |

> L0-07 读本表按店取 M;全局常量 M 已废弃(契约细化,见 §1)。**suspended 店不适用 M**(暂停不排巡,预警已冻结,不判 stale)。

### 9c. 术语表

| 术语 | 含义 | 处理 |
|---|---|---|
| 缓变维度(SCD-2) | 变更不覆盖,版本链带生效区间 | effective_from/to;历史口径可查 |
| 档案心跳 | 复核无变化也记时间 | 防档案僵死(三年没人看过) |
| 同址异名 / 同名异址 | 两类疑似重复 | 停 + dup_suspect,人工确认 |
| update_collision | 改名/改址撞上现存店 | v0.2:update 闸门命中,停转人工 |
| 倒填(backdated) | 新版生效日 ≤ 当前版生效日 | v0.2:拒绝出件,历史重写归治理 |
| resolved:store_closed | 关店导致的预警关闭 | L0-07 第三种解除,不计恢复时长 |
| frozen:store_suspended | 暂停导致的预警冻结 | v0.2:不升不解不通知;恢复时解冻补算 |

### 9d. 踩坑记录(每次撞墙补一条)

- ❌ "大润发杨浦店"和"大润发 杨浦店"建了两个档 → 下游分母 +1,coverage 失真 → ✅ 店名归一 + 双键查重。
- ❌ 店级 B→A 直接改字段覆盖 → 上月趋势用了本月节奏口径 → ✅ SCD-2 版本链,历史不丢。
- ❌ 关店只改了 status,L0-07 那家店的 P0 断货预警挂成永久 stale → ✅ close 必扇出,预警按 resolved:store_closed 关闭。
- ❌ 关店预警被记成"resolved-恢复",平均恢复时长被拉好看 → ✅ 第三种解除原因单列,不进恢复统计。
- ❌ 疑似同店自动合并,把两家真不同的店并成一家 → 不可逆 → ✅ 只停只标,合并归人。
- ❌(v0.2)suspended 只是枚举值没有规则,L5-01 照算分母(coverage 虚低)、L0-07 预警挂到 stale 误报督导 → ✅ Step 4b 完整级联:剔分母单独计数、预警 frozen、不排巡;恢复回补解冻。
- ❌(v0.2)闸门只把 create:一家店 update 改址改成和现存店同址,两档并存分母重复 → ✅ 敏感字段 update 重过查重,update_collision 停转人工。
- ❌(v0.2)变更迟报、生效日倒填到上版之前 → 版本链区间重叠,历史查询同一天命中两版 → ✅ 倒填(含同日)一律拒绝,历史重写走治理通道。
- _(后续迭代继续往下加)_

---

## 10. Scripts — 查重 / 版本链 / 扇出配对(出件前必跑)

```python
CHANNEL_ENUM = {"KA大卖场","社区超市","会员店","便利店","批发流通","餐饮","电商前置仓"}
GRADE_ENUM = {"A","B","C"}
STATUS_ENUM = {"active","suspended","closed"}
SENSITIVE_FIELDS = {"store_name", "address", "gps"}    # v0.2: update 须重过查重的字段
FANOUT_MAP = {   # §7 字段驱动表,改扇出只改这里
    "store_grade":   ["L0-07"],
    "display_slots": ["L0-02"], "shelf_spec": ["L0-02"],
    "sku_mix":       ["L0-08"],
    "region":        ["L5-01"], "city": ["L5-01"],
    "advisor_id":    ["L0-07"], "supervisor_id": ["L0-07"],
}

def dedup_check(new: dict, registry: list, exclude_id: str | None = None) -> list[str]:
    """查重:create 全库;v0.2 update 敏感字段也跑(排除自身 store_id)。"""
    issues = []
    n_name, n_addr = normalize(new["store_name"]), normalize(new["address"])
    for ex in registry:
        if exclude_id and ex["store_id"] == exclude_id:
            continue                                          # update 时排除自身
        same_name = similar(n_name, normalize(ex["store_name"]))
        same_addr = similar(n_addr, normalize(ex["address"])) or \
                    geo_close(new["gps"], ex["gps"])
        if same_name and same_addr:
            issues.append(f"duplicate_existing:{ex['store_id']}")     # create: 走 update,不建新档
        elif same_addr and not same_name:
            tag = "update_collision" if exclude_id else "同址异名"
            issues.append(f"dup_suspect:{tag}:{exclude_id or new['store_name']}vs{ex['store_id']}")
        elif same_name and not same_addr:
            tag = "update_collision" if exclude_id else "同名异址"
            issues.append(f"dup_suspect:{tag}:{exclude_id or new['store_name']}vs{ex['store_id']}")
    return issues

def validate(out: dict, prev_version: dict | None, version_chain: list,
             registry: list) -> list[str]:
    errs = []
    # 枚举
    if out["channel_type"] not in CHANNEL_ENUM: errs.append("enum_unresolved:channel_type")
    if out["store_grade"] not in GRADE_ENUM:    errs.append("enum_unresolved:store_grade")
    if out["status"] not in STATUS_ENUM:        errs.append("bad_status")
    # MUST: SCD-2 版本链完整性
    if prev_version:
        if out["store_id"] != prev_version["store_id"]:
            errs.append("store_id_changed")                       # 终身不换号
        if out["version"] != prev_version["version"] + 1:
            errs.append("version_not_incremented")
        # ---- v0.2: 生效日闸门(倒填/同日拒绝) ----
        if out["effective_from"] <= prev_version["effective_from"]:
            errs.append(f"backdated_effective_from:{out['store_id']}:"
                        f"{out['effective_from']}vs{prev_version['effective_from']}")
        if prev_version.get("effective_to") != out["effective_from"]:
            errs.append("version_chain_gap")                      # 旧版封口必须=新版开口
    if out.get("effective_to") is not None:
        errs.append("current_version_must_be_open")               # 出件的是当前版
    for i in range(1, len(version_chain)):                        # 历史不丢不覆盖
        if version_chain[i-1].get("effective_to") is None:
            errs.append(f"history_version_unsealed:v{version_chain[i-1]['version']}")
    # ---- v0.2: update 敏感字段查重 ----
    changed_fields = {ch.split(":", 1)[0] for ch in out.get("change_set", [])}
    if prev_version and changed_fields & SENSITIVE_FIELDS:
        hits = dedup_check(out, registry, exclude_id=out["store_id"])
        if hits and not any(f.startswith("dup_suspect:update_collision")
                            for f in out.get("flags", [])):
            errs.append(f"update_collision_unflagged:{out['store_id']}")
        if any(f.startswith("dup_suspect:update_collision") for f in out.get("flags", [])):
            errs.append("emitted_despite_update_collision")       # 命中即不出件,出了就是错
    # MUST: change_set ↔ 扇出配对(字段驱动)
    for ch in out.get("change_set", []):
        field = ch.split(":", 1)[0]
        for target in FANOUT_MAP.get(field, []):
            if not any(f.startswith(target) for f in out.get("fanout", [])):
                errs.append(f"fanout_missing:{field}->{target}")
    # MUST: 关店级联(L5-01 分母 + L0-07 resolved:store_closed)
    if any(ch.startswith("status:") and ch.endswith("closed") for ch in out.get("change_set", [])):
        if not any(f.startswith("L5-01:覆盖分母") for f in out.get("fanout", [])):
            errs.append("close_without_coverage_fanout")
        if not any("resolved:store_closed" in f for f in out.get("fanout", [])):
            errs.append("close_without_alert_closure")
    # ---- v0.2: suspended 级联(三路扇出齐) ----
    if any(ch.endswith("→suspended") for ch in out.get("change_set", [])):
        if not any("suspended_stores" in f for f in out.get("fanout", [])):
            errs.append("suspend_without_separate_count")
        if not any("frozen:store_suspended" in f for f in out.get("fanout", [])):
            errs.append("suspend_without_alert_freeze")
        if not any(f.startswith("巡店排班:暂停") for f in out.get("fanout", [])):
            errs.append("suspend_without_patrol_pause")
    # ---- v0.2: restore 级联(回补 + 解冻齐) ----
    if any(ch.startswith("status:suspended→active") for ch in out.get("change_set", [])):
        if not any("分母回补" in f for f in out.get("fanout", [])):
            errs.append("restore_without_coverage_restore")
        if not any("解冻" in f for f in out.get("fanout", [])):
            errs.append("restore_without_alert_unfreeze")
    # MUST: 疑似重复不得出件为新档
    if any(f.startswith("dup_suspect") for f in out.get("flags", [])) and out.get("version") == 1:
        errs.append("created_despite_dup_suspect")
    # SHOULD: geo 不符留迹
    if out.get("_geo_distance_m", 0) > GEO_TOLERANCE_M and \
       not any(f.startswith("geo_mismatch") for f in out.get("flags", [])):
        errs.append("geo_mismatch_unflagged")
    return errs
```

---

## 11. 评测起手式(Eval Starter)

> 离线建设期做。攒 50 条真实建档/变更/复核记录(含人工标注的重复对),跑本 Skill 打分。先放 10 条种子。

**样例格式:**
```json
{ "id": "...", "input": { "trigger": "create|update|suspend|restore|close|review", "form": {...}, "registry": [...现有档案], "chain": [...该店版本链] }, "expect": { ... }, "tags": ["场景"] }
```

**种子样例(10 条):**
```json
[
 {"id":"m01",
  "input":{"trigger":"create",
           "form":{"store_name":"盒马徐汇日晖港店","channel_type":"会员店","store_grade":"A","address":"上海市徐汇区XX路8号","gps":{"lat":31.18,"lng":121.45},"shelf_spec":{"main_sections":4,"layers":5},"display_slots":[{"type":"端架","count":2}]},
           "registry":[]},
  "expect":{"version":1,"effective_to":null,"store_id_assigned":true,
            "fanout_contains":["L5-01"],"flags":[]},
  "tags":["正常建档:全字段归一,分母+1 扇出 L5-01"]},

 {"id":"m02",
  "input":{"trigger":"create",
           "form":{"store_name":"大润发杨浦新店","address":"上海市杨浦区YY路50号"},
           "registry":[{"store_id":"ST-SH-00301","store_name":"大润发杨浦店","address":"上海市杨浦区YY路50号"}]},
  "expect":{"no_new_store_created":true,"flags_contains":"dup_suspect:同址异名",
            "no_auto_merge":true},
  "tags":["疑似重复该停:同址异名→人工确认,不建不并"]},

 {"id":"m03",
  "input":{"trigger":"update",
           "form":{"store_id":"ST-SH-00420","store_grade":"A"},
           "chain":[{"store_id":"ST-SH-00420","version":2,"store_grade":"B","effective_from":"2026-01-01","effective_to":null}]},
  "expect":{"version":3,"change_set":["store_grade:B→A"],
            "fanout_contains":["L0-07:巡店节奏变更"],
            "prev_version_sealed":"2026-06-12"},
  "tags":["店级变更:扇出 L0-07(店级M重算),旧版封口"]},

 {"id":"m04",
  "input":{"trigger":"close",
           "form":{"store_id":"ST-SH-00388","status":"closed","effective_from":"2026-07-01"}},
  "expect":{"change_set_contains":"status:active→closed",
            "fanout_contains":["L5-01:覆盖分母变更","L0-07:关店处理"],
            "fanout_mentions":"resolved:store_closed"},
  "tags":["关店级联:L5-01 分母剔除 + L0-07 预警按 store_closed 关闭"]},

 {"id":"m05",
  "input":{"trigger":"create",
           "form":{"store_name":"奥乐齐静安店","address":"上海市静安区ZZ路12号","gps":{"lat":30.90,"lng":121.10}},
           "registry":[],"note":"地理编码该地址应在(31.23,121.45),GPS 偏差约40km"},
  "expect":{"flags_contains":"geo_mismatch","emitted":true},
  "tags":["GPS与地址不符:标复核,不阻塞建档"]},

 {"id":"m06",
  "input":{"trigger":"update",
           "form":{"store_id":"ST-SH-00420","display_slots":[{"type":"端架","count":3}]},
           "chain":[{"version":1,"effective_from":"2025-01-01","effective_to":"2026-01-01"},
                    {"version":2,"effective_from":"2026-01-01","effective_to":null}]},
  "expect":{"version":3,"chain_length":3,"v1_untouched":true,"v2_sealed":"2026-06-12",
            "fanout_contains":["L0-02"],
            "history_query":"按2025-06-01查询应返回v1"},
  "tags":["历史版本不被覆盖:SCD-2 链完整,按日期可查旧口径"]},

 {"id":"m07",
  "input":{"trigger":"suspend",
           "form":{"store_id":"ST-SH-00388","status":"suspended","effective_from":"2026-06-15"},
           "chain":[{"store_id":"ST-SH-00388","version":1,"status":"active","effective_from":"2025-03-01","effective_to":null}],
           "ledger_note":"该店在 L0-07 有一条 active P1 断货预警"},
  "expect":{"change_set_contains":"status:active→suspended",
            "fanout_contains":["suspended_stores","frozen:store_suspended","巡店排班:暂停"],
            "not_treated_as_closed":true},
  "tags":["v0.2-①a:暂停三路级联——分母剔除+单独计数、预警冻结不升不解不通知、不排巡;≠关店"]},

 {"id":"m08",
  "input":{"trigger":"restore",
           "form":{"store_id":"ST-SH-00388","status":"active","effective_from":"2026-08-01"},
           "chain":[{"version":1,"status":"active","effective_from":"2025-03-01","effective_to":"2026-06-15"},
                    {"version":2,"status":"suspended","effective_from":"2026-06-15","effective_to":null}],
           "ledger_note":"冻结中的 P1 预警 since=2026-06-10"},
  "expect":{"version":3,"change_set_contains":"status:suspended→active",
            "fanout_contains":["分母回补","解冻"],
            "unfreeze_note":"L0-07 按日历天从 2026-06-10 补算 duration 并按阶梯补升"},
  "tags":["v0.2-①b:恢复——分母回补+预警解冻按日历天补算补升"]},

 {"id":"m09",
  "input":{"trigger":"update",
           "form":{"store_id":"ST-SH-00510","address":"上海市杨浦区YY路50号","gps":{"lat":31.30,"lng":121.52}},
           "chain":[{"store_id":"ST-SH-00510","version":1,"store_name":"华联吉买盛店","address":"上海市杨浦区QQ路9号","effective_from":"2025-05-01","effective_to":null}],
           "registry":[{"store_id":"ST-SH-00301","store_name":"大润发杨浦店","address":"上海市杨浦区YY路50号","gps":{"lat":31.30,"lng":121.52}}]},
  "expect":{"no_new_version":true,"not_emitted":true,
            "flags_contains":"dup_suspect:update_collision:ST-SH-00510vsST-SH-00301"},
  "tags":["v0.2-②:update 改地址撞上现存店→停转人工,本次变更不出件,闸门双向把"]},

 {"id":"m10",
  "input":{"trigger":"update",
           "form":{"store_id":"ST-SH-00420","store_grade":"B","effective_from":"2026-03-01"},
           "chain":[{"store_id":"ST-SH-00420","version":3,"effective_from":"2026-06-12","effective_to":null}]},
  "expect":{"rejected":true,"no_new_version":true,
            "flags_contains":"backdated_effective_from:ST-SH-00420:2026-03-01vs2026-06-12",
            "note":"同日(2026-06-12)提交同样拒绝——零长度版本"},
  "tags":["v0.2-③:倒填生效日→拒绝出件转治理,版本链不许重叠"]}
]
```

**打分维度(每条 0/1):**
1. 归一与枚举正确(m01;归不进该停)
2. 查重闸门正确(m02:同址异名停、不自动合并)
3. **update 敏感字段查重**(m09:撞现存店即停、不出件)
4. SCD-2 版本链正确(m03/m06:封口-开口衔接、历史不动、store_id 不换)
5. **倒填拒绝**(m10:含同日,版本链不重叠)
6. 字段驱动扇出配对(m03 店级→L0-07、m06 陈列位→L0-02,§10 配对校验过)
7. 关店级联完整(m04:双扇出 + resolved:store_closed 注明)
8. **suspended/restore 级联完整**(m07 三路齐、m08 回补+解冻补算,≠关店)
9. geo_mismatch 留迹不阻塞(m05)+ JSON 过 §10 校验

> 跑完看哪一维最常错——主数据节点最常错在查重(m02/m09 的边界:连锁分店名相近但确是两家店)上,真实重复对的标注集要先攒。

---

## 待填变量(套用时替换)
- `owner` — 本 Skill 负责人/团队;`<档案Owner>` — 疑似重复/倒填的人工治理归属
- §9a 渠道枚举 ↔ 7 棒映射 — 接组织主数据
- §9b 缓冲系数 — 店级 M = 巡店周期 × 系数,与 L0-07 共同定
- `<地理容差>` — GPS/地址互验距离线(建议 500m,城郊店可放宽)
- 查重相似度阈值(`similar()`)— 用真实重复对标注集校准
- 档案库存储 — 版本链落库方案(经 MCP / 数据中台)
