---
name: sprint-13week-tracking
description: 回答"这个季度冲刺(13周)走到第几周、每周节拍对不对、哪里偏离了"——把季度目标(JBP/北极星锁定)拆成13周节拍(拆解可溯源),每周比实际vs本周累计目标判节拍状态(领先/正常/偏离/严重偏离),偏离分"节奏问题(该追赶)vs外部冲击(断货/竞品/政策,该重评)",达标推演出区间非单点,严重/连续偏离标 sprint_at_risk 转人工。目标锁定后机器绝不自动下调(诚信命门),改目标只接受人/JBP显式指令且全程留痕。凡涉及"13周冲刺、季度冲刺、节拍、周目标、进度追踪、偏离预警、冲刺复盘、能不能达标"的输入都用本 Skill。它是冲刺节奏的真相源(L5-04,L5增长层)——**不改目标、不自动派任务、不重算进度事实、不判生命周期阶段**。**接口先行**:进度数据部分接入,节拍拆解写死,阈值占位。下游:城市经理/JBP(冲刺复盘)/ 冲刺台账。
version: v0.1
owner: <填:负责人/团队>
type: Workflow / Skill(L5增长层 · 节拍追踪 · 接口先行 · 无自动改目标 · L5-04)
status: 粗糙版 v0.1,接口先行;进度数据部分接入,节拍拆解与偏离判定写死,阈值占位
upstream: 季度目标(JBP/北极星分解/L5-03 城市攻坚目标,目标锚只读)/ SKU 生命周期 effective_stage(地基①,只读)/ L1-03 动销 · L5-03 过闸 · L1-04 覆盖(进度事实,只读)/ 冲刺台账(13周状态)
downstream: 城市经理 · JBP(冲刺复盘)/ 冲刺台账(回写)
backlog: L5-04
---

# 13周冲刺追踪 Skill v0.1 · L5增长层·节拍追踪(L5-04)

> 本 Skill 依据《INFINITY OS · Agent 设计标准 v1.0》编写。
> 它是一个 **Workflow**(写死轨道)+ **13周冲刺台账**(有状态,记第几周/累计/偏离史)。
> 回答"**走到第几周、节拍对不对、哪里偏离**"——把季度目标拆 13 周,每周追实际 vs 目标。供城市经理/JBP 复盘。**追踪/预警,不改目标。**

> **⚠️ 三条铁律(诚信命门):**
> ① **偏离绝不偷偷改目标**——目标季度初由 JBP/北极星锁定,落后就**如实报落后**,机器**绝不为让进度显绿而下调目标**(改目标 = move goalposts,看板就废了);改目标只能人/JBP 显式操作且留痕(原目标→新目标→谁→为什么→何时)。
> ② **偏离分"节奏问题 vs 外部冲击"**——执行慢了(该追赶)vs 断货/竞品/政策导致的偏离(非节奏的锅,该重评,同战功系统性过滤精神),诊断方向相反。
> ③ **只读事实不重算**——动销读 L1-03、过闸读 L5-03、覆盖读 L1-04,本节点只比"实际 vs 本周目标",不重算事实。

> **⚠️ 接口先行:** 进度数据部分接入,节拍拆解与偏离判定规则写死,阈值占位。

---

## 1. 角色与目标 + 边界【先读这个】

你是 **冲刺节奏的真相源**:把季度目标拆 13 周节拍,每周如实报实际 vs 目标、偏在哪、是追赶还是重评。产出物是**节拍状态 + 偏离诊断 + 达标推演**——**目标只读不改,落后如实报**。

**与兄弟节点边界(写死):**

| 事 | 归谁 | 本节点角色 |
|---|---|---|
| 季度目标设定/变更 | **JBP/北极星/人** | **只读作锚;改目标只接受人显式指令+留痕,机器不改** |
| 生命周期阶段 | 地基① | 只读 effective_stage,不重判 |
| 动销进度 | L1-03 | 只读,不重算 |
| 过闸进度 | L5-03 | 只读,不重算 |
| 覆盖进度 | L1-04 | 只读,不重算 |
| 派任务 | 别的节点/人 | **不碰**——只预警,不派活 |
| **节拍拆解 + 偏离诊断 + 达标推演** | **本节点** | 唯一真相源 |

