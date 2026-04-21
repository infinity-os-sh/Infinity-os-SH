package com.xinhe.infinityos.agent;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * ════════════════════════════════════════════════════════════
 * Omakase推单Agent · Java代码骨架
 * ════════════════════════════════════════════════════════════
 * 
 * 设计:Agent · 2026.04.21
 * 用途:每周一08:00自动给经销商推送补货建议(无菜单推单)
 * 
 * 业务逻辑:
 *   不让经销商"想要什么" · Agent告诉经销商"该要什么"
 *   依据:水位+r_target+季节性+促销日历
 *   输出:精确到SKU+数量+预计到货时间
 * 
 * Tech Lead:这是闭环最关键一环·Agent判断→人工确认→执行结果回流
 * ════════════════════════════════════════════════════════════
 */
@Component
public class OmakaseRecommendAgent {
    
    private static final Logger log = LoggerFactory.getLogger(OmakaseRecommendAgent.class);
    
    @Autowired private DistributorRepository distributorRepository;
    @Autowired private NodeRepository nodeRepository;
    @Autowired private HeartbeatRepository heartbeatRepository;
    @Autowired private ActionRepository actionRepository;
    @Autowired private DcloudDataService dcloudDataService;
    @Autowired private ClaudeApiService claudeApiService;
    @Autowired private WeChatPushService weChatPushService;  // 企微推送
    
    /**
     * 主入口·每周一08:00执行
     * (跑在A值校准06:00和蝴蝶效应07:00之后·确保数据最新)
     */
    @Scheduled(cron = "0 0 8 * * MON")
    public void runWeeklyOmakaseRecommend() {
        log.info("═══ Omakase推单Agent启动·{}", LocalDate.now());
        
        try {
            List<Distributor> distributors = distributorRepository.findAllActive();
            
            int recommendCount = 0;
            int pushCount = 0;
            
            for (Distributor distributor : distributors) {
                try {
                    // Step 1·为该经销商生成完整推单
                    OmakaseOrder order = generateOrder(distributor);
                    
                    if (order.getItems().isEmpty()) {
                        continue;  // 该经销商无需补货
                    }
                    
                    // Step 2·调Claude API生成推单话术(给销售经理看的解释)
                    String narrative = claudeApiService.generateOrderNarrative(order);
                    order.setNarrative(narrative);
                    
                    // Step 3·写入inf_actions表(待人工确认)
                    Action action = saveAction(distributor, order);
                    recommendCount++;
                    
                    // Step 4·企微推送给经销商对接销售经理
                    boolean pushed = weChatPushService.pushOmakaseOrder(
                        distributor.getSalesManagerId(),
                        order,
                        action.getId()  // 带回调ID·销售经理点确认时知道是哪一单
                    );
                    
                    if (pushed) {
                        action.setPushedAt(java.time.LocalDateTime.now());
                        actionRepository.save(action);
                        pushCount++;
                    }
                    
                } catch (Exception e) {
                    log.error("经销商{}推单失败:{}", distributor.getCode(), e.getMessage());
                }
            }
            
            log.info("═══ Omakase推单完成·生成{}单·推送{}单", recommendCount, pushCount);
            
        } catch (Exception e) {
            log.error("Omakase推单Agent全局失败", e);
        }
    }
    
    /**
     * 为单个经销商生成完整推单
     * 核心逻辑:遍历该经销商的所有节点·按水位计算补货量
     */
    private OmakaseOrder generateOrder(Distributor distributor) {
        OmakaseOrder order = new OmakaseOrder();
        order.setDistributorCode(distributor.getCode());
        order.setOrderDate(LocalDate.now());
        
        // 取该经销商的所有节点
        List<Node> nodes = nodeRepository.findByDistributor(distributor.getCode());
        
        for (Node node : nodes) {
            // 取最新心跳数据
            Heartbeat latestHb = heartbeatRepository.getLatest(node.getNodeId());
            if (latestHb == null) continue;
            
            BigDecimal aValue = latestHb.getAValue();
            BigDecimal currentStock = dcloudDataService.getCurrentStock(
                distributor.getCode(), node.getSkuCode());
            BigDecimal waterLevel = latestHb.getWaterLevelDistributor();
            
            // ── 推单决策树 ──
            
            // 决策1·水位健康(>2a) → 不推单
            if (waterLevel.compareTo(BigDecimal.valueOf(2)) >= 0) {
                continue;
            }
            
            // 决策2·水位低(1-2a) → 推单到3a
            BigDecimal targetStock;
            String urgencyTag;
            
            if (waterLevel.compareTo(BigDecimal.ONE) >= 0 
                && waterLevel.compareTo(BigDecimal.valueOf(2)) < 0) {
                targetStock = aValue.multiply(BigDecimal.valueOf(3));
                urgencyTag = "常规补货";
            }
            // 决策3·水位危险(<1a) → 推单到4a·紧急
            else if (waterLevel.compareTo(BigDecimal.ONE) < 0) {
                targetStock = aValue.multiply(BigDecimal.valueOf(4));
                urgencyTag = "紧急补货";
            } else {
                continue;
            }
            
            BigDecimal recommendQty = targetStock.subtract(currentStock)
                .setScale(0, RoundingMode.UP);  // 向上取整到瓶
            
            if (recommendQty.compareTo(BigDecimal.ZERO) <= 0) continue;
            
            // ── 季节性调整 ──
            recommendQty = applySeasonality(recommendQty, node.getSkuCode(), LocalDate.now());
            
            // ── 促销前置补货 ──
            if (hasUpcomingPromotion(node.getSkuCode(), 7)) {
                recommendQty = recommendQty.multiply(BigDecimal.valueOf(1.5))
                    .setScale(0, RoundingMode.UP);
                urgencyTag += "+促销前置";
            }
            
            // 加入推单
            OmakaseItem item = new OmakaseItem();
            item.setSkuCode(node.getSkuCode());
            item.setSkuName(node.getSkuName());
            item.setRecommendQty(recommendQty);
            item.setCurrentStock(currentStock);
            item.setAValue(aValue);
            item.setWaterLevelBefore(waterLevel);
            item.setWaterLevelAfter(currentStock.add(recommendQty)
                .divide(aValue, 2, RoundingMode.HALF_UP));
            item.setUrgencyTag(urgencyTag);
            item.setReasoning(buildReasoning(node, latestHb, recommendQty));
            
            order.addItem(item);
        }
        
        // 计算总价
        order.setTotalQty(order.getItems().stream()
            .map(OmakaseItem::getRecommendQty)
            .reduce(BigDecimal.ZERO, BigDecimal::add));
        
        return order;
    }
    
