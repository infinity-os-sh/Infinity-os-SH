-- ══════════════════════════════════════════════════════════════
-- INFINITY OS · INF_NODES 表建表SQL
-- Agent交付的"现成零件"示范
-- Tech Lead拿到后·直接复制→粘贴→执行·不需要改任何一个字
-- ══════════════════════════════════════════════════════════════
-- 设计:Agent
-- 日期:2026.04.21
-- 用途:INFINITY OS核心节点数据表
-- ══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS `inf_nodes` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `node_id` VARCHAR(64) NOT NULL COMMENT '节点唯一标识 例:IPO10_SH_浦东_LYX500',
  `node_type` VARCHAR(32) NOT NULL COMMENT '节点类型 IPO0-IPO13',
  `node_name` VARCHAR(128) NOT NULL COMMENT '节点名称 例:浦东家乐福LYX500',
  
  -- SKU维度
  `sku_code` VARCHAR(32) NOT NULL COMMENT 'SKU编码 对应SAP.MARA.MATNR',
  `sku_name` VARCHAR(128) NOT NULL COMMENT 'SKU名称',
  `sku_grade` TINYINT NOT NULL DEFAULT 0 COMMENT 'SKU年级 1-4',
  
  -- 地理维度
  `province` VARCHAR(32) NOT NULL COMMENT '省',
  `city` VARCHAR(32) NOT NULL COMMENT '市',
  `district` VARCHAR(64) DEFAULT NULL COMMENT '区',
  
  -- 渠道维度
  `channel_type` VARCHAR(32) NOT NULL COMMENT '渠道类型 KA/BC/CVS/CR',
  `distributor_code` VARCHAR(32) DEFAULT NULL COMMENT '经销商编码 对应SAP.KNA1.KUNNR',
  
  -- 心跳数据
  `a_value` DECIMAL(10,2) DEFAULT NULL COMMENT 'a值 心跳单元',
  `r_target` DECIMAL(10,2) DEFAULT NULL COMMENT 'r_target 目标日销率',
  `r_actual` DECIMAL(10,2) DEFAULT NULL COMMENT 'r_actual 实际日销率',
  `water_level` DECIMAL(10,2) DEFAULT NULL COMMENT '水位 库存/a',
  
  -- 时间戳
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `last_heartbeat_at` DATETIME DEFAULT NULL COMMENT '最后心跳时间',
  
  -- 状态
  `status` TINYINT NOT NULL DEFAULT 1 COMMENT '状态 1=正常 0=停用 -1=预警',
  `health_score` TINYINT DEFAULT NULL COMMENT '健康评分 0-100',
  
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_node_id` (`node_id`),
  KEY `idx_sku_city` (`sku_code`, `city`),
  KEY `idx_distributor` (`distributor_code`),
  KEY `idx_updated` (`updated_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='INFINITY OS节点主表';

-- ══════════════════════════════════════════════════════════════
-- 使用说明:
-- 1. 在MySQL 8.0+执行·兼容5.7
-- 2. 字符集utf8mb4·支持Emoji(企微推送需要)
-- 3. 索引已按高频查询设计·不需要再加
-- 4. 主键用BIGINT·2029年4亿条数据也够用
-- ══════════════════════════════════════════════════════════════