**目标/实际物理两栏(沿地基① human_override 范式):** `target_track`(目标,人/JBP 写)与 `actual_track`(实际,机器读事实填)**物理隔离**——机器只写 actual、只读 target,**绝不改 target**;目标变更走独立 `goal_changes[]` 留痕栏。

**机器与人:** 追踪/预警无 HITL(如实报)。但**改目标、严重偏离重评需人/JBP**。

---

## 2. 输入(Input)— 含接入状态

| 信号 | 来源 | 状态 | 用途 |
|---|---|---|---|
| 季度目标 | JBP/北极星/L5-03 | 占位 | 13 周拆解的源 |
| effective_stage | 地基① | 可用(只读) | 冲刺重点随阶段 |
| 动销进度 | L1-03 | 可用(只读) | 实际 |
| 过闸进度 | L5-03 | 可用(只读) | 实际 |
| 覆盖进度 | L1-04 | 可用(只读) | 实际 |
| 外部冲击信号 | L0-07 断货 / L0-05 竞品 / D-001 政策 | 各节点(只读) | 偏离归因(外部 vs 节奏) |
| 冲刺台账 / `now` | 内部 | 可用 | 第几周/累计/偏离史 |

> partial 常态:进度数据部分缺时,该周推演给宽区间标 `low_confidence`,**绝不因数据缺就美化进度**(缺数据=报不确定,不是报达标)。

---

## 3. 参数定义(Parameters)

| 字段 | 类型 | 说明 |
|---|---|---|
| `sku` / `scope` / `quarter` | string | SKU × 区域 × 季度 |
| `current_week` | number | 当前第几周(1~13) |
| `effective_stage` | enum | 读自地基①,只读不重判;冲刺重点随阶段(§9b) |
| `target_track` | object[] | **目标栏(人/JBP 锁定,机器只读)**:13 周每周累计目标 + `breakdown_basis`(拆解溯源) |
| `actual_track` | object[] | **实际栏(机器读事实填)**:每周实际 + `evidence_ref` |
| `cadence_status` | enum | `领先` / `正常` / `偏离` / `严重偏离`(本周实际 vs 本周累计目标,§9c) |
| `deviation_diagnosis` | object\|null | 偏离诊断:`{type: 节奏问题/外部冲击, cause, evidence_ref, direction: 追赶/重评}`(§9d) |
| `cumulative` | object | 累计进度:`{实际累计, 目标累计, 完成率, 剩余周数}` |
| `attainment_projection` | object | **达标推演区间(非单点)**:`{乐观, 悲观, confidence, basis}`(§9e) |
| `goal_changes[]` | object[] | **目标变更留痕(仅人/JBP)**:`{原目标, 新目标, by, reason, at}`——机器写此即违规 |
| `status` | enum | `on_track` / `deviating` / `sprint_at_risk` / `low_confidence` |
| `flags` | string[] | `behind_reported_honestly` / `deviation_external` / `deviation_pace` / `sprint_at_risk` / `goal_locked` 等 |
| `summary_text` | string | 走到哪、对不对节拍、偏在哪、追赶还是重评(可溯源) |
| `fanout` | string[] | 城市经理/JBP复盘/偏离预警/台账;**无自动改目标/派任务项** |

---

## 4. 处理流程(Steps · 链式,周节奏,有状态)

### Step A — 季度目标 → 拆 13 周节拍(可溯源,按阶段)
1. 读季度目标(JBP/北极星/L5-03,**只读**)。
2. 按 §9a 节拍规则拆 13 周,**拆解可溯源**(每周目标怎么来的,不是机器拍):按阶段(§9b)——**导入期前几周冲铺货点亮、后段看动销**;成长期冲复制;成熟期冲收入利润。
3. 写入 `target_track`(目标栏)——**一旦锁定,机器只读不改**。

### Step B — 每周读实际 × 比本周累计目标 → 判节拍(只读事实)
- 读本周实际(L1-03/L5-03/L1-04,**只读不重算**)填 `actual_track`(带 evidence_ref)。
- 比本周累计目标 → `cadence_status`(§9c):领先/正常/偏离/严重偏离。
- **落后如实报**——实际低于目标就报偏离,`flags+=behind_reported_honestly`,**绝不下调目标让它显绿**。

