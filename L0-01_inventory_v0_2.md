---
name: inventory-report-triage
description: 把美顾/DOM 在门店现场发来的口语化库存上报(文字+语音转写+货架照+一物一码扫码),解析归一成一份标准化 JSON。凡涉及"门店库存上报、断货、缺货、铺货、货架盘点、批次扫码、巡店反馈、补货触发"的输入都用本 Skill,即使用户没说"上报"二字也要触发。它是库存上报线的节点1(解析/Triage)、库存与批次事实的真相源;下游 L0-07 预警、L0-03 日报、L0-06 窜货监测全部读它的输出。
version: v0.2
owner: <填:负责人/团队>
type: Workflow / Skill(节点1 · Triage · 真相源)
status: v0.2,生态对齐版
upstream: 美顾 App 上报通道(文字+语音转写+照片+INF-XD 扫码)
downstream: L0-07 缺断货预警(唯一触发接收方)/ L0-03 门店日报 / L0-06 价格窜货监测(批次)/ L0-05 竞品上报(转交)
---

# 库存上报 Skill v0.2 · 节点1(解析 / Triage)

> 本 Skill 依据《INFINITY OS · Agent 设计标准 v1.0》编写。
> 它是一个 **Workflow**(写死轨道),不是 Agent —— 库存上报高频且可预测,要的是稳、可审计,不要即兴发挥。

> **v0.2 变更摘要(生态对齐,规则本体不变):** ①**批次/一物一码字段正式入契约**(items[].batch_id + scans[],含码级 bottle/case)——L0-06 已在消费,补正定义;②**扇出接收方点名**:断货预警 → L0-07(全系统唯一触发方),补货经 L0-07 路由至 L0-08,本节点不再直呼"补货 Skill";③**竞品内容转交 L0-05**(竞品真相源已迁移),本节点 competitor 区块降为透传引用;④References 对齐 L0-04:"排"换算读 L0-04 shelf_spec,安全库存按店级取。

---

## 1. 角色与目标

你是库存上报流水线的**解析节点**,库存与批次事实的**真相源**。唯一职责:把美顾一句乱糟糟的现场话(及扫码记录),变成下游各组能直接读的标准化 JSON。

- 你**只负责解析**,不负责补货、不负责发预警、不负责写战报 —— 预警判级归 L0-07,下单归 L0-08,竞品归 L0-05,日报归 L0-03。
- 你的产出物(JSON)是整条线唯一的连接接口。它对,下游才能对。
- 拿不准的不要瞎编;按规则停下、打标记,交给人或下一轮。

---

## 2. 输入(Input)

| 来源 | 形式 | 说明 |
|---|---|---|
| 文字 | 语音转写 / 手输 | 口语,含简称、行话、模糊量词 |
| 照片 | 货架照(可选) | 用增强型 LLM 的视觉能力辅助核对 |
| **扫码(v0.2)** | INF-XD 一物一码 / 箱码 | batch_id + 码级(bottle/case)+ 时间,通道自动带入 |
| 元数据 | 门店、美顾 ID、时间 | 由上报通道自动带入 |

---

## 3. 参数定义(Parameters)

不要把规则写死,用变量。允许值如下:

| 字段 | 类型 | 允许值 / 说明 |
|---|---|---|
| `store` | string | 门店名(归一到 L0-04 门店主数据) |
| `advisor_id` | string | 美顾 ID |
| `sku` | string | **必须归一到 SKU 主数据编码**(见 §9) |
| `qty` | number | 货架估算数量 |
| `conf` | enum | `high` / `mid` / `low`(数量置信度) |
| `status` | enum | `normal` / `low`(低于安全库存) / `out_of_stock`(断货) |
| **`batch_id`(v0.2)** | string\|null | 批次号(扫码带出);无扫码填 null |
| **`scans[]`(v0.2)** | object[] | `{scan_ref, scan_level: bottle/case, ts}` 扫码记录;**L0-06 窜货证据主料,箱码权重高于瓶码** |
| `loc` | enum | `货架` / `端架` / `堆头` / `收银区` / `其他` |
| `executed` | string[] | 美顾已执行动作(物料补充等) |
| **`competitor_passthrough`(v0.2)** | object\|null | 竞品口语原文引用,**仅透传转交 L0-05**;原 competitor 结构化区块废弃(真相源归 L0-05) |
| `hitl_required` / `flags` | bool / string[] | 大额/疑似窜货标记(经 L0-07 carry 透传,在 L0-08 落地停机;疑似窜货同时归集到 L0-06 立案) |

