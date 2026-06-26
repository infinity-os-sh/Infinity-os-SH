package com.xinhe.infinityos.loop;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * 闭环留痕 sink:把 ① 规则种子写 rule_learning_log、④ 上报信号写 escalation_log。
 * 纪律:只追加(append-only)、按 (store,sku,period) 幂等(已存在则跳过,避免重复跑爆表)。
 * 容错:表不存在(如生产未建表)→ 记 warn,不让 /loop/series 失败。
 */
@Component
public class LoopLearningSink {

    private static final Logger log = LoggerFactory.getLogger(LoopLearningSink.class);

    private final JdbcTemplate jdbc;

    public LoopLearningSink(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public void persist(String storeId, String skuId, List<Record> recs) {
        try {
            for (Record r : recs) {
                if (r.closure != null && r.closure.learned_rule_seed != null) {
                    insertSeed(storeId, skuId, r);
                }
                if (r.escalation != null && r.escalation.triggered) {
                    insertEscalation(storeId, skuId, r);
                }
            }
        } catch (Exception e) {
            // 表缺失/库异常都不致命:闭环留痕是旁路,主链路(出 RECORD)照常
            log.warn("闭环留痕写入跳过({}):rule_learning_log/escalation_log 可能未建表。", e.getMessage());
        }
    }

    private void insertSeed(String storeId, String skuId, Record r) {
        Integer n = jdbc.queryForObject(
                "SELECT COUNT(*) FROM rule_learning_log WHERE store_id=? AND sku_id=? AND period=?",
                Integer.class, storeId, skuId, r.period);
        if (n != null && n > 0) return;  // 幂等
        Closure.RuleSeed s = r.closure.learned_rule_seed;
        jdbc.update(
                "INSERT INTO rule_learning_log " +
                "(store_id, sku_id, period, prev_period, scenario, response, effect, gap_change) " +
                "VALUES (?,?,?,?,?,?,?,?)",
                storeId, skuId, r.period, r.closure.prev_period,
                s.scenario, s.response, s.effect, r.closure.gap_change);
    }

    private void insertEscalation(String storeId, String skuId, Record r) {
        Integer n = jdbc.queryForObject(
                "SELECT COUNT(*) FROM escalation_log WHERE store_id=? AND sku_id=? AND period=?",
                Integer.class, storeId, skuId, r.period);
        if (n != null && n > 0) return;  // 幂等
        Escalation e = r.escalation;
        jdbc.update(
                "INSERT INTO escalation_log " +
                "(store_id, sku_id, period, reason, from_level, to_level, periods_unclosed) " +
                "VALUES (?,?,?,?,?,?,?)",
                storeId, skuId, r.period, e.reason, e.from_level, e.to_level, e.periods_unclosed);
    }
}
