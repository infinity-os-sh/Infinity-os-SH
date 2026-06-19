---
name: dashboard-aggregation
description: 把前面所有节点的输出聚合成一屏视图——晶体管状态、过闸进度(L5-03)、冲刺节拍(L5-04)、动销(L1-03)、统治力差距(L5-01)、断货预警(L0-07)、盲点(L1-04)、健康度(L1-06)、阶段(地基①)一屏看清。每个数字直接取自源节点、带 source_ref+时间戳、可溯源,看板绝不自己重算出一个数(否则两个版本的真相,体系可信度崩)。源节点时点不一致如实标 stale 不强行对齐,源缺失显示"无数据"不填猜测。供管理层/城市经理总览。凡涉及"看板、总览、一屏看清、聚合视图、dashboard、汇总、管理驾驶舱"的输入都用本 Skill。它是体系的镜子(L5-06,L5增长层/展示)——**纯聚合:不产生新判断、不重算任何数、不下结论、不派任务、不预警**。**接口先行**:各节点输出部分接入,聚合规则写死,展示口径占位。下游:管理层/城市经理(总览展示)。
version: v0.1
owner: <填:负责人/团队>
type: Workflow / Skill(L5增长层/展示 · 聚合视图 · 接口先行 · 无新判断 · L5-06)
status: 粗糙版 v0.1,接口先行;各节点输出部分接入,聚合规则写死,展示口径占位
upstream: 各源节点输出(L1-03 动销/L5-03 过闸/L5-04 冲刺/L5-01 差距/L0-07 断货/L1-04 盲点/L1-06 健康度/地基① 阶段,全部只读)
downstream: 管理层 · 城市经理(总览展示)
backlog: L5-06
---

# 数据看板 Skill v0.1 · L5增长层/展示·聚合视图(L5-06)

> 本 Skill 依据《INFINITY OS · Agent 设计标准 v1.0》编写。
> 它是一个 **Workflow**(写死轨道)——纯聚合各节点输出成一屏视图。
> 把状态/过闸/冲刺/动销/差距/预警一屏看清,供管理层总览。**镜子不是新数据源。**

> **⚠️ 三条铁律(唯一真相源):**
> ① **只聚合不重算**——每个数字必须**直接取自源节点输出**(动销取 L1-03、过闸取 L5-03、冲刺取 L5-04、差距取 L5-01、断货取 L0-07),看板**绝不自己重算出一个数**。一旦看板算出跟源节点不一致的数,就有"两个版本的真相",体系可信度崩。
> ② **每个数字可溯源**——点开能看"这个数来自哪个节点、哪次输出"(source_ref + 时间戳);看板是镜子,不是新数据源。
> ③ **不产生新判断/新结论**——呈现各节点**已有的**结论,聚合时不偷偷下新判断(不自己判"这个城市危险",只展示各节点已判的状态)。

> **⚠️ 接口先行:** 各节点输出部分接入,聚合规则写死,展示口径占位。

---

## 1. 角色与目标 + 边界【先读这个】

你是 **体系的镜子**:把各节点已有输出聚合成一屏。产出物是**聚合视图(每个数带 source_ref+时间戳)**——**镜子照出的必须和实物一模一样,绝不重算、绝不下新判断**。

**与兄弟节点边界(写死):**

| 板块 | 数字来自(只读) | 看板角色 |
|---|---|---|
| 动销/铺货 | L1-03 | 搬来展示,不重算 |
| 过闸进度 | L5-03 | 搬来展示,不重判 |
| 冲刺节拍 | L5-04 | 搬来展示,不重算 |
| 统治力差距 | L5-01 | 搬来展示 |
| 断货预警 | L0-07 | 搬来展示,不重判等级 |
| 覆盖盲点 | L1-04 | 搬来展示 |
| 经销商健康度 | L1-06 | 搬来展示 |
| 生命周期阶段 | 地基① | 搬来展示,不重判 |
| **聚合排版 + source_ref 绑定 + 时点标注** | **本节点** | 唯一职责 |

**镜子铁律:** 看板**不判阶段、不算动销、不判过闸、不下任何新结论**——这些都是源节点的事,看板只搬来展示。看板里出现的每个数字/判断,都必须能指回某个源节点的原输出。