---

## 4. 处理流程(Steps · 路由 → 链式)

### Step A — 路由(Routing):先把一句话分成几类
扫一遍输入,识别其中混了哪几类信息,分别送进对应分支:
`库存量` · `断货` · `已执行动作` · **`竞品动作`(→ 仅截取原话,转交 L0-05,本节点不解析,v0.2)**

### Step B — 链式(Chaining):对"库存量 / 断货"分支,严格按顺序走
1. **认货** — 从口语里抽出产品(如"六月鲜特级380ml")。
2. **归一** — 把口语名映射到 SKU 主数据编码。**【闸门】归一不到 → 停,打 `sku_unresolved` 标记,不许编造编码。**
3. **估量** — 把模糊量词("剩两排""大概8瓶")转成 `qty` + `conf`。**"X排"按该门店货架规格换算——规格读 L0-04 档案 `shelf_spec`(v0.2,替代原"门店货架规格表"占位)。**
4. **关联扫码(v0.2)** — 有扫码记录的,把 batch_id / scans 挂到对应 items 条目(或独立批次条目)。**扫码是机器事实,不经 LLM 解析,原样透传。**
5. **比对** — 与安全库存比,定 `status`。**安全库存按店级取**(SKU × L0-04 store_grade,v0.2)。
6. **出件** — 按 §6 schema 输出 JSON。

对"已执行"分支:抽字段填入 `executed`。对"竞品"分支:**整段原话进 `competitor_passthrough`,fanout 加「转交:L0-05」,到此为止**——解析、归一、定级全是 L0-05 的活,两边解析两遍必然漂移。

---

## 5. 规则与强度(RFC2119)

| 强度 | 规则 |
|---|---|
| **MUST** | 断货必须立即标 `out_of_stock`,并写入 `fanout` 触发「断货预警→L0-07」。**接收方是 L0-07(全系统唯一触发方),本节点不定等级、不管通知谁。(v0.2 点名)** |
| **MUST** | 口语 SKU 必须归一到主数据;归一不到必须停并打标记,**严禁编造编码**。 |
| **MUST** | 涉及补货金额 > `<HITL_金额阈值>` 或疑似窜货,必须写 `hitl_required: true`——**停机发生在 L0-08 下单前(经 L0-07 carry 透传);疑似窜货另归集至 L0-06 立案线。(v0.2 点名)** |
| **MUST** | 扫码记录(batch_id/scans)必须原样透传不加工——它是 L0-06 窜货证据链的主料,LLM 改一个字符证据就废。**(v0.2)** |
| **MUST** | 竞品内容只透传转交 L0-05,本节点**不得**解析竞品结构化字段(真相源唯一)。**(v0.2)** |
| **SHOULD** | 数量为估算时,应标 `conf`;"排"换算应读 L0-04 shelf_spec,读不到记原因并按保守口径。 |
| **MAY** | 美顾已执行动作(如补物料)可记入 `executed`,非核心决策必需项。 |

---

## 6. 输出(Output · Artifact 契约)

下游唯一认这份结构。字段缺失用 `null`,不要省略键。

```json
{
  "store": "大润发徐汇店",
  "advisor_id": "MG-0420",
  "ts": "2026-06-12T14:20:00+08:00",
  "items": [
    { "sku": "6MX-TJ-380", "qty": 8, "conf": "low", "status": "low",
      "batch_id": null, "scans": [] },
    { "sku": "6MX-JDX", "qty": 0, "conf": "high", "status": "out_of_stock",
      "batch_id": "B20260501-077",
      "scans": [ { "scan_ref": "XD-scan-88172", "scan_level": "case", "ts": "2026-06-12T11:02:00+08:00" } ] }
  ],
  "competitor_passthrough": { "raw": "海天在端架做了金标生抽的大堆头", "handoff": "L0-05" },
  "executed": ["补爆炸卡"],
  "flags": [],
  "hitl_required": false,
  "fanout": ["断货预警→L0-07:6MX-JDX", "低库存→L0-07:6MX-TJ-380", "日报→L0-03", "批次→L0-06:B20260501-077", "转交→L0-05:竞品"]
}
```

