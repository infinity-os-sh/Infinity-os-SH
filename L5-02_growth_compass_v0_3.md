---
name: growth-compass
description: 接收 L5-01 统治力差距预警(P0/P1),按写死打法库匹配 2~3 个应对方案选项(含脚本估算的预算与预期),经 HITL 人选人批后派发执行任务(陈列费申请/促销反击/排面争取/试吃拦截/铺货任务),派发前过一线执行力节流(超并发上限排队不直发),跟踪执行并以 L5-01 下一窗口数据闭环复盘。凡涉及"应对方案、打法、反击、陈列费、营销动作、增长任务、差距应对"的输入都用本 Skill。它是应对动作的发起方(L5-02)、L5-01 的下游、含预算动作的 HITL 所在;机器只出选项不做选择,含预算案内零预算选项同样等人选。下游:审批人 / 美顾·督导任务 / 费用流程(经 MCP)/ L5-01(效果回流)。
version: v0.3
owner: <填:负责人/团队>
type: Workflow / Skill(增长执行节点 · 有状态方案台账 · 带 HITL · L5-02)
status: 粗糙版 v0.2,待真实数据迭代
upstream: L5-01 预警(P0/P1)+ 其 by_dimension 数据 / 打法库主数据 / SKU 生命周期 effective_stage(按 sku×scope×period,只读)/ 费用预算池(经 MCP)/ L0-04(涉及门店与责任人)/ 一线任务台账(未完成任务·单店窗口动作数)
downstream: 审批人(HITL)/ 任务派发(美顾/督导,经 App)/ 费用流程(经 MCP)/ L5-01(下窗口效果对照)
backlog: L5-02
---

# 增长罗盘 Skill v0.3 · 增长执行节点(L5-02)

> 依据《Agent 设计标准 v1.0》。Workflow + 方案台账(有状态)。
> **机器与人的分工一句话:机器出选项、算预算、派任务、追执行;选哪个打法、批不批钱,永远是人。**

> **v0.2 变更摘要(两处都是保护"人的选择权"与"一线执行力"):** ①**零预算选项派发语义钉死**——整案全零预算才 auto 派发;案内含任一含预算选项,**全部选项(含零预算项)一律等人选,机器不得先派**(先派 = 预占选择权);确需不等批的零预算动作走「附加动作 supplementary_actions」,不占选项位、与选择互不排斥;②**一线执行力节流**——派发前查任务台账,单人/单店超并发上限的任务**排队(queued)不直发**,按序释放不丢弃,且节流状况**在审批界面对人可见**(人批之前就该知道执行力现状)。

---

## 1. 角色与边界

| 事 | 归谁 | 本节点角色 |
|---|---|---|
| 判差距/定预警等级 | L5-01 | 不重判,只消费其 alerts + 数据 |
| 补货下单 | L0-08 | 不碰(库存类预警那条线不经过本节点) |
| 价格/窜货处置 | L0-06 + 商务 | 不碰(乱价应对走稽查线) |
| **差距应对方案与营销任务** | **L5-02(本节点)** | 唯一发起方 |

机器可以:匹配打法、估算预算与预期、生成 2~3 个选项、人批后派任务(过节流)、跟踪、复盘对照。
机器不可以:**替人选方案、自动花钱、超预算池拟案、对同一差距重复开案、把"预期提升"写成承诺、在含预算案内提前派发任何选项(含零预算项)、超并发上限直发任务**。

---

## 2. 输入 / 3. 参数(核心字段)

输入:L5-01 alerts(P0/P1,含 dimension/detail/范围)及 by_dimension 数据、打法库(§9a)、费用预算池余额(经 MCP)、L0-04 涉及门店与责任人、**一线任务台账(每人未完成任务数 / 每店当前窗口营销动作数,v0.2)**、方案台账、`now`。

