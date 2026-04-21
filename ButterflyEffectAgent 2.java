package com.xinhe.infinityos.agent;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * ════════════════════════════════════════════════════════════
 * 蝴蝶效应Agent · Java代码骨架
 * ════════════════════════════════════════════════════════════
 * 
 * 设计:Agent · 2026.04.21
 * 用途:每周一07:00自动检测全网失真·分类A/B/C/D四类
 * 
 * 业务逻辑:
 *   A类·压货失真·SAP发货大·Dcloud出货小·POS销量小
 *   B类·促销扰动·POS突然飙升·有促销活动·非真实需求
 *   C类·窜货失真·Dcloud出货地区 ≠ 汉询销售地区
 *   D类·战略偏离·POS持续跑赢计划30%以上(正向异常)
 * 
 * Tech Lead:复杂度比A值校准高·因为要跨3个数据源对账
 * ════════════════════════════════════════════════════════════
 */
@Component
public class ButterflyEffectAgent {
    
    private static final Logger log = LoggerFactory.getLogger(ButterflyEffectAgent.class);
    
    @Autowired private NodeRepository nodeRepository;
    @Autowired private HeartbeatRepository heartbeatRepository;
    @Autowired private SapDataService sapDataService;
    @Autowired private DcloudDataService dcloudDataService;
    @Autowired private HanxunDataService hanxunDataService;
    @Autowired private AlertService alertService;
    @Autowired private ClaudeApiService claudeApiService;  // 调Claude API做诊断
    
    @Value("${infinity.thresholds.a_class}") private BigDecimal aClassThreshold;  // 默认0.5
    @Value("${infinity.thresholds.b_class}") private BigDecimal bClassThreshold;  // 默认2.0
    @Value("${infinity.thresholds.c_class}") private BigDecimal cClassDistance;   // 默认500km
    @Value("${infinity.thresholds.d_class}") private BigDecimal dClassThreshold;  // 默认1.3
    
    /**
     * 主入口·每周一07:00执行(A值校准之后跑·依赖最新心跳数据)
     */
    @Scheduled(cron = "0 0 7 * * MON")
    public void runWeeklyDistortionDetection() {
        log.info("═══ 蝴蝶效应Agent启动·{}", LocalDate.now());
        
        try {
            List<Node> nodes = nodeRepository.findAllActive();
            
            int aClassCount = 0, bClassCount = 0, cClassCount = 0, dClassCount = 0;
            
            for (Node node : nodes) {
                // 4类失真检测·并行检查
                List<DistortionFinding> findings = new ArrayList<>();
                
                findings.add(detectClassA(node));  // A·压货
                findings.add(detectClassB(node));  // B·促销扰动
                findings.add(detectClassC(node));  // C·窜货
                findings.add(detectClassD(node));  // D·战略偏离
                
                // 处理发现
                for (DistortionFinding finding : findings) {
                    if (finding != null && finding.isPositive()) {
                        // 调用Claude API做深度诊断
                        String diagnosis = claudeApiService.diagnose(finding);
                        String recommendation = claudeApiService.recommend(finding);
                        
                        // 创建预警
                        Alert alert = buildAlert(node, finding, diagnosis, recommendation);
                        alertService.save(alert);
                        
                        switch (finding.getDistortionType()) {
                            case "A": aClassCount++; break;
                            case "B": bClassCount++; break;
                            case "C": cClassCount++; break;
                            case "D": dClassCount++; break;
                        }
                    }
                }
            }
            
            log.info("═══ 蝴蝶效应检测完成·A压货{}·B促销扰动{}·C窜货{}·D战略偏离{}",
                aClassCount, bClassCount, cClassCount, dClassCount);
            
        } catch (Exception e) {
            log.error("蝴蝶效应Agent全局失败", e);
            alertService.createSystemAlert("蝴蝶效应Agent宕机", e.getMessage());
        }
    }
    