### Step C — 偏离诊断:节奏问题 vs 外部冲击(§9d)
偏离 → 先分归因(读外部信号,**不自判**):
- 读 L0-07 断货 / L0-05 竞品 / D-001 政策等外部信号;
- **命中外部信号 → `type:外部冲击`**,`direction:重评`(非节奏的锅,目标可能要重评,不逼人追赶);
- **无外部信号 → `type:节奏问题`**,`direction:追赶`(执行慢了,给追赶建议)。
- 同战功系统性过滤精神:**外部的锅不算执行的偏离**,诊断方向相反。

### Step D — 严重/连续偏离 → 转人工
- `严重偏离` 或连续 `<连续偏离周数>` 周偏离 → `sprint_at_risk` 转人工评估(追赶 / 重评目标)。
- **重评目标是人的决定**,机器只标风险,不自动改 target。

### Step E — 达标推演(出区间非单点,继承 L2-01)
- 按当前累计 + 剩余周数,推演季末达标:**乐观节拍**(保持近期最好周速)~ **悲观节拍**(近期最差周速)→ `attainment_projection{乐观, 悲观, confidence}`。
- **出区间不出单点**——"按当前节拍能否达标"是预测,给区间+置信(§9e),不给"预计完成87%"假精确;数据不足 → 宽区间 low_confidence。

### Step F — 目标变更(仅人/JBP,留痕)
- 目标变更**只接受人/JBP 显式指令** → 写 `goal_changes[]`(原→新→谁→为什么→何时);
- **机器绝不自动改 target**(§10 goal_silently_lowered 守)。

### Step G — 出件
脚本产 target/actual/cadence/projection → LLM 写 summary_text(走到哪、节拍对不对、偏在哪、追赶还是重评,可溯源)→ 跑 §10 → 扇出(城市经理/JBP/台账)→ 回写。

---

## 5. 规则与强度(RFC2119)

| 强度 | 规则 |
|---|---|
| **MUST NOT** | **目标锁定后机器绝不自动下调**——落后如实报,绝不为让进度显绿改目标(move goalposts 看板就废了)。 |
| **MUST** | **改目标只接受人/JBP 显式指令 + 全程留痕**(原目标→新目标→谁→为什么→何时);目标/实际物理两栏隔离。 |
| **MUST** | **落后如实报,不美化**;数据不足报不确定(宽区间 low_confidence),不报达标。 |
| **MUST** | **偏离诊断必须分节奏问题 vs 外部冲击**(读外部信号 L0-07/L0-05/D-001);外部的锅不算执行偏离,诊断方向相反(同战功系统性过滤)。 |
| **MUST** | **达标推演出区间非单点**(乐观~悲观+置信);数据不足宽区间标 low_confidence。 |
| **MUST** | 13 周拆解必须可溯源(每周目标怎么来的);严重/连续偏离转人工评估。 |
| **MUST NOT** | **只读事实不重算**(L1-03/L5-03/L1-04);**只读阶段不重判**(地基①);**不自动派任务**(只预警)。 |
| **SHOULD** | 冲刺重点应随阶段(导入冲点亮/成长冲复制/成熟冲收入利润);偏离诊断应附外部信号证据指针。 |
| **MAY** | 可附 13 周节拍时间轴;多 SKU/区域冲刺看板。 |

---

## 6. 输出(Output · Artifact 契约)

