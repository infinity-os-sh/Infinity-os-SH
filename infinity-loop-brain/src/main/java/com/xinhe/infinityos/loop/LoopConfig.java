package com.xinhe.infinityos.loop;

import java.util.*;

/**
 * 配置件(三类件之三)· 一实例一行。
 * 横向复制 = 往这里加一行,不改 LoopEngine 一个字 = 1引擎N插。
 * 生产中应外置为 DB 表 / 配置中心;此处内联仅为可直接跑通与自检。
 */
public class LoopConfig {
    public String store_name, tier, city, sku_name, unit;
    public double avg_price;
    public int    r_target_topdown;          // 自上而下·不倒推
    public Set<String> closed_periods;       // 已结期
    public Map<String, int[]> partial_periods;// period -> [days_elapsed, days_in_period]
    public int    anomaly_floor;             // 异常守门下限(瓶)

    private static final Map<String, LoopConfig> TABLE = new HashMap<>();

    static {
        LoopConfig fh = new LoopConfig();
        fh.store_name = "烟台大润发福海路店"; fh.tier = "VP"; fh.city = "烟台";
        fh.sku_name = "六月鲜特级原汁酱油2.0版"; fh.unit = "瓶"; fh.avg_price = 13.68;
        fh.r_target_topdown = 80;
        fh.closed_periods = new HashSet<>(Arrays.asList(
                "2026-01","2026-02","2026-03","2026-04","2026-05"));
        fh.partial_periods = new HashMap<>();
        fh.partial_periods.put("2026-06", new int[]{15, 30});  // 已过15/共30天
        fh.anomaly_floor = 20;
        TABLE.put("3001156859|PS01080160", fh);

        // 横向复制示例:再加一行即多一个店×SKU(青岛)。打开即生效,不改引擎。
        // LoopConfig qd = new LoopConfig(); ... TABLE.put("0031000766|PS01080160", qd);
    }

    public static LoopConfig get(String storeId, String skuId) {
        LoopConfig c = TABLE.get(storeId + "|" + skuId);
        if (c == null) throw new IllegalArgumentException("无配置: " + storeId + "|" + skuId);
        return c;
    }
    public static Set<String> keys() { return TABLE.keySet(); }

    /**
     * 外置配置入口(开发②):由 LoopConfigLoader 在启动/重载时,把 DB 表 loop_config
     * 的每一行注册进静态表。同 key 覆盖。引擎仍只读静态 get(),一字不改 = 1引擎N插。
     * 上面的内联 static 块仅为「自检默认 + 无库兜底」的样例;生产以 DB 表为准。
     */
    public static void register(String storeId, String skuId, LoopConfig c) {
        TABLE.put(storeId + "|" + skuId, c);
    }
}
