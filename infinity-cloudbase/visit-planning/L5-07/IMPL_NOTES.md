# L5-07 拜访规划 · 实现说明(scaffold·未上线)

## 验收结果
- **24 条命门测试**:`python3 test_visit_planning_redlines.py` → **24 过 / 0 败**。
- **实现输出过裁判**:`python3 l5_07_bridge.py` → `validate() == []` ✅(三命门+两亮点+四铁律延伸全守)。
- 对抗场景(救火溢出/全救火含常规/缺分级)均 `validate()==[]`,行为正确(救火封顶→overflow→overload;常规保底不被吃光;缺分级 tier_pending 照排不漏)。

## 文件
| 文件 | 作用 | 可改? |
|---|---|---|
| `SKILL.md` | v0.2 定稿规格(98分,以它为准) | 只读 |
| `conftest_validator.py` | 裁判(验收标准) | **不改** |
| `test_visit_planning_redlines.py` | 24 条命门测试 | **不改** |
| `l5_07_planner.js` | 实现(JS·接 cloudbase 栈·对齐 field-dictionary v1.1) | 实现自由 |
| `l5_07_bridge.py` | 桥:跑 JS→输出 JSON→`validate()` | — |

## 怎么跑
```
node l5_07_planner.js            # 打印演示输出 JSON
python3 l5_07_bridge.py          # JS 输出 → validate()==[] 验收
python3 test_visit_planning_redlines.py   # 24 条命门
```

## 对齐 字段字典 v1.1
- 门店主数据用 **`store_id`**(L0-04 真名 / C1),planner 从 `field-dictionary.js` 的 `MASTER.store.code` 取。
- **CHS → L1-06**(`provenance:'L1-06'`);**SHS → 地基③ vitality**(`provenance:'地基③vitality'`,即 C2 的 `vitality.level`)。只读映射,不重算(亮点B)。
- `human_override` 留痕;输出物理无 `visited/checked_in/who_missed/completion` 等考勤字段(命门①)。

## ⚠ 仍 pending(等环境ID + 表 + D-003)
**政策数字(全部 D-003 占位,flags 标 `D003_pending`)**,在 `l5_07_planner.js` 的 `D003{}`:
- 分级频率 `FREQ_DAYS{A:7,B:14,C:30}` / 缺分级兜底 `DEFAULT_FREQ_DAYS:14`
- 常规到期度权重 `TIER_WEIGHT{A:30,B:20,C:10}`
- 人均日产能 `CAP_DAILY:8` / 救火配额 `FIREFIGHT_CAP:5` / 常规保底 `REGULAR_MIN:2`
- 救火紧急度权重 `CHS_SCORE/SHS_SCORE`

**数据源 / 表未建(现用 mock 输入)**:
- 门店档案 **L0-04**(store_id/tier/geo)— CloudBase 表未建
- **拜访历史**(各店上次访期 lastVisitDays)— 后端表未建
- **CHS**(读 L1-06 健康度)— L1-06 节点/表未建,现 mock 读入(带 provenance)
- **SHS**(读地基③ vitality)— 地基③ 未上线,现 mock 读入(带 provenance)
- 组织主数据(产能/岗位)— 真相源未入库

> 全部到位前:scaffold 不上线;政策数字占位绝不当已定(标 pending)。
