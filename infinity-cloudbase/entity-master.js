/* ============================================================================
 * INFINITY OS · 共享实体主数据 EntityMaster (mock · 单一来源 · SCAFFOLD)
 * ----------------------------------------------------------------------------
 * Agent 阶梯第 2 档「认识世界」:系统认 ID、不靠名字判断。一份共享主数据,
 * 各 app 都查它 —— 不再各 app 各存一套名字(那正是要消灭的乱源)。
 *
 * ID 命名约定(新实体照此):
 *   SKU      = 品牌缩写-品类-规格        例 6MX-TJ-380
 *   Store    = 城市_业态_类型_序号        例 SH_GT_CVS_201
 *   Customer = 品牌_城市                  例 DRF_SH
 *   Employee = 工号                        例 MG-0420
 *   City     = 城市码                      例 SH
 *
 * ⚠ mock:真名/真归属链待 SFA_Backend_v4;真接时换数据源,结构不变。
 *   未登记 ID → nameOf 返回「〔id·待映射〕」(不报错、不靠名字猜)。
 * 只读主数据,无任何涉钱涉权动作。ICA 不加载本文件 → ICA 运行期不变。
 * ========================================================================== */
(function (root) {
  'use strict';
  var EntityMaster = {
    CITY: { 'SH': { name: '上海' } },
    CUSTOMER: {
      'DRF_SH': { name: '大润发(上海)', channel: '大卖场', city_id: 'SH' },
      'JLF_SH': { name: '家乐福(上海)', channel: '大卖场', city_id: 'SH' },
      'WMT_SH': { name: '沃尔玛(上海)', channel: '大卖场', city_id: 'SH' },
      'AUC_SH': { name: '欧尚(上海)',   channel: '大卖场', city_id: 'SH' }
    },
    STORE: {
      // 路线店 201~204:各归各客户(名取自 sr-app visit_list 真名)
      'SH_GT_CVS_201': { name: '大润发·徐汇大卖场',   customer_id: 'DRF_SH', city_id: 'SH', type: '大卖场' },
      'SH_GT_CVS_202': { name: '家乐福·古北大卖场',   customer_id: 'JLF_SH', city_id: 'SH', type: '大卖场' },
      'SH_GT_CVS_203': { name: '沃尔玛·五角场大卖场', customer_id: 'WMT_SH', city_id: 'SH', type: '大卖场' },
      'SH_GT_CVS_204': { name: '欧尚·杨浦大卖场',     customer_id: 'AUC_SH', city_id: 'SH', type: '大卖场' },
      // 有盘点的店 001/002:也登记、归大润发(供算分)
      'SH_GT_CVS_001': { name: '大润发·徐汇(有盘点)', customer_id: 'DRF_SH', city_id: 'SH', type: '大卖场' },
      'SH_GT_CVS_002': { name: '大润发·浦东(有盘点)', customer_id: 'DRF_SH', city_id: 'SH', type: '大卖场' }
    },
    EMPLOYEE: {
      'MG-0420': { name: '赵美玲', role: '美顾/SR', stores: ['SH_GT_CVS_001'] },
      'MG-0511': { name: '王小芳', role: '美顾/SR', stores: ['SH_GT_CVS_002'] }
    },
    SKU: {  // ← 从 PR21 的 sr-app 内联 SKU_MASTER 移到这里(保持单一来源)
      '6MX-TJ-380': { name: '六月鲜特级380ml', spec: '380ml', cat: '高端酱油' },
      '6MX-QY-500': { name: '六月鲜·QY500〔名待主数据〕', spec: '500ml', cat: '高端酱油' },
      '6MX-JDX':    { name: '六月鲜·JDX〔名待主数据〕',   spec: '—',     cat: '高端酱油' }
    },
    // —— 归属链查询(让系统知道「谁是谁」) ——
    nameOf: function (type, id) { var t = this[type]; return (t && t[id] && t[id].name) || ('〔' + id + '·待映射〕'); },
    customerOf: function (storeId) { var s = this.STORE[storeId]; return s ? s.customer_id : null; },
    cityOf: function (storeId) { var s = this.STORE[storeId]; return s ? s.city_id : null; },
    storesOf: function (empId) { var e = this.EMPLOYEE[empId]; return e ? e.stores : []; },
    // —— 一致性检查(认识世界 = 知道哪里还不一致) ——
    checkConsistency: function (routeStoreIds, snapshotStoreIds) {
      var self = this;
      return (routeStoreIds || []).map(function (id) {
        return { store: id, hasMaster: !!self.STORE[id],
                 hasSnapshot: (snapshotStoreIds || []).indexOf(id) >= 0,
                 customer: self.customerOf(id) };
      });
    }
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = EntityMaster;
  root.EntityMaster = EntityMaster;
})(typeof window !== 'undefined' ? window : this);
