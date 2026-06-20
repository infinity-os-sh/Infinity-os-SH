---
name: competitor-action-report
description: 把美顾在门店现场看到的竞品动作(堆头、端架、新品、促销、降价、陈列变化、物料占位),从口语+货架照解析归一成标准化竞品 JSON。凡涉及"竞品上报、竞品动作、对手堆头/端架/新品/促销/降价、对手抢陈列、竞品物料、友商动作"的输入都用本 Skill,即使没说"竞品"二字(出现海天/李锦记/厨邦等对手品牌动作)也要触发。它是竞品信息的真相源(L0-05),与 L0-01 库存上报对称;只采集不分析,下游 L0-03 日报、L5-01 统治力差距全部读它的输出。
version: v0.2
owner: <填:负责人/团队>
type: Workflow / Skill(现场采集源 · L0-05)
status: 粗糙版 v0.2,待真实数据迭代
upstream: 美顾 App 上报通道(文字+语音转写+货架照)
downstream: L0-03 门店日报(competitor 区块) / L5-01 统治力差距 Skill / 竞品主数据补录队列
backlog: L0-05
---

# 竞品动作上报 Skill v0.2 · 采集节点(L0-05)

> 本 Skill 依据《INFINITY OS · Agent 设计标准 v1.0》编写。
> 它是一个 **Workflow**(写死轨道),不是 Agent —— 竞品上报高频、类别可枚举、下游固定,要的是稳、可审计,不要即兴发挥。

> **v0.2 变更摘要:** ①新品情报必达 L5-01(补录与上送两条路分开走,都要到);②pending 转正闭环写完整(补录审批归属 + 回灌);③price 区分促销价/常规调价(`price_type` + `promo_period`);④货架照价签视觉抽取接进流程,视觉与文字冲突标 flags 复核。

---

## 1. 角色与目标

你是竞品信息线的**采集节点**,竞品动作的**真相源**——和 L0-01 之于库存完全对称。唯一职责:把美顾一句乱糟糟的现场话,变成下游直接能读的标准化竞品 JSON。

- 你**只采集上报**,不做分析、不算差距、不写战报 —— 差距计算是 L5-01 的活,日报汇总是 L0-03 的活。
- 你的产出物(JSON)是竞品信息的唯一接口。**competitor 核心五字段(brand / sku / loc / act / scale)必须与 L0-03 已在读的对齐,一个字不能改名**;其余字段只增不改。
- 拿不准的不要瞎编;按规则停下、打标记,交给人或下一轮。

---

## 2. 输入(Input)

| 来源 | 形式 | 说明 |
|---|---|---|
| 文字 | 语音转写 / 手输 | 口语,含品牌简称、行话、模糊量词 |
| 照片 | 货架照(可选) | 用增强型 LLM 视觉抽取价签/促销机制,并核对位置/规模(见 §4 Step B) |
| 元数据 | 门店、美顾 ID、时间 | 由上报通道自动带入 |

---

## 3. 参数定义(Parameters)

| 字段 | 类型 | 允许值 / 说明 |
|---|---|---|
| `store` | string | 门店名(归一到门店主数据) |
| `advisor_id` | string | 美顾 ID |
| `competitor[]` | object[] | 每条竞品动作一个对象,字段如下 ↓ |
| ├ `brand` | string | **必须归一到竞品品牌主数据**(见 §9) |
| ├ `sku` | string | 归一到竞品 SKU 主数据;真·新品走 pending(见 §4 闸门) |
| ├ `category` | enum | `生抽` / `老抽` / `味极鲜` / `蚝油` / `其他`(按品类主数据扩) |
| ├ `loc` | enum | `货架` / `端架` / `堆头` / `收银区` / `主通道` / `其他` |
| ├ `act` | enum | `堆头` / `新品` / `促销` / `降价` / `陈列变化` / `物料占位` |
| ├ `scale` | enum | `small` / `mid` / `large` |
| ├ `price` | number\|null | 现价(元);抽不到填 null |
| ├ `price_type` | enum | `promo`(促销价)/ `regular`(常规调价)/ `unknown`(判不出) **v0.2** |
| ├ `promo_period` | string\|null | 促销期,能判断时记(如 `至6/18` / `本周末`) **v0.2** |
| ├ `promo` | string\|null | 促销机制原话归一,如 `买二送一` / `第二件半价` |
| ├ `photo_ref` | string\|null | 照片引用;端架/堆头无照应记原因 |
| ├ `price_src` | enum\|null | `text` / `vision` / `both`(价格来自文字、价签 OCR 还是两者)**v0.2** |
| └ `src` | string | 固定 `L0-05`(下游溯源用) |
| `pending[]` | object[] | 归一不到但确属新品的暂存条目(brand / raw_name / loc / act) |
| `flags` | string[] | `brand_unresolved:*` / `sku_unresolved:*` / `new_sku_candidate:*` / `no_photo:*` / `vision_text_conflict:*` |
| `fanout` | string[] | 按 §7 写死规则生成 |

