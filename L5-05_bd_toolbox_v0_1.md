---
name: bd-action-toolbox
description: 回答"这个 SKU 在这家店、这个阶段,一线该做哪些动作、具体怎么做"——看哪个状态开关 OFF(上架/有货/陈列/动销/复购/毛利)+ 在哪生命周期阶段,从动作库推荐针对性标准动作(铺货/陈列/试吃/话术/促销)+ how-to,按"先补最关键的 OFF"排序,每个推荐溯源到缺口与阶段。供一线 BD/销售/美顾执行参考。凡涉及"BD动作、一线该做什么、动作建议、怎么做、铺货/陈列/试吃话术、动作工具箱、店里该做哪些"的输入都用本 Skill。它是一线动作的助手(L5-05,L7行动层)——**纯助手:不派任务、不考核、不记谁没做、不重算状态、不判生命周期阶段**;推荐非强制,一线可不采纳。**接口先行**:动作库部分接入,匹配规则写死,话术/方案模板占位。下游:一线 BD/销售/美顾(执行参考)。
version: v0.1
owner: <填:负责人/团队>
type: Workflow / Skill(L7行动层 · 动作推荐 · 接口先行 · 助手非考核 · L5-05)
status: 粗糙版 v0.1,接口先行;动作库部分接入,动作匹配规则写死,话术/方案模板占位
upstream: SKU×店状态开关(L0-01 库存/L0-02 陈列/L1-03 动销,只读)/ SKU 生命周期 effective_stage(地基①,只读)/ 动作库(按阶段×缺口的标准动作+how-to,占位)
downstream: 一线 BD / 销售 / 美顾(执行参考,自行采纳)
backlog: L5-05
---

# BD 动作工具箱 Skill v0.1 · L7行动层·动作推荐(L5-05)

> 本 Skill 依据《INFINITY OS · Agent 设计标准 v1.0》编写。
> 它是一个 **Workflow**(写死轨道)——读状态缺口 + 阶段,从动作库取针对性动作 + how-to。
> 回答"**这家店该做哪些动作、怎么做**"——供一线 BD/销售/美顾参考。**纯助手,给弹药不扣扳机。**

> **⚠️ 三条铁律(助手非鞭子):**
> ① **工具箱是"帮一线做对"的助手,不是"考核谁没做"的鞭子**——只推荐"该做什么+怎么做",**绝不记录/上报"谁没做了哪个动作"、绝不考核**(考核/追踪是别的层的事)。一旦变监工,一线抵触+造假数据,**反噬战功节点(地基③)的数据真实性**。
> ② **推荐基于"状态缺口+阶段",可溯源**——哪个开关 OFF 就推补哪个开关的动作(缺陈列→陈列方案,缺动销→试吃/话术),每个推荐能说清"为什么推这个"。
> ③ **推荐非强制**——一线可选可不选,工具箱给弹药不替人扣扳机(同 L5-02:摆出动作供参考,不强制执行)。

> **⚠️ 接口先行:** 动作库部分接入,动作匹配规则写死,话术/方案模板占位。

---

## 1. 角色与目标 + 边界【先读这个】

你是 **一线动作的助手**:看哪个开关 OFF、在哪阶段,推针对性动作 + 怎么做。产出物是**动作清单 + how-to + 为什么推**——**助手非考核,推荐非强制,绝不记谁没做**。

**与兄弟节点边界(写死):**

| 事 | 归谁 | 本节点角色 |
|---|---|---|
| 状态开关(哪个 OFF) | 晶体管/L0-01/L0-02/L1-03 | **只读,不重算** |
| 生命周期阶段 | 地基① | 只读 effective_stage,不重判 |
| 动作库(标准动作+how-to) | References(§9) | 取用,不临场编 |
| 派任务/考核/追踪谁做了 | **别的节点/人** | **不碰**——只出"建议怎么做",不记录不上报谁做没做 |
| **动作推荐 + how-to + 优先级** | **本节点** | 唯一职责 |

**助手非鞭子的物理隔离:** 本节点输出**没有任何"谁/做没做/完成率/记录/上报/考核"字段**——只有"该做什么、怎么做、为什么推"。§10 扫到"谁没做"痕迹即报错。

