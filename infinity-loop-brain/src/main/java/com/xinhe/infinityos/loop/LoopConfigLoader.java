package com.xinhe.infinityos.loop;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.util.*;

/**
 * 核心开发② · 配置外置 —— 把 DB 表 loop_config 的每一行装进 LoopConfig 静态表。
 *
 * 横向复制 = 往 loop_config 加一行(store×sku),启动(或调 /loop/config/reload)即生效,
 * LoopEngine 一字不改 = 1引擎N插。
 *
 * 一行 = 一个 store×sku;closed_periods / partial_periods 用 JSON 列:
 *   closed_periods  : ["2026-01","2026-02",...]
 *   partial_periods : {"2026-06":[15,30]}   // period -> [已过天数, 当月总天数]
 *
 * r_target_topdown 由业务/JBP 维护(自上而下),严禁用实际倒推回填。
 */
@Component
public class LoopConfigLoader implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(LoopConfigLoader.class);

    private final JdbcTemplate jdbc;
    private final ObjectMapper json = new ObjectMapper();

    public LoopConfigLoader(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @Override
    public void run(ApplicationArguments args) {
        try {
            int n = reload();
            log.info("loop_config 装载完成:{} 行 store×sku 已注册", n);
        } catch (Exception e) {
            // 没有 loop_config 表(如纯单测/未建表)→ 退回内联兜底样例,不致命
            log.warn("loop_config 装载失败({}),退回 LoopConfig 内联兜底配置。", e.getMessage());
        }
    }

    /** 读全表 → 注册进静态 LoopConfig。返回注册行数。供启动与 /loop/config/reload 复用。 */
    public int reload() {
        String sql = "SELECT store_id, sku_id, store_name, tier, city, sku_name, unit, " +
                "avg_price, r_target_topdown, closed_periods, partial_periods, anomaly_floor " +
                "FROM loop_config";
        List<Map<String, Object>> rows = jdbc.queryForList(sql);
        for (Map<String, Object> row : rows) {
            String storeId = str(row.get("store_id"));
            String skuId = str(row.get("sku_id"));
            LoopConfig c = new LoopConfig();
            c.store_name = str(row.get("store_name"));
            c.tier = str(row.get("tier"));
            c.city = str(row.get("city"));
            c.sku_name = str(row.get("sku_name"));
            c.unit = str(row.get("unit"));
            c.avg_price = toDouble(row.get("avg_price"));
            c.r_target_topdown = toInt(row.get("r_target_topdown"));
            c.anomaly_floor = toInt(row.get("anomaly_floor"));
            c.closed_periods = parseClosed(str(row.get("closed_periods")));
            c.partial_periods = parsePartial(str(row.get("partial_periods")));
            LoopConfig.register(storeId, skuId, c);
        }
        return rows.size();
    }

    // —— JSON 列解析 ——
    private Set<String> parseClosed(String s) {
        if (s == null || s.isBlank()) return new HashSet<>();
        try {
            return new LinkedHashSet<>(json.readValue(s, new com.fasterxml.jackson.core.type.TypeReference<List<String>>() {}));
        } catch (Exception e) {
            throw new IllegalStateException("closed_periods 非合法 JSON 数组: " + s, e);
        }
    }

    private Map<String, int[]> parsePartial(String s) {
        Map<String, int[]> out = new HashMap<>();
        if (s == null || s.isBlank()) return out;
        try {
            Map<String, List<Integer>> raw = json.readValue(
                    s, new com.fasterxml.jackson.core.type.TypeReference<Map<String, List<Integer>>>() {});
            for (Map.Entry<String, List<Integer>> e : raw.entrySet()) {
                List<Integer> v = e.getValue();
                if (v == null || v.size() != 2) {
                    throw new IllegalStateException("partial_periods 值须为 [已过天数,当月总天数]: " + e.getKey());
                }
                out.put(e.getKey(), new int[]{v.get(0), v.get(1)});
            }
        } catch (RuntimeException re) {
            throw re;
        } catch (Exception e) {
            throw new IllegalStateException("partial_periods 非合法 JSON 对象: " + s, e);
        }
        return out;
    }

    private static String str(Object o) { return o == null ? null : o.toString(); }
    private static int toInt(Object o) { return o == null ? 0 : ((Number) o).intValue(); }
    private static double toDouble(Object o) { return o == null ? 0d : ((Number) o).doubleValue(); }
}
