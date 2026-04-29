# 📊 INFINITY OS · 数据Mapping V1.0

> **作者**: DS + Agent
> **版本**: V1.0(基于v1.4 + v9f)· 2026-04-29
> **目的**: 让TL入职后立即知道每个字段从哪取 · 节省3-6个月摸索
> **状态**: 等业务团队/数据团队review后形成V1.1

---

# 🎯 文档使用说明

## 阅读对象

```
🔴 TL · 入职第1天必读 · 当作"数据接入路线图"
🟡 业务团队 · 知道SAP Step 2要补哪些字段
🟡 数据团队 · 知道汉询/Dcloud/Hologres要开通哪些表权限
🟢 DS · 心里有数 · 当前Layer 1.7 → 真Layer 2.0还差什么
🟢 老板 · 看完知道"6周冲刺"具体在做什么
```

## 5个状态标签

```
🔴 写死(hardcode) · 当前是Agent写死的字符串/数字
🟡 公式(formula) · 当前是JS随机或简单计算
🟢 真接(connected) · 已对接真数据源(目前=0个)
⚪ 待定(TBD) · 数据源不明 · 需业务团队确认
🚫 不接(skip) · 永远不接真数据(如Logo/SVG/装饰)
```

## 优先级 · 4级

```
P0 · TL入职 W1-W3 必接 · 否则INFINITY OS没意义(蒸腾/库存/r值)
P1 · TL入职 W4-W6 接 · 让数据"活"起来(销量/经销商/SKU)
P2 · TL入职 W7-W12 接 · 完善整体(美顾/督导/复购)
P3 · 长期(3-6个月)· 高级特性(预测/AI推荐/数字孪生)
```

---

# 📋 主控台MAX(v1.4)· 数据Mapping

## TAB 1 · 简报(Briefing)

### 1.1 顶部 · 整体KPI

| 字段 | 当前值 | 状态 | 真数据源 | SQL/逻辑 | 优先级 | TL估时 |
|---|---|---|---|---|---|---|
| YTD营收 | ¥9.5亿 | 🔴 | 汉询·`sales_daily` | `SUM(amount) WHERE year=2026` | P0 | 0.5天 |
| 年度达成率 | 87% | 🟡 | 汉询·sales_daily ÷ inf_targets | `YTD ÷ year_target × 100` | P0 | 0.5天 |
| 当月预测 | ¥1.1亿 | 🟡 | 汉询当月+预测算法 | `MTD × (30/today_day)` | P0 | 1天 |
| 12月达成预测 | 91% | 🟡 | 历史趋势+季节性 | 时序回归(简版) | P1 | 3天 |
| 经销商总数 | 156 | 🔴 | 汉询·`dealer` | `COUNT(*) WHERE status='active'` | P0 | 0.5天 |
| 深度合伙比例 | 42% | 🔴 | inf_partner_agreement | `COUNT(deep) ÷ COUNT(all) × 100` | P1 | 1天 |
| 门店总数 | 12,400 | 🔴 | 汉询·`store` | `COUNT(*) WHERE active=1` | P0 | 0.5天 |
| 消费者总数 | 280万 | 🔴 | 微信会员+POS聚合 | `COUNT(DISTINCT customer_id)` | P2 | 2天 |

### 1.2 今日3个核心行动(v1.1注入)

| 字段 | 当前值 | 状态 | 真数据源 | 备注 |
|---|---|---|---|---|
| 行动1 · 明发库存诊断 | 写死文案 | 🔴 | inf_alerts(蝴蝶Agent生成) | 动态生成 · P0 |
| 行动2 · 有机系列复制 | 写死文案 | 🔴 | inf_alerts(机会推荐) | P0 |
| 行动3 · TL招聘跟进 | 写死文案 | ⚪ | (无数据源·DS手动维护) | DS手填或不接 |

### 1.3 5品牌矩阵(v1.2注入)

| 品牌 | 字段 | 当前值 | 状态 | 真数据源 |
|---|---|---|---|---|
| 六月鲜 | 北极星(2亿瓶) | 写死 | 🔴 | inf_brand_strategy |
| 六月鲜 | 当前进度 | 无 | ⚪ | 汉询·按品牌SUM |
| 葱伴侣 | 场景定位 | 写死 | 🚫 | 不接(战略文案) |
| 味达美 | 大众首选 | 写死 | 🚫 | 不接(战略文案) |
| 禾然 | 90%达成 | 写死 | 🟡 | 汉续·按品牌·按月 |
| 小康 | 防御性 | 写死 | 🚫 | 不接(战略文案) |

### 1.4 蝴蝶预警议题(brief-issues)