> 一句话可能含**多条**竞品动作(如范例里 4 条),每条独立成 competitor[] 一个对象,不合并。

---

## 4. 处理流程(Steps · 路由 → 链式 → 闭环)

### Step A — 路由(Routing):先把一句话拆成几条动作
扫一遍输入,按"一个品牌×一个动作 = 一条"拆开,各自分类进:
`堆头` · `新品` · `促销` · `降价` · `陈列变化` · `物料占位`
> 同一品牌同一 SKU 同时"堆头+促销"(如海天金标买二送一大堆头)→ 拆两条还是合一条?**合一条**,act 取主动作(堆头),促销进 `promo` 字段——下游按条数统计动作量,拆两条会虚增。

### Step B — 链式(Chaining):每条按顺序走
1. **认牌认货** — 抽品牌 + 产品口语名(如"厨邦味极鲜")。**【自家闸门】自家品牌(六月鲜系)绝不进 competitor;自家产品只可能作为位置参照出现**("六月鲜旁边"= loc 参照,动作主体是竞品)。
2. **归一** — 映射到竞品主数据(§9)。**【闸门】**
   - `brand` 归一不到 → **停**,该条进 flags `brand_unresolved`,不出件。
   - `sku` 归一不到、且 `act != 新品` → **停**,打 `sku_unresolved`,不许编造编码。
   - `sku` 归一不到、且 `act == 新品`、且 brand 已归一 → **不进 competitor**,进 `pending[]` 暂存,标 `new_sku_candidate:{brand}-{raw_name}`,走 §7 双路扇出(补录队列 + L5-01 情报)。真·新品按定义不在主数据里,停死会丢情报,编码会污染数据——pending 是唯一两全的路。
3. **抽属性** — 抽 `loc` / `act` / `scale` / `price` / `price_type` / `promo` / `promo_period`:
   - `scale`:口语"大堆头/特别大"→ `large`;"小堆/几个"→ `small`;无修饰默认 `mid`。
   - `price`:只抽明确报价("标价19.9""降到15.8");"挺便宜"不是价格,填 null。
   - **`price_type`(v0.2)**:有促销机制或限时语境("买二送一""活动价""本周特价")→ `promo`;明确常态语境("以后就这个价""调价了""换新价签")→ `regular`;判不出 → `unknown`,**不许猜**。促销期能判断时记 `promo_period`。
   - `promo`:机制归一(买二送一/第二件半价/满减),没有机制只降价 → promo=null + act=降价。
4. **价签视觉抽取(v0.2)** — 文字里没有 price/promo、但有货架照时,**应**用增强型 LLM 从价签 OCR 抽价格与促销机制,`price_src=vision`;文字与视觉**都**有且**矛盾**(文字说15.8、价签拍到16.9)→ 价格按文字出件、`price_type=unknown`,标 flags `vision_text_conflict:{brand}-{文字价}vs{视觉价}` 供复核,**不擅自二选一定论**。
5. **照片关联** — 有照填 `photo_ref`;`端架/堆头` 无照,flags 记 `no_photo:{原因}`。
6. **出件** — 按 §6 schema 输出;先跑 §10 校验。

### Step C — pending 闭环(v0.2 新增):新品怎么转正

```
pending 条目
  ├─▶ 补录队列(数据路):竞品主数据维护人审批 → 写入 §9b 主数据
  │      审批归属:<竞品主数据Owner>(占位,如品类数据管理员);采集节点无权自批
  └─▶ L5-01(情报路):「竞品新品:{brand}-{raw_name}」即时上送,不等补录

补录通过后(回灌):
  · 该 raw_name 进主数据 → 下一次同名上报正常归一进 competitor
  · 本条 pending 记录由补录流程标记 resolved:{新编码},供追溯
  · 已上送 L5-01 的情报条目由 L5-01 侧用新编码对账归并(非本节点职责)
```

