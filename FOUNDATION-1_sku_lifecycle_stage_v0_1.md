---
name: sku-lifecycle-stage
description: 判定"某 SKU 在某城市/区域此刻处于哪个生命周期阶段"(导入/成长/成熟/衰退/焕新/淘汰),消费 L0-01 库存、L1-03 两率、L5-01 差距的聚合趋势,按写死规则表判定、迟滞防抖、合法迁移校验、切换留痕,数据不足判 unknown 不硬猜。凡涉及"生命周期、阶段判定、导入期/成长期/成熟期/衰退期/焕新期/淘汰期、按阶段判级、阶段切换"的输入都用本 Skill。它是芯片模型地基之一(SKU生命周期阶段真相源)——L2 逻辑门、投入比例、激励重点、各节点的按阶段判级全部消费它;不采集、不下单、不派任务、只判阶段不判投入/激励。**接口先行**:复购/毛利等趋势源部分未接入,口径全写死,阈值待校准。下游:L2 逻辑门 / 财务投入模块 / HR 激励模块 / 各按阶段判级的节点。
version: v0.1
owner: <填:负责人/团队>
type: Workflow / Skill(主数据·L2 逻辑门输入 · 有状态阶段台账 · 接口先行 · 无 HITL)
status: 粗糙版 v0.1,接口先行;复购/毛利趋势源部分未接入,阈值待真实分布校准
upstream: L0-01 库存(聚合)/ L1-03 两率趋势 / L5-01 差距 / 上市时长·新包装·清退信号(部分未接入·占位)/ SKU 主数据 / L0-04 区域档案(历史版)/ 阶段台账
downstream: L2 逻辑门 / 财务投入模块 / HR 激励模块 / 各按阶段判级的节点(L0-07 战略权重等)/ 阶段台账(回写)
backlog: <填,如 L1-01 或主数据层编号>
---

# SKU 生命周期阶段判定 Skill v0.1 · 主数据/逻辑门输入节点

> 本 Skill 依据《INFINITY OS · Agent 设计标准 v1.0》编写。
> 它是一个 **Workflow**(写死轨道)+ **阶段台账**(有状态,带迟滞与切换留痕)。
> 回答"**这个 SKU 在这个城市此刻处于哪个生命周期阶段**"——是芯片模型的地基:阶段标签喂给逻辑门/投入/激励,**但本节点只贴标签,不决定投多少、奖什么**。

> **⚠️ 生命周期是环不是线(照 PDF):** 导入→成长→成熟→衰退,但**焕新期可回成长**,淘汰为终态(重新上市=新 SKU 周期)。合法迁移写死(§9c),非法跳变挡下转人工。

> **⚠️ 接口先行:** 复购信号、毛利趋势等源部分未接入,判定规则与迟滞口径全写死,阈值留占位待真实分布校准;缺数据判 `unknown` 不硬猜。

---

## 1. 角色与目标 + 边界【先读这个】

你是 **SKU 生命周期阶段的真相源**。产出物是阶段标签 + 判据,供下游各取所需——**标签是体检结论,不是处方**。

**与兄弟节点边界(写死):**

| 事 | 归谁 | 本节点角色 |
|---|---|---|
| 库存/动销/差距事实 | L0-01 / L1-03 / L5-01 | **只读其聚合趋势,不重算** |
| 投入多少(60-80%/35-50%/25%…) | 财务投入模块 | **不判**——只给阶段,投入比例是别人的事 |
| 奖什么(导入奖点亮/成长奖复制…) | HR 激励模块 | **不判**——只给阶段 |
| 区域归属/层级 | L0-04 | 只读历史版 |
| **阶段判定本身** | **本节点** | 唯一真相源 |

**口径铁律:阶段 = SKU × 城市/区域 × 时间**——同一 SKU 在上海可能成熟、在成都可能导入,**绝不全国一刀切**。

**机器与人:** 无 HITL(贴标签不可逆性为零)。但允许**人工覆盖**阶段(留痕),**机器判定与人工覆盖物理分栏、互不覆写**(见 §3/§4)。

---

## 2. 输入(Input)— 含接入状态