| 字段 | 当前值 | 状态 | 真数据源 | 公式 | 优先级 |
|---|---|---|---|---|---|
| 议题1 · 明发压货 | 写死 | 🔴 | inf_alerts(蝴蝶Agent) | A类畸变检测 | **P0** |
| 议题2 · 有机突破 | 写死 | 🔴 | inf_alerts(机会模式) | 达成率>75%首达 | P1 |
| 议题3 · 无锡落后 | 写死 | 🔴 | inf_alerts(片区对比) | 区域间差距>30% | P1 |
| 议题4 · KA增速放缓 | 写死 | 🔴 | inf_alerts(渠道对比) | 同比增速变化 | P2 |
| 议题5 · 禾然90% | 写死 | 🔴 | inf_alerts(SKU达成) | SKU>85%且加速 | P2 |

**⚠️ 关键:** 这5个议题不是DS编的 · 是**蝴蝶效应Agent**的输出。蝴蝶Agent上线后自动生成。

---

## TAB 2 · 蒸腾监测(Evaporation)

### 2.1 蒸腾速率(核心指标)

| 字段 | 当前值 | 状态 | 真数据源 | 公式 | 优先级 |
|---|---|---|---|---|---|
| 整体蒸腾率 | "↑+18%"(JS随机) | 🟡 | 汉询·`rixiao` | `r = a ÷ T`(a值校准Agent) | **P0** |
| Top 10经销商蒸腾 | 写死 | 🔴 | 汉询·按dealer聚合 | `SUM(rixiao) BY dealer` | **P0** |
| 蒸腾vs销量比 | 写死(0.06-1.67) | 🟡 | 计算 | `evapo% / sales%` | P0 |
| 真伪比警告 | 写死(<0.5红) | 🟡 | 阈值 | `IF ratio<0.5 THEN '假增长'` | P0 |

**⚠️ 这是INFINITY OS的核心地基 · 必须最先接**

---

## TAB 3 · Agent矩阵(8个Agent)

| Agent | 字段 | 当前值 | 状态 | 真数据源 |
|---|---|---|---|---|
| 蝴蝶效应 | 状态 | "🟡部分" | 🔴 | inf_agent_runlog · status |
| 蝴蝶效应 | 已运行天数 | JS随机 | 🟡 | inf_agent_runlog · DATEDIFF |
| 蝴蝶效应 | 上次更新 | JS随机 | 🟡 | inf_agent_runlog · last_run |
| Omakase推单 | (同上) | (同上) | (同上) | (同上) |
| A值校准 | (同上) | (同上) | (同上) | (同上) |
| CB分Agent | (同上) | (同上) | (同上) | (同上) |
| PRISM | (同上) | (同上) | (同上) | (同上) |
| 货架识别 | 精度% | 写死76-88% | 🟡 | inf_agent_metrics · accuracy |
| 价签识别 | 状态 | 写死 | 🔴 | inf_agent_runlog |
| 总指挥 | 整合度 | 写死80% | 🟡 | 计算: 已上线Agent / 总Agent |

---

## TAB 4 · 6层架构(L1-L6)

| 层 | 字段 | 当前值 | 状态 | 真数据源 |
|---|---|---|---|---|
| L1战略 | 完成度 | 写死88% | ⚪ | DS手动维护(战略文档完成度) |
| L2合伙人协议 | 完成度 | 写死82% | ⚪ | DS+法务手动维护 |
| L3 Interface | 完成度 | 写死72% | ⚪ | 9件套上线情况 |
| L4 Orchestration | 完成度 | 写死65% | ⚪ | TL评估 |
| L5 Decision | 完成度 | 写死75% | 🟡 | Agent上线数 / 24 |
| L6 Memory | 完成度 | 写死55% | ⚪ | 5表上线情况 |

**说明**: 6层架构完成度 · 一半是策略性数字 · 不一定要"实时数据" · DS+TL每月review更新即可。

---

## TAB 5 · 合伙人(Top 10经销商)

### 5.1 TOP_DEALERS(10家明细)

| 字段 | 当前值 | 状态 | 真数据源 | SQL | 优先级 |
|---|---|---|---|---|---|
| 名称(明发等10家) | 写死 | 🔴 | 汉询·`dealer.name` | `SELECT name FROM dealer ORDER BY revenue DESC LIMIT 10` | **P0** |
| 区域 | 写死 | 🔴 | 汉询·`dealer.region` | `SELECT region` | **P0** |
| 月营收(万) | 写死 | 🔴 | 汉询·按dealer·按月SUM | `SUM(amount) BY dealer, month` | **P0** |
| 蒸腾率% | 写死 | 🟡 | 汉询·`rixiao` | `AVG(rixiao_growth)` | **P0** |
| 销量增长% | 写死 | 🔴 | 汉询·同比 | `(this_month - last_month) / last_month` | **P0** |
| 真伪比 | 写死 | 🟡 | 计算 | `evapo / sales` | P0 |
| 评级(A+/A/B+) | 写死 | 🟡 | 5维评分(见文档16) | 见合伙人筛选标准.md | P1 |
| 是否深度合伙 | 写死 | 🔴 | inf_partner_agreement · type | `WHERE type='deep'` | P1 |
| 状态(真增长/压货警示) | 写死 | 🟡 | 蝴蝶Agent判定 | A/B/C三类畸变检测 | P0 |

