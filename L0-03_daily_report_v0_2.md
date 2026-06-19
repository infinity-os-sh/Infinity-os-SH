---
name: daily-report-aggregation
description: 把一个美顾在一家门店当天产生的多条零散上报(库存、断货、竞品、陈列、客流、试吃/活动、已执行动作)汇总归一成一份结构化门店日报 + 人可读摘要。凡涉及"门店日报、当日汇总、收工汇报、巡店总结、城市经理看板喂料、把今天的上报合成一份"的输入都用本 Skill,即使没说"日报"二字也要触发。它是门店运营线的汇总节点(L0-03),上游吃 L0-01 库存 JSON、L0-05 竞品 JSON 和当日文字;下游给城市经理看板、统治力差距、补货汇总视图读。
version: v0.2
owner: <填:负责人/团队>
type: Workflow / Skill(汇总节点 · L0-03)
status: 粗糙版 v0.2,待真实数据迭代
upstream: 美顾当日多条文字上报 + L0-01 库存 JSON + L0-05 竞品 JSON
downstream: 城市经理看板 / 统治力差距 Skill / 补货 Skill(汇总视图,非实时触发)
backlog: L0-03
---

# 门店日报汇总 Skill v0.2 · 汇总节点(L0-03)

> 本 Skill 依据《INFINITY OS · Agent 设计标准 v1.0》编写。
> 它是一个 **Workflow**(写死轨道),不是 Agent —— 日报汇总每天同构、类别固定、下游可预测,要的是稳、可对账、不重复触发。

> **v0.2 变更摘要:** ①定义聚合主键 store+date 与多美顾/多店规则;②「完全无上报」判为疑似漏巡而非空报;③区分去重与冲突,冲突标 discrepancy 复核;④P0/P1/P2 预警等级写死成表;⑤定义当日 cutoff、迟到并入与重跑幂等。

---

## 1. 角色与目标

你是门店运营线的**汇总节点**。唯一职责:把一个美顾在一家店当天的所有零散上报,合并成一份城市经理一眼能扫、数据中台能直接吃的标准化日报。

- 你是**汇总器,不是第二个解析器**。库存/竞品已经有 L0-01 / L0-05 的结构化 JSON 了 —— 你**对账、去重、补缺**,不重新从文字里解析一遍。
- 你**只汇总,不下单、不发实时预警、不写战报**。实时补货/断货预警在 L0-01 已经触发过了,你**绝不重复触发**,只产汇总视图喂看板。
- 你的产出物 = 标准 JSON + 人可读摘要两份,缺一不可。
- 拿不准的不要瞎编;按规则停下、打标记。

---

## 2. 输入(Input · 三路汇入)

| 来源 | 形式 | 说明 |
|---|---|---|
| 当日文字 | 语音转写 / 手输 | 美顾一天攒下来的口语流水,混了多类信息 |
| L0-01 库存 JSON | Artifact | **库存/断货的真相源**,直接读 `items` |
| L0-05 竞品 JSON | Artifact | **竞品动作的真相源**,直接读 `competitor` |
| 货架照 | 可选 | 用增强型 LLM 视觉辅助核对陈列/动销 |
| 元数据 | 门店、美顾 ID、日期 | 由通道自动带入 |

> 三路都可能缺。文字必到;两个上游 JSON 可能当天没产(没库存/竞品上报),那对应区块就空,不要硬造。
> 同一 (store, date) 可能由**多个美顾**分别汇入,全部并入同一份日报(见 §4 Step A0);cutoff 之后到达的算迟到,仍并入当日(见 §4 Step E)。

---

## 3. 参数定义(Parameters)

