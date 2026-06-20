# -*- coding: utf-8 -*-
"""
拜访规划 / 路线编排 (L5-07) · 命门测试集
================================================================
交 Claude Code 实现时一并交付。Claude Code 写的实现,产出 output dict 喂给
validate(),必须:正例过(无违规)、反例被逮(命中对应断言)。

跑法:  pytest test_visit_planning_redlines.py -v
       (无 pytest 也可直接 python 跑,文件末尾有 fallback runner)

三命门:①助手非鞭子(无考勤字段) ②配额保底不漏常规 ③只排程不越界
两亮点:A VPS=常规+救火可溯源  B CHS/SHS只读映射不重算
四铁律延伸:④VQS评事非评人 / 学习emit / RAE-CAE只emit不分配
"""
import sys, os
sys.path.insert(0, os.path.dirname(__file__))
from conftest_validator import validate


# ---------- 一个"合规基线输出",各测试在其上改坏来验反例 ----------
def baseline():
    return {
        "date": "2026-06-15", "person": "DSR-Chen", "role": "DSR", "object_pool": "零售店",
        "chs_shs_inputs": {
            "S1": {"CHS": {"value": "C", "provenance": "L1-06"},
                   "SHS": {"value": "D", "provenance": "地基③vitality"}},
        },
        "visit_list": [
            {"store_id": "S1", "seq": 1, "reason": "盲点", "vps": 92,
             "vps_breakdown": {"常规到期度": {"分级": "A", "距上次访天数": 9},
                               "救火紧急度": {"from_CHS": "C", "from_SHS": "D", "provenance": "L1-06+地基③"}},
             "est_minutes": 40},
            {"store_id": "S2", "seq": 2, "reason": "常规", "vps": 40,
             "vps_breakdown": {"常规到期度": {"分级": "B", "距上次访天数": 14},
                               "救火紧急度": {"from_CHS": "A", "from_SHS": "B", "provenance": "L1-06+地基③"}},
             "est_minutes": 25},
        ],
        "route": {"ordered_stops": ["S1", "S2"], "geo_cluster": "西片", "est_total_minutes": 65},
        "capacity": {"cap": 8, "used": 2, "_firefight_cap": 5},
        "overflow": [],
        "learning_emits": [
            {"store_id": "S1", "planned_vps": 92, "实际访没访": "pending",
             "拜访后店状态有无拨动": "pending", "effectiveness_signal": "对事"}
        ],
        "signal_hooks": {"需补资源的客户状态": [], "需特定能力的客户类型": []},
        "human_override": None,
        "status": "planned",
        "flags": ["assistant_not_tracker", "vqs_effect_not_person", "regular_quota_protected", "D003_pending"],
        "_candidate_regular": True,
    }


# ===================== 正例:合规基线必须 0 违规 =====================
def test_baseline_passes():
    assert validate(baseline()) == [], "合规基线不该有任何命门违规"


# ===================== 命门① 助手非鞭子 =====================
def test_redline1_no_attendance_field():
    """反例:实现里加了 visited/completion 等考勤字段 → 必须被逮。"""
    o = baseline()
    o["visit_list"][0]["visited"] = True          # Claude Code 可能"贴心"加的完成标记
    errs = validate(o)
    assert any(e.startswith("attendance_field_present") for e in errs), \
        "加了 visited 字段却没被命门①逮住"

def test_redline1_no_completion_rate():
    o = baseline()
    o["completion_rate"] = 0.75                    # 拜访完成率统计
    assert any("attendance_field_present" in e for e in validate(o))

def test_redline1_fanout_not_tracker():
    o = baseline()
    o["fanout"] = ["XM今日任务", "上报完成情况给主管"]   # 扇出里夹考核
    assert any(e.startswith("planner_became_tracker") for e in validate(o))


# ===================== 命门② 配额保底不漏常规 =====================
def test_redline2_regular_not_starved():
    """反例:候选有常规店,但清单全是救火、一个常规没排 → 必须被逮。"""
    o = baseline()
    o["visit_list"] = [v for v in o["visit_list"] if v["reason"] != "常规"]  # 删掉常规
    o["_candidate_regular"] = True                 # 但候选里本有常规
    assert "regular_starved_by_firefight" in validate(o)

def test_redline2_firefight_over_quota():
    o = baseline()
    o["capacity"]["_firefight_cap"] = 1            # 救火上限1
    o["visit_list"] = [
        {"store_id": f"F{i}", "seq": i, "reason": "盲点", "vps": 90,
         "vps_breakdown": {"常规到期度": {}, "救火紧急度": {"provenance": "x"}}} for i in range(3)
    ]                                              # 排了3个救火,超限
    o["_candidate_regular"] = False
    assert "firefight_over_quota" in validate(o)

def test_redline2_over_capacity():
    o = baseline()
    o["capacity"]["cap"] = 1                       # 上限1
    # baseline 有2家 → 超
    assert "over_daily_capacity" in validate(o)