---

## TAB 6 · IPO链路(0-13节点)

### 6.1 14个节点的核心数据

| 节点 | 名称 | 当前值 | 状态 | 真数据源 | 优先级 |
|---|---|---|---|---|---|
| IPO0 | 工厂 | 96% | 🔴 | MES·production_actual / plan | **P0** |
| IPO1 | 仓储 | 92% | 🔴 | WMS·`stock_turnover` | **P0** |
| IPO2 | 经销进 | 85% | 🔴 | SAP·purchase_order | **P0** |
| IPO3 | **经销库** | 3.8a⚠ | 🔴 | Dcloud·`wm_stock_matnr` | **P0** |
| IPO4 | 经销出 | 82% | 🔴 | SAP·sales_order | **P0** |
| IPO5 | 二批进 | 88% | 🟡 | (二批商缺数据·新建) | P1 |
| IPO6 | 二批库 | 1.0a | 🟡 | (二批商缺数据·新建) | P1 |
| IPO7 | 二批出 | 90% | 🟡 | (二批商缺数据·新建) | P1 |
| IPO8 | 门店进 | 84% | 🟡 | POS·补货记录 | P1 |
| IPO9 | 门店库 | 2.1a | 🟡 | POS·`shelf_inventory` | P1 |
| IPO10 | 动销 | 87% | 🟡 | POS·`scan_count` | P1 |
| IPO11 | 购买 | 79% | 🟡 | POS·结账数据 | P1 |
| IPO12 | 家中 | ~14天 | 🟡 | 消费者调研(无源·写死) | P3 |
| IPO13 | 复购 | 82% | 🟡 | 微信会员·复购周期 | P2 |

**⚠️ 二批商数据(IPO5-7)是欣和当前的盲点** · 需要业务团队推动二批商接入数据

### 6.2 IPO节点详情modal数据

```
点开IPO3 → 显示10家经销商库存清单
当前:写死(明发3.8a/康润4.2a/宝润2.1a等)
真数据源:汉询·按dealer的wm_stock(实时)
优先级:P0

点开IPO9 → 显示门店库存清单
当前:写死(老张便利店2.1a/阳光超市1.8a等)
真数据源:POS·按store的shelf_inventory
优先级:P1
```

---

## TAB 7 · 战略SKU(3个)

| SKU | 字段 | 当前值 | 状态 | 真数据源 | 优先级 |
|---|---|---|---|---|---|
| 六月鲜·有机系列 | 达成率78% | 写死 | 🔴 | 汉续·按SKU·达成率 | **P0** |
| 六月鲜·有机系列 | 配额6万箱 | 写死 | 🔴 | inf_strategy_sku · quota | P0 |
| 六月鲜·有机系列 | 已完成4.68万箱 | 写死 | 🔴 | 汉询·按SKU·SUM | **P0** |
| 六月鲜·有机系列 | 蒸腾↑20%/销量↑15% | 写死 | 🟡 | 汉询·按SKU计算 | P0 |
| 六月鲜·有机系列 | 真伪比1.33 | 写死 | 🟡 | 计算 | P0 |
| 六月鲜·高端礼盒 | (同上字段) | (同上) | (同上) | (同上) | P1 |
| 禾然·零添加 | (同上字段) | (同上) | (同上) | (同上) | P1 |
| SKU状态(▶推进中/⏸已暂停) | 写死推进中 | 🟡 | inf_strategy_sku · status | DS+TL人工切换 | P1 |

---

## TAB 8 · 决策记录(inf_actions)

| 字段 | 当前值 | 状态 | 真数据源 | 优先级 |
|---|---|---|---|---|
| 月决策总数 | 写死42 | 🔴 | inf_actions · COUNT | P1 |
| 平均决策时长 | 写死2.3天 | 🟡 | 计算 | P1 |
| 完成率 | 写死85% | 🔴 | inf_actions · status | P1 |
| 决策列表(每条) | 写死 | 🔴 | inf_actions · 全字段 | P1 |

---

## TAB 9 · 总指挥Brain(对话)

| 字段 | 当前值 | 状态 | 真数据源 |
|---|---|---|---|
| 对话历史 | localStorage(v1.4) | 🟡 | inf_chat_history(后端版) |
| API调用 | Anthropic API直连 | 🟡 | 同左·或后端转发 |
| Agent整合度80% | 写死tag | 🟡 | 计算: 已上线 / 总 |

---

## TAB 10 · 全局搜索(40+条数据)