| 字段 | 类型 | 允许值 / 说明 |
|---|---|---|
| `store` | string | 门店名(归一到门店主数据)。**与 `date` 共同构成汇总主键** |
| `date` | string | `YYYY-MM-DD`(当日)。**与 `store` 共同构成汇总主键** |
| `advisor_id` | string | 主报美顾 ID(单美顾时填;多美顾时为主报或留空) |
| `advisors` | string[] | 当日参与该店上报的全部美顾(一店多美顾时填) |
| `revision` | number | 同 (store,date) 的产出版次,从 1 起;**重跑覆盖不新增**(见 §4 Step E) |
| `sources` | string[] | 输入来源追溯,如 `["L0-01:rpt_xx","L0-05:rpt_yy","free_text"]` |
| `inventory.abnormal` | object[] | 只收异常项(low/out_of_stock):sku / qty / conf / status / src |
| `competitor` | object[] | brand / sku / loc / act / scale(透传 L0-05) |
| `display` | object[] | side(`own`/`comp`) / sku / loc / note(自家陈列动作) |
| `sell_through` | object[] | sku / signal(`hot`/`slow`) / note(动销定性) |
| `traffic` | object | level(`high`/`normal`/`low`) / note(客流定性) |
| `events` | object[] | type(`试吃`/`促销`/`活动`) / count / note |
| `executed` | string[] | 美顾当日已执行动作(物料补充、通知补货等) |
| `alerts` | object[] | level(`P0`/`P1`/`P2`) / type / detail(需上级关注,等级见 §7) |
| `flags` | string[] | 异常标记,如 `discrepancy:6MX-TJ-380` / `late_merged` / `suspected_missed_patrol` |
| `summary_text` | string | 人可读摘要(固定段落顺序) |

---

## 4. 处理流程(Steps · 摄取对账 → 路由 → 链式 → 摘要)

### Step A — 摄取、定主键与对账(Ingest & Reconcile)【本节点的命门】

**A0. 定主键与多对多归并**(v0.2 新增)
- 汇总主键 = **`store + date`**。先按主键把同店同日的所有输入归到**一份**日报。
- **一店多美顾**:同 (store,date) 的多人上报 → **merge 进同一份**;`advisors` 列全员,各条信息保留来源美顾以便溯源。不为每个美顾各出一份。
- **一美顾多店**:同一美顾当天跑了多家店 → 按 `store` **拆成多份**日报,各自独立主键,**绝不跨店混进一份**。

**A1. 真相源**:**库存以 L0-01 JSON 为真相源,竞品以 L0-05 JSON 为真相源**,直接透传其结构化字段。

**A2. 去重(处理"重复")**:扫文字,凡提到的库存/竞品**若已在上游 JSON 出现且不矛盾 → 不新建条目**,只允许补上游缺的字段。

**A3. 冲突(处理"矛盾",v0.2 新增 —— 与去重是两件事)**:当 L0-01 快照与当日文字**数值/状态打架**(尤其文字时间更新,如快照"剩8瓶"、文字"刚补满了"):
- **不得用陈旧快照静默覆盖现场变化**,也不得擅自二选一。
- 标 `discrepancy:{sku}` 进 `flags`,并出一条 `数据冲突` alert(等级见 §7)供人工复核。

**A4. 补缺**:文字里上游 JSON **没有**的库存/竞品 → 补一条,标 `src:"free_text"`、`conf` 降级(美顾口述未经 L0-01 归一,可信度低)。

**A5. 漏巡检测(v0.2 新增)**:若**三路输入全空**(无 L0-01、无 L0-05、文字也为空)→ 这**不是空报**,是**疑似漏巡**,出 `漏巡` 预警(见 §7),不得静默放过。
> 注意区分:文字明确说了"今天没事/货挺满/客流一般" = 真·空报(normal,不报漏巡);**啥也没收到** = 疑似漏巡。

### Step B — 路由文字剩余(Routing)
把文字里上游不覆盖的部分,分流进:`陈列` · `动销` · `客流` · `试吃/活动` · `已执行`。

### Step C — 链式归一(Chaining)
1. **认货归一** — 动销/陈列里出现的产品也要归一到 SKU 编码。**【闸门】归一不到 → 停,打 `sku_unresolved`,不许编码。**(SKU 主数据引用 L0-01 §9,见本文件 §9。)
2. **定性化** — 把主观量词转信号:动销"不错"→`hot`、"压货"→`slow`;客流"比平时旺"→`high`。**不强行量化主观判断。**
3. **抽数** — 试吃/活动有份数就抽(`count`),无则记 note。

