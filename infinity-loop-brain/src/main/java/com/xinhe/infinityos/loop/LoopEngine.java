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
     * 原 5 参版:向后兼容(无上一期、无执行回填、默认选项)→ 黄金记录逻辑不变。
     */
    public static Result loop(String storeId, String skuId, String period,
                              Integer actualRaw, List<Integer> history) {
        return loop(storeId, skuId, period, actualRaw, history,
                    new ArrayList<>(), null, new LoopOptions());
    }

    /**
     * 固定五步环 + 闭环增量(流程优化·全部新增,不改旧逻辑):
     *   ② 执行确认(response_executed,默认 unknown,外部回填)
     *   ③ 校准(占位,算差读 calibrated_actual)
     *   ① 验果回写(closure + 规则种子)
     *   ④ 上报升一层(escalation 信号)
     * priorRecords = 本期之前已产出的 Record(升序);responseExecuted = 外部回填执行状态(null→unknown)。
     */
    public static Result loop(String storeId, String skuId, String period,
                              Integer actualRaw, List<Integer> history,
                              List<Record> priorRecords, String responseExecuted,
                              LoopOptions opt) {
        if (opt == null) opt = new LoopOptions();
        if (priorRecords == null) priorRecords = new ArrayList<>();
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

        // ② 执行确认(优化②·新增):本期默认 unknown,外部(前端/任务系统/人)回填 done/not_done。留接口。
        rec.response_executed = (responseExecuted != null) ? responseExecuted : "unknown";
        rec.execution_source  = (responseExecuted != null) ? "external_backfill" : null;

        // ③ 校准(优化③·新增·占位):算差用 calibrated_actual,不用裸 actualRaw。
        //    现 calibrated_actual == actualRaw(占位),将来接压货/促销/蝴蝶信号后自动分离。
        Calibration cal = calibrate(actualRaw, null);
        rec.calibrated = cal.calibrated;            // 占位 false
        rec.distortion_flag = cal.distortion_flag;  // 占位 null
        Integer calActual = cal.calibrated_actual;  // == actualRaw

        // 2 量实↑ —— 三态:partial(半月) / closed(ok) / no_data
        int[] partial = cfg.partial_periods.get(period);
        boolean isClosed = cfg.closed_periods.contains(period);
        boolean hasData;

        if (partial != null && actualRaw != null) {
            // 半月在途:按日销率·缓判·不进命门
            int de = partial[0], dp = partial[1];
            double rActDay = round2((double) calActual / de);   // ③ 用校准后值
            double rTgtDay = round2((double) rec.r_target / dp);
            rec.r_actual_raw = actualRaw; rec.actual_status = "partial";
            rec.days_elapsed = de; rec.days_in_period = dp;
            rec.gap = null; rec.gap_pct = null; rec.gap_day = round2(rActDay - rTgtDay);
            rec.state = "半月"; rec.response = ruleResponse("半月");
            hasData = false;
        } else if (isClosed && actualRaw != null) {
            int gap = calActual - rec.r_target;                 // ③ 算差用 calibrated_actual
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

        // ① 验果回写(优化①·新增·让环真闭合):比对上期应对 vs 本期 gap 是否收窄 → closure + 规则种子。
        rec.closure = buildClosure(priorRecords, rec);
        // ④ 上报升一层(优化④·新增):关不掉的差 → escalation 信号(只产信号,不自动派)。
        rec.escalation = buildEscalation(priorRecords, rec, opt.escalationN);

        return new Result(rec, sample);
    }

    // ════════════ 闭环增量·辅助件(全部新增,不触旧逻辑)════════════

    /** 选项:执行回填(period→done/not_done)+ 上报阈值 N。默认 = 空回填 + N=2,黄金记录不变。 */
    public static class LoopOptions {
        public Map<String, String> executionByPeriod = new HashMap<>();
        public int escalationN = 2;
    }

    /** ③ 校准结果(占位)。 */
    public static class Calibration {
        public final Integer calibrated_actual;
        public final boolean calibrated;
        public final String  distortion_flag;
        public Calibration(Integer calibrated_actual, boolean calibrated, String distortion_flag) {
            this.calibrated_actual = calibrated_actual;
            this.calibrated = calibrated;
            this.distortion_flag = distortion_flag;
        }
    }

    /**
     * ③ 校准(占位实现):不校准,原值返回。位置留对,字段挖好,算法先空——
     * 等压货/促销/窜货/蝴蝶信号接入才真校准(那要数据,本期不做)。
     */
    static Calibration calibrate(Integer actualRaw, Object context) {
        return new Calibration(actualRaw, false, null);  // calibrated_actual=actualRaw, 占位
    }

    /**
     * ① 验果回写:看上一期开的应对(prev_response)在本期是否把 gap 收窄,产出 closure。
     * verdict 三分(配合②执行确认):done+收窄=有效;done+没收窄=无效要找因果;否则=未执行无法判定。
     */
    static Closure buildClosure(List<Record> prior, Record cur) {
        if (prior == null || prior.isEmpty()) return null;
        Record prev = prior.get(prior.size() - 1);

        Closure c = new Closure();
        c.prev_period = prev.period;
        c.prev_state = prev.state;
        c.prev_response = prev.response;

        // gap_change:本期 gap 幅度 vs 上期 gap 幅度(越靠近 0 = 收窄)
        String change = null;
        if (prev.gap != null && cur.gap != null) {
            int a = Math.abs(prev.gap), b = Math.abs(cur.gap);
            change = (b < a) ? "收窄" : (b > a) ? "扩大" : "持平";
        }
        c.gap_change = change;

        // verdict:据②执行确认 + 收窄与否
        if (change == null) {
            c.verdict = "未执行无法判定";              // 本期/上期无可比 gap(半月/无数据)
        } else if ("done".equals(prev.response_executed)) {
            c.verdict = "收窄".equals(change) ? "应对有效" : "应对无效·要找因果";
        } else {
            c.verdict = "未执行无法判定";              // not_done/unknown:差缩也不算应对功劳
        }

        // learned_rule_seed:上期有可执行应对 且 可比 → 产一条种子(只入 rule_learning_log,不自动改规则)
        if (change != null && prev.response != null && !prev.response.isEmpty()) {
            Closure.RuleSeed seed = new Closure.RuleSeed();
            seed.scenario = prev.state;       // 场景
            seed.response = prev.response;     // 应对
            seed.effect   = c.verdict;         // 效果
            c.learned_rule_seed = seed;
        }
        return c;
    }

    /**
     * ④ 上报升一层:连续 N 期「同一 state(∈{欠,欠-命门})」且 gap 未收窄 → 产 escalation 信号。
     * 「同一 state」取字面同值(对齐验收④:连续2期欠-命门未收窄→触发);未触发返回 null。
     */
    static Escalation buildEscalation(List<Record> prior, Record cur, int n) {
        if (n < 1) n = 2;
        String s = cur.state;
        if (s == null || !(s.equals("欠") || s.equals("欠-命门")) || cur.gap == null) return null;

        // 取最近 n 期(含本期)按升序
        List<Record> window = new ArrayList<>();
        for (int i = prior.size() - 1; i >= 0 && window.size() < n - 1; i--) window.add(prior.get(i));
        Collections.reverse(window);
        window.add(cur);
        if (window.size() < n) return null;

        for (Record r : window) {
            if (r.state == null || !r.state.equals(s) || r.gap == null) return null;  // 必须同一 state 且都有 gap
        }
        int first = Math.abs(window.get(0).gap);
        int last  = Math.abs(window.get(window.size() - 1).gap);
        if (last < first) return null;   // 收窄了 → 不上报

        Escalation e = new Escalation();
        e.triggered = true;
        e.reason = "连续" + n + "期未关闭差距";
        e.from_level = "店×SKU";
        e.to_level = "城市/客户";       // 升一层:SKU 层关不掉 → 升品类/JBP 层
        e.periods_unclosed = n;
        return e;
    }

    /**
     * 跑一个店×SKU 的整年序列(按 period 升序);只把"已结+有数"喂下期预测历史。
     */
    public static List<Record> runSeries(String storeId, String skuId,
                                          LinkedHashMap<String, Integer> actualsByPeriod) {
        return runSeries(storeId, skuId, actualsByPeriod, new LoopOptions());
    }

    /**
     * 增量:带选项(执行回填 + 上报阈值 N)。逐期把已产出的 out 作为 priorRecords 传下去,
     * 让 closure(看上期)与 escalation(看连续期)成立。原 3 参版委托此版,默认选项 → 黄金记录不变。
     */
    public static List<Record> runSeries(String storeId, String skuId,
                                          LinkedHashMap<String, Integer> actualsByPeriod,
                                          LoopOptions opt) {
        if (opt == null) opt = new LoopOptions();
        List<String> periods = new ArrayList<>(actualsByPeriod.keySet());
        Collections.sort(periods);
        List<Record> out = new ArrayList<>();
        List<Integer> hist = new ArrayList<>();
        for (String p : periods) {
            String exec = (opt.executionByPeriod != null) ? opt.executionByPeriod.get(p) : null;
            Result res = loop(storeId, skuId, p, actualsByPeriod.get(p), hist, out, exec, opt);
            out.add(res.record);
            if ("ok".equals(res.record.actual_status)) hist.add(res.record.r_actual_raw);
        }
        return out;
    }
}
