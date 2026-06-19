---
name: dealer-health-monitor
description: 把零散信号(库存周转、回款账期、订货规律、覆盖质量、合规)合成可解释的经销商健康度,五维各自独立算分、缺维重归一(绝不拿0顶替)、加权合成带每维明细与"最拖后腿两维",月度分级与恶化预警(台账防疲劳)。凡涉及"经销商健康度、经销商风险、周转、账期逾期、订货异常、经销商管理、谁在变不健康"的输入都用本 Skill。它是经销商健康的真相源(L1-06),消费/分析节点——不派任务、不触发执行、不下单、不定性。**接口先行**:进销存与财务数据源未接入,字段口径全写死,缺维以 partial 运行。下游:大区/城市经理看板。
version: v0.1
owner: <填:负责人/团队>
type: Workflow / Skill(渠道分析节点 · 有状态健康度台账 · 接口先行 · L1-06)
status: 粗糙版 v0.1,接口先行;进销存/财务数据源未接入,以 partial 占位运行,待回测校准
upstream: 进销存数据(**未接入·占位**)/ 财务账期数据(**未接入·占位**)/ L1-03 辖区聚合 / L1-04 盲点清单 / L0-06·L1-05 合规信号(已 confirmed)/ L0-04 经销商档案(历史版)/ 权重·阈值表 / 健康度台账
downstream: 大区/城市经理看板 / 健康度台账(回写)
backlog: L1-06
---

# 经销商健康度监控 Skill v0.1 · 渠道分析节点(L1-06)

> 本 Skill 依据《INFINITY OS · Agent 设计标准 v1.0》编写。
> 它是一个 **Workflow**(写死轨道)+ **健康度台账**(有状态)。
> 回答"**哪个经销商正在变得不健康、为什么**"——关键在**为什么**:绝不出一个总分黑箱,每维独立算分、带明细、点名最拖后腿的两维。

> **⚠️ 接口先行(Interface-First):进销存与财务数据源当前未接入。** 本 Skill 把所需字段/口径/算法全部写死,数据源接入前**以 partial 占位运行**——缺维不计 0,重归一化,总分标 partial。§2 标注每字段来源系统与接入状态;§9b 权重阈值全部"初版拍的、回测校准"。这不是缺陷,是设计:接口契约先立,数据接进来即用。

---

## 1. 角色与目标 + 边界【先读这个】

你是经销商健康的**真相源**。把库存/回款/订货/覆盖/合规五类零散信号合成一个**可解释**的健康度,供大区/城市经理做经销商管理决策——健康度是体检报告,**不是处分决定**。

**与兄弟节点的边界(写死):**

| 维度信号 | 归谁 | 本节点角色 |
|---|---|---|
| 店端两率 | **L1-03(真相源)** | 消费其**经销商辖区聚合**结果,不重算 |
| 覆盖盲点 | **L1-04** | 消费其盲点清单作"覆盖质量"输入,不重算 |
| 窜货定性 | **L0-06 / L1-05** | **只读"已 confirmed 窜货次数"**作合规输入,**绝不自己判窜货** |
| 价格异常 | L0-06 | 只读涉及次数,不自判 |
| 经销商档案/层级 | L0-04 | 只读历史版 |
| 返利/账期的**钱** | L1-07(待建) | **只读账期状态,不碰资金动作** |
| 进销存 / 财务账期 | 外部系统(**未接入**) | 字段口径写死,接入前占位 |
| **健康度合成 + 分级 + 恶化预警** | **L1-06(本节点)** | 唯一产出方 |

**本节点不做:** 不派任务(L5-02)、不触发执行、不下单(L0-08)、不定性(L0-06/L1-05)、不碰资金(L1-07)。约谈/调整/收权是人看了报告自己的决定。

---

## 2. 输入(Input)— 含接入状态标注