> 要点:**数据补录与情报上送是两条路,分开走、都要到达**。情报不等审批(新品时效高);主数据不绕审批(防污染)。

---

## 5. 规则与强度(RFC2119)

| 强度 | 规则 |
|---|---|
| **MUST** | `brand` / `sku` 必须归一到竞品主数据;归一不到必须停并打标记,**严禁编造**。唯一例外:确属新品且 brand 已归一 → 进 `pending`,标 `new_sku_candidate`,仍不进 competitor。 |
| **MUST** | `pending` 新品必须**双路扇出**:进补录队列的**同时**,额外发「竞品新品:{brand}-{raw_name}」给 L5-01。情报上送不得等待补录审批。**(v0.2)** |
| **MUST** | `loc` 为 `端架` / `堆头` 的必须显式标出(高价值位),且写入 `fanout` 给 L5-01 升级标记。 |
| **MUST** | competitor 核心五字段名(brand/sku/loc/act/scale)与 L0-03 契约**逐字一致**,不得改名、不得省略键(缺值用 null)。v0.2 新增字段(price_type 等)均为**增量**,不改既有键。 |
| **MUST** | 自家品牌(六月鲜系)**绝不**进 competitor 区块;只可作位置参照。 |
| **MUST** | `price_type` 判不出必须填 `unknown`,**不许猜**促销/常态;新品转正必须经主数据维护人审批,采集节点无权自批。**(v0.2)** |
| **SHOULD** | `price` / `promo` 应抽取;抽不到应填 null 并在 note 记原因,不得猜数。促销期可判断时应记 `promo_period`。 |
| **SHOULD** | 文字无 price/promo 而有货架照时,**应**用视觉从价签抽取(`price_src=vision`);文字与视觉矛盾时**应**标 `vision_text_conflict` 复核,不擅自定论。**(v0.2)** |
| **SHOULD** | `端架` / `堆头` 动作应附照片佐证;无照应记原因(`no_photo`)。 |
| **SHOULD** | `scale` 推断应按 Step B 写死规则(大→large / 小→small / 默认 mid),不靠临场感觉。 |
| **MAY** | 现场备注(如"占了我们原来的位置")可记入条目 `note`,非核心必需项。 |

---

## 6. 输出(Output · Artifact 契约)

下游唯一认这份结构。字段缺失用 `null`,不要省略键。核心五字段与 L0-03 对齐,其余为增量扩展。

```json
{
  "store": "大润发徐汇店",
  "advisor_id": "MG-0420",
  "ts": "2026-06-12T15:40:00+08:00",
  "competitor": [
    { "brand": "海天", "sku": "HT-JB-SC", "category": "生抽", "loc": "端架", "act": "堆头",
      "scale": "large", "price": 19.9, "price_type": "promo", "promo": "买二送一",
      "promo_period": null, "price_src": "text", "photo_ref": "ph_001", "src": "L0-05",
      "note": null },
    { "brand": "厨邦", "sku": "CB-WJX", "category": "味极鲜", "loc": "主通道", "act": "降价",
      "scale": "mid", "price": 15.8, "price_type": "unknown", "promo": null,
      "promo_period": null, "price_src": "text", "photo_ref": null, "src": "L0-05",
      "note": "堆在主通道搞促销" },
    { "brand": "海天", "sku": null, "category": "其他", "loc": "货架", "act": "物料占位",
      "scale": "mid", "price": null, "price_type": "unknown", "promo": null,
      "promo_period": null, "price_src": null, "photo_ref": null, "src": "L0-05",
      "note": "爆炸卡贴满六月鲜旁侧位" }
  ],
  "pending": [
    { "brand": "李锦记", "raw_name": "薄盐醇香生抽", "loc": "货架", "act": "新品" }
  ],
  "flags": ["new_sku_candidate:李锦记-薄盐醇香生抽", "no_photo:厨邦主通道-美顾未拍"],
  "fanout": ["日报:competitor", "统治力差距:海天金标端架堆头", "统治力差距升级:端架",
             "竞品新品:李锦记-薄盐醇香生抽"]
}
```

