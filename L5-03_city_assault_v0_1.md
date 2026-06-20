---
name: city-assault-gate
description: 回答"这个 SKU 在这个城市,首攻区域点亮了没、能不能复制到关键区域、能不能全城覆盖"——落地 SKU 城市生命闸门模型(首攻区域→3-5关键区域→全城覆盖,配 Gate1/2/3)。读 L0-02 陈列/L1-03 动销铺货/L0-08 补货/L0-07 断货事实,按写死 AND 条件判每道闸过没过,全 AND 满足才过闸;过闸是建议非自动推进(进新区域=加投入,走 HITL/JBP/D-001);不达标逐条标哪个 AND 项没过+给针对性纠偏方向(非放弃城市);超时标 gate_timeout 转人工。凡涉及"城市攻坚、城市生命闸门、首攻区域、关键区域复制、全城覆盖、过闸、Gate1/2/3、点亮、区域推进"的输入都用本 Skill。它是城市过闸判断的真相源(L5-03,L3电路层·阶段推进电路)——**不自己采集事实、不自动推进、不拨投资(地基②/D-001)、不判生命周期阶段(地基①)**。**接口先行**:门店级达标数据部分接入,过闸条件写死,阈值占位。下游:城市经理/JBP(过闸决策)/ 地基②投入 / D-001 审批 / 城市攻坚台账。
version: v0.1
owner: <填:负责人/团队>
type: Workflow / Skill(L3电路层 · 阶段推进电路 · 接口先行 · 推进决策需 HITL · L5-03)
status: 粗糙版 v0.1,接口先行;门店级达标数据部分接入,过闸 AND 条件与时间节奏写死,阈值占位
upstream: SKU 生命周期 effective_stage(地基①,只读)/ L0-02 陈列 · L1-03 动销铺货 · L0-08 补货 · L0-07 断货(过闸事实,只读)/ JBP 城市目标(过闸目标锚)/ 城市攻坚台账
downstream: 城市经理 · JBP(过闸推进决策 HITL)/ 地基②投入(推进后投入档位)/ D-001 审批 / 城市攻坚台账(回写)
backlog: L5-03
---

# 城市攻坚 / 城市生命闸门 Skill v0.1 · L3电路层·阶段推进电路(L5-03)

> 本 Skill 依据《INFINITY OS · Agent 设计标准 v1.0》编写。
> 它是一个 **Workflow**(写死轨道)+ **城市攻坚台账**(有状态,记在哪个区域、哪一闸、第几个月)。
> 落地 **SKU 城市生命闸门模型**(PDF):**首攻区域 → 3-5 关键区域 → 全城覆盖**,配 **Gate1/2/3**。回答"过没过闸、能不能推进"——供城市经理/JBP 决策。**判断/协同,不自动推进。**

> **⚠️ 三条铁律:**
> ① **过闸是"判断"不是"自动推进"**——机器判 Gate 达没达标、给"可进下一区域/可复制/可全城"的建议;但实际推进(进新区域 = 加投入加资源)**绝不自动执行**,走 HITL/JBP 拍板(进下一阶段 = 投入档位变,关联地基②/D-001)。
> ② **不达标 ≠ 砍**——逐条标哪个 AND 项没过、给针对性纠偏方向(区域错/门店错/价格错/陈列错/话术错,同战略救援精神),不是直接放弃该城市。
> ③ **只读事实不采集不重算**——上架/陈列/动销/补货达标读 L0-02/L1-03/L0-08,断货读 L0-07,本节点只判"够不够过闸",不重算事实。

> **⚠️ 接口先行:** 门店级达标数据部分接入,过闸条件与判定规则写死,阈值占位。

---

## 1. 角色与目标 + 边界【先读这个】

你是 **城市过闸判断的真相源**:判每道闸过没过、给推进建议或纠偏方向。产出物是**过闸判定 + 下一步建议/纠偏方向**——**判定是事实陈述,推进是资源承诺,中间隔着 HITL**。

**与兄弟节点边界(写死):**

