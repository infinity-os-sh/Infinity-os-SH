/* ============================================================================
 * INFINITY OS · 渠道配置层 CHANNELS (mock · provisional · SCAFFOLD)
 * ----------------------------------------------------------------------------
 * 「1 个引擎插 N 次」:引擎(环/四层/SKU 晶体管/6 规则评分结构/事件总线/补货阈值/
 *   L5-07/entity-master/派单/学习台账)跨渠道通用、一行不改;每渠道只换的那一处 = 本表。
 *
 * 每渠道字段 = 规律里「每渠道只换一处」:
 *   客户价值 × 我方价值及差异(=JBP 弥合点) + 计分权重 + 消费者手段 + 角色 + SKU 范围(+业态特有开关)。
 *
 * ⚠ 所有值 provisional,待 DS/业务校准。store_type 传给共享 XD(inf_cb_store_type)控 ②③ 门控:
 *    hypermarket.store_type='大卖场' = 现有 app 原值 → 切大卖场行为与 B-034 逐项一致(回归红线)。
 * ⚠ scoring_weights 本轮仅作配置/展示(镜像引擎阶段权重),不回灌 SkuScorecard(评分结构受保护·引擎不动)。
 * ========================================================================== */
(function (root) {
  'use strict';
  var CHANNELS = {
    hypermarket: {                         // 大卖场(现有 app 原值原样填回 → 行为零变化)
      id: 'hypermarket', name: '大卖场', store_type: '大卖场',
      customer_value: '到店流量 / 大堆头曝光 / 价格带覆盖',
      our_value_and_gap: '我方要高端心智锚点;客户要走量与流量 → JBP 弥合:高端堆头带流量+心智(待真谈)',
      scoring_weights: {                   // provisional·镜像引擎阶段权重(本轮不回灌引擎)
        '导入': { '买得到': 50, '看得到': 35, '动销': 15 },
        '成长': { '买得到': 30, '看得到': 35, '动销': 35 },
        '成熟': { '买得到': 25, '看得到': 30, '动销': 45 },
        '衰退': { '买得到': 20, '看得到': 20, '动销': 60 }
      },
      consumer_pull: ['堆头', '试吃', '端架黄金位', '促销档期'],
      roles: ['SR', 'DSR', 'ICA', '督导/DOM'],
      sku_scope: '全规格(标装为主)',
      extra_transistors: []                // ②③ 大卖场项已在共享 XD 配(STORE_TYPE_CHECKLIST)
    },
    o2o_club: {                            // O2O 会员店(第 2 张配置·provisional 初值·DS 可改)
      id: 'o2o_club', name: 'O2O会员店', store_type: '会员店',
      customer_value: '会员复购 / 大包装高客单 / 精选 SKU / 到家即时',
      our_value_and_gap: '(待 JBP 真谈;先占位)',
      scoring_weights: {                   // 大包装动销权重最高,其次铺货,陈列低于大卖场(provisional)
        '导入': { '买得到': 45, '看得到': 25, '动销': 30 },
        '成长': { '买得到': 30, '看得到': 25, '动销': 45 },
        '成熟': { '买得到': 25, '看得到': 20, '动销': 55 },
        '衰退': { '买得到': 20, '看得到': 15, '动销': 65 }
      },
      consumer_pull: ['满减', '到家30分钟', '会员专享装', '试吃装'],
      // ⚠ 角色名 DS 敏感区:SP 含义待 DS 确认(驻店促销?导购?),先不写进 roles。
      roles: ['SR', 'ICA(导购)', '督导/DOM'],
      sku_scope: '大包装 SKU',
      extra_transistors: ['会员专享装状态']  // provisional
    }
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = CHANNELS;
  root.CHANNELS = CHANNELS;
})(typeof window !== 'undefined' ? window : this);
