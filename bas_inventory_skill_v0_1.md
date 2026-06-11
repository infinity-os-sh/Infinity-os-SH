---
name: inventory-report-triage
description: 把美顾/DOM 在门店现场发来的口语化库存上报(文字+语音转写+货架照),解析归一成一份标准化 JSON。凡涉及"门店库存上报、断货、缺货、铺货、货架盘点、竞品堆头/端架、巡店反馈、补货触发"的输入都用本 Skill,即使用户没说"上报"二字也要触发。它是库存上报 Agent 的节点1(解析/Triage),下游补货、断货预警、竞品战报全部读它的输出。
version: v0.1
owner: <填:负责人/团队>
type: Workflow / Skill(节点1 · Triage)
status: 粗糙版,待真实数据迭代
upstream: 美顾 App 上报通道(文字+语音转写+照片)
downstream: 补货 Skill / 断货预警 Skill / 竞品战报 Skill
---

# 库存上报 Skill v0.1 · 节点1(解析 / Triage)

> 本 Skill 依据《INFINITY OS · Agent 设计标准 v1.0》编写。
> 它是一个 **Workflow**(写死轨道),不是 Agent —— 库存上报高频且可预测,要的是稳、可审计,不要即兴发挥。

---

## 1. 角色与目标

你是库存上报流水线的**解析节点**。唯一职责:把美顾一句乱糟糟的现场话,变成下游各组能直接读的标准化 JSON。

- 你**只负责解析**,不负责补货、不负责发预警、不负责写战报 —— 那些是下游节点的事。
- 你的产出物(JSON)是整条线唯一的连接接口。它对,下游才能对。
- 拿不准的不要瞎编;按规则停下、打标记,交给人或下一轮。

---

## 2. 输入(Input)

| 来源 | 形式 | 说明 |
|---|---|---|
| 文字 | 语音转写 / 手输 | 口语,含简称、行话、模糊量词 |
| 照片 | 货架照(可选) | 用增强型 LLM 的视觉能力辅助核对 |
| 元数据 | 门店、美顾 ID、时间 | 由上报通道自动带入 |

---

## 3. 参数定义(Parameters)

不要把规则写死,用变量。允许值如下:

| 字段 | 类型 | 允许值 / 说明 |
|---|---|---|
| `store` | string | 门店名(归一到门店主数据) |
| `advisor_id` | string | 美顾 ID |
| `sku` | string | **必须归一到 SKU 主数据编码**(见 §9) |
| `qty` | number | 货架估算数量 |
| `conf` | enum | `high` / `mid` / `low`(数量置信度) |
| `status` | enum | `normal` / `low`(低于安全库存) / `out_of_stock`(断货) |
| `competitor` | object[] | brand / sku / loc / act / scale |
| `loc` | enum | `货架` / `端架` / `堆头` / `收银区` / `其他` |
| `scale` | enum | `small` / `mid` / `large` |
| `executed` | string[] | 美顾已执行动作(物料补充等) |

---

## 4. 处理流程(Steps · 路由 → 链式)

### Step A — 路由(Routing):先把一句话分成几类
扫一遍输入,识别其中混了哪几类信息,分别送进下面对应分支:
`库存量` · `断货` · `竞品动作` · `已执行动作`

### Step B — 链式(Chaining):每类逐步处理
对"库存量 / 断货"分支,严格按顺序走,每步输出交下一步:
1. **认货** — 从口语里抽出产品(如"六月鲜特级380ml")。
2. **归一** — 把口语名映射到 SKU 主数据编码。**【闸门】归一不到 → 停,打 `sku_unresolved` 标记,不许编造编码。**
3. **估量** — 把模糊量词("剩两排""大概8瓶")转成 `qty` + `conf`。**"X排"必须按该门店货架规格换算(见 §10 踩坑)。**
4. **比对** — 与安全库存(A/2A/3A)比,定 `status`。
5. **出件** — 按 §6 schema 输出 JSON。

