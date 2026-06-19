---
name: dominance-gap-alert
description: 把三个采集源(L0-01 库存、L0-05 竞品、L0-02 货架)的 JSON 按 (store, date, category/sku) 对齐汇总,跨源去重后,确定性地计算六月鲜在品类/区域的统治力差距(SOV、排面、断货、竞品压制、价签合规 vs 目标主数据),按日/周/月写死阈值表分级预警。凡涉及"统治力、差距分析、SOV 下滑、排面失守、断货率、竞品压制、达标率、区域对比、趋势预警、战略看板喂料"的输入都用本 Skill。它是第一个消费者节点(L5-01)——不采集、只消费;下游 L6 战略脑与城市经理看板读它的输出。
version: v0.2
owner: <填:负责人/团队>
type: Workflow / Skill(数据增长层 · 消费/分析节点 · L5-01)
status: 粗糙版 v0.2,待真实数据迭代(骨架优先:多源对齐 + 跨源去重 + 分级阈值表)
upstream: L0-01 库存 JSON / L0-05 竞品 JSON / L0-02 货架 JSON(批量)+ 目标主数据
downstream: L6 战略脑 / 城市经理看板(区域级)
backlog: L5-01
---

# 统治力差距预警 Skill v0.2 · 消费节点(L5-01)

> 本 Skill 依据《INFINITY OS · Agent 设计标准 v1.0》编写。
> 它是一个 **Workflow**(写死轨道),不是 Agent —— 差距 = actual − target 是确定性计算,预警靠写死阈值表,趋势是跨窗口相减。**LLM 在本节点只写人可读摘要;所有数字必须出自脚本。**

> **v0.2 变更摘要(三处都是统计口径修正):** ①区域/品类比率一律 **pool 分子分母再求比**,绝不平均店级百分比;②趋势按**同店 cohort**(两窗口交集门店)对比,门店进出不得伪装成趋势;③头号对手**锁定具名品牌**对比,易主单独标 `top_comp_changed`,换对手不得伪装成差距变化。

---

## 1. 角色与目标 + 与 L0-03 的边界

你是数据增长层的**第一个消费者节点**。不采集、只消费:把三源 JSON 汇起来,算出"六月鲜在某品类/区域的统治力 vs 目标和对手差多少",按日/周/月分级预警。

**与 L0-03 日报的边界(同读三源,视角不同,别重复):**

| | L0-03 日报 | L5-01 统治力差距(本节点) |
|---|---|---|
| 视角 | 运营:"今天这家店发生了什么" | 战略:"品类/区域差多少 + 趋势" |
| 粒度 | 单店 × 单日 | 跨店 × 跨时段聚合 |
| 不做 | 不算差距、不看趋势 | 不复述单店流水 |
| 给谁 | 城市经理(当日处置) | L6 战略脑 + 看板(资源决策) |

- 你**只分析预警,不触发任何应对动作**——花钱的对策(费用申请、促销应对)在 L5-02 那边卡 HITL。
- 你**不回头触发采集**——数据缺就标缺,不指挥上游补拍补报。

---

## 2. 输入(Input · 批量消费)

| 来源 | 形式 | 用途 |
|---|---|---|
| L0-02 货架 JSON 批量 | Artifact[] | SOV(分品类排面数)、facing_gap、价签合规、升级标记(src:L0-02) |
| L0-05 竞品 JSON 批量 | Artifact[] | 竞品动作(堆头/端架/新品/降价/促销)、「竞品新品」情报 |
| L0-01 库存 JSON 批量 | Artifact[] | 断货 / 低库存(status) |
| 目标主数据 | 经 MCP | 目标 SOV、排面目标、断货率红线、铺货目标(见 §9) |
| 窗口参数 | `window` | `daily` / `weekly` / `monthly`(决定走哪套阈值,§7) |
| 范围参数 | `scope` | 区域 / 城市 / 品类筛选 |

> 上游字段含义以三源各自 SKILL.md 的 §6 契约为准,本节点**只读不改**。
> **(v0.2)聚合用原料是店级排面数(own_facings/comp_facings 的 facings),不是店级百分比**——L0-02 输出里两者都有,本节点取排面数 pool。

---

## 3. 参数定义(Parameters)

| 字段 | 类型 | 允许值 / 说明 |
|---|---|---|
| `window` | enum | `daily` / `weekly` / `monthly` |
| `scope` | object | region / city[] / category[](本次分析范围) |
| `by_dimension` | object | 五维度,各含 actual / target / gap / trend / data_quality ↓ |
| ├ `sov_gap` | object | 自家 SOV vs 目标 + vs 头号对手(分品类,**pool 口径**) |
| ├ `facing_compliance` | object | 排面达标率(**pool:达标店数 ÷ 有数店数**) |
| ├ `oos` | object | 断货率、缺货门店数、涉及 SKU |
| ├ `competitor_pressure` | object | 压制度得分(**写死公式 §10**)+ 构成明细 |
| └ `price_compliance` | object | 不合规门店数 / 检核店数 |
| `vs_top_comp` | object | **(v0.2 结构)** `{ brand(当期锁定的具名头号对手), comp_sov, lead, prev_brand, changed(bool) }` |
| `by_category` | object | 各品类的维度汇总(pool 口径) |
| `by_region` | object | 各区域/城市的维度汇总(pool 口径) |
| `trend` | object | **(v0.2)同店 cohort 环比**:`{ cohort_stores, prev, delta, direction }`;cohort 不足 → `insufficient_data`。可附 `all_stores_view`(全量口径),**必须与 cohort 分开标,不混** |
| `data_quality` | object | coverage(有数店数/应覆盖店数)、excluded(降权剔除明细) |
| `alerts[]` | object[] | cadence(`daily`/`weekly`/`monthly`)/ level(`P0`/`P1`/`P2`)/ dimension / detail / store_count / city_count |
| `flags` | string[] | `target_missing:*` / `insufficient_data:*` / `degraded_input:*` / `dedup_applied:*` / `top_comp_changed:*` |
| `summary_text` | string | 人可读预警摘要(LLM 产,但每个数字必须引自 JSON) |
| `fanout` | string[] | 按 §7 写死规则生成 |

