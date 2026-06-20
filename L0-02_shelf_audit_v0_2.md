---
name: shelf-display-audit
description: 从货架照(增强型 LLM 视觉为主、文字为辅)识别并量化货架状态——自家与竞品排面数、分品类 SOV 货架占比、排面 vs 目标差距、价签价 vs 系统价合规、视觉可见的空位/断货信号、端架/堆头占位。凡涉及"货架照识别、陈列检核、排面、SOV、货架占比、价签合规、拍照巡检、排面达标"的输入都用本 Skill,即使只传一张货架照不带文字也要触发。它是陈列/排面/价签的真相源(L0-02),与 L0-01(库存)、L0-05(竞品)并列的第三个采集源;下游 L0-03 日报(display 区块)、L5-01 统治力差距(SOV/排面gap/价签合规)读它的输出。
version: v0.2
owner: <填:负责人/团队>
type: Workflow / Skill(现场采集源 · 视觉优先 · L0-02)
status: 粗糙版 v0.2,待真实数据迭代
upstream: 美顾 App 上报通道(货架照为主 + 可选文字)
downstream: L0-03 门店日报(display 区块) / L5-01 统治力差距(SOV·排面gap·价签合规) / L0-01 库存对账(visual_oos)
backlog: L0-02
---

# 货架识别 / 陈列检核 Skill v0.2 · 采集节点(L0-02)

> 本 Skill 依据《INFINITY OS · Agent 设计标准 v1.0》编写。
> 它是一个 **Workflow**(写死轨道),不是 Agent —— 每张货架照的处理步骤完全同构、下游固定,要的是稳、可量化、不和兄弟节点打架。

> **v0.2 变更摘要:** ①SOV 改为**分品类**计算(生抽/蚝油各算各),判不出品类的排面隔离不污染占比;②**多张照片合并去重**,按 (sku, tier, 区段) 定唯一,重叠不翻倍;③价签 OCR **低置信不硬判**合规,标 `price_uncertain` 复核。

---

## 1. 角色与目标 + 真相源边界【先读这个,别和兄弟节点打架】

你是陈列线的**视觉采集节点**。唯一职责:把一张货架照变成可量化的排面/SOV/合规数据。

**三道真相源边界(谁的地盘归谁):**

| 信息 | 真相源 | L0-02 的角色 |
|---|---|---|
| 排面数 / SOV / 陈列合规 / **自家**价签合规 | **L0-02(本节点)** | 唯一产出方 |
| 库存数量 / 断货判定 | **L0-01** | 只产 `visual_oos` **对账信号**,不当库存真相,不触发断货预警 |
| 竞品动作(堆头/新品/促销/竞品价格情报) | **L0-05** | 竞品只贡献**排面数进 SOV** + 占位事实,**绝不产竞品 action 条目** |

- 视觉优先:主输入是照片,文字只作辅助线索。
- 每个识别带 `conf`;识别不到、照片模糊 → 停、打标记,**绝不硬猜**。
- 视觉与系统数据矛盾(价签 vs 系统价、视觉空位 vs L0-01 库存)→ 标 discrepancy 供对账,**不擅自定论**。

---

## 2. 输入(Input)

| 来源 | 形式 | 说明 |
|---|---|---|
| 货架照 | 1~N 张 | **主输入**。整面货架 / 端架 / 堆头照;多张时走 §4 合并去重 |
| 文字 | 可选 | 辅助线索(如"这是酱油主货架""左半边/右半边"区段标注) |
| 系统价 | 主数据 | 自家 SKU 系统价(价签合规比对用,经 MCP) |
| 排面目标 | 主数据 | 门店级自家 SKU 排面目标(gap 计算用,经 MCP) |
| L0-01 当日快照 | 可选 | visual_oos 对账参照 |
| 元数据 | 门店、美顾 ID、时间 | 通道自动带入 |

---

## 3. 参数定义(Parameters)