| 信号 | 来源 | 状态 | 用途 |
|---|---|---|---|
| 上市时长 | SKU 主数据 | 可用 | 导入/成熟判据 |
| 铺货率趋势 | L1-03 | 可用 | 爬升=导入,平稳=成熟 |
| 动销率趋势 | L1-03 | 可用 | 快增=成长,连降=衰退 |
| 复购信号 | 会员/财务 | **部分未接入·占位** | 成熟判据 |
| 毛利趋势 | 财务 | **未接入·占位** | 成熟/衰退判据 |
| 新包装/新场景 | 产品主数据 | **占位** | 焕新信号 |
| 清退标记 | 渠道/产品决策 | **占位** | 淘汰信号 |
| 区域档案(历史版)/ 阶段台账 / `now` | L0-04 / 内部 | 可用 | 口径与迟滞 |

> partial 常态:占位信号缺失时,相关阶段判据降权或判 unknown,不硬猜。

---

## 3. 参数定义(Parameters)

| 字段 | 类型 | 说明 |
|---|---|---|
| `sku` / `scope` | string / object | **scope = 城市/区域**(口径核心) |
| `period` | string | 月窗口 |
| `machine_stage` | enum\|null | **机器判定**:导入/成长/成熟/衰退/焕新/淘汰 / **unknown**(数据不足) |
| `human_override` | object\|null | **人工覆盖,独立栏**:`{stage, by, at, reason}`;**机器绝不写此栏、绝不被此栏覆写** |
| `effective_stage` | enum | 下游读这个:有 override 取 override.stage,否则取 machine_stage |
| `confidence` | enum | high/mid/low(判据齐全度) |
| `evidence` | object | 判据明细:各信号值 + 命中的规则 ref(可溯源) |
| `hysteresis` | object | 迟滞状态:`{candidate_stage, consecutive_hits, N_required}`——**按目标阶段计数** |
| `last_switch` | object\|null | 切换留痕:`{from, to, trigger_evidence, date}` |
| `trend` | object | 同 SKU×scope 纵向 |
| `flags` | string[] | `unknown:数据不足` / `illegal_transition:*` / `source_pending:*` / `overridden` 等 |
| `summary_text` | string | 为什么判这个阶段(数字可溯源,沿用 L5-01) |

---

## 4. 处理流程(Steps · 链式,monthly)

### Step A — 取趋势(只读,不重算)
取上市时长、L1-03 两率趋势、L5-01 差距、复购/毛利/焕新/清退信号(占位标 source_pending)。

### Step B — 规则判定(写死规则表 §9b,出"本期候选阶段")
按 §9b 规则表匹配(阈值占位):
- 新上市 + 铺货爬升 → 导入;动销快增 + 区域复制中 → 成长;动销平稳 + 复购稳 + 毛利正 → 成熟;动销连降 + 控库存 → 衰退;改版/新场景重启 → 焕新;清退标记 → 淘汰。
- **判不出(关键信号缺/规则都不命中)→ 本期候选 = unknown**,不硬塞最近阶段。

### Step C — 迟滞校验【命门:防月度抖动】
- 候选阶段 == 当前 effective 机器阶段 → 维持,`consecutive_hits` 归零(已在此阶段)。
- 候选 != 当前 → **按该候选目标阶段累计 `consecutive_hits`**(每个候选各自计数);连续达 `<迟滞期N>` 期 → **才切换**;未达 → 维持当前阶段,留痕"候选 X 累计 k/N 期"。
- **双向迟滞**:进任何阶段都要连续满足,A→B 抖动期里 B 没连续达标就不切,避免来回跳。

### Step D — 合法迁移校验(环,非全连通)
切换前查 §9c 合法迁移表:
- 合法(如 衰退→焕新、**焕新→成长**、成熟→衰退)→ 执行切换,写 `last_switch{from,to,trigger,date}`。
- **非法**(如 成熟→焕新无改版信号、淘汰→任意)→ 标 `illegal_transition:{from→to}` **不切换**,维持原阶段转人工核(可能是数据异常或漏了改版信号)。
- 淘汰 = 终态;若该 SKU 重新上市 → 视为**新 SKU 周期**(新 scope 记录,不从淘汰"复活")。