```json
{
  "sku": "6MX-QY-500", "scope": { "city": "成都" }, "quarter": "2026-Q3",
  "current_week": 6,
  "effective_stage": "导入",
  "target_track": [
    { "week": 1, "cum_target": "铺货30店", "breakdown_basis": "导入期前段冲铺货,季度目标260店÷节拍" },
    { "week": 6, "cum_target": "铺货150店+动销启动", "breakdown_basis": "前6周累计目标" }
  ],
  "actual_track": [
    { "week": 6, "actual": "铺货128店", "evidence_ref": "L1-03:成都铺货128" }
  ],
  "cadence_status": "偏离",
  "deviation_diagnosis": {
    "type": "外部冲击", "cause": "供货中断致铺货停滞",
    "evidence_ref": "L0-07:成都仓断货9天", "direction": "重评(非节奏的锅,目标可能要顺延)"
  },
  "cumulative": { "实际累计": 128, "目标累计": 150, "完成率": 0.85, "剩余周数": 7 },
  "attainment_projection": {
    "乐观": "260店(若断货解除恢复节拍)", "悲观": "210店(若节拍不恢复)",
    "confidence": "mid", "basis": "近4周最好/最差周速外推,断货为外部变量"
  },
  "goal_changes": [],
  "status": "deviating",
  "flags": ["behind_reported_honestly", "deviation_external", "goal_locked"],
  "summary_text": "加点鲜500ml@成都 Q3冲刺第6周(导入期):目标累计铺货150店,实际128店,偏离15%(如实报,目标未动)。诊断为外部冲击——成都仓断货9天致铺货停滞(L0-07),非执行节奏问题,方向是重评目标顺延而非逼追赶。达标推演:断货解除则乐观260店、不恢复则悲观210店(置信中)。目标锁定,任何调整需JBP显式操作。"
}
```

> 落后如实报示例:实际<目标 → 报偏离 + `behind_reported_honestly`,**目标栏数字不变**。
> 机器改目标拦截示例:机器试图把 cum_target 从 150 改成 128 让完成率显 100% → §10 `goal_silently_lowered` 报错。
> 外部 vs 节奏示例:断货致偏离→`type:外部冲击,direction:重评`;纯执行慢→`type:节奏问题,direction:追赶`。
> 严重偏离示例:连续 3 周偏离 → `status:sprint_at_risk` 转人工。
> 推演区间示例:**乐观~悲观两个数 + 置信**,不是"预计完成 87%"单点。
> 人改目标示例:`goal_changes:[{原目标:260店,新目标:230店,by:"JBP-Wang",reason:"断货顺延",at:"..."}]` ——留痕,机器没碰。

---

## 7. 节奏 + 扇出(写死)

| 项 | 规则 |
|---|---|
| 节奏 | 周(13 周冲刺,每周追节拍) |
| 扇出 | 城市经理/JBP 复盘 · 偏离预警 · 冲刺台账回写;**目标变更仅承载人/JBP 指令并留痕** |
| 禁区 | **绝不**:自动改/下调目标、美化进度、派任务、采集/重算事实、重判阶段、推演出单点、把外部冲击当节奏偏离逼追赶 |

---

## 8. HITL 卡点 —— 本节点【追踪无,改目标/重评有】

- **追踪/预警无 HITL**:如实报节拍,不出账不可逆。
- **改目标必须人/JBP 显式操作 + 留痕**:机器绝不自动改 target;目标变更是人的权力,机器只承载并留痕。
- **严重/连续偏离重评 → 转人工**:`sprint_at_risk` 由人评估追赶还是重评目标,机器只标风险不自动改目标。
- 诚信命门:**机器可以报"落后了",但绝不能为了好看把目标改低**——move goalposts 一次,这个看板的所有绿色就都不可信了。

---

## 9. References

### 9a. 13 周节拍拆解规则(写死,可溯源;阈值占位)

| 拆法 | 规则 |
|---|---|
| 均匀拆 | 季度目标 ÷ 13(线性节拍) |
| 阶段加权拆 | 按 §9b 阶段重点前重后轻/前轻后重(如导入期前段冲铺货) |
| 溯源 | 每周 `cum_target` 必带 `breakdown_basis`(怎么拆来的,非机器拍) |

### 9b. 阶段冲刺重点表(写死)

| effective_stage | 冲刺重点 | 节拍取向 |
|---|---|---|
| 导入 | 点亮(前段铺货/陈列/首购,后段动销) | 前段冲铺货点亮 |
| 成长 | 复制(动销增长/区域复制) | 冲复制扩张 |
| 成熟 | 赚钱(收入/利润) | 冲收入利润 |
| 衰退 | 守(控费/清库存) | 不冲扩张 |
| unknown | 保守 | 宽推演 low_confidence |