| 字段 | 说明 |
|---|---|
| `plan_id` | 方案编号;**台账键 = (dimension, sku/category, region, 窗口)**——同一差距一案,不重复开 |
| `trigger_alert` | L5-01 预警引用 |
| `options[]` | **2~3 个选项**,每个含:playbook_id / 动作明细 / `budget`(脚本估算)/ `expected`(预期区间,标"估算非承诺")/ 涉及门店数 / **`recommended_by_stage`(v0.3,布尔:是否本阶段相关)** |
| **`effective_stage`(v0.3)** | enum | 读自《SKU 生命周期阶段判定》,只读不重判 |
| **`folded_options[]`(v0.3)** | object[] | **被折叠的其他阶段打法**(可展开,不硬删)——保留人选被折叠选项的权利 |
| **`supplementary_actions[]`(v0.2)** | **附加动作**(零预算、确需不等批的,如"按 SOP 补拍照片提醒"):不占选项位、**与人选哪个选项互不排斥**、单独列出;混进 options[] 即违规 |
| `chosen` / `approved_by` | 人选的选项与审批人(**机器恒为 null,人填**) |
| `status` | `options_out`(选项已出待人选)→ `approved` → `dispatched` → `tracking` → `reviewed` / `rejected` / `expired` |
| `tasks[]` | 派发任务(门店×责任人×动作×时限),来自所选选项;**任务态:`dispatched` / `queued`(节流排队,v0.2)/ done / expired** |
| **`throttle`(v0.2)** | `{throttled_persons, throttled_stores, detail}`——节流状况,**审批界面必须可见** |
| `review` | 复盘:L5-01 下窗口同维度数据 vs 预期(脚本对照,不粉饰) |

---

## 4. 处理流程

**Step A 接案与防重复** — 接 L5-01 P0/P1;查台账:同键已有未结案(options_out~tracking)→ 不重复开案,新预警引用追加(差距持续 ≠ 再开一案;若**恶化**——L5-01 worsened/升级——通知审批人考虑加码,仍在原案内)。

**Step B 匹配打法(查 §9a 写死库)** — 按 alert.dimension × 细分情形查打法库,取 2~3 条候选。库里没有匹配项 → 停,`playbook_missing` 转人工出案(顺手把人工方案回补进打法库——这正是打法库长大的方式)。

**Step B2 按生命周期阶段筛选项池(v0.3,只筛不替选)** — 读 effective_stage(**只读不重判**),按 §9a-2 阶段-打法相关表:
- 把"本阶段相关"的打法标 `recommended_by_stage:true` **排在前**;其他阶段打法**折叠进 `folded_options[]`,可展开**(导入=点亮类/成长=复制类/成熟=赚钱类/衰退=止损类且收窄/焕新=重启类)。
- **淘汰期**:只出清退类或不出方案(`stage_no_playbook`)。
- **unknown**:**出全部基础打法不按阶段筛**(`stage_unknown_all_playbooks`)——不知阶段就把选择权完整交给人,**机器不缩范围**。
- **铁律(与 v0.2"不排序倾向"的区分)**:阶段排序是**可见可逆的客观依据**(标注"按 X 期推荐,其他已折叠可展开"),不是机器的隐藏偏好——v0.2 禁的是"机器按自己偏好加星锚定人",这里是"按生命周期客观相关性排序且全程透明可展开"。**阶段绝不自动选中、绝不硬删、绝不派发任何打法**;人没选前 tasks 恒空。

**Step C 拟选项(脚本)** — 每条候选:按涉及门店数 × 单店费用标准估 `budget`;查预算池,**超余额的选项直接不出**(不让人批一个批不动的案);`expected` 给区间并强制标注"估算非承诺"(历史同类打法效果回测后逐步收窄)。**附加动作(v0.2)**:确需不等批的零预算动作放 `supplementary_actions[]`(不占选项位,可即时派发),**严禁混入 options[]**。

**Step D HITL:人选人批(v0.2 语义钉死)** — `options_out` 推给审批人(按范围:区域级→区域经理;跨区→更高)。**机器不预选、不排序倾向、不默批、不超时通过**。派发语义二分:
- **整案全部选项均为零预算** → 才走 auto 派发(留 approved_by="auto" 审计痕迹)——不花钱且无选择冲突,ATM 不卡人;
- **案内含任一含预算选项** → **全部选项(含零预算项)一律等人选,机器不得先派任何选项动作**。零预算的 PB-02 若是三选项之一,人还没选机器先派了,人再选 PB-04 时一线已在执行 PB-02——**选择权被预占,HITL 名存实亡**。
- `supplementary_actions[]` 不受此限(它定义上与选择互不排斥),可即时派发并留痕。
- 驳回 = 终态,重案须新触发。