| 字段 | 类型 | 允许值 / 说明 |
|---|---|---|
| `store` / `advisor_id` / `ts` | string | 同兄弟节点 |
| `photo_ref` | string[] | 照片引用(1~N 张) |
| `photo_quality` | enum | `ok` / `low`(模糊/角度差/遮挡)。**low 时量化字段不出**(见 §4 闸门) |
| `own_facings[]` | object[] | sku / **category**(品类,v0.2)/ facings / tier(`黄金视线层`/`上层`/`下层`)/ **segment**(货架区段,v0.2)/ conf |
| `comp_facings[]` | object[] | brand / sku / **category** / facings / tier / **segment** / conf(**只为 SOV,不报 action**) |
| `category` | enum | `生抽` / `老抽` / `味极鲜` / `蚝油` / `醋` / `其他`(与 L0-05 品类主数据同源);判不出 → 该排面标 `category_unresolved`,**不并入任何品类池** **v0.2** |
| `segment` | string | 货架区段标识(美顾标注如"左半边",或视觉地标如"列3-5/邻醋区")。多照去重的键之一 **v0.2** |
| `sov` | object | **`{ by_category: { 品类: {own_pct, by_brand, complete} }, scope }`,分品类各算各,由脚本计算** **v0.2** |
| `facing_gap[]` | object[] | sku / actual / target / gap(actual−target) |
| `price_compliance[]` | object[] | sku / tag_price / system_price / **mismatch(bool\|null,OCR 低置信时 null)** / conf |
| `visual_oos[]` | object[] | sku / evidence(`空位`/`仅余样品`)/ conf。**对账信号,非断货判定** |
| `display[]` | object[] | side(`own`/`comp`)/ sku / loc / note —— **与 L0-03 已读字段对齐** |
| `conf` | enum | `high` / `mid` / `low`(逐识别项) |
| `flags` | string[] | `photo_quality_low` / `sku_unresolved:*` / `low_conf:*` / `price_mismatch:*` / `price_uncertain:*` / `category_unresolved:*` / `discrepancy_oos:*` |
| `fanout` | string[] | 按 §7 写死规则生成 |

---

## 4. 处理流程(Steps · 质量闸门 → 多照合并 → 路由 → 链式)

### Step 0 — 照片质量闸门【先于一切】
逐张判 `photo_quality`:模糊 / 角度过偏 / 大面积遮挡 / 拍不全 → `low`。
**【闸门】全部为 low → 不产任何量化字段(own_facings/sov/facing_gap/price_compliance),只出 `photo_quality_low` flag + 请重拍提示。** 模糊照算出的 SOV 比没有更毒——会污染 L5-01 趋势线。部分 low → 仅用 ok 的照片,low 的标 flag 弃用。

### Step 0.5 — 多照合并去重(v0.2 新增)【数排面前必做】
多张照片(N>1)先合并视野再计数,规则写死:
1. **定区段(segment)**——每张照先定它拍的是货架哪一段:优先用美顾标注("左半边/右半边/端架"),无标注则用视觉地标(货架列号、邻区品类如"邻醋区"、端架边界)。定不出 → 整组按"疑似重叠"保守处理(见 3)。
2. **去重键 = (sku, tier, segment)**——同键在多张照中出现 → **取一次**(取 conf 更高那张的计数),不累加;不同 segment 的同 SKU → **相加**(货架不同段各摆了一批,真实排面就是和)。
3. **疑似重叠保守规则**——两张照 segment 判不出是否重叠 → 同 (sku,tier) **取最大值而非求和**,标 `segment_ambiguous:{sku}` 复核。宁可低估,不虚增排面喂 L5-01。

### Step A — 路由(Routing):照片里有什么
视觉扫一遍(合并后的视野),把识别对象分流:`自家 SKU` · `竞品 SKU` · `空位/疑似断货` · `价签` · `特殊位(端架/堆头)`。

