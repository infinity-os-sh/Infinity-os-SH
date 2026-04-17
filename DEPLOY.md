# 🚀 INFINITY OS · 部署清单

> 最后更新：2026-04-17 · 维护者：DS

---

## 📍 部署地址

**GitHub Pages**：https://infinity-os-sh.github.io/Infinity-os-SH/
**仓库**：https://github.com/infinity-os-sh/Infinity-os-SH

---

## 🎯 核心入口

| 文件 | URL | 用途 |
|---|---|---|
| `index.html` | `/` | 战略指挥中台首页（V2.0 重构版） |
| `infinity_os_v22.html` | `/infinity_os_v22.html` | V22 三场景战略推演（最新） |
| `infinity_os_v21_1_editable.html` | `/infinity_os_v21_1_editable.html` | V21.1 主管征询版 |

---

## 📦 22 个活跃模块清单

### 🎯 战略目标系统（4 个）

| 文件 | 状态 | 说明 |
|---|---|---|
| `infinity_os_v22.html` | ✅ 最新 | V22 三场景推演 + 上游约束 + 风险诊断 |
| `infinity_os_v21_1_editable.html` | ✅ 最新 | V21.1 可编辑征询版 |
| `V21_feedback_form.html` | ✅ 最新 | 7 题深度反馈表 |
| `infinity_os_node_targets.html` | ✅ 已部署 | 节点目标录入（业务方填 r_target+grade） |

### 📊 经营监控系统（5 个）

| 文件 | 状态 | 说明 |
|---|---|---|
| `infinity_os_dom.html` | ✅ 已部署 | DOM/城市经理/大区总三层一本账 |
| `infinity_os_drilldown.html` | ✅ 已部署 | 多维分析（矩阵+下钻+排序） |
| `infinity_os_dist_ledger.html` | ✅ 已部署 | 经销商一本账 |
| `infinity_os_store_ledger.html` | ✅ 已部署 | 门店一本账 |
| `infinity_os_spd_boss.html` | ✅ 已部署 | SPD 老板视图 |

### 🤖 Agent 系统（5 个）

| 文件 | 状态 | 说明 |
|---|---|---|
| `infinity_os_agent_spec_01.html` | ✅ 已部署 | A 值校准 Agent 规格（周一 06:00） |
| `infinity_os_agent_spec_02.html` | ✅ 已部署 | 蝴蝶效应 Agent 规格（周一 07:00） |
| `infinity_os_agent_spec_03.html` | ✅ 已部署 | Omakase 推单 Agent 规格（周一 08:00） |
| `infinity_os_true_agent_ui.html` | ✅ 已部署 | 真正 Agent UI 原型 |
| `infinity_os_universal_node_schema.html` | ✅ 已部署 | Universal Node Schema（5 张 MySQL 表） |

### 📋 规则与合约（4 个）

| 文件 | 状态 | 说明 |
|---|---|---|
| `infinity_os_target_rules.html` | ✅ 已部署 | 6 条目标规则引擎 |
| `infinity_os_contracts_sign.html` | ✅ 已部署 | 业务合约签署 |
| `44库存上报_INFINITY_OS.html` | ✅ 已部署 | 库存上报原型 |
| `inventory-v4.html` | ✅ 已部署 | 库存心跳工具 |

### 📦 DS 内部工具（4 个）

| 文件 | 状态 | 说明 | 备注 |
|---|---|---|---|
| `V21_sending_kit.html` | ✅ 最新 | 4 主管征询发送工具包 | 不对外 |
| `V21_feedback_merger.html` | ✅ 最新 | 反馈汇总自动化工具 | 不对外 |
| `V21_2_revision_log.md` | ✅ 最新 | V21.2 修订日志模板 | 内部使用 |
| `infinity_os_v84.html` | ✅ 已部署 | v8 系列最新锚点 | 历史快照 |

### 🔧 源代码（4 个）

| 文件 | 用途 |
|---|---|
| `HeartbeatCalculator.java` | Java 后端心跳计算 |
| `HeartbeatCalculator.swift` | iOS 端心跳计算 |
| `InventoryReportActivity*.java` | Android 库存上报 Activity |
| `InventoryReportViewCo*.swift` | iOS 库存上报 ViewController |

---

## 📚 archive/ 历史归档

> 详见 `archive/README.md`

包含 v6/v7/v8 旧版、方案 A/B/C/D 早期原型、ZIP 包等。
**不再维护，仅供回溯**。

---

## 🔄 部署流程

### 推送新文件

1. 在 GitHub 仓库点 **Add file → Upload files**
2. 拖入新 HTML 文件
3. 滚到底部 → **Commit changes**
4. 等待 1-2 分钟 GitHub Pages 缓存刷新
5. 访问对应链接验证

### 更新现有文件

1. 点开要更新的文件
2. 点编辑（铅笔图标）→ 上传新版本（实际是 Replace 模式）
3. 或者直接拖入同名文件覆盖
4. **Commit changes**
5. **强制刷新浏览器**（Cmd+Shift+R / Ctrl+Shift+R）才能看到新版

---

## ⚠️ 部署注意事项

### URL 编码问题
中文文件名会变成 `%E5%9F%8E` 这样的长 URL。**新文件强烈建议用纯英文命名**。

### 缓存问题
GitHub Pages 有 1-2 分钟缓存。新部署后访问看到旧版是正常现象，**等 2 分钟再试**。

### 文件名空格陷阱
iPad 上传时偶尔会自动加 " 2"、" 3" 这样的空格副本（如 `v745 3.html`）。**部署前检查文件名**。

---

## 📊 路线图（2026-04-17 后）

### 即将完成
- [ ] V21.1 征询发出（4 主管）
- [ ] V21.2 修订发布（基于反馈）
- [ ] 仓库归档清理（移到 archive/）

### V23 规划
- [ ] 城市群虹吸效应建模
- [ ] 大区独立场景比例（B 方案）
- [ ] 合纵 7 棒渠道接力
- [ ] 三场景推演 + 城市群叠加

### Layer 2 突破（中期）
- [ ] V22 城市目标 → inf_node_targets 表灌入
- [ ] 真实数据管道接入
- [ ] Agent 决策闭环建立
- [ ] 学习日志开始积累

---

> _本文档由 DS 维护 · 持续更新_