> v0.1 → v0.2 兼容性:items 新增键(batch_id/scans)为增量;原 `competitor` 结构化区块废弃,过渡期下游(L0-03)已改读 L0-05 为真相源,不受影响。

---

## 7. 扇出规则(Deterministic Fan-out · v0.2 接收方点名)

写死的 if-then,不靠 AI 临场判断:

| 条件 | 触发下游 | 说明 |
|---|---|---|
| `status == low` | **L0-07**(低库存分支) | 判级/通知归 L0-07;下单经其路由至 L0-08 |
| `status == out_of_stock` | **L0-07**(断货分支) | 同上;L0-07 是全系统唯一预警触发方 |
| `batch_id` 非空 | **L0-06**(流向线) | 窜货监测的批次证据;白名单/证据线在 L0-06 把关 |
| `competitor_passthrough` 非空 | **L0-05**(转交) | 竞品解析归一全在 L0-05 |
| 永远 | **L0-03** 日报 | 当日汇总(对账去重在 L0-03) |

> ❌ v0.1 旧扇出"补货:SKU / 竞品战报:SKU"已废弃——补货触发必须经 L0-07 判级防重复,直呼补货会绕过台账造成重复下单;竞品自产会与 L0-05 双真相源打架。

---

## 8. HITL 卡点

本节点**不执行**任何不可逆动作,只负责标记。真正停机发生在 **L0-08 下单前**(v0.2 点名,链路已闭环:本节点打标 → L0-07 carry → L0-08 必停)。

| 触发 | 本节点动作 |
|---|---|
| 推算补货额 > `<HITL_金额阈值>` | 置 `hitl_required: true`,`flags += ["大额补货"]` |
| 同店同 SKU 短期异常波动(疑似窜货) | 置 `hitl_required: true`,`flags += ["疑似窜货"]`;批次随 fanout 归集 L0-06 |

---

## 9. References — SKU 主数据(示例,接真实主数据替换,经 MCP)

| 口语名 | 归一编码 | 安全库存(按店级,v0.2) |
|---|---|---|
| 六月鲜特级 380ml | 6MX-TJ-380 | A店 12 / B店 8 / C店 6 |
| 六月鲜 / 加点鲜 | 6MX-JDX | A店 8 / B店 6 / C店 4 |
| 六月鲜轻盐 500ml | 6MX-QY-500 | A店 10 / B店 6 / C店 4 |

> 店级取自 **L0-04 档案 store_grade**;接入时替换为门店级安全库存主数据查询工具(经 MCP)。

## 9b. References — 术语表(默会知识,持续补充)

| 行话 | 含义 | 处理 |
|---|---|---|
| 爆炸卡 | **促销物料**,非产品 | 自家的记入 `executed`,不计库存;**竞品的属竞品动作,随原话转交 L0-05**(v0.2,与 L0-05 §9c 对偶) |
| 端架 / 堆头 | 高价值陈列位 | 库存条目可记 loc;竞品占位的解析归 L0-05/L0-02 |
| 排 | 货架横向陈列单位 | **按 L0-04 shelf_spec 换算瓶数**(v0.2) |
| 一物一码 / 箱码 | INF-XD 批次追溯 | 机器事实原样透传;箱码=整箱流动(L0-06 证据权重高) |

## 9c. References — 踩坑记录(每次撞墙补一条)

- ❌ 把"爆炸卡"当成 SKU 算进库存 → ✅ 已加入术语表,归类为物料。
- ❌ "两排"按固定 6 瓶硬换算,大店货架更宽估偏低 → ✅ 改为按门店货架规格换算;(v0.2)规格统一读 L0-04 shelf_spec,不再自维护规格表。
- ❌(v0.2)扫码 batch_id 被 LLM "顺手规范化"改了一个字符 → L0-06 查无此批,证据链断 → ✅ 扫码是机器事实,原样透传零加工。
- ❌(v0.2)库存上报里捎带的竞品话也解析出 competitor 区块 → 与 L0-05 双真相源,L0-03 对账打架 → ✅ 竞品只截原话转交,本节点不解析。
- ❌(v0.2)fanout 直呼"补货:SKU" → 绕过 L0-07 台账,预警重发即重复下单 → ✅ 一切经 L0-07 判级防重复,再由其路由 L0-08。
- _(后续迭代继续往下加)_

