package com.xinhe.infinityos.loop;

/**
 * 学习样本 · 只追加(append-only),永不改。
 * 异常期(is_anomaly)不产样本(sample=null)。
 */
public class LearningSample {
    public String  store_id;
    public String  sku_id;
    public String  period;
    public String  basis;     // "近3月均值"
    public Double  forecast;
    public Integer actual;
    public Double  error;     // actual - forecast(保留1位)
    public String  reason;    // 主管填·现空

    public LearningSample(String store_id, String sku_id, String period,
                          String basis, Double forecast, Integer actual, Double error, String reason) {
        this.store_id = store_id; this.sku_id = sku_id; this.period = period;
        this.basis = basis; this.forecast = forecast; this.actual = actual;
        this.error = error; this.reason = reason;
    }
}