### Step E — 人工覆盖(独立栏,不混机器判定)
- 人可置 `human_override{stage,by,at,reason}` → `effective_stage` 取之,flag `overridden`。
- **机器下期照常重判 machine_stage 并推进迟滞计数**(基于机器序列,不被 override 干扰);override 是贴在机器结论上的便签,人撤销即回落机器判定。
- 机器**绝不写/改 human_override**,人**不改 machine_stage**——两栏物理隔离,审计各看各的。

### Step F — 出件
脚本产 machine_stage/evidence/hysteresis → 合成 effective_stage → LLM 写 summary_text(为什么判这个阶段,数字可溯源)→ 跑 §10 → 扇出 → 回写台账。

---

## 5. 规则与强度(RFC2119)

| 强度 | 规则 |
|---|---|
| **MUST** | 阶段必须按 **SKU × 区域 × 时间** 判定,**不可全国一刀切**;同 SKU 不同城市可不同阶段。 |
| **MUST** | 阶段切换必须满足迟滞期(连续 `<迟滞期N>` 期命中目标阶段才切),双向迟滞防抖;切换必须留痕(from/to/触发判据/日期)。 |
| **MUST** | 数据不足/规则不命中判 `unknown`,**绝不硬猜**或沿用最近阶段顶替(no_data≠某阶段)。 |
| **MUST NOT** | 本节点**只判阶段**,**绝不判投入比例(财务模块)、绝不判激励(HR 模块)、不采集、不下单、不派任务**。 |
| **MUST** | 判据必须可溯源(各信号值 + 命中规则 ref);summary 数字沿用 L5-01 校验。 |
| **MUST** | 必须允许环形迁移(**焕新→成长**等),按 §9c 合法迁移表;非法跳变标 illegal_transition 不切换转人工。 |
| **MUST** | 机器判定(machine_stage)与人工覆盖(human_override)物理分栏:机器绝不写 override,人不改 machine_stage;effective_stage 为合成视图;机器迟滞计数基于机器序列不受 override 干扰。 |
| **SHOULD** | 占位信号缺失应降权相关判据或局部 unknown,并在 evidence 注明 source_pending;淘汰 SKU 重新上市应起新周期。 |
| **MAY** | 可附阶段时间轴;低 confidence 可加注"判据不全"。 |

---

## 6. 输出(Output · Artifact 契约)

```json
{
  "sku": "6MX-QY-500", "scope": { "city": "成都" }, "period": "2026-05",
  "machine_stage": "导入",
  "human_override": null,
  "effective_stage": "导入",
  "confidence": "mid",
  "evidence": {
    "上市时长": "3个月", "铺货率趋势": "0.42→0.58↑(L1-03)", "动销率趋势": "0.61(L1-03)",
    "复购信号": "source_pending", "毛利趋势": "source_pending",
    "命中规则": "R-导入:新上市+铺货爬升"
  },
  "hysteresis": { "candidate_stage": "导入", "consecutive_hits": 2, "N_required": 2 },
  "last_switch": null,
  "trend": { "prev_stage": "导入", "direction": "稳定爬升" },
  "flags": ["source_pending:复购/毛利(成熟判据暂缺,不影响导入判定)"],
  "summary_text": "加点鲜500ml@成都:上市3个月、铺货率 42%→58% 爬升中、动销 61%,命中『新上市+铺货爬升』判为导入期(基于已接入信号,复购/毛利源未接入)。已连续2期,达迟滞门槛维持。"
}
```

> 同 SKU 不同城市示例:`6MX-QY-500@上海` 可能 `machine_stage:"成熟"` ——口径独立。
> 人工覆盖示例:`human_override:{stage:"焕新", by:"产品-Li", reason:"6月换新包装上市"}, effective_stage:"焕新", flags:["overridden"]`,而 `machine_stage` 仍记机器当期判定。
> unknown 示例:`machine_stage:"unknown", flags:["unknown:动销与毛利源均缺,无法判定"]`。
> 非法跳变:`flags:["illegal_transition:成熟→焕新(无改版信号)"]`,维持原阶段。

---

## 7. 节奏 + 扇出(写死)

