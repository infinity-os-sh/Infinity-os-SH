# 字段字典 v1.1 × 四份 SKILL.md 交叉复核报告

> 对照源:`L1-04_coverage_blindspot_v0_2.md` / `L0-04_store_master_v0_2.md` / `L1-03_distribution_sellthrough_v0_3.md` / `FOUNDATION-3_sku_merit_v0_1.md`
> 规则:主数据→SFA真名;节点概念→节点 SKILL.md;真冲突→标出给你拍,不自作主张。
> 仍 scaffold、不上线。

---

## ✅ 已解锁 / 已对齐(无需你拍)

| 项 | 处理 | 依据 |
|---|---|---|
| **盲点表 `*_pending_dict` 全解锁** | `coverage_blindspot.schema.json` 改为 L1-04 §6 真契约:`type`(未铺/数据/白区)、`store_ids`、`count`/`gap_count`、`effective_stage`、`score`/`base_score`/`score_basis`、`trend{cohort_count_prev,now,direction}`、`suggested_action`、`poi_refs`/`stale_refs`、`flags`、`summary_text`。原 `isBlindspot/blindReason` → 解为 `type`+`suggested_action` | L1-04 §3/§6 |
| **`sellthrough_rate`** | 锁定(去掉"推断"):`= moving ÷ pairable_selling`(pool),事实与阶段无关 | L1-03 §C5 实证一致 |
| **`sellthrough_grade`** | 补枚举 `达标/未达标/未判级`;新增 `grading_stage`(判级所用阶段) | L1-03 v0.3 |
| **`unknown` vs `no_data`** | 维持分离,已与下游印证:L1-03 `no_data`双不进、`stage=unknown`不判级 | L1-03 §A3/§C6 |
| **`effective_stage` 归属** | owner=地基①;L1-03/L1-04/地基③只读不重判 | 三份一致 |
| **`lifeforce_grade` 归属** | 确认**只地基③(FOUNDATION-3)产出** ✓,其余节点禁算——与 v1.1 护栏一致 | FOUNDATION-3 §1 |
| **`store_id` 终身不变** | 盲点 `store_ids` 对齐 L0-04 `store_id`(终身不换号) | L0-04 §3 |

## 🔧 已按 spec 修正(低风险,additive;若定稿不同请覆盖)

