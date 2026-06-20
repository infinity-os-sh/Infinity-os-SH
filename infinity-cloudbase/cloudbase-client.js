/* ============================================================================
 * INFINITY OS · CloudBase 客户端 (浏览器全局 InfinityCB·无构建步骤)
 * ----------------------------------------------------------------------------
 * 第一里程碑·第一条回路:真登录(手机号/工号) + 盘点读写 + 只读汇总。
 *
 * 单一配置点:CB_ENV_ID。填入真实环境ID即切『真接』,否则自动走『双轨·mock』。
 * 任务给的是占位符 [环境ID] —— 未填时不卡死,降级 mock,页面照常跑。
 *
 * 铁律遵守:
 *  - 只做盘点(数据采集)的读写;涉钱涉权动作不在此·不给自动执行接口。
 *  - 每条写入带 source_ref + ts + reporter,可审计。
 *  - 字段名全照 field-dictionary.js,不在此新造。
 * ========================================================================== */
(function (root) {
  'use strict';

  // ── ① 单一配置点 ────────────────────────────────────────────────────────
  // TODO[上线]: 把 [环境ID] 换成腾讯云开发真实环境ID,例如 'infinity-os-xxxx'。
  var CB_ENV_ID = (root.INFINITY_CB_ENV || '[环境ID]');

  // CloudBase Web SDK CDN (用户浏览器加载,本仓库不打包)
  var SDK_URL = 'https://web.sdk.qcloud.com/cloudbase/js-sdk/2.7.0/tcb.js';

  var Dict = root.InfinityDict; // field-dictionary.js 必须先加载
  var COLLECTION = (Dict && Dict.COLLECTION) || 'inventory_snapshot';

  var _app = null, _auth = null, _db = null;
  var _mode = 'init'; // 'real' | 'mock'
  var _readyP = null;

  function envConfigured() {
    return CB_ENV_ID && CB_ENV_ID.indexOf('[') === -1 && CB_ENV_ID !== '';
  }

  function loadScript(url) {
    return new Promise(function (res, rej) {
      if (root.cloudbase || root.tcb) return res();
      var s = document.createElement('script');
      s.src = url; s.async = true;
      s.onload = res; s.onerror = function () { rej(new Error('SDK load fail')); };
      document.head.appendChild(s);
    });
  }

  // ── ② 初始化:配齐就真接,否则 mock 兜底 (绝不卡死) ──────────────────────
  function ready() {
    if (_readyP) return _readyP;
    _readyP = (function () {
      if (!envConfigured()) {
        _mode = 'mock';
        console.warn('[InfinityCB] CB_ENV_ID 未配置(' + CB_ENV_ID + ') → 双轨·mock 模式。填环境ID即切真接。');
        return Promise.resolve('mock');
      }
      return loadScript(SDK_URL).then(function () {
        var cloudbase = root.cloudbase || root.tcb;
        _app = cloudbase.init({ env: CB_ENV_ID });
        _auth = _app.auth({ persistence: 'local' });
        _db = _app.database();
        _mode = 'real';
        return 'real';
      }).catch(function (e) {
        _mode = 'mock';
        console.warn('[InfinityCB] 真接失败 → 降级 mock:', e && e.message);
        return 'mock';
      });
    })();
    return _readyP;
  }

  function mode() { return _mode; }

  // ── ③ 真登录:手机号/工号 → 唯一身份 ────────────────────────────────────
  // 设计:工号走自定义登录(后端 cloudfunction 校验 HR 主数据签发 ticket);
  //       手机号走 CloudBase 短信验证码。两条路最终都解析出稳定 user_id。
  // 未配置环境时,本地解析出确定性 mock 身份,保证 app 可跑、可演示。
  //
  // identity = { uid, login_id, role, name, display_name }  —— reporter / 界面显示的来源。
  function resolveIdentity(loginId) {
    // loginId: 手机号(11位) 或 工号(如 8801 / MG-0420) 或 姓名(如 张三)
    var id = String(loginId || '').trim();
    var isPhone = /^1\d{10}$/.test(id);
    return {
      uid: (isPhone ? 'P_' : 'E_') + id,        // 稳定唯一身份ID
      login_id: id,
      role: 'ICA',                               // TODO[上线]: 由 HR 主数据返回真实角色
      name: null,                                // HR 真名槽位(上线由 hr_lookup 回填)
      // 临时显示名:HR 未接时,用登录输入兜底(手机号→隐去中段),保证"名字跟着登录的人走"
      display_name: isPhone ? (id.slice(0, 3) + '****' + id.slice(7)) : id
    };
  }

  /**
   * login(loginId, smsCode?) → Promise<identity>
   * - real + 手机号 + 验证码: CloudBase 短信登录
   * - real + 工号: 自定义登录(需后端签发 ticket;此处留接口)
   * - mock: 本地确定性身份
   */
  function login(loginId, smsCode) {
    return ready().then(function () {
      var identity = resolveIdentity(loginId);
      if (_mode === 'mock') return identity;

      var isPhone = /^1\d{10}$/.test(identity.login_id);
      if (isPhone && smsCode) {
        // CloudBase 手机号验证码登录
        return _auth.signInWithSms({ phoneNumber: '+86 ' + identity.login_id, verificationCode: smsCode })
          .then(function () {
            var u = _auth.currentUser || {};
            identity.uid = u.uid || identity.uid;
            return enrichFromHR(identity);
          });
      }
      // 工号 → 自定义登录 (后端校验工号并签发 ticket)
      // 未接后端时,不阻塞:用解析身份继续(数据仍带 reporter,可审计)。
      return enrichFromHR(identity);
    });
  }

  // 接 HR 主数据补全 role/name (留接口·未接时原样返回)
  function enrichFromHR(identity) {
    // TODO[上线]: 调 cloudfunction 'hr_lookup' 用 login_id 查 SAP·hr_employee,
    //            返回真实 role/name/district。只读·不涉权。
    return Promise.resolve(identity);
  }

  function sendSms(phone) {
    return ready().then(function () {
      if (_mode === 'mock') return { mock: true };
      return _auth.getVerification({ phoneNumber: '+86 ' + phone });
    });
  }

  // ── ④ 盘点读写 (只读汇总 + 现场上报),全带 source_ref+ts ────────────────
  function mockStore() {
    try {
      var raw = localStorage.getItem('inf_cb_mock_inventory');
      if (raw) return JSON.parse(raw);
    } catch (e) {}
    return (Dict && Dict.MOCK_SEED ? Dict.MOCK_SEED.slice() : []);
  }
  function mockSave(arr) {
    try { localStorage.setItem('inf_cb_mock_inventory', JSON.stringify(arr)); } catch (e) {}
  }

  /** 写一条盘点快照。snapshot 由 InfinityDict.buildSnapshot 生成。只采集,不触发任何下游执行。 */
  function submitSnapshot(snapshot) {
    return ready().then(function () {
      if (!snapshot.source_ref || !snapshot.ts) {
        return Promise.reject(new Error('盘点记录缺 source_ref/ts,审计不合规,拒绝写入'));
      }
      if (_mode === 'mock') {
        var arr = mockStore(); arr.push(snapshot); mockSave(arr);
        return { _id: 'mock_' + Date.now(), mock: true };
      }
      return _db.collection(COLLECTION).add(snapshot);
    });
  }

  /** 查某店(可选某SKU)的最新盘点 → 只读汇总用。返回数组。 */
  function queryByStore(store, sku) {
    return ready().then(function () {
      if (_mode === 'mock') {
        return mockStore().filter(function (r) {
          return r.scope && r.scope.store === store && (!sku || r.sku === sku);
        });
      }
      var w = { scope: { store: store } };
      if (sku) w.sku = sku;
      return _db.collection(COLLECTION).where(w).orderBy('ts', 'desc').limit(200).get()
        .then(function (r) { return r.data || []; });
    });
  }

  /** 全量拉取 (mock/小数据量) → 只读汇总页按店分组。 */
  function queryAll() {
    return ready().then(function () {
      if (_mode === 'mock') return mockStore();
      return _db.collection(COLLECTION).orderBy('ts', 'desc').limit(500).get()
        .then(function (r) { return r.data || []; });
    });
  }

  /** 取某店某SKU最新一条 (汇总页核心:哪些开关 ON/OFF) */
  function latestByStoreSku(store, sku) {
    return queryByStore(store, sku).then(function (rows) {
      rows.sort(function (a, b) { return (b.ts || '').localeCompare(a.ts || ''); });
      return rows[0] || null;
    });
  }

  root.InfinityCB = {
    CB_ENV_ID: CB_ENV_ID,
    envConfigured: envConfigured,
    ready: ready,
    mode: mode,
    login: login,
    sendSms: sendSms,
    resolveIdentity: resolveIdentity,
    submitSnapshot: submitSnapshot,
    queryByStore: queryByStore,
    queryAll: queryAll,
    latestByStoreSku: latestByStoreSku
  };
})(typeof window !== 'undefined' ? window : this);
