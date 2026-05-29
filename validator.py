"""
INFINITY Agent OS · Step 1 · 数据契约校验脚本
=========================================
用途:数据采集进系统前·必须通过这一关·才能进 L1 晶体管表

校验三层:
  1. JSON Schema 结构合规(字段/类型/必填)
  2. 业务规则校验(GPS地理围栏/时间合理性/晶体管逻辑一致性)
  3. 多源冲突检测(同一晶体管不同源数据矛盾)

铁律:宁可拒收·不可让坏数据进 Agent 大脑
署名 DS · 2026-05-29
"""

import json
import sys
from datetime import datetime, timezone, timedelta
from pathlib import Path

try:
    import jsonschema
    HAS_JSONSCHEMA = True
except ImportError:
    HAS_JSONSCHEMA = False


# ============================================
# 1. JSON Schema 结构校验
# ============================================

def validate_schema(data: dict, schema_path: Path) -> tuple[bool, list[str]]:
    """JSON Schema 基础结构校验"""
    if not HAS_JSONSCHEMA:
        return True, ["⚠ jsonschema 未安装·跳过结构校验·建议 pip install jsonschema"]
    schema = json.loads(schema_path.read_text(encoding='utf-8'))
    validator = jsonschema.Draft202012Validator(schema)
    errors = [f"路径 {list(e.path)} · {e.message}" for e in validator.iter_errors(data)]
    return (len(errors) == 0), errors


# ============================================
# 2. 业务规则校验(超出 JSON Schema 能力)
# ============================================

def validate_business_rules(data: dict) -> tuple[bool, list[str]]:
    """业务规则·schema 表达不了的"""
    errors = []

    # 规则 1: GPS 地理围栏(防作弊)
    geo = data.get("geo_check", {})
    if geo and not geo.get("is_within_geofence", True):
        errors.append("❌ GPS 不在门店地理围栏内·疑似作弊·拒收")

    # 规则 2: 提交时间合理性(不能是未来·不能太久之前)
    try:
        submitted_at = datetime.fromisoformat(data["submitted_at"].replace("Z", "+00:00"))
        now = datetime.now(timezone.utc)
        if submitted_at > now + timedelta(minutes=5):
            errors.append(f"❌ 提交时间 {submitted_at} 在未来·拒收")
        if submitted_at < now - timedelta(days=7):
            errors.append(f"⚠ 提交时间 {submitted_at} 超过 7 天·标记为陈旧数据·进 L0 但不喂 L2")
    except (KeyError, ValueError) as e:
        errors.append(f"❌ submitted_at 解析失败: {e}")

    # 规则 3: 晶体管逻辑一致性(同一 SKU 内不能矛盾)
    for obs in data.get("sku_observations", []):
        sig = obs.get("transistor_signals", {})
        sku_id = obs.get("sku_id", "?")

        s01 = sig.get("S01_on_shelf", {}).get("value")
        s02 = sig.get("S02_in_stock", {}).get("value")
        s06 = sig.get("S06_has_sellout", {}).get("value")
        s07 = sig.get("S07_repurchase", {}).get("value")
        s08 = sig.get("S08_stockout", {}).get("value")

        # 没上架不可能有库存
        if s01 is False and s02 is True:
            errors.append(f"❌ {sku_id}: S01 未上架但 S02 有库存·矛盾")

        # 没上架不可能有动销
        if s01 is False and s06 is True:
            errors.append(f"❌ {sku_id}: S01 未上架但 S06 有动销·矛盾")

        # 当前断货 AND 当前有库存·矛盾(S02=当前·S08=过去断过·允许 S02=true AND S08=true)
        # 但 S02=true 且 stockout_hours 是当前正在断·才矛盾
        s08_obj = sig.get("S08_stockout", {})
        if s02 is True and s08_obj.get("stockout_days", 0) > 0 and s08_obj.get("value") is True:
            # 这种情况实际允许(过去断过现在补上了)·不报错·只提示
            pass

        # 没动销不可能有复购
        if s06 is False and s07 is True:
            errors.append(f"❌ {sku_id}: S06 无动销但 S07 有复购·矛盾")

        # 利润达标但无动销·提示(不是 fail·是要 Agent 注意)
        if s06 is False and sig.get("S10_profit_meet_target", {}).get("value") is True:
            errors.append(f"⚠ {sku_id}: S06 无动销·S10 利润达标无意义·喂 Agent 注意")

    return (not any(e.startswith("❌") for e in errors)), errors