| 类别 | 当前 | 状态 | 真数据源 | 优先级 |
|---|---|---|---|---|
| 8个Agent | 写死(GLOBAL_SEARCH_DB) | 🔴 | inf_agent_definition | P1 |
| 10家经销商 | 写死 | 🔴 | 汉询·dealer | **P0** |
| 3个战略SKU | 写死 | 🔴 | inf_strategy_sku | P0 |
| 5个品牌 | 写死 | 🚫 | 不接(战略级·稳定) |
| 6层架构L1-L6 | 写死 | 🚫 | 不接(战略级·稳定) |
| 5个IPO节点 | 写死 | 🔴 | 同IPO章节 | P1 |
| 5个议题 | 写死 | 🔴 | inf_alerts(蝴蝶Agent生成) | P0 |

---

# 📱 第9件APP(v9f)· 数据Mapping

## 🍳 美顾视图(Meigu)

### 美顾个人数据(陈晓琳)

| 字段 | 当前值 | 状态 | 真数据源 | SQL | 优先级 |
|---|---|---|---|---|---|
| 姓名"陈晓琳" | 写死 | 🔴 | SAP·hr_employee | `SELECT name WHERE role='美顾'` | **P0** |
| 等级5星 | 写死 | 🔴 | inf_meigu_level | `SELECT level WHERE id=?` | P0 |
| 招牌菜🍖红烧肉 | 写死 | 🔴 | inf_meigu_dishes | `SELECT signature_dish` | P1 |
| 所在区域(锦江) | 写死 | 🔴 | SAP·hr_assignment | `SELECT district` | P0 |
| 督导(刘师傅) | 写死 | 🔴 | inf_org_chart · supervisor | `SELECT supervisor_name` | P1 |

### 美顾收入

| 字段 | 当前值 | 状态 | 真数据源 | 公式 | 优先级 |
|---|---|---|---|---|---|
| 今日收入¥386(初始) | 写死 | 🔴 | SAP·payroll(实时) | `SUM(today_tasks)` | **P0** |
| 本月收入¥9,860(5星) | 写死 | 🔴 | SAP·payroll(月度) | `SUM(month_tasks)` | **P0** |
| 单任务报酬 | 写死 | 🔴 | inf_task_pricing | 任务难度+门店等级算 | P0 |
| 平台抽成15% | 写死(v9d) | 🟡 | inf_platform_fee · rate | 全局规则 | P1 |
| 实际到手 | 公式计算 | 🟡 | 公式 | `report - fee` | P0 |

### 美顾任务大厅

| 字段 | 当前值 | 状态 | 真数据源 | 优先级 |
|---|---|---|---|---|
| 任务列表(老张/阳光/王府井等5个) | 写死 | 🔴 | inf_tasks · status='available' | **P0** |
| 任务标题(紧急·老张便利店) | 写死 | 🔴 | inf_tasks · title | P0 |
| 任务类型(紧急/高优/常规/低优/小单) | 写死 | 🔴 | inf_tasks · priority | P0 |
| 任务报酬¥58/¥285 | 写死 | 🔴 | inf_tasks · price | P0 |
| 距离最近美顾 | 写死(陈晓琳1.2km) | 🟡 | 实时计算GPS | P2 |

### 美顾"我的任务"(v9d/v9e闭环)

| 字段 | 当前值 | 状态 | 真数据源 | 优先级 |
|---|---|---|---|---|
| 进行中任务 | localStorage(v9e) | 🟡 | inf_my_tasks · status='inprogress' | P1 |
| 已完成任务 | localStorage | 🟡 | inf_my_tasks · status='completed' | P1 |
| 评分1-5星 | localStorage | 🟡 | inf_task_ratings | P1 |
| 完成时间 | localStorage | 🟡 | inf_my_tasks · complete_time | P1 |

### 美顾AI主厨Agent(v9d/v9e)

| 字段 | 当前值 | 状态 | 真数据源 |
|---|---|---|---|
| 多轮对话历史 | localStorage(v9e) | 🟡 | inf_chat_history |
| 主厨System prompt | 写死(v9e) | 🚫 | 不接(战略级prompt) |

---

## 👨‍🍳 督导视图(Supervisor)

### 督导个人(刘师傅)

| 字段 | 当前值 | 状态 | 真数据源 | 优先级 |
|---|---|---|---|---|
| 姓名"刘师傅" | 写死 | 🔴 | SAP·hr_employee | P0 |
| 招牌菜👨‍🍳东坡肉 | 写死 | 🔴 | inf_meigu_dishes | P1 |
| 月收入¥18,230 | 写死 | 🔴 | SAP·payroll | P0 |
| 带教徒弟数 | 写死 | 🔴 | inf_org_chart | P1 |

### 督导徒弟列表

| 字段 | 当前值 | 状态 | 真数据源 |
|---|---|---|---|
| 徒弟姓名 | 写死(陈晓琳/王芳/李小妹/张华/赵娟) | 🔴 | SAP·hr_subordinates |
| 各徒弟主厨菜 | 写死 | 🔴 | inf_meigu_dishes |
| 各徒弟评分 | 写死 | 🟡 | CB分Agent计算 |