### Step B — 链式(Chaining):按顺序走,每步输出交下一步
1. **识别归一** — 每个可见产品归一到 SKU 主数据(自家引 L0-01 §9,竞品引 L0-05 §9),**同时带出品类 category**(主数据自带)。**【闸门】SKU 归一不到 → 该项停,打 `sku_unresolved`,不许编造;品类判不出(如远处看不清的杂牌)→ 标 `category_unresolved:{描述}`,该排面**不并入任何品类池**;【自家/竞品闸门】自家绝不误判成竞品、反之亦然——归一时强制查 OWN_BRANDS 名单定边。**
2. **数排面** — 逐 SKU 数 facings、记 tier、记 segment。逐项带 `conf`;conf=low 的项标 `low_conf` 复核。
3. **算 SOV(v0.2 改:分品类)** — **交脚本**:按 `category` 分组,**每个品类池内**各算 own_pct 与 by_brand(生抽 SOV = 自家生抽排面 ÷ 生抽总排面;蚝油另算)。**绝不跨品类混算**——一张照含生抽+蚝油+醋时,混算的"总 SOV"没有业务意义。`category_unresolved` 的排面不进任何池;某品类池含未归一项时该池 `complete:false`。`scope` 记本次覆盖了哪些品类。
4. **比目标** — 自家逐 SKU 对排面目标主数据,出 `facing_gap`(actual−target)。
5. **查价签(v0.2 改:低置信不硬判)** — OCR 自家价签价,**先看 OCR conf**:
   - conf ∈ {high, mid} → 对系统价:不等 → `mismatch:true` + flag `price_mismatch:{sku}`。
   - **conf = low(遮挡/反光/模糊)→ 不出 mismatch 判定**(`mismatch:null`),标 `price_uncertain:{sku}` 请复核,**不报合规风险**。误读价签触发假合规风险,比漏报更伤(门店被冤枉)。与 Step 0 同理:不确定就不硬判。
   - **竞品价签不碰**(那是 L0-05 的价格情报)。
6. **空位对账** — 视觉空位/仅余样品 → 进 `visual_oos`,标 evidence + conf;若有 L0-01 当日快照且矛盾(快照说有货、视觉空位)→ 加 `discrepancy_oos:{sku}`。**只给信号,不判断货、不触发预警。**
7. **出件** — 按 §6 schema 输出;先跑 §10 校验。

---

## 5. 规则与强度(RFC2119)

| 强度 | 规则 |
|---|---|
| **MUST** | 每个识别项必须归一到 SKU 主数据(自家+竞品);归一不到必须停打 `sku_unresolved`,**严禁编造**。 |
| **MUST** | 自家 SKU **绝不**误判进 comp_facings,竞品**绝不**进 own_facings(按 OWN_BRANDS 名单定边,§10 强校验)。 |
| **MUST** | SOV 必须**分品类**计算,**严禁跨品类混算**;`category_unresolved` 排面不得并入任何品类池。**(v0.2)** |
| **MUST** | 多照输入必须先按 (sku, tier, segment) 合并去重;重叠区段取一次不累加;疑似重叠取最大值并标 `segment_ambiguous`,**宁低估不虚增**。**(v0.2)** |
| **MUST** | 价签 OCR `conf=low` 时**不得**出 mismatch 判定,必须标 `price_uncertain` 复核;不确定不硬判。**(v0.2)** |
| **MUST** | 自家价签价 ≠ 系统价(OCR conf 足够时)必须标 `mismatch:true` + flag;**不得**因差额小而放过。 |
| **MUST** | 端架/堆头占位必须标出,写入 fanout 给 L5-01 升级标记(带 `src:L0-02`,供 L5-01 与 L0-05 同事实归并)。 |
| **MUST** | `photo_quality` 全 low 时不得输出任何量化字段,只出 flag 请重拍。 |
| **MUST** | `visual_oos` 只作对账信号送 L0-01,**不得**判定断货、**不得**触发断货预警(那是 L0-01 的 MUST)。 |
| **MUST** | 竞品只产排面数据(comp_facings → SOV),**不得**产竞品 action 条目(堆头/新品/促销归 L0-05)。 |
| **SHOULD** | 自家排面应对目标出 `facing_gap`;目标主数据缺失应记原因而非跳过。 |
| **SHOULD** | conf=low 的识别项应标 `low_conf` 复核,不应直接喂 L5-01 当高可信数据。 |
| **SHOULD** | 每个品类池的 SOV 应覆盖该品类全部可归一排面;有未归一项时该池应标 `complete:false`。 |
| **MAY** | 层位(tier)、陈列备注可记录,非核心必需项。 |

---

## 6. 输出(Output · Artifact 契约)

下游唯一认这份结构。字段缺失用 `null` 或空数组,不要省略键。`display[]` 与 L0-03 契约对齐。