**Step E 派发与跟踪(v0.2 加执行力节流)** — 人批后(或全零预算 auto 后):
1. **节流闸门(派发前必过)** — 查一线任务台账:
   - 某责任人未完成任务数 ≥ `<单人并发上限>` → 该人名下任务置 **`queued`** 不立即下发;
   - 某门店当前窗口营销动作数 ≥ `<单店并发上限>` → 该店任务同理 `queued`;
   - 案内 flag `throttled:{受影响人数/店数}`;**排队只排不丢**,既有任务完成或超期后**按序释放**;
   - **审批界面必须可见**(v0.2 时序说明:节流预估在 options_out 时即随案展示——"该方案 12 店中 3 店执行力已满,将排队"——人批之前就该知道执行力现状,批后实际派发再按届时台账核定)。
2. 费用类走费用流程(经 MCP),任务类按 L0-04 责任人派发(店×人×动作×时限);跟踪完成率;超时提醒不代办。

**Step F 复盘闭环(脚本)** — L5-01 下一窗口出数后,同维度 cohort 口径对照 `expected`:达成/未达成/数据不足如实记 `review`,**不粉饰、不归因**(单变量归因是分析陷阱——只摆"做了什么+指标变了多少",解读归人)。复盘结果回补打法库的效果区间。

---

## 5. RFC2119(核心)

| 强度 | 规则 |
|---|---|
| **MUST NOT** | **阶段只筛选项池呈现/排序,绝不自动选中或派发任何打法**——人没选前 tasks 恒空(v0.3)。 |
| **MUST** | **被折叠的其他阶段打法必须可展开,阶段不硬删**——阶段是建议排序不是过滤删除,不剥夺人选被折叠选项的权利(v0.3)。 |
| **MUST** | **unknown 出全部基础打法不按阶段缩范围**——HITL 节点的灵魂是人选,机器缩小范围=替人决定(与前四节点不同)(v0.3)。 |
| **MUST** | **选项算账(预期/成本/执行力占用)与阶段无关**——阶段只动呈现/排序,不改选项本身的数(v0.3)。 |
| **MUST NOT** | 阶段**只读 effective_stage,绝不重判阶段**(v0.3)。 |
| **MUST NOT** | 机器绝不替人选方案、绝不自动批含预算选项、绝不超预算池拟案、绝不把预期写成承诺、绝不在复盘里做单变量归因粉饰;**绝不在含预算案内提前派发任何选项动作(含零预算选项)——选择权不许被预占(v0.2)**;**绝不超并发上限直发任务、绝不把排队任务丢弃(v0.2)**。 |
| **MUST** | 同键差距未结案不重复开案;恶化在原案内通知加码。 |
| **MUST** | 选项必须 2~3 个(单选项 = 变相替人决定;>3 = 决策疲劳),预算由脚本估算可重放,超池选项不得出现。 |
| **MUST** | 仅当整案全部选项均为零预算才可 auto 派发(留痕);确需不等批的零预算动作必须走 `supplementary_actions[]`(不占选项位、与选择互不排斥),严禁混入 options[]。**(v0.2)** |
| **MUST** | 派发前必须查一线任务台账:单人未完成 ≥ `<单人并发上限>` 或单店窗口动作 ≥ `<单店并发上限>` → 任务 `queued` 排队、案 flag `throttled:*`、按序释放;节流状况必须在审批界面对人可见。**(v0.2)** |
| **MUST** | 打法库无匹配必须停转人工,人工方案回补入库;严禁 LLM 临场编打法。 |
| **MUST** | 复盘用 L5-01 下窗口 cohort 口径数据,结果如实三态(达成/未达/数据不足)。 |
| **SHOULD** | 复盘应回写打法库效果区间;queued 释放应通知责任人与案件关注人。 |

---

## 6. 输出(方案契约,核心示例)