### 督导AI Agent · 刘师傅

| 字段 | 当前值 | 状态 | 真数据源 |
|---|---|---|---|
| 多轮对话 | localStorage | 🟡 | inf_chat_history(role=supervisor) |

---

## 🚗 DSR视图(周小军)

### DSR个人

| 字段 | 当前值 | 状态 | 真数据源 |
|---|---|---|---|
| 姓名周小军 | 写死 | 🔴 | SAP·hr_employee |
| 月收入¥16,390 | 写死 | 🔴 | SAP·payroll |
| 管辖片区(锦江+武侯) | 写死 | 🔴 | SAP·assignment |
| 管辖美顾数 | 写死 | 🔴 | SAP·subordinates |

### DSR派单大厅

| 字段 | 当前值 | 状态 | 真数据源 | 优先级 |
|---|---|---|---|---|
| 待派任务 | 写死 | 🔴 | inf_tasks · status='pending' | **P0** |
| 美顾在线状态 | 写死 | 🟡 | inf_meigu_status(实时) | P1 |
| 任务+美顾匹配建议 | 写死 | 🟡 | Omakase推单Agent | P1 |
| 强派/加价操作 | 写死(toast) | 🔴 | inf_tasks · 操作日志 | P1 |

### DSR数据看板

| 字段 | 当前值 | 状态 | 真数据源 |
|---|---|---|---|
| 今日完成数 | 写死 | 🔴 | inf_tasks · COUNT WHERE date=today |
| 美顾活跃度 | 写死 | 🟡 | inf_meigu_status |
| 区域KPI | 写死 | 🔴 | 汉续·按district |

---

## 🎯 DOM视图(王区域)

### DOM个人

| 字段 | 当前值 | 状态 | 真数据源 |
|---|---|---|---|
| 姓名王区域 | 写死 | 🔴 | SAP·hr_employee |
| 月收入¥25,840 | 写死 | 🔴 | SAP·payroll |
| 管辖4片区(锦江+武侯+青羊+高新) | 写死 | 🔴 | SAP·assignment |

### DOM区域KPI

| 字段 | 当前值 | 状态 | 真数据源 |
|---|---|---|---|
| 4片区达成率 | 写死 | 🔴 | 汉询·按district |
| 战略SKU推进 | 写死 | 🔴 | 汉询·按SKU·按district |
| 蝴蝶预警 | 写死 | 🔴 | inf_alerts(按district过滤) |

---

## 🌆 城市经理视图(陈成都)

### 城市经理个人

| 字段 | 当前值 | 状态 | 真数据源 |
|---|---|---|---|
| 姓名陈成都 | 写死 | 🔴 | SAP·hr_employee |
| 月收入¥42,200 | 写死 | 🔴 | SAP·payroll |
| 管辖成都市 | 写死 | 🔴 | SAP·assignment |

### 城市经理数据

| 字段 | 当前值 | 状态 | 真数据源 |
|---|---|---|---|
| 成都市营收 | 写死 | 🔴 | 汉询·WHERE city='成都' |
| 4个DOM协调 | 写死 | 🔴 | SAP·subordinates |
| 经销商10家 | 写死 | 🔴 | 汉询·dealer WHERE city |
| 试点6月进度 | 写死 | ⚪ | inf_pilot_progress(新建表) |

---

## 🏙️ MCTL视图(王西南)

### MCTL个人

| 字段 | 当前值 | 状态 | 真数据源 |
|---|---|---|---|
| 姓名王西南 | 写死 | 🔴 | SAP·hr_employee |
| 月收入¥70,900 | 写死 | 🔴 | SAP·payroll |
| 管辖西南4市(成都+重庆+昆明+贵阳) | 写死 | 🔴 | SAP·region_assignment |
| 西南月度¥1.98M | 写死 | 🔴 | 汉询·WHERE region='西南' |

### MCTL城市拆分

| 字段 | 当前值 | 状态 | 真数据源 |
|---|---|---|---|
| 成都520+重庆620+昆明480+贵阳360 | 写死 | 🔴 | 汉询·按city·SUM |

---

## 🌏 大区总视图(李华东)

### 大区总个人

| 字段 | 当前值 | 状态 | 真数据源 |
|---|---|---|---|
| 姓名李华东 | 写死 | 🔴 | SAP·hr_employee |
| 月收入¥128,000 | 写死 | 🔴 | SAP·payroll |
| 管辖华东大区(3片区) | 写死 | 🔴 | SAP·region_assignment |
| 华东月度¥6.30M | 写死 | 🔴 | 汉询·WHERE region='华东' |

### 大区总片区拆分

