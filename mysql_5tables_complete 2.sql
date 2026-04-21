-- ════════════════════════════════════════════════════════════════
-- INFINITY OS · 完整5张MySQL表 · 一次建完
-- ════════════════════════════════════════════════════════════════
-- 设计:Agent · 2026.04.21
-- 用途:Layer 3核心数据层
-- 执行:Tech Lead Day 2 · 复制全部 → MySQL Workbench → 执行
-- ════════════════════════════════════════════════════════════════

-- 数据库创建
CREATE DATABASE IF NOT EXISTS `infinity_os` 
  DEFAULT CHARACTER SET utf8mb4 
  DEFAULT COLLATE utf8mb4_unicode_ci;
USE `infinity_os`;


-- ════════════════════════════════════════════════════════════════
-- 表1·inf_nodes(节点主表)
-- 用途:存储所有"节点"(SKU×城市×渠道×经销商的组合)
-- 数据量:~5万行(稳定)
-- 更新频率:每天1次同步基础信息
-- ════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS `inf_nodes` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `node_id` VARCHAR(64) NOT NULL COMMENT '节点唯一ID 例:IPO10_SH_浦东_LYX500',
  `node_type` VARCHAR(32) NOT NULL COMMENT '节点类型 IPO0-IPO13',
  `node_name` VARCHAR(128) NOT NULL COMMENT '节点名称',
  
  -- SKU维度
  `sku_code` VARCHAR(32) NOT NULL COMMENT 'SAP MARA.MATNR',
  `sku_name` VARCHAR(128) NOT NULL,
  `sku_grade` TINYINT NOT NULL DEFAULT 0 COMMENT 'SKU年级 1-4',
  `r_target` DECIMAL(10,2) DEFAULT NULL COMMENT '目标日销率(业务团队填)',
  
  -- 地理维度
  `province` VARCHAR(32) NOT NULL,
  `city` VARCHAR(32) NOT NULL,
  `district` VARCHAR(64) DEFAULT NULL,
  
  -- 渠道维度
  `channel_type` VARCHAR(32) NOT NULL COMMENT 'KA/BC/CVS/CR',
  `distributor_code` VARCHAR(32) DEFAULT NULL COMMENT 'SAP KNA1.KUNNR',
  `distributor_name` VARCHAR(128) DEFAULT NULL,
  
  -- 状态
  `status` TINYINT NOT NULL DEFAULT 1 COMMENT '1正常 0停用 -1预警',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_node_id` (`node_id`),
  KEY `idx_sku_city` (`sku_code`, `city`),
  KEY `idx_distributor` (`distributor_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='节点主表';


