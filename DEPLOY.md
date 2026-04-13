# INFINITY OS v8.5 · GitHub Pages 部署指南

## 文件清单

```
index.html                          ← 主入口门户（这个文件）
infinity_os_v8.html                 ← v8.0 节点下钻架构
infinity_os_v81.html                ← v8.1 晨报中台 + 决策队列
infinity_os_v82.html                ← v8.2 一本账 + 年级P&L
infinity_os_v83.html                ← v8.3 蝴蝶效应 + PRISM
infinity_os_v84.html                ← v8.4 财务视图 + 滚动预算
infinity_os_node_targets.html       ← 目标填报工具（业务团队）
infinity_os_universal_node_schema.html ← Node Schema 技术文档
infinity_os_api_package.zip         ← Spring Boot Java 代码包
```

---

## 部署到 GitHub Pages（3步）

### 步骤1：上传文件

将以上所有文件上传到 GitHub 仓库根目录：
```
infinity-os-sh.github.io/Infinity-os-SH/
```

### 步骤2：启用 GitHub Pages

进入仓库 Settings → Pages → Source → Deploy from a branch → main → / (root)

### 步骤3：访问

部署完成后，系统门户地址：
```
https://infinity-os-sh.github.io/Infinity-os-SH/
```

---

## 当前状态

| 层级 | 状态 |
|------|------|
| 前端 v8.0-v8.5 | ✅ 已完成，可部署 |
| Node Schema DDL | ✅ 已完成，待DBA执行 |
| Spring Boot API | ✅ 代码已完成，待部署 |
| inf_node_targets 填报 | ⚠️ **最紧急**：业务团队需填写 |
| 汉询日销接入 | 🔴 等Step2解锁 |
| Dcloud库存接入 | 🔴 等Step2解锁 |

---

## 下一步行动清单

**今天（业务团队）：**
- [ ] 打开 `infinity_os_node_targets.html`
- [ ] 核对每个SKU的 r_target 和年级
- [ ] 点击「导出SQL」并发给DBA
- [ ] DBA执行SQL → Step2解锁

**本周（后端团队）：**
- [ ] 解压 `infinity_os_api_package.zip`
- [ ] 执行 Schema DDL 建5张表
- [ ] 部署 Spring Boot API
- [ ] 配置汉询日销数据管道

**数据接入后（自动激活）：**
- [ ] 所有Mock数据替换为真实r值
- [ ] 蝴蝶效应Agent开始真实检测
- [ ] 配置企微推送
- [ ] v8.6 正式上线

---

*INFINITY OS v8.5 · 欣和SH · 2026-04-13*
