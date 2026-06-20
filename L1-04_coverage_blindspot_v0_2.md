---
name: coverage-blindspot-finder
description: 消费 L1-03 两率输出(not_stocked/no_data 桶)、L0-04 门店档案(历史版)、L0-03 漏巡与 L0-07 stale 口径、POI/网格数据(经 MCP),识别三类分销覆盖盲点——未铺盲点(店在货没进)、数据盲点(不知道铺没铺)、白区盲点(根本没建档),按写死权重公式打分排序,产出带优先级与建议动作的月度盲点清单。凡涉及"覆盖盲点、空白市场、未铺名单、白区、网点开发线索、该在哪却不在哪、铺市机会"的输入都用本 Skill。它是覆盖空白的真相源(L1-04):只出清单不派任务,开发排期归 BD/城市经理,任务派发归 L5-02。下游:BD/城市经理/经销商、L5-03 城市攻坚(待建)。
version: v0.2
owner: <填:负责人/团队>
type: Workflow / Skill(渠道层分析节点 · 有状态盲点台账 · L1-04)
status: 粗糙版,待真实数据迭代
upstream: L1-03 两率输出(四桶明细+分母)/ L0-04 门店档案(按窗口日期历史版)/ L0-03 漏巡·L0-07 stale(引用)/ SKU 战略等级主数据(经 MCP)/ **SKU 生命周期 effective_stage(按 sku×scope×period,只读)** / POI·网格数据(经 MCP,占位)/ 权重表 / 盲点台账
downstream: BD / 城市经理 / 经销商(开发排期)/ L5-03 城市攻坚(待建,权重接入)/ 盲点台账(回写)
backlog: L1-04
---

# 分销覆盖盲点识别 Skill v0.2 · 渠道分析节点(L1-04)

> 本 Skill 依据《INFINITY OS · Agent 设计标准 v1.0》编写。
> 它是一个 **Workflow**(写死轨道)+ **盲点台账**(有状态,防刷存在感)。
> L1-03 算的是"**已覆盖范围内铺得怎么样**",本节点找的是"**覆盖之外的空白**"——回答"我们该在哪、却不在哪"。**只出清单不派任务。**

> **v0.2 变更摘要(只加一件事:优先级按生命周期阶段加权):** score 增加 `W_stage` 因子(成长最高、导入高、成熟中、衰退大幅降、焕新按成长、淘汰剔除、unknown 不加权照常列)。**"是不是盲点"的事实判定(=L1-03 not_stocked 桶)与阶段无关,三类互斥、POI 不硬造、unchanged 集合判据、两段动作一字不改**——阶段只动优先级排序与列不列。unknown 照 **L0-07 范式**(照常列、不加权):没铺是客观事实,漏掉=丢开发机会,不像 L1-03 判级会误导;衰退/淘汰是**已知阶段的主动降权/剔除**,与 unknown 不同。

---

## 1. 角色与目标 + 边界【先读这个】

你是覆盖空白的**真相源**。产出物是**带优先级的盲点清单**,给 BD/城市经理/经销商做开发排期的依据——清单是地图,不是命令。

**与兄弟节点的边界(写死):**

| 事 | 归谁 | 本节点角色 |
|---|---|---|
| 两率与四桶判定 | **L1-03(真相源)** | **直接消费其 not_stocked / no_data 桶,严禁重算**——重算必漂 |
| 门店档案 | L0-04 | 只读,按窗口日期历史版 |
| 漏巡 / stale 口径 | L0-03 / L0-07 | 只引用不重判(联动已有) |
| 差距应对 / 任务派发 / 执行力节流 | L5-02 | **不碰任务台账**;本节点的 suggested_action 是枚举建议,不是派单 |
| 城市攻坚优先级 | L5-03(待建) | 打分公式留权重占位,建成后接入 |
| **三类盲点识别 + 优先级打分 + 月度清单** | **L1-04(本节点)** | 唯一产出方 |

---

## 2. 输入(Input)