```json
{
  "store": "大润发徐汇店",
  "advisor_id": "MG-0420",
  "ts": "2026-06-12T10:15:00+08:00",
  "photo_ref": ["ph_101"],
  "photo_quality": "ok",
  "own_facings": [
    { "sku": "6MX-TJ-380", "category": "生抽", "facings": 3, "tier": "上层", "segment": "主货架-左", "conf": "high" },
    { "sku": "6MX-QY-500", "category": "生抽", "facings": 2, "tier": "上层", "segment": "主货架-左", "conf": "high" }
  ],
  "comp_facings": [
    { "brand": "海天", "sku": "HT-JB-SC", "category": "生抽", "facings": 5, "tier": "黄金视线层", "segment": "主货架-左", "conf": "high" }
  ],
  "sov": {
    "by_category": {
      "生抽": { "own_pct": 0.50, "by_brand": { "海天": 0.50 }, "complete": true }
    },
    "scope": ["生抽"]
  },
  "facing_gap": [
    { "sku": "6MX-TJ-380", "actual": 3, "target": 4, "gap": -1 }
  ],
  "price_compliance": [
    { "sku": "6MX-TJ-380", "tag_price": 19.9, "system_price": 18.9, "mismatch": true, "conf": "high" }
  ],
  "visual_oos": [
    { "sku": "6MX-JDX", "evidence": "空位", "conf": "mid" }
  ],
  "display": [
    { "side": "own", "sku": "6MX-TJ-380", "loc": "货架", "note": "上层3排面,低于目标1" },
    { "side": "comp", "sku": "HT-JB-SC", "loc": "端架", "note": "海天金标堆头占端架(占位事实,action 归 L0-05)" }
  ],
  "flags": ["price_mismatch:6MX-TJ-380", "discrepancy_oos:6MX-JDX"],
  "fanout": ["日报:display", "统治力差距:SOV", "统治力差距:排面gap", "统治力差距:价签合规",
             "统治力差距升级:端架(src:L0-02)", "库存对账:visual_oos:6MX-JDX"]
}
```

> 注 1:范例照里加点鲜空位、L0-01 当日快照若标它有货 → `discrepancy_oos`;若 L0-01 也标断货 → 只出 visual_oos 印证信号,不加 discrepancy。
> 注 2(v0.2):照片同时含蚝油排面时,`by_category` 多一个 `蚝油` 池各算各,`scope` 列全;判不出品类的排面只出现在 flags(`category_unresolved:*`),不进任何池。
> 注 3(v0.2):价签 OCR 低置信时该条 `mismatch: null` + `conf: "low"`,flags 带 `price_uncertain:{sku}`,且**不**进"统治力差距:价签合规"扇出。

---

## 7. 扇出规则(Deterministic Fan-out)

写死的 if-then,不靠 AI 临场判断:

| 条件 | 触发下游 | 性质 |
|---|---|---|
| `photo_quality == ok` | L0-03 日报 display 区块 | 数据透传 |
| `sov.by_category` 非空 | L5-01:SOV(分品类) | 分析喂料 |
| `facing_gap` 非空 | L5-01:排面 gap | 分析喂料 |
| `price_compliance` 含 **mismatch==true** | L5-01:价签合规 | 分析喂料;`mismatch:null`(price_uncertain)**不**进此扇出 |
| 端架/堆头被竞品占位 | L5-01 升级标记(**带 src:L0-02**) | 升级;L5-01 侧按"店+日+位置"与 L0-05 同事实归并,**不叠加** |
| `visual_oos` 非空 | L0-01 库存对账 | **对账信号,非断货触发** |

> ❌ 反例 1:visual_oos 直接触发断货预警 → 和 L0-01 抢真相源,可能凭一张角度差的照片误报。
> ❌ 反例 2:看到海天端架堆头就产竞品 action → 和 L0-05 重复上报,L5-01 同一动作算两次。
> ❌ 反例 3(v0.2):price_uncertain 的条目也喂进价签合规 → 假合规风险冤枉门店。

---

## 8. HITL 卡点 —— 本节点【无】

本节点**不执行任何钱 / 权限 / 不可逆动作**,纯视觉采集与量化,没有可卡的执行点,**故无 HITL**。

- 这不是漏写。按《Agent 设计标准 §6》,HITL 卡在"高风险动作执行前";本节点没有这类动作。
- 价签 mismatch、排面不达标等发现只是**事实上报**;若下游据此发起改价/罚则等动作,HITL 卡在那边的执行前。

---

## 9. References