### Step D — 生成预警(Alerts · 写死规则)
按 **§7 预警等级判定表** 把断货 / 竞品 / 冲突 / 漏巡 / 低库存等提进 `alerts`,等级照表查,**不靠 AI 临场判断**。

### Step E — 出件、当日边界与幂等(Emit · v0.2 新增边界规则)
1. 按 §6 输出 JSON + 摘要;先跑 §10 校验,过了才出件。
2. **当日 cutoff** = `<当日cutoff>`(占位,如本地时区当日 23:59)。cutoff 之后到达的上报 = **迟到**,仍并入对应 `date` 的那份日报,标 `late_merged`,并 `revision += 1`。
3. **幂等**:对同一 `(store,date)` 主键的重跑,**覆盖**(upsert)既有日报,**不新增第二份**;`revision` 自增记录第几次产出。

---

## 5. 规则与强度(RFC2119)

| 强度 | 规则 |
|---|---|
| **MUST** | 库存以 L0-01、竞品以 L0-05 的 JSON 为唯一真相源;文字里重复的**必须去重,不得重复建条目**。 |
| **MUST** | 断货项(`out_of_stock`)必须进 `alerts`(P0),并继承 L0-01 的标记。 |
| **MUST** | 输出必须同时产 **结构化 JSON + 人可读摘要** 两份,缺一不出件。 |
| **MUST** | `sources` 必须记录所有实际汇入的来源(可追溯)。 |
| **MUST** | 动销/陈列里的口语 SKU 必须归一;归一不到必须停并打标记,**严禁编造编码**。 |
| **MUST** | 汇总主键 = `store + date`;**一店多美顾 merge 进同一份、一美顾多店拆成多份,绝不跨店混并**。 |
| **MUST** | 三路输入**全空**(无上游 JSON 且文字为空)→ **不得当空报静默**,必须产 `漏巡` 预警(P1)。 |
| **MUST** | L0-01 快照与现场文字**矛盾**时,必须标 `discrepancy` 进 `flags` 并出 `数据冲突` alert,**不得用陈旧快照覆盖现场**(区别于去重)。 |
| **MUST** | 同 `(store,date)` 重跑必须**覆盖**(幂等 upsert),不得新增第二份;cutoff 后迟到上报并入当日并标 `late_merged`、`revision += 1`。 |
| **MUST NOT** | **绝不重复触发实时下单/预警** —— 那是 L0-01 的活。本节点扇出只喂看板与分析视图。 |
| **SHOULD** | 客流/动销为美顾主观判断时,应标为定性信号,不强行换算成精确数字。 |
| **SHOULD** | 试吃/活动应记份数,无则记原因;摘要应按 §6 固定段落顺序便于城市经理扫读。 |
| **SHOULD** | 文字补的库存/竞品(`src:free_text`)应降 `conf`,与 L0-01 归一过的区分开。 |
| **MAY** | 已执行的物料动作(补爆炸卡)可记入 `executed`,非核心决策必需项。 |

---

## 6. 输出(Output · Artifact 契约)

下游唯一认这份结构。字段缺失用 `null` 或空数组,不要省略键。

