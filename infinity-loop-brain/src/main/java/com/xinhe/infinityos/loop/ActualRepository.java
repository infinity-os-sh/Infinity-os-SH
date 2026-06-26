package com.xinhe.infinityos.loop;

import java.util.LinkedHashMap;

/**
 * 量实↑ 取数口 —— 引擎只认这个接口,数据源可换(汉询/IPO10/POS)。
 * 返回:period("2026-04") -> 实际瓶数(sell-in,多行已聚合求和)。无该期 → 不放进 map(=no_data)。
 */
public interface ActualRepository {
    LinkedHashMap<String, Integer> monthlyActual(String storeId, String skuId, String year);
}

/* ───────────────────────────────────────────────────────────
 实现骨架(开发填这个)· 用 JdbcTemplate 接汉询/Hologres。SQL 见 sql/ipo10_monthly_actual.sql
 ───────────────────────────────────────────────────────────

@org.springframework.stereotype.Repository
class HanxunActualRepository implements ActualRepository {

    private final org.springframework.jdbc.core.JdbcTemplate jdbc;
    HanxunActualRepository(org.springframework.jdbc.core.JdbcTemplate jdbc){ this.jdbc = jdbc; }

    @Override
    public LinkedHashMap<String,Integer> monthlyActual(String storeId, String skuId, String year){
        // ★ 口径:r_actual = IPO10 门店出货量(基本单位_瓶),按 店×SKU×月 聚合求和(多行→SUM)
        // ★ no_data:某月无行 → 不放进 map(引擎据此出 no_data,绝不写 0)
        String sql =
          "SELECT period, SUM(actual_bottles) AS qty " +
          "FROM ipo10_sales " +                       // ← 换成真实表/视图名
          "WHERE store_id = ? AND sku_id = ? AND period LIKE ? " +
          "GROUP BY period ORDER BY period";
        LinkedHashMap<String,Integer> out = new LinkedHashMap<>();
        jdbc.query(sql, rs -> {
            String ym = rs.getString("period");        // 形如 202604 → 转 "2026-04"
            String period = ym.substring(0,4) + "-" + ym.substring(4,6);
            out.put(period, rs.getInt("qty"));
        }, storeId, skuId, year + "%");
        return out;
    }
}
─────────────────────────────────────────────────────────── */