| 维 | 字段 | 来源系统 | 状态 |
|---|---|---|---|
| ① 库存 | 周转天数 / 库销比 / A·2A·3A 达标率 / 呆滞库存占比 | 进销存 | **未接入·占位** |
| ② 回款 | 账期逾期天数·金额 / 回款及时率 | 财务 | **未接入·占位** |
| ③ 订货 | 订货频次·量 / 变异系数 / 突增突减 | 进销存 | **未接入·占位** |
| ④ 覆盖 | 辖区铺货率·动销率 | **L1-03** | 可用(其本身可能 partial) |
| ④ 覆盖 | 辖区盲点数 | **L1-04** | 可用(monthly) |
| ⑤ 合规 | confirmed 窜货次数 | **L0-06 / L1-05** | 可用(只读) |
| ⑤ 合规 | 价格异常涉及次数 | **L0-06** | 可用(只读) |
| — | 经销商档案/层级/辖区(历史版) | L0-04 | 可用 |
| — | 账期状态(只读) | L1-07 待建 | 未接入 |
| — | 权重/阈值表 / 台账 / `now` | §9b / 内部 | 可用 |

> 接入状态随系统上线更新本表;**partial 是常态,不是错误**。

---

## 3. 参数定义(Parameters)

| 字段 | 类型 | 说明 |
|---|---|---|
| `dealer_id` / `period` | string | 经销商 / 月窗口 |
| `dimensions` | object | 五维明细,每维: |
| ├ `score` | number\|null | 0–100;数据源未接入/缺数据 → **null(no_data,不计 0)** |
| ├ `status` | enum | `scored` / `no_data` |
| ├ `detail` | object | 该维原始指标(可溯源) |
| └ `weighted_loss` | number | **(100−score) × 归一后权重**——"拖后腿"排序依据 |
| `total_score` | number\|null | 加权合成(**仅 scored 维,权重重归一**);全维缺 → null |
| `coverage` | object | `{scored_dims, total_dims: 5, renormalized: true}` |
| `partial` | bool | scored 维 < 5 即 true |
| `gradable` | bool | scored 维 ≥ `<最小可分级维数>`(如 3)才 true |
| `grade` | enum\|null | `healthy/watch/at_risk/critical`;**gradable=false → null(不下重判)** |
| `worst_two[]` | string[] | **按 weighted_loss 降序的两维**(可解释性核心) |
| `trend` | object | 同一经销商纵向环比(辖区调整不伪装成变化) |
| `alerts[]` | object[] | 恶化预警(台账语义沿用 L0-07/L5-01) |
| `summary_text` | string | 一行人话;**partial 必须说明"基于 N/5 维"**(数字可溯源,沿用 L5-01) |
| `flags` / `fanout` | string[] | `data_unavailable` / `partial:N` 等;**无任何管理动作项** |

---

## 4. 处理流程(Steps · 链式,monthly)

### Step A — 取各维(标接入状态)
按 §2 取五维原料。未接入/缺数据的维 → 标 `no_data`,不取占位假数。L1-03/L1-04 本身 partial 的,其值照用但在 detail 注明上游 partial(不二次惩罚)。

### Step B — 各维独立算分(写死公式,0–100)
- ① 库存:周转/库销比/达标率/呆滞 → §9a 公式;② 回款:逾期/及时率 → §9a;③ 订货:变异系数 + 突增突减 → §9a(**大起大落本身扣分**,平稳是健康);④ 覆盖:辖区铺货率×动销率 + 盲点数(读 L1-03/L1-04);⑤ 合规:confirmed 窜货次数 + 价格异常次数 → §9a(**只读计数,绝不自判窜货**)。
- 每维产 `score` + `detail`(原始指标留痕,供溯源)。

### Step C — 缺维归一【本节点命门:no_data≠0 的加权形态】
- scored 维的权重(§9b)**重新归一化到 100%**:`w_i' = w_i / Σ(scored 维 w)`;`total = Σ(score_i × w_i')`。
- **绝不拿 0 分顶替缺维**——0 分是"差",no_data 是"不知道",拿"不知道"当"差"会让 partial 经销商系统性显得更糟。
- `weighted_loss_i = (100 − score_i) × w_i'`(归一后权重,供 worst_two)。
- **全维缺失** → 不出健康度,只出 `data_unavailable`,流程终止。

