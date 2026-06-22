# -*- coding: utf-8 -*-
"""
SKU Scorecard · Redline 测试(SKILL §4)
================================================================
满足 Loop「能说不对」三条件:黄金例可复现 + 毛利闸 + 压货/缺数据校验。
任一黄金例回归失败 = 阻断(SKILL §4)。

跑法:  pytest -q test_sku_scorecard_redlines.py
依赖:  node 在 PATH;同目录 sku_scorecard.js。
不改 SKILL/规格,改的是实现。
"""
import json
import os
import subprocess

import pytest

HERE = os.path.dirname(os.path.abspath(__file__))
ENGINE = os.path.join(HERE, "sku_scorecard.js")


def score(inp):
    out = subprocess.check_output(["node", ENGINE, "--score", json.dumps(inp)])
    return json.loads(out.decode("utf-8"))


def golden():
    out = subprocess.check_output(["node", ENGINE])
    return {r["name"]: r for r in json.loads(out.decode("utf-8"))}


GOLD = golden()


# ── §4 五个黄金例:逐例 state_score + L 必中 ─────────────────────────────────
@pytest.mark.parametrize("name", ["1a", "1b", "2", "3", "4"])
def test_golden_case_score_and_level(name):
    r = GOLD[name]
    assert r["got"]["state_score"] == r["expect_score"], "例%s 分不符" % name
    assert r["got"]["sku_state_level"] == r["expect_L"], "例%s L级不符" % name


# ── §2.4 毛利闸:破底线必封顶 60、最高 L3、永不健康 ───────────────────────────
def test_margin_gate_caps_high_raw():
    r = score({"role": "攻击", "stage": "成长", "buy": .95, "see": .80, "sell": .95, "margin_broken": True})
    assert r["margin_gate"]["cap_applied"] is True
    assert r["state_score"] <= 60
    assert r["sku_state_level"] in ("L1", "L2", "L3")  # 封顶后永不达 L4/L5


def test_margin_held_not_capped():
    r = score({"role": "防御", "stage": "成熟", "buy": .90, "see": .95, "sell": .85, "margin_broken": False})
    assert r["margin_gate"]["cap_applied"] is False
    assert r["state_score"] == 89.25 and r["sku_state_level"] == "L5"


# ── §2.5 缺数据(判级类):no_data ≠ 0,不计 0、重归一化、降置信度 ────────────────
def test_no_data_not_counted_as_zero():
    r = score({"role": "明星", "stage": "成熟", "buy": "no_data", "see": .70, "sell": .45, "margin_broken": False})
    bk = {d["dim"]: d for d in r["gap_breakdown"]}
    assert bk["buy"]["r"] == "no_data" and bk["buy"]["gap"] is None  # 不当差
    # 重归一:成熟 see30/sell45 → (30*.70+45*.45)*100/75 = 55.0(若当0则会被拉低,验证未当0)
    assert abs(r["state_score"] - 55.0) < 0.01
    assert r["confidence"] < 1.0  # 降置信度


def test_no_data_confidence_drops_per_dim():
    one = score({"role": "明星", "stage": "成熟", "buy": "no_data", "see": .70, "sell": .45})
    two = score({"role": "明星", "stage": "成熟", "buy": "no_data", "see": "no_data", "sell": .45})
    assert two["confidence"] < one["confidence"] < 1.0


# ── §4 边界:实际/目标 >1 → 封顶 1.0 ─────────────────────────────────────────
def test_ratio_capped_at_one():
    r = score({"role": "明星", "stage": "导入", "buy_actual": 120, "buy_target": 100,
               "see": 1.0, "sell": 1.0, "margin_broken": False})
    assert r["state_score"] == 100.0  # 超额不奖励(>1 封顶)


# ── §4 边界:权重和≠100 → 归一化(不报错)。no_data 致有效权重和≠100 即覆盖 ──────
def test_weights_renormalize_no_error():
    r = score({"role": "明星", "stage": "成熟", "buy": "no_data", "see": 1.0, "sell": 1.0})
    assert r["state_score"] == 100.0  # 满分维重归一后仍 100,未因权重和≠100 出错/失真


# ── §5 tracker:铺货远超目标 = 疑压货 → 标待人工核 + 降置信 ───────────────────
def test_suspected_overstock_flagged():
    r = score({"role": "明星", "stage": "成熟", "buy_actual": 200, "buy_target": 100,
               "see": .70, "sell": .45, "margin_broken": False})
    assert any("overstock" in f for f in r["flags"])
    assert r["task_seed"]["type"] == "待批"  # 触发疑似压货 → 人工核,不直接派


# ── §1⑥ 自主边界:只算只建议,任务种子是"建议非指令" ────────────────────────────
def test_task_seed_is_suggestion_not_command():
    r = score({"role": "现金流", "stage": "衰退", "buy": .70, "see": .50, "sell": .25})
    assert r["task_seed"]["type"] in ("无差", "待批", "已派")  # §5 inbox 三类
    assert "建议" in r["task_seed"]["note"] and "非指令" in r["task_seed"]["note"]


# ── §3 输出 schema:字段齐全 ─────────────────────────────────────────────────
def test_output_schema_fields():
    r = score({"role": "明星", "stage": "成长", "buy": .8, "see": .8, "sell": .8})
    for k in ("state_score", "sku_state_level", "gap_total", "gap_breakdown",
              "top_gap_dim", "tactic", "task_seed", "confidence", "margin_gate"):
        assert k in r, "缺输出字段 %s" % k
