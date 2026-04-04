package com.xinhe.sfa.inventory;

/**
 * 心跳公式计算器
 * INFINITY OS · 库存心跳系统 v2.0
 *
 * 核心公式：
 *   a = r × T  （心跳单元 = 日销率 × 周期天数）
 *   水位 = 总库存 ÷ a
 *
 * 三层水位：
 *   ≥ 3a = 满仓（安全）
 *   2a ~ 3a = 正常
 *   1a ~ 2a = 预警，触发补货
 *   < 1a = 危险，货架领地失守
 */
public class HeartbeatCalculator {

    // 门店等级对应的周期T（天）
    public static int getTByGrade(String grade) {
        switch (grade) {
            case "S+": return 7;
            case "S":  return 7;
            case "A":  return 7;
            case "B":  return 14;
            case "C":  return 21;
            case "D":  return 30;
            default:   return 14;
        }
    }

    // 门店等级对应的拜访频次描述
    public static String getVisitFrequency(String grade) {
        switch (grade) {
            case "S+": return "3次/周";
            case "S":  return "2次/周";
            case "A":  return "1次/周";
            case "B":  return "每两周";
            case "C":  return "每三周";
            case "D":  return "每月";
            default:   return "未知";
        }
    }

    /**
     * 计算结果数据类
     */
    public static class Result {
        public float dailySalesRate;   // r：日销率（瓶/天）
        public int cycleT;             // T：周期天数
        public float heartbeatUnit;    // a：心跳单元（瓶）
        public int shelfBottles;       // 货架库存（瓶）
        public int warehouseBottles;   // 仓库库存（瓶，已换算）
        public int totalBottles;       // 总库存（瓶）
        public float waterLevel;       // 水位（a的倍数）
        public WaterStatus status;     // 水位状态
        public int replenishNeeded;    // 建议补货量（瓶）
        public int replenishCases;     // 建议补货量（箱）
        public String advice;          // 补货建议文字
        public String formulaDetail;   // 公式计算过程（用于展示）

        public enum WaterStatus {
            SAFE,       // ≥ 3a 安全
            NORMAL,     // 2a ~ 3a 正常
            WARNING,    // 1a ~ 2a 预警
            DANGER      // < 1a 危险
        }
    }

    /**
     * 核心计算方法
     *
     * @param dailySalesRate  日销率 r（瓶/天）
     * @param grade           门店等级（S+/S/A/B/C/D）
     * @param shelfQty        货架库存（瓶）
     * @param warehouseQty    仓库库存（箱）
     * @param bottlesPerCase  每箱瓶数
     * @return 计算结果
     */
    public static Result calculate(
            float dailySalesRate,
            String grade,
            int shelfQty,
            int warehouseQty,
            int bottlesPerCase) {

        Result result = new Result();

        // 基础参数
        result.dailySalesRate = dailySalesRate;
        result.cycleT = getTByGrade(grade);
        result.shelfBottles = shelfQty;
        result.warehouseBottles = warehouseQty * bottlesPerCase;
        result.totalBottles = result.shelfBottles + result.warehouseBottles;

        // 心跳单元 a = r × T
        result.heartbeatUnit = dailySalesRate * result.cycleT;

        // 水位 = 总库存 ÷ a
        if (result.heartbeatUnit > 0) {
            result.waterLevel = result.totalBottles / result.heartbeatUnit;
        } else {
            result.waterLevel = 0;
        }

        // 判断水位状态
        if (result.waterLevel >= 3.0f) {
            result.status = Result.WaterStatus.SAFE;
            result.replenishNeeded = 0;
            result.replenishCases = 0;
            result.advice = String.format(
                "库存充足，货架%.0f瓶约%.1f天消耗，正常跟进。",
                (float) shelfQty,
                shelfQty / Math.max(dailySalesRate, 0.1f));
        } else if (result.waterLevel >= 2.0f) {
            result.status = Result.WaterStatus.NORMAL;
            int daysToWarning = (int) ((result.totalBottles - result.heartbeatUnit * 2) / Math.max(dailySalesRate, 0.1f));
            result.replenishNeeded = 0;
            result.replenishCases = 0;
            result.advice = String.format("库存正常，约%d天后将触及预警线，注意观察。", daysToWarning);
        } else if (result.waterLevel >= 1.0f) {
            result.status = Result.WaterStatus.WARNING;
            result.replenishNeeded = (int) Math.ceil(result.heartbeatUnit * 3 - result.totalBottles);
            result.replenishCases = (int) Math.ceil((float) result.replenishNeeded / bottlesPerCase);
            result.advice = String.format(
                "⚠️ 已触发补货预警！建议立即补货 %d瓶（%d箱），补至3a满仓水位。",
                result.replenishNeeded, result.replenishCases);
        } else {
            result.status = Result.WaterStatus.DANGER;
            result.replenishNeeded = (int) Math.ceil(result.heartbeatUnit * 3 - result.totalBottles);
            result.replenishCases = (int) Math.ceil((float) result.replenishNeeded / bottlesPerCase);
            result.advice = String.format(
                "🔴 严重缺货！货架领地已失守。紧急补货 %d瓶（%d箱）。",
                result.replenishNeeded, result.replenishCases);
        }

        // 公式展示文字
        result.formulaDetail = String.format(
            "r = %.0f瓶/天\nT = %d天（%s级周期）\na = r×T = %.0f×%d = %.0f瓶\n货架%d瓶 + 仓库%d瓶 = 合计%d瓶\n水位 = %d ÷ %.0f = %.2fa\n3a满仓线 = %.0f瓶  |  2a预警线 = %.0f瓶",
            dailySalesRate,
            result.cycleT, grade,
            dailySalesRate, result.cycleT, result.heartbeatUnit,
            shelfQty, result.warehouseBottles, result.totalBottles,
            result.totalBottles, result.heartbeatUnit, result.waterLevel,
            result.heartbeatUnit * 3, result.heartbeatUnit * 2);

        return result;
    }
}