```json
{
  "store": "大润发徐汇店",
  "date": "2026-06-12",
  "revision": 1,
  "advisor_id": "MG-0420",
  "advisors": ["MG-0420"],
  "ts": "2026-06-12T18:30:00+08:00",
  "sources": ["L0-01:rpt_0612a", "L0-05:rpt_0612c", "free_text"],
  "inventory": {
    "abnormal": [
      { "sku": "6MX-TJ-380", "qty": 8, "conf": "low", "status": "low", "src": "L0-01" },
      { "sku": "6MX-JDX", "qty": 0, "conf": "high", "status": "out_of_stock", "src": "L0-01" }
    ]
  },
  "competitor": [
    { "brand": "海天", "sku": "金标生抽", "loc": "端架", "act": "堆头", "scale": "large", "src": "L0-05" }
  ],
  "display": [],
  "sell_through": [
    { "sku": "6MX-QY-500", "signal": "hot", "note": "剩半排,动销不错" }
  ],
  "traffic": { "level": "high", "note": "比平时旺" },
  "events": [
    { "type": "试吃", "count": 30, "note": "中午" }
  ],
  "executed": ["补爆炸卡", "通知店员从仓库补货:6MX-TJ-380"],
  "alerts": [
    { "level": "P0", "type": "断货", "detail": "加点鲜 6MX-JDX 断货" },
    { "level": "P1", "type": "竞品", "detail": "海天端架金标大堆头(large),已升级喂统治力差距" },
    { "level": "P2", "type": "低库存", "detail": "特级380 6MX-TJ-380 剩约8瓶,低于安全库存" }
  ],
  "flags": [],
  "summary_text": "6/12 大润发徐汇店(MG-0420)\n【断货/库存】加点鲜(6MX-JDX)断货〔P0,已预警〕;特级380(6MX-TJ-380)货架仅剩约8瓶偏低〔P2〕,美顾已通知从仓库补货。\n【竞品】海天端架做金标生抽大堆头(大型)〔P1〕,喂统治力差距。\n【动销】轻盐500(6MX-QY-500)动销良好。\n【客流/活动】客流高于平日;中午试吃30份。\n【已执行】补爆炸卡;通知补货特级380。",
  "fanout": ["城市经理看板:日报", "统治力差距:海天金标端架堆头"]
}
```

> **摘要固定段落顺序**(城市经理扫读用):断货/库存 → 竞品 → 动销 → 客流/活动 → 已执行 →(如有)需关注预警。

---

## 7. 扇出规则 + 预警等级判定表(Deterministic Fan-out & Alert Levels)

### 7.1 扇出规则
写死的 if-then。**注意:这里全是"喂视图",不是"触发执行"。** 实时下单/预警在 L0-01 已经发生。

| 条件 | 触发下游 | 性质 |
|---|---|---|
| 永远 | 城市经理看板:写入当日日报 | 视图 |
| `competitor` 非空 | 统治力差距 Skill | 分析喂料 |
| `competitor.loc in (端架,堆头)` | 统治力差距等级 +1 | 分析喂料 |
| `inventory.abnormal` 非空 | 补货 Skill **汇总视图**(当日异常清单) | 视图,**不重复下单** |

> ❌ 反例:看到 `inventory.abnormal` 就再发一次补货触发 —— L0-01 已经发过了,会**重复订货**。本节点对补货只提供"今天这家店缺了啥"的汇总快照。

### 7.2 预警等级判定表(P0 / P1 / P2 · 写死,不靠临场判断)(v0.2 新增)

| 触发条件 | 等级 | `type` | 说明 |
|---|---|---|---|
| 任一 `status == out_of_stock` | **P0** | 断货 | 营收直接受损,最高优先,继承 L0-01 |
| 端架/堆头 竞品大动作(`scale == large`) | **P1** | 竞品 | 统治力威胁,等级已 +1 |
| L0-01 快照与文字矛盾(`discrepancy`) | **P1** | 数据冲突 | 需人工复核,防陈旧快照覆盖现场 |
| 三路输入全空(疑似漏巡) | **P1** | 漏巡 | 巡店覆盖缺口,城市经理需跟进 |
| 继承自 L0-01 的 `疑似窜货`/异常 flag | **P1** | 异常 | 透传,不自行判定 |
| `status == low`(低于安全库存,未断) | **P2** | 低库存 | 需补货但不紧急 |
| 端架/堆头 竞品中小动作(`scale != large`) | **P2** | 竞品 | 关注级,不升统治力等级 |

> 没命中表里任何一行 = 不产 alert。等级冲突时取**最高**(同一事命中多行,按 P0 > P1 > P2)。

---

## 8. HITL 卡点 —— 本节点【无】

本节点**不执行任何钱 / 权限 / 不可逆动作**,纯只读汇总,没有可卡的执行点,**故无 HITL**。