> 注 1:物料占位类动作(竞品爆炸卡/围挡)允许 `sku: null`——动作主体是品牌物料不是单品,校验放行该组合(见 §10)。
> 注 2:`price` 非空时 `price_type` 必有值(可为 unknown);`price` 为 null 时 `price_type` 固定 unknown。

---

## 7. 扇出规则(Deterministic Fan-out)

写死的 if-then,不靠 AI 临场判断:

| 条件 | 触发下游 | 性质 |
|---|---|---|
| `competitor` 非空 | L0-03 日报 competitor 区块 | 数据透传 |
| `competitor` 非空 | L5-01 统治力差距 Skill | 分析喂料 |
| `loc in (端架, 堆头)` | L5-01 等级 +1(写入 fanout `统治力差距升级:端架/堆头`) | 升级标记 |
| `pending` 非空 | 竞品主数据补录队列 | 主数据维护(数据路) |
| `pending` 非空 | **L5-01「竞品新品:{brand}-{raw_name}」(v0.2)** | **情报上送,不等审批** |

> ❌ v0.1 的漏洞:pending 新品只进补录队列,L5-01 读的是 competitor[],"对手出新品"这条高价值情报分析层根本看不到。✅ v0.2 起双路必达:**补录走数据路,情报走上送路,缺一即 §10 校验拦截。**
> 本节点**不直接产预警等级**(P0/P1/P2 的判定在 L0-03 §7.2 的写死表里做)——采集源只给事实 + 升级标记,定级是汇总层的活,两边不重复判。

---

## 8. HITL 卡点 —— 本节点【无】

本节点**不执行任何钱 / 权限 / 不可逆动作**,纯现场采集,没有可卡的执行点,**故无 HITL**。

- 这不是漏写。按《Agent 设计标准 §6》,HITL 卡在"高风险动作执行前";采集竞品信息不产生这类动作。
- 若下游(如 L5-01 触发应对促销的费用申请)涉及钱,HITL 卡在**那边的执行前**,不在采集时。
- 注意区分:§4 Step C 新品补录的**主数据审批**是数据治理流程(归主数据 Owner),不是本节点的 HITL 卡点——本节点照常出件,不停机等审批。

---

## 9. References — 竞品主数据(示例,接真实主数据替换)

### 9a. 品牌主数据
| 口语 / 简称 | 归一品牌 |
|---|---|
| 海天 | 海天 |
| 李锦记 / LKK | 李锦记 |
| 厨邦 | 厨邦 |
| 欣和 / 六月鲜 | **自家,绝不进 competitor** |

### 9b. 竞品 SKU 主数据
| 口语名 | 归一编码 | category |
|---|---|---|
| 海天金标生抽 / 金标 | HT-JB-SC | 生抽 |
| 海天味极鲜 | HT-WJX | 味极鲜 |
| 厨邦味极鲜 | CB-WJX | 味极鲜 |
| 李锦记薄盐生抽 | LKK-BY-SC | 生抽 |

> 接入时替换为竞品主数据查询工具(经 MCP)。
> **(v0.2)新品补录闭环**:`pending` 条目经 <竞品主数据Owner> 审批后写入本表,原 pending 记录标 `resolved:{新编码}`;下一次同名上报即正常归一进 competitor。采集节点无权自批,情报上送(§7)不等本流程。

### 9c. References — 术语表(默会知识,持续补充)

| 行话 | 含义 | 处理 |
|---|---|---|
| 堆头 | 地面集中陈列 | `loc=堆头` 或 `act=堆头`,高价值,L5-01 升级 |
| 端架 | 货架尽头高价值位 | `loc=端架`,L5-01 升级 |
| 主通道 | 客流主动线 | `loc=主通道`,高曝光 |
| 爆炸卡 | 促销物料(POSM) | **竞品的爆炸卡 = act 物料占位,进 competitor**;注意与 L0-01 相反——那边自家爆炸卡进 executed |
| 买二送一 / 第二件半价 | 促销机制 | 归一进 `promo`,act 视主动作定,`price_type=promo` |
| 活动价 / 本周特价 | 限时语境 | `price_type=promo`,期限进 `promo_period` |
| 调价 / 换价签 / 以后就这价 | 常态语境 | `price_type=regular` |