| 字段 | 当前值 | 状态 | 真数据源 |
|---|---|---|---|
| 华北2.5+西南1.98+华南1.82 | 写死 | 🔴 | 汉询·按sub_region·SUM |

---

# 🏪 其他8件套 · 数据Mapping(简版)

## 1. 8入口登录中枢

| 字段 | 状态 | 真数据源 | 优先级 |
|---|---|---|---|
| 用户登录(角色/权限) | 🔴 | SAP·hr_employee + inf_role_permission | P0 |
| 单点登录SSO | 🔴 | 欣和企微SSO | P0 |
| 8入口跳转链接 | 🚫 | 静态(部署URL) | - |

## 2. 8入口能力清单

| 字段 | 状态 | 真数据源 | 优先级 |
|---|---|---|---|
| 各件功能列表 | 🚫 | 静态文档 | - |
| Agent状态 | 🟡 | inf_agent_runlog | P1 |

## 3. SFA · 欣和员工

| 字段 | 状态 | 真数据源 | 优先级 |
|---|---|---|---|
| 员工列表 | 🔴 | SAP·hr_employee | P0 |
| 拜访计划 | 🔴 | inf_visit_plan | P0 |
| 访问记录 | 🔴 | inf_visit_log | P0 |
| 库存上报 | 🔴 | POS或人工 | **P0** |
| 货架照片 | 🔴 | OSS存储+千问VL识别 | **P0** |

**⚠️ SFA库存上报是INFINITY OS的"血液入口" · 必须最优先**

## 4. 经销商Web主控台

| 字段 | 状态 | 真数据源 | 优先级 |
|---|---|---|---|
| 经销商自身销量 | 🔴 | 汉询·dealer | P0 |
| 库存水位 | 🔴 | Dcloud·wm_stock | **P0** |
| 健康评分 | 🟡 | 5维评分计算 | P1 |
| 资源分配 | 🔴 | inf_partner_resource | P1 |
| 共创奖金 | 🔴 | inf_partner_bonus | P1 |

## 5. DSFA · 经销商业务员

| 字段 | 状态 | 真数据源 | 优先级 |
|---|---|---|---|
| 经销商业务员列表 | 🔴 | dealer · employees | P0 |
| 拜访计划 | 🔴 | inf_dsfa_visit_plan | P0 |
| 库存盘点 | 🔴 | Dcloud实时同步 | **P0** |

## 6. 工厂MES · 仓储WMS

| 字段 | 状态 | 真数据源 | 优先级 |
|---|---|---|---|
| 生产计划 | 🔴 | MES·`production_plan` | **P0** |
| 实际产出 | 🔴 | MES·`production_actual` | **P0** |
| 仓库库存 | 🔴 | WMS·`stock_warehouse` | **P0** |
| 发货记录 | 🔴 | WMS·`shipment_log` | P0 |

## 7. 微信H5 · 门店消费者

| 字段 | 状态 | 真数据源 | 优先级 |
|---|---|---|---|
| 消费者扫码 | 🔴 | POS+微信·`scan_log` | P1 |
| 复购周期 | 🔴 | 微信会员·purchase_history | P2 |
| 推荐SKU | 🟡 | Omakase推单Agent | P2 |

---

# 🎯 数据源 · 总览(8个核心系统)

## 1. SAP(欣和ERP)

```
作用:HR + 财务 + 销售订单
核心表(预估):
  - hr_employee(员工)· 几千条
  - hr_assignment(任职)· 几千条
  - payroll(工资)· 月度
  - sales_order(销售订单)· 日级几万条
  - purchase_order(采购订单)· 日级几千条

接入方式:
  - 通过欣和数据团队·授权账号
  - 优先级:P0(美顾/督导/DSR等所有人员数据)
```

## 2. 汉询(销售数据采集)

```
作用:r值数据源(蒸腾计算的核心)
核心表:
  - rixiao(日销率)· 日级·按SKU·按门店
  - sales_daily(日销售)· 日级·按SKU·按门店
  - dealer(经销商主数据)
  - store(门店主数据)

接入方式:
  - 汉询API(已有·欣和数据团队对接)
  - 优先级:P0(必须最先接)
```

## 3. Dcloud EPP(经销商进销存)

```
作用:经销商库存(蝴蝶预警的核心)
核心表:
  - wm_stock_matnr(物料库存)· 实时·按SKU·按经销商
  - wm_movement(库存变动)· 日级
  - wm_warehouse(仓库主数据)

接入方式:
  - Dcloud API
  - 优先级:P0
```

## 4. Hologres(阿里云数据湖)

```
作用:实时数据仓库·322张业务表
核心表(关键22张):
  - ods_sales_daily(销售)
  - ods_inventory_distributor(经销商库存)
  - ods_pos_realtime(POS实时)
  - 其他19张...

接入方式:
  - PostgreSQL驱动
  - 优先级:P1(W4之后接)
```

## 5. POS(零售门店)

