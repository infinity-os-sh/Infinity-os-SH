package com.xinhe.infinityos.loop;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 编排:取数 → 装执行回填 → 跑引擎(带闭环增量)→ 留痕。
 * 执行回填(②)从 response_execution 表读(外部回填的 done/not_done);表缺失则全 unknown。
 * 上报阈值 N(④)由 loop.escalation.consecutive-n 配置(默认2)。
 */
@Service
public class LoopService {

    private static final Logger log = LoggerFactory.getLogger(LoopService.class);

    private final ActualRepository repo;
    private final JdbcTemplate jdbc;
    private final LoopLearningSink sink;
    private final int escalationN;

    public LoopService(ActualRepository repo, JdbcTemplate jdbc, LoopLearningSink sink,
                       @Value("${loop.escalation.consecutive-n:2}") int escalationN) {
        this.repo = repo;
        this.jdbc = jdbc;
        this.sink = sink;
        this.escalationN = escalationN;
    }

    public List<Record> series(String store, String sku, String year) {
        LinkedHashMap<String, Integer> actuals = repo.monthlyActual(store, sku, year);

        LoopEngine.LoopOptions opt = new LoopEngine.LoopOptions();
        opt.escalationN = escalationN;
        opt.executionByPeriod = loadExecution(store, sku);

        List<Record> recs = LoopEngine.runSeries(store, sku, actuals, opt);
        sink.persist(store, sku, recs);   // ① 规则种子 / ④ 上报信号 留痕(幂等·旁路)
        return recs;
    }

    /** ② 执行确认外部回填来源:response_execution 表(period → done/not_done)。表缺失→空。 */
    private Map<String, String> loadExecution(String store, String sku) {
        Map<String, String> out = new java.util.HashMap<>();
        try {
            jdbc.query(
                "SELECT period, response_executed FROM response_execution WHERE store_id=? AND sku_id=?",
                rs -> { out.put(rs.getString("period"), rs.getString("response_executed")); },
                store, sku);
        } catch (Exception e) {
            log.debug("response_execution 未就绪({}),执行确认全 unknown。", e.getMessage());
        }
        return out;
    }
}