```json
{ "plan_id": "GC-2026-W24-03",
  "trigger_alert": "L5-01:weekly:competitor_pressure:P1(海天端架12店+买二送一8城)",
  "effective_stage": "成长",
  "options": [
    { "playbook_id": "PB-11", "name": "区域复制(成长期相关)", "actions": "复制已点亮区域打法到邻近3区",
      "budget": 18000, "expected": "覆盖 +8~12店(估算非承诺)", "stores": 24, "recommended_by_stage": true },
    { "playbook_id": "PB-02", "name": "排面争取(零预算)", "actions": "全员排面谈判任务,目标+1排面/店",
      "budget": 0, "expected": "排面达标率 +5~8pp(估算非承诺)", "stores": 30, "recommended_by_stage": true },
    { "playbook_id": "PB-04", "name": "端架反击", "actions": "12店申请端架陈列费,优先黄金视线层",
      "budget": 36000, "expected": "SOV +3~6pp(估算非承诺)", "stores": 12, "recommended_by_stage": false }
  ],
  "folded_options": [
    { "playbook_id": "PB-21", "name": "复购唤醒(成熟期打法,已折叠可展开)", "budget": 9000, "note": "非成长期相关,人可展开选用" }
  ],
  "supplementary_actions": [],
  "chosen": null, "approved_by": null,
  "status": "options_out",
  "tasks": [],
  "throttle": { "throttled_persons": 0, "throttled_stores": 3,
                "detail": "PB-04 涉及 12 店中 3 店本窗口营销动作已满,获批后将排队" },
  "review": null,
  "fanout": ["审批:区域经理:GC-2026-W24-03(成长期推荐3选项+1可展开,节流预估随案可见)", "台账:登记"] }
```

> **注意(v0.2 不变)**:含预算选项 → `status:options_out` 时 `tasks` **必须为空**——零预算的 PB-02 也在等人选,机器不得先派。
> **注意(v0.3)**:阶段把成长相关打法(PB-11/PB-02)排前标 `recommended_by_stage:true`,成熟期打法 PB-21 折叠进 `folded_options` **但可展开**——**人仍可选被折叠的任何打法**,阶段只排序不删。
> 淘汰期示例:`effective_stage:"淘汰"` → 只出清退类或 `flags:["stage_no_playbook"]` 不出方案。
> unknown 示例:`effective_stage:"unknown"` → 出**全部**基础打法、无折叠,`flags:["stage_unknown_all_playbooks"]`——选择权完整交给人。
> 全零预算案示例:options 均 budget=0 → `approved_by:"auto"` 留痕,直接派发(同样过节流)。

---

## 7. 分流 + 扇出(写死,v0.2 改写)

| 条件 | 处理 |
|---|---|
| 案内含任一 budget > 0 选项 | **HITL:全部选项(含零预算项)等人选人批**,超时提醒不默批;**options_out 期间 tasks 恒空(v0.2)** |
| **阶段筛选项池(v0.3)** | 本阶段相关排前标 recommended_by_stage,其他折叠进 folded_options 可展开;**绝不自动选中/派发**;淘汰不出(stage_no_playbook);unknown 出全部 |
| 整案全部选项 budget == 0 | auto 派发(留 approved_by="auto" 审计痕迹;同样过节流)**(v0.2)** |
| supplementary_actions[] | 即时派发留痕(不占选项位、与选择互不排斥)**(v0.2)** |
| 派发时单人/单店超并发上限 | 任务 `queued` 排队按序释放,案 flag `throttled:*`,审批界面可见 **(v0.2)** |
| 打法库无匹配 | 转人工出案 + 回补库 |
| 同键未结案 | 不重复开案,追加引用;恶化→通知加码 |
| L5-01 下窗口出数 | 复盘脚本对照,回写打法库 |

**绝不**:替 L0-08 下单、替 L0-06 处置、向 L5-01 上游反向指挥采集。

---

## 8. HITL —— 本节点【有】(花钱前 + 选择权)

不可逆动作 = **花营销费用 + 占用一线执行力**。卡点:含预算选项的"选 + 批"双步都归人;机器连"推荐倾向"都不给(排序按 playbook_id,不按机器偏好)——给了倾向,人就会被锚定,HITL 退化成橡皮图章。**v0.2 把这两个不可逆各补了一道闸:选择权不许被零预算选项的提前派发预占(混合案全等人选);执行力不许被无上限并发挤占(节流排队,且人批前就看得见节流现状)。**

