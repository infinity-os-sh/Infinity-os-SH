package com.xinhe.infinityos.loop;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

/**
 * 端到端·DB 接数(开发①②③)验收门:
 *  [2] 接数真:GET /loop/series(走 HanxunActualRepository→H2)→ 1-5月 gap=+6/-11/-9/-37/+2,6月 partial
 *  [3] 配置活:青岛(只在 loop_config 表、不在内联兜底)能跑通 → 证明 DB 装载路径 + 1引擎N插
 *  [5] 取整对:5月 gap_pct=2(非3)
 * 整链路:Controller → ActualRepository(JdbcTemplate/H2) → LoopEngine(配置由 LoopConfigLoader 从 DB 装)。
 */
@SpringBootTest
class LoopSeriesIntegrationTest {

    @Autowired
    LoopController controller;

    @Autowired
    JdbcTemplate jdbc;

    @Test
    void 接数真_福海路_走DB与引擎() {
        List<Record> recs = controller.series("3001156859", "PS01080160", "2026");

        assertEquals(6, recs.size(), "应 6 期(1-6月)");

        // 1 月由两行 40+46 聚合 SUM=86 → gap=+6,证明多行求和
        assertEquals(86, recs.get(0).r_actual_raw, "1月应 SUM(40,46)=86");

        Integer[] gaps = {6, -11, -9, -37, 2, null};
        for (int i = 0; i < gaps.length; i++) {
            assertEquals(gaps[i], recs.get(i).gap, "gap@" + recs.get(i).period);
        }

        // [5] 取整对:5月 2/80=2.5% → HALF_EVEN → 2(非3)
        assertEquals(2, recs.get(4).gap_pct, "5月 gap_pct 必须=2(HALF_EVEN)");
        assertEquals("超", recs.get(4).state);

        // 6月半月:partial,gap=null,绝不写 0
        Record jun = recs.get(5);
        assertEquals("partial", jun.actual_status);
        assertNull(jun.gap, "6月 gap 必须 null");
        assertEquals("半月", jun.state);

        // 命门=单期 state,只 4 月
        assertEquals("欠-命门", recs.get(3).state);
    }

    @Test
    void 配置活_青岛只在DB表_加一行即跑通_引擎未改() {
        // 青岛 3001156860 不在 LoopConfig 内联兜底,仅在 loop_config 表 → 必须由 DB 装载才有配置
        List<Record> recs = controller.series("3001156860", "PS01080160", "2026");

        assertEquals(6, recs.size());
        // 配置确实来自 DB 那一行(store_name/target 取自 loop_config)
        assertEquals("青岛大润发香港中路店", recs.get(0).store_name, "配置应来自 DB loop_config 行");
        assertEquals(60, recs.get(0).r_target, "target 取自 DB 的 r_target_topdown");
        // 算账:66-60=+6,30-60=-30(命门 -50%≤-40)
        assertEquals(6, recs.get(0).gap);
        assertEquals("欠-命门", recs.get(3).state, "4月 30/60=-50% 应命门");
    }

    // 流程闭环增量·端到端:GET 路径走 LoopService(读 response_execution 回填 + 落 rule_learning_log)
    @Test
    void 闭环留痕_命门应对有效种子入库() {
        // response_execution 已 seed 福海路 4月=done → 5月 closure=应对有效(②从DB回填)
        List<Record> recs = controller.series("3001156859", "PS01080160", "2026");
        assertEquals("应对有效", recs.get(4).closure.verdict, "DB回填4月done → 5月应对有效");

        // ① rule_learning_log 落「命门→查陈列/缺货/竞品价→应对有效」种子(验收①)
        Map<String, Object> seed = jdbc.queryForMap(
                "SELECT scenario, response, effect FROM rule_learning_log " +
                "WHERE store_id=? AND sku_id=? AND period=?",
                "3001156859", "PS01080160", "2026-05");
        assertEquals("欠-命门", seed.get("scenario"));
        assertEquals("查陈列/缺货/竞品价", seed.get("response"));
        assertEquals("应对有效", seed.get("effect"));
    }
}