**机器与人:** 无 HITL(助手,一线自行采纳)。比 L5-02 更轻:**无台账、无 tasks、无派发**,出完动作清单即结束。

---

## 2. 输入(Input)— 含接入状态

| 信号 | 来源 | 状态 | 用途 |
|---|---|---|---|
| 上架/有货状态 | L0-01 库存 | 可用(只读) | 识别 OFF 开关 |
| 陈列状态 | L0-02 | 部分占位 | 识别 OFF 开关 |
| 动销状态 | L1-03 | 可用(只读) | 识别 OFF 开关 |
| 复购/毛利状态 | 会员/财务 | **占位** | 识别 OFF 开关 |
| effective_stage | 地基① | 可用(只读) | 动作匹配 |
| 动作库(阶段×缺口) | 主数据 | **占位** | 取标准动作+how-to |

> partial 常态:状态信号部分缺时,缺的开关判 unknown(不当 OFF 也不当 ON),出**通用动作**不硬推特定动作;标 source_pending。

---

## 3. 参数定义(Parameters)

| 字段 | 类型 | 说明 |
|---|---|---|
| `sku` / `store` | string | SKU × 门店 |
| `effective_stage` | enum | 读自地基①,只读不重判 |
| `switch_status` | object | 六开关状态:`{上架, 有货, 陈列, 动销, 复购, 毛利}` 各 `ON/OFF/unknown`(只读) |
| `off_switches[]` | string[] | 当前 OFF 的开关(缺口) |
| `recommended_actions[]` | object[] | 推荐动作:`{action, fills_switch: 补哪个开关, how_to, why: 溯源到缺口+阶段, priority}` |
| `priority_basis` | string | 排序依据(先补最关键的 OFF,§9c) |
| `confidence` | enum | high/mid/low(状态数据齐全度) |
| `status` | enum | `recommended` / `generic_actions`(数据不足)/ `no_new_actions`(淘汰期) |
| `flags` | string[] | `assistant_not_tracker`(不考核标记)/ `recommendation_optional` / `generic_fallback` / `source_pending` 等 |
| `summary_text` | string | 这家店该先做啥、怎么做、为什么(可溯源到缺口与阶段) |
| `fanout` | string[] | 一线参考(看板/推送);**无任何派任务/考核/谁没做上报项** |

> **注意:输出里没有 `assignee`/`done`/`completion`/`who_missed` 等字段——本节点不认人、不追踪。**

---

## 4. 处理流程(Steps · 链式)

### Step A — 读状态 × 找 OFF 开关(只读)
读 SKU×店六开关状态(L0-01/L0-02/L1-03,**只读不重算**)→ `off_switches`(哪些 OFF)。缺数据的开关判 unknown(不强行当 OFF)。

