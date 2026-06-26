package com.xinhe.infinityos.loop;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.util.LinkedHashMap;
import java.util.regex.Pattern;

/**
 * 核心开发① · 量实↑ 真取数 —— 实现 ActualRepository,用 JdbcTemplate 连汉询/Hologres。
 *
 * 口径(v3.10 锁,见 §3 / sql/ipo10_monthly_actual.sql):
 *   r_actual = IPO10「门店出货量(基本单位_瓶)」(sell-in),按 店×SKU×月 聚合求和(多行→SUM)。
 *   某月无行 → 不放进返回 map(引擎据此出 no_data,绝不写 0)。
 *   period 形如 202604 → 转 "2026-04"。
 *
 * 表名可配:loop.hanxun.actual-table(默认 ipo10_sales)。生产换成汉询真实表/视图,不改代码。
 * 「目标」列弃用:r_target 走 top_down 配置,这里只取出货量,绝不取目标列。
 */
@Repository
public class HanxunActualRepository implements ActualRepository {

    /** 表/视图名只能是合法标识符(含 schema 点号),挡住 SQL 注入(表名走拼接,不能用占位符)。 */
    private static final Pattern SAFE_IDENT = Pattern.compile("[A-Za-z_][A-Za-z0-9_]*(\\.[A-Za-z_][A-Za-z0-9_]*)*");

    private final JdbcTemplate jdbc;
    private final String table;

    public HanxunActualRepository(JdbcTemplate jdbc,
                                  @Value("${loop.hanxun.actual-table:ipo10_sales}") String table) {
        if (!SAFE_IDENT.matcher(table).matches()) {
            throw new IllegalStateException("非法取数表名 loop.hanxun.actual-table=" + table);
        }
        this.jdbc = jdbc;
        this.table = table;
    }

    @Override
    public LinkedHashMap<String, Integer> monthlyActual(String storeId, String skuId, String year) {
        // ★ 多行聚合求和;ORDER BY period 保证升序(引擎再排一次,双保险)
        String sql =
                "SELECT period, SUM(actual_bottles) AS qty " +
                "FROM " + table + " " +
                "WHERE store_id = ? AND sku_id = ? AND period LIKE ? " +
                "GROUP BY period ORDER BY period";

        LinkedHashMap<String, Integer> out = new LinkedHashMap<>();
        jdbc.query(sql, rs -> {
            String ym = rs.getString("period");          // 形如 202604
            if (ym == null || ym.length() < 6) return;    // 脏期跳过,不喂引擎
            String period = ym.substring(0, 4) + "-" + ym.substring(4, 6);
            // ★ no_data 由「不 put」体现;此处只放真有行的月份,绝不补 0
            out.put(period, rs.getInt("qty"));
        }, storeId, skuId, year + "%");
        return out;
    }
}