-- ════════════════════════════════════════════════════════════════
-- 表2·inf_heartbeat(心跳数据表)
-- 用途:每个节点每天的心跳数据(a值/r值/水位)
-- 数据量:~5万行/天 · 1年 ~ 1800万行
-- 更新频率:每小时同步1次
-- ════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS `inf_heartbeat` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `node_id` VARCHAR(64) NOT NULL COMMENT '关联inf_nodes.node_id',
  `date` DATE NOT NULL COMMENT '业务日期',
  
  -- 心跳数据(从SAP MB51算出来)
  `a_value` DECIMAL(10,2) NOT NULL COMMENT 'a值=过去7天发货量/7',
  `r_actual` DECIMAL(10,2) NOT NULL COMMENT '实际日销率',
  `r_target` DECIMAL(10,2) DEFAULT NULL COMMENT '目标日销率(冗余存便于查询)',
  `r_market` DECIMAL(10,2) DEFAULT NULL COMMENT '市场日销率(竞品对标)',
  
  -- 库存数据(从SAP MB52)
  `stock_factory` DECIMAL(10,2) DEFAULT NULL COMMENT '工厂库存',
  `stock_distributor` DECIMAL(10,2) DEFAULT NULL COMMENT '经销商库存',
  `stock_in_transit` DECIMAL(10,2) DEFAULT NULL COMMENT '在途库存',
  
  -- 计算字段(由Java计算后存入)
  `water_level_factory` DECIMAL(5,2) DEFAULT NULL COMMENT '工厂水位=工厂库存/a',
  `water_level_distributor` DECIMAL(5,2) DEFAULT NULL COMMENT '经销商水位',
  `health_score` TINYINT DEFAULT NULL COMMENT '健康评分0-100',
  
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_node_date` (`node_id`, `date`),
  KEY `idx_date` (`date`),
  KEY `idx_health` (`health_score`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 
  COMMENT='心跳数据表(按天分区)'
  PARTITION BY RANGE (TO_DAYS(date)) (
    PARTITION p202604 VALUES LESS THAN (TO_DAYS('2026-05-01')),
    PARTITION p202605 VALUES LESS THAN (TO_DAYS('2026-06-01')),
    PARTITION p202606 VALUES LESS THAN (TO_DAYS('2026-07-01')),
    PARTITION p202607 VALUES LESS THAN (TO_DAYS('2026-08-01')),
    PARTITION pmax VALUES LESS THAN MAXVALUE
  );


-- ════════════════════════════════════════════════════════════════
-- 表3·inf_alerts(预警表)
-- 用途:Agent检测到的所有异常·待人工处理
-- 数据量:~500行/天 · 1年 ~ 18万行
-- 更新频率:实时(Agent每次判断后写入)
-- ════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS `inf_alerts` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `node_id` VARCHAR(64) NOT NULL,
  `alert_type` VARCHAR(32) NOT NULL COMMENT 'A压货/B促销扰动/C窜货/D战略偏离',
  `severity` TINYINT NOT NULL COMMENT '1低 2中 3高 4紧急',
  
  -- 触发原因
  `trigger_rule` VARCHAR(64) NOT NULL COMMENT '触发的规则名',
  `trigger_value` DECIMAL(10,2) DEFAULT NULL COMMENT '触发时的关键数值',
  `expected_value` DECIMAL(10,2) DEFAULT NULL COMMENT '预期值',
  `deviation_pct` DECIMAL(5,2) DEFAULT NULL COMMENT '偏离百分比',
  
  -- Agent判断
  `agent_diagnosis` TEXT COMMENT 'Agent诊断说明',
  `agent_recommendation` TEXT COMMENT 'Agent建议动作',
  `agent_confidence` TINYINT DEFAULT NULL COMMENT '置信度0-100',
  
  -- 处理状态
  `status` VARCHAR(16) NOT NULL DEFAULT 'pending' COMMENT 'pending/confirmed/rejected/done',
  `assigned_to` VARCHAR(64) DEFAULT NULL COMMENT '分配给谁(企微ID)',
  `resolved_at` DATETIME DEFAULT NULL,
  `resolved_by` VARCHAR(64) DEFAULT NULL,
  `resolved_note` TEXT DEFAULT NULL,
  
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  PRIMARY KEY (`id`),
  KEY `idx_status_severity` (`status`, `severity`),
  KEY `idx_node_created` (`node_id`, `created_at`),
  KEY `idx_assigned` (`assigned_to`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='预警表';


-- ════════════════════════════════════════════════════════════════
-- 表4·inf_actions(动作记录表)
-- 用途:所有Agent推送+人工确认+执行结果的完整闭环
-- 数据量:~1000行/天 · 1年 ~ 36万行
-- 更新频率:实时
-- ════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS `inf_actions` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `alert_id` BIGINT UNSIGNED DEFAULT NULL COMMENT '关联inf_alerts.id',
  `node_id` VARCHAR(64) NOT NULL,
  `action_type` VARCHAR(32) NOT NULL COMMENT 'omakase推单/价格调整/库存预警/拜访建议',
  
  -- Agent建议
  `agent_proposal` TEXT NOT NULL COMMENT 'Agent建议的具体动作JSON',
  `agent_reasoning` TEXT COMMENT 'Agent推理过程',
  
  -- 推送
  `pushed_at` DATETIME DEFAULT NULL,
  `pushed_to` VARCHAR(64) DEFAULT NULL COMMENT '企微用户ID',
  `push_channel` VARCHAR(16) DEFAULT 'wechat_work',
  
  -- 人工反馈
  `human_decision` VARCHAR(16) DEFAULT NULL COMMENT 'approve/reject/modify',
  `human_modification` TEXT DEFAULT NULL COMMENT '如果是modify·改成什么',
  `human_decided_at` DATETIME DEFAULT NULL,
  `human_decided_by` VARCHAR(64) DEFAULT NULL,
  
  -- 执行结果
  `execution_status` VARCHAR(16) DEFAULT NULL COMMENT 'pending/success/failed',
  `execution_result` TEXT DEFAULT NULL,
  `executed_at` DATETIME DEFAULT NULL,
  
  -- 学习反馈
  `outcome_score` TINYINT DEFAULT NULL COMMENT '事后评分0-100·决定Agent置信度调整',
  `feedback_at` DATETIME DEFAULT NULL,
  
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  PRIMARY KEY (`id`),
  KEY `idx_alert` (`alert_id`),
  KEY `idx_node_action` (`node_id`, `action_type`),
  KEY `idx_pushed_to` (`pushed_to`),
  KEY `idx_decision` (`human_decision`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='动作闭环表';


-- ════════════════════════════════════════════════════════════════
-- 表5·inf_node_targets(节点目标表)
-- 用途:每个节点的r_target和grade(业务团队填)
-- 数据量:~5万行(稳定)
-- 更新频率:每月1次(由业务团队调整)
-- ════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS `inf_node_targets` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `node_id` VARCHAR(64) NOT NULL,
  
  -- 目标
  `r_target_daily` DECIMAL(10,2) NOT NULL COMMENT '日销目标',
  `r_target_monthly` DECIMAL(10,2) DEFAULT NULL COMMENT '月销目标',
  `grade` TINYINT NOT NULL COMMENT '门店等级 1=S+ 2=S 3=A 4=B 5=C 6=D',
  
  -- 周期
  `cycle_days` TINYINT NOT NULL DEFAULT 7 COMMENT '心跳周期T',
  `visit_freq_per_week` TINYINT NOT NULL COMMENT '拜访频率·S+=3 S=2 A=1 B/C/D=0.5',
  
  -- 价格区间(铁律1:不低于¥13)
  `price_floor` DECIMAL(10,2) DEFAULT 13.00 COMMENT '价格底线',
  `price_target` DECIMAL(10,2) DEFAULT NULL COMMENT '建议价格',
  `price_ceiling` DECIMAL(10,2) DEFAULT NULL COMMENT '价格上限',
  
  -- 生效期
  `effective_from` DATE NOT NULL,
  `effective_to` DATE DEFAULT NULL,
  
  -- 责任人
  `set_by` VARCHAR(64) NOT NULL COMMENT '由谁设定',
  `approved_by` VARCHAR(64) DEFAULT NULL COMMENT '由谁批准',
  `set_reason` TEXT DEFAULT NULL COMMENT '设定理由',
  
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_node_effective` (`node_id`, `effective_from`),
  KEY `idx_grade` (`grade`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='节点目标表';


-- ════════════════════════════════════════════════════════════════
-- 验证:5张表全部建好
-- ════════════════════════════════════════════════════════════════
SHOW TABLES;
-- 应该看到5张表:
-- inf_actions
-- inf_alerts
-- inf_heartbeat
-- inf_node_targets
-- inf_nodes


-- ════════════════════════════════════════════════════════════════
-- 关系图(Tech Lead要懂):
-- 
--   inf_nodes (节点主表)
--      ↓ node_id
--      ├── inf_heartbeat (每天心跳数据)
--      ├── inf_node_targets (目标设定)
--      └── inf_alerts (异常预警)
--             ↓ alert_id
--             └── inf_actions (Agent推送+人工确认+执行)
-- ════════════════════════════════════════════════════════════════