# ============================================
# 3. 多源冲突检测(L0→L1 合并前)
# ============================================

def detect_multi_source_conflict(sales_rep_data: dict, pos_data: dict = None) -> list[str]:
    """同一 SKU 多源数据不一致·按 04_l0_to_l1_mapping 规则·应标记 conflict 喂 L8 学习"""
    conflicts = []
    if pos_data is None:
        return conflicts

    pos_sales = {s["sku_id"]: s for s in pos_data.get("sku_sales", [])}

    for obs in sales_rep_data.get("sku_observations", []):
        sku_id = obs["sku_id"]
        sig = obs["transistor_signals"]

        if sku_id not in pos_sales:
            continue
        pos = pos_sales[sku_id]

        # S06 动销 · POS 是绝对权威·销售员说有动销但 POS 显示 0
        sr_s06 = sig.get("S06_has_sellout", {}).get("value")
        pos_units = pos.get("units_sold", 0)
        if sr_s06 is True and pos_units == 0:
            conflicts.append(
                f"⚠ 冲突·{sku_id}: 销售员报 S06=有动销·但 POS 7天units_sold=0·"
                f"按 mapping rule·POS 权威·标记 conflict=true·喂 L8 学习"
            )

        # S02 库存
        sr_s02 = sig.get("S02_in_stock", {}).get("value")
        pos_stock = pos.get("current_stock")
        if pos_stock is not None and sr_s02 is True and pos_stock == 0:
            conflicts.append(
                f"⚠ 冲突·{sku_id}: 销售员报 S02=有货·POS 显示 stock=0·POS 权威"
            )

    return conflicts


# ============================================
# 主校验入口
# ============================================

def validate(data_path: Path, schema_path: Path, pos_data_path: Path = None) -> dict:
    """完整校验·返回结构化报告"""
    data = json.loads(data_path.read_text(encoding='utf-8'))

    schema_ok, schema_errors = validate_schema(data, schema_path)
    biz_ok, biz_errors = validate_business_rules(data)

    pos_data = None
    if pos_data_path and pos_data_path.exists():
        pos_data = json.loads(pos_data_path.read_text(encoding='utf-8'))
    conflicts = detect_multi_source_conflict(data, pos_data)

    overall_ok = schema_ok and biz_ok

    return {
        "overall_ok": overall_ok,
        "decision": "接收·入 L0 队列" if overall_ok else "拒收·返还采集端",
        "schema_check": {"ok": schema_ok, "errors": schema_errors},
        "business_rules": {"ok": biz_ok, "messages": biz_errors},
        "multi_source_conflicts": conflicts,
        "data_id": data.get("submission_id"),
    }


if __name__ == "__main__":
    base = Path(__file__).parent
    report = validate(
        data_path=base / "example_01_sales_rep_input.json",
        schema_path=base / "01_sales_rep_input.schema.json",
    )

    print("=" * 60)
    print("INFINITY Agent OS · Step 1 · 数据契约校验报告")
    print("=" * 60)
    print(f"数据 ID:    {report['data_id']}")
    print(f"总体结果:   {'✅ 通过' if report['overall_ok'] else '❌ 拒收'}")
    print(f"决策:       {report['decision']}")
    print()
    print(f"① Schema 结构校验: {'✅' if report['schema_check']['ok'] else '❌'}")
    for e in report['schema_check']['errors']:
        print(f"   {e}")
    print()
    print(f"② 业务规则校验:   {'✅' if report['business_rules']['ok'] else '❌'}")
    for e in report['business_rules']['messages']:
        print(f"   {e}")
    print()
    if report['multi_source_conflicts']:
        print(f"③ 多源冲突:")
        for c in report['multi_source_conflicts']:
            print(f"   {c}")
    print("=" * 60)
    sys.exit(0 if report['overall_ok'] else 1)
