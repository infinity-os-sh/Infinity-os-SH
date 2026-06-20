# INFINITY OS · 拜访规划/路线编排 节点 (SCAFFOLD · 未上线)

> 生成"每人每日拜访清单+路线"。是 DSR/美顾/督导 app **XM(今日任务)** 的数据源，也是 **XD 系统性采集的指挥棒**（它排谁去哪，XD 在拜访时采状态）。
> **只排程**：不采集(XD)、不判级(L1-03)、不算战功。

## 字段字典 v1.1（运行时准）
命名以 `../field-dictionary.js`（字段字典 v1.1，C1–C4 已裁）为单一真相源：
- **门店主数据 = L0-04 真相源名**（C1）：`store_id/store_name/store_grade/M/region/gps{lat,lng}`，不用 SFA 名（SFA 名只在导数据边界经 `MASTER_MAP_SFA` 映射一次）。组织/拜访主数据真相源未入库，暂留待对齐。
- **节点新概念 = 设计名**（snake_case）：`plan_date/reason_code/cycle_t/days_since_last…`；跨域锁定概念直接用字典名 `ts/source_ref/human_override/effective_stage/oos_flag/no_data/vitality…`。

`*_pending_dict` 已按 v1.1 + C1–C4 裁定解析:盲点表改用 L1-04 真契约(type/store_ids/score/trend/suggested_action…),门店主数据改用 L0-04 名(store_id/store_grade/M/gps)。**仅 `org_capacity`(产能 capacityDaily/home)保留 pending**——真相源未入库、表未建。

## ⚠ 仍缺：98 分定稿 SKILL.md
- `bas_visit_planning_skill_v0_1.md`（98 分定稿规则，"以它为准"）— **仍不在仓库**。
- 规则引擎现按你逐字重述的 6 条铁律 + 姊妹 skill `bas_inventory_skill_v0_1.md` 实现并自测；**待该定稿入库后按它正式复核**（重点三命门：配额保底 / 助手非鞭子 / 不漏常规）。

## 依赖状态（缺了不能真跑）
| 依赖表 | 状态 | 说明 |
|---|---|---|
| 门店档案 L0-04 | ✅ spec 在仓库 | 真相源名:`store_id/store_grade/M/region/gps{lat,lng}`(C1) |
| 拜访历史(上次访期) | ◐ derive | `MAX(visitDate) BY store_id` → `visit_history` 读视图;真相源 doc 未入库 |
| 组织主数据(人/岗位) | ◐ 部分 | `userCode/role`;**产能 capacity 缺** → `org_capacity` 新表(pending) |
| 覆盖盲点 L1-04 | ✅ spec 在仓库 | 契约已对齐 `coverage_blindspot.schema.json`;表需建 |
| 排程输出 | ❌ 新建 | `visit_plan` 新表 |
| **DECISION-003 政策数字** | ❌ 未定 | 分级频率/产能上限/配额比例 = **全部占位**，标 `D003_pending` |

## 文件
| 文件 | 作用 | 交付 |
|---|---|---|
| `schema/coverage_blindspot.schema.json` | L1-04 盲点(新表) | ① |
| `schema/org_capacity.schema.json` | 产能扩展(新表) | ① |
| `schema/visit_history.schema.json` | 上次访期(读视图,对齐 visit_reports) | ① |
| `schema/visit_plan.schema.json` | 排程输出(新表)·**禁含完成/打卡态** | ① |
| `visit-dictionary.js` | 字段名+D003占位 单一事实源 | ①②③ |
| `visit-planner.js` | 规则引擎(纯函数·配额/频率/路线/override) | ② |
| `xm-push.adapter.js` | 清单→XM(今日任务)单向投影 | ③ |

## D-003 占位默认（绝不当"已定"）
```
分级频率(天)  A:7  B:14  C:30          // 门店级 M(静默天数) 优先
缺分级兜底    14  + 标 tier_pending     // 铁律3:不漏访
人均日产能    8                          // null→占位+标 capacity_default
配额比例      常规保底60% / 救火上限40%   // 铁律2:救火吃不掉保底
```
全部在 `visit-dictionary.js` 的 `D003`，`plan.flags` 带 `D003_pending`。

## 铁律落实表（照 SKILL.md，不打折）
| # | 铁律 | 落实 |
|---|---|---|
| 1 | 助手非鞭子·不当考勤 | `visit_plan` schema 禁含 `visited/checked_in/who_missed/completion`；引擎 `assertNoAttendance()` 递归扫描禁字段即抛错 |
| 2 | 配额保底不漏常规 | `allocate()`：常规保底名额先占(60%)，救火设上限(40%)，救火吃不掉保底；`quota` 字段留审计 |
| 3 | 接口先行·缺分级不漏访 | `resolveCycle()`：缺 `store_grade` → 默认周期 + `tier_pending=true`，照排不漏 |
| 4 | 只排程不越界 | 只读 门店档案(L0-04)/`coverage_blindspot`/`org_capacity`/`visit_history(visitDate)`；不读执行态、不采集、不判级、不算战功。**C4:白区盲点不消费,走 L5-02/经理** |
| 5 | 经理可调·留痕不锁死 | `applyOverride()` 写 `human_override[]{by,from,to,why,at}`，机器不锁 |
| 6 | 字段名全照字典 | 全集中 `visit-dictionary.js`；门店照 L0-04 真名、新概念设计名;仅产能 `org_capacity` 仍 `*_pending_dict` |

## ③ 怎么推到 app 的 XM(今日任务)
单向只读投影：`visit_plan ──planToXM()──▶ XM 任务卡`。
- app 的 XM 启动时 `VisitXM.fetchTodayXM({userCode,planDate,cb})` → 拉本人当日 `visit_plan` → 渲染任务卡（沿用第一回路"拉数据合并"增量模式，**不改 app 写死**，未配环境ID走 mock）。
- XM 卡只显示"今天去哪/第几站/为什么"，**无完成/进度/打卡态**。app 端 XD 在拜访时**另采**状态，planner 不回读、不汇总（铁律1+4）。

## 上线前置（先别上线）
1. 第一条 XD/盘点回路**跑通验证之后**（你的排序）。
2. 后端补 4 张表（上表 ❌/◐）。
3. **DECISION-003 政策数字落定** → 替换 `visit-dictionary.js` 的 `D003` 占位。
4. 两份权威文档到位 → 按字典锁定 `*_pending_dict` 字段名、按 98 分规则复核引擎。