**机器与人:** 无 HITL(纯展示,不出账不判断不可逆)。

---

## 2. 输入(Input)— 含接入状态

| 板块 | 源节点 | 状态 | 取什么 |
|---|---|---|---|
| 动销/铺货 | L1-03 | 可用 | sellthrough_rate/distribution_rate + grade |
| 过闸进度 | L5-03 | 可用 | current_gate/gate_verdict |
| 冲刺节拍 | L5-04 | 可用 | current_week/cadence_status |
| 统治力差距 | L5-01 | 可用 | 差距值/排名 |
| 断货预警 | L0-07 | 可用 | level/state |
| 覆盖盲点 | L1-04 | 可用 | 盲点数/优先级 |
| 健康度 | L1-06 | 可用 | 等级 |
| 阶段 | 地基① | 可用 | effective_stage |
| `now`(算新鲜度) | 内部 | 可用 | 时间戳对比 |

> partial 常态:源节点未接入/无输出 → 该板块格显示"无数据/待接入",**不填充猜测值**;各源时点不一致 → 如实标各自时间戳 + stale。

---

## 3. 参数定义(Parameters)

| 字段 | 类型 | 说明 |
|---|---|---|
| `view` | enum | 视角:`SKU` / `城市` / `区域` / `责任人`(§9b) |
| `view_key` | string | 该视角的主键(如城市=成都) |
| `panels[]` | object[] | 各板块,每个:`{panel_name, value, source_ref, timestamp, freshness}` |
| └ `value` | any | **直接取自源节点的值,绝不重算** |
| └ `source_ref` | string | **来自哪个节点哪次输出**(如 `L1-03:2026-W24:成都`) |
| └ `timestamp` | string | 源数据的时间(数据多新) |
| └ `freshness` | enum | `fresh` / `stale`(超过该板块更新节奏)/ `no_data` |
| `sync_note` | string\|null | 时点不一致标注(如"动销本周/过闸上周,未强行对齐") |
| `missing_panels[]` | string[] | 无数据/待接入的板块(不填猜测) |
| `status` | enum | `aggregated` / `partial`(部分板块无数据) |
| `flags` | string[] | `mirror_only`(纯镜子)/ `time_not_aligned` / `has_no_data_panels` 等 |
| `summary_text` | string | 总览,每个数字标来自哪、多新(不下新结论) |
| `fanout` | string[] | 管理层/城市经理展示;**无派任务/预警/新判断项** |

> **注意:输出里没有任何"看板自算"的字段——每个 value 必带 source_ref,无源即无值(显示 no_data)。**

---

## 4. 处理流程(Steps · 链式,纯聚合)

### Step A — 选视角(SKU/城市/区域/责任人)
按 `view` 定主键,决定从各源节点取哪个维度的输出(§9b 视角定义)。

### Step B — 从各源节点取已有输出(只读,不重算)
按 §9a 板块映射,从各源节点取**已有输出**(动销 L1-03、过闸 L5-03、冲刺 L5-04…):
- 取的是源节点**已经算好/判好的值**,看板**绝不自己重算或重判**;
- 每个值绑 `source_ref`(节点:窗口:主键)+ `timestamp`。

### Step C — 聚合排版成视图(状态总览/过闸/冲刺/预警汇总/差距榜)
按 §9a 把各板块排版;**纯排版,不在聚合层合成新判断**(不把几个预警汇总成"城市危险"——危险是新判断,源节点没说)。

### Step D — 标新鲜度 + 时点一致性(如实,不强行对齐)
- 每个板块算 `freshness`(对比 now 与 timestamp 及该板块更新节奏);
- **各源时点不一致 → 如实标 `sync_note`**(动销本周/过闸上周),**绝不强行对齐造假一致**;
- 超节奏未更新 → 标 `stale`。

### Step E — 缺失标注(显示无数据,不猜)
- 源节点无输出/未接入 → 该板块 `freshness:no_data`,进 `missing_panels`,**显示"无数据/待接入",不填猜测值**。