| 来源 | 字段 | 用途 |
|---|---|---|
| L1-03 输出 | distribution 块(not_stocked / no_data 明细 store_ids + 分母口径)| **①②类的唯一数据源,零重算** |
| L0-04 档案 | active 店清单 / channel_type / region·city·商圈(按窗口日期历史版) | 聚合维度 + ③类的"实有建档数" |
| L0-03 / L0-07 | 漏巡店清单 / stale 标记 | ②类的"长期无人巡"佐证(引用) |
| SKU 主数据 | 战略等级 Flagship/Core/Volume(经 MCP) | 打分权重 |
| **SKU 生命周期阶段(v0.2)** | effective_stage(按 sku×scope×period,只读) | **优先级阶段权重因子**;只影响排序/列不列,不改是不是盲点 |
| POI / 网格数据 | 经 MCP(占位):城市×商圈 应有门店密度/数量 | ③类白区;**不可用 → poi_unavailable 跳过,绝不硬造** |
| 权重表 | §9b(初版拍的,回测校准) | score 公式 |
| 盲点台账 | (type, sku, scope) 上月清单与店集合 | 防重复、cohort 环比 |
| 窗口 / `now` | **monthly(主窗口;weekly 不跑)** | 盲点变化慢,周跑只产噪音 |

---

## 3. 参数定义(Parameters)

| 字段 | 类型 | 说明 |
|---|---|---|
| `period` / `scope` | string / object | 月窗口;region/city/channel_type 切片 |
| `blindspots[]` | object[] | 三类分列,**严禁混算**: |
| ├ `type` | enum | `未铺`(①)/ `数据`(②)/ `白区`(③) |
| ├ `sku` | string\|null | ①按 SKU;②店级(SKU 无关);③商圈级 |
| ├ `store_ids[]` | string[]\|null | ①②有;**③恒 null**(没建档的店没有 ID,给店级明细就是造假)→ ③用 `poi_refs` + `gap_count` |
| ├ `count` / `gap_count` | number | ①②店数;③缺口数 = max(POI 应有 − L0-04 实有, 0) |
| ├ `base_score` | number | **= count × SKU战略权重 × 区域攻坚权重(L5-03 占位)× 渠道类型权重**,照 §9b 表脚本算(阶段加权前)(v0.2) |
| ├ `score` | number | **= base_score × W_stage(effective_stage)**,照 §9b-2 脚本算;clean 清单按此重排(v0.2) |
| ├ `effective_stage` | enum | 读自《SKU 生命周期阶段判定》,只读不重判(v0.2) |
| ├ `trend` | object | 同店 cohort 环比:`{cohort_count_prev, cohort_count_now, direction: 收敛/恶化/unchanged}` |
| └ `suggested_action` | enum | `补铺`(①)/ `补巡`(②)/ `建档核查` → `新店开发`(③两段,见 §4D);**随阶段(v0.2):导入/成长=新店开发优先,衰退=暂缓不开发** |
| `flags` | string[] | `poi_unavailable` / `unchanged:{key}` 等 + **`stage_weighted:{base→score}` / `stage_no_blindspot:淘汰` / `stage_unknown_base_score` / `low_priority_declining`(v0.2)** |
| `summary_text` | string | top-N(按 score)一行人话,数字可溯源(沿用 L5-01 校验) |
| `fanout` | string[] | 看板/台账;**无任何任务派发项** |

---

## 4. 处理流程(Steps · 链式,monthly)

### Step A — 取数(零重算)
读 L1-03 本月输出:not_stocked 与 no_data 的 store_ids 明细 + 分母口径(denominator_basis 必须带 L0-04@ 版本引用,直接透传);读 L0-03 漏巡 / L0-07 stale 清单;读 L0-04 历史版(聚合维度 + 建档数);读 POI(经 MCP)。

### Step B — 三类分桶(互斥,血统保证)
| 类 | 定义 | 来源 | 互斥保证 |
|---|---|---|---|
| **① 未铺盲点** | 已建档、有数据、该 SKU 未铺——店在、人到过、货没进,**最实的开发线索** | = L1-03 `not_stocked` 桶,按 SKU × 区域/渠道聚合 | L1-03 四桶本身互斥 |
| **② 数据盲点** | 建档 active 但窗口 no_data + 长期无人巡——"**不知道铺没铺**"本身就是盲点 | = L1-03 `no_data` 桶,叠加 L0-03 漏巡 / L0-07 stale 引用佐证 | **严禁计入①当未铺**(§10 集合断言) |
| **③ 白区盲点** | 市场上存在、L0-04 根本没建档 | POI 应有密度 vs L0-04 实有建档数,差值 = 缺口(商圈粒度) | 与①②天然不交(无档案) |

**POI 闸门**:POI 服务不可用或该城市无数据 → ③类只标 `poi_unavailable:{城市}` 整类跳过,**绝不硬造**;①②照常出。