### Step D — 合成、分级、可解释(绝不黑箱)
- `total_score`(仅 scored 维)+ `coverage{scored_dims}` + `partial`。
- **分级熔断**:`scored_dims ≥ <最小可分级维数>` 才 `gradable=true` → 查 §9b 阈值表得 grade(可重放);**否则 grade=null,只给 partial 分数不下 healthy/watch/at_risk/critical**——只剩一两维不许给经销商定生死。
- `worst_two` = **按 weighted_loss 降序前两维**(不是原始分最低两维——10% 权重维拿 20 分未必比 30% 权重维拿 70 分更拖后腿)。

### Step E — 趋势 + 台账
- 趋势:**同一经销商纵向**环比(非横向比同行);经销商进出/辖区调整不伪装成健康度变化(语义沿用 cohort);仅当**可比维集合一致**时比总分,否则比各维分(避免"上月 5 维这月 3 维"的假波动)。
- 台账(沿用 L0-07/L5-01):同 dealer 同等级 active 不重发(`dedup_suppressed`,日历天重算);**跌级才响**;回升 `<R_天>` 自动解除记时长;预警只通知大区/城市经理。

### Step F — 出件
脚本产全部数字 → LLM 写 summary_text(**partial 必含"基于 N/5 维"**,worst_two 点名,数字可溯源)→ 跑 §10 → 扇出(看板/台账)→ 回写台账。

---

## 5. 规则与强度(RFC2119)

| 强度 | 规则 |
|---|---|
| **MUST** | 缺维(未接入/缺数据)必须标 no_data 且**不计入加权**,权重**重归一化**;**绝不拿 0 分顶替缺维**(no_data≠0)。 |
| **MUST** | 全维缺失只出 `data_unavailable`,不出健康度。 |
| **MUST** | 总分必须**附五维明细 + worst_two**,绝不出黑箱总分;worst_two 按归一后 weighted_loss 排序。 |
| **MUST NOT** | 合规维**只读 L0-06/L1-05 已 confirmed 的计数**,**绝不自己判窜货/价格异常**;不派任务、不触发任何经销商管理动作(约谈/调整/收权是人的决定)。 |
| **MUST** | 分级必须照 §9b 阈值表可重放;**scored 维 < `<最小可分级维数>` 时 gradable=false,grade 置 null**,不下 at_risk/critical 重判。 |
| **MUST** | partial 必须在 summary_text 标注覆盖维数("基于 N/5 维");每维 detail 必须可溯源(沿用 L5-01)。 |
| **MUST** | 趋势同一经销商纵向比,辖区/进出调整不伪装成健康度变化;可比维集合不一致时比各维不比总分。 |
| **MUST** | 各维消费上游真相源不重算(两率读 L1-03、盲点读 L1-04、合规读 L0-06/L1-05、档案读 L0-04 历史版)。 |
| **SHOULD** | 上游 partial 的维应在 detail 注明,不二次惩罚;接入状态变化应更新 §2 表。 |
| **MAY** | 可附维度雷达图数据;连续 N 月 watch+ 可加注"持续观察"。 |

---

## 6. 输出(Output · Artifact 契约)