---

## 4. 处理流程(Steps · 对齐 → 归并 → 并行算 → 分级 → 出件)

### Step A — 多源对齐(Join)【骨架一】
按 **(store, date, category/sku)** 把三源 JSON join 成统一事实表:
- L0-02 → SOV/排面/价签/升级标记行;L0-05 → 竞品动作行;L0-01 → 库存状态行。
- 任一源当日缺(店没报)→ 该店该维度记 `no_data`,**不当 0 算**(没报 ≠ 没问题)。

### Step A2 — 跨源归并(Dedup)【骨架二 · 本节点的命门】
**同一个物理端架/堆头,L0-02(占位事实,带 src:L0-02)和 L0-05(动作上报)都会报。**
- 归并键 = **(store, date, loc)**:同键的升级标记/堆头事实 → **算一次**,绝不叠加。
- 归并后保留双 src 溯源(`dedup_applied:{store}-{date}-{loc}` 进 flags),压制度计数用归并后的数。
- 只有一源报到(美顾只拍照没说话,或只说话没拍照)→ 照常算一次,**单源不降权**(这正是双源互补的意义)。

### Step B — 并行算差距(Parallelization)【多店多品类同时跑,互不依赖】
每个 (category × region) 单元独立计算五维度,**全部脚本**(§10):

**B0. 聚合口径铁律(v0.2)——一切比率型指标 pool 后算,绝不平均店级百分比:**
> 区域/品类 SOV = **Σ(各店自家该品类排面) ÷ Σ(各店该品类总排面)**。
> 大店货架 20 排面、小店 5 排面,权重天然不同;平均各店 own_pct 会让小店一票顶大店一票,口径失真。
> 同理:by_brand 对手占比、排面达标率、断货率、价签合规率——**全部先汇总分子分母,再相除**。脚本里只允许出现 `sum(分子)/sum(分母)`,不允许出现 `mean(店级比率)`。

1. **SOV 差距** — actual = pool 口径自家品类 SOV vs 目标 SOV。
2. **vs 头号对手(v0.2)** — 头号对手 = **该 scope 当期 pool SOV 最大的具名品牌**,锁定品牌名记入 `vs_top_comp.brand`;`lead` = 自家 − 该品牌。**趋势对比锁同一具名品牌**(本期海天 vs 上期海天),**绝不**本期 vs"上期当时的最大者"。若当期最大者 ≠ 上期锁定品牌 → `changed:true` + flag `top_comp_changed:{旧}→{新}`,**换对手不得伪装成差距变化**;易主本身单列说明。
3. **排面达标率** — pool:达标店数 ÷ 有 facing_gap 数据的店数。
4. **断货** — pool:断货店数 ÷ 有数店数(只认 L0-01 的 status,L0-02 visual_oos 不进此维度——那是对账信号)。
5. **竞品压制度** — 写死加权:`pressure = w1×堆头端架店数占比 + w2×新品城市数占比 + w3×降价SKU数占比 + w4×对手SOV超额`(权重见 §9,初版拍的,待数据校准;对手 SOV 取 pool 口径)。
6. **价签合规** — pool:mismatch==true 店数 ÷ 检核店数(`price_uncertain` 不计入——L0-02 已排除)。

**数据完整性降权(算在每维度的 data_quality 里):**
- 上游标 `complete:false` / `photo_quality_low` / `sku_unresolved` 的记录 → 剔出该维度分子**和**分母,记入 `excluded`。
- 覆盖率(有数店数 ÷ 应覆盖店数)< `<最小覆盖率>` → 该维度标 `insufficient_data`,**只出观察值,不得触发 P0/P1**。

### Step C — 趋势(v0.2 改:同店 cohort)
- **cohort = 本窗口与上一窗口都有该维度有效数据的同一批门店(交集)。趋势只在 cohort 上算**:cohort 内 pool 本期比率 vs cohort 内 pool 上期比率。
- 门店进出(本周 30 店、上周 25 店)**不得**进趋势——新开店/补报店拉高拉低的是覆盖,不是趋势。
- `cohort_stores` < `<最小样本量>` → `insufficient_data`,不画趋势线。
- 可同时附全量口径 `all_stores_view` 供参考,但**必须与 cohort 口径分开标注,绝不混用**;alerts 的趋势类触发**只认 cohort 口径**。