### Step C — 打分(脚本,可重放)
> `base_score = count × W_sku × W_region(L5-03 占位)× W_channel`
> `score = base_score × **W_stage(effective_stage,§9b-2,v0.2)**`

权重全部取 §9b 外置表(初版拍的,回测校准)。**阶段权重只乘在优先级上,不改 count(count 是 L1-03 桶的事实)**。clean 清单按**加权 score** 降序重排;top-N 进 summary。**淘汰期 SKU 整条剔除清单(stage_no_blindspot);unknown 按基础权重(W_stage=1)照常列,标 stage_unknown_base_score**——盲点是客观事实,不因不知阶段就漏掉真实开发机会(同 L0-07 unknown 范式)。

### Step D — suggested_action(枚举,写死映射)
| 类 | 动作 |
|---|---|
| ① 未铺 | `补铺`(给经销商/城市经理的开发线索) |
| ② 数据 | `补巡`(先把"不知道"变成"知道",再谈铺不铺) |
| ③ 白区 | **两段**:`建档核查`(先核——可能是漏建档的存量店,"我们不知道它"≠"它不在我们体系")→ 核查后确认空白才标 `新店开发` |

**动作随阶段(v0.2):导入/成长期 → 开发优先级动作(新店开发/补铺 优先排);衰退期 → 动作标"暂缓,不开发"(别让 BD 去开发一个要退的品);淘汰期该 SKU 不出条目。** 动作是建议枚举,不是派单——本节点不写任务台账、不触发 L5-02,BD 拿清单自己排期。

### Step E — cohort 环比 + 台账防重复
- **环比同店 cohort**(语义沿用 L5-01/L1-03):两个月都在分母里的同一批店,比 not_stocked 数——上月 40 → 本月 32 = 真收敛;**新建档店不进 cohort 比较**(20 家新店全未铺会把全量数字推高,那是开发进度不是恶化)。
- **台账防刷存在感**:同 (type, sku, scope) 上月已报且**店集合无增减** → 标 `unchanged:{key}`,不进 summary(计数相同但店换血≠unchanged——3 家补铺 3 家新失守,值得看);收敛/恶化才进 summary。③类按 gap_count 比。

### Step F — 出件
脚本产全部数字 → LLM 写 summary_text(top-N,数字可溯源)→ 跑 §10 → 扇出(看板/台账)→ 回写盲点台账。

---

## 5. 规则与强度(RFC2119)

| 强度 | 规则 |
|---|---|
| **MUST** | **优先级 score 必须按 effective_stage 加权(§9b-2):成长最高、导入高、成熟中、衰退大幅降、焕新按成长**(v0.2)。 |
| **MUST** | **"是不是盲点"的事实判定与阶段无关**——盲点 = L1-03 not_stocked 桶,阶段绝不改 count、不改是否入清单的事实判定,只动优先级/排序/列不列(v0.2)。 |
| **MUST** | **淘汰期 SKU 必须剔除盲点清单(stage_no_blindspot);unknown 必须按基础权重照常列(stage_unknown_base_score)不漏**——盲点是客观事实,漏列 = 丢开发机会(同 L0-07 unknown 范式)(v0.2)。 |
| **MUST NOT** | 阶段**只读《SKU 生命周期阶段判定》的 effective_stage,绝不重判阶段**(v0.2)。 |
| **MUST** | 三类互斥与 POI 不硬造**不受阶段影响**——阶段加权只作用于已成立盲点的优先级(v0.2)。 |
| **MUST** | 三类盲点必须分别定义、分别出清单,**严禁混算**;①②必须直接消费 L1-03 的 not_stocked / no_data 桶,**严禁本节点重算四桶**。 |
| **MUST** | ②(no_data)**绝不得计入①当未铺**——"不知道铺没铺"≠"没铺";§10 集合断言必过。 |
| **MUST** | POI 数据不可用必须标 `poi_unavailable` 跳过③类,**绝不硬造**;①②照常出件。③类 store_ids 恒 null(无建档即无 ID),只出商圈粒度 gap_count + poi_refs。 |
| **MUST** | score 必须可由 §9b 权重表脚本重放;权重表外置,改权重只改表。 |
| **MUST NOT** | 清单只建议不派单:**绝不触碰任务台账、绝不触发 L5-02、绝不向 L0 层反向指挥采集**;suggested_action 仅为枚举建议。 |
| **MUST** | 同 (type, sku, scope) 上月已报且店集合无增减 → 标 unchanged 不进 summary;环比必须同店 cohort,新建档店不进 cohort 比较。 |
| **MUST** | 聚合维度与建档数必须取 L0-04 按窗口日期历史版;summary 数字可溯源(沿用 L5-01 校验)。 |
| **SHOULD** | ②类应附 L0-03 漏巡/L0-07 stale 引用佐证;③类建档核查结果应回流 L0-04 治理线(发现漏建档→建档)。 |
| **MAY** | 可附 by_store 明细(仅①②)供 BD 下钻;连续 N 月①类同店可加注"顽固未铺"供 L5-03 消费。 |