    /**
     * A类·压货失真检测
     * 逻辑:SAP发货量大 vs Dcloud出货量小 vs POS销量小 → 经销商在压货
     */
    private DistortionFinding detectClassA(Node node) {
        LocalDate today = LocalDate.now();
        LocalDate sevenDaysAgo = today.minusDays(7);
        
        BigDecimal sapShipped = sapDataService.getShipmentSum(
            node.getSkuCode(), node.getDistributorCode(), sevenDaysAgo, today);
        BigDecimal dcloudOutflow = dcloudDataService.getOutflowSum(
            node.getDistributorCode(), node.getSkuCode(), sevenDaysAgo, today);
        BigDecimal hanxunPos = hanxunDataService.getPosSumForDistributor(
            node.getDistributorCode(), node.getSkuCode(), sevenDaysAgo, today);
        
        if (sapShipped.compareTo(BigDecimal.valueOf(100)) < 0) {
            return null;  // 数据量太小·跳过
        }
        
        // 出货比例·应该接近1.0
        BigDecimal outflowRatio = dcloudOutflow.divide(sapShipped, 4, BigDecimal.ROUND_HALF_UP);
        BigDecimal posRatio = hanxunPos.divide(sapShipped, 4, BigDecimal.ROUND_HALF_UP);
        
        // A类判断:出货<50%发货 AND POS<30%发货
        if (outflowRatio.compareTo(aClassThreshold) < 0 
            && posRatio.compareTo(BigDecimal.valueOf(0.30)) < 0) {
            
            DistortionFinding finding = new DistortionFinding();
            finding.setNodeId(node.getNodeId());
            finding.setDistortionType("A");
            finding.setSeverity(calculateSeverity(outflowRatio, BigDecimal.valueOf(0.30)));
            finding.setEvidence(Map.of(
                "sap_shipped", sapShipped,
                "dcloud_outflow", dcloudOutflow,
                "hanxun_pos", hanxunPos,
                "outflow_ratio", outflowRatio,
                "pos_ratio", posRatio
            ));
            return finding;
        }
        return null;
    }
    
    /**
     * B类·促销扰动检测
     * 逻辑:POS突然飙升 + 当时有促销活动 → 不是真实需求
     */
    private DistortionFinding detectClassB(Node node) {
        LocalDate today = LocalDate.now();
        
        // 昨天POS vs 上周同期
        BigDecimal yesterdayPos = hanxunDataService.getPosSum(
            node.getStoreId(), node.getSkuCode(), today.minusDays(1));
        BigDecimal lastWeekSameDay = hanxunDataService.getPosSum(
            node.getStoreId(), node.getSkuCode(), today.minusDays(8));
        
        if (lastWeekSameDay.compareTo(BigDecimal.ZERO) <= 0) return null;
        
        BigDecimal growthRatio = yesterdayPos.divide(lastWeekSameDay, 4, BigDecimal.ROUND_HALF_UP);
        
        // 增长>2倍 + 有促销 = B类
        if (growthRatio.compareTo(bClassThreshold) > 0) {
            boolean hasPromotion = hanxunDataService.hasActivePromotion(
                node.getStoreId(), node.getSkuCode(), today.minusDays(1));
            
            if (hasPromotion) {
                DistortionFinding finding = new DistortionFinding();
                finding.setNodeId(node.getNodeId());
                finding.setDistortionType("B");
                finding.setSeverity(2);
                finding.setEvidence(Map.of(
                    "yesterday_pos", yesterdayPos,
                    "last_week_same_day", lastWeekSameDay,
                    "growth_ratio", growthRatio,
                    "has_promotion", true
                ));
                return finding;
            }
        }
        return null;
    }
    
    /**
     * C类·窜货失真检测
     * 逻辑:Dcloud出货地区 ≠ 汉询销售地区·距离>500km
     */
    private DistortionFinding detectClassC(Node node) {
        // 简化版·完整逻辑需要查d_outflow.receiver_region vs ods_hx_pos.store_region
        List<OutflowRecord> outflows = dcloudDataService.getRecentOutflows(
            node.getDistributorCode(), node.getSkuCode(), LocalDate.now().minusDays(7));
        
        for (OutflowRecord outflow : outflows) {
            String receiverRegion = outflow.getReceiverRegion();
            String distributorRegion = node.getProvince();
            
            // 跨大区出货·疑似窜货
            if (!receiverRegion.equals(distributorRegion)) {
                BigDecimal distance = calculateRegionDistance(distributorRegion, receiverRegion);
                
                if (distance.compareTo(cClassDistance) > 0) {
                    DistortionFinding finding = new DistortionFinding();
                    finding.setNodeId(node.getNodeId());
                    finding.setDistortionType("C");
                    finding.setSeverity(3);  // 高
                    finding.setEvidence(Map.of(
                        "distributor_region", distributorRegion,
                        "receiver_region", receiverRegion,
                        "distance_km", distance,
                        "outflow_qty", outflow.getQty()
                    ));
                    return finding;
                }
            }
        }
        return null;
    }
    