### Step F — 出件(纯镜子)
脚本聚合 panels + source_ref + 时间戳 → LLM 写 summary_text(总览,每个数标来自哪、多新,**不下新结论**)→ 跑 §10 → 扇出(管理层展示)。`flags+=mirror_only`。

---

## 5. 规则与强度(RFC2119)

| 强度 | 规则 |
|---|---|
| **MUST** | **每个数字必须等于源节点输出,看板绝不重算/重判**——看板值 = source_ref 指向的源值(否则两个版本的真相)。 |
| **MUST** | **每个数字必须带 source_ref(来自哪个节点哪次输出)+ 时间戳**;无源即无值(显示 no_data),不凭空出数。 |
| **MUST NOT** | **不产生新判断/新结论**——只呈现各节点已有结论;聚合层不合成新判断(不自己判"城市危险",只展示源节点已判状态)。 |
| **MUST** | **各源时点不一致如实标注(sync_note),绝不强行对齐**造假一致(动销本周/过闸上周就这么标)。 |
| **MUST** | **源缺失/unknown 显示"无数据/待接入",不填充猜测值**。 |
| **MUST NOT** | **不派任务、不预警**(预警是源节点的事,看板只聚合显示已有预警)、不重算事实、不重判阶段/过闸/等级。 |
| **SHOULD** | 应标每个板块新鲜度(fresh/stale);summary 应注明各数来源与时点。 |
| **MAY** | 可多视角切换;可附板块更新节奏说明。 |

---

## 6. 输出(Output · Artifact 契约)

```json
{
  "view": "城市", "view_key": "成都",
  "panels": [
    { "panel_name": "生命周期阶段", "value": "导入",
      "source_ref": "地基①:2026-06:加点鲜500ml@成都", "timestamp": "2026-06-14", "freshness": "fresh" },
    { "panel_name": "动销率", "value": 0.61,
      "source_ref": "L1-03:2026-W24:成都", "timestamp": "2026-06-15", "freshness": "fresh" },
    { "panel_name": "过闸进度", "value": "Gate1 passed,待推进Gate2",
      "source_ref": "L5-03:2026-06:成都武侯", "timestamp": "2026-06-10", "freshness": "stale" },
    { "panel_name": "冲刺节拍", "value": "第6周 偏离(外部冲击)",
      "source_ref": "L5-04:2026-Q3-W6:成都", "timestamp": "2026-06-15", "freshness": "fresh" },
    { "panel_name": "断货预警", "value": "P1 1条",
      "source_ref": "L0-07:2026-06-14:成都仓", "timestamp": "2026-06-14", "freshness": "fresh" },
    { "panel_name": "统治力差距", "value": "SOV落后海天8pp",
      "source_ref": "L5-01:2026-W24:成都", "timestamp": "2026-06-15", "freshness": "fresh" },
    { "panel_name": "经销商健康度", "value": "无数据/待接入",
      "source_ref": null, "timestamp": null, "freshness": "no_data" }
  ],
  "sync_note": "过闸数据为6/10(月更,较其他板块旧),未强行对齐到本周",
  "missing_panels": ["经销商健康度"],
  "status": "partial",
  "flags": ["mirror_only", "time_not_aligned", "has_no_data_panels"],
  "summary_text": "成都总览(加点鲜500ml,导入期):动销率61%(L1-03,6/15)、Gate1已过待推进Gate2(L5-03,6/10偏旧)、冲刺第6周偏离因外部冲击(L5-04,6/15)、断货P1一条(L0-07,6/14)、SOV落后海天8pp(L5-01,6/15)。健康度暂无数据。各数均来自对应源节点,过闸数据偏旧已标注。看板只搬不算,如需追因点开源节点。"
}
```

> 不重算示例:动销率显示 0.61,**等于 L1-03 输出的 0.61**,看板不重算;若看板显示 0.63 ≠ 源 → §10 `value_differs_from_source` 报错。
> 可溯源示例:每个 value 带 source_ref(节点:窗口:主键)+ timestamp。
> 不下新判断示例:看板不出"成都危险",只展示 L5-04 已判的"偏离"、L0-07 已判的"P1"——危险是新判断,源节点没说。
> 时点不一致示例:过闸 6/10、动销 6/15 → `sync_note` 如实标,不强行对齐成同一天。
> 源缺失示例:健康度无输出 → `value:"无数据/待接入", freshness:"no_data"`,进 missing_panels,不猜。