```
作用:门店销售+库存+陈列
核心表:
  - scan_count(扫码次数)
  - shelf_inventory(货架库存)
  - sales_record(销售记录)

接入方式:
  - POS厂商API(零售/商超不同)
  - 优先级:P1-P2
```

## 6. MES(工厂)

```
作用:生产计划+实际产出
核心表:
  - production_plan(生产计划)
  - production_actual(实际产出)
  - quality_inspection(质量检验)

接入方式:
  - MES厂商API
  - 优先级:P0(IPO0数据源)
```

## 7. WMS(仓储)

```
作用:仓库库存+发货
核心表:
  - stock_warehouse(仓库库存)
  - shipment_log(发货记录)
  - inbound_log(入库记录)

接入方式:
  - WMS厂商API
  - 优先级:P0(IPO1数据源)
```

## 8. INFINITY OS自有表(新建)

```
作用:INFINITY OS的运营数据
核心表(必建):
  - inf_nodes(节点定义)
  - inf_heartbeat(心跳记录)
  - inf_alerts(预警)
  - inf_actions(决策)
  - inf_node_targets(目标)
  - inf_agent_definition(Agent定义)
  - inf_agent_runlog(Agent运行日志)
  - inf_agent_metrics(Agent指标)
  - inf_chat_history(对话历史)
  - inf_my_tasks(美顾任务)
  - inf_meigu_level(美顾等级)
  - inf_meigu_dishes(美顾招牌菜)
  - inf_partner_agreement(合伙人协议)
  - inf_partner_bonus(合伙人奖金)
  - inf_strategy_sku(战略SKU)
  - inf_pilot_progress(试点进度)
  - inf_role_permission(角色权限)
  - 其他...

接入方式:
  - TL自建·MySQL/Hologres
  - 优先级:P0(承载所有Agent输出)
```

---

# 📅 接入时间表(给TL · 6周冲刺路线)

## Week 1-2 · 基础打通(P0数据源)

```
🔴 W1
  - 阿里云ECS+MySQL+Redis环境
  - 联系欣和数据团队·拿汉询API账号
  - 联系SAP团队·拿欣和员工/订单授权
  - 建inf_*核心5张表(nodes/heartbeat/alerts/actions/node_targets)

🔴 W2
  - 接入汉询·rixiao(蒸腾的根)
  - 接入SAP·hr_employee(7层人员的根)
  - 第1次端到端:看到真实蒸腾率·真实美顾名单
```

## Week 3-4 · 核心数据(P0剩余)

```
🔴 W3
  - 接入Dcloud·wm_stock(蝴蝶预警的根)
  - 接入SAP·sales_order(销售数据)
  - 接入MES·production_actual(IPO0)
  - 接入WMS·stock_warehouse(IPO1)

🔴 W4
  - A值校准Agent上线(每周一06:00自动)
  - 蝴蝶效应Agent上线(基于汉询+Dcloud)
  - 主控台MAX的"真假数据切换开关"(灰度上线)
```

## Week 5-6 · 启用Agent(P1)

```
🟡 W5
  - Omakase推单Agent上线
  - 美顾任务列表接inf_tasks真实数据
  - DSR派单接真实流程
  - 微信工作通推送

🟡 W6
  - 决策记录(inf_actions)接入
  - 6层架构完成度·DS手动review
  - 第1次给老板看"真数据驱动的INFINITY OS"
```

## Week 7-12 · 完善(P2)

```
🟢 W7-12
  - POS数据接入(IPO9-13)
  - 微信H5消费者数据
  - 二批商数据(IPO5-7 · 业务团队推动)
  - 数据团队优化·性能调优
```

---

# 📊 字段统计 · 总览

## 主控台MAX(13个tab)

```
总字段数:~120个
🔴 写死 · 102个 (85%)
🟡 公式/JS随机 · 13个 (11%)
🟢 真接 · 0个 (0%)
🚫 不接 · 5个 (4%)

P0必接:42个
P1次必接:38个
P2可接:22个
```

## 第9件APP v9f(7层撮合)

```
总字段数:~85个
🔴 写死 · 71个 (84%)
🟡 公式 · 14个 (16%)
🟢 真接 · 0个

P0必接:38个
P1次必接:32个
P2可接:15个
```

## 9件套合计

```
总字段数:~280个
P0必接:120个
P1次必接:90个
P2可接:50个
不接(战略文案/装饰):20个

TL接完P0需要:6周
TL接完P0+P1需要:12周
TL接完所有:18-24周
```

---

# 🎯 关键Mapping原则

## 原则1 · 优先接"血液"

```
不是所有数据都要接
优先接INFINITY OS的"血液":
  1. 蒸腾(汉询·rixiao)→ Layer 2.0的根
  2. 库存(Dcloud·wm_stock)→ 蝴蝶预警的根
  3. 人员(SAP·hr_employee)→ 7层撮合的根
  4. 销售(汉询·sales_daily)→ 业绩判断的根

这4个接完 · INFINITY OS就活了
```