- 这不是漏写。按《Agent 设计标准 §6》,HITL 卡在"高风险动作执行前";本节点没有这类动作。
- 真正的 HITL 在**下游补货执行节点**(大额补货 / 疑似窜货)。本节点只是把 L0-01 已打的 `hitl_required` / `flags` **如实透传**进 `alerts`,供城市经理知情,不自己做停机决策。

---

## 9. References

- **SKU 主数据 / 安全库存**:引用《库存上报 Skill v0.1》§9(单一真相源,不在本文件重复维护,避免漂移)。
- **术语表**(爆炸卡=物料不计库存、端架/堆头=高价值位、排=按门店货架规格换算):引用 L0-01 §9b。

### 9c. References — 踩坑记录(每次撞墙补一条)

- ❌ 文字说"加点鲜断货了",L0-01 JSON 也有 → 库存里出现两条 → ✅ Step A2 对账去重,上游为真相源。
- ❌ 看到异常库存又发一次补货触发 → 重复订货 → ✅ §7.1 改为只喂汇总视图,实时触发归 L0-01。
- ❌ 把客流"比平时旺"硬编成"+30%" → 主观判断被伪精确化 → ✅ 只标定性 `high`。
- ❌ 把"通知店员补货"当成"已下单" → 已执行 ≠ 已下单,只记 `executed`,不触发下游。
- ❌(v0.2)两个美顾同店同日各发一份 → 出了两份日报 → ✅ 主键 `store+date`,merge 成一份,`advisors` 留全员溯源。
- ❌(v0.2)一个美顾跑了 A、B 两店,信息混进一份 → ✅ 按 `store` 拆两份,绝不跨店混并。
- ❌(v0.2)当天啥也没收到,当成"货挺满"空报放过 → 漏了漏巡 → ✅ 三路全空 = 疑似漏巡 P1,不静默(与"明确说没事"的真空报区分)。
- ❌(v0.2)L0-01 上午快照"剩8瓶",下午文字"刚补满了",直接用旧的8瓶 → 现场变化被陈旧快照盖掉 → ✅ 标 `discrepancy` + `数据冲突` alert 复核(**冲突 ≠ 去重**)。
- ❌(v0.2)美顾补传迟到上报,系统又开了一份新日报 → 同店同日两份 → ✅ cutoff 后迟到并入当日、标 `late_merged`,重跑覆盖(幂等)、`revision += 1`。
- _(后续迭代继续往下加)_

---

## 10. Scripts — 确定性校验(出件前必跑)

```python
def validate(out: dict) -> list[str]:
    """返回错误列表;非空则不得出件,转 flags。"""
    errs, seen = [], set()
    for it in out.get("inventory", {}).get("abnormal", []):
        if it["sku"] not in SKU_MASTER:                 # MUST: 编码必须存在
            errs.append(f"sku_unresolved:{it['sku']}")
        if it["sku"] in seen:                           # MUST: 去重,不许重复条目
            errs.append(f"dup_inventory:{it['sku']}")
        seen.add(it["sku"])
        if it["status"] == "out_of_stock":
            hit = any(a.get("type") == "断货" and it["sku"] in a.get("detail", "")
                      for a in out.get("alerts", []))
            if not hit:
                errs.append(f"missing_alert_oos:{it['sku']}")  # MUST: 断货必进 alerts
    for s in out.get("sell_through", []) + out.get("display", []):
        if s.get("sku") and s["sku"] not in SKU_MASTER:
            errs.append(f"sku_unresolved:{s['sku']}")
    if not out.get("summary_text"):                     # MUST: 必须有摘要
        errs.append("missing_summary")
    if not out.get("sources"):                          # MUST: 来源可追溯
        errs.append("missing_sources")
    # MUST NOT: 扇出里不许出现实时下单/预警触发词
    for f in out.get("fanout", []):
        if f.startswith("补货:") or f.startswith("断货预警:"):
            errs.append(f"illegal_realtime_trigger:{f}")  # 那是 L0-01 的活

    # ---- v0.2 新增校验 ----
    # MUST: 主键齐全
    if not out.get("store") or not out.get("date"):
        errs.append("missing_primary_key")              # store+date 是汇总主键
    # MUST: 漏巡不得静默 —— 三路全空必须有漏巡预警
    empty_all = (not out.get("inventory", {}).get("abnormal")
                 and not out.get("competitor")
                 and not out.get("sell_through") and not out.get("display")
                 and not out.get("events") and not out.get("executed")
                 and (out.get("traffic") or {}).get("level") is None)
    has_patrol_alert = any(a.get("type") == "漏巡" for a in out.get("alerts", []))
    if empty_all and not has_patrol_alert:
        errs.append("silent_empty_must_be_missed_patrol")
    # MUST: 冲突标记与冲突预警成对出现
    disc_skus = [f.split(":", 1)[1] for f in out.get("flags", []) if f.startswith("discrepancy:")]
    for sku in disc_skus:
        if not any(a.get("type") == "数据冲突" and sku in a.get("detail", "")
                   for a in out.get("alerts", [])):
            errs.append(f"discrepancy_without_alert:{sku}")
    # MUST: 幂等 —— 迟到并入必须带版次
    if "late_merged" in out.get("flags", []) and out.get("revision", 1) < 2:
        errs.append("late_merge_without_revision_bump")
    return errs
```