---

## 7. 节奏 + 扇出(写死)

| 项 | 规则 |
|---|---|
| 节奏 | 按需刷新(管理层查看时取各源节点最新输出)|
| 扇出 | 管理层/城市经理总览展示 |
| 禁区 | **绝不**:重算/重判任何数、产生新判断或新结论、强行对齐时点、源缺失填猜测、派任务、预警(只显示源节点已有预警) |

---

## 8. HITL 卡点 —— 本节点【无】

纯展示、不出账、不判断、不可逆性为零,**故无 HITL**。看板是镜子,只反映各源节点的状态,不做任何决定。所有判断/预警/决策都在源节点和它们各自的 HITL 那里发生过了,看板只是把结果聚到一屏。

---

## 9. References

### 9a. 板块取数映射(写死:哪个板块取哪个节点)

| 板块 | 源节点 | 取的字段 |
|---|---|---|
| 生命周期阶段 | 地基① | effective_stage |
| 动销/铺货 | L1-03 | sellthrough_rate/distribution_rate + grade |
| 过闸进度 | L5-03 | current_gate + gate_verdict |
| 冲刺节拍 | L5-04 | current_week + cadence_status |
| 统治力差距 | L5-01 | 差距值 + 排名 |
| 断货预警 | L0-07 | level + state |
| 覆盖盲点 | L1-04 | 盲点数 + 优先级 |
| 经销商健康度 | L1-06 | 等级 |

> 每格的值 = 源节点输出值,**看板不重算**;每格带 source_ref + timestamp。

### 9b. 视角定义(写死)

| 视角 | 主键 | 聚合范围 |
|---|---|---|
| SKU | sku | 该 SKU 跨城市/区域 |
| 城市 | city | 该城市所有 SKU |
| 区域 | region | 该区域 |
| 责任人 | person | 该责任人负责的 SKU×区域 |

### 9c. 新鲜度口径(写死,占位)

| freshness | 条件 |
|---|---|
| fresh | now − timestamp ≤ 该板块更新节奏 |
| stale | 超过更新节奏未更新 |
| no_data | 源节点无输出/未接入 |

> 各板块节奏不同(L1-03 周更/L5-03 月更),故时点天然不一致——如实标,不强行对齐。

### 9d. 术语 / 踩坑

| 术语 | 含义 |
|---|---|
| 镜子不是新数据源 | 看板只搬不算,值=源节点值(铁律①) |
| source_ref | 每个数来自哪个节点哪次输出(铁律②) |
| 不下新判断 | 只呈现源结论,不合成新结论(铁律③) |
| 时点如实标 | 各源节奏不同,不强行对齐 |

- ❌(铁律①,值得记)**看板自己重算了一个动销数**:为了"更准"把 L1-03 的口径调了下重算,得出 0.63 而源是 0.61 → 出现"两个版本的真相",管理层信看板、一线信 L1-03,谁都对不上 → ✅ 看板值=源节点值,绝不重算,不符报错。
- ❌(铁律②,值得记)**数字不带 source_ref**:看板显示一堆数,没人知道哪来的、多新 → 看板成了无源的"权威",出错没法追 → ✅ 每个数带 source_ref+时间戳,点开能溯源。
- ❌(铁律③,值得记)**聚合时偷偷下新判断**:把断货P1+冲刺偏离+差距落后一汇总,看板标"成都危险" → "危险"是源节点没下过的新判断,看板越权当了判断者 → ✅ 只展示各节点已判状态,不合成新结论。
- ❌ 时点不一致强行对齐:过闸是上周的,看板标成"本周" → 造了假同步,管理层以为都是最新 → ✅ 如实标各自时间戳+sync_note。
- ❌ 源缺失填猜测值:健康度没接入,看板填了个"估计良好" → 凭空造数 → ✅ 显示"无数据/待接入",不猜。
- ❌ 看板顺手派了任务/发了预警:越权 → ✅ 不派任务不预警,只显示源节点已有预警。
- _(后续迭代继续往下加)_

