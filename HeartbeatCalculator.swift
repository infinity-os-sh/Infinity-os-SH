// HeartbeatCalculator.swift
// INFINITY OS · 库存心跳系统 v2.0
//
// 核心公式：
//   a = r × T  （心跳单元 = 日销率 × 周期天数）
//   水位 = 总库存 ÷ a

import Foundation

struct HeartbeatCalculator {

    // 水位状态
    enum WaterStatus {
        case safe       // ≥ 3a
        case normal     // 2a ~ 3a
        case warning    // 1a ~ 2a
        case danger     // < 1a

        var color: String {
            switch self {
            case .safe, .normal: return "#4ADE80"
            case .warning:       return "#F5A623"
            case .danger:        return "#FF5F5F"
            }
        }

        var badgeText: String {
            switch self {
            case .safe:    return "✅ 安全水位"
            case .normal:  return "🟡 接近预警"
            case .warning: return "⚠️ 补货预警"
            case .danger:  return "🔴 危险缺货"
            }
        }
    }

    // 计算结果
    struct Result {
        let dailySalesRate: Double      // r：日销率
        let cycleT: Int                 // T：周期天数
        let heartbeatUnit: Double       // a = r × T
        let shelfBottles: Int           // 货架库存（瓶）
        let warehouseBottles: Int       // 仓库库存（瓶，已换算）
        let totalBottles: Int           // 合计
        let waterLevel: Double          // 水位倍数
        let status: WaterStatus         // 状态
        let replenishNeeded: Int        // 建议补货（瓶）
        let replenishCases: Int         // 建议补货（箱）
        let advice: String              // 补货建议文字
        let formulaDetail: String       // 公式展示
    }

    // 门店等级 → 周期T
    static func cycleT(for grade: String) -> Int {
        switch grade {
        case "S+", "S", "A": return 7
        case "B": return 14
        case "C": return 21
        case "D": return 30
        default:  return 14
        }
    }

    // 核心计算
    static func calculate(
        dailySalesRate: Double,
        grade: String,
        shelfQty: Int,
        warehouseQty: Int,
        bottlesPerCase: Int
    ) -> Result {

        let T = cycleT(for: grade)
        let a = dailySalesRate * Double(T)           // 心跳单元
        let warehouseBottles = warehouseQty * bottlesPerCase
        let total = shelfQty + warehouseBottles
        let waterLevel = a > 0 ? Double(total) / a : 0.0

        // 判断状态
        let status: WaterStatus
        let replenishNeeded: Int
        let replenishCases: Int
        let advice: String

        if waterLevel >= 3.0 {
            status = .safe
            replenishNeeded = 0
            replenishCases = 0
            let daysLeft = dailySalesRate > 0 ? Double(shelfQty) / dailySalesRate : 0
            advice = String(format: "库存充足，货架%d瓶约%.1f天消耗，正常跟进。", shelfQty, daysLeft)
        } else if waterLevel >= 2.0 {
            status = .normal
            let daysToWarning = dailySalesRate > 0
                ? (Double(total) - a * 2.0) / dailySalesRate : 0
            replenishNeeded = 0
            replenishCases = 0
            advice = String(format: "库存正常，约%.0f天后将触及预警线，注意观察。", daysToWarning)
        } else if waterLevel >= 1.0 {
            status = .warning
            replenishNeeded = Int(ceil(a * 3.0 - Double(total)))
            replenishCases = Int(ceil(Double(replenishNeeded) / Double(bottlesPerCase)))
            advice = String(format: "⚠️ 已触发补货预警！建议立即补货 %d瓶（%d箱），补至3a满仓水位。",
                replenishNeeded, replenishCases)
        } else {
            status = .danger
            replenishNeeded = Int(ceil(a * 3.0 - Double(total)))
            replenishCases = Int(ceil(Double(replenishNeeded) / Double(bottlesPerCase)))
            advice = String(format: "🔴 严重缺货！货架领地已失守。紧急补货 %d瓶（%d箱）。",
                replenishNeeded, replenishCases)
        }

        let formulaDetail = String(format:
            "r = %.0f瓶/天\nT = %d天（%@级周期）\na = r×T = %.0f×%d = %.0f瓶\n货架%d瓶 + 仓库%d瓶 = 合计%d瓶\n水位 = %d ÷ %.0f = %.2fa\n3a满仓线 = %.0f瓶  |  2a预警线 = %.0f瓶",
            dailySalesRate, T, grade,
            dailySalesRate, T, a,
            shelfQty, warehouseBottles, total,
            total, a, waterLevel,
            a * 3, a * 2)

        return Result(
            dailySalesRate: dailySalesRate,
            cycleT: T,
            heartbeatUnit: a,
            shelfBottles: shelfQty,
            warehouseBottles: warehouseBottles,
            totalBottles: total,
            waterLevel: waterLevel,
            status: status,
            replenishNeeded: replenishNeeded,
            replenishCases: replenishCases,
            advice: advice,
            formulaDetail: formulaDetail
        )
    }
}