### Step D — 分级预警(Routing by cadence)
按 §7 写死阈值表逐条比对,命中 → 产 alert(cadence + level + dimension + detail + 范围计数)。**不命中不产;等级不靠临场判断。**

### Step E — 出件
脚本产全部数字 → LLM 写 `summary_text`(**每个数字必须能在 JSON 里找到出处,不许新编数**)→ 跑 §10 校验 → 按 §7 扇出。

---

## 5. 规则与强度(RFC2119)

| 强度 | 规则 |
|---|---|
| **MUST** | 一切差距必须基于目标主数据计算;目标缺失必须标 `target_missing:{维度}-{品类}`,**不许猜目标、不许拿历史均值顶替**。 |
| **MUST** | **一切比率型指标(SOV/达标率/断货率/合规率/对手占比)必须 pool 分子分母后求比;严禁平均店级百分比。(v0.2)** |
| **MUST** | **趋势必须按同店 cohort(两窗口交集门店)计算;cohort 不足最小样本量标 `insufficient_data`;全量口径如附必须与 cohort 分开标注,趋势类预警只认 cohort 口径。(v0.2)** |
| **MUST** | **头号对手必须锁定具名品牌跨期对比;当期易主必须标 `top_comp_changed` 并单列,不得让换对手伪装成差距变化。(v0.2)** |
| **MUST** | 跨源同一动作必须按 (store, date, loc) 归并,**绝不叠加**;归并必留 `dedup_applied` 溯源。 |
| **MUST** | 预警等级必须照 §7 写死阈值表;**严禁** LLM 临场定级或"综合感觉"。 |
| **MUST** | 上游不完整数据(complete:false / photo_quality_low / sku_unresolved)必须降权剔除(分子分母同剔)并记 `excluded`;覆盖率不足的维度**不得**触发 P0/P1,只出观察值。 |
| **MUST** | 所有数字必须出自 §10 脚本;`summary_text` 中每个数字必须能在 JSON 找到出处。 |
| **MUST** | 本节点**不得**触发任何应对动作或回头指挥采集;扇出只到 L6 与看板。 |
| **SHOULD** | 趋势应有最小样本量(cohort 店数 ≥ `<最小样本量>`);不足应标 `insufficient_data` 而非硬画趋势线。 |
| **SHOULD** | 压制度构成应附明细(哪些店/城/SKU 贡献了得分),便于人下钻核查。 |
| **SHOULD** | 日窗口应只跑急性维度(断货/突袭),不应在日窗口算结构性指标(铺货率)——节奏错配会制造噪音。 |
| **MAY** | 头号对手之外的次要对手 SOV 可列入明细,非预警必需项。 |

---

## 6. 输出(Output · Artifact 契约)

下游唯一认这份结构。字段缺失用 `null` 或空数组,不要省略键。(示例 = 用户范例数据,weekly 窗口)
**口径注(v0.2):所有比率均为 pool 口径(Σ分子÷Σ分母);trend 均为同店 cohort 口径。**

```json
{
  "window": "weekly",
  "period": "2026-W24",
  "scope": { "region": "华东", "category": ["生抽"] },
  "by_dimension": {
    "sov_gap": {
      "category": "生抽", "basis": "pooled_facings",
      "actual": 0.48, "target": 0.60, "gap": -0.12,
      "vs_top_comp": { "brand": "海天", "comp_sov": 0.41, "lead": 0.07,
                       "prev_brand": "海天", "changed": false },
      "trend": { "cohort_stores": 25, "prev": 0.55, "delta": -0.07, "direction": "down",
                 "all_stores_view": { "note": "全量30店口径0.48,仅参考,不入预警" } },
      "data_quality": { "coverage": 0.86, "excluded": 4 }
    },
    "facing_compliance": {
      "sku": "6MX-TJ-380", "target_per_store": 4, "basis": "pooled_stores",
      "compliant_stores": 27, "measured_stores": 30, "rate": 0.90,
      "below_target_stores": 3, "trend": null, "data_quality": { "coverage": 0.88, "excluded": 2 }
    },
    "oos": {
      "sku": "6MX-JDX", "basis": "pooled_stores",
      "oos_stores": 6, "measured_stores": 120, "rate": 0.05, "redline": 0.03,
      "trend": { "cohort_stores": 110, "prev": 0.02, "delta": 0.03, "direction": "up" },
      "data_quality": { "coverage": 0.95, "excluded": 0 }
    },
    "competitor_pressure": {
      "score": 0.71,
      "components": {
        "端架堆头": { "brand": "海天", "stores": 12, "dedup_note": "L0-02/L0-05 双源已按店日位归并" },
        "促销": { "brand": "海天", "sku": "HT-JB-SC", "mech": "买二送一", "cities": 8 },
        "新品": { "brand": "李锦记", "raw_name": "薄盐醇香生抽", "cities": 5 }
      },
      "trend": { "cohort_stores": 25, "prev": 0.52, "delta": 0.19, "direction": "up" },
      "data_quality": { "coverage": 0.90, "excluded": 3 }
    },
    "price_compliance": { "basis": "pooled_stores",
      "mismatch_stores": 2, "measured_stores": 30, "rate": 0.07,
      "trend": null, "data_quality": { "coverage": 0.80, "excluded": 5 } }
  },
  "by_category": { "生抽": { "sov_gap": -0.12, "pressure": 0.71 } },
  "by_region": { "华东": { "sov_gap": -0.12, "oos_rate": 0.05 } },
  "alerts": [
    { "cadence": "daily", "level": "P0", "dimension": "oos",
      "detail": "加点鲜断货率 5%,超红线 3%", "store_count": 6, "city_count": null },
    { "cadence": "weekly", "level": "P1", "dimension": "sov_gap",
      "detail": "生抽 SOV 同店环比降 7pp(0.55→0.48,cohort 25店),距目标 -12pp", "store_count": 30, "city_count": null },
    { "cadence": "weekly", "level": "P1", "dimension": "competitor_pressure",
      "detail": "海天端架堆头 12 店 + 买二送一 8 城,压制度 0.71(↑0.19)", "store_count": 12, "city_count": 8 },
    { "cadence": "monthly", "level": "P2", "dimension": "competitor_pressure",
      "detail": "李锦记新品薄盐醇香铺进 5 城,关注铺货走势", "store_count": null, "city_count": 5 }
  ],
  "data_quality": { "coverage": 0.89, "excluded_total": 14 },
  "flags": ["dedup_applied:大润发徐汇店-2026-06-12-端架"],
  "summary_text": "本周华东生抽统治力三处失血:①加点鲜 6 店断货(率5%>红线3%)〔P0·日〕;②SOV 同店口径周降 7pp 至 48%(cohort 25店),距目标 60% 差 12pp〔P1·周〕;③海天压制度升至 0.71——端架堆头 12 店、买二送一覆盖 8 城〔P1·周〕。另李锦记新品已进 5 城〔P2·月度关注〕。",
  "fanout": ["L6:战略差距:生抽-华东", "看板:区域统治力:华东"]
}
```