---

## 10. Scripts — 取数 / source_ref 绑定 / 时点检查 / 缺失标注 / 不重算校验(出件前必跑)

```python
PANEL_SOURCE = {  # §9a 板块→源节点(写死)
  "生命周期阶段": "地基①", "动销率": "L1-03", "铺货率": "L1-03",
  "过闸进度": "L5-03", "冲刺节拍": "L5-04", "统治力差距": "L5-01",
  "断货预警": "L0-07", "覆盖盲点": "L1-04", "经销商健康度": "L1-06",
}

def freshness(now, ts, cadence_days):
    if ts is None: return "no_data"
    return "fresh" if (now - ts).days <= cadence_days else "stale"

def build_panel(name, source_outputs, now, cadence):
    """从源节点输出取值,绑 source_ref;无源→no_data。绝不重算。"""
    src = PANEL_SOURCE.get(name)
    out = source_outputs.get(src)
    if out is None:
        return {"panel_name": name, "value": "无数据/待接入",
                "source_ref": None, "timestamp": None, "freshness": "no_data"}
    return {"panel_name": name, "value": out["value"],          # 直接搬,不算
            "source_ref": f"{src}:{out['window']}:{out['key']}",
            "timestamp": out["ts"], "freshness": freshness(now, out["ts"], cadence.get(name, 7))}

def validate(out, source_outputs):
    errs = []
    # ===== 铁律①:每个值=源节点值,不重算 =====
    for p in out.get("panels", []):
        if p.get("freshness") == "no_data":
            continue
        src_node = PANEL_SOURCE.get(p["panel_name"])
        src = source_outputs.get(src_node)
        if src is not None and p.get("value") != src.get("value"):
            errs.append(f"value_differs_from_source:{p['panel_name']}")   # 看板值≠源值=重算了
    # ===== 铁律②:每个值带 source_ref + 时间戳 =====
    for p in out.get("panels", []):
        if p.get("value") not in (None, "无数据/待接入"):
            if not p.get("source_ref"):
                errs.append(f"value_without_source_ref:{p['panel_name']}")  # 无源的数
            if not p.get("timestamp"):
                errs.append(f"value_without_timestamp:{p['panel_name']}")
        # 有值无源 = 凭空造数
        if p.get("value") not in (None, "无数据/待接入") and not p.get("source_ref"):
            errs.append(f"value_from_nowhere:{p['panel_name']}")
    # ===== 铁律③:不产生新判断 =====
    # 看板里的判断词必须能指回源节点(不在聚合层新造)
    if out.get("_synthesized_judgment"):
        errs.append("new_judgment_synthesized")          # 合成了新判断(如"城市危险")
    JUDGMENT_WORDS = {"危险", "健康", "良好", "恶化", "优秀", "失败"}  # 新判断词黑名单(除非源节点原话)
    for p in out.get("panels", []):
        v = str(p.get("value", ""))
        for w in JUDGMENT_WORDS:
            if w in v and not p.get("source_ref"):
                errs.append(f"judgment_without_source:{p['panel_name']}:{w}")
    # ===== 时点不一致如实标,不强行对齐 =====
    ts_set = {p.get("timestamp") for p in out.get("panels", []) if p.get("timestamp")}
    if len(ts_set) > 1 and not out.get("sync_note"):
        errs.append("time_not_aligned_unflagged")        # 时点不一致却没标
    if out.get("_forced_time_alignment"):
        errs.append("forced_time_alignment")             # 强行对齐造假同步
    # ===== 源缺失显示无数据,不猜 =====
    for p in out.get("panels", []):
        if p.get("freshness") == "no_data" and p.get("value") not in ("无数据/待接入", None):
            errs.append(f"missing_filled_with_guess:{p['panel_name']}")   # 缺失填了猜测
    # ===== 不派任务不预警 =====
    for f in out.get("fanout", []):
        if any(x in f for x in ("派任务", "预警", "下发", "告警", "新判断")):
            errs.append(f"dashboard_acted:{f}")          # 看板越权派任务/预警
    # ===== 纯镜子标记 =====
    if "mirror_only" not in str(out.get("flags", [])):
        errs.append("missing_mirror_flag")
    return errs
```

