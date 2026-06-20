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