| 事 | 归谁 | 本节点角色 |
|---|---|---|
| 生命周期阶段 | 地基① | 只读 effective_stage,不重判 |
| 上架/陈列达标 | L0-02 | 只读,不重算 |
| 动销/铺货达标 | L1-03 | 只读,不重算 |
| 补货达标 | L0-08 | 只读,不重算 |
| 断货 | L0-07 | 只读,不重算 |
| 进区域的投入档位 | 地基② | **不碰**——出推进建议,投入档位地基②定 |
| 推进审批 | D-001 | **不碰**——建议推进,审批 D-001 走 |
| JBP 城市目标 | JBP | 只读作过闸目标锚 |
| **过闸判定 + 推进建议 + 纠偏方向** | **本节点** | 唯一真相源 |

**机器与人:** 过闸判定无 HITL(是读事实下的客观结论)。但**推进到下一区域/全城(加投入加资源)需 HITL/JBP**;超时转人工。

---

## 2. 输入(Input)— 含接入状态

| 信号 | 来源 | 状态 | 用途 |
|---|---|---|---|
| effective_stage | 地基① | 可用(只读) | 是否攻坚期(导入/成长) |
| 上架/陈列达标 | L0-02 | 部分占位 | Gate1 条件 |
| 动销/铺货达标 | L1-03 | 可用(只读) | Gate1/2 条件 |
| 补货频率/达标 | L0-08 | 可用(只读) | Gate2 条件 |
| 断货 | L0-07 | 可用(只读) | 履约(Gate3) |
| 首购/复购信号 | 会员/动销 | **占位** | Gate1/2 条件 |
| 价格可接受/费用 | 价格/财务 | **占位** | Gate1/2/3 条件 |
| 收入/利润 | 财务 | **占位** | Gate3 条件 |
| JBP 城市目标 | JBP | 占位 | 目标锚 |
| 城市攻坚台账 / `now` | 内部 | 可用 | 当前闸/区域/月数 |

> partial 常态:占位条件缺时,该 AND 项判 unknown → 整闸判 `gate_unknown` 不硬判过闸(§9b);标 source_pending。

---

## 3. 参数定义(Parameters)

| 字段 | 类型 | 说明 |
|---|---|---|
| `sku` / `city` | string | SKU × 城市 |
| `effective_stage` | enum | 读自地基①,只读不重判;非导入/成长 → §9a 特判 |
| `current_region` | string | 当前在哪个区域(首攻/某关键区域/全城) |
| `current_gate` | enum | `Gate1` 区域点亮 / `Gate2` 关键区域复制 / `Gate3` 全城覆盖 |
| `and_conditions[]` | object[] | 当前闸各 AND 条件:`{name, required, met: true/false/unknown, evidence_ref}`——逐条溯源 |
| `gate_verdict` | enum | `passed`(全 AND 满足)/ `not_passed`(差≥1项)/ `gate_unknown`(数据不足)/ `gate_timeout`(超时) |
| `advance_suggestion` | object\|null | 过闸后:`{建议推进到, hitl_required: true, 关联: 地基②投入档位/D-001}`——**建议非执行** |
| `correction_directions[]` | object[] | 不达标:逐条 `{failed_condition, direction: 调价/纠陈列/换门店池/改话术/换渠道}`——针对性非笼统 |
| `months_in_gate` | number | 在该闸月数(时间维) |
| `timeout` | object\|null | `{limit, exceeded, action: 转人工评估救/调/换区域}` |
| `confidence` | enum | high/mid/low(数据齐全度) |
| `status` | enum | `gated` / `awaiting_advance_hitl` / `gate_timeout` / `gate_unknown` / `not_assault_stage` |
| `flags` | string[] | `gate_passed` / `correction_needed` / `gate_timeout` / `gate_unknown` / `auto_advance_blocked` 等 |
| `summary_text` | string | 过没过、为什么、下一步或怎么纠偏(可溯源到达标事实) |
| `fanout` | string[] | 城市经理/JBP推进建议/纠偏方向/台账;**无自动推进/拨款/审批项** |

---

## 4. 处理流程(Steps · 链式)

### Step A — 读阶段(只读,定是否攻坚)
读 effective_stage(**只读不重判**):
- 导入/成长 → 正常攻坚,进 Step B;
- **成熟 → 已过闸全城经营**(攻坚完成),`status:not_assault_stage`,不再判 Gate;
- **衰退/淘汰 → 不攻坚**(§9a),`status:not_assault_stage`,不出推进建议(衰退不扩张、淘汰清退);
- unknown → 谨慎进 Step B,但数据不足时整闸 gate_unknown。

### Step B — 定位当前闸(读台账)
读城市攻坚台账定 `current_region` + `current_gate`(Gate1/2/3)+ `months_in_gate`。新城市从 Gate1 首攻区域起。