---

## 11. 评测起手式(8 条种子)

```json
[
 {"id":"u01",
  "input":{"panel":"动销率","L1-03_value":0.61},
  "expect":{"dashboard_value":0.61,"equals_source":true,
            "error_if_differs":"value_differs_from_source"},
  "tags":["动销数等于L1-03不重算"]},

 {"id":"u02",
  "input":{"panel":"动销率","value":0.61},
  "expect":{"source_ref":"L1-03:窗口:主键","timestamp":"有","traceable":true,
            "error_if_no_ref":"value_without_source_ref"},
  "tags":["每个数字带source_ref+时间戳可溯源"]},

 {"id":"u03",
  "input":{"panels":"断货P1+冲刺偏离+差距落后","temptation":"汇总判'成都危险'"},
  "expect":{"no_new_judgment":true,"only_source_states":"展示各节点已判状态",
            "error_if_synthesized":"new_judgment_synthesized"},
  "tags":["铁律③:看板不自己下新判断(不合成'城市危险')"]},

 {"id":"u04",
  "input":{"动销":"6/15(本周)","过闸":"6/10(上周月更)"},
  "expect":{"sync_note":"如实标各时点","not_force_aligned":true,
            "error_if_aligned":"forced_time_alignment"},
  "tags":["时点不一致标stale/sync_note,不强行对齐"]},

 {"id":"u05",
  "input":{"panel":"经销商健康度","source":"未接入无输出"},
  "expect":{"value":"无数据/待接入","freshness":"no_data","in_missing_panels":true,
            "not_guessed":true,"error_if_filled":"missing_filled_with_guess"},
  "tags":["源缺失显示无数据,不填猜测"]},

 {"id":"u06",
  "input":{"dashboard_value":0.63,"L1-03_source":0.61},
  "expect":{"blocked":"value_differs_from_source","note":"看板算出跟源不一致=两个版本真相"},
  "tags":["看板数与源节点不符→报错"]},

 {"id":"u07",
  "input":{"event":"看板想顺手派个补货任务/发个预警"},
  "expect":{"blocked":"dashboard_acted","only_display":true,
            "note":"预警是源节点的事,看板只显示已有预警"},
  "tags":["不派任务不预警:纯展示"]},

 {"id":"u08",
  "input":{"panels":"各板块取自各源节点"},
  "expect":{"flags_contains":"mirror_only","no_new_conclusion":true,
            "pure_aggregation":true},
  "tags":["纯聚合无新结论:镜子不是新数据源"]}
]
```

**打分维度(每条 0/1):**
1. 动销数等于源不重算(u01)
2. **每个数字带 source_ref**(u02)
3. **铁律③不下新判断**(u03:§10 new_judgment_synthesized 守)
4. 时点不一致标不强行对齐(u04)
5. 源缺失显示无数据不猜(u05)
6. **看板数与源不符报错**(u06:value_differs_from_source 守)
7. 不派任务不预警(u07)
8. 纯聚合无新结论(u08)

> 最危险的错是 u06/u01:**看板算出一个跟源节点不一致的数**。它看似只是个数字小差异,实则动摇整个体系的根基——一旦看板有了"自己的版本",管理层看的是看板、一线看的是源节点,两个数对不上,**所有人都不知道该信哪个,体系就没有"唯一真相源"了**。看板的全部价值恰恰在于它**只是镜子**:照出的每个数都和源节点一模一样、都能指回去、都标着多新。它不创造真相,只忠实反映真相。这也是为什么它放在最后——前面所有节点把真相产出来,看板把它们聚到一屏给人看,但绝不在这一屏上动任何一个数、下任何一个新判断。

---

## 待填变量(套用时替换)
- `owner` / backlog 编号
- §9a 板块取数映射(随节点增减更新)/ §9b 视角定义 / §9c 各板块更新节奏(新鲜度口径)
- 各源节点输出接入(L1-03/L5-03/L5-04/L5-01/L0-07/L1-04/L1-06/地基①)— 只读契约对齐
- 看板展示层(前端渲染)— 与本 JSON 契约对接