对"竞品 / 已执行"分支:抽字段、填入 JSON 对应区块即可。

---

## 5. 规则与强度(RFC2119)

| 强度 | 规则 |
|---|---|
| **MUST** | 断货必须立即标 `out_of_stock`,并写入 `fanout` 触发断货预警。 |
| **MUST** | 口语 SKU 必须归一到主数据;归一不到必须停并打标记,**严禁编造编码**。 |
| **MUST** | 涉及补货金额 > `<HITL_金额阈值>` 或疑似窜货,必须写 `hitl_required: true`(见 §8)。 |
| **SHOULD** | 数量为估算时,应标 `conf`;`端架/堆头` 竞品应附照片佐证,无照应记原因。 |
| **SHOULD** | `端架/堆头` 位置的竞品动作,预警等级应自动升一级。 |
| **MAY** | 美顾已执行动作(如补物料)可记入 `executed`,非核心决策必需项。 |

---

## 6. 输出(Output · Artifact 契约)

下游唯一认这份结构。字段缺失用 `null`,不要省略键。

```json
{
  "store": "大润发徐汇店",
  "advisor_id": "MG-0420",
  "ts": "2026-06-11T14:20:00+08:00",
  "items": [
    { "sku": "6MX-TJ-380", "qty": 8, "conf": "low", "status": "low" },
    { "sku": "6MX-JDX", "qty": 0, "conf": "high", "status": "out_of_stock" }
  ],
  "competitor": [
    { "brand": "海天", "sku": "金标生抽", "loc": "端架", "act": "堆头", "scale": "large" }
  ],
  "executed": ["补爆炸卡"],
  "flags": [],
  "hitl_required": false,
  "fanout": ["补货:6MX-TJ-380", "断货预警:6MX-JDX", "竞品战报:海天金标堆头"]
}
```

---

## 7. 扇出规则(Deterministic Fan-out)

写死的 if-then,不靠 AI 临场判断:

| 条件 | 触发下游 |
|---|---|
| `status == "low"` | 补货 Skill |
| `status == "out_of_stock"` | 断货预警 Skill(+ 补货 Skill) |
| `competitor` 非空 | 竞品战报 Skill |
| `loc in (端架,堆头)` | 竞品战报等级 +1 |

---

## 8. HITL 卡点

本节点**不执行**任何不可逆动作,只负责标记。真正停机发生在下游执行(下单)前。

| 触发 | 本节点动作 |
|---|---|
| 推算补货额 > `<HITL_金额阈值>` | 置 `hitl_required: true`,`flags += ["大额补货"]` |
| 同店同 SKU 短期异常波动(疑似窜货) | 置 `hitl_required: true`,`flags += ["疑似窜货"]` |

> `hitl_required: true` 时,下游补货 Skill 必须停机等人点 OK 才能下单。

---

## 9. References — SKU 主数据(示例,接真实主数据替换)

| 口语名 | 归一编码 | 安全库存(瓶) |
|---|---|---|
| 六月鲜特级 380ml | 6MX-TJ-380 | 12 |
| 六月鲜 / 加点鲜 | 6MX-JDX | 8 |
| 六月鲜轻盐 500ml | 6MX-QY-500 | 10 |

> 接入时把本表替换为门店级安全库存主数据查询工具(经 MCP)。

## 9b. References — 术语表(默会知识,持续补充)

| 行话 | 含义 | 处理 |
|---|---|---|
| 爆炸卡 | **促销物料**,非产品 | 记入 `executed`,**不计入 items 库存** |
| 端架 | 货架尽头高价值陈列位 | `loc=端架`,竞品预警 +1 |
| 堆头 | 地面集中陈列 | `loc=堆头`,竞品预警 +1 |
| 排 | 货架横向陈列单位 | 按门店货架规格换算瓶数(见 §10) |

## 9c. References — 踩坑记录(每次撞墙补一条)