> **v0.3 与"不排序倾向"如何并存:** v0.2 禁的是"机器按**自己的偏好**给某选项加星,锚定人"。v0.3 的阶段排序是**按生命周期客观相关性**排,且**全程透明可逆**(标"按 X 期推荐,其他已折叠可展开",人随时能选被折叠的)。区别在于:阶段排序是**摆出客观依据供人参考**,不是**藏起偏好替人收窄**——后者才让 HITL 退化成橡皮图章。**阶段绝不自动选中、绝不硬删、绝不派发;unknown 干脆出全部,把选择权完整还给人。**

---

## 9. References

### 9a. 打法库(写死,人工维护与回补;示例)

| playbook_id | 触发差距(L5-01 dimension × 情形) | 动作 | 单店费用标准 | 历史效果区间 |
|---|---|---|---|---|
| PB-02 | facing_compliance 达标率低 | 排面谈判任务(零预算) | ¥0 | 回测后填 |
| PB-04 | competitor_pressure:端架/堆头 | 端架陈列费反击 | ¥3,000/店 | 回测后填 |
| PB-07 | competitor_pressure:促销/新品 | 试吃拦截 + 买赠 | ¥1,200~1,500/店 | 回测后填 |
| PB-11 | sov_gap 距目标大 | 排面+端架组合 | 组合计 | 回测后填 |

### 9a-2. 阶段-打法相关表(v0.2 新增;只决定排序/折叠,不删不选)

| effective_stage | 本阶段相关打法类(排前) | 其他阶段打法 |
|---|---|---|
| 导入 | 点亮类(铺货/陈列/首购/试吃/首次补货) | 折叠可展开 |
| 成长 | 复制放大类(区域复制/覆盖提升/动销增长) | 折叠可展开 |
| 成熟 | 赚钱类(复购/毛利/控断货/费用率) | 折叠可展开 |
| 衰退 | 止损类(清库存/替代SKU切换),**收窄不推扩张** | 扩张类折叠(仍可展开) |
| 焕新 | 重启类(新包装上架/新场景/老客激活) | 折叠可展开 |
| 淘汰 | 清退类或**不出方案(stage_no_playbook)** | — |
| unknown | **出全部基础打法,不折叠(stage_unknown_all_playbooks)** | 无折叠 |

> 相关性是**排序与折叠依据**,**绝不硬删、绝不自动选中**;人可展开任意被折叠打法。具体 dimension×stage 映射回测校准。

### 9c. 踩坑(预置)
- ❌ 机器把"推荐 PB-04"放选项第一并加星 → 人全选第一个,HITL 成橡皮章 → ✅ 不排倾向,按编号序。
- ❌ 单选项推给人"批或不批" → 变相替人决定 → ✅ 恒 2~3 选项。
- ❌(v0.2)三选项里的零预算 PB-02 在人选之前就被自动派发 → 人选了 PB-04,一线已在干 PB-02,选择权被预占 → ✅ 含预算案全部选项等人选;确需不等批的走 supplementary_actions 不占选项位。
- ❌(v0.2)三个案同周砸向同一批美顾,人均挂 7 个任务,SOP 巡店被挤掉 → 上报质量崩,L0 层数据跟着崩 → ✅ 单人/单店并发上限,超限排队按序释放,审批界面可见。
- ❌ 复盘写"因本方案 SOV+4pp" → 同期还有别的变量,单变量归因 → ✅ 只摆动作与指标变化,解读归人。
- ❌ 预算池剩 2 万,出了 3.6 万的选项,人批了走不动 → ✅ 超池选项不出。
- ❌ 差距周周在,周周开新案 → 执行端被同一件事的任务淹没 → ✅ 同键一案,恶化加码。
- ❌(v0.3,值得记)**按阶段自动选打法**:机器看出是成长期,直接把"区域复制"选中派下去 → HITL 退化成橡皮图章,人的选择权被阶段悄悄拿走 → ✅ 阶段只排序呈现,人选的权利不能被阶段剥夺,人没选前一个打法都不派。
- ❌(v0.3)阶段把其他阶段打法**硬删**了,人想用却找不到 → 阶段成了过滤删除而非建议 → ✅ 折叠可展开,不硬删。
- ❌(v0.3)阶段判不出(unknown)就少出几个打法 → 替人缩小了选择范围 → ✅ unknown 出全部,HITL 节点不知阶段更要把选择权完整交给人(与 L1-04/L1-07 都不同:那里 unknown 有保守/照常的取舍,这里 unknown=最大化人选)。
- ❌(v0.3)用阶段改了某打法的预期/成本数去凑排序 → 阶段污染了选项算账 → ✅ 算账是事实,阶段只动呈现顺序。