### 9c. 节拍状态分级(写死,占位)

| 状态 | 条件(实际 vs 本周累计目标) |
|---|---|
| 领先 | 实际 ≥ 目标 × `<领先线>` |
| 正常 | 在目标 ± `<正常带>` |
| 偏离 | 实际 < 目标 × `<偏离线>` |
| 严重偏离 | 实际 < 目标 × `<严重线>` 或连续 `<连续偏离周数>` 周偏离 |

### 9d. 偏离诊断分类(节奏 vs 外部,写死)

| 诊断 | 判据 | 方向 |
|---|---|---|
| **外部冲击** | 命中 L0-07 断货 / L0-05 竞品 / D-001 政策 等外部信号 | **重评**(非节奏锅,目标可能顺延) |
| **节奏问题** | 无外部信号,纯执行慢 | **追赶**(给追赶建议) |

> 同战功系统性过滤:外部的锅不算执行偏离;诊断方向相反——外部→重评,节奏→追赶。

### 9e. 达标推演(区间非单点,继承 L2-01)

| 项 | 规则 |
|---|---|
| 乐观节拍 | 保持近期最好周速外推到季末 |
| 悲观节拍 | 保持近期最差周速外推 |
| 置信 | 数据齐全 high / 部分缺 mid / 不足 low(宽区间) |

> 出乐观~悲观区间 + 置信,**绝不出单点完成率**(预测非承诺,同 L2-01)。

### 9f. 术语 / 踩坑

| 术语 | 含义 |
|---|---|
| move goalposts | 偷偷改目标让进度显绿(诚信命门禁) |
| 目标/实际两栏 | 物理隔离,机器只写实际只读目标 |
| 节奏 vs 外部 | 执行慢(追赶)/ 外部冲击(重评) |
| 推演区间 | 乐观~悲观非单点 |

- ❌(诚信命门,值得记)**偏离了偷偷下调目标让完成率显绿**:实际128店、目标150,机器把目标改成128 → 完成率瞬间100%,但看板从此全是假绿,谁都不敢信 → ✅ 目标锁定机器只读,落后如实报,改目标只能人显式+留痕。
- ❌(值得记)**外部冲击当节奏问题逼追赶**:断货9天导致铺货停滞,却催销售加班追赶 → 系统的锅让执行背,和战功命门①同一种冤案 → ✅ 偏离分节奏vs外部,外部冲击→重评目标非逼追赶。
- ❌ 达标推演给单点"预计完成87%":被当承诺,季末没到就甩锅推演 → ✅ 出乐观~悲观区间+置信,预测非承诺。
- ❌ 数据没接就当达标报绿:缺数据美化成完成 → ✅ 数据不足报不确定(宽区间low_conf),不报达标。
- ❌ 13周目标机器随手拍,没说怎么拆的:拆解不可溯源,下游不知目标合不合理 → ✅ 每周cum_target带breakdown_basis。
- ❌ 本节点重算了动销进度:和L1-03不一致 → ✅ 只读不重算。
- ❌ 偏离了机器自动派追赶任务:越权派活 → ✅ 只预警不派任务。
- _(后续迭代继续往下加)_

---

## 10. Scripts — 节拍拆解 / 实际vs目标 / 偏离诊断 / 推演区间 / 目标变更留痕 / 只读校验(出件前必跑)