---

## 6. 输出(Output · Artifact 契约)

```json
{
  "period": "2026-05", "window": "monthly",
  "scope": { "region": "华东" },
  "blindspots": [
    { "type": "未铺", "sku": "6MX-JDX", "scope": "上海|社区超市",
      "store_ids": ["ST-SH-00301", "ST-SH-00415", "..."], "count": 32,
      "effective_stage": "成长",
      "base_score": 96.0, "score": 144.0,
      "score_basis": "base 32×Flagship2.0×上海1.5×社区1.0=96 ×W_stage(成长1.5)=144",
      "trend": { "cohort_count_prev": 40, "cohort_count_now": 32, "direction": "收敛" },
      "suggested_action": "新店开发优先(成长期扩覆盖核心动作)" },
    { "type": "数据", "sku": null, "scope": "苏州|KA",
      "store_ids": ["ST-SZ-00077", "..."], "count": 14,
      "stale_refs": ["L0-07:stale×9", "L0-03:漏巡×5"],
      "base_score": 21.0, "score": 21.0,
      "trend": { "direction": "恶化", "cohort_count_prev": 9, "cohort_count_now": 14 },
      "suggested_action": "补巡" },
    { "type": "白区", "sku": null, "scope": "杭州|滨江商圈",
      "store_ids": null, "gap_count": 11,
      "poi_refs": ["MCP:poi@杭州滨江:应有28", "L0-04:实有17"],
      "base_score": 33.0, "score": 33.0, "trend": { "direction": "unchanged" },
      "suggested_action": "建档核查→新店开发" }
  ],
  "flags": ["unchanged:白区|杭州|滨江商圈(不进summary)", "poi_unavailable:无(本期POI正常)", "stage_weighted:未铺|上海|社区超市:96→144(成长)"],
  "summary_text": "华东 5 月盲点 top3(按阶段加权后):①上海社区超市加点鲜未铺 32 店(成长期,优先级上调 96→144)——成长期扩覆盖核心动作,新店开发优先;②苏州 KA 14 店本月无数据(上月 9,恶化),先补巡;③杭州滨江商圈建档 17 vs POI 应有 28,缺口 11,待建档核查。",
  "fanout": ["看板:BD/城市经理/经销商:盲点清单", "台账:登记"]
}
```

> **同盲点阶段反转示例(v0.2):** 同一"上海社区超市未铺 32 店",**成长期** score=144(优先抢);若该 SKU 处**衰退期** W_stage=0.3 → score≈29,排到末尾并标 `low_priority_declining`、动作"暂缓不开发"。**count 都是 32(事实不变),优先级天差地别**。
> **淘汰期剔除示例(v0.2):** 某 SKU `effective_stage:"淘汰"` → 不出任何盲点条目,`flags:["stage_no_blindspot:淘汰"]`。
> **unknown 照常列示例(v0.2):** `effective_stage:"unknown"` → `base_score=score`(W_stage=1),照常列入清单,`flags:["stage_unknown_base_score"]`——没铺是事实,不漏。

---

## 7. 节奏 + 扇出(写死)

| 项 | 规则 |
|---|---|
| 窗口 | **monthly 唯一主窗口;weekly 不跑**——盲点变化慢,周跑只产噪音 |
| 扇出 | 看板(BD/城市经理/经销商)· L5-03(建成后读 score 与顽固未铺)· 盲点台账回写 |
| 禁区 | **绝不**:派任务/碰任务台账/触发 L5-02、触发 L0-07/L0-08、反向指挥采集、重算 L1-03 的桶 |

---

## 8. HITL 卡点 —— 本节点【无】

清单不是动作——不花钱、不占执行力、不可逆性为零,**故无 HITL**。开发排期是 BD 的判断,任务派发与执行力节流在 L5-02 那条线卡(其 §4 Step E 已有节流闸门)。本节点把"该在哪、却不在哪"摆上桌,到此为止。

---

## 9. References

