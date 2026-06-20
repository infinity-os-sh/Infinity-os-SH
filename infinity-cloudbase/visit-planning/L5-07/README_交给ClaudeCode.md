# 拜访规划 / 路线编排 (L5-07) · 命门测试集 — 交 Claude Code 实现

## 这是什么

`bas_visit_planning_skill_v0_2.md`(规格,已审定稿 98 分)的**命门测试集**。
你(Claude Code)按规格实现时,**代码可以自由写,但必须通过这里的全部测试**——
测试守的是三命门 + 两亮点,过不了 = 实现错,不论功能多完整。

## 文件

- `conftest_validator.py` — 命门校验器(裁判,移植自 SKILL.md §10)。**不要改它**,它是验收标准。
- `test_visit_planning_redlines.py` — 24 条命门测试(正例+反例)。
- 本说明。

## 怎么用

1. 按 `bas_visit_planning_skill_v0_2.md` 实现拜访规划逻辑(输入→排程→输出 dict)。
2. 你的实现产出的 output dict,喂给 `validate(output)`,**必须返回空列表 `[]`**。
3. 跑 `python3 test_visit_planning_redlines.py`(或 `pytest -v`),**24 条必须全过**。
4. 全过 = 命门守住,可提交;任一败 = 那条命门被你的实现破了,回去修。

## 五条红线(你最可能"好心"破掉的,务必盯住)

| # | 红线 | 你可能犯的错 | 测试逮你 |
|---|---|---|---|
| 命门① | **助手非鞭子** | 贴心加 `visited`/`completion_rate` 拜访完成率 | `attendance_field_present` |
| 命门② | **配额保底不漏常规** | 只按优先级排,救火吃满产能漏了常规店 | `regular_starved_by_firefight` |
| 命门③ | **只排程不越界** | 顺手采了门店状态/判了动销/算了战功 | `out_of_scope_action` |
| 亮点A | **VPS 可溯源** | VPS 给个总分但拆不出常规vs救火 | `vps_not_decomposable` |
| 亮点B | **CHS/SHS 只读** | 自己算门店健康/SKU生命力(该读 L1-06/地基③) | `chs_shs_recomputed` / `chs_not_mapped` |
| 命门④ | **VQS 评事非评人** | 把拜访有效性变成销售个人绩效分/排名 | `person_perf_or_rank_field` |

## 实现契约要点(否则测试过不了)

- 输出 dict **必须**含:`visit_list`(每项带 `reason`/`vps`/`vps_breakdown`)、`learning_emits`(emit 给 LE)、`flags`(含 `assistant_not_tracker` + `vqs_effect_not_person`)。
- 输出 dict **绝不**含:任何 `FORBIDDEN_FIELDS`(visited/completion/打卡/考勤…)或 `VQS_FORBIDDEN`(绩效分/排名/主管介入…)字段。
- CHS/SHS 走 `chs_shs_inputs`,每个带 `provenance`(CHS=`L1-06`、SHS=`地基③vitality`),**只读不重算**。
- 政策数字(频率/产能/配额)接口先行,占位待 **DECISION-003**;未定时 flags 标 `D003_pending`。
- 经理调整走 `human_override`(带 by/reason 留痕),机器不锁死。
- RAE/CAE 只在 `signal_hooks` emit 需求,**不做资源/能力分配**。

## 注意

- 校验器里 `_xxx` 开头的字段(如 `_collected_state`/`_recomputed_chs`)是**越界探针**——正常实现不该置 True;它们为 True 表示你的实现越界了,测试会逮。
- 政策数字未接入前,实现用占位默认值跑通即可,**但不得把占位当成已定**(标 pending)。
- 这 24 条是 v0.2 命门的下限,不是全部规格。完整行为见 `bas_visit_planning_skill_v0_2.md` §4 流程 + §9 References。