### Step C — 读过闸事实 × 判 AND(全满足才过,§9b)
按当前闸取 §9b 的 AND 条件,逐条读事实(**只读不重算**)填 `met`:
- **Gate1 区域点亮门**:上架达标(L0-02)AND 陈列达标(L0-02)AND 首购发生 AND 初步动销(L1-03)AND 价格可接受;
- **Gate2 关键区域复制门**:动销增长(L1-03)AND 补货频率提升(L0-08)AND 复购出现 AND 打法可复制 AND 费用没失控;
- **Gate3 全城覆盖门**:收入 AND 利润 AND 履约(L0-07 断货低)AND 费用可控。
- **全 AND 满足 → `gate_verdict:passed`**;差 ≥1 项 → `not_passed`;**任一项 unknown 且其余未全满足 → `gate_unknown` 不硬判过闸**(§9b 短路规则)。

### Step D — 分支:过则建议推进(HITL)/ 不过给纠偏
- **passed** → `advance_suggestion{建议推进到下一区域/全城, hitl_required:true}`,`status:awaiting_advance_hitl`——**绝不自动进新区域**(进新区域=加投入,关联地基②档位变+D-001 审批);
- **not_passed** → 逐条 `correction_directions`(失败条件→针对性纠偏方向,§9c):上架不达标→换门店池/渠道、陈列不达标→纠陈列/话术、价格不可接受→调价、动销不足→促销/试吃。**不达标≠砍,给方向继续攻**。

### Step E — 超时检测(时间维,独立于达标)
- `months_in_gate > §9d 节奏上限`(首攻 3 月点亮 / 关键区域 3 月复制)且未 passed → `gate_timeout` 转人工评估(救/调/换区域)。
- **超时与不达标是两维**:没达标但在推进=正常继续;超时未过=转人工。

### Step F — 出件
脚本产 and_conditions/gate_verdict/timeout → LLM 写 summary_text(过没过、为什么、下一步/纠偏,可溯源)→ 跑 §10 → 扇出(城市经理/JBP/台账)→ 回写台账。

---

## 5. 规则与强度(RFC2119)

| 强度 | 规则 |
|---|---|
| **MUST** | **全 AND 满足才算过闸**,部分满足不算过(Gate1/2/3 各自的 AND 条件缺一不过)。 |
| **MUST NOT** | **过闸是建议、推进不自动执行**——进下一区域/全城 = 加投入加资源,走 HITL/JBP/D-001;本节点不自动推进、不拨款、不批。 |
| **MUST** | **不达标给针对性纠偏方向(逐条对应失败条件),非放弃城市**——区域/门店/价格/陈列/话术错对应不同纠偏。 |
| **MUST NOT** | **只读事实不采集不重算**(L0-02/L1-03/L0-08/L0-07);**只读阶段不重判**(地基①)。 |
| **MUST** | 超时(首攻 3 月/关键区域 3 月节奏)未过闸 → `gate_timeout` 转人工评估,不无限等。 |
| **MUST** | 数据不足判不了过闸 → `gate_unknown` 不硬判过闸(任一 AND 项 unknown 且未全满足即短路)。 |
| **MUST** | **衰退/淘汰期不攻坚**(不扩张/清退);成熟期=已过闸全城经营不再判 Gate。 |
| **SHOULD** | 纠偏方向应可溯源到具体失败的 AND 条件;过闸判定应附各条件证据指针。 |
| **MAY** | 可附城市攻坚时间轴(各闸月数);多城市批量过闸视图。 |

---

## 6. 输出(Output · Artifact 契约)