### 9a. 三类盲点定义表(写死)

| 类 | 一句话 | 数据源 | 输出粒度 |
|---|---|---|---|
| ① 未铺 | 店在、人到过、货没进 | L1-03 not_stocked | SKU × scope,店级明细 |
| ② 数据 | 不知道铺没铺 | L1-03 no_data + L0-03/L0-07 引用 | scope,店级明细 |
| ③ 白区 | 根本没建档 | POI − L0-04 实有 | 商圈级 gap_count,**无店级明细** |

### 9b. 权重表(初版拍的,回测校准;改权重只改这张表)

| 维度 | 权重 |
|---|---|
| W_sku | Flagship 2.0 / Core 1.5 / Volume 1.0 |
| W_region | `<L5-03 占位>`:暂用主数据攻坚系数(如重点城市 1.5 / 一般 1.0);L5-03 建成后整列替换接入 |
| W_channel | 7 棒对齐:KA `<占位>` / 社区超市 `<占位>` / 餐饮 `<占位>` / …(挂渠道主数据) |

### 9b-2. 阶段权重 W_stage(v0.2,占位待校准;只乘优先级不改 count)

| effective_stage | W_stage | 理由 / 动作 |
|---|---|---|
| 成长 | **最高**(如 1.5) | 成长期核心动作就是扩覆盖,盲点=复制扩张目标 → 开发优先 |
| 导入 | **高**(如 1.3) | 该点亮的新阵地,催开发 |
| 焕新 | 按成长(如 1.5) | 焕新=重新铺 |
| 成熟 | **中**(1.0) | 常规补铺,不加权 |
| 衰退 | **大幅降**(如 0.3)+ `low_priority_declining` | 盲点≠问题,别让 BD 弹药浪费在要退的品,动作"暂缓不开发" |
| 淘汰 | **剔除**(stage_no_blindspot) | 本就清退,该 SKU 不出条目 |
| unknown | **1.0(不加权)** + `stage_unknown_base_score` | 没铺是客观事实,照常列不漏(同 L0-07 范式) |

> W_stage 只是 score 的乘数,**绝不改 count**(count=L1-03 桶事实)。系数占位,回测校准。

### 9c. 术语表

| 术语 | 含义 | 处理 |
|---|---|---|
| 未铺盲点 | L1-03 not_stocked 的聚合视角 | 最实开发线索 → 补铺 |
| 数据盲点 | no_data + 长期无人巡 | 先补巡;≠未铺 |
| 白区 | POI 有店、档案没有 | 商圈粒度;先核查再开发 |
| 刷存在感 | 同键无变化月月进 summary | unchanged 标记,集合判据 |
| 顽固未铺 | 连续 N 月同店①类 | 供 L5-03 消费(MAY) |
| **阶段权重 W_stage(v0.2)** | 优先级随 effective_stage 乘 | 成长最高/衰退降/淘汰剔/unknown不加权;只动优先级不改 count |
| **stage_no_blindspot(v0.2)** | 淘汰期 SKU 不出盲点 | 本就清退 |
| **stage_unknown_base_score(v0.2)** | 阶段未知按基础分照常列 | 同 L0-07 范式:漏列=丢机会 |

### 9d. 踩坑记录(预置)

- ❌ 本节点自己重算"哪些店没铺" → 和 L1-03 口径漂移,两张清单打架 → ✅ 直接消费 not_stocked 桶,零重算。
- ❌ no_data 店混进未铺清单 → BD 拿着名单去谈铺市,到店发现货好好摆着(只是没人巡报)→ ✅ ②单列,§10 集合断言。
- ❌ POI 没数据就按"经验密度"硬估白区 → 清单里出现幽灵缺口 → ✅ poi_unavailable 跳过,绝不硬造。
- ❌ 给白区编了店级明细 → 没建档的店哪来的 ID → ✅ ③恒无 store_ids,只出商圈 gap_count。
- ❌ 20 家新建档店全未铺,环比数字暴涨被读成"覆盖恶化" → 那是开发进度 → ✅ cohort 环比,新建档不进比较。
- ❌ 同一片白区月月进 summary,BD 麻了 → ✅ unchanged 不刷存在感,收敛/恶化才说话。
- ❌ 清单顺手生成了派发任务 → 和 L5-02 的节流/选择权机制冲突,一线被两条线夹击 → ✅ 只建议不派单,MUST NOT。
- ❌(v0.2,值得记)**对衰退/淘汰期 SKU 催开发**:BD 拿着盲点清单去开发一个三个月后就要退场的品,弹药(谈判精力/陈列费/铺市资源)全浪费在沉没的船上 → ✅ 衰退期 W_stage 大幅降+标 low_priority、淘汰期剔除清单,**把火力让给导入/成长期该抢的新阵地**。盲点是事实,但"现在值不值得抢"要看阶段。
- ❌(v0.2)阶段判不出(unknown)就不列盲点 → 漏掉真实的"没铺",丢开发机会 → ✅ unknown 按基础分照常列(同 L0-07 范式:没铺是客观事实,不像 L1-03 判级会误导)。
- ❌(v0.2)用阶段改了 count(衰退期把 32 家盲点"打折"成 10 家) → 阶段污染了事实 → ✅ 阶段只乘优先级 score,count 永远是 L1-03 桶的原值。
- _(后续迭代继续往下加)_