```python
EXTERNAL_SIGNALS = {"断货", "竞品冲击", "政策变更", "供应链中断"}  # §9d 外部冲击源

def split_13week(quarter_target, stage, weights=None):
    """拆13周,可溯源。weights 按阶段(§9b);默认均匀。"""
    if weights is None:
        weights = [1/13]*13                       # 均匀
    cum, acc = [], 0
    for w in weights:
        acc += quarter_target * w
        cum.append(round(acc, 1))
    return cum                                     # 每周累计目标,带 basis 由调用方填

def cadence(actual, cum_target, thresholds):
    """本周实际 vs 本周累计目标 → 节拍状态。"""
    if cum_target == 0: return "正常"
    ratio = actual / cum_target
    if ratio >= thresholds["lead"]: return "领先"
    if ratio >= thresholds["normal_low"]: return "正常"
    if ratio >= thresholds["deviate_low"]: return "偏离"
    return "严重偏离"

def diagnose(deviated, external_hits):
    """偏离归因:命中外部信号→外部冲击(重评);否则节奏问题(追赶)。"""
    if not deviated: return None
    if external_hits:
        return {"type": "外部冲击", "cause": external_hits, "direction": "重评"}
    return {"type": "节奏问题", "direction": "追赶"}

def project(actual_cum, best_rate, worst_rate, weeks_left):
    """达标推演:乐观~悲观区间,非单点。"""
    optimistic = actual_cum + best_rate * weeks_left
    pessimistic = actual_cum + worst_rate * weeks_left
    return {"乐观": round(optimistic), "悲观": round(pessimistic)}

def validate(out):
    errs = []
    # ===== 诚信命门:目标不被机器改/下调 =====
    if out.get("_machine_wrote_target") or out.get("_machine_lowered_goal"):
        errs.append("goal_silently_lowered")           # 机器偷改目标
    for gc in out.get("goal_changes", []):
        if gc.get("by") in (None, "machine", "auto"):
            errs.append("goal_change_by_machine")       # 目标变更必须人/JBP
        if not gc.get("reason") or not gc.get("原目标"):
            errs.append("goal_change_without_trace")    # 变更须留痕
    # 落后必须如实报(实际<目标却没报偏离)
    cum = out.get("cumulative", {})
    if cum.get("实际累计") is not None and cum.get("目标累计"):
        if cum["实际累计"] < cum["目标累计"] and out.get("cadence_status") in ("领先","正常"):
            errs.append("behind_not_reported")          # 落后却报正常=美化
    # ===== 偏离必须分节奏 vs 外部 =====
    if out.get("cadence_status") in ("偏离","严重偏离"):
        d = out.get("deviation_diagnosis")
        if not d or d.get("type") not in ("节奏问题","外部冲击"):
            errs.append("deviation_not_classified")
        if d and d.get("type") == "外部冲击" and not d.get("evidence_ref"):
            errs.append("external_without_evidence")    # 外部诊断须证据指针
        if d and d.get("type") == "外部冲击" and d.get("direction") == "追赶":
            errs.append("external_forced_catchup")      # 外部冲击却逼追赶=冤案
    # ===== 推演出区间非单点 =====
    ap = out.get("attainment_projection") or {}
    if ap and ("乐观" not in ap or "悲观" not in ap):
        errs.append("projection_single_point")          # 推演给了单点
    if ap and not ap.get("confidence"):
        errs.append("projection_without_confidence")
    # ===== 拆解可溯源 =====
    for t in out.get("target_track", []):
        if t.get("cum_target") is not None and not t.get("breakdown_basis"):
            errs.append(f"target_without_basis:week{t.get('week')}")
    # ===== 严重/连续偏离转人工 =====
    if out.get("cadence_status") == "严重偏离" and out.get("status") != "sprint_at_risk":
        errs.append("severe_not_at_risk")
    # ===== 数据不足报不确定不报达标 =====
    if out.get("status") == "low_confidence" and ap.get("confidence") != "low":
        errs.append("low_data_not_low_conf")
    # ===== 只读不重算/不派任务 =====
    for t in out.get("actual_track", []):
        if t.get("actual") is not None and not t.get("evidence_ref"):
            errs.append(f"actual_without_evidence:week{t.get('week')}")
    if out.get("_recomputed_facts"):
        errs.append("fact_recomputed")
    for f in out.get("fanout", []):
        if any(x in f for x in ("派任务","下发任务","自动改目标","下调目标","派活")):
            errs.append(f"illegal_action:{f}")
    return errs
```

---

## 11. 评测起手式(8 条种子)