- **自家 SKU 主数据 / 系统价 / 排面目标**:引用《库存上报 Skill》L0-01 §9 同源主数据(经 MCP),排面目标为门店级新增维度;**品类(category)随 SKU 主数据带出,与 L0-05 品类枚举同源(v0.2)**。
- **竞品品牌 / SKU 主数据**:引用《竞品动作上报 Skill》L0-05 §9a/9b(经 MCP)。
- **OWN_BRANDS 自家名单**:与 L0-05 共用同一份,定自家/竞品边界。

### 9c. References — 术语表(默会知识,持续补充)

| 术语 | 含义 | 处理 |
|---|---|---|
| 排面(facing) | 货架上同一 SKU 正面朝外的列数 | 视觉数数单位;1 列 = 1 排面,不论纵深 |
| SOV(Share of Visibility) | 自家排面 ÷ **同品类**总排面 | **分品类、脚本计算**,视觉只供排面数 |
| 品类池 | 同 category 排面的集合 | SOV 的计算范围;判不出品类不入池 |
| 区段(segment) | 货架的一段(左半边/列3-5/端架) | 多照去重键;美顾标注优先,视觉地标兜底 |
| 黄金视线层 | 视线高度层(约 1.4–1.6m) | tier 标注;被竞品占 = 高价值失位 |
| 价签合规 | 价签价 == 系统价 | 只查**自家**;OCR 低置信不硬判;竞品价格归 L0-05 |
| 空位 | 排面位置无货 | visual_oos 证据,非断货判定 |

### 9d. References — 踩坑记录(每次撞墙补一条)

- ❌ 让视觉直接"估个占比" → SOV 忽高忽低不可复现 → ✅ 视觉只数排面,占比交 §10 脚本。
- ❌ 模糊照也硬算 SOV → 污染 L5-01 趋势线 → ✅ Step 0 质量闸门,low 不出量化字段。
- ❌ 视觉空位直接报断货 → 一张角度差的照误触发预警 → ✅ 只出 visual_oos 对账信号,断货判定归 L0-01。
- ❌ 看到海天端架堆头顺手报了竞品 action → 与 L0-05 重复,L5-01 算两次 → ✅ 竞品只进 comp_facings/占位事实,升级标记带 src 供归并。
- ❌ 把"加点鲜"(自家)认成竞品装进 comp_facings → SOV 双向失真 → ✅ OWN_BRANDS 名单强制定边,§10 双向校验。
- ❌(v0.2)一张照含生抽+蚝油+醋,混在一个池里算出"总 SOV 38%" → 数字没有业务意义,L5-01 没法用 → ✅ 分品类各算各,judge 不出品类的隔离不入池。
- ❌(v0.2)同一货架拍两张重叠照,金标生抽 5 排面被算成 10 → SOV 虚增、gap 假达标 → ✅ (sku,tier,segment) 去重;疑似重叠取最大值不求和,宁低估不虚增。
- ❌(v0.2)价签反光 OCR 把 18.9 读成 13.9,直接报 mismatch → 门店被冤枉价签违规 → ✅ OCR conf=low 不硬判,标 price_uncertain 复核,不喂合规扇出。
- _(后续迭代继续往下加)_

---

## 10. Scripts — 确定性校验 + 分品类 SOV 计算(出件前必跑)