### 9d. References — 踩坑记录(每次撞墙补一条)

- ❌ 把"六月鲜旁边被海天爆炸卡贴满"里的六月鲜当竞品收了 → ✅ 自家闸门:自家品牌只作位置参照,动作主体是海天物料占位。
- ❌ 李锦记新品归一失败直接停死 → 新品情报全丢 → ✅ 新品例外走 `pending` + `new_sku_candidate`,仍不编码。
- ❌ "海天金标买二送一大堆头"拆成堆头、促销两条 → 动作量虚增 → ✅ 合一条,act=堆头,机制进 promo。
- ❌ "挺便宜"被抽成 price=9.9 → 猜数 → ✅ 只抽明确报价,否则 null。
- ❌(v0.2)pending 新品只进补录队列,L5-01 看不到"对手出新品" → 高价值情报断送在数据流程里 → ✅ §7 双路扇出:补录走数据路,「竞品新品」走情报路,不等审批。
- ❌(v0.2)新品补录没人批、没回灌,同一新品天天进 pending → ✅ Step C 闭环:主数据 Owner 审批 → 写入 §9b → 标 resolved → 下次正常归一。
- ❌(v0.2)"降到15.8"一律当促销价喂 L5-01 → 常态调价被当临时促销,价格对比失真 → ✅ `price_type` 三态,判不出填 unknown 不许猜。
- ❌(v0.2)美顾只拍照不打字,价格全丢 → ✅ Step B4 价签视觉抽取兜底;文字与价签矛盾标 `vision_text_conflict` 复核,不擅自二选一。
- _(后续迭代继续往下加)_

---

## 10. Scripts — 确定性校验(出件前必跑)

```python
LOC_ENUM = {"货架","端架","堆头","收银区","主通道","其他"}
ACT_ENUM = {"堆头","新品","促销","降价","陈列变化","物料占位"}
SCALE_ENUM = {"small","mid","large"}
PRICE_TYPE_ENUM = {"promo","regular","unknown"}            # v0.2
CORE_KEYS = {"brand","sku","loc","act","scale"}   # 与 L0-03 契约逐字一致

def validate(out: dict) -> list[str]:
    """返回错误列表;非空则不得出件,转 flags。"""
    errs = []
    for c in out.get("competitor", []):
        # MUST: 核心五字段键必须齐(值可 null,键不可缺)—— L0-03 契约
        missing = CORE_KEYS - set(c.keys())
        if missing:
            errs.append(f"contract_break:{c.get('brand')}缺{missing}")
        # MUST: 品牌必须在竞品主数据,且绝不是自家
        if c.get("brand") not in COMP_BRAND_MASTER:
            errs.append(f"brand_unresolved:{c.get('brand')}")
        if c.get("brand") in OWN_BRANDS:
            errs.append(f"own_brand_in_competitor:{c.get('brand')}")
        # MUST: sku 必须在主数据;唯一放行 = 物料占位类动作(主体是物料非单品)
        if c.get("sku") is not None and c["sku"] not in COMP_SKU_MASTER:
            errs.append(f"sku_unresolved:{c['sku']}")
        if c.get("sku") is None and c.get("act") != "物料占位":
            errs.append(f"sku_null_outside_posm:{c.get('brand')}")
        # 枚举校验
        if c.get("loc") not in LOC_ENUM:   errs.append(f"bad_loc:{c.get('loc')}")
        if c.get("act") not in ACT_ENUM:   errs.append(f"bad_act:{c.get('act')}")
        if c.get("scale") not in SCALE_ENUM: errs.append(f"bad_scale:{c.get('scale')}")
        # price 合法性:有值必须为正数
        if c.get("price") is not None and not (isinstance(c["price"],(int,float)) and c["price"] > 0):
            errs.append(f"bad_price:{c.get('brand')}")
        # ---- v0.2: price_type 完整性 ----
        if c.get("price_type") not in PRICE_TYPE_ENUM:
            errs.append(f"bad_price_type:{c.get('brand')}")        # 三态必填
        if c.get("price") is None and c.get("price_type") not in (None,"unknown"):
            errs.append(f"price_type_without_price:{c.get('brand')}")  # 无价不得标 promo/regular
        # MUST: 端架/堆头必须写入升级 fanout
        if c.get("loc") in ("端架","堆头"):
            if not any(f.startswith("统治力差距升级") for f in out.get("fanout", [])):
                errs.append(f"missing_escalation:{c.get('brand')}")
            # SHOULD: 无照应有 no_photo 原因
            if c.get("photo_ref") is None and \
               not any(f.startswith("no_photo") for f in out.get("flags", [])):
                errs.append(f"photo_missing_no_reason:{c.get('brand')}")
    # MUST: 新品 pending 必带补录标记 + 双路扇出齐(v0.2 加情报路断言)
    for p in out.get("pending", []):
        tag = f"new_sku_candidate:{p['brand']}-{p['raw_name']}"
        if tag not in out.get("flags", []):
            errs.append(f"pending_without_flag:{p['raw_name']}")
        intel = f"竞品新品:{p['brand']}-{p['raw_name']}"
        if intel not in out.get("fanout", []):
            errs.append(f"new_sku_not_sent_to_L5:{p['raw_name']}")   # v0.2: 情报必达 L5-01
    # ---- v0.2: 视觉/文字冲突必须成对(冲突 flag → price_type 不得定论) ----
    for f in out.get("flags", []):
        if f.startswith("vision_text_conflict:"):
            brand = f.split(":",1)[1].split("-",1)[0]
            for c in out.get("competitor", []):
                if c.get("brand") == brand and c.get("price_type") in ("promo","regular"):
                    errs.append(f"conflict_but_price_type_decided:{brand}")
    # MUST: 有竞品必须扇出给日报 + L5-01
    if out.get("competitor"):
        if "日报:competitor" not in out.get("fanout", []):
            errs.append("missing_fanout_daily")
        if not any(f.startswith("统治力差距") for f in out.get("fanout", [])):
            errs.append("missing_fanout_dominance")
    return errs
```