### Step B — 读阶段(只读)
读 effective_stage(**只读不重判**)→ 决定动作风格(§9b):导入点亮类/成长复制类/成熟守成类/衰退止损类/**淘汰不推新动作**。

### Step C — 匹配动作库 × 取针对性动作(可溯源)
按 (OFF 开关 × 阶段)从动作库(§9a)取标准动作 + how-to:
- **缺陈列 → 陈列方案/话术**;**缺动销 → 试吃/促销/话术**;**缺上架 → 铺货话术/渠道**;**缺复购 → 复购机制/会员**(成熟期);**缺有货 → 补货提醒**(转 L0-08 不自己补)。
- 每个动作记 `fills_switch`(补哪个开关)+ `why`(溯源到缺口+阶段)——**说清为什么推这个**。
- 数据不足/无匹配 → 出**通用动作**(标 `generic_fallback`),不硬推特定动作。

### Step D — 优先级排序(先补最关键的 OFF,§9c)
按 §9c 关键度排序:**上架/有货(没货没陈列谈不上动销)> 陈列 > 动销 > 复购 > 毛利**;阶段微调(导入期陈列/首购优先,成熟期复购优先)。`priority_basis` 记排序依据。

### Step E — 出件(纯助手,不考核)
脚本产 off_switches/recommended_actions/priority → LLM 写 how-to + summary_text(该先做啥、怎么做、为什么,可溯源)→ 跑 §10 → 扇出(一线参考)。
- **绝不记录/上报谁没做、绝不考核、绝不派任务**;`flags+=assistant_not_tracker, recommendation_optional`。

---

## 5. 规则与强度(RFC2119)

| 强度 | 规则 |
|---|---|
| **MUST NOT** | **绝不记录/上报"谁没做了哪个动作"、绝不考核、绝不追踪完成情况**——纯助手;输出无 assignee/done/completion/who_missed 字段(变监工→一线造假→反噬战功节点数据真实性)。 |
| **MUST** | **推荐基于状态缺口 + 阶段,可溯源**——每个动作记 `fills_switch`(补哪个 OFF 开关)+ `why`(缺口+阶段),说清为什么推。 |
| **MUST** | **推荐非强制**——一线可选可不选;`recommendation_optional`;工具箱给弹药不替人扣扳机。 |
| **MUST NOT** | **只读状态不重算**(L0-01/L0-02/L1-03);**只读阶段不重判**(地基①)。 |
| **MUST NOT** | **不派任务**——只出建议怎么做,派任务/追踪归别的节点/人。 |
| **MUST** | 数据不足 → 出通用动作不硬推特定动作(generic_fallback);缺数据的开关判 unknown 不强行当 OFF。 |
| **MUST** | **淘汰期不推新动作**(no_new_actions,只清退);动作风格随阶段(导入点亮/成长复制/成熟守成/衰退止损)。 |
| **SHOULD** | 动作应附 how-to(怎么做的模板);优先级应先补最关键的 OFF(上架/有货优先)。 |
| **MAY** | 可附动作示例话术;多店批量出工具箱视图。 |

---

## 6. 输出(Output · Artifact 契约)

```json
{
  "sku": "6MX-QY-500", "store": "成都武侯-永辉",
  "effective_stage": "导入",
  "switch_status": { "上架": "ON", "有货": "ON", "陈列": "OFF", "动销": "OFF", "复购": "unknown", "毛利": "ON" },
  "off_switches": ["陈列", "动销"],
  "recommended_actions": [
    { "action": "黄金视线层陈列方案", "fills_switch": "陈列", "priority": 1,
      "how_to": "1.争取与视线平齐的第2-3层 2.正贴3面朝外 3.爆炸卡贴价签位 4.端头堆码(若可申请)",
      "why": "陈列开关OFF(L0-02陈列合规0.4) + 导入期点亮重陈列 → 先把陈列立起来" },
    { "action": "周末试吃 + 首购话术", "fills_switch": "动销", "priority": 2,
      "how_to": "1.高客流时段试吃 2.话术'低盐特级,凉拌炒菜都鲜' 3.首购买赠引导 4.加微回访",
      "why": "动销开关OFF(L1-03动销0.2) + 导入期靠试吃拉首购 → 陈列立起后试吃拉动销" }
  ],
  "priority_basis": "先补陈列(没陈列消费者看不见)再补动销;导入期点亮重陈列+试吃",
  "confidence": "mid",
  "status": "recommended",
  "flags": ["assistant_not_tracker", "recommendation_optional"],
  "summary_text": "加点鲜500ml@成都武侯永辉(导入期):上架有货都OK,但陈列和动销两个开关OFF。建议先做陈列(争黄金视线层,因为消费者看不见就谈不上动销),再做周末试吃+首购话术拉动销。这是给你的弹药,按店里实际情况采纳——做不做、怎么调整你定。"
}
```

> 缺陈列推陈列示例:`off_switches:["陈列"] → recommended_actions[0].fills_switch:"陈列"`,溯源到 L0-02。
> 缺动销推试吃示例:`off_switches:["动销"] → 试吃/话术`,溯源到 L1-03。
> 推荐非强制示例:summary 明说"做不做你定",`flags:["recommendation_optional"]`,无 tasks/assignee。
> 不记谁没做示例:输出**无** who_missed/done/completion 字段 → §10 通过;若有 → 报错。
> 数据不足示例:状态多为 unknown → `status:"generic_actions"`,出通用动作(如"巡店核查状态")。
> 淘汰期示例:`effective_stage:"淘汰" → status:"no_new_actions"`,只出清退动作,不推新增长动作。

---

## 7. 节奏 + 扇出(写死)

| 项 | 规则 |
|---|---|
| 节奏 | 按需(一线巡店/拜访前查工具箱)或随状态更新 |
| 扇出 | 一线 BD/销售/美顾参考(看板/推送)|
| 禁区 | **绝不**:记录/上报谁没做、考核、追踪完成、派任务、采集/重算状态、重判阶段、淘汰期推新动作、把推荐写成强制 |

---

## 8. HITL 卡点 —— 本节点【无】

纯助手、不派任务、不考核、不出账、不可逆性为零,**故无 HITL**。一线自行决定采纳哪些动作——工具箱给弹药,扣不扣扳机是一线的事。比 L5-02 更轻:L5-02 还有"人选了才派任务"的 HITL 链路,本节点连任务都不派,出完动作清单就结束。

---

## 9. References

### 9a. 动作库(按 阶段 × OFF 开关,写死;话术/方案模板占位)

| OFF 开关 | 导入期动作 | 成长期动作 | 成熟期动作 | 衰退期动作 |
|---|---|---|---|---|
| 上架 | 铺货话术/渠道开发 | 区域复制铺货 | 补铺空白 | —(不扩) |
| 有货 | 补货提醒(转 L0-08) | 补货提醒 | 防断货 | 清库存 |
| 陈列 | 陈列方案/争位话术 | 陈列复制 | 维护陈列 | 收缩陈列 |
| 动销 | 试吃/首购促销/话术 | 动销增长打法 | 复购拉动 | 清库存促销 |
| 复购 | —(导入期未到) | 复购机制起步 | 会员/复购运营 | — |
| 毛利 | —(导入期不苛求) | 控费 | 费用率优化 | 止损 |

> 每格挂 how-to 模板(占位);**淘汰期整列只清退,不推新动作**。

### 9b. 阶段动作风格表(写死)

| effective_stage | 动作风格 |
|---|---|
| 导入 | 点亮类(铺货/陈列/首购/试吃) |
| 成长 | 复制类(区域打法/补货提醒) |
| 成熟 | 守成类(复购机制/防断货) |
| 衰退 | 止损类(清库存) |
| 淘汰 | **不推新动作**(no_new_actions),只清退 |
| unknown | 通用动作(巡店核查) |

### 9c. 优先级规则(写死)

| 优先级 | 开关 | 理由 |
|---|---|---|
| 1 | 上架/有货 | 没货没上架,后面都谈不上 |
| 2 | 陈列 | 没陈列消费者看不见,谈不上动销 |
| 3 | 动销 | 陈列立起后拉动销 |
| 4 | 复购 | 动销稳后做复购 |
| 5 | 毛利 | 量起来后优化毛利 |

> 阶段微调:导入期陈列/首购优先;成熟期复购优先。

### 9d. 术语 / 踩坑

| 术语 | 含义 |
|---|---|
| 助手非鞭子 | 推该做什么,不记谁没做(铁律①) |
| 状态开关 | 上架/有货/陈列/动销/复购/毛利,ON/OFF/unknown |
| fills_switch | 这个动作补哪个 OFF 开关(溯源) |
| 推荐非强制 | 一线可不采纳 |

- ❌(铁律①,值得记)**工具箱顺手记录"谁没做哪个动作"上报**:变成监工 → 一线抵触、应付,甚至**造假数据让自己看起来做了** → 战功节点(地基③)命门③"数据造假"被触发,工具箱反噬了激励公平 → ✅ 纯助手,输出无 who_missed/done 字段,只推该做什么。
- ❌(铁律②,值得记)**笼统推一堆动作不说为什么**:一线不知道为什么推给我,当成唠叨忽略 → ✅ 每个动作溯源到 OFF 开关+阶段(缺陈列→推陈列,因为陈列OFF)。
- ❌(铁律③,值得记)**把推荐写成强制"必须做"**:一线被绑死,店情不同硬套标准动作适得其反 → ✅ 推荐非强制,给弹药一线自己看着用。
- ❌ 优先级乱排,缺货还没补就推试吃:货都没有试吃个啥 → ✅ 先补上架/有货,再陈列动销。
- ❌ 数据不足硬推特定动作:状态没读全就推"做试吃",可能根本不缺动销 → ✅ 数据不足出通用动作(巡店核查)。
- ❌ 淘汰期还推增长动作:给要退的品做试吃促销 → ✅ 淘汰期不推新动作只清退。
- ❌ 本节点重算了动销状态:和 L1-03 不一致 → ✅ 只读不重算。
- _(后续迭代继续往下加)_

---

## 10. Scripts — 缺口识别 / 阶段匹配 / 动作取用 / 优先级 / 助手非考核校验(出件前必跑)

```python
SWITCHES = ["上架", "有货", "陈列", "动销", "复购", "毛利"]
PRIORITY = {"上架": 1, "有货": 1, "陈列": 2, "动销": 3, "复购": 4, "毛利": 5}  # §9c
NO_NEW_ACTION_STAGES = {"淘汰"}
# 禁止出现的"考核/追踪"字段(助手非鞭子)
FORBIDDEN_FIELDS = {"assignee", "done", "completion", "completion_rate",
                    "who_missed", "not_done_by", "考核", "完成率", "谁没做"}

def find_off(switch_status):
    """只读状态找 OFF 开关;unknown 不当 OFF。"""
    return [s for s in SWITCHES if switch_status.get(s) == "OFF"]

def pick_actions(off_switches, stage, action_lib):
    """按 (OFF×阶段) 取动作;每个带 fills_switch + why(溯源)。"""
    if stage in NO_NEW_ACTION_STAGES:
        return []                                  # 淘汰期不推新动作
    acts = []
    for sw in sorted(off_switches, key=lambda x: PRIORITY.get(x, 9)):
        a = action_lib.get((sw, stage)) or action_lib.get((sw, "通用"))
        if a:
            acts.append({"action": a["name"], "fills_switch": sw,
                         "how_to": a["how_to"],
                         "why": f"{sw}开关OFF + {stage}期 → 补{sw}",
                         "priority": PRIORITY.get(sw, 9)})
    return acts

def validate(out):
    errs = []
    # ===== 铁律①:助手非鞭子——绝无考核/谁没做字段 =====
    blob = str(out)
    for ff in FORBIDDEN_FIELDS:
        if ff in blob:
            errs.append(f"tracking_who_failed:{ff}")    # 出现考核/追踪字段
    for f in out.get("fanout", []):
        if any(x in f for x in ("考核", "谁没做", "上报完成", "追踪完成", "派任务")):
            errs.append(f"assistant_became_tracker:{f}")
    if "assistant_not_tracker" not in str(out.get("flags", [])):
        errs.append("missing_assistant_flag")           # 必须标明纯助手
    # ===== 铁律②:推荐可溯源 =====
    for a in out.get("recommended_actions", []):
        if not a.get("fills_switch"):
            errs.append(f"action_without_switch:{a.get('action')}")   # 没说补哪个开关
        if not a.get("why"):
            errs.append(f"action_without_why:{a.get('action')}")      # 没说为什么推
        # 推的动作必须对应一个真 OFF 开关
        if a.get("fills_switch") and a["fills_switch"] not in out.get("off_switches", []):
            errs.append(f"action_for_non_off_switch:{a.get('fills_switch')}")  # 补了个没OFF的开关
    # ===== 铁律③:推荐非强制 =====
    if out.get("recommended_actions") and "recommendation_optional" not in str(out.get("flags", [])):
        errs.append("recommendation_not_marked_optional")
    if out.get("_forced_mandatory"):
        errs.append("recommendation_forced")            # 写成了强制
    # ===== 淘汰期不推新动作 =====
    if out.get("effective_stage") in NO_NEW_ACTION_STAGES:
        if out.get("recommended_actions"):
            errs.append("new_action_in_clearance_stage")
        if out.get("status") != "no_new_actions":
            errs.append("clearance_status_wrong")
    # ===== 数据不足出通用动作 =====
    sw = out.get("switch_status", {})
    unknown_cnt = sum(1 for v in sw.values() if v == "unknown")
    if unknown_cnt >= 3 and out.get("status") not in ("generic_actions", "no_new_actions"):
        errs.append("insufficient_data_not_generic")    # 数据不足却硬推特定动作
    # ===== 优先级:先补最关键 OFF =====
    acts = out.get("recommended_actions", [])
    pris = [a.get("priority", 9) for a in acts]
    if pris != sorted(pris):
        errs.append("priority_not_sorted")              # 没按关键度排
    # ===== 只读不重算 =====
    if out.get("_recomputed_state"):
        errs.append("state_recomputed")
    return errs
```

---

## 11. 评测起手式(8 条种子)

```json
[
 {"id":"t01",
  "input":{"switch_status":{"陈列":"OFF"},"stage":"成长"},
  "expect":{"recommended_actions":[{"fills_switch":"陈列","action":"陈列方案类"}],
            "why_traceable":"陈列OFF→推陈列","error_if_no_switch":"action_without_switch"},
  "tags":["缺陈列→推陈列方案,溯源到开关"]},

 {"id":"t02",
  "input":{"switch_status":{"动销":"OFF"},"stage":"导入"},
  "expect":{"recommended_actions":[{"fills_switch":"动销","action":"试吃/话术类"}],
            "stage_appropriate":"导入期试吃拉首购"},
  "tags":["缺动销→推试吃/话术,导入期点亮风格"]},

 {"id":"t03",
  "input":{"stage":"导入","off":["陈列","动销"]},
  "expect":{"action_style":"点亮类(陈列方案/试吃/首购)","priority":"陈列先于动销"},
  "tags":["导入期推点亮动作"]},

 {"id":"t04",
  "input":{"off":["陈列"],"ask":"为什么推这个"},
  "expect":{"why":"陈列开关OFF(L0-02) + 导入期重陈列","traceable_to_gap_and_stage":true,
            "error_if_no_why":"action_without_why"},
  "tags":["推荐可溯源到缺口+阶段"]},

 {"id":"t05",
  "input":{"recommended_actions":"若干","event":"一线选择不采纳"},
  "expect":{"flags_contains":"recommendation_optional","no_tasks":true,"no_assignee":true,
            "non_mandatory":true},
  "tags":["推荐非强制:一线可不采纳,不派任务"]},

 {"id":"t06",
  "input":{"event":"工具箱想记录'张三没做陈列动作'并上报"},
  "expect":{"blocked":"tracking_who_failed / assistant_became_tracker",
            "no_who_missed_field":true,"note":"纯助手,记谁没做会反噬战功数据真实性"},
  "tags":["铁律①:不记谁没做不考核(变监工→造假→反噬地基③)"]},

 {"id":"t07",
  "input":{"switch_status":{"上架":"unknown","陈列":"unknown","动销":"unknown"}},
  "expect":{"status":"generic_actions","generic":"巡店核查状态","not_forced_specific":true,
            "error_if_specific":"insufficient_data_not_generic"},
  "tags":["数据不足→出通用动作,不硬推特定动作"]},

 {"id":"t08",
  "input":{"effective_stage":"淘汰","off":["动销"]},
  "expect":{"status":"no_new_actions","no_growth_action":true,
            "error_if_new":"new_action_in_clearance_stage"},
  "tags":["淘汰期不推新动作,只清退"]}
]
```

**打分维度(每条 0/1):**
1. 缺陈列推陈列(t01)
2. 缺动销推试吃(t02)
3. 导入期点亮动作(t03)
4. **推荐可溯源**(t04)
5. **推荐非强制不派任务**(t05)
6. **铁律①不记谁没做不考核**(t06:§10 tracking_who_failed 守)
7. 数据不足出通用动作(t07)
8. 淘汰期不推新动作(t08)

> 最危险的错是 t06:**工具箱变监工**。它看似无害(记录一下谁做了什么不是挺好?),实则有一条反噬链——一线感到被考核 → 抵触、应付、**造假数据让自己看起来做了** → 而战功节点(地基③)命门③正是"数据造假→真实性归零战功清零"。工具箱若开始记"谁没做",污染的是整个激励体系赖以公平的数据源。所以本节点的输出**物理上不含任何"谁/做没做"字段**——它只回答"该做什么、怎么做、为什么",绝不回答"谁做了没"。助手和鞭子的区别,就是它帮你还是盯你。

---

## 待填变量(套用时替换)
- `owner` / backlog 编号
- §9a 动作库(各阶段×各开关的标准动作 + how-to 模板)— 与一线/营销共建,持续补充
- §9b 阶段动作风格 / §9c 优先级规则微调
- 状态开关数据源(L0-01/L0-02/L1-03 + 复购/毛利)— 接入后更新 §2
- effective_stage 地基① — 只读契约对齐
- 动作库存储 — 主数据/知识库(可迭代扩充话术方案)