---

## 11. 评测起手式(Eval Starter)

> 离线建设期做。攒 50 条真实当日上报(配齐 L0-01/L0-05 JSON),跑本 Skill,对标准答案打分,错误回补进 §5 / §9c。先放 11 条种子。

**样例格式:**
```json
{ "id": "...", "input": { "text": "美顾当日原话", "l0_01": {...}, "l0_05": {...} }, "expect": { ...关键字段... }, "tags": ["场景"] }
```
> 多美顾 / 多店 / 重跑场景的 input 形态见 d07–d11(分别用 `reports[]` / `reports_by_store` / `rerun_of`)。

**种子样例(11 条):**
```json
[
 {"id":"d01",
  "input":{"text":"早上巡店,六月鲜特级380ml货架剩2排约8瓶,加点鲜断货了;海天在端架做了金标生抽大堆头;我补了爆炸卡。中午做了试吃30份,客流比平时旺。下午看轻盐500ml动销不错剩半排;特级380已通知店员从仓库补货。",
           "l0_01":{"items":[{"sku":"6MX-TJ-380","status":"low"},{"sku":"6MX-JDX","status":"out_of_stock"}]},
           "l0_05":{"competitor":[{"brand":"海天","sku":"金标生抽","loc":"端架","act":"堆头","scale":"large"}]}},
  "expect":{"inventory_abnormal_skus":["6MX-TJ-380","6MX-JDX"],
            "sell_through":[{"sku":"6MX-QY-500","signal":"hot"}],
            "traffic":{"level":"high"},"events":[{"type":"试吃","count":30}],
            "executed_contains":["补爆炸卡"],"alerts_levels":["P0","P1","P2"],"has_summary":true},
  "tags":["综合","三路汇入","对账"]},

 {"id":"d02",
  "input":{"text":"加点鲜断货了","l0_01":{"items":[{"sku":"6MX-JDX","status":"out_of_stock"}]},"l0_05":{}},
  "expect":{"inventory_abnormal_count":1},
  "tags":["去重:文字与上游重复→只算一条"]},

 {"id":"d03",
  "input":{"text":"今天没啥特别的,货挺满,客流一般","l0_01":{"items":[]},"l0_05":{}},
  "expect":{"inventory_abnormal":[],"traffic":{"level":"normal"},"alerts":[],"has_summary":true},
  "tags":["空报/正常(明确说了没事,非漏巡)"]},

 {"id":"d04",
  "input":{"text":"今天试吃50份,客流爆满","l0_01":{},"l0_05":{}},
  "expect":{"events":[{"type":"试吃","count":50}],"traffic":{"level":"high"}},
  "tags":["活动+客流定性,无库存上游"]},

 {"id":"d05",
  "input":{"text":"那个零添加生抽动销不错","l0_01":{},"l0_05":{}},
  "expect":{"flags_contains":"sku_unresolved"},
  "tags":["动销里归一失败→必须停,不许编码"]},

 {"id":"d06",
  "input":{"text":"李锦记在端架摆了个大堆头","l0_01":{},
           "l0_05":{"competitor":[{"brand":"李锦记","loc":"端架","scale":"large"}]}},
  "expect":{"alerts_contains_type":"竞品","comp_level_bump":true,"no_realtime_trigger":true},
  "tags":["竞品端架→预警升级,但只喂视图不重复触发"]},

 {"id":"d07",
  "input":{"store":"大润发徐汇店","date":"2026-06-12",
           "reports":[{"advisor_id":"MG-0420","text":"特级380货架剩2排约8瓶"},
                      {"advisor_id":"MG-0888","text":"加点鲜断货了,客流比平时旺"}]},
  "expect":{"report_count":1,"advisors":["MG-0420","MG-0888"],
            "inventory_abnormal_skus":["6MX-TJ-380","6MX-JDX"],"traffic":{"level":"high"}},
  "tags":["①一店多美顾→merge 同一份"]},

 {"id":"d08",
  "input":{"advisor_id":"MG-0420","date":"2026-06-12",
           "reports_by_store":{"大润发徐汇店":"轻盐500动销不错",
                               "家乐福古北店":"特级380断货了"}},
  "expect":{"report_count":2,
            "keys":["大润发徐汇店|2026-06-12","家乐福古北店|2026-06-12"],
            "no_cross_store_mix":true},
  "tags":["①一美顾多店→按门店拆两份,不跨店混"]},

 {"id":"d09",
  "input":{"text":"","l0_01":{},"l0_05":{}},
  "expect":{"alerts_contains_type":"漏巡","alert_level_for_漏巡":"P1","not_silent_empty":true},
  "tags":["②三路全空≠空报→疑似漏巡 P1"]},

 {"id":"d10",
  "input":{"text":"特级380下午我刚从仓库补满了","l0_01":{"items":[{"sku":"6MX-TJ-380","qty":8,"status":"low"}]},"l0_05":{}},
  "expect":{"flags_contains":"discrepancy:6MX-TJ-380","alerts_contains_type":"数据冲突","not_overwritten_by_snapshot":true},
  "tags":["③快照 vs 现场矛盾→冲突复核(非去重)"]},

 {"id":"d11",
  "input":{"rerun_of":"大润发徐汇店|2026-06-12","prior_revision":1,
           "late_text":"晚上补一句:金标生抽我们也上了端架陈列"},
  "expect":{"report_count":1,"revision":2,"flags_contains":"late_merged","display_not_empty":true},
  "tags":["⑤迟到并入+重跑覆盖幂等"]}
]
```