| 项 | 规则 |
|---|---|
| 窗口 | **monthly 主窗口**;阶段变化慢,周不跑 |
| 扇出 | L2 逻辑门 / 财务投入 / HR 激励 / 各按阶段判级节点 读 `effective_stage` + evidence;台账回写 |
| 禁区 | **绝不**:判投入/判激励、采集、下单、派任务、机器写 human_override |

---

## 8. HITL 卡点 —— 本节点【无】

贴阶段标签不花钱、不动人、不可逆性为零,**故无 HITL**。人工覆盖(§4E)是数据治理动作不是 HITL——它不阻断流程,只在 effective 视图上叠加便签且留痕。投入/激励的真正决策在财务/HR 模块卡。

---

## 9. References

### 9a. 六阶段定义表(写死,照 PDF)

| 阶段 | 一句话 | 典型信号 |
|---|---|---|
| 导入 | 点亮生命信号 | 新上市、铺货爬升 |
| 成长 | 复制放大 | 动销快增、区域复制中 |
| 成熟 | 收入利润稳定 | 动销平稳、复购稳、毛利正 |
| 衰退 | 降投控库止损 | 动销连降、控库存 |
| 焕新 | 重启生命力 | 改版/新包装/新场景 |
| 淘汰 | 清退释放资源 | 停止新增、清退标记(终态) |

### 9b. 判定规则表(写死;阈值占位待校准)

| 规则 ref | 条件(阈值 `<占位>`) | → 候选阶段 |
|---|---|---|
| R-导入 | 上市 < `<导入月数>` 且 铺货率环比↑ | 导入 |
| R-成长 | 动销率环比增 ≥ `<成长增幅>` 且 区域扩张中 | 成长 |
| R-成熟 | 动销平稳(\|环比\|<`<平稳带>`)且 复购≥`<复购线>` 且 毛利正 | 成熟 |
| R-衰退 | 动销连降 ≥ `<衰退期数>` 期 且 控库存 | 衰退 |
| R-焕新 | 改版/新场景信号=true | 焕新 |
| R-淘汰 | 清退标记=true | 淘汰 |
| 兜底 | 关键信号缺 / 无规则命中 | **unknown** |

### 9c. 合法迁移表(环,写死)

| from | 合法 to |
|---|---|
| 导入 | 成长 / 衰退(夭折)/ 淘汰 |
| 成长 | 成熟 / 衰退 |
| 成熟 | 衰退 / 焕新(需改版信号) |
| 衰退 | 焕新 / 淘汰 |
| **焕新** | **成长** / 成熟 / 衰退 |
| 淘汰 | (终态;重新上市=新周期) |

> 表外迁移 = illegal_transition,不切换转人工。

### 9d. 迟滞参数 / 术语

`<迟滞期N>`(建议 2~3 期)· 各阶段阈值见 §9b。
迟滞=连续命中才切防抖;effective_stage=机器∪人工覆盖的合成视图;unknown=判据不足不硬猜。

### 9e. 踩坑记录(预置)

- ❌ 全国按一个阶段判 → 上海成熟成都导入被一刀切,投入/激励全错配 → ✅ SKU×区域×时,城市独立。
- ❌ 月度数据一抖就切阶段,投入比例跟着来回变 → ✅ 迟滞:连续 N 期命中才切。
- ❌ 抖动期既不满足旧阶段也不稳定新阶段,卡在真空没人计数 → ✅ 按目标候选阶段各自累计连续命中。
- ❌ 数据缺就沿用上月阶段顶替 → unknown 被掩盖,下游拿假阶段判级 → ✅ 判 unknown 不硬猜。
- ❌ 成熟直接跳焕新(其实没改版,是数据异常) → ✅ 合法迁移表挡,illegal_transition 转人工。
- ❌ 机器重判把人工覆盖的焕新冲掉 → 产品部的改版判断丢了 → ✅ 两栏物理隔离,机器不碰 override。
- ❌ 本节点顺手输出"建议投入 60%" → 越界到财务模块 → ✅ 只判阶段,投入/激励各归其位。
- _(后续迭代继续往下加)_

---

## 10. Scripts — 规则判定 / 迟滞 / 合法迁移 / 覆盖隔离 / 溯源(出件前必跑)