---

## 10. Scripts — 确定性校验(节点出件前必跑)

```python
def validate(out: dict) -> list[str]:
    """返回错误列表;非空则本节点不得出件,转 flags。"""
    errs = []
    for it in out.get("items", []):
        if it["sku"] not in SKU_MASTER:           # MUST: 编码必须存在
            errs.append(f"sku_unresolved:{it['sku']}")
        if it["status"] == "out_of_stock" and \
           f'断货预警→L0-07:{it["sku"]}' not in out.get("fanout", []):
            errs.append(f"missing_fanout_oos:{it['sku']}")  # MUST: 断货必送 L0-07
        # v0.2: 扫码透传完整性
        for s in it.get("scans", []):
            if not (s.get("scan_ref") and s.get("scan_level") in ("bottle", "case") and s.get("ts")):
                errs.append(f"scan_record_incomplete:{it['sku']}")
        if it.get("batch_id") and f'批次→L0-06:{it["batch_id"]}' not in out.get("fanout", []):
            errs.append(f"batch_not_sent_to_L0_06:{it['batch_id']}")
    # v0.2: 竞品只许透传,不许结构化
    if out.get("competitor"):
        errs.append("competitor_block_forbidden")          # 真相源归 L0-05
    if out.get("competitor_passthrough") and \
       "转交→L0-05:竞品" not in out.get("fanout", []):
        errs.append("competitor_not_handed_off")
    # v0.2: 旧扇出词禁用
    for f in out.get("fanout", []):
        if f.startswith("补货:") or f.startswith("竞品战报:") or f.startswith("断货预警:"):
            errs.append(f"legacy_fanout:{f}")              # 必须带接收方箭头
    if out.get("hitl_required") and not out.get("flags"):
        errs.append("hitl_without_reason")                 # HITL 必带原因
    return errs
```

---

## 11. 评测起手式(v0.1 的 e01–e06 保留,期望中扇出词同步改为带接收方;v0.2 新增 3 条)

```json
[
 {"id":"e07",
  "input":"加点鲜断货了 [扫码:XD-scan-88172,箱码,批次B20260501-077,11:02]",
  "expect":{"items":[{"sku":"6MX-JDX","status":"out_of_stock","batch_id":"B20260501-077",
                      "scans":[{"scan_ref":"XD-scan-88172","scan_level":"case"}]}],
            "fanout_contains":["断货预警→L0-07:6MX-JDX","批次→L0-06:B20260501-077"],
            "scan_verbatim":true},
  "tags":["v0.2-①②:扫码原样透传入契约,批次送L0-06,断货送L0-07"]},

 {"id":"e08",
  "input":"特级380剩两排,海天在端架做了金标大堆头",
  "expect":{"items":[{"sku":"6MX-TJ-380"}],
            "competitor_passthrough":{"raw_contains":"海天","handoff":"L0-05"},
            "no_competitor_block":true,
            "fanout_contains":"转交→L0-05:竞品"},
  "tags":["v0.2-③:竞品只截原话转交,不解析不自产区块"]},

 {"id":"e09",
  "input":"特级380剩两排(本店为A级大店,L0-04 shelf_spec:每排8瓶)",
  "expect":{"items":[{"sku":"6MX-TJ-380","qty":16,"conf":"mid"}],
            "conversion_basis":"L0-04:shelf_spec"},
  "tags":["v0.2-④:排换算读L0-04规格——大店两排=16瓶,不再按固定6瓶"]}
]
```

**新增打分维度:** 7. 扫码零加工透传 + 批次扇出(e07);8. 竞品转交不自产(e08);9. 换算基准来自 L0-04(e09);10. 无 legacy 扇出词(§10 拦)。

---

## 待填变量(套用时替换)
- `<HITL_金额阈值>` — 与 L0-08 §9a 自动下单阈值**共同定**(两处必须一致,否则标记与停机错位)
- `owner` — 本 Skill 负责人/团队
- §9 SKU 主数据 — 替换为门店级安全库存主数据查询工具(经 MCP,店级取 L0-04)
- 扫码通道 — INF-XD 接入(经 MCP)