```json
[
 {"id":"s01",
  "input":{"week":6,"actual":152,"cum_target":150},
  "expect":{"cadence_status":"正常","goal_unchanged":true,"no_deviation":true},
  "tags":["正常节拍:实际达本周累计目标,判正常"]},

 {"id":"s02",
  "input":{"week":6,"actual":128,"cum_target":150,"external":"无"},
  "expect":{"cadence_status":"偏离","behind_reported":true,"goal_unchanged":"目标仍150",
            "flags_contains":"behind_reported_honestly","error_if_lowered":"goal_silently_lowered"},
  "tags":["诚信命门:落后如实报偏离,绝不下调目标显绿"]},

 {"id":"s03",
  "input":{"event":"机器试图把cum_target从150改成128让完成率显100%"},
  "expect":{"blocked":"goal_silently_lowered / goal_change_by_machine",
            "note":"目标只读,改目标只能人/JBP显式+留痕"},
  "tags":["诚信命门:机器改目标→报错(move goalposts禁)"]},

 {"id":"s04",
  "input":{"week":6,"actual":128,"cum_target":150,"external":"L0-07成都断货9天"},
  "expect":{"deviation_diagnosis":{"type":"外部冲击","direction":"重评"},
            "not_forced_catchup":true,"error_if_catchup":"external_forced_catchup"},
  "tags":["外部冲击:断货致偏离→标外部、方向重评,非逼追赶(同战功系统性过滤)"]},

 {"id":"s05",
  "input":{"cadence_status":"严重偏离 / 连续3周偏离"},
  "expect":{"status":"sprint_at_risk","to_human":true,
            "error_if_not":"severe_not_at_risk"},
  "tags":["严重/连续偏离→sprint_at_risk转人工评估"]},

 {"id":"s06",
  "input":{"actual_cum":128,"weeks_left":7,"best_rate":19,"worst_rate":12},
  "expect":{"attainment_projection":{"乐观":261,"悲观":212},"is_range":true,
            "error_if_single":"projection_single_point"},
  "tags":["达标推演出区间(乐观~悲观)非单点,继承L2-01"]},

 {"id":"s07",
  "input":{"goal_change":{"原目标":260,"新目标":230,"by":"JBP-Wang","reason":"断货顺延"}},
  "expect":{"goal_changes_recorded":true,"by_human":true,"traced":true,
            "machine_did_not_touch":true},
  "tags":["改目标:人/JBP显式+留痕(原→新→谁→为什么)"]},

 {"id":"s08",
  "input":{"actual":"动销进度","temptation":"重算一遍L1-03动销"},
  "expect":{"read_only":true,"error_if_recompute":"fact_recomputed",
            "no_task_dispatch":true},
  "tags":["只读不重算事实、不自动派任务"]}
]
```

**打分维度(每条 0/1):**
1. 正常节拍判正常(s01)
2. **诚信命门:落后如实报不下调**(s02:§10 goal_silently_lowered/behind_not_reported 守)
3. **机器改目标报错**(s03)
4. **外部冲击非节奏、不逼追赶**(s04:external_forced_catchup 守)
5. 严重偏离转人工(s05)
6. **推演出区间非单点**(s06)
7. 改目标人显式留痕(s07)
8. 只读不重算不派任务(s08)

> 最危险的三类错(都伤"看板的可信度"):**偷偷改目标**(s02/s03——move goalposts 一次,所有绿色就都不可信,这是冲刺看板的死刑)、**外部冲击当节奏偏离逼追赶**(s04——断货的锅让销售背,和战功命门①同一种冤案)、**推演给单点**(s06——预测被当承诺)。13周冲刺追踪的价值在于**如实**:走到哪报到哪、落后就报落后、是谁的锅分清楚、能不能达标给区间不给假数。一个会自己改目标的看板,比没有看板更危险——因为它制造"一切尽在掌控"的幻觉。

---

## 待填变量(套用时替换)
- `owner` / backlog 编号
- §9a 节拍拆解权重(均匀/阶段加权)/ §9c 节拍状态阈值(领先/正常/偏离/严重线 + `<连续偏离周数>`)— 回测校准
- §9b 阶段冲刺重点系数
- §9e 推演周速口径(近 N 周最好/最差)
- 季度目标源(JBP/北极星/L5-03)— 接入作锚
- effective_stage 地基① / L1-03 动销 / L5-03 过闸 / L1-04 覆盖 — 只读契约对齐
- 外部冲击信号(L0-07/L0-05/D-001)— 偏离归因接入
- 冲刺台账落库 — 与既有台账同基建分表(记 13 周状态/偏离史/目标变更)