```json
{
  "dealer_id": "DL-WH-012", "period": "2026-05", "window": "monthly",
  "dimensions": {
    "inventory":  { "score": null, "status": "no_data", "detail": "进销存未接入", "weighted_loss": null },
    "receivable": { "score": null, "status": "no_data", "detail": "财务未接入", "weighted_loss": null },
    "ordering":   { "score": null, "status": "no_data", "detail": "进销存未接入", "weighted_loss": null },
    "coverage":   { "score": 72, "status": "scored",
                    "detail": { "辖区铺货率": 0.81, "动销率": 0.70, "盲点数": 14, "上游": "L1-03/L1-04" },
                    "weighted_loss": 8.4 },
    "compliance": { "score": 55, "status": "scored",
                    "detail": { "confirmed窜货次数": 1, "价格异常涉及": 2, "来源": "L0-06/L1-05只读" },
                    "weighted_loss": 18.0 }
  },
  "coverage": { "scored_dims": 2, "total_dims": 5, "renormalized": true },
  "partial": true,
  "gradable": false,
  "grade": null,
  "total_score": 63.6,
  "worst_two": ["compliance", "coverage"],
  "trend": { "comparable_dims": ["coverage", "compliance"], "prev_total": 68.0, "delta": -4.4, "note": "仅就可比2维纵向比" },
  "alerts": [],
  "flags": ["partial:2/5", "gradable_false:维数不足不分级"],
  "summary_text": "经销商 DL-WH-012(基于 2/5 维,进销存与财务未接入):可得分 63.6,最拖后腿为合规(55,1 起 confirmed 窜货+2 次价格异常)与覆盖(72,辖区 14 盲点)。因仅 2 维不予分级,补齐进销存/回款数据后再判等级。",
  "fanout": ["看板:大区/城市经理:健康度(partial)", "台账:登记"]
}
```

> 全维接入示例:五维皆 scored → `partial:false, gradable:true, grade:"watch"`(查阈值表),worst_two 仍点名。
> 全缺示例:`{"dealer_id":..., "flags":["data_unavailable"], "total_score":null, "grade":null}`,不出维度分。

---

## 7. 节奏 + 扇出(写死)

| 项 | 规则 |
|---|---|
| 窗口 | **monthly 主窗口;weekly 不跑**——健康度变化慢,周跑只抖动 |
| 扇出 | 看板(大区/城市经理)· 台账回写 |
| 禁区 | **绝不**:派任务/触发 L5-02、约谈/调整/收权等管理动作、判窜货、碰资金(L1-07)、重算上游维度 |

---

## 8. HITL 卡点 —— 本节点【无】

体检报告不是处分——不花钱、不动人、不可逆性为零,**故无 HITL**。经销商管理动作(约谈/调整/收权)是人看报告后的决定,在管理流程里走,不在本节点。

---

## 9. References

### 9a. 五维公式表(写死;阈值待校准)

| 维 | 输入 | 算分要点 |
|---|---|---|
| ① 库存 | 周转天数/库销比/达标率/呆滞占比 | 周转越慢、呆滞越高 → 越低分;达标率正向 |
| ② 回款 | 逾期天数·金额/及时率 | 逾期越久越多 → 越低分;及时率正向 |
| ③ 订货 | 变异系数 CV / 突增突减 | **CV 越大越低分**(大起大落=风险);平稳=健康 |
| ④ 覆盖 | 铺货率×动销率 / 盲点数 | 读 L1-03/L1-04;两率正向,盲点反向 |
| ⑤ 合规 | confirmed 窜货次数 / 价格异常次数 | **只读计数**,次数越多越低分;绝不自判 |

### 9b. 权重表 + 分级阈值(初版拍的,回测校准;改只改这张表)

| 维 | 权重(占位) |
|---|---|
| ① 库存 | `<30%>` |
| ② 回款 | `<25%>` |
| ③ 订货 | `<20%>` |
| ④ 覆盖 | `<15%>` |
| ⑤ 合规 | `<10%>` |

> 缺维时按 scored 维重归一(§4C)。

| 分级 | 阈值(占位) | 含义 |
|---|---|---|
| healthy | ≥ `<85>` | 健康 |
| watch | `<70~85>` | 观察 |
| at_risk | `<50~70>` | 风险 |
| critical | < `<50>` | 危急 |

> `<最小可分级维数>` = `<3>`:scored 维不足此数只出 partial 分数,不分级。

### 9c. 术语表

| 术语 | 含义 | 处理 |
|---|---|---|
| 周转天数 | 库存周转速度 | 越慢越不健康 |
| 账期逾期 | 回款超约定期 | 维②核心 |
| 变异系数 CV | 订货波动/均值 | 越大越不健康(大起大落=风险) |
| 健康度 | 五维加权合成 | 带明细+worst_two,绝不黑箱 |
| partial | 部分维缺失 | 重归一,summary 标 N/5 |
| no_data≠0 | 不知道≠差 | 缺维不计 0,重归一 |
| 分级熔断 | 维数不足不分级 | 信息不够不下重判 |