```python
STAGES = {"导入","成长","成熟","衰退","焕新","淘汰","unknown"}
LEGAL = {  # §9c 合法迁移(环)
  "导入":{"成长","衰退","淘汰"}, "成长":{"成熟","衰退"},
  "成熟":{"衰退","焕新"}, "衰退":{"焕新","淘汰"},
  "焕新":{"成长","成熟","衰退"}, "淘汰":set(),    # 终态
}

def classify(signals, rules):
    """§9b 规则表;返回候选阶段或 'unknown'。全脚本。"""
    for r in rules:                      # 按 ref 顺序匹配
        if r.match(signals):
            return r.stage, r.ref
    return "unknown", "兜底"

def hysteresis_step(ledger, sku, scope, candidate, N):
    """按目标候选阶段累计连续命中;达 N 才切。"""
    st = ledger.get((sku, scope), {})
    cur = st.get("machine_stage")
    if candidate == cur or candidate == "unknown":
        return {"switch": False, "candidate": candidate, "hits": 0}
    hits = st.get("consecutive_hits", 0) + 1 if st.get("candidate_stage") == candidate else 1
    return {"switch": hits >= N, "candidate": candidate, "hits": hits}

def validate(out, ledger_before, now):
    errs = []
    # ===== 阶段枚举 =====
    if out.get("machine_stage") not in STAGES:
        errs.append("invalid_machine_stage")
    # ===== 口径:必须带 scope(区域) =====
    if not (out.get("scope") or {}).get("city") and not (out.get("scope") or {}).get("region"):
        errs.append("stage_without_scope")              # 不可全国一刀切
    # ===== unknown 不硬猜 =====
    ev = out.get("evidence", {})
    if out["machine_stage"] != "unknown" and ev.get("命中规则", "").endswith("兜底"):
        errs.append("guessed_instead_of_unknown")
    # ===== 迟滞:切换必须达 N + 留痕 =====
    cur = ledger_before.get((out["sku"], str(out.get("scope"))), {})
    if cur and cur.get("machine_stage") and cur["machine_stage"] != out["machine_stage"]:
        h = out.get("hysteresis", {})
        if h.get("consecutive_hits", 0) < h.get("N_required", 1):
            errs.append("switch_before_hysteresis")     # 没达迟滞就切
        if not out.get("last_switch") or out["last_switch"].get("to") != out["machine_stage"]:
            errs.append("switch_without_trace")         # 切换无留痕
        # ===== 合法迁移 =====
        if out["machine_stage"] not in LEGAL.get(cur["machine_stage"], set()):
            if "illegal_transition" not in str(out.get("flags", [])):
                errs.append(f"illegal_transition_unflagged:{cur['machine_stage']}→{out['machine_stage']}")
    # ===== 覆盖隔离 =====
    if out.get("human_override"):
        if out.get("_override_written_by") == "machine":
            errs.append("machine_wrote_override")       # 机器不得写人工栏
        if out.get("effective_stage") != out["human_override"]["stage"]:
            errs.append("effective_not_following_override")
    elif out.get("effective_stage") != out.get("machine_stage"):
        errs.append("effective_mismatch_machine")
    # ===== 边界:不判投入/激励 =====
    body = str(out)
    for kw in ("投入比例","建议投","激励","奖金","返点","下单","派任务"):
        if kw in out.get("summary_text", "") or any(kw in f for f in out.get("fanout", [])):
            errs.append(f"out_of_scope:{kw}")
    # ===== summary 溯源 =====
    import re, json
    src = json.dumps(out.get("evidence", {}), ensure_ascii=False)
    for num in re.findall(r"\d+\.?\d*", out.get("summary_text", "")):
        if num not in src and num not in out.get("period","") and num+"%" not in src:
            errs.append(f"summary_number_unsourced:{num}")
    return errs
```

---

## 11. 评测起手式(8 条种子)