---

## 7. 分级阈值表 + 扇出(全部写死)

### 7.1 阈值表(初版,数值待真实数据校准;**改阈值只改这张表**)

| cadence | 维度 | 触发条件 | 等级 |
|---|---|---|---|
| **daily(急性)** | oos | 断货率 > 红线(`<断货率红线>`,如 3%)或单 SKU 断货 ≥ `<N_oos>` 店 | **P0** |
| daily | competitor_pressure | 同一对手端架/堆头**单日新增** ≥ `<N_突袭>` 店(突袭) | **P1** |
| **weekly(趋势)** | sov_gap | **cohort 口径**周环比下滑 ≥ `<SOV_降幅>` pp,或距目标 ≥ `<SOV_目标差>` pp | **P1** |
| weekly | facing_compliance | 达标率 < `<排面达标线>`(如 85%) | **P2** |
| weekly | competitor_pressure | 压制度 ≥ `<压制度_P1线>` 或 **cohort** 环比上升 ≥ `<压制度_升幅>` | **P1** |
| **monthly(结构)** | 铺货/oos | 铺货率 < 目标,或月断货率持续 > 红线 | **P1** |
| monthly | facing_compliance | 月达标率 < `<排面达标线_月>` | **P2** |
| monthly | competitor_pressure | 对手新品铺进 ≥ `<N_新品城>` 城 | **P2** |
| 任意 | 任意 | 该维度 `insufficient_data` 或覆盖率不足 | **最高只到"观察",不产 P0/P1** |

> 命中多行取最高;日窗口不算结构维度(§5 SHOULD)。趋势类条件一律只认 cohort 口径(v0.2)。

### 7.2 扇出规则

| 条件 | 触发下游 | 性质 |
|---|---|---|
| `alerts` 含 P0/P1 | L6 战略脑:战略差距 | 决策喂料 |
| 永远(有产出即) | 城市经理看板:区域统治力 | 视图 |
| — | **绝不**回头触发采集 / **绝不**触发应对动作 | 那是 L5-02 的活(在那边卡 HITL) |

---

## 8. HITL 卡点 —— 本节点【无】

本节点**不执行任何钱 / 权限 / 不可逆动作**,纯分析预警,没有可卡的执行点,**故无 HITL**。

- 这不是漏写。按《Agent 设计标准 §6》,HITL 卡在"高风险动作执行前"。
- 真正花钱的应对(费用申请、促销反击)在 **L5-02 增长罗盘**那边发起并卡 HITL;本节点只负责把差距和预警摆到桌面上。

---

## 9. References

### 9a. 目标主数据(示例,接真实主数据替换,经 MCP)

| 指标 | 品类/SKU | 目标 / 红线 |
|---|---|---|
| 目标 SOV | 生抽 | 0.60 |
| 排面目标 | 6MX-TJ-380 | 4 / 店 |
| 断货率红线 | 全品 | 3% |
| 铺货目标 | 按品类 × 区域 | <接主数据> |

### 9b. 压制度权重(初版拍的,待数据校准;**调权重只改这里**)

| 分量 | 权重 | 说明 |
|---|---|---|
| 端架/堆头店数占比 | w1 = 0.35 | 归并后计数 |
| 新品城市数占比 | w2 = 0.25 | 含 L0-05「竞品新品」pending 情报 |
| 降价/促销 SKU 占比 | w3 = 0.20 | price_type=promo 与降价动作 |
| 对手 SOV 超额(对手−自家,>0 时) | w4 = 0.20 | 取头号对手,pool 口径 |

