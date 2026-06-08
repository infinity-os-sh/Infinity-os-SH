# INFINITY OS · 渠道品类管理成长 Agent

把 ECR 品类管理八步法 **结构化 → 建模 → 工程化**,做成欣和的渠道品类 Agent。
核心:**一个循环 · 两本账 · 一组对应门**,既满足零售商,也满足欣和,双赢各取其值。

署名 DS · 全部为 Layer 1.3 演示(门引擎=真实计算,数据=模拟,已标注)。

---

## 文件清单(建议从 index 进)

| 文件 | 类型 | 说明 |
|---|---|---|
| `infinity_os_category_agent_index.html` | 导航 | 总览首页,先打开这个 |
| `infinity_os_category_agent_app.html` | **可动产品** | 驾驶舱 / 今日要关的差 / 八步引擎,点"运行引擎"看它跑。**主入口** |
| `infinity_os_8step_engine_demo.html` | 可点 demo | ECR 真实个案走查八步,理解引擎机制 |
| `infinity_os_category_8step_spec_v0_1.html` | 设计 | 骨架 Spec V0.1(agent_spec_04):架构 + 八步对应 + L2 门库 |
| `infinity_os_8step_container_engine_v0_1.html` | 设计 | 容器引擎:schema + 门引擎契约 + 接线(TL 照建) |
| `infinity_os_live_data_wiring.html` | 设计 | 接真实数据清单:字段映射 + SIM→LIVE 切换 + 待校项 |

## 阅读顺序

设计链:骨架 → 容器引擎 → 走查 demo → 可动产品 → 接数据
快速看效果:直接开 `app`,点"运行引擎"。

## 部署

GitHub Pages 直接上传即可。文件名无空格,互不覆盖现有 `index.html`
(本包导航页另名为 `..._agent_index.html`)。

## 关键设计

- **不混层**:零售商品类角色 与 欣和 SKU 角色分属两本账,schema 用 `entity_type` 硬隔离。
- **数据可换**:所有数据走 `DataSource` 适配层,SIM/LIVE 两模式对引擎透明,换真实数据不动引擎/界面。
- **门引擎真在算**:机会值、健康度、keystone 双赢建议均为实算(机会值 ≈ 个案原文,已校)。

## 下一步(三条轨)

1. **业务·现在** — 填 `infinity_os_node_targets` 的 r_target + grade,导 SQL 给 DBA(解锁评分表 + SAP Step 2 + LIVE)。最紧急,不靠 TL。
2. **DS·现在** — 校"接数据清单"里 4 个业务判断(Fair Share 基准 / keystone 阈值 / 欣和 SKU 占比上限 / 健康度权重);部署本包供团队反馈。
3. **后端·TL 入职后** — 建表 + 实现 `LIVE.stores()` + Java 门引擎,切 LIVE 真跑。

真跑唯一前置:业务团队填 node_target 导 SQL。它一通 + 4 项校准定了,DataSource 切 LIVE,从"模拟动"变"真数据动",不重做任何东西。