---

## 10. Scripts(校验核心断言)

```python
def validate(out, ledger_before, budget_pool, task_ledger=None):
    errs = []
    n = len(out.get("options", []))
    if out["status"] == "options_out" and not (2 <= n <= 3):
        errs.append(f"options_count_bad:{n}")                       # 恒 2~3 选项
    has_budget_option = any(o["budget"] > 0 for o in out.get("options", []))
    for o in out.get("options", []):
        if o["budget"] > budget_pool.get("remaining", 0):
            errs.append(f"option_over_pool:{o['playbook_id']}")     # 超池不出
        if o["budget"] != est_budget(o):                            # 预算脚本可重放
            errs.append(f"budget_not_scripted:{o['playbook_id']}")
        if "估算非承诺" not in o.get("expected", ""):
            errs.append(f"expected_as_promise:{o['playbook_id']}")
        if o.get("playbook_id") not in PLAYBOOK:
            errs.append(f"improvised_playbook:{o.get('playbook_id')}")  # 禁临场编打法
    # ---- v0.2 零预算派发语义 ----
    if out["status"] == "options_out" and has_budget_option and out.get("tasks"):
        errs.append("mixed_case_pre_dispatch")                       # 含预算案选项动作提前派发=预占选择权
    if not has_budget_option and out["status"] in ("dispatched","tracking") and \
       out.get("approved_by") not in ("auto",) and not out.get("approved_by"):
        errs.append("all_zero_auto_without_trace")                   # 全零预算 auto 必留痕
    for sa in out.get("supplementary_actions", []):
        if sa.get("budget", 0) > 0:
            errs.append("supplementary_with_budget")                 # 附加动作必零预算
    for o in out.get("options", []):
        if o.get("_dispatched_as_supplementary"):
            errs.append(f"option_disguised_as_supplementary:{o['playbook_id']}")  # 选项不得借附加位先派
    if out.get("chosen") and out.get("_chosen_by") == "machine":
        errs.append("machine_chose_option")                          # 选择归人
    if has_budget_option and out["status"] in ("dispatched","tracking") and not out.get("approved_by"):
        errs.append("budget_dispatched_without_human")               # 花钱必人批
    # ---- v0.2 执行力节流 ----
    if task_ledger is not None:
        for t in out.get("tasks", []):
            person_load = task_ledger.get(("person", t["owner"]), 0)
            store_load  = task_ledger.get(("store", t["store"]), 0)
            over = person_load >= PERSON_CAP or store_load >= STORE_CAP
            if over and t.get("state") != "queued":
                errs.append(f"over_cap_direct_dispatch:{t['owner']}|{t['store']}")  # 超上限直发
        if any(t.get("state") == "queued" for t in out.get("tasks", [])):
            if not any(f.startswith("throttled") for f in out.get("flags", [])):
                errs.append("queued_without_throttle_flag")
            if not out.get("throttle", {}).get("detail"):
                errs.append("throttle_invisible_to_approver")        # 审批界面必须可见
    if out.get("_queued_dropped"):
        errs.append("queued_task_dropped")                           # 排队只排不丢
    key = out.get("_dedup_key")
    cur = ledger_before.get(key)
    if cur and cur["status"] in ("options_out","approved","dispatched","tracking") and \
       out["plan_id"] != cur["plan_id"]:
        errs.append(f"duplicate_plan:{key}")                         # 同键一案
    rv = out.get("review")
    if rv and rv.get("verdict") not in ("达成","未达成","数据不足"):
        errs.append("review_not_three_state")                        # 复盘三态如实
    # ---- v0.3 阶段只筛不替选 ----
    stage = out.get("effective_stage")
    # 阶段致自动选中/派发:options_out 期 tasks 必空、chosen 必空
    if stage and out["status"] == "options_out":
        if out.get("tasks"):
            errs.append("stage_options_out_tasks_nonempty")          # 没选=没派
        if out.get("chosen"):
            errs.append("stage_auto_selected")                       # 阶段自动选中=替人决定
    # 折叠选项必须可展开(不硬删)
    if out.get("_folded_hard_deleted"):
        errs.append("stage_hard_deleted_options")                    # 阶段硬删不可展开
    # unknown 不得被按阶段缩范围
    if stage == "unknown":
        if "stage_unknown_all_playbooks" not in str(out.get("flags", [])):
            errs.append("unknown_without_all_playbooks_flag")
        if out.get("folded_options"):
            errs.append("unknown_stage_narrowed")                    # unknown 仍折叠=缩了范围
    # 淘汰期不出方案
    if stage == "淘汰" and out.get("options") and "stage_no_playbook" not in str(out.get("flags", [])):
        errs.append("clearance_stage_still_planning")
    # 选项算账不得被阶段污染(预期/成本/执行力是事实)
    if out.get("_option_accounting_altered_by_stage"):
        errs.append("option_accounting_polluted_by_stage")
    # recommended_by_stage 只是标记,不得据此自动派
    for o in out.get("options", []):
        if o.get("recommended_by_stage") and o.get("_auto_dispatched_by_stage"):
            errs.append(f"recommended_auto_dispatched:{o['playbook_id']}")
    return errs
```

