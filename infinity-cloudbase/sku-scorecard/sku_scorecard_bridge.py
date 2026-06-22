# -*- coding: utf-8 -*-
"""
SKU Scorecard 实现 → 黄金例/命门校验 桥
================================================================
实现是 JS(接 cloudbase 栈最顺,对齐 field-dictionary.js v1.1);
本桥跑 `node sku_scorecard.js` 取五个黄金例输出,断言 state_score / sku_state_level
与 SKILL §4 期望逐例一致;再跑四条边界(§4)断言不破命门。

这是"实现是否复现规格"的验收(对应 SKILL §4「tracker 合并前必跑的 dry-run,
任一黄金例回归失败 = 阻断」)。不改 SKILL/规格,改的是实现。

跑法:  python3 sku_scorecard_bridge.py
"""
import json
import os
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ENGINE = os.path.join(HERE, "sku_scorecard.js")


def run_golden():
    out = subprocess.check_output(["node", ENGINE])
    return json.loads(out.decode("utf-8"))


def score(inp):
    out = subprocess.check_output(["node", ENGINE, "--score", json.dumps(inp)])
    return json.loads(out.decode("utf-8"))


def check_golden():
    """§4 五个黄金例:state_score + sku_state_level 逐例必中。"""
    rows = run_golden()
    errs = []
    for r in rows:
        g = r["got"]
        if g["state_score"] != r["expect_score"]:
            errs.append("黄金例 %s 分不符:got %s != exp %s" % (r["name"], g["state_score"], r["expect_score"]))
        if g["sku_state_level"] != r["expect_L"]:
            errs.append("黄金例 %s L级不符:got %s != exp %s" % (r["name"], g["sku_state_level"], r["expect_L"]))
    return rows, errs


def check_boundaries():
    """§4 边界测试:归一化不报错 / no_data 不计0且降置信 / 实际超目标封顶1.0 / 毛利破必触封顶。"""
    errs = []

    # ① 某维 no_data → 不计 0、置信度降、其余维重归一化(不报错)
    nd = score({"role": "明星", "stage": "成熟", "buy": "no_data", "see": .70, "sell": .45, "margin_broken": False})
    if nd["confidence"] >= 1.0:
        errs.append("no_data 维未降置信度:confidence=%s" % nd["confidence"])
    bk = {d["dim"]: d for d in nd["gap_breakdown"]}
    if bk["buy"]["gap"] is not None or bk["buy"]["r"] != "no_data":
        errs.append("no_data 维被当差(应 gap=null/r=no_data):%s" % bk["buy"])
    # 重归一:成熟 see30/sell45,见.70动.45 → (30*.70+45*.45)*100/75 = (21+20.25)/75*100 = 55.0
    if abs(nd["state_score"] - 55.0) > 0.01:
        errs.append("no_data 重归一化不对:got %s != 55.0" % nd["state_score"])

    # ② 实际/目标 >1 → 封顶 1.0(用 actual/target 路径)
    over = score({"role": "明星", "stage": "导入", "buy_actual": 120, "buy_target": 100,
                  "see": 1.0, "sell": 1.0, "margin_broken": False})
    if over["state_score"] != 100.0:
        errs.append("实际超目标未按 r=1.0 封顶:got %s != 100.0" % over["state_score"])

    # ③ 毛利破 + 高 raw → 必触封顶(state_score<=CAP 且 cap_applied)
    cap = score({"role": "攻击", "stage": "成长", "buy": .95, "see": .80, "sell": .95, "margin_broken": True})
    if cap["state_score"] > cap["margin_gate"]["cap"] or not cap["margin_gate"]["cap_applied"]:
        errs.append("毛利破+高raw 未触封顶:%s" % cap["margin_gate"])

    # ④ 权重和≠100 容错:no_data 让有效权重和≠100,①已覆盖且未报错 → 归一化成立
    return errs


def main():
    rows, gerrs = check_golden()
    berrs = check_boundaries()
    errs = gerrs + berrs
    print("=" * 64)
    print("SKU Scorecard 实现(JS)→ §4 黄金例 + 边界 校验")
    print("=" * 64)
    for r in rows:
        g = r["got"]
        ok = (g["state_score"] == r["expect_score"] and g["sku_state_level"] == r["expect_L"])
        print("  [%s] 例%s  score=%s L=%s  top=%s conf=%s gate=%s" % (
            "OK" if ok else "XX", r["name"], g["state_score"], g["sku_state_level"],
            g["top_gap_dim"], g["confidence"], g["margin_gate"]["cap_applied"]))
    print("-" * 64)
    if errs == []:
        print("✅ 通过:五黄金例逐例命中 + 四边界守住命门(no_data≠0 / 封顶1.0 / 毛利闸 / 归一化)")
        return 0
    print("❌ 未过(改实现·不改 SKILL/规格):")
    for e in errs:
        print("   -", e)
    return 1


if __name__ == "__main__":
    sys.exit(main())