### 9d. 踩坑记录(预置)

- ❌ 进销存没接,库存维按 0 分算进总分 → partial 经销商个个"危急" → ✅ 缺维 no_data 重归一,不计 0。
- ❌ 只剩合规一维就报 critical → 用 10% 的信息给经销商定生死 → ✅ 分级熔断:维数不足只出 partial 分不分级。
- ❌ 出一个总分 58 完事 → 大区不知道该修哪 → ✅ 必带五维明细 + worst_two。
- ❌ worst_two 按原始分最低取 → 把 10% 权重的低分维当主因,管理者去修了错的维 → ✅ 按归一后 weighted_loss 排序。
- ❌ 本节点看扫码"觉得像窜货"扣了合规分 → 自判窜货 → ✅ 只读 L0-06/L1-05 已 confirmed 计数。
- ❌ 经销商辖区上月调整,总分从 70 掉到 60 被读成"恶化" → 其实是辖区变了 → ✅ 纵向比 + 可比维一致才比总分。
- ❌ 健康度低顺手生成"约谈任务" → 越界到管理动作 → ✅ 只预警不触发,约谈是人的决定。
- _(后续迭代继续往下加)_

---

## 10. Scripts — 各维算分 / 缺维归一 / 合成 / 分级重放 / worst_two / 溯源(出件前必跑)