---

## 11. 评测种子(8 条)

```json
[
 {"id":"p01","input":"L5-01 P1 竞品压制(端架12店)","expect":{"options_count":3,"all_from_playbook":true,"no_machine_preference":true,"status":"options_out"},"tags":["匹配打法→2~3选项→等人选"]},
 {"id":"p02","input":"预算池余额2万,候选含3.6万选项","expect":{"over_pool_option_absent":true},"tags":["超池选项不出"]},
 {"id":"p03","input":"人选 PB-04 并批准","expect":{"status":"dispatched","tasks_per_L0_04_owner":true,"fee_via_mcp":true},"tags":["人批后派发,任务按 L0-04 责任人"]},
 {"id":"p04","input":"次周同一差距 L5-01 再报(未恶化)","expect":{"no_new_plan":true,"ref_appended":true},"tags":["同键一案不重复;若 worsened→原案内通知加码"]},
 {"id":"p05","input":"L5-01 报了打法库没覆盖的新型差距","expect":{"flags_contains":"playbook_missing","to_human":true,"manual_plan_backfills_playbook":true},"tags":["库无匹配→人工出案回补,禁临场编"]},
 {"id":"p06","input":"下窗口 L5-01 出数:SOV +2pp(预期3~6)","expect":{"review_verdict":"未达成","no_attribution_claim":true,"playbook_range_updated":true},"tags":["复盘三态如实,不归因不粉饰,回写打法库"]},
 {"id":"p07",
  "input":{"case1":"三选项案:PB-02(¥0)+PB-04(¥3.6万)+PB-07(¥2.1万),刚出件",
           "case2":"两选项案:PB-02(¥0)+PB-03 巡店加频(¥0),全零预算"},
  "expect":{"case1":{"status":"options_out","tasks_must_be_empty":true,
                     "pb02_not_pre_dispatched":true,
                     "note":"零预算 PB-02 同样等人选——先派=预占选择权"},
            "case2":{"auto_dispatched":true,"approved_by":"auto","audit_trace":true,"throttle_checked":true}},
  "tags":["v0.2-①:混合案零预算选项不先派(tasks 恒空);全零预算案才 auto 留痕"]},
 {"id":"p08",
  "input":{"approved_plan":"PB-04 获批,12 店任务待派",
           "task_ledger":{"美顾MG-0420 未完成":5,"门店ST-007 本窗口动作":3},
           "params":{"PERSON_CAP":5,"STORE_CAP":3}},
  "expect":{"MG-0420_tasks":"queued 不直发","ST-007_tasks":"queued",
            "flags_contains":"throttled:","throttle_detail_visible_to_approver":true,
            "queued_released_in_order_on_completion":true,"none_dropped":true},
  "tags":["v0.2-②:执行力节流——超并发上限排队不丢弃,按序释放,审批界面可见"]},

 {"id":"p09",
  "input":{"effective_stage":"导入","alert":"铺货差距","playbook_lib":"点亮类+复制类+赚钱类都有"},
  "expect":{"recommended_by_stage_first":"点亮类(铺货/陈列/首购)排前",
            "folded_options_expandable":"复制/赚钱类折叠但可展开",
            "no_hard_delete":true,"status":"options_out","tasks_empty":true},
  "tags":["v0.3:导入期点亮打法排前,其他可展开;人未选前不派"]},

 {"id":"p10",
  "input":{"effective_stage":"成长","case":"机器看出成长期,想直接选中'区域复制'派下去"},
  "expect":{"blocked":"stage_auto_selected / stage_options_out_tasks_nonempty",
            "correct":"排前呈现但等人选,chosen=null tasks=[]",
            "note":"阶段自动选=HITL橡皮图章"},
  "tags":["v0.3:人未选前 tasks 必为空——阶段绝不自动选中/派发"]},

 {"id":"p11",
  "input":{"effective_stage":"unknown","alert":"竞品压制"},
  "expect":{"all_playbooks_listed":true,"no_folding":true,
            "flags_contains":"stage_unknown_all_playbooks",
            "error_if_narrowed":"unknown_stage_narrowed",
            "contrast":"与L1-04/L1-07不同:HITL节点unknown=最大化人选,不缩范围"},
  "tags":["v0.3:unknown出全部打法不缩范围,选择权完整交给人"]},

 {"id":"p12",
  "input":{"effective_stage":"淘汰","alert":"该SKU铺货差距"},
  "expect":{"options":"只出清退类或空","flags_contains":"stage_no_playbook",
            "error_if_planning":"clearance_stage_still_planning"},
  "tags":["v0.3:淘汰期不出扩张方案(stage_no_playbook)"]},

 {"id":"p13",
  "input":{"effective_stage":"衰退","alert":"动销下滑","playbook_lib":"含扩张类与止损类"},
  "expect":{"recommended":"止损类(清库存/替代SKU切换)排前且收窄",
            "expansion_folded":"扩张类折叠仍可展开",
            "not_auto_executed":true,"tasks_empty_until_chosen":true},
  "tags":["v0.3:衰退期收窄到止损类但不自动执行,扩张类折叠可展开"]}
]
```