# ===================== 命门③ 只排程不越界 =====================
def test_redline3_no_collect_state():
    o = baseline(); o["_collected_state"] = True   # 越界采了状态(XD的事)
    assert "out_of_scope_action" in validate(o)

def test_redline3_no_grade_sellthrough():
    o = baseline(); o["_graded_sellthrough"] = True  # 越界判了动销(L1-03的事)
    assert "out_of_scope_action" in validate(o)

def test_redline3_no_compute_merit():
    o = baseline(); o["_computed_merit"] = True     # 越界算了战功(地基③的事)
    assert "out_of_scope_action" in validate(o)


# ===================== 亮点A VPS=常规+救火 可溯源 =====================
def test_highlightA_vps_decomposable():
    """反例:VPS 给了个总分但拆不出常规vs救火 → 必须被逮。"""
    o = baseline()
    o["visit_list"][0]["vps_breakdown"] = {"总分": 92}  # 扁平,拆不出
    assert any(e.startswith("vps_not_decomposable") for e in validate(o))

def test_highlightA_vps_present():
    o = baseline()
    o["visit_list"][0]["vps"] = None
    assert any(e.startswith("vps_missing") for e in validate(o))

def test_highlightA_firefight_provenance():
    o = baseline()
    o["visit_list"][0]["vps_breakdown"]["救火紧急度"].pop("provenance")
    assert any(e.startswith("vps_firefight_no_provenance") for e in validate(o))


# ===================== 亮点B CHS/SHS 只读映射不重算 =====================
def test_highlightB_chs_mapped_to_L106():
    """反例:CHS 没标 provenance=L1-06(自己造了平行字典)→ 必须被逮。"""
    o = baseline()
    o["chs_shs_inputs"]["S1"]["CHS"]["provenance"] = "自算门店分"  # 另造
    assert any(e.startswith("chs_not_mapped_to_L1-06") for e in validate(o))

def test_highlightB_shs_mapped_to_foundation3():
    o = baseline()
    o["chs_shs_inputs"]["S1"]["SHS"]["provenance"] = "自算SKU分"
    assert any(e.startswith("shs_not_mapped_to_foundation3") for e in validate(o))

def test_highlightB_no_recompute():
    o = baseline(); o["_recomputed_chs"] = True     # 自己重算了门店健康
    assert "chs_shs_recomputed" in validate(o)


# ===================== 命门④ VQS 评事非评人 =====================
def test_redline4_no_person_perf():
    """反例:实现把拜访有效性变成销售个人绩效分 → 必须被逮。"""
    o = baseline()
    o["sales_score"] = 82                           # 个人绩效分
    assert any(e.startswith("person_perf_or_rank_field") for e in validate(o))

def test_redline4_no_ranking():
    o = baseline()
    o["visit_list"][0]["ranking"] = 1               # 拜访排名
    assert any(e.startswith("person_perf_or_rank_field") for e in validate(o))

def test_redline4_vqs_not_person_score():
    o = baseline(); o["_vqs_as_person_score"] = True
    assert "vqs_used_as_person_score" in validate(o)


# ===================== 学习 emit (MUST) =====================
def test_learning_emit_required():
    o = baseline(); o.pop("learning_emits")
    assert "no_learning_emit" in validate(o)

def test_learning_record_complete():
    o = baseline()
    o["learning_emits"][0].pop("拜访后店状态有无拨动")  # 学习记录缺字段
    assert any(e.startswith("learning_record_incomplete") for e in validate(o))


# ===================== RAE/CAE 只 emit 不分配 =====================
def test_no_resource_allocation():
    """反例:实现越权做了资源/能力分配 → 必须被逮。"""
    o = baseline(); o["_allocated_resource"] = True
    assert "did_resource_or_capability_allocation" in validate(o)

def test_no_allocation_in_fanout():
    o = baseline(); o["fanout"] = ["分配资源给S1"]
    assert any(e.startswith("allocation_in_fanout") for e in validate(o))


# ===================== 缺分级不漏访 =====================
def test_missing_tier_not_dropped():
    """缺分级的店若没排程理由(被悄悄漏掉)→ 必须被逮。"""
    o = baseline()
    o["visit_list"].append({"store_id": "S9", "_tier_missing": True, "reason": None})
    assert any(e.startswith("missing_tier_dropped") for e in validate(o))


# ---------- fallback runner(无 pytest 时直接 python 跑) ----------
if __name__ == "__main__":
    import types
    tests = [v for k, v in sorted(globals().items())
             if k.startswith("test_") and isinstance(v, types.FunctionType)]
    passed = failed = 0
    for t in tests:
        try:
            t(); passed += 1; print(f"  PASS  {t.__name__}")
        except AssertionError as e:
            failed += 1; print(f"  FAIL  {t.__name__}: {e}")
    print(f"\n{'='*50}\n命门测试:{passed} 过 / {failed} 败 / 共 {len(tests)}")
    print("="*50)
    if failed == 0:
        print("✅ 校验器自洽:正例全过、反例全被逮。可交 Claude Code。")