```json
{
  "sku": "6MX-QY-500", "city": "成都",
  "effective_stage": "导入",
  "current_region": "首攻区域:武侯区",
  "current_gate": "Gate1",
  "and_conditions": [
    { "name": "上架达标", "required": true, "met": true, "evidence_ref": "L0-02:武侯区铺货率 0.82" },
    { "name": "陈列达标", "required": true, "met": true, "evidence_ref": "L0-02:陈列合规 0.78" },
    { "name": "首购发生", "required": true, "met": true, "evidence_ref": "会员:首购 312 单" },
    { "name": "初步动销", "required": true, "met": true, "evidence_ref": "L1-03:动销率 0.61" },
    { "name": "价格可接受", "required": true, "met": true, "evidence_ref": "价格:在带内" }
  ],
  "gate_verdict": "passed",
  "advance_suggestion": { "建议推进到": "3-5 关键区域(锦江/青羊/高新)", "hitl_required": true,
                          "关联": "进 Gate2 = 投入档位变(地基②)+ D-001 审批" },
  "correction_directions": [],
  "months_in_gate": 2,
  "timeout": null,
  "confidence": "high",
  "status": "awaiting_advance_hitl",
  "flags": ["gate_passed", "auto_advance_blocked"],
  "summary_text": "加点鲜500ml@成都武侯区(导入期,Gate1首攻):五个AND条件全达标(上架0.82/陈列0.78/首购312单/动销0.61/价格在带内),首攻区域点亮。建议推进到3-5关键区域(锦江/青羊/高新),但进Gate2=加投入,需JBP/D-001拍板,机器不自动进。在闸2个月,未超时。"
}
```

> 部分达标示例:5 项中陈列、动销 met=false → `gate_verdict:"not_passed"`,`correction_directions:[{failed:"陈列达标",direction:"纠陈列+话术"},{failed:"初步动销",direction:"促销/试吃拉动"}]` ——**逐条针对,不笼统说"没过"**。
> 不达标≠砍示例:not_passed 不出"放弃成都",出纠偏方向继续攻。
> 超时示例:`months_in_gate:4 > 3, gate_verdict 仍 not_passed → status:"gate_timeout", timeout:{action:"转人工评估救/调/换区域"}`。
> 衰退期示例:`effective_stage:"衰退" → status:"not_assault_stage"`,不攻坚不出推进建议。
> 数据不足示例:`价格可接受 met:unknown 且其余未全满足 → gate_verdict:"gate_unknown"`,不硬判过闸。
> Gate3 全城示例:收入/利润/履约/费用全达标 → 建议进成熟全城经营(仍 HITL)。

---

## 7. 节奏 + 扇出(写死)

| 项 | 规则 |
|---|---|
| 节奏 | 月度过闸复盘(对齐攻坚节奏:首攻 3 月/关键区域 3 月) |
| 扇出 | 城市经理/JBP 推进建议(HITL)· 纠偏方向 · 地基②投入档位参考 · 城市攻坚台账回写 |
| 禁区 | **绝不**:自动推进进新区域、拨款/批投入、采集/重算事实、重判阶段、部分达标算过闸、衰退淘汰期攻坚、超时无限等 |

---

## 8. HITL 卡点 —— 本节点【推进有,判定无】

- **过闸判定无 HITL**:全 AND 满足判 passed 是读事实下的客观结论,不出账。
- **推进到下一区域/全城需 HITL/JBP**:进新区域 = 加投入加资源(不可逆),`awaiting_advance_hitl`,**机器判过闸 ≠ 机器推进**;人/JBP 确认后才进,投入档位变关联地基②、审批走 D-001。
- **超时转人工**:`gate_timeout` 由人评估救/调/换区域,机器不自动放弃也不无限等。
- 判定是事实陈述,推进是资源承诺——中间这道 HITL 是本节点的命门:**机器能说"够格进下一关",但"要不要进"是人的决定**。

---

## 9. References

### 9a. 阶段-攻坚适用表(写死)

| effective_stage | 攻坚? | 处理 |
|---|---|---|
| 导入 | **是**(首攻点亮) | 正常判 Gate1→2→3 |
| 成长 | **是**(复制扩张) | 正常判 Gate2/3 |
| 成熟 | 否(已过闸) | not_assault_stage,全城经营 |
| 衰退 | **否**(不扩张) | not_assault_stage,不攻坚 |
| 淘汰 | **否**(清退) | not_assault_stage |
| 焕新 | 视改版信号 | 有信号按成长,无信号谨慎 |
| unknown | 谨慎 | 数据足才判,否则 gate_unknown |

### 9b. 三道闸门 AND 条件表(照 PDF,写死;阈值占位)

| 闸 | AND 条件(全满足才过) | 不达标 |
|---|---|---|
| **Gate1 区域点亮门** | 上架达标 AND 陈列达标 AND 首购发生 AND 初步动销 AND 价格可接受 | 纠偏:调价/包装/陈列/话术/门店池/渠道 |
| **Gate2 关键区域复制门** | 动销增长 AND 补货频率提升 AND 复购出现 AND 打法可复制 AND 费用没失控 | 不盲目扩铺/不盲目加费用 |
| **Gate3 全城覆盖门** | 收入 AND 利润 AND 履约 AND 费用可控 | 检查价盘/费用/库存/复购 |