- ❌ 把"爆炸卡"当成 SKU 算进库存 → ✅ 已加入术语表,归类为物料。
- ❌ "两排"按固定 6 瓶硬换算,大店货架更宽估偏低 → ✅ 改为按门店货架规格表换算。
- _(后续迭代继续往下加)_

---

## 10. Scripts — 确定性校验(节点出件前必跑)

把"传统软件能做的事"交给脚本,别让 LLM 做:

```python
def validate(out: dict) -> list[str]:
    """返回错误列表;非空则本节点不得出件,转 flags。"""
    errs = []
    for it in out.get("items", []):
        if it["sku"] not in SKU_MASTER:           # MUST: 编码必须存在
            errs.append(f"sku_unresolved:{it['sku']}")
        if it["status"] == "out_of_stock" and \
           f'断货预警:{it["sku"]}' not in out.get("fanout", []):
            errs.append(f"missing_fanout_oos:{it['sku']}")  # MUST: 断货必触发
    if out.get("hitl_required") and not out.get("flags"):
        errs.append("hitl_without_reason")        # HITL 必带原因
    return errs
```

---

## 11. 评测起手式(Eval Starter)

> 别在线上挂评估器。评测在**离线建设期**做:攒 50 条真实上报,跑本 Skill,对照标准答案打分,把错误回补进 §5 / §9。先放 6 条种子,覆盖关键场景。

**评测样例格式:**
```json
{ "id": "...", "input": "美顾原话", "expect": { ...期望的关键字段... }, "tags": ["场景"] }
```

**种子样例(6 条):**
```json
[
 {"id":"e01","input":"六月鲜特级380ml货架剩两排大概8瓶,加点鲜断货了,海天在端架做了金标生抽的大堆头,我把六月鲜的爆炸卡补了",
  "expect":{"items":[{"sku":"6MX-TJ-380","status":"low"},{"sku":"6MX-JDX","status":"out_of_stock"}],
            "competitor":[{"brand":"海天","loc":"端架"}],"executed":["补爆炸卡"]},
  "tags":["综合","断货","竞品","行话:爆炸卡/端架"]},

 {"id":"e02","input":"轻盐500的还有大半排吧应该够","expect":{"items":[{"sku":"6MX-QY-500","conf":"low"}]},
  "tags":["模糊量词","置信度"]},

 {"id":"e03","input":"今天没啥特别的,货都挺满","expect":{"items":[],"status_all":"normal"},
  "tags":["空报/正常"]},

 {"id":"e04","input":"那个六月鲜的零添加生抽我看断了","expect":{"flags_contains":"sku_unresolved"},
  "tags":["归一失败→必须停,不许编码"]},

 {"id":"e05","input":"特级380一下少了三箱,昨天还满的,要赶紧补一大批","expect":{"hitl_required":true,"flags_contains":"疑似窜货"},
  "tags":["HITL:异常波动"]},

 {"id":"e06","input":"端架那边李锦记摆了个堆头挺大的","expect":{"competitor":[{"brand":"李锦记","loc":"端架","scale":"large"}],"comp_level_bump":true},
  "tags":["竞品端架→预警+1"]}
]
```

**打分维度(每条 0/1):**
1. SKU 归一正确(含 e04 该停就停)
2. status 判定正确(normal/low/out_of_stock)
3. 竞品字段完整(brand/loc/scale)
4. 行话处理正确(爆炸卡不计库存、端架升级)
5. HITL 标记正确(e05)
6. JSON 通过 §10 校验

> 跑完看哪一维最常错 —— 那一维就是你下一轮要补的 MUST/术语/踩坑。两天写本粗糙版,一周迭代 50 次,两周上线。

---

## 待填变量(套用时替换)
- `<HITL_金额阈值>` — 触发人工审批的补货金额线
- `owner` — 本 Skill 负责人/团队
- §9 SKU 主数据 — 替换为真实主数据查询工具(MCP)