**打分:** 选项数量与无倾向(p01)/ 预算可重放与超池(p02)/ 人批人选(p03)/ 同键一案(p04)/ 库缺口闭环(p05)/ 复盘三态(p06)/ **零预算语义(p07)** / **节流(p08)** / **阶段排前+可展开(p09)** / **阶段不自动选中(p10:§10 stage_auto_selected 守)** / **unknown出全部(p11)** / **淘汰不出方案(p12)** / **衰退收窄不自动执行(p13)**。

> 最危险的 v0.3 错:**按阶段自动选打法**(p10)——HITL 节点的灵魂是人选,机器一旦借"阶段相关"把打法选中派下去,HITL 就退化成橡皮图章。前四个生命周期节点阶段都在"改自己的输出"(判级/严重度/优先级/系数),只有 L5-02 阶段碰的是"人的选择权"——所以这里阶段被限制得最死:**只排序呈现、全程可展开、绝不自动选、unknown 干脆出全部**。

## 待填变量
`owner` / 审批人映射(区域级·跨区)/ §9a 打法库与单店费用标准(营销共同定,效果区间回测填)/ **§9a-2 阶段-打法相关映射(dimension×stage,回测校准)(v0.3)** / **`effective_stage` 来源 —《SKU 生命周期阶段判定》契约,按 sku×scope×period(只读)(v0.3)** / **`<单人并发上限>` `<单店并发上限>`(建议人 5 / 店 3 起测)(v0.2)** / 一线任务台账数据源(经 MCP)/ 费用预算池与费用流程 MCP / 任务派发通道 / 方案台账落库
