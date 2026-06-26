package com.xinhe.infinityos.loop;

import org.junit.jupiter.api.Test;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;

/**
 * 验收门 · 福海路6条黄金记录(2026 × PS01080160)
 * 绿 = 引擎侧对齐达标,演示→系统可宣布。
 * 重点盯:5月 2%(HALF_EVEN·非3)、6月 半月/partial(非 no_data/非0)。
 */
public class LoopEngineGoldenTest {

    @Test
    void 福海路六条黄金记录() {
        LinkedHashMap<String, Integer> in = new LinkedHashMap<>();
        in.put("2026-01", 86); in.put("2026-02", 69); in.put("2026-03", 71);
        in.put("2026-04", 43); in.put("2026-05", 82); in.put("2026-06", 3);

        List<Record> recs = LoopEngine.runSeries("3001156859", "PS01080160", in);

        // period, gap, gap_pct, state, actual_status
        Object[][] gold = {
            {"2026-01",   6,    8, "超",     "ok"},
            {"2026-02", -11,  -14, "欠",     "ok"},
            {"2026-03",  -9,  -11, "欠",     "ok"},
            {"2026-04", -37,  -46, "欠-命门", "ok"},
            {"2026-05",   2,    2, "超",     "ok"},   // ★ 2.5%→2(HALF_EVEN)·若得3则Java取整错了
            {"2026-06", null, null, "半月",   "partial"},
        };

        assertEquals(gold.length, recs.size(), "记录条数应=6");
        for (int i = 0; i < gold.length; i++) {
            Record r = recs.get(i);
            assertEquals(gold[i][0], r.period,        "period@" + i);
            assertEquals(gold[i][1], r.gap,           "gap@" + r.period);
            assertEquals(gold[i][2], r.gap_pct,       "gap_pct@" + r.period + " (5月最易因取整分叉)");
            assertEquals(gold[i][3], r.state,         "state@" + r.period);
            assertEquals(gold[i][4], r.actual_status, "actual_status@" + r.period);
        }

        // no_data/半月 期:绝不写 0
        Record jun = recs.get(5);
        assertNull(jun.gap, "6月 gap 必须 null,不能是0");
        assertEquals("partial", jun.actual_status);
        assertNotNull(jun.gap_day, "6月半月应有日销率差 gap_day");

        // 命门=单期 state(非 argmin):全程只有4月
        List<String> crit = new ArrayList<>();
        for (Record r : recs) if ("欠-命门".equals(r.state)) crit.add(r.period);
        assertEquals(List.of("2026-04"), crit, "命门应只4月(读 state,非序列最负)");
    }

    @Test
    void 取整坑回归_2点5百分号必须等于2() {
        // 直接锁死那个跨语言坑:HALF_EVEN(2.5)=2,不是3
        assertEquals(2, LoopEngine.halfEvenRound(2.5), "HALF_EVEN(2.5) 必须=2;若=3则用了HALF_UP");
        assertEquals(2, LoopEngine.halfEvenRound(2 / 80.0 * 100), "5月 2/80=2.5% 必须取整为2");
    }
}