    /**
     * D类·战略偏离检测(正向异常)
     * 逻辑:POS持续跑赢计划30%以上 → 战略机会·要追加投入
     */
    private DistortionFinding detectClassD(Node node) {
        LocalDate today = LocalDate.now();
        BigDecimal rTarget = node.getRTarget();
        if (rTarget == null || rTarget.compareTo(BigDecimal.ZERO) <= 0) return null;
        
        // 过去14天的r_actual平均
        BigDecimal avgRActual = heartbeatRepository.getAvgRActual(
            node.getNodeId(), today.minusDays(14), today);
        
        if (avgRActual == null) return null;
        
        BigDecimal achieveRatio = avgRActual.divide(rTarget, 4, BigDecimal.ROUND_HALF_UP);
        
        // 连续2周>1.3倍目标
        if (achieveRatio.compareTo(dClassThreshold) > 0) {
            DistortionFinding finding = new DistortionFinding();
            finding.setNodeId(node.getNodeId());
            finding.setDistortionType("D");
            finding.setSeverity(1);  // 低·但要关注
            finding.setEvidence(Map.of(
                "r_target", rTarget,
                "r_actual_avg_14d", avgRActual,
                "achieve_ratio", achieveRatio
            ));
            return finding;
        }
        return null;
    }
    
    private int calculateSeverity(BigDecimal actual, BigDecimal threshold) {
        BigDecimal deviation = threshold.subtract(actual).divide(threshold, 2, BigDecimal.ROUND_HALF_UP);
        if (deviation.compareTo(BigDecimal.valueOf(0.5)) > 0) return 4;  // 紧急
        if (deviation.compareTo(BigDecimal.valueOf(0.3)) > 0) return 3;  // 高
        return 2;  // 中
    }
    
    private BigDecimal calculateRegionDistance(String regionA, String regionB) {
        // 调用地理API或预存映射表·返回公里数
        // 这里需要Tech Lead集成高德/百度地图API
        return BigDecimal.valueOf(800);  // 示例值
    }
    
    private Alert buildAlert(Node node, DistortionFinding finding, String diagnosis, String recommendation) {
        Alert alert = new Alert();
        alert.setNodeId(node.getNodeId());
        alert.setAlertType(finding.getDistortionType() + "_CLASS_DISTORTION");
        alert.setSeverity(finding.getSeverity());
        alert.setAgentDiagnosis(diagnosis);
        alert.setAgentRecommendation(recommendation);
        alert.setAgentConfidence(85);  // Agent置信度·后续学习调整
        alert.setStatus("pending");
        // evidence序列化为JSON存入trigger_value/expected_value字段
        return alert;
    }
}

class DistortionFinding {
    private String nodeId;
    private String distortionType;
    private int severity;
    private Map<String, Object> evidence;
    
    public boolean isPositive() { return distortionType != null; }
    
    // getters/setters...
    public String getNodeId() { return nodeId; }
    public void setNodeId(String s) { this.nodeId = s; }
    public String getDistortionType() { return distortionType; }
    public void setDistortionType(String s) { this.distortionType = s; }
    public int getSeverity() { return severity; }
    public void setSeverity(int i) { this.severity = i; }
    public Map<String, Object> getEvidence() { return evidence; }
    public void setEvidence(Map<String, Object> m) { this.evidence = m; }
}

/* ════════════════════════════════════════════════════════════
   Tech Lead接手指南:
   
   1. 阈值配置·写入application.yml:
      infinity:
        thresholds:
          a_class: 0.5     # A类:出货<50%发货
          b_class: 2.0     # B类:增长>200%
          c_class: 500     # C类:跨区>500km
          d_class: 1.3     # D类:超目标30%
   
   2. ClaudeApiService是关键·Tech Lead要包装:
      public String diagnose(DistortionFinding finding) {
          String prompt = "节点" + finding.getNodeId() + "出现" 
              + finding.getDistortionType() + "类失真·证据" 
              + JSON.toJSONString(finding.getEvidence()) 
              + "·请用2-3句话诊断";
          return claudeClient.complete(prompt);
      }
   
   3. 每周一07:00跑·正好在A值校准(06:00)之后·拿到最新心跳
   
   4. 性能:5万节点 × 4类检测 = 20万次判断·单机Java 5-8分钟跑完
   ════════════════════════════════════════════════════════════ */