### 9c. 术语表

| 术语 | 含义 | 处理 |
|---|---|---|
| 统治力 | 自家在品类的综合占优程度 | 由五维度共同刻画,不压成单一总分(避免互相掩盖) |
| SOV 差距 | 目标 SOV − 实际 SOV | 分品类,L0-02 口径,**pool 计算(v0.2)** |
| pool 口径 | Σ分子 ÷ Σ分母 | 等价按货架/门店规模加权;区别于"平均店级比率"(禁) |
| 同店 cohort | 两窗口都有有效数据的同一批门店 | 趋势唯一合法口径(v0.2);区别于全量口径(仅参考) |
| 头号对手 | 当期 scope 内 pool SOV 最大的具名品牌 | 趋势锁同名对比;易主标 top_comp_changed(v0.2) |
| 压制度 | 对手攻势的加权得分(0~1) | §9b 写死公式;附构成明细可下钻 |
| 跨源归并 | (store,date,loc) 同键事实算一次 | L0-02 升级标记带 src:L0-02,正为此预留 |
| 观察值 | 数据不完整时的非预警输出 | 进看板灰显,不进 alerts P0/P1 |

### 9d. 踩坑记录(每次撞墙补一条)

- ❌ 海天同一个端架堆头,L0-02 报一次、L0-05 报一次,压制度按 24 店算(实际 12)→ ✅ Step A2 按 (store,date,loc) 归并,留 dedup_applied 溯源。
- ❌ 店没报数当 0 算 → 断货率/达标率虚低,"没报"被当"没问题" → ✅ no_data 剔出分母,coverage 单独记。
- ❌ 让 LLM"综合感觉"一个压制度 → 同样数据每天不同分,趋势线全废 → ✅ §9b 写死加权公式,LLM 只写摘要。
- ❌ 3 家店的样本画出"SOV 暴跌"趋势 → 噪音当信号 → ✅ 最小样本量 + insufficient_data,不足不画线。
- ❌ 目标主数据缺,拿上月均值顶替算差距 → 差距失真且没人发现 → ✅ target_missing 硬标,不猜不顶。
- ❌(v0.2)区域 SOV 用 30 家店 own_pct 简单平均 → 5 排面小店和 20 排面大店一票一票,大店失守被小店良好稀释 → ✅ pool 分子分母再求比;脚本禁 mean(店级比率)。
- ❌(v0.2)本周 30 店 vs 上周 25 店直接相减画趋势 → 新进 5 店拉低均值被读成"SOV 下滑" → ✅ 趋势只在两窗口交集 cohort 上算,门店进出不进趋势。
- ❌(v0.2)上期最大对手是海天、本期李锦记冲上来,"vs 最大者"差距突变被读成"我们恶化了" → ✅ 锁定具名品牌跨期对比;易主标 top_comp_changed 单列,不混进差距。
- _(后续迭代继续往下加)_

---

## 10. Scripts — 对齐 / 归并 / 差距 / 分级(数字全在这,出件前必跑校验)