---

## 10. Scripts — 打分重放 / 阶段加权 / 互斥 / cohort / 防重复 / 溯源(出件前必跑)

```python
W_STAGE = {  # §9b-2 占位
  "成长": 1.5, "导入": 1.3, "焕新": 1.5, "成熟": 1.0,
  "衰退": 0.3, "unknown": 1.0,            # 淘汰不在此:剔除清单
}
NO_BLINDSPOT_STAGES = {"淘汰"}

def base_score_of(count, sku_tier, region, channel, W):
    return count * W["sku"][sku_tier] * W["region"][region] * W["channel"][channel]

def score_of(count, sku_tier, region, channel, W, stage):
    base = base_score_of(count, sku_tier, region, channel, W)
    w_stage = W_STAGE.get(stage, 1.0)      # unknown/缺失 → 1.0 不加权
    return base, round(base * w_stage, 1)

def validate(out, l1_03, ledger_before, W):
    errs = []
    nd_ids = set(l1_03["no_data_store_ids"])
    ns_ids = set(l1_03["not_stocked_store_ids"])
    for b in out.get("blindspots", []):
        ids = set(b.get("store_ids") or [])
        stage = b.get("effective_stage")
        # ===== 三类互斥与血统 =====
        if b["type"] == "未铺":
            if not ids <= ns_ids:
                errs.append(f"type1_not_from_l1_03:{b['scope']}")      # ①必须⊆ not_stocked 桶
            if ids & nd_ids:
                errs.append(f"no_data_mixed_into_type1:{b['scope']}")  # ②混入①,最危险的错
        if b["type"] == "数据" and not ids <= nd_ids:
            errs.append(f"type2_not_from_l1_03:{b['scope']}")
        if b["type"] == "白区":
            if b.get("store_ids") is not None:
                errs.append(f"type3_with_store_ids:{b['scope']}")      # ③恒无店级明细
            if not b.get("poi_refs") and "poi_unavailable" not in str(out.get("flags")):
                errs.append(f"type3_without_poi_basis:{b['scope']}")   # 无 POI 依据=硬造
        # ===== v0.2 淘汰期必须剔除 =====
        if stage in NO_BLINDSPOT_STAGES:
            errs.append(f"clearance_stage_still_listed:{b['scope']}")  # 淘汰期 SKU 仍出盲点
        # ===== score 可重放(含阶段加权) =====
        cnt = b.get("count", b.get("gap_count", 0))
        exp_base, exp_score = score_of(cnt, b.get("_sku_tier", "Volume"),
                                       b.get("_region_key"), b.get("_channel_key"), W, stage)
        if b.get("base_score") is not None and round(b["base_score"], 1) != round(exp_base, 1):
            errs.append(f"base_score_not_replayable:{b['scope']}")
        if b.get("score") is not None and round(b["score"], 1) != exp_score:
            errs.append(f"score_not_replayable:{b['scope']}")         # 含阶段加权重放
        # ===== v0.2 阶段只动优先级,不改 count(事实) =====
        if b.get("_count_altered_by_stage"):
            errs.append(f"count_polluted_by_stage:{b['scope']}")      # 阶段改了 count=错
        # ===== v0.2 unknown 必须照常列 + 不加权 =====
        if stage == "unknown":
            if b.get("base_score") != b.get("score"):
                errs.append(f"unknown_stage_weighted:{b['scope']}")   # unknown 不应加权
            if "stage_unknown_base_score" not in str(out.get("flags", [])):
                errs.append(f"unknown_without_base_flag:{b['scope']}")
        if b.get("score") != b.get("base_score") and stage not in ("unknown", None):
            if not any(f.startswith("stage_weighted") for f in out.get("flags", [])):
                errs.append(f"weight_without_trace:{b['scope']}")     # 加权须溯源
        # ===== cohort 环比 =====
        t = b.get("trend") or {}
        if t.get("direction") in ("收敛", "恶化") and "cohort_count_prev" not in t:
            errs.append(f"trend_without_cohort:{b['scope']}")
        # ===== 台账防重复(集合判据) =====
        key = (b["type"], b.get("sku"), b["scope"])
        prev = ledger_before.get(key)
        if prev is not None:
            same = (set(prev.get("store_ids") or []) == ids) if b["type"] != "白区" \
                   else (prev.get("gap_count") == b.get("gap_count"))
            if same and f"unchanged:{b['type']}|{b['scope']}" not in str(out.get("flags")) \
               and b["scope"] in out.get("summary_text", ""):
                errs.append(f"unchanged_in_summary:{key}")             # 无变化不刷存在感
    # ===== 边界:只建议不派单 =====
    for f in out.get("fanout", []):
        if any(f.startswith(p) for p in ("任务", "派发", "L5-02", "L0-07", "L0-08", "补拍", "重报")):
            errs.append(f"illegal_fanout:{f}")
    # ===== summary 数字溯源(沿用 L5-01) =====
    import re, json
    body = json.dumps(out.get("blindspots", []), ensure_ascii=False)
    for num in re.findall(r"\d+\.?\d*", out.get("summary_text", "")):
        if num not in body and num not in out.get("period", ""):
            errs.append(f"summary_number_unsourced:{num}")
    return errs
```

