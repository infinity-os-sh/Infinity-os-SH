# -*- coding: utf-8 -*-
"""
拜访规划 / 路线编排 (L5-07) · 命门校验器(参考实现)
================================================================
移植自 bas_visit_planning_skill_v0_2.md §10。
这是"判定实现对不对"的唯一裁判:Claude Code 写的任何实现,其输出 JSON
必须能通过 validate() 全部断言。命门不是建议,是测试红线。

用法:Claude Code 实现产出 output dict 后,assert validate(output) == []
"""

SWITCHES = ["上架", "有货", "陈列", "动销", "复购", "毛利"]
NO_NEW_ACTION_STAGES = {"淘汰"}

# 命门①:助手非鞭子——输出物理不得含考勤/打卡字段
FORBIDDEN_FIELDS = {"visited", "checked_in", "check_in", "who_missed", "not_visited",
                    "completion", "completion_rate", "考勤", "打卡", "谁没访"}
# 命门④(VQS 延伸):不得含个人绩效/排名/主管介入字段
VQS_FORBIDDEN = {"个人绩效", "绩效分", "拜访质量排名", "质量分", "主管介入",
                 "performance_score", "rank", "ranking", "介入触发", "sales_score"}


def validate(out: dict) -> list:
    """返回违规断言名列表;空列表 = 通过全部命门。"""
    errs = []
    blob = str(out)

    # ===== 命门①:助手非鞭子,绝无考勤字段 =====
    for ff in FORBIDDEN_FIELDS:
        if ff in blob:
            errs.append(f"attendance_field_present:{ff}")
    for f in out.get("fanout", []):
        if any(x in f for x in ("打卡", "考核", "谁没访", "上报完成", "考勤")):
            errs.append(f"planner_became_tracker:{f}")
    if "assistant_not_tracker" not in str(out.get("flags", [])):
        errs.append("missing_assistant_flag")

    # ===== 命门②:配额保底,不漏常规 =====
    vl = out.get("visit_list", [])
    fire = [v for v in vl if v.get("reason") in ("盲点", "逾期")]
    reg = [v for v in vl if v.get("reason") == "常规"]
    if out.get("_candidate_regular") and not reg and fire:
        errs.append("regular_starved_by_firefight")
    fcap = out.get("capacity", {}).get("_firefight_cap")
    if fcap is not None and len(fire) > fcap:
        errs.append("firefight_over_quota")

    # ===== 不超产能 =====
    cap = out.get("capacity", {}).get("cap")
    if isinstance(cap, int) and len(vl) > cap:
        errs.append("over_daily_capacity")
    if out.get("overflow") and out.get("status") != "overload":
        errs.append("overflow_without_flag")

    # ===== 缺分级不漏访 =====
    for v in vl:
        if v.get("_tier_missing") and v.get("reason") is None:
            errs.append(f"missing_tier_dropped:{v.get('store_id')}")

    # ===== 排程理由可溯源 =====
    for v in vl:
        if v.get("reason") not in ("盲点", "逾期", "常规"):
            errs.append(f"visit_without_reason:{v.get('store_id')}")

    # ===== 命门③:只排程不越界 =====
    if out.get("_collected_state") or out.get("_graded_sellthrough") or out.get("_computed_merit"):
        errs.append("out_of_scope_action")

    # ===== 经理调整留痕 =====
    ho = out.get("human_override")
    if ho and (not ho.get("by") or not ho.get("reason")):
        errs.append("override_without_trace")

    # ===== 亮点A: VPS=常规+救火 且可溯源 =====
    for v in vl:
        if v.get("vps") is None:
            errs.append(f"vps_missing:{v.get('store_id')}")
        bd = v.get("vps_breakdown") or {}
        if "常规到期度" not in bd or "救火紧急度" not in bd:
            errs.append(f"vps_not_decomposable:{v.get('store_id')}")
        if bd.get("救火紧急度") and not bd["救火紧急度"].get("provenance"):
            errs.append(f"vps_firefight_no_provenance:{v.get('store_id')}")

    # ===== 亮点B: CHS/SHS 只读映射不另造、不重算 =====
    ci = out.get("chs_shs_inputs") or {}
    for sid, mp in ci.items():
        if mp.get("CHS") and mp["CHS"].get("provenance") != "L1-06":
            errs.append(f"chs_not_mapped_to_L1-06:{sid}")
        if mp.get("SHS") and mp["SHS"].get("provenance") not in ("地基③vitality", "地基③"):
            errs.append(f"shs_not_mapped_to_foundation3:{sid}")
    if out.get("_recomputed_chs") or out.get("_recomputed_shs"):
        errs.append("chs_shs_recomputed")

    # ===== 学习记录 emit(MUST) =====
    le = out.get("learning_emits")
    if le is None:
        errs.append("no_learning_emit")
    else:
        for e in le:
            for k in ("planned_vps", "实际访没访", "拜访后店状态有无拨动"):
                if k not in e:
                    errs.append(f"learning_record_incomplete:{k}")

    # ===== 命门④: VQS 评事非评人 =====
    for ff in VQS_FORBIDDEN:
        if ff in blob:
            errs.append(f"person_perf_or_rank_field:{ff}")
    if out.get("_vqs_as_person_score"):
        errs.append("vqs_used_as_person_score")
    if le and "vqs_effect_not_person" not in str(out.get("flags", [])):
        errs.append("missing_vqs_effect_flag")

    # ===== RAE/CAE 只 emit 不分配 =====
    if out.get("_allocated_resource") or out.get("_assigned_capability"):
        errs.append("did_resource_or_capability_allocation")
    for f in out.get("fanout", []):
        if any(x in f for x in ("分配资源", "派能力", "调配", "resource_allocation", "capability_assign")):
            errs.append(f"allocation_in_fanout:{f}")

    return errs