```python
# ---------- 骨架一:对齐 ----------
def join_sources(l002: list, l005: list, l001: list) -> dict:
    """按 (store, date) 建事实表;缺源记 no_data,不当 0。"""
    facts = {}
    for r in l002: facts.setdefault((r["store"], r["date"]), {})["shelf"] = r
    for r in l005: facts.setdefault((r["store"], r["date"]), {})["comp"] = r
    for r in l001: facts.setdefault((r["store"], r["date"]), {})["inv"] = r
    return facts

# ---------- 骨架二:跨源归并 ----------
def dedup_special_loc(facts: dict) -> tuple[set, list]:
    """同 (store,date,loc) 的端架/堆头事实算一次;返回(归并键集, 溯源flags)。"""
    seen, flags = set(), []
    for (store, date), src in facts.items():
        for origin in ("shelf", "comp"):
            for loc in extract_special_locs(src.get(origin)):   # 端架/堆头
                key = (store, date, loc)
                if key in seen:
                    flags.append(f"dedup_applied:{store}-{date}-{loc}")
                seen.add(key)
    return seen, flags

# ---------- v0.2 口径铁律:pool 聚合,禁平均店级比率 ----------
def pooled_ratio(stores: list, num_key: str, den_key: str) -> float | None:
    """一切比率 = Σ分子 ÷ Σ分母。本文件中不存在、也不许新增 mean(店级比率) 的函数。"""
    num = sum(s[num_key] for s in stores)
    den = sum(s[den_key] for s in stores)
    return round(num/den, 2) if den else None

def pooled_sov(stores: list, category: str) -> dict | None:
    """区域/品类 SOV:pool 各店排面。stores 元素含 own_facings/comp_facings(已过完整性过滤)。"""
    own = sum(f["facings"] for s in stores for f in s["own_facings"] if f["category"] == category)
    comp_by_brand = {}
    for s in stores:
        for f in s["comp_facings"]:
            if f["category"] == category:
                comp_by_brand[f["brand"]] = comp_by_brand.get(f["brand"], 0) + f["facings"]
    total = own + sum(comp_by_brand.values())
    if total == 0:
        return None
    return {"own_pct": round(own/total, 2),
            "by_brand": {b: round(v/total, 2) for b, v in comp_by_brand.items()},
            "basis": "pooled_facings"}

# ---------- v0.2 头号对手:锁定具名品牌 ----------
def top_comp(cur_by_brand: dict, prev_locked_brand: str | None) -> dict:
    """头号对手 = 当期 pool SOV 最大的具名品牌;跨期对比锁同名;易主标 changed。"""
    if not cur_by_brand:
        return {"brand": None, "comp_sov": None, "changed": False}
    brand = max(cur_by_brand, key=cur_by_brand.get)
    changed = prev_locked_brand is not None and brand != prev_locked_brand
    return {"brand": brand, "comp_sov": cur_by_brand[brand],
            "prev_brand": prev_locked_brand, "changed": changed}
    # 趋势比较时:本期[brand] vs 上期[同一 brand],绝不本期最大 vs 上期最大

# ---------- v0.2 趋势:同店 cohort ----------
def cohort_trend(cur_stores: dict, prev_stores: dict, calc, min_n: int) -> dict:
    """cur/prev = {store_id: 店级原料};趋势只在交集 cohort 上 pool 计算。"""
    cohort = sorted(set(cur_stores) & set(prev_stores))
    if len(cohort) < min_n:
        return {"insufficient_data": True, "cohort_stores": len(cohort)}
    cur_v  = calc([cur_stores[s]  for s in cohort])   # cohort 内 pool 本期
    prev_v = calc([prev_stores[s] for s in cohort])   # cohort 内 pool 上期
    if cur_v is None or prev_v is None:
        return {"insufficient_data": True, "cohort_stores": len(cohort)}
    delta = round(cur_v - prev_v, 2)
    return {"cohort_stores": len(cohort), "prev": prev_v, "delta": delta,
            "direction": "up" if delta > 0 else "down" if delta < 0 else "flat"}

# ---------- 差距 / 压制度 ----------
def dim_gap(actual, target):
    if target is None:
        return {"actual": actual, "target": None, "gap": None, "flag": "target_missing"}
    return {"actual": actual, "target": target, "gap": round(actual - target, 2)}

def pressure_score(c, W):   # W = §9b 权重
    s = (W["w1"]*c["special_loc_ratio"] + W["w2"]*c["new_sku_city_ratio"]
         + W["w3"]*c["price_cut_ratio"] + W["w4"]*max(c["comp_sov_excess"], 0))
    return round(min(s, 1.0), 2)

# ---------- 分级(照 §7.1 表,表驱动;趋势项只认 cohort) ----------
THRESHOLDS = [  # (cadence, dimension, predicate, level) —— 与 §7.1 一一对应,改表即改行为
    ("daily",   "oos",  lambda d: d["rate"] > REDLINE_OOS or d["oos_stores"] >= N_OOS, "P0"),
    ("daily",   "competitor_pressure", lambda d: d.get("new_special_today", 0) >= N_RAID, "P1"),
    ("weekly",  "sov_gap", lambda d: cohort_delta(d) <= -SOV_DROP
                                     or (d["gap"] is not None and d["gap"] <= -SOV_TGT_GAP), "P1"),
    ("weekly",  "facing_compliance", lambda d: d["rate"] < FACING_LINE, "P2"),
    ("weekly",  "competitor_pressure", lambda d: d["score"] >= PRESS_P1
                                     or cohort_delta(d) >= PRESS_RISE, "P1"),
    ("monthly", "competitor_pressure", lambda d: d.get("new_sku_cities", 0) >= N_NEW_CITY, "P2"),
    # ……monthly 铺货/达标行同理,接主数据后补全
]

def cohort_delta(d):
    """趋势触发只认 cohort 口径;insufficient/全量口径不触发。"""
    t = d.get("trend") or {}
    if t.get("insufficient_data"):
        return 0
    return t.get("delta", 0)

def grade(window: str, dims: dict) -> list:
    alerts = []
    for cad, dim, pred, level in THRESHOLDS:
        if cad != window:           # 节奏路由:日窗口不跑周/月行
            continue
        d = dims.get(dim)
        if not d: continue
        if d.get("data_quality", {}).get("coverage", 1) < MIN_COVERAGE or d.get("insufficient_data"):
            continue                 # MUST: 不完整数据不触发 P0/P1(观察值另路输出)
        if pred(d):
            alerts.append({"cadence": cad, "level": level, "dimension": dim})
    return alerts

# ---------- 出件前校验 ----------
def validate(out: dict) -> list[str]:
    errs = []
    # MUST: 目标缺失必须有标记,gap 必须为 null
    for name, d in out.get("by_dimension", {}).items():
        if d.get("target") is None and d.get("gap") is not None:
            errs.append(f"gap_without_target:{name}")
        if d.get("target") is None and \
           not any(f.startswith("target_missing") for f in out.get("flags", [])):
            errs.append(f"target_missing_unflagged:{name}")
        # ---- v0.2: 比率必须可由 pool 原料复算(防平均店级比率混入) ----
        if d.get("basis") not in (None, "pooled_facings", "pooled_stores"):
            errs.append(f"non_pooled_basis:{name}")
        if "_store_level_inputs" in d:   # 评测/抽检时附原料,可复算
            recheck = pooled_recompute(d["_store_level_inputs"], name)
            if recheck is not None and recheck != d.get("actual", d.get("rate")):
                errs.append(f"ratio_not_pooled:{name}")
        # ---- v0.2: 趋势必须 cohort 口径,全量口径不得入趋势字段 ----
        t = d.get("trend") or {}
        if t and not t.get("insufficient_data") and "cohort_stores" not in t:
            errs.append(f"trend_without_cohort:{name}")
    # ---- v0.2: 头号对手锁定与易主标记成对 ----
    vt = out.get("by_dimension", {}).get("sov_gap", {}).get("vs_top_comp") or {}
    if vt.get("changed") and \
       not any(f.startswith("top_comp_changed") for f in out.get("flags", [])):
        errs.append("top_comp_changed_unflagged")
    if not vt.get("changed") and vt.get("prev_brand") and vt.get("brand") != vt.get("prev_brand"):
        errs.append("top_comp_drift_undetected")
    # MUST: alerts 等级必须能由阈值表重放复现(防临场定级)
    replay = {(a["cadence"], a["dimension"], a["level"])
              for a in grade(out["window"], out.get("by_dimension", {}))}
    got = {(a["cadence"], a["dimension"], a["level"]) for a in out.get("alerts", [])}
    if not got <= replay | OBSERVE_SET:
        errs.append("alert_not_reproducible_from_table")
    # MUST: 覆盖率不足的维度不得出现在 P0/P1
    for a in out.get("alerts", []):
        d = out["by_dimension"].get(a["dimension"], {})
        if a["level"] in ("P0", "P1") and \
           d.get("data_quality", {}).get("coverage", 1) < MIN_COVERAGE:
            errs.append(f"alert_on_insufficient_data:{a['dimension']}")
    # MUST: 跨源归并溯源 —— 双源同位事实存在时必须有 dedup_applied
    if out.get("_dual_source_special_locs") and \
       not any(f.startswith("dedup_applied") for f in out.get("flags", [])):
        errs.append("dedup_missing")
    # MUST: summary 数字可溯源(抽检:summary 中数字须存在于 JSON 序列化文本)
    import re, json
    body = json.dumps(out["by_dimension"], ensure_ascii=False) + json.dumps(out["alerts"], ensure_ascii=False)
    for num in re.findall(r"\d+\.?\d*", out.get("summary_text", "")):
        if num not in body and num not in out.get("period",""):
            errs.append(f"summary_number_unsourced:{num}")
    # MUST: 扇出不得含采集指令或应对动作
    for f in out.get("fanout", []):
        if any(f.startswith(p) for p in ("补拍", "重报", "补货:", "费用", "促销应对")):
            errs.append(f"illegal_fanout:{f}")
    return errs
```

