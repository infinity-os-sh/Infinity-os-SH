package com.xinhe.infinityos.loop;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.*;

/**
 * 经营环引擎 · 固定五步环 + 三类可插拔件
 * 1:1 翻译 loop_engine_patch_v2.py(已验证)。横向复制只加 LoopConfig 行,不改本类。
 *
 * ★ 跨语言取整坑(非补不可):
 *   Python round(2.5)=2(HALF_EVEN);Java Math.round(2.5)=3(HALF_UP)。
 *   5月 gap=2/target=80=2.5% 会分叉。本类 gapPct() 用 HALF_EVEN,与 Python/黄金记录逐位一致。
 */
public class LoopEngine {

    static final int CRIT_PCT = -40;   // 命门阈值(规则·可改)·单期口径

    // ── 取整:必须 HALF_EVEN,与 Python round 对齐 ──
    static int halfEvenRound(double v) {
        return new BigDecimal(Double.toString(v))
                .setScale(0, RoundingMode.HALF_EVEN).intValueExact();
    }
    static double round2(double v) {
        return new BigDecimal(Double.toString(v))
                .setScale(2, RoundingMode.HALF_EVEN).doubleValue();
    }
    static double round1(double v) {
        return new BigDecimal(Double.toString(v))
                .setScale(1, RoundingMode.HALF_EVEN).doubleValue();
    }

    // ── 规则件:已结期 状态分类 ──
    static String ruleState(int gap, int gapPct, boolean hasData) {
        if (!hasData)          return "无数据";
        if (gap > 0)           return "超";
        if (gap == 0)          return "达";
        if (gapPct <= CRIT_PCT) return "欠-命门";   // 单期阈值·非序列 argmin
        return "欠";
    }
    static String ruleResponse(String state) {
        switch (state) {
            case "欠-命门": return "查陈列/缺货/竞品价";
            case "欠":      return "跟进动销";
            case "超":      return "保供+flagJBP(目标是否偏低·核查)";
            case "达":      return "维持";
            default:        return "";   // 半月 / 无数据
        }
    }

    // ── 算法件:预测(空壳·近3月均值)──
    static Double algoForecast(List<Integer> history) {
        List<Integer> vals = new ArrayList<>();
        for (Integer v : history) if (v != null) vals.add(v);
        if (vals.isEmpty()) return null;
        int from = Math.max(0, vals.size() - 3);
        double sum = 0; int n = 0;
        for (int i = from; i < vals.size(); i++) { sum += vals.get(i); n++; }
        return round1(sum / n);
    }

    // ── 异常守门(规则件 A1):实际<0.5基准 且 <下限 → 不学 ──
    static boolean isAnomaly(Integer actual, Double basis, int floor) {
        if (actual == null || basis == null) return false;
        return actual < 0.5 * basis && actual < floor;
    }

    // 返回容器:record + sample(sample 可 null)
    public static class Result {
        public final Record record;
        public final LearningSample sample;
        public Result(Record r, LearningSample s) { this.record = r; this.sample = s; }
    }

    /**
     * 固定五步环。history = 本期之前"已结+有数"的实际序列。
     */
    public static Result loop(String storeId, String skuId, String period,
                              Integer actualRaw, List<Integer> history) {
        LoopConfig cfg = LoopConfig.get(storeId, skuId);
        Record rec = new Record();

        // 身份
        rec.store_id = storeId; rec.store_name = cfg.store_name; rec.tier = cfg.tier; rec.city = cfg.city;
        rec.sku_id = skuId; rec.sku_name = cfg.sku_name; rec.period = period; rec.unit = cfg.unit;
        rec.source = "IPO10"; rec.ts = "2026-06-25T00:00:00+08:00";

        // 1 定标↓
        rec.r_target = cfg.r_target_topdown;
        rec.target_status = "ok";
        rec.target_source = "top_down";
        rec.calibrated = false; rec.koujing = "sell-in"; rec.avg_price = cfg.avg_price;

        // 2 量实↑ —— 三态:partial(半月) / closed(ok) / no_data
        int[] partial = cfg.partial_periods.get(period);
        boolean isClosed = cfg.closed_periods.contains(period);
        boolean hasData;

        if (partial != null && actualRaw != null) {
            // 半月在途:按日销率·缓判·不进命门
            int de = partial[0], dp = partial[1];
            double rActDay = round2((double) actualRaw / de);
            double rTgtDay = round2((double) rec.r_target / dp);
            rec.r_actual_raw = actualRaw; rec.actual_status = "partial";
            rec.days_elapsed = de; rec.days_in_period = dp;
            rec.gap = null; rec.gap_pct = null; rec.gap_day = round2(rActDay - rTgtDay);
            rec.state = "半月"; rec.response = ruleResponse("半月");
            hasData = false;
        } else if (isClosed && actualRaw != null) {
            int gap = actualRaw - rec.r_target;
            int gapPct = halfEvenRound((double) gap / rec.r_target * 100);  // ★ HALF_EVEN
            String state = ruleState(gap, gapPct, true);
            rec.r_actual_raw = actualRaw; rec.actual_status = "ok";
            rec.gap = gap; rec.gap_pct = gapPct; rec.state = state; rec.response = ruleResponse(state);
            hasData = true;
        } else {
            rec.r_actual_raw = null; rec.actual_status = "no_data";
            rec.gap = null; rec.gap_pct = null; rec.state = "无数据"; rec.response = "";
            hasData = false;
        }

        // 5 验果+学习 —— 预测 + 异常守门 + sample
        Double basis = algoForecast(history);
        rec.r_forecast = basis;
        rec.forecast_basis = "近3月均值";          // 方法标签·非 forecast 值
        rec.forecast_status = (basis != null) ? "ok" : "no_data";
        rec.forecast_locked_at = null; rec.forecast_version = 0; rec.forecast_outcome = null;

        LearningSample sample = null;
        if (hasData) {
            if (!isAnomaly(rec.r_actual_raw, basis, cfg.anomaly_floor)) {
                Double err = (basis == null) ? null : round1(rec.r_actual_raw - basis);
                sample = new LearningSample(storeId, skuId, period, "近3月均值",
                        basis, rec.r_actual_raw, err, "");
            }
            // 异常 → sample 留 null,不学
        }
        return new Result(rec, sample);
    }

    /**
     * 跑一个店×SKU 的整年序列(按 period 升序);只把"已结+有数"喂下期预测历史。
     */
    public static List<Record> runSeries(String storeId, String skuId,
                                          LinkedHashMap<String, Integer> actualsByPeriod) {
        List<String> periods = new ArrayList<>(actualsByPeriod.keySet());
        Collections.sort(periods);
        List<Record> out = new ArrayList<>();
        List<Integer> hist = new ArrayList<>();
        for (String p : periods) {
            Result res = loop(storeId, skuId, p, actualsByPeriod.get(p), hist);
            out.add(res.record);
            if ("ok".equals(res.record.actual_status)) hist.add(res.record.r_actual_raw);
        }
        return out;
    }
}