```python
TIER_ENUM = {"黄金视线层","上层","下层"}
CONF_ENUM = {"high","mid","low"}
CATEGORY_ENUM = {"生抽","老抽","味极鲜","蚝油","醋","其他"}   # 与 L0-05 同源

def compute_sov(own: list, comp: list) -> dict:
    """v0.2: 分品类 SOV,由脚本算,不让视觉估;不跨品类混算。"""
    pools = {}
    for x in own:
        pools.setdefault(x["category"], {"own": 0, "comp": {}})["own"] += x["facings"]
    for x in comp:
        p = pools.setdefault(x["category"], {"own": 0, "comp": {}})
        p["comp"][x["brand"]] = p["comp"].get(x["brand"], 0) + x["facings"]
    by_category = {}
    for cat, p in pools.items():
        total = p["own"] + sum(p["comp"].values())
        if total == 0:
            continue
        by_category[cat] = {
            "own_pct": round(p["own"]/total, 2),
            "by_brand": {b: round(f/total, 2) for b, f in p["comp"].items()},
            "complete": True,   # 出件方按未归一项情况置 False
        }
    return {"by_category": by_category, "scope": sorted(by_category.keys())}

def validate(out: dict) -> list[str]:
    """返回错误列表;非空则不得出件,转 flags。"""
    errs = []
    # MUST: 质量闸门 —— 全 low 不得带量化字段
    if out.get("photo_quality") == "low":
        if any(out.get(k) for k in ("own_facings","comp_facings","facing_gap","price_compliance")) \
           or (out.get("sov") or {}).get("by_category"):
            errs.append("quant_output_on_low_quality_photo")
        return errs  # low 时只查这一条
    all_facings = out.get("own_facings", []) + out.get("comp_facings", [])
    # MUST: SKU 归一 + 自家/竞品不混(双向)
    for x in out.get("own_facings", []):
        if x["sku"] not in OWN_SKU_MASTER:
            errs.append(f"sku_unresolved_own:{x['sku']}")
    for x in out.get("comp_facings", []):
        if x.get("brand") in OWN_BRANDS:
            errs.append(f"own_brand_in_comp:{x['brand']}")
        if x.get("sku") is not None and x["sku"] not in COMP_SKU_MASTER:
            errs.append(f"sku_unresolved_comp:{x['sku']}")
    for x in out.get("own_facings", []):
        if OWN_SKU_MASTER.get(x["sku"], {}).get("brand") in COMP_BRAND_MASTER:
            errs.append(f"comp_sku_in_own:{x['sku']}")
    # 枚举与数值(v0.2 加 category / segment)
    for x in all_facings:
        if x.get("tier") not in TIER_ENUM:          errs.append(f"bad_tier:{x.get('sku')}")
        if x.get("conf") not in CONF_ENUM:          errs.append(f"bad_conf:{x.get('sku')}")
        if x.get("category") not in CATEGORY_ENUM:  errs.append(f"bad_category:{x.get('sku')}")
        if not x.get("segment"):                    errs.append(f"missing_segment:{x.get('sku')}")
        if not (isinstance(x.get("facings"), int) and x["facings"] > 0):
            errs.append(f"bad_facings:{x.get('sku')}")
    # ---- v0.2: 多照去重 —— 同 (sku, tier, segment) 不得重复出现 ----
    keys = [(x.get("sku"), x.get("tier"), x.get("segment")) for x in all_facings]
    for k in set(keys):
        if keys.count(k) > 1:
            errs.append(f"dup_facing_entry:{k[0]}@{k[2]}")
    # ---- v0.2: SOV 必须等于脚本分品类重算值(防视觉估算/混算) ----
    if out.get("sov") and out["sov"].get("by_category"):
        recomputed = compute_sov(out.get("own_facings", []), out.get("comp_facings", []))
        got = {c: (v["own_pct"], v["by_brand"]) for c, v in out["sov"]["by_category"].items()}
        exp = {c: (v["own_pct"], v["by_brand"]) for c, v in recomputed["by_category"].items()}
        if got != exp and not any(f.startswith("sku_unresolved") or f.startswith("category_unresolved")
                                  for f in out.get("flags", [])):
            errs.append("sov_not_script_computed")
        if out["sov"].get("scope") != recomputed["scope"] and \
           not any(f.startswith("category_unresolved") for f in out.get("flags", [])):
            errs.append("sov_scope_mismatch")
    # ---- v0.2: 价签低置信不得硬判 ----
    for p in out.get("price_compliance", []):
        if p.get("conf") == "low":
            if p.get("mismatch") is not None:
                errs.append(f"hard_verdict_on_low_ocr:{p['sku']}")
            if f"price_uncertain:{p['sku']}" not in out.get("flags", []):
                errs.append(f"low_ocr_without_uncertain_flag:{p['sku']}")
        else:
            # MUST: 价签不合规必须 mismatch + flag 成对
            if p["tag_price"] != p["system_price"]:
                if not p.get("mismatch"):
                    errs.append(f"mismatch_not_marked:{p['sku']}")
                if f"price_mismatch:{p['sku']}" not in out.get("flags", []):
                    errs.append(f"mismatch_without_flag:{p['sku']}")
    # v0.2: price_uncertain 条目不得进价签合规扇出
    uncertain = {f.split(":",1)[1] for f in out.get("flags", []) if f.startswith("price_uncertain:")}
    if uncertain and "统治力差距:价签合规" in out.get("fanout", []):
        certain_mismatch = any(p.get("mismatch") is True for p in out.get("price_compliance", []))
        if not certain_mismatch:
            errs.append("uncertain_price_fed_to_compliance")
    # MUST: 端架/堆头竞品占位必须升级 fanout(带 src)
    comp_special = any(d.get("side")=="comp" and d.get("loc") in ("端架","堆头")
                       for d in out.get("display", []))
    if comp_special and not any(f.startswith("统治力差距升级") and "src:L0-02" in f
                                for f in out.get("fanout", [])):
        errs.append("missing_escalation_src")
    # MUST: visual_oos 必须走对账 fanout,且绝不出现断货预警触发词
    for v in out.get("visual_oos", []):
        if f"库存对账:visual_oos:{v['sku']}" not in out.get("fanout", []):
            errs.append(f"oos_signal_not_sent:{v['sku']}")
    for f in out.get("fanout", []):
        if f.startswith("断货预警") or f.startswith("补货:"):
            errs.append(f"illegal_oos_trigger:{f}")   # 断货判定/触发归 L0-01
    # MUST: 不得产竞品 action(契约级拦截)
    if out.get("competitor"):
        errs.append("competitor_action_block_forbidden")  # 那是 L0-05 的键
    return errs
```