---

## 11. 评测起手式(Eval Starter)

> 离线建设期做。攒 4~8 周真实三源批量数据,跑本 Skill 对人工核算的差距/预警打分,错误回补 §5 / §7.1 / §9。先放 11 条种子。

**样例格式:**
```json
{ "id": "...", "input": { "window": "...", "l0_02": [...], "l0_05": [...], "l0_01": [...], "targets": {...} }, "expect": { ... }, "tags": ["场景"] }
```

**种子样例(11 条):**
```json
[
 {"id":"g01",
  "input":{"window":"weekly",
           "l0_02":"30店生抽排面数据,pool 后 own 0.48(上周同店 cohort 0.55);3店特级排面<4",
           "l0_05":"海天金标买二送一8城;李锦记薄盐新品5城",
           "l0_01":"加点鲜6店断货/120店",
           "targets":{"sov_生抽":0.60,"facing_6MX-TJ-380":4,"oos_redline":0.03}},
  "expect":{"sov_gap":{"actual":0.48,"gap":-0.12,"trend_delta":-0.07,"basis":"pooled_facings"},
            "alerts_contains":[{"cadence":"weekly","level":"P1","dimension":"sov_gap"},
                               {"cadence":"daily","level":"P0","dimension":"oos"}],
            "summary_numbers_sourced":true},
  "tags":["综合:范例数据全流程"]},

 {"id":"g02",
  "input":{"window":"daily","l0_01":"6MX-JDX 6店断货/120店","targets":{"oos_redline":0.03}},
  "expect":{"oos":{"rate":0.05},"alerts":[{"cadence":"daily","level":"P0","dimension":"oos"}]},
  "tags":["断货日预警:率超红线→P0,照表不临场"]},

 {"id":"g03",
  "input":{"window":"daily",
           "l0_02":"大润发徐汇店端架被海天占(src:L0-02 升级标记)",
           "l0_05":"大润发徐汇店海天金标端架堆头(action)"},
  "expect":{"pressure_components":{"端架堆头":{"stores":1}},
            "flags_contains":"dedup_applied:大润发徐汇店",
            "not_double_counted":true},
  "tags":["跨源归并:同店同日同位,两源各报一次→只算1店"]},

 {"id":"g04",
  "input":{"window":"weekly","l0_02":"蚝油 own_pct 0.30,30店","targets":{"sov_蚝油":null}},
  "expect":{"sov_gap":{"actual":0.30,"target":null,"gap":null},
            "flags_contains":"target_missing","no_fabricated_target":true},
  "tags":["目标缺失:标 target_missing,不猜不拿均值顶"]},

 {"id":"g05",
  "input":{"window":"weekly",
           "l0_02":"生抽数据30店中12店 photo_quality_low 或 complete:false,有效仅18店,覆盖率0.60(<最小覆盖率0.7)且 own_pct 暴跌"},
  "expect":{"sov_gap_data_quality":{"coverage":0.60,"excluded":12},
            "no_P0_P1_alert_on_this_dim":true,"observation_only":true},
  "tags":["不完整数据降权:只出观察值,不拉战略警报"]},

 {"id":"g06",
  "input":{"window":"weekly","l0_02":"仅3店有生抽SOV数据(最小样本量10),环比看似-9pp"},
  "expect":{"trend":"insufficient_data","no_trend_alert":true},
  "tags":["最小样本量:3店不画趋势线,噪音不当信号"]},

 {"id":"g07",
  "input":{"window":"monthly",
           "l0_05":"李锦记薄盐醇香新品铺进5城(含 pending「竞品新品」情报)",
           "l0_02":"特级月达标率0.78(线0.85)"},
  "expect":{"alerts_contains":[{"cadence":"monthly","level":"P2","dimension":"competitor_pressure"},
                               {"cadence":"monthly","level":"P2","dimension":"facing_compliance"}]},
  "tags":["月度结构差距:新品攻势+达标率,P2 节奏"]},

 {"id":"g08",
  "input":{"window":"daily","l0_02":"生抽周环比-7pp(周级信号)"},
  "expect":{"alerts":[],"no_weekly_rule_fired_in_daily_window":true},
  "tags":["节奏路由:日窗口不触发周级阈值,反向同理"]},

 {"id":"g09",
  "input":{"window":"weekly",
           "l0_02":"两店:大店A生抽总排面20、自家4(店级own_pct 0.20);小店B总排面5、自家4(店级own_pct 0.80)"},
  "expect":{"sov_gap":{"actual":0.32,"basis":"pooled_facings"},
            "not_simple_average":true,
            "note":"pool=(4+4)/(20+5)=0.32;平均店级=(0.20+0.80)/2=0.50 是错的"},
  "tags":["v0.2-①:pool ≠ 平均——大店失守不被小店良好稀释"]},

 {"id":"g10",
  "input":{"window":"weekly",
           "l0_02":"本周30店(其中新进5店SOV偏低);上周25店。同店25店 cohort:本周0.54 vs 上周0.55;全量口径本周0.48"},
  "expect":{"trend":{"cohort_stores":25,"prev":0.55,"delta":-0.01},
            "no_sov_drop_alert":true,
            "all_stores_view_separate":true},
  "tags":["v0.2-②:同店 cohort 才是趋势——新进店拉低全量,不得伪装成下滑(-0.01 不触发,-0.07 假象被拆穿)"]},

 {"id":"g11",
  "input":{"window":"weekly",
           "l0_02":"上期头号对手海天 comp_sov 0.41(锁定);本期李锦记冲到 0.43 成为最大,海天 0.40"},
  "expect":{"vs_top_comp":{"brand":"李锦记","prev_brand":"海天","changed":true},
            "flags_contains":"top_comp_changed:海天→李锦记",
            "no_gap_jump_alert_from_brand_switch":true},
  "tags":["v0.2-③:头号对手易主→标 changed 单列;换对手不伪装成差距恶化"]}
]
```

