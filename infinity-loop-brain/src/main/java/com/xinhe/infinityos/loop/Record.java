package com.xinhe.infinityos.loop;

import com.fasterxml.jackson.annotation.JsonInclude;

/**
 * RECORD · 唯一真源(对齐《RECORD_schema_唯一真源_v1》)
 * 引擎 loop() 吐这个;脸 render() 读这个。谁都不另存一套。
 * flat 结构,逐期一条。命门期/半月期/无数据期形状见各字段注释。
 */
@JsonInclude(JsonInclude.Include.ALWAYS)   // null 也要吐出(no_data 期 gap=null,不能省成 0)
public class Record {
    // —— 身份(配置件) ——
    public String store_id;
    public String store_name;
    public String tier;
    public String city;
    public String sku_id;
    public String sku_name;
    public String period;        // "2026-04"
    public String unit;          // "瓶"

    // —— 定标↓ ——
    public Integer r_target;        // 自上而下·不倒推
    public String  target_status;   // "ok"
    public String  target_source;   // "top_down"

    // —— 量实↑ ——
    public Integer r_actual_raw;    // sell-in 瓶;no_data/半月期可为 null
    public String  actual_status;   // "ok" | "no_data" | "partial"
    public boolean calibrated;      // 现恒 false(待 POS 动销校)
    public String  koujing;         // "sell-in"
    public Double  avg_price;       // 真实均价(非零售20)

    // —— 算差 ——
    public Integer gap;             // 实际−预算;no_data/半月=null
    public Integer gap_pct;         // 【HALF_EVEN 取整】no_data/半月=null
    public String  state;           // 超|达|欠|欠-命门|半月|无数据
    public String  response;        // 关差·规则命中

    // —— 半月专用(actual_status=partial 时填) ——
    public Integer days_elapsed;
    public Integer days_in_period;
    public Double  gap_day;         // 日销率差(缓判依据)

    // —— 验果+学习 ——
    public Double  r_forecast;        // 预测值(算法件·现空壳)
    public String  forecast_basis;    // 方法标签 "近3月均值"(非 forecast 值本身)
    public String  forecast_status;   // "ok" | "no_data"
    public String  forecast_locked_at;// 留痕占位
    public Integer forecast_version;  // 0
    public Double  forecast_outcome;  // 留痕占位

    // —— 溯源 ——
    public String source;   // "IPO10"
    public String ts;
}