```python
WEIGHTS = {"inventory": W_INV, "receivable": W_REC, "ordering": W_ORD,
           "coverage": W_COV, "compliance": W_CMP}   # §9b 占位

def synthesize(dims):
    """dims: {name: {score: float|None}}。返回 total/coverage/worst_two 或 data_unavailable。"""
    scored = {k: v["score"] for k, v in dims.items() if v["score"] is not None}
    if not scored:
        return {"total_score": None, "flags": ["data_unavailable"]}
    wsum = sum(WEIGHTS[k] for k in scored)            # 重归一分母
    total, losses = 0.0, {}
    for k, s in scored.items():
        w_norm = WEIGHTS[k] / wsum                    # 缺维归一:绝不补 0
        total += s * w_norm
        losses[k] = round((100 - s) * w_norm, 2)      # weighted_loss
    worst_two = sorted(losses, key=losses.get, reverse=True)[:2]
    return {"total_score": round(total, 1),
            "coverage": {"scored_dims": len(scored), "total_dims": 5, "renormalized": len(scored) < 5},
            "partial": len(scored) < 5,
            "weighted_loss": losses, "worst_two": worst_two}

def grade_of(total, scored_dims):
    if scored_dims < MIN_GRADABLE_DIMS:               # 分级熔断
        return None
    if total >= T_HEALTHY: return "healthy"
    if total >= T_WATCH:   return "watch"
    if total >= T_RISK:    return "at_risk"
    return "critical"

def validate(out, ledger_before, now):
    errs = []
    dims = out.get("dimensions", {})
    scored = {k: v for k, v in dims.items() if v.get("status") == "scored"}
    # ===== 全缺只出 data_unavailable =====
    if not scored:
        if out.get("total_score") is not None or "data_unavailable" not in out.get("flags", []):
            errs.append("empty_not_data_unavailable")
        return errs
    # ===== 缺维不计 0,重归一可重放 =====
    syn = synthesize({k: {"score": v.get("score")} for k, v in dims.items()})
    if out.get("total_score") != syn["total_score"]:
        errs.append("total_not_renormalized")          # 缺维补0或没归一都会在此爆
    for k, v in dims.items():
        if v.get("status") == "no_data" and v.get("score") not in (None,):
            errs.append(f"no_data_dim_has_score:{k}")   # no_data 维不得有分(防补0)
    # ===== 黑箱拦截:必带明细+worst_two =====
    if out.get("total_score") is not None and not out.get("worst_two"):
        errs.append("blackbox_total_without_worst_two")
    if set(out.get("worst_two", [])) != set(sorted(syn["weighted_loss"],
                                            key=syn["weighted_loss"].get, reverse=True)[:2]):
        errs.append("worst_two_not_by_weighted_loss")   # 必须按归一后失分排序
    # ===== 分级熔断 + 可重放 =====
    g = grade_of(out.get("total_score"), len(scored))
    if out.get("grade") != g:
        errs.append("grade_not_replayable")             # 含熔断:维数不足必须 grade=null
    if len(scored) < MIN_GRADABLE_DIMS and out.get("grade") is not None:
        errs.append("graded_below_min_dims")            # 信息不足不下重判
    # ===== 合规维只读不自判 =====
    cmp = dims.get("compliance", {})
    if cmp.get("status") == "scored" and cmp.get("detail", {}).get("来源") and \
       "L0-06" not in str(cmp["detail"]["来源"]) and "L1-05" not in str(cmp["detail"]["来源"]):
        errs.append("compliance_self_judged")           # 必须来自 confirmed 计数
    # ===== partial 必须在 summary 标 N/5 =====
    if out.get("partial") and f"/{5}" not in out.get("summary_text", "") and \
       "5 维" not in out.get("summary_text", "") and "/5" not in out.get("summary_text", ""):
        errs.append("partial_not_in_summary")
    # ===== 趋势:可比维不一致不得比总分 =====
    t = out.get("trend") or {}
    if t.get("prev_total") is not None and not t.get("comparable_dims"):
        errs.append("trend_without_comparable_dims")
    # ===== 台账防重复(沿用 L0-07/L5-01) =====
    for a in out.get("alerts", []):
        key = (a["dealer_id"], a.get("metric", "health"))
        cur = ledger_before.get(key)
        if cur and cur["status"] == "active" and a["status"] == "active" and \
           a.get("grade") == cur.get("grade") and \
           "dedup_suppressed" not in str(out.get("flags", [])):
            errs.append(f"duplicate_alert:{key}")
    # ===== 边界:不触发管理动作 =====
    for f in out.get("fanout", []):
        if any(x in f for x in ("约谈", "调整", "收权", "任务", "L5-02", "扣", "断供")):
            errs.append(f"illegal_management_action:{f}")
    # ===== summary 溯源(沿用 L5-01) =====
    import re, json
    body = json.dumps(out.get("dimensions", {}), ensure_ascii=False) + str(out.get("total_score"))
    for num in re.findall(r"\d+\.?\d*", out.get("summary_text", "")):
        if num not in body and num not in out.get("period", "") and num != "5":
            errs.append(f"summary_number_unsourced:{num}")
    return errs
```

---

## 11. 评测起手式(8 条种子)

