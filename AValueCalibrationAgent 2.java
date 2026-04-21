package com.xinhe.infinityos.agent;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

/**
 * ════════════════════════════════════════════════════════════
 * A值校准Agent · Java代码骨架
 * ════════════════════════════════════════════════════════════
 * 
 * 设计:Agent · 2026.04.21
 * 用途:每周一06:00自动校准全网节点的a值(心跳基准)
 * 
 * 业务逻辑:
 *   a值 = 过去7天发货量 / 7
 *   r_actual = 今天销量 / 1
 *   水位 = 当前库存 / a值
 * 
 * Tech Lead:这是骨架·业务逻辑全在这里
 *           适配公司Spring Boot版本+日志框架后即可上线
 * ════════════════════════════════════════════════════════════
 */
@Component
public class AValueCalibrationAgent {
    
    private static final Logger log = LoggerFactory.getLogger(AValueCalibrationAgent.class);
    
    @Autowired
    private NodeRepository nodeRepository;
    
    @Autowired
    private HeartbeatRepository heartbeatRepository;
    
    @Autowired
    private SapDataService sapDataService;        // 从SAP MB51查发货数据
    
    @Autowired
    private DcloudDataService dcloudDataService;  // 从Dcloud查经销商出货
    
    @Autowired
    private HanxunDataService hanxunDataService;  // 从汉询查POS销售
    
    @Autowired
    private AlertService alertService;
    
    /**
     * 主入口·每周一06:00执行
     * Cron表达式:秒 分 时 日 月 周
     */
    @Scheduled(cron = "0 0 6 * * MON")
    public void runWeeklyCalibration() {
        log.info("═══ A值校准Agent启动·{}", LocalDate.now());
        
        try {
            // Step 1·获取所有活跃节点
            List<Node> activeNodes = nodeRepository.findAllActive();
            log.info("待校准节点数:{}", activeNodes.size());
            
            int success = 0;
            int failed = 0;
            int alertsCreated = 0;
            
            // Step 2·遍历每个节点·校准a值
            for (Node node : activeNodes) {
                try {
                    CalibrationResult result = calibrateNode(node);
                    
                    if (result.isAnomalous()) {
                        // 校准发现异常·创建预警
                        Alert alert = createCalibrationAlert(node, result);
                        alertService.save(alert);
                        alertsCreated++;
                    }
                    
                    // 写入心跳表
                    saveHeartbeat(node, result);
                    success++;
                    
                } catch (Exception e) {
                    log.error("节点{}校准失败:{}", node.getNodeId(), e.getMessage());
                    failed++;
                }
            }
            
            log.info("═══ A值校准完成·成功{}·失败{}·预警{}", success, failed, alertsCreated);
            
        } catch (Exception e) {
            log.error("A值校准Agent全局失败", e);
            // 触发系统级告警·通知DevOps
            alertService.createSystemAlert("A值校准Agent宕机", e.getMessage());
        }
    }
    
    /**
     * 单个节点的校准逻辑·这是核心算法
     */
    private CalibrationResult calibrateNode(Node node) {
        LocalDate today = LocalDate.now();
        LocalDate sevenDaysAgo = today.minusDays(7);
        
        // ── 1.从SAP取过去7天发货量(分子) ──
        BigDecimal totalShipped = sapDataService.getShipmentSum(
            node.getSkuCode(),
            node.getDistributorCode(),
            sevenDaysAgo,
            today
        );
        
        // a值 = 过去7天发货量 / 7
        BigDecimal aValue = totalShipped.divide(BigDecimal.valueOf(7), 2, BigDecimal.ROUND_HALF_UP);
        
        // ── 2.从Dcloud取经销商当前库存 ──
        BigDecimal distributorStock = dcloudDataService.getCurrentStock(
            node.getDistributorCode(),
            node.getSkuCode()
        );
        
        // 水位 = 当前库存 / a值
        BigDecimal waterLevel = aValue.compareTo(BigDecimal.ZERO) > 0 
            ? distributorStock.divide(aValue, 2, BigDecimal.ROUND_HALF_UP)
            : BigDecimal.ZERO;
        
        // ── 3.从汉询取昨天POS销售(r_actual) ──
        BigDecimal yesterdayPosSales = hanxunDataService.getPosSum(
            node.getStoreId(),
            node.getSkuCode(),
            today.minusDays(1)
        );
        
        // ── 4.异常检测 ──
        boolean anomalous = false;
        String anomalyReason = null;
        
        // 检测1·a值剧变(本周vs上周差异>30%)
        BigDecimal lastWeekA = heartbeatRepository.getLastWeekAvgA(node.getNodeId());
        if (lastWeekA != null && lastWeekA.compareTo(BigDecimal.ZERO) > 0) {
            BigDecimal change = aValue.subtract(lastWeekA)
                .divide(lastWeekA, 4, BigDecimal.ROUND_HALF_UP)
                .abs();
            if (change.compareTo(BigDecimal.valueOf(0.30)) > 0) {
                anomalous = true;
                anomalyReason = "a值周变化超30%·从" + lastWeekA + "到" + aValue;
            }
        }
        
        // 检测2·水位过低(<1a)
        if (waterLevel.compareTo(BigDecimal.ONE) < 0) {
            anomalous = true;
            anomalyReason = "水位过低=" + waterLevel + "a·铁律②触发";
        }
        
        // 检测3·POS与SAP严重背离(POS只有发货的30%以下)
        BigDecimal posSapRatio = totalShipped.compareTo(BigDecimal.ZERO) > 0
            ? yesterdayPosSales.multiply(BigDecimal.valueOf(7))
                .divide(totalShipped, 2, BigDecimal.ROUND_HALF_UP)
            : BigDecimal.ZERO;
        if (posSapRatio.compareTo(BigDecimal.valueOf(0.30)) < 0 
            && totalShipped.compareTo(BigDecimal.valueOf(100)) > 0) {
            anomalous = true;
            anomalyReason = "POS/SAP比=" + posSapRatio + "·疑似A类压货失真";
        }
        
        return new CalibrationResult(
            node.getNodeId(),
            aValue,
            waterLevel,
            yesterdayPosSales,
            anomalous,
            anomalyReason
        );
    }
    