| 项 | v1.1 原值 | 改为 | 依据 |
|---|---|---|---|
| **`effective_stage` 枚举** | 导入/成长/成熟/衰退(4) | 导入/成长/成熟/衰退/**焕新/淘汰**(6) + unknown 哨兵 | C3 · L1-03/L1-04/F-3 都用到 焕新/淘汰 |

---

## ⚑ 真冲突 —— 需要你拍(我没自作主张)

### C1 · 门店主数据:SFA 真名 vs L0-04 真相源(同义异名)
你的规则是"主数据→SFA真名为准",但 **L0-04 SKILL(门店档案真相源)用的是另一套名**,且**下游 L1-03/L1-04 引用的是 L0-04 名**:

| 含义 | SFA(实现) | L0-04 SKILL(spec真相源·下游在用) |
|---|---|---|
| 门店唯一码 | `storeCode` | `store_id`(ST-SH-00420) |
| 运营分级 | `grade` | `store_grade` |
| 巡店节奏 | `visitCycleT`(列) | `M` 静默天数(按 store_grade 派生,L0-07 按店读) |
| 坐标 | `latitude`/`longitude` | `gps:{lat,lng}` |
| 区域 | `district` | `region`/`city`/`trade_zone`(三级) |
| 店名/店型 | `storeName`/`storeType` | `store_name`/`channel_type` |

**要你拍**:主数据到底以 SFA 还是 L0-04 为准?
- 选 SFA(按你原规则)→ 下游读 L0-04 输出时要加**名字映射层**(因为 L1-03/L1-04 产出用的是 store_id/store_grade)。
- 选 L0-04(真相源 spec)→ 把 MASTER 改成 store_id/store_grade/gps/M…(更贴合下游,但偏离"SFA真名")。

### C2 · 生命力分级:`lifeforce_grade` vs `vitality.level`(同义两名)
归属无争议(只地基③)。但 **FOUNDATION-3 真名是 `vitality.level`**(枚举 **S/A/B/C/D**,且带 `prev_level`/`lift`/`attributed`),不是我 v1.1 里的 `lifeforce_grade`。
**要你拍**:用 `vitality.level`(节点 SKILL,按你的规则节点概念以 SKILL 为准)还是保留 `lifeforce_grade`?（我倾向前者,但你点过 lifeforce_grade,故不擅改。）

### C4 · 架构边界:拜访规划能否直接消费 L1-04?
L1-04 明确:**"只出清单不派任务·开发排期归 BD/城市经理·任务派发归 L5-02·绝不触发 L5-02·不反向指挥采集"**,且是**月度**清单;白区盲点**无 store_id**。
我的拜访规划 scaffold 现在把 blindspot 当**日清救火池**(Set<storeCode>)——这可能**越过 L1-04 的边界**(等于拿月度开发清单去派日拜访)。
**要你拍**:blindspot → 日拜访,是否必须**经 L5-02**中转?还是拜访规划只吃"逾期/常规"(visit_history),盲点开发另走 BD 线?（牵涉拜访规划救火池的数据来源,定了我再调引擎。）

---

## 旁注
- `bas_visit_planning_skill_v0_1.md`(98分定稿)仍未在这批文档里;C4 的最终答案可能就在它里面。
- 这些改动只动 `infinity-cloudbase/` 下 scaffold + 字典;线上文件零触碰。

---

# 裁定结果(2026-06-20 · 用户拍板 C1–C4)

## C1 — 门店主数据以 L0-04 为准(不是 SFA)
理由:新后端 = CloudBase greenfield,下游节点都用 L0-04 名;SFA 名只在导数据边界映射一次。

### MASTER.store 改后字段表(`field-dictionary.js` MASTER.store)
| 含义 | 标准名(L0-04) | 备注 |
|---|---|---|
| 门店唯一码 | `store_id` | 终身不变(ST-SH-00420),版本变更不换号 |
| 店名 | `store_name` | |
| 店型/渠道 | `channel_type` | |
| 运营分级 | `store_grade` | A/B/C(≠ strategic_tier) |
| 巡店节奏 | `M` | 静默天数,按 store_grade 派生,L0-07 按店读 |
| 区域三级 | `region` / `city` / `trade_zone` | |
| 地址/坐标 | `address` / `gps:{lat,lng}` | 嵌套 |
| 客流档 | `traffic_tier` | high/mid/low |
| 状态 | `status` | active/suspended/closed… |
| SCD-2 | `effective_from` / `effective_to` / `version` | 版本化 |

### SFA → L0-04 映射表(`MASTER_MAP_SFA`,仅 ETL 入口用一次)
| SFA(实现) | → 标准名(L0-04) |
|---|---|
| `storeCode` | `store_id` |
| `storeName` | `store_name` |
| `storeType` | `channel_type` |
| `grade` | `store_grade` |
| `visitCycleT` | `M` |
| `latitude` | `gps.lat` |
| `longitude` | `gps.lng` |
| `district` | `region`(SFA 单级 → L0-04 三级,导入时补 city/trade_zone) |
| `gpsRadiusM` | (无直接对应·建档地理容差另算) |

> 组织主数据(user)/拜访历史(visit)真相源 doc 未入库,暂留 SFA 名 + `_pending` 标记,等其 SKILL 入库再对齐。

## C2 — 生命力用 `vitality.level`(弃 `lifeforce_grade`)
`CONCEPTS.vitality = {level: S/A/B/C/D, prev_level, lift, attributed}`,owner=地基③,护栏:只地基③可产出。`lifeforce_grade` 已删除。

## C3 — `effective_stage` 六阶段保留
`导入/成长/成熟/衰退/焕新/淘汰` + `unknown`(哨兵,不入枚举,不判级)。

## C4 — 盲点按有无 store_id 切入救火池
- **有 store_id(未铺/数据)→ 进拜访规划救火池**;**白区(store_ids=null)→ 不进,走 L5-02/经理**。
- 引擎调整点:
  1. 新增 `VisitDict.fireStoreSetFromBlindspots(L1-04输出)` → 遍历 blindspots,`type==='白区'` 跳过,只收 `store_ids` 进 `Set<store_id>`。
  2. `planForPerson(person, candidates, blindspotSet, today)` 的 `blindspotSet` 现约定由上述 helper 构造(只含有 store_id 的盲点)。
  3. 文档/契约注明 L1-04 边界:拜访规划不消费白区;白区开发归 BD/L5-02。
- 冒烟验证:L1-04 含白区时,`fireStoreSetFromBlindspots` 只返回 `ST-SH-00301/ST-SH-00415`,白区被排除。

---

# 裁定结果(2026-06-21 · 用户拍板 C5)

## C5 — SKU 状态分级用 `sku_state_level`(弃 SKILL §3 原名 `vitality_level`)
- **冲突**:SKU Scorecard(SKILL §3)输出 `vitality_level`(本表 L1–L5,状态分 §2.4 映射),与 C2 的 `vitality.level`(S/A/B/C/D,门店生命力·地基③产)**同名不同义同"级别"**,极易混。
- **裁定**:SKU Scorecard 的 L1–L5 单列名 **`sku_state_level`**,弃用 `vitality_level`。
- 落地点:
  1. `field-dictionary.js` `CONCEPTS.sku_state_level`(enum L1–L5,owner=SKU Scorecard,带 guard:⚠ ≠ vitality.level)。
  2. `CONFLICTS` 加 `C5-sku-state-level-naming`(RESOLVED);`VERSION` → C1–C5。
  3. `infinity-cloudbase/sku-scorecard/sku_scorecard.js` 输出字段改名 `sku_state_level`;bridge / 14 Redline 同步改,全过。
- 边界:`SKILL_SKU_Scorecard.md`(规格只读)原文仍写 `vitality_level`,**以字典 C5 为准**(字段字典 v1.1 = 单一真相源)。
