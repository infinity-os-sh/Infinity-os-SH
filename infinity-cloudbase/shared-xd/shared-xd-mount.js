/* ============================================================================
 * INFINITY OS · 共享 XD(盘点)挂载件 — 做一次,ICA / SR 都挂它 (SCAFFOLD)
 * ----------------------------------------------------------------------------
 * XD 底座 = inf-xd-v6712-0601-wired.html(已验通写路:登录→盘点→签退→写 inventory_snapshot)。
 * 本件把"各 app 各 iframe 引一份"抽成统一挂载接口,绝不 fork、绝不重写盘点逻辑。
 *
 *   mountXD(slot, { storeType, identity, store_id })
 *     - slot     : 容器 DOM(放 iframe)
 *     - storeType: '大卖场' | '社区店' | …  → 决定 XD 里额外显示哪些 ②③ 业态 checklist
 *     - identity : 登录身份(同 cloudbase-client.resolveIdentity 产物)→ reporter 跟人走
 *     - store_id : 本次盘点门店(L0-04 store_id)
 *
 * 同源 localStorage 把 storeType/identity/store_id 传进 iframe(inf-xd-wired 读取)。
 * ⚠ ① 层晶体管(6开关)口径不变;storeType 只控 ②③ 层条件项(见 inf-xd-wired 补丁)。
 * ========================================================================== */
(function (root) {
  'use strict';
  var SHARED_XD_SRC = 'inf-xd-v6712-0601-wired.html'; // 唯一 XD 底座(相对挂载页根目录)

  function mountXD(slot, opts) {
    opts = opts || {};
    try {
      // 只覆盖传入的键(reload 时可传 {} 不动 identity/store/type)
      if (opts.identity  !== undefined) localStorage.setItem('inf_cb_identity', JSON.stringify(opts.identity || {}));
      if (opts.store_id  !== undefined) localStorage.setItem('inf_cb_inspect_store', opts.store_id || 'SH_GT_CVS_001');
      if (opts.storeType !== undefined) localStorage.setItem('inf_cb_store_type', opts.storeType || ''); // 空=不显示②③(ICA默认)
    } catch (e) {}
    if (!slot) return null;
    var wantStore = (opts.store_id !== undefined) ? (opts.store_id || '') : null;
    // slot 可是容器 div(SR:内建 iframe),也可直接传现成 iframe(ICA:复用其 #xdFrame)
    var f;
    if (slot.tagName === 'IFRAME') {
      // ICA 路:保持原行为(每次重载),不引入复用 → ICA 运行期零变化
      f = slot;
      f.src = SHARED_XD_SRC + '?t=' + Date.now();
      return f;
    }
    // SR 路(div slot):iframe 只挂一次、之后复用(同店不重载 src → 第二次秒开)
    f = slot.querySelector('iframe.shared-xd');
    var firstCreate = false;
    if (!f) {
      slot.innerHTML = '';                   // 清掉占位符(「从路上点一家店进店…」)再放 iframe
      f = document.createElement('iframe');
      f.className = 'shared-xd';
      f.title = 'INFINITY OS · 共享盘点 XD';
      f.style.cssText = 'width:100%;height:100%;min-height:0;border:none;display:block;background:#0d0f14';
      slot.appendChild(f);
      firstCreate = true;
    }
    // 复用守卫:非强制 + 非首建 + 已载完 + 同店 → 直接返回现成 iframe(不重设 src、不重载)
    var loadedStore = f.getAttribute('data-xd-store');
    if (!opts.force && !firstCreate && f.getAttribute('data-xd-loaded') === '1' && wantStore != null && loadedStore === wantStore) {
      return f;
    }
    // 否则(首建 / 切店 / 强制重盘):设 src 重载;onload 后打 data-xd-loaded 标(供外壳解禁 + 下次复用判断)
    if (wantStore != null) f.setAttribute('data-xd-store', wantStore);
    f.removeAttribute('data-xd-loaded');
    f.addEventListener('load', function onceLoaded() { f.setAttribute('data-xd-loaded', '1'); f.removeEventListener('load', onceLoaded); });
    f.src = SHARED_XD_SRC + '?t=' + Date.now();
    return f;
  }

  // ②③ 层业态 checklist 配置(按 storeType 条件显示)·只加在 ②③,不动 ① 层 6 开关
  // 供 inf-xd-wired 读取渲染;键值=展示项。大卖场专项 = KA 业态手段。
  var STORE_TYPE_CHECKLIST = {
    '大卖场': [
      { key: 'duitou_endcap_gold', label: '堆头 / 端架 / 黄金位陈列', type: 'toggle' },
      { key: 'ka_account_period',  label: 'KA 账期',                 type: 'text'   },
      { key: 'promo_window',       label: '促销档期',                 type: 'text'   },
      { key: 'competitor_duitou',  label: '竞品堆头 / 价格',          type: 'text'   },
      { key: 'big_client_contact', label: '大客户对接',               type: 'toggle' }
    ]
  };

  var api = { mountXD: mountXD, SHARED_XD_SRC: SHARED_XD_SRC, STORE_TYPE_CHECKLIST: STORE_TYPE_CHECKLIST };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.SharedXD = api;
})(typeof window !== 'undefined' ? window : this);