---

## 11. 评测起手式(11 条种子)

```json
[
 {"id":"b01",
  "input":{"l1_03":{"not_stocked_store_ids":["S1","S2","S3"],"sku":"6MX-JDX","scope":"上海|社区超市"}},
  "expect":{"type1_count":3,"store_ids_subset_of_l1_03":true,"suggested_action":"补铺","no_recompute":true},
  "tags":["①类聚合:直接消费 not_stocked 桶,零重算"]},

 {"id":"b02",
  "input":{"bad_output":"某①类清单的 store_ids 含 L1-03 no_data 桶里的 S9"},
  "expect":{"validation_error":"no_data_mixed_into_type1"},
  "tags":["②混入①必须报错——不知道铺没铺≠没铺,BD 白跑"]},

 {"id":"b03",
  "input":{"poi_service":"该月不可用","l1_03":"①②数据正常"},
  "expect":{"type3_absent":true,"flags_contains":"poi_unavailable",
            "type1_type2_emitted_normally":true,"no_fabricated_gap":true},
  "tags":["POI 缺失→③跳过绝不硬造,①②照常"]},

 {"id":"b04",
  "input":{"count":32,"sku_tier":"Flagship","stage":"成熟","W":{"sku":{"Flagship":2.0},"region":{"上海":1.5},"channel":{"社区超市":1.0}}},
  "expect":{"base_score":96.0,"score":96.0,"replayable_from_9b":true,"note":"成熟期W_stage=1.0不加权"},
  "tags":["base_score 可由权重表重放:32×2.0×1.5×1.0=96;成熟期不加权"]},

 {"id":"b05",
  "input":{"ledger_prev":{"(未铺,6MX-QY-500,无锡|KA)":{"store_ids":["S4","S5"]}},
           "this_month":{"store_ids":["S4","S5"]}},
  "expect":{"flags_contains":"unchanged","not_in_summary":true,
            "counter_case":"若本月为 [S4,S6](计数同为2但换血)→ 不算 unchanged,进 summary"},
  "tags":["同键店集合无增减→unchanged 不刷存在感;集合判据,计数相同换血不算"]},

 {"id":"b06",
  "input":{"prev_month":"cohort 店 not_stocked 40","this_month":"同 cohort 32;另新增建档 20 店全未铺(全量 52)"},
  "expect":{"trend":{"cohort_count_prev":40,"cohort_count_now":32,"direction":"收敛"},
            "not_reported_as_worsening":true},
  "tags":["cohort 收敛不被新建档稀释:52 的全量数字不许伪装成恶化"]},

 {"id":"b07",
  "input":{"poi":"杭州滨江商圈应有 28 店","l0_04":"实有建档 17(窗口日期历史版)"},
  "expect":{"type":"白区","gap_count":11,"store_ids":null,
            "poi_refs_present":true,"suggested_action":"建档核查→新店开发"},
  "tags":["白区计算:POI−实有=缺口,商圈粒度无店级明细,先核查再开发"]},

 {"id":"b08",
  "input":{"blindspot":"上海社区超市未铺 32 店,base_score 96",
           "case_成长":{"effective_stage":"成长","W_stage":1.5},
           "case_衰退":{"effective_stage":"衰退","W_stage":0.3}},
  "expect":{"count_same":32,
            "case_成长":{"score":144.0,"flags_contains":"stage_weighted","action":"新店开发优先","rank":"靠前"},
            "case_衰退":{"score":28.8,"flags_contains":"low_priority_declining","action":"暂缓不开发","rank":"靠后"},
            "fact_same_priority_reversed":true},
  "tags":["v0.2:同盲点成长vs衰退优先级反转——count都是32(事实),score 144 vs 28.8"]},

 {"id":"b09",
  "input":{"sku":"6MX-EOL","effective_stage":"淘汰","l1_03_not_stocked":["S1","S2"]},
  "expect":{"no_blindspot_entry":true,"flags_contains":"stage_no_blindspot",
            "error_if_listed":"clearance_stage_still_listed",
            "note":"本就清退,不催开发"},
  "tags":["v0.2:淘汰期SKU不出盲点(stage_no_blindspot);仍出→报错"]},

 {"id":"b10",
  "input":{"sku":"6MX-X","effective_stage":"unknown","l1_03_not_stocked":["S1","S2","S3"],"base_score":48},
  "expect":{"listed":true,"base_score":48,"score":48,"no_weighting":true,
            "flags_contains":"stage_unknown_base_score",
            "error_if_dropped":"漏列真实盲点",
            "contrast":"同 L0-07 范式:没铺是客观事实,漏列=丢机会;不像 L1-03 判级会误导"},
  "tags":["v0.2:unknown照基础分照常列,不加权不漏掉真实盲点"]},

 {"id":"b11",
  "input":{"blindspot":"未铺32店,effective_stage:衰退,W_stage:0.3"},
  "expect":{"score":"96×0.3=28.8","flags_contains":"low_priority_declining",
            "suggested_action":"暂缓不开发","count_unchanged":32,
            "rationale":"控库存止损期,别让BD弹药浪费在要退的品"},
  "tags":["v0.2:衰退期盲点降权标 low_priority,事实(count)不变"]}
]
```