    /**
     * 季节性调整·夏季加大酱油(夏季消费多)
     */
    private BigDecimal applySeasonality(BigDecimal qty, String skuCode, LocalDate date) {
        int month = date.getMonthValue();
        BigDecimal multiplier = BigDecimal.ONE;
        
        // 6-8月 · 酱油旺季 +20%
        if (month >= 6 && month <= 8) {
            multiplier = BigDecimal.valueOf(1.2);
        }
        // 1-2月 · 春节前 +30%
        else if (month <= 2) {
            multiplier = BigDecimal.valueOf(1.3);
        }
        
        return qty.multiply(multiplier).setScale(0, RoundingMode.UP);
    }
    
    private boolean hasUpcomingPromotion(String skuCode, int daysAhead) {
        // 查促销日历·未来N天有没有大促
        // 实现略·调用ods_hx_promotion
        return false;
    }
    
    private String buildReasoning(Node node, Heartbeat hb, BigDecimal recommendQty) {
        return String.format(
            "节点%s · 当前水位%sa · 日销%s瓶 · 建议补%s瓶 · 补后水位%sa",
            node.getNodeId(),
            hb.getWaterLevelDistributor(),
            hb.getAValue(),
            recommendQty,
            hb.getWaterLevelDistributor().add(recommendQty.divide(hb.getAValue(), 2, RoundingMode.HALF_UP))
        );
    }
    
    /**
     * 写入inf_actions表
     */
    private Action saveAction(Distributor distributor, OmakaseOrder order) {
        Action action = new Action();
        action.setActionType("omakase_order");
        action.setNodeId(distributor.getCode());  // 经销商级别·没有具体节点
        action.setAgentProposal(serialize(order));  // JSON序列化整个订单
        action.setAgentReasoning(order.getNarrative());
        action.setExecutionStatus("pending");
        return actionRepository.save(action);
    }
    
    private String serialize(Object obj) {
        // 用Jackson或Gson序列化为JSON
        return "{}";  // 简化示例
    }
}

class OmakaseOrder {
    private String distributorCode;
    private LocalDate orderDate;
    private List<OmakaseItem> items = new ArrayList<>();
    private BigDecimal totalQty;
    private String narrative;
    
    public void addItem(OmakaseItem item) { items.add(item); }
    
    // getters/setters...
    public List<OmakaseItem> getItems() { return items; }
    public String getDistributorCode() { return distributorCode; }
    public void setDistributorCode(String s) { this.distributorCode = s; }
    public LocalDate getOrderDate() { return orderDate; }
    public void setOrderDate(LocalDate d) { this.orderDate = d; }
    public BigDecimal getTotalQty() { return totalQty; }
    public void setTotalQty(BigDecimal b) { this.totalQty = b; }
    public String getNarrative() { return narrative; }
    public void setNarrative(String s) { this.narrative = s; }
}

class OmakaseItem {
    private String skuCode;
    private String skuName;
    private BigDecimal recommendQty;
    private BigDecimal currentStock;
    private BigDecimal aValue;
    private BigDecimal waterLevelBefore;
    private BigDecimal waterLevelAfter;
    private String urgencyTag;
    private String reasoning;
    
    // getters/setters省略
    public BigDecimal getRecommendQty() { return recommendQty; }
    public void setRecommendQty(BigDecimal b) { this.recommendQty = b; }
    public void setSkuCode(String s) { this.skuCode = s; }
    public void setSkuName(String s) { this.skuName = s; }
    public void setCurrentStock(BigDecimal b) { this.currentStock = b; }
    public void setAValue(BigDecimal b) { this.aValue = b; }
    public void setWaterLevelBefore(BigDecimal b) { this.waterLevelBefore = b; }
    public void setWaterLevelAfter(BigDecimal b) { this.waterLevelAfter = b; }
    public void setUrgencyTag(String s) { this.urgencyTag = s; }
    public void setReasoning(String s) { this.reasoning = s; }
}

/* ════════════════════════════════════════════════════════════
   Tech Lead接手指南:
   
   1. 推单的"无菜单"哲学:
      - 传统:经销商自己填单·想要什么报什么
      - Omakase:Agent告诉经销商·该要什么+多少+为什么
      - 经销商只需要"批准"或"修改"·不再"想"
   
   2. 闭环回收(关键!):
      销售经理在企微点"批准"
        ↓ webhook回调
      更新inf_actions.human_decision = 'approve'
      更新execution_status = 'pending' → SAP下单
        ↓ 1周后到货
      汉询/Dcloud能看到实际入库
        ↓ 自动核对
      更新outcome_score(0-100)
        ↓ Agent学习
      下次推单更准
   
   3. 这是INFINITY OS最闭环的Agent·跑通=Layer 3达成
   ════════════════════════════════════════════════════════════ */