    /**
     * 写入心跳表
     */
    private void saveHeartbeat(Node node, CalibrationResult result) {
        Heartbeat hb = new Heartbeat();
        hb.setNodeId(node.getNodeId());
        hb.setDate(LocalDate.now());
        hb.setAValue(result.getAValue());
        hb.setRActual(result.getRActual());
        hb.setWaterLevelDistributor(result.getWaterLevel());
        // health_score计算·后面Agent会补充
        heartbeatRepository.save(hb);
    }
    
    /**
     * 创建校准异常预警
     */
    private Alert createCalibrationAlert(Node node, CalibrationResult result) {
        Alert alert = new Alert();
        alert.setNodeId(node.getNodeId());
        alert.setAlertType("CALIBRATION_ANOMALY");
        alert.setSeverity(2);  // 中等
        alert.setTriggerRule("a_value_calibration");
        alert.setAgentDiagnosis(result.getAnomalyReason());
        alert.setAgentRecommendation("建议人工核查·或交给蝴蝶效应Agent深度分析");
        alert.setStatus("pending");
        return alert;
    }
}

/**
 * 校准结果DTO
 */
class CalibrationResult {
    private final String nodeId;
    private final BigDecimal aValue;
    private final BigDecimal waterLevel;
    private final BigDecimal rActual;
    private final boolean anomalous;
    private final String anomalyReason;
    
    public CalibrationResult(String nodeId, BigDecimal aValue, BigDecimal waterLevel,
                              BigDecimal rActual, boolean anomalous, String anomalyReason) {
        this.nodeId = nodeId;
        this.aValue = aValue;
        this.waterLevel = waterLevel;
        this.rActual = rActual;
        this.anomalous = anomalous;
        this.anomalyReason = anomalyReason;
    }
    
    // getters省略·Lombok @Data 即可
    public String getNodeId() { return nodeId; }
    public BigDecimal getAValue() { return aValue; }
    public BigDecimal getWaterLevel() { return waterLevel; }
    public BigDecimal getRActual() { return rActual; }
    public boolean isAnomalous() { return anomalous; }
    public String getAnomalyReason() { return anomalyReason; }
}

/* ════════════════════════════════════════════════════════════
   Tech Lead接手指南:
   
   1. 把这个文件放到 src/main/java/com/xinhe/infinityos/agent/
   
   2. 创建对应的Repository接口(NodeRepository等)
      用Spring Data JPA · 5分钟搞定
   
   3. 实现3个Service:
      - SapDataService(从Hologres查MB51)
      - DcloudDataService(调Dcloud API)
      - HanxunDataService(从Hologres查ods_hx_pos)
   
   4. 测试:在application.properties里把cron改成
      cron = "* * * * * *" (每秒跑一次·调试用)
      跑通后改回每周一06:00
   
   5. 上线前确认:
      - 节点数<10万·遍历单线程能在10分钟内跑完
      - 如果>10万·改用Spring Batch分片处理
   ════════════════════════════════════════════════════════════ */