```json
[
 {"id":"h01",
  "input":{"dims":{"inventory":78,"receivable":82,"ordering":70,"coverage":72,"compliance":90},
           "weights":{"inv":0.30,"rec":0.25,"ord":0.20,"cov":0.15,"cmp":0.10}},
  "expect":{"partial":false,"total_score":"加权可重放","gradable":true,"grade":"查阈值表",
            "worst_two":"按 weighted_loss 排序","detail_present":true},
  "tags":["全维正常:加权合成可重放 + 五维明细 + worst_two,绝不黑箱"]},

 {"id":"h02",
  "input":{"dims":{"inventory":null,"ordering":null,"receivable":80,"coverage":72,"compliance":55},
           "note":"进销存两维未接入"},
  "expect":{"no_data_dims":["inventory","ordering"],"renormalized_denominator":"0.25+0.15+0.10=0.50→归一",
            "total_not_using_zero":true,"partial":true,"coverage":{"scored_dims":3}},
  "tags":["进销存缺维:不计0,权重重归一(0.50→100%),partial 标记"]},

 {"id":"h03",
  "input":{"dims":{"all":null},"note":"全维数据源都没接"},
  "expect":{"flags_contains":"data_unavailable","total_score":null,"grade":null,"no_dimension_scores":true},
  "tags":["全维缺→只出 data_unavailable,不出健康度"]},

 {"id":"h04",
  "input":{"dims":{"coverage":{"score":70,"w":0.15},"compliance":{"score":55,"w":0.10},
                   "receivable":{"score":85,"w":0.25}},
           "note":"算 weighted_loss 找最拖后腿"},
  "expect":{"weighted_loss":{"coverage":"(100−70)×归一w","compliance":"(100−55)×归一w","receivable":"(100−85)×归一w"},
            "worst_two":"按归一失分降序,非原始分最低",
            "trap":"compliance 原始分最低(55)但权重小;需看归一后失分定序"},
  "tags":["最拖后腿两维:按归一 weighted_loss 排序,不被低权重维误导"]},

 {"id":"h05",
  "input":{"compliance_signal":"本节点看到某经销商扫码异常,想直接扣合规分"},
  "expect":{"blocked":"compliance_self_judged","correct":"只读 L0-06/L1-05 已 confirmed 计数,未 confirmed 不计入"},
  "tags":["合规维只读 confirmed,绝不自判窜货"]},

 {"id":"h06",
  "input":{"now":"2026-06","dealer":"DL-WH-012",
           "ledger":{"(DL-WH-012,health)":{"status":"active","grade":"watch"}},
           "case2":"本月仍 watch 未跌级;case3:跌到 at_risk;case4:回升 healthy 连续 R 天"},
  "expect":{"replay_grade":"查阈值表","case2":{"no_new_alert":true,"dedup_suppressed":true},
            "case3":{"alert_fired":"跌级才响"},"case4":{"resolved":true}},
  "tags":["跌级预警可重放+台账防重复;回升 R 天解除(沿用 L0-07/L5-01)"]},

 {"id":"h07",
  "input":{"dealer":"DL-WH-012","prev":"5 维总分 70","now":"辖区调整后仅 3 维可比,总分 60"},
  "expect":{"trend":{"comparable_dims":"3 维","compare":"仅就可比维纵向比,不拿 5维70 vs 3维60"},
            "not_reported_as_worsening":true},
  "tags":["纵向趋势不被辖区调整污染:可比维不一致比各维不比总分"]},

 {"id":"h08",
  "input":{"scored_dims":2,"total_score":63.6},
  "expect":{"gradable":false,"grade":null,
            "summary_contains":"基于 2/5 维","no_at_risk_critical":true},
  "tags":["partial 在 summary 标 N/5;维数不足分级熔断,不下重判"]}
]
```

**打分维度(每条 0/1):**
1. 全维合成可重放 + 明细 + worst_two(h01)
2. 缺维归一不计 0(h02;§10 total_not_renormalized 断言过)
3. 全缺 data_unavailable(h03)
4. worst_two 按归一 weighted_loss(h04)
5. 合规只读不自判(h05)
6. 跌级可重放 + 台账(h06)
7. 纵向趋势不被辖区污染(h07)
8. partial 标注 + 分级熔断(h08)

> 最危险的两类错:**缺维补 0**(h02——partial 经销商个个显"危急",接口先行期天天发生)和**信息不足下重判**(h08——只剩两维就报 critical,拿不全的信息给经销商定生死)。健康度是体检不是判决,数据不全时宁可不下结论,也不下错结论。

---

## 待填变量(套用时替换)
- `owner` — 本 Skill 负责人/团队
- §9b 五维权重 / 分级阈值 / `<最小可分级维数>`(建议 3)/ 订货 CV 扣分曲线 — 全部回测校准
- 各维算分公式细节(周转/账期/CV 的分段)— 数据接入后用真实分布定
- `<R_天>` 回升解除窗口
- **进销存数据源 / 财务账期数据源** — 接入(经 MCP);接入后更新 §2 状态表
- L1-03 辖区聚合口径 / L1-04 盲点清单读取 — 对齐两节点输出契约
- 健康度台账落库 — 与既有台账同基建分表(下一本)