> **短路规则**:任一 AND 项 unknown 且其余未全满足 → 整闸 `gate_unknown`,不硬判过闸。全满足才 passed,差 1 即 not_passed。

### 9c. 纠偏方向清单(逐条对应失败条件,写死)

| 失败的 AND 条件 | 纠偏方向 |
|---|---|
| 上架不达标 | 换门店池 / 换渠道 / 加铺货 |
| 陈列不达标 | 纠陈列 / 改话术 |
| 首购/动销不足 | 促销 / 试吃 / 拉新 |
| 价格不可接受 | 调价 / 调包装规格 |
| 复购不出现 | 复购机制 / 会员运营 |
| 费用失控 | 控费 / 收窄打法 |

> 不达标 = 针对失败条件给方向,**非放弃城市**(同战略救援精神)。

### 9d. 时间节奏 + HITL 阈值(写死,占位)

| 项 | 规则 |
|---|---|
| 首攻区域点亮 | `<首攻月数上限>`(PDF:3 月)内未 passed → gate_timeout |
| 关键区域复制 | `<复制月数上限>`(PDF:3 月)内未 passed → gate_timeout |
| 推进 HITL | 进任何新区域/全城(加投入)→ 必 HITL/JBP |

### 9e. 术语 / 踩坑

| 术语 | 含义 |
|---|---|
| 过闸判定 vs 推进 | 机器判达标(客观)/ 推进加投入(人定) |
| 全 AND 才过 | 五/四条件缺一不过,差一和差四都 not_passed |
| 超时维 | 独立于达标:没达标但推进中=正常 / 超时未过=转人工 |
| gate_unknown | 数据不足不硬判过闸 |

- ❌(铁律①,值得记)**过闸了机器自动进下一区域**:Gate1 达标,机器直接把资源投到关键区域 → 加投入是不可逆资源承诺,机器替 JBP 拍了板 → ✅ 过闸是建议,推进走 HITL/JBP/D-001,判定≠推进。
- ❌(铁律②,值得记)**不达标就标"放弃成都"**:Gate1 差陈列一项,直接判该城市失败 → 一个能纠的小问题葬送整个城市 → ✅ 逐条标失败条件+针对性纠偏(差陈列就纠陈列),不达标≠砍。
- ❌ 部分达标算过闸:5 项过 4 项就推进 → 带着短板进下一关,问题放大 → ✅ 全 AND 满足才过,差一即 not_passed。
- ❌ 把超时混进达标判定:卡了 4 个月还按"未达标继续推"挂着 → 没人喊停,资源持续空耗 → ✅ 超时独立维,gate_timeout 转人工评估救/调/换。
- ❌ 本节点自己重算了动销达标:和 L1-03 算的不一致 → 两个事实打架 → ✅ 只读 L0-02/L1-03/L0-08/L0-07,不重算。
- ❌ 数据不足硬判过闸:价格数据没接就当"价格可接受"判 passed → 假过闸误导推进 → ✅ unknown 短路,gate_unknown 不硬判。
- ❌ 衰退期还在攻坚扩区域:给要退的市场加投入 → ✅ 衰退/淘汰不攻坚。
- _(后续迭代继续往下加)_

---

## 10. Scripts — AND 过闸判定 / 纠偏匹配 / 超时检测 / 只读校验(出件前必跑)