**打分维度(每条 0/1):**
1. 对账去重正确(d02 不重复建条目)
2. 真相源正确(库存读 L0-01、竞品读 L0-05,不重解析)
3. 定性化正确(客流/动销不伪精确,d03/d04)
4. SKU 归一正确(含 d05 该停就停)
5. alerts 等级与断货标记正确(d01/d06,按 §7.2 表)
6. 无非法实时触发(d06,§10 校验)
7. 双产出 + JSON 过 §10 校验
8. 聚合主键正确(d07 merge 一份 / d08 拆两份不跨店)
9. 漏巡检测正确(d09 不静默;d03 不误报)
10. 冲突标记正确(d10 `discrepancy` + 数据冲突 alert,区别于去重)
11. 幂等与迟到处理正确(d11 覆盖不新增、`revision++`、`late_merged`)

> 跑完看哪维最常错,那维就是下一轮要补的 MUST/术语/踩坑。两天写粗糙版,一周迭代,两周上线。

---

## 待填变量(套用时替换)
- `owner` — 本 Skill 负责人/团队
- `<当日cutoff>` — 当日截止时间(如本地时区 23:59),迟到上报并入当日的边界
- L0-01 / L0-05 Artifact 的 ID 字段名 — 接真实上游 schema 后对齐
- §9 SKU 主数据 / 术语表 — 与 L0-01 共用同一份主数据查询工具(经 MCP)