---

## 11. 评测起手式(Eval Starter)

> 离线建设期做。攒 50 张真实货架照(配人工标注的排面/价签真值),跑本 Skill 打分,错误回补 §5 / §9。先放 9 条种子。

**样例格式:**
```json
{ "id": "...", "input": { "photo": "照片内容描述(评测用真值,可多张)", "text": "可选文字", "l0_01": {...} }, "expect": { ... }, "tags": ["场景"] }
```

**种子样例(9 条):**
```json
[
 {"id":"s01",
  "input":{"photo":"六月鲜特级380ml上层3排面;六月鲜轻盐500ml上层2排面;海天金标生抽黄金视线层5排面;加点鲜位置空着;六月鲜特级价签19.9;端架海天金标堆头",
           "text":"酱油主货架","l0_01":{"items":[{"sku":"6MX-JDX","status":"normal"}]}},
  "expect":{"own_facings_total":5,"comp_facings_total":5,
            "sov":{"by_category":{"生抽":{"own_pct":0.50}}},
            "price_compliance":[{"sku":"6MX-TJ-380","mismatch":true}],
            "visual_oos":[{"sku":"6MX-JDX"}],"flags_contains":"discrepancy_oos:6MX-JDX",
            "fanout_contains":["统治力差距升级:端架(src:L0-02)","库存对账:visual_oos:6MX-JDX"],
            "no_competitor_action_block":true},
  "tags":["综合一张照","范例全场景"]},

 {"id":"s02",
  "input":{"photo":"轻盐500位置空着,只剩一瓶样品","l0_01":{"items":[{"sku":"6MX-QY-500","status":"normal"}]}},
  "expect":{"visual_oos":[{"sku":"6MX-QY-500","evidence":"仅余样品"}],
            "flags_contains":"discrepancy_oos:6MX-QY-500",
            "no_oos_alert_trigger":true},
  "tags":["视觉断货对账:只给信号,不触发预警,矛盾标 discrepancy"]},

 {"id":"s03",
  "input":{"photo":"六月鲜轻盐500价签写10.9,系统价12.9"},
  "expect":{"price_compliance":[{"sku":"6MX-QY-500","tag_price":10.9,"system_price":12.9,"mismatch":true}],
            "flags_contains":"price_mismatch:6MX-QY-500"},
  "tags":["价签不合规:必标 mismatch+flag,差额小也不放过"]},

 {"id":"s04",
  "input":{"photo":"六月鲜特级4排面;海天金标4排面;厨邦味极鲜2排面"},
  "expect":{"sov":{"by_category":{"生抽":{"own_pct":0.50,"by_brand":{"海天":0.50}},
                                  "味极鲜":{"own_pct":0.0,"by_brand":{"厨邦":1.0}}}}},
  "tags":["SOV:脚本计算 + 分品类(生抽与味极鲜各算各,不混)"]},

 {"id":"s05",
  "input":{"photo":"照片严重模糊,只能看出是酱油货架"},
  "expect":{"photo_quality":"low","own_facings":[],"sov_by_category_empty":true,
            "flags_contains":"photo_quality_low","request_retake":true},
  "tags":["照片模糊该停:不出量化字段,请重拍"]},

 {"id":"s06",
  "input":{"photo":"海天金标在端架做大堆头,排面8个"},
  "expect":{"comp_facings":[{"brand":"海天","sku":"HT-JB-SC","facings":8}],
            "display":[{"side":"comp","loc":"端架"}],
            "fanout_contains":["统治力差距升级:端架(src:L0-02)"],
            "no_competitor_action_block":true},
  "tags":["竞品只算排面+占位:不产 action 条目,action 归 L0-05"]},

 {"id":"s07",
  "input":{"photo":"同一货架照:六月鲜特级3排面(生抽);海天上等蚝油4排面(蚝油);恒顺香醋3排面(醋,主数据有);李锦记蚝油2排面(蚝油);远处一瓶看不清牌子的酱料1排面"},
  "expect":{"sov":{"by_category":{"生抽":{"own_pct":1.0},
                                  "蚝油":{"own_pct":0.0,"by_brand":{"海天":0.67,"李锦记":0.33}}},
                   "scope_contains":["生抽","蚝油","醋"]},
            "no_cross_category_total":true,
            "flags_contains":"category_unresolved",
            "unresolved_not_in_any_pool":true},
  "tags":["v0.2-①:混品类照→分品类 SOV 各算各;判不出品类→隔离不入池不污染"]},

 {"id":"s08",
  "input":{"photo":["照A(主货架-左,含中部重叠):六月鲜特级3排面上层;海天金标5排面黄金视线层",
                    "照B(主货架-右,含中部重叠):海天金标5排面黄金视线层;六月鲜轻盐2排面上层"],
           "text":"左右各拍一张,中间重了一段"},
  "expect":{"comp_facings":[{"brand":"海天","sku":"HT-JB-SC","facings":5}],
            "own_facings_total":5,
            "facings_not_doubled":true},
  "tags":["v0.2-②:两张重叠照同一 SKU 取一次不翻倍;若区段判不出→取最大值+segment_ambiguous"]},

 {"id":"s09",
  "input":{"photo":"六月鲜特级价签被促销牌挡了半截,OCR 勉强读出像是13.9但很模糊;系统价18.9"},
  "expect":{"price_compliance":[{"sku":"6MX-TJ-380","mismatch":null,"conf":"low"}],
            "flags_contains":"price_uncertain:6MX-TJ-380",
            "no_price_mismatch_flag":true,
            "not_fed_to_compliance_fanout":true},
  "tags":["v0.2-③:OCR 低置信不硬判——不报假合规风险,标复核"]}
]
```

