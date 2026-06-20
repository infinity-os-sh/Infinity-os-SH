# -*- coding: utf-8 -*-
"""
L5-07 实现 → 命门校验器 桥
================================================================
实现是 JS(接 cloudbase 栈最顺,对齐 field-dictionary.js v1.1);
本桥跑 `node l5_07_planner.js` 取输出 JSON,喂给 conftest_validator.validate(),
断言返回 []。这是"实现是否守住命门"的验收。

跑法:  python3 l5_07_bridge.py
"""
import json, os, subprocess, sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from conftest_validator import validate  # 不改它,这是裁判


def run_planner():
    """跑 JS 实现,取其输出 dict。"""
    out = subprocess.check_output(["node", os.path.join(HERE, "l5_07_planner.js")])
    return json.loads(out.decode("utf-8"))


def main():
    out = run_planner()
    errs = validate(out)
    print("=" * 60)
    print("L5-07 实现输出(JS planner)→ validate() 校验")
    print("=" * 60)
    print(json.dumps(out, ensure_ascii=False, indent=2))
    print("-" * 60)
    print("validate() 违规列表:", errs)
    if errs == []:
        print("✅ 通过:实现输出 validate() == [] —— 三命门 + 两亮点 + 四铁律延伸全守住")
        return 0
    else:
        print("❌ 未过:有命门被破,需改实现(不改 validator/测试):")
        for e in errs:
            print("   -", e)
        return 1


if __name__ == "__main__":
    sys.exit(main())