**打分维度(每条 0/1):**
1. 对齐正确(no_data 不当 0,coverage 准确)
2. 跨源归并正确(g03 不双算,留溯源)
3. **pool 口径正确**(g09:Σ分子÷Σ分母,非平均店级比率;§10 复算一致)
4. 差距计算与目标处理正确(g01 数值、g04 不猜目标)
5. **趋势 cohort 口径正确**(g10:同店对比,全量分开标,门店进出不入趋势)
6. **头号对手锁定正确**(g11:易主标 changed,不混进差距)
7. 阈值分级可复现(g02/g07,§10 重放一致)
8. 不完整数据不触发 P0/P1(g05)+ 最小样本量(g06)
9. 节奏路由正确(g08 窗口与阈值行匹配)
10. summary 数字全可溯源(g01,§10 抽检过)
11. JSON 过 §10 校验、扇出无非法指令

> 跑完看哪一维最常错 —— 那一维就是下一轮要补的 MUST/阈值/踩坑。**阈值表和压制度权重是初版拍的,前 4 周用真实数据回测校准,预警太吵调高、漏报调低,只改 §7.1/§9b 两张表。**

---

## 待填变量(套用时替换)
- `owner` — 本 Skill 负责人/团队
- §7.1 全部阈值(`<断货率红线>` `<N_oos>` `<N_突袭>` `<SOV_降幅>` `<SOV_目标差>` `<排面达标线>` `<压制度_P1线>` `<压制度_升幅>` `<N_新品城>` 等)— 真实数据回测后定
- `<最小覆盖率>` / `<最小样本量>` — 数据质量门槛(cohort 同用)
- §9a 目标主数据 / §9b 压制度权重 — 经 MCP 接真实主数据;权重回测校准
- 区域/城市层级定义 — 与门店主数据的组织维度对齐