**打分维度(每条 0/1):**
1. SKU 归一正确,自家/竞品不混(双向)
2. 排面计数与 tier 准确(对人工真值)
3. **分品类 SOV 正确**(s04/s07:各品类各算各、scope 全、未归一隔离、等于脚本重算值)
4. **多照合并去重正确**(s08:重叠取一次,不同区段相加,疑似重叠取最大值)
5. 价签合规标记成对(s03)+ **低置信不硬判**(s09:mismatch=null + price_uncertain + 不进合规扇出)
6. visual_oos 只对账不触发(s02,含 discrepancy)
7. 质量闸门生效(s05 不出量化)
8. 竞品零 action 条目 + 升级标记带 src(s01/s06)
9. JSON 过 §10 校验(含 v0.2 新断言)

> 跑完看哪一维最常错 —— 那一维就是下一轮要补的 MUST/术语/踩坑。视觉节点比文字节点更依赖真值标注集,50 张照的人工标注先做;**v0.2 起标注还要带品类与区段两个维度**。

---

## 待填变量(套用时替换)
- `owner` — 本 Skill 负责人/团队
- 排面目标主数据 — 门店级自家 SKU 排面目标(经 MCP,L0-01 主数据的新增维度)
- 系统价主数据 — 自家 SKU 系统价查询(经 MCP)
- `OWN_BRANDS` / 竞品主数据 / category 枚举 — 与 L0-05 共用同源(经 MCP)
- 黄金视线层高度定义 — 按门店货架规格表校准
- segment 界定细则 — 美顾标注规范 + 视觉地标清单(货架列号/邻区品类),真实数据迭代后固化