```python
GATE_CONDITIONS = {  # §9b 写死
  "Gate1": ["上架达标","陈列达标","首购发生","初步动销","价格可接受"],
  "Gate2": ["动销增长","补货频率提升","复购出现","打法可复制","费用没失控"],
  "Gate3": ["收入","利润","履约","费用可控"],
}
CORRECTION = {  # §9c 失败条件→纠偏方向
  "上架达标":"换门店池/换渠道/加铺货","陈列达标":"纠陈列/改话术",
  "首购发生":"促销/试吃/拉新","初步动销":"促销/试吃/拉新",
  "价格可接受":"调价/调包装规格","复购出现":"复购机制/会员运营",
  "费用没失控":"控费/收窄打法","费用可控":"控费/收窄打法",
}
ASSAULT_STAGES = {"导入","成长"}        # 攻坚期
TIMEOUT_LIMIT = {"Gate1": None, "Gate2": None}  # <月数上限> 占位,PDF=3

def judge_gate(gate, facts):
    """全 AND 满足才 passed;任一 unknown 且未全满足→gate_unknown;否则 not_passed。"""
    conds = GATE_CONDITIONS[gate]
    met = {c: facts.get(c) for c in conds}        # True/False/None(unknown)
    if all(met[c] is True for c in conds):
        return "passed", met
    if any(met[c] is None for c in conds) and not all(met[c] is True for c in conds):
        return "gate_unknown", met                # 短路:数据不足不硬判
    return "not_passed", met

def corrections(met):
    """逐条失败条件→针对性纠偏方向。"""
    return [{"failed_condition": c, "direction": CORRECTION.get(c, "人工评估")}
            for c, v in met.items() if v is False]

def validate(out):
    errs = []
    stage = out.get("effective_stage")
    gate = out.get("current_gate")
    v = out.get("gate_verdict")
    # ===== 衰退/淘汰/成熟不攻坚 =====
    if stage in ("衰退","淘汰","成熟") and out.get("status") != "not_assault_stage":
        errs.append(f"assault_in_nonassault_stage:{stage}")
    # ===== 全 AND 才过闸 =====
    conds = out.get("and_conditions", [])
    all_met = conds and all(c.get("met") is True for c in conds)
    if v == "passed" and not all_met:
        errs.append("passed_without_all_and")          # 部分达标算了过闸
    if v == "passed" and any(c.get("met") is None for c in conds):
        errs.append("passed_with_unknown_condition")
    # 任一 unknown 且未全满足 → 必须 gate_unknown
    if any(c.get("met") is None for c in conds) and not all_met and v not in ("gate_unknown","gate_timeout"):
        errs.append("unknown_not_short_circuited")      # 数据不足却硬判
    # ===== 铁律①:过闸是建议,不自动推进 =====
    adv = out.get("advance_suggestion")
    if v == "passed":
        if adv and not adv.get("hitl_required"):
            errs.append("advance_without_hitl")         # 推进未走 HITL
        if out.get("_auto_advanced"):
            errs.append("auto_advanced_gate")           # 机器自动进了新区域
        if out.get("status") not in ("awaiting_advance_hitl",) and not out.get("_advance_declined"):
            errs.append("passed_not_awaiting_hitl")
    # ===== 铁律②:不达标给纠偏非放弃 =====
    if v == "not_passed":
        if not out.get("correction_directions"):
            errs.append("not_passed_without_correction") # 不达标没给纠偏
        if out.get("_city_abandoned"):
            errs.append("city_abandoned_on_fail")        # 不达标就放弃城市
        # 纠偏须逐条对应失败条件
        failed = {c["name"] for c in conds if c.get("met") is False}
        covered = {d.get("failed_condition") for d in out.get("correction_directions", [])}
        if failed - covered:
            errs.append(f"correction_not_per_condition:{failed-covered}")
    # ===== 铁律③:只读不重算/不采集 =====
    for c in conds:
        if not c.get("evidence_ref"):
            errs.append(f"condition_without_evidence:{c.get('name')}")  # 事实须带来源指针
    if out.get("_recomputed_facts") or out.get("_collected_facts"):
        errs.append("fact_recomputed_or_collected")
    # ===== 超时维独立 =====
    to = out.get("timeout")
    if to and to.get("exceeded") and v != "gate_timeout" and out.get("status") != "gate_timeout":
        errs.append("timeout_not_flagged")
    # ===== 不拨款不批 =====
    for f in out.get("fanout", []):
        if any(x in f for x in ("拨款","批投入","自动推进","进区域执行","投入下拨")):
            errs.append(f"illegal_advance_action:{f}")
    return errs
```

---

## 11. 评测起手式(8 条种子)