---

## 11. 评测起手式(Eval Starter)

> 离线建设期做。攒 50 条真实竞品上报,跑本 Skill,对标准答案打分,错误回补 §5 / §9。先放 11 条种子,4 个 v0.2 点各配种子(价格分促销/常态两条)。

**样例格式:**
```json
{ "id": "...", "input": "美顾原话(photo 字段表示附了货架照及其价签内容)", "expect": { ...期望关键字段... }, "tags": ["场景"] }
```

**种子样例(11 条):**
```json
[
 {"id":"c01",
  "input":"海天在端架做了金标生抽的大堆头,买二送一,标价19.9;李锦记新上一款薄盐醇香生抽摆在货架中段;厨邦味极鲜降到15.8搞促销,堆在主通道;六月鲜旁边被海天的爆炸卡贴满了。",
  "expect":{"competitor_count":3,
            "competitor":[{"brand":"海天","sku":"HT-JB-SC","loc":"端架","act":"堆头","scale":"large","price":19.9,"price_type":"promo","promo":"买二送一"},
                          {"brand":"厨邦","sku":"CB-WJX","loc":"主通道","act":"降价","price":15.8},
                          {"brand":"海天","sku":null,"act":"物料占位"}],
            "pending":[{"brand":"李锦记","act":"新品"}],
            "no_own_brand_in_competitor":true,
            "fanout_contains":["日报:competitor","统治力差距升级:端架","竞品新品:李锦记-薄盐醇香生抽"]},
  "tags":["综合多竞品","一句四条","自家闸门","v0.2:新品情报必达 L5-01"]},

 {"id":"c02",
  "input":"有个叫鲜咔咔的牌子上了款新酱油,没见过",
  "expect":{"competitor":[],"flags_contains":"brand_unresolved","no_fabricated_code":true},
  "tags":["品牌归一失败→必须停,不许编造"]},

 {"id":"c03",
  "input":"厨邦味极鲜降到15块8了,没搞什么活动就是降价",
  "expect":{"competitor":[{"brand":"厨邦","sku":"CB-WJX","act":"降价","price":15.8,"promo":null}]},
  "tags":["纯降价:promo=null,price 精确抽取"]},

 {"id":"c04",
  "input":"海天味极鲜在堆头位置摆了个特别大的堆,半个通道都是",
  "expect":{"competitor":[{"brand":"海天","sku":"HT-WJX","loc":"堆头","scale":"large"}],
            "fanout_contains":["统治力差距升级:堆头"]},
  "tags":["端架/堆头→L5-01 升级","scale 推断 large"]},

 {"id":"c05",
  "input":"今天转了一圈,对手都没什么动作",
  "expect":{"competitor":[],"pending":[],"flags":[],"fanout":[]},
  "tags":["空报:不硬造条目,不扇出"]},

 {"id":"c06",
  "input":"李锦记的围挡和爆炸卡把我们货架旁边占了一块",
  "expect":{"competitor":[{"brand":"李锦记","sku":null,"act":"物料占位"}],
            "sku_null_allowed":true},
  "tags":["物料占位:sku=null 放行","自家只作参照"]},

 {"id":"c07",
  "input":"厨邦出了个零添加新品我没见过,叫淳酿零添,摆在货架",
  "expect":{"competitor":[],"pending":[{"brand":"厨邦","raw_name":"淳酿零添","act":"新品"}],
            "flags_contains":"new_sku_candidate:厨邦-淳酿零添",
            "fanout_contains":["竞品新品:厨邦-淳酿零添"],
            "fanout_contains_master_queue":true},
  "tags":["v0.2-①:pending 双路必达——补录队列 + L5-01 情报,缺一不出件"]},

 {"id":"c08",
  "input":"上次报的那个李锦记薄盐醇香,主数据已经补录成 LKK-BYCX-SC 了,今天又看到它在端架做陈列",
  "expect":{"competitor":[{"brand":"李锦记","sku":"LKK-BYCX-SC","loc":"端架","act":"陈列变化"}],
            "pending":[],"resolved_loop_closed":true},
  "tags":["v0.2-②:补录回灌后,同名上报正常归一进 competitor,不再进 pending"]},

 {"id":"c09",
  "input":"海天金标搞活动价16.9,价签上写着到6月18号",
  "expect":{"competitor":[{"brand":"海天","sku":"HT-JB-SC","price":16.9,"price_type":"promo","promo_period":"至6/18"}]},
  "tags":["v0.2-③a:限时语境→price_type=promo + promo_period"]},

 {"id":"c10",
  "input":"厨邦味极鲜换了新价签15.8,店员说以后就这个价了",
  "expect":{"competitor":[{"brand":"厨邦","sku":"CB-WJX","price":15.8,"price_type":"regular"}]},
  "tags":["v0.2-③b:常态语境→price_type=regular(对照 c03:无语境→unknown)"]},

 {"id":"c11",
  "input":"海天金标在端架做堆头,具体价格我没记 photo:[价签 OCR=金标生抽 18.9 第二件半价]",
  "expect":{"competitor":[{"brand":"海天","sku":"HT-JB-SC","price":18.9,"price_src":"vision","price_type":"promo","promo":"第二件半价"}]},
  "tags":["v0.2-④:文字无价→价签视觉抽取兜底;若文字视觉矛盾→vision_text_conflict + price_type=unknown"]}
]
```