## 原则2 · 不接"装饰"

```
有些数据永远不接:
- 5品牌定位文案(战略级·稳定)
- 6层架构L1-L6描述(战略级)
- 主厨System prompt(prompt是设计·不是数据)
- 颜色/字号/Logo

接这些 = 浪费
```

## 原则3 · 公式 vs 数据

```
有些是数据(直接取):
  - 经销商月营收 = 汉询SUM
  - 美顾月收入 = SAP取

有些是公式(计算):
  - 蒸腾率 = a ÷ T(取a和T,算出r)
  - 真伪比 = 蒸腾% ÷ 销量%
  - CB分 = 0.5×粘性 + 0.3×评价 + 0.2×执行
  - 健康评分 = 5维加权(参考文档16)

公式不需要"接" · 但需要TL实现
```

## 原则4 · 双轨并行(过渡期)

```
TL接数据时·必须支持"双轨":
  - 模式A:模拟数据(当前) · 用于演示/试点早期
  - 模式B:真数据(接入后) · 用于真实运营
  
开关:URL参数 ?mode=mock 或 ?mode=real
意义:
  - 接入过程不影响演示
  - 真数据接入后可对比验证
  - 出问题可立即切回模拟
```

## 原则5 · 接入即可观测

```
每接入一个数据源·必须有:
  1. 数据流监控(每天导入了多少条)
  2. 数据质量监控(NULL率/异常率)
  3. 接入失败告警(企微通知TL)
  4. 灰度开关(出问题立即切回模拟)
  
没监控的接入 = 定时炸弹
```

---

# 🚨 关键风险 + 缓解

## 风险1 · 字段名不对(高频)

```
风险:Agent猜的表名/字段名 · 跟欣和真实不一样
缓解:
  - V1.0先做"逻辑Mapping"(说清楚要接什么数据)
  - V1.1由TL+数据团队补"物理Mapping"(具体表/字段)
  - 不假装V1.0就准确
```

## 风险2 · 数据团队配合度

```
风险:数据团队工时紧张·接入慢
缓解:
  - DS+老板提前打招呼
  - 业务总监推动SAP Step 2
  - TL入职前申请好账号
```

## 风险3 · 二批商无数据

```
风险:IPO5-7(二批商)欣和当前没有数据
缓解:
  - 短期:跳过IPO5-7 · 显示"无数据"
  - 中期:推动业务团队让二批商接入
  - 长期:Dcloud+二批商主控台
```

## 风险4 · 接入后数据不对

```
风险:真数据接进来·和业务直觉不符(可能bug也可能业务变化)
缓解:
  - 双轨并行(模拟+真数据可切换)
  - 灰度上线(先1家经销商真数据·验证)
  - 业务团队签字"数据正确" · 才全量切换
```

## 风险5 · 性能瓶颈

```
风险:汉询/Dcloud数据量大·查询慢
缓解:
  - Redis缓存热点查询
  - Hologres物化视图
  - 异步ETL · 不实时拉取
```

---

# 💎 V1.1需要补充的(等TL入职后)

## TL补充

```
1. 真实表结构(欣和实际表名/字段名)
2. 具体SQL语句(可执行)
3. ETL频率(实时/T+1/批量)
4. 数据量级(行数/MB)
5. 性能指标(查询耗时)
```

## 业务团队补充

```
1. 二批商数据如何获取(渠道/方式)
2. 消费者数据合规边界
3. 战略SKU调整流程
4. 蝴蝶预警的业务定义
```

## 数据团队补充

```
1. 各数据源的SLA
2. 数据延迟时间
3. 历史数据可回溯范围
4. 权限申请流程
```

---

# 🎯 给OS Team的话

```
这份Mapping V1.0:
✅ 覆盖9件套所有可见字段(280+)
✅ 每个字段标注:状态/数据源/优先级
✅ 给出8个核心系统接入路径
✅ 给出6周冲刺路线
✅ 标注5个关键风险

但这是V1.0:
⚠️ 表名/字段名是Agent的"逻辑命名" · 不是欣和真实表
⚠️ 需要TL+数据团队Review后形成V1.1
⚠️ 估时是Agent估算 · TL实际可能更长

V1.0的价值:
- 让TL第1天就有"地图"
- 让业务团队知道SAP Step 2要做什么
- 让数据团队知道要开放哪些权限
- 让DS心里有数

不是终点·是起点
6周后V1.1 · 12周后V2.0 · 24周后V3.0
INFINITY OS从Layer 1.7 → Layer 2.0 → Layer 3.0
```

---

*INFINITY OS · 数据Mapping V1.0*
*欣和SH · 2026-04-29*
*DS + Agent联合编制*
*等待:OS Team / TL / 数据团队 review后形成V1.1*