```json
[
 {"id":"g01",
  "input":{"gate":"Gate1","facts":{"上架达标":true,"陈列达标":true,"首购发生":true,"初步动销":true,"价格可接受":true}},
  "expect":{"gate_verdict":"passed","advance_suggestion":"建议进关键区域","hitl_required":true,
            "not_auto_advanced":true},
  "tags":["Gate1全AND达标→判点亮;建议推进但HITL"]},

 {"id":"g02",
  "input":{"gate":"Gate1","facts":{"上架达标":true,"陈列达标":false,"首购发生":true,"初步动销":false,"价格可接受":true}},
  "expect":{"gate_verdict":"not_passed","correction_directions":"陈列→纠陈列/话术,动销→促销/试吃",
            "per_condition":true,"error_if_pass":"passed_without_all_and"},
  "tags":["部分达标(差2项)不算过闸;逐条针对性纠偏"]},

 {"id":"g03",
  "input":{"gate":"Gate1 not_passed","temptation":"直接放弃成都"},
  "expect":{"no_abandon":true,"correction_directions_present":true,
            "error_if_abandon":"city_abandoned_on_fail"},
  "tags":["不达标≠砍:给纠偏方向继续攻,不放弃城市"]},

 {"id":"g04",
  "input":{"gate_verdict":"passed","event":"机器想自动把资源投到关键区域"},
  "expect":{"blocked":"auto_advanced_gate","status":"awaiting_advance_hitl",
            "note":"进新区域=加投入,走HITL/JBP/D-001"},
  "tags":["铁律①:过闸≠自动推进,加投入走HITL"]},

 {"id":"g05",
  "input":{"gate":"Gate1","months_in_gate":4,"limit":3,"verdict":"not_passed"},
  "expect":{"status":"gate_timeout","timeout":{"action":"转人工评估救/调/换区域"},
            "error_if_not_flagged":"timeout_not_flagged"},
  "tags":["超3月未点亮→gate_timeout转人工(超时独立于达标)"]},

 {"id":"g06",
  "input":{"effective_stage":"衰退"},
  "expect":{"status":"not_assault_stage","no_advance":true,
            "error_if_assault":"assault_in_nonassault_stage"},
  "tags":["衰退期不攻坚(不给要退的市场加投入)"]},

 {"id":"g07",
  "input":{"gate":"Gate1","facts":{"上架达标":true,"陈列达标":true,"首购发生":true,"初步动销":true,"价格可接受":null}},
  "expect":{"gate_verdict":"gate_unknown","not_forced_pass":true,
            "error_if_pass":"passed_with_unknown_condition"},
  "tags":["价格数据没接(unknown)→gate_unknown不硬判过闸"]},

 {"id":"g08",
  "input":{"gate_verdict":"passed","event":"模块想直接拨投入/批推进"},
  "expect":{"blocked":"illegal_advance_action","only_suggestion":true,
            "note":"投入档位地基②、审批D-001,本节点不拨不批"},
  "tags":["推进需HITL不自动拨款:投入地基②、审批D-001"]}
]
```

**打分维度(每条 0/1):**
1. Gate1 全达标判点亮(g01)
2. **部分达标不算过闸+逐条纠偏**(g02:§10 passed_without_all_and 守)
3. **不达标给纠偏非砍**(g03)
4. **铁律①过闸≠自动推进**(g04:auto_advanced_gate 守)
5. 超时转人工(g05)
6. 衰退期不攻坚(g06)
7. 数据不足不判过闸(g07)
8. **推进需HITL不拨款**(g08)

> 最危险的三类错(都把"判断"越权成"推进"或"放弃"):**过闸自动推进**(g04——机器判达标就把资源投下去,替 JBP 做了加投入的不可逆决定)、**不达标就砍城市**(g03——一个能纠的小短板葬送整个城市,违背"不达标≠砍")、**部分达标算过闸**(g02——带着短板进下一关,问题在更大盘子上放大)。城市攻坚闸门的价值在于**把"够不够格"和"要不要进"分开**:前者是机器读事实的客观判断,后者是人承担资源风险的决定。机器守住闸,人决定推进——这道分界就是 HITL。

---

## 待填变量(套用时替换)
- `owner` / backlog 编号
- §9b 各 Gate AND 条件的达标阈值(上架率/陈列合规/动销线/复购线/费用率/利润率)— 回测校准
- **`<首攻月数上限>` / `<复制月数上限>`**(PDF=3 月)— 节奏校准
- §9d 推进 HITL 阈值与 D-001 审批联动
- 首购/复购/价格/收入/利润 数据源 — 接入(经 MCP);接入后更新 §2 状态
- effective_stage 地基① / L0-02·L1-03·L0-08·L0-07 事实 — 只读契约对齐
- JBP 城市目标 — 作过闸目标锚接入
- 城市攻坚台账落库 — 与既有台账同基建分表(记城市×区域×闸×月数)