**打分维度(每条 0/1):**
1. ①类血统与零重算(b01)
2. **互斥断言**(b02:②混入①必报错——本节点最危险的错)
3. POI 闸门(b03/b07:缺失跳过 / 正常时商圈粒度无店级明细)
4. base_score 重放(b04)
5. 台账集合判据(b05 含反例)
6. cohort 不被稀释(b06)
7. **同盲点阶段反转**(b08:成长vs衰退优先级 144 vs 28.8,count 不变)
8. **淘汰剔除**(b09:stage_no_blindspot;仍出报错)
9. **unknown 照常列不加权**(b10)
10. **衰退降权标 low_priority**(b11)
11. 只建议不派单 + summary 溯源 + 过 §10 校验(含 count_polluted_by_stage 守事实)

> 最危险的两类错:b02(②混入①,BD 拿"未铺名单"到店发现货摆得好好的,清单信用一次败光)和 **v0.2 的"事实被阶段污染"**(count 被阶段打折/淘汰期把真盲点抹掉/unknown 漏列)——阶段只能决定"现在值不值得抢",绝不能决定"是不是盲点"。互斥靠血统+集合断言,事实层靠 `count_polluted_by_stage` 守。

---

## 待填变量(套用时替换)
- `owner` — 本 Skill 负责人/团队
- §9b 权重表:W_sku 初值 / **W_region(L5-03 建成后整列替换)** / W_channel(7 棒,挂渠道主数据)— 全部回测校准
- **§9b-2 阶段权重 W_stage(成长/导入/成熟/衰退系数)— 回测校准(v0.2)**
- **`effective_stage` 来源 —《SKU 生命周期阶段判定》契约,按 sku×scope×period(只读)(v0.2)**
- POI / 网格数据源 — 经 MCP(城市×商圈密度;不可用即跳过③)
- top-N — summary 收录条数(建议 3~5)
- "顽固未铺"的 N 月门槛 — 供 L5-03(MAY 项)
- 盲点台账落库 — 与既有五本台账同基建分表(第六本)
