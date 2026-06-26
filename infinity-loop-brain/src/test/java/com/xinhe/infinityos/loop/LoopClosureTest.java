package com.xinhe.infinityos.loop;

import org.junit.jupiter.api.Test;

import java.util.*;

import static org.junit.jupiter.api.Assertions.*;

/**
 * 流程闭环增量·引擎侧验收(纯逻辑,无 Spring/DB):
 *  [①] closure 回写 + 规则种子;[②] 执行确认 done/unknown → verdict 不同;
 *  [③] 校准占位(distortion_flag null、算差读 calibrated_actual,黄金记录不变);[④] 上报升一层。
 * 福海路 6 条输入与黄金记录同源(回归由 LoopEngineGoldenTest 守)。
 */
class LoopClosureTest {

    private static LinkedHashMap<String, Integer> fuhailu() {
        LinkedHashMap<String, Integer> in = new LinkedHashMap<>();
        in.put("2026-01", 86); in.put("2026-02", 69); in.put("2026-03", 71);
        in.put("2026-04", 43); in.put("2026-05", 82); in.put("2026-06", 3);
        return in;
    }

    // —— ②+① 执行确认改变 verdict;命门→应对→有效 种子 ——
    @Test
    void 优化2_执行确认done与unknown_verdict不同_且产命门种子() {
        LoopEngine.LoopOptions done = new LoopEngine.LoopOptions();
        done.executionByPeriod.put("2026-04", "done");           // 4月命门应对已执行
        List<Record> dr = LoopEngine.runSeries("3001156859", "PS01080160", fuhailu(), done);

        // 5月 closure 回看 4月:gap -37→+2 收窄 + 4月done → 应对有效
        Closure c5 = dr.get(4).closure;
        assertNotNull(c5);
        assertEquals("2026-04", c5.prev_period);
        assertEquals("收窄", c5.gap_change);
        assertEquals("应对有效", c5.verdict);
        assertNotNull(c5.learned_rule_seed);
        assertEquals("欠-命门", c5.learned_rule_seed.scenario);
        assertEquals("查陈列/缺货/竞品价", c5.learned_rule_seed.response);
        assertEquals("应对有效", c5.learned_rule_seed.effect);

        // 同一条 gap,4月 unknown(默认)→ 只能"未执行无法判定"
        List<Record> ur = LoopEngine.runSeries("3001156859", "PS01080160", fuhailu(), new LoopEngine.LoopOptions());
        assertEquals("未执行无法判定", ur.get(4).closure.verdict);
        assertNotEquals(dr.get(4).closure.verdict, ur.get(4).closure.verdict, "done vs unknown verdict 必须不同");
    }

    // —— ① 首期无上期 → closure 为 null ——
    @Test
    void 优化1_首期无上期_closure为null() {
        List<Record> r = LoopEngine.runSeries("3001156859", "PS01080160", fuhailu(), new LoopEngine.LoopOptions());
        assertNull(r.get(0).closure, "1月无上期,closure 应 null");
        assertNotNull(r.get(1).closure, "2月起应有 closure");
    }

    // —— ③ 校准占位:字段在、calibrated false、算差读 calibrated_actual(=actualRaw)→ gap 不变 ——
    @Test
    void 优化3_校准占位_gap不变_字段在() {
        List<Record> r = LoopEngine.runSeries("3001156859", "PS01080160", fuhailu(), new LoopEngine.LoopOptions());
        for (Record rec : r) {
            assertNull(rec.distortion_flag, "distortion_flag 现占位 null@" + rec.period);
            assertFalse(rec.calibrated, "calibrated 占位 false@" + rec.period);
        }
        // 算差结果与黄金记录一致(校准=占位,calibrated_actual==actualRaw)
        assertEquals(2, r.get(4).gap, "5月 gap 仍=2(校准占位不扰动)");
        assertEquals(-37, r.get(3).gap);

        // calibrate() 直测:原值返回
        LoopEngine.Calibration cal = LoopEngine.calibrate(43, null);
        assertEquals(43, cal.calibrated_actual);
        assertFalse(cal.calibrated);
        assertNull(cal.distortion_flag);
    }

    // —— ④ 连续2期欠-命门未收窄 → 触发上报;正常序列(福海路)→ 全 null ——
    @Test
    void 优化4_连续未关闭差距_触发上报() {
        String store = "9000000001", sku = "PS01080160";
        LoopConfig c = new LoopConfig();
        c.store_name = "测试店"; c.tier = "VP"; c.city = "测试"; c.sku_name = "测试SKU"; c.unit = "瓶";
        c.avg_price = 10; c.r_target_topdown = 100; c.anomaly_floor = 20;
        c.closed_periods = new HashSet<>(Arrays.asList("2026-01", "2026-02", "2026-03"));
        c.partial_periods = new HashMap<>();
        LoopConfig.register(store, sku, c);

        LinkedHashMap<String, Integer> in = new LinkedHashMap<>();
        in.put("2026-01", 50);   // 50/100 = -50% 命门
        in.put("2026-02", 45);   // 45/100 = -55% 命门,幅度扩大(未收窄)
        List<Record> r = LoopEngine.runSeries(store, sku, in, new LoopEngine.LoopOptions());  // N 默认 2

        assertEquals("欠-命门", r.get(0).state);
        assertEquals("欠-命门", r.get(1).state);
        assertNull(r.get(0).escalation, "第1期不足N期,不触发");
        assertNotNull(r.get(1).escalation, "连续2期欠-命门未收窄,应触发");
        assertTrue(r.get(1).escalation.triggered);
        assertEquals(2, r.get(1).escalation.periods_unclosed);
        assertEquals("店×SKU", r.get(1).escalation.from_level);

        // 正常序列:福海路 2/3月虽连续欠但已收窄(-11→-9),不应误触发
        List<Record> fh = LoopEngine.runSeries("3001156859", "PS01080160", fuhailu(), new LoopEngine.LoopOptions());
        for (Record rec : fh) assertNull(rec.escalation, "福海路不应触发上报@" + rec.period);
    }
}