```json
[
 {"id":"s01",
  "input":{"sku":"6MX-QY-500","scope":{"city":"成都"},"上市":"3个月","铺货率":"0.42→0.58↑","动销":"0.61"},
  "expect":{"machine_stage":"导入","命中规则":"R-导入","evidence_traceable":true},
  "tags":["新品+铺货爬升→导入"]},

 {"id":"s02",
  "input":{"动销率":"环比+28%","区域":"复制扩张中"},
  "expect":{"machine_stage":"成长","命中规则":"R-成长"},
  "tags":["动销快增+区域复制→成长"]},

 {"id":"s03",
  "input":{"sku":"6MX-QY-500","case":[{"scope":{"city":"上海"},"动销":"平稳","复购":"稳","毛利":"正"},
                                      {"scope":{"city":"成都"},"上市":"3个月","铺货":"爬升"}]},
  "expect":{"上海":{"machine_stage":"成熟"},"成都":{"machine_stage":"导入"},
            "no_nationwide_single_stage":true},
  "tags":["同SKU不同城市不同阶段:SKU×区域×时,不一刀切"]},

 {"id":"s04",
  "input":{"动销":"source_pending","毛利":"source_pending","其他关键信号缺"},
  "expect":{"machine_stage":"unknown","flags_contains":"unknown","not_guessed":true,
            "not_carried_from_last":true},
  "tags":["数据不足→unknown,不硬猜不沿用上月"]},

 {"id":"s05",
  "input":{"cur_stage":"成熟","this_period":"动销首次下滑(候选衰退)第1期","params":{"N":2}},
  "expect":{"switch":false,"machine_stage_stays":"成熟",
            "hysteresis":{"candidate_stage":"衰退","consecutive_hits":1,"N_required":2},
            "next_period_if_again":"第2期再命中才切衰退"},
  "tags":["迟滞防抖:连续N期才切,单期下滑不跳阶段"]},

 {"id":"s06",
  "input":{"cur_stage":"衰退","signal":"6月换新包装新场景上市(改版信号=true)","连续达迟滞"},
  "expect":{"machine_stage":"焕新","命中规则":"R-焕新","legal_transition":"衰退→焕新",
            "last_switch":{"from":"衰退","to":"焕新","trigger":"改版信号"}},
  "tags":["改版→焕新;焕新可回成长(环);切换留痕"]},

 {"id":"s07",
  "input":{"machine_stage":"成熟","human":{"stage":"焕新","by":"产品-Li","reason":"确认换新包装"}},
  "expect":{"human_override":{"stage":"焕新"},"effective_stage":"焕新","machine_stage_unchanged":"成熟",
            "flags_contains":"overridden","two_columns_separate":true},
  "tags":["人工覆盖留痕:effective取覆盖,machine_stage仍记机器判定,两栏隔离"]},

 {"id":"s08",
  "input":{"cur_stage":"成熟","candidate":"焕新","改版信号":false},
  "expect":{"switch":false,"flags_contains":"illegal_transition:成熟→焕新","to_human":true,
            "note":"成熟→焕新需改版信号,无信号=非法跳变(可能数据异常)"},
  "tags":["合法迁移校验:无改版信号的成熟→焕新挡下转人工"]}
]
```

**打分维度(每条 0/1):**
1. 规则判定命中(s01/s02)
2. SKU×区域口径(s03:同SKU多城市独立)
3. unknown 不硬猜(s04)
4. 迟滞防抖(s05:按目标阶段计数、达N才切)
5. 环形迁移 + 切换留痕(s06)
6. 覆盖两栏隔离(s07)
7. 合法迁移校验(s08)
8. 只判阶段不越界 + summary 溯源(§10)

> 最危险的两类错:**全国一刀切**(s03——上海成熟成都导入混判,投入/激励全错配,芯片模型地基就塌了)和**数据缺时硬猜**(s04——下游所有按阶段判级的节点拿着假阶段跑,错误沿全链路放大)。本节点是地基,地基判错比末端判错贵得多,宁 unknown 勿猜。

---

## 待填变量(套用时替换)
- `owner` / backlog 编号
- §9b 全部阈值(导入月数/成长增幅/平稳带/复购线/衰退期数)— 真实分布校准
- `<迟滞期N>`(建议 2~3)
- **复购/毛利/新包装/清退信号源** — 接入(经 MCP);接入后更新 §2 状态表
- L1-03 趋势读取口径对齐
- 阶段台账落库 — 与既有台账同基建分表