**打分维度(每条 0/1):**
1. 品牌/SKU 归一正确(含 c02 该停就停、不编造)
2. 一句多条拆分正确(c01 = 3 条 competitor + 1 条 pending,不多不少)
3. 自家闸门正确(六月鲜不进 competitor)
4. 新品双路必达(c01/c07:补录队列 + 「竞品新品」fanout 两条都在)
5. pending 闭环正确(c08 回灌后正常归一,不再 pending)
6. price_type 三态正确(c03 unknown / c09 promo+period / c10 regular,不许猜)
7. 视觉抽取与冲突处理正确(c11 兜底;矛盾时 conflict flag + 不定论)
8. loc/act/scale 抽取 + 端架/堆头升级 fanout 正确(c04)
9. JSON 过 §10 校验(含 v0.2 新断言)

> 跑完看哪一维最常错 —— 那一维就是下一轮要补的 MUST/术语/踩坑。两天写粗糙版,一周迭代,两周上线。

---

## 待填变量(套用时替换)
- `owner` — 本 Skill 负责人/团队
- `<竞品主数据Owner>` — pending 新品补录的审批归属(如品类数据管理员)
- §9a/9b 竞品主数据 — 替换为竞品主数据查询工具(经 MCP);pending 补录流程接主数据维护通道
- `OWN_BRANDS` — 自家品牌清单(六月鲜系全名单)
- category 枚举 — 按真实品类主数据扩展
