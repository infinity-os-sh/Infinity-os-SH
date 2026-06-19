# INFINITY OS · CloudBase 第一回路接入 (第一里程碑)

> 严格按《接手说明v1.0·第一里程碑》：**只做第一条回路**（门店盘点 → 唯一身份 → 只读汇总），不碰其余节点。
> 后端：腾讯云开发 CloudBase。每条数据带 `source_ref + ts` 可审计；**不含任何涉钱涉权自动执行接口**。

---

## ⚠ 缺什么（连不上/不可用时先说清）

| 缺口 | 现状 | 影响 | 最小替代方案（已内置，不卡住） |
|---|---|---|---|
| **CloudBase 环境ID** | 任务给的是占位符 `[环境ID]` | 无法真连/建库/建登录 | 单一配置点 `CB_ENV_ID`；未填→自动**双轨·mock**，页面照常跑、可演示 |
| **SecretId / SecretKey / 自定义登录私钥** | 未提供 | 工号自定义登录、云函数无法部署 | 手机号走 CloudBase 短信验证码（配好环境即用）；工号登录留好接口，接后端即生效 |
| **《字段字典v1.0》原件** | 未入库（仓库只有可对齐 schema） | 6开关里仅 `on_shelf/oos_flag/display_rate` 被点名 | 其余3个（`sellout/repurchase/margin`）取对齐 `04_l0_to_l1` 的推断默认，**改名只改 `field-dictionary.js` + `inventory_snapshot.schema.json` 两处** |
| **门店/SKU 主数据** | 演示用名称 | SKU 未归一到主数据编码 | `STORE_MAP` / SKU 按名匹配占位，接 SKILL §9 主数据后替换 |

> `oos_flag` 语义需字典确认：本实现按「缺货标记」处理（`oos_flag = !有货`，与 app『有货』开关反向）。

---

## 要上线，给我这 3 样（最小集）
1. **CloudBase 环境ID**（如 `infinity-os-xxxx`）→ 填进 `cloudbase-client.js` 的 `CB_ENV_ID`。
2. CloudBase 控制台开 **短信登录**（手机号验证码）+ 建集合 `inventory_snapshot`（按 `inventory_snapshot.schema.json`）。
3. 若要**工号登录**：一个校验工号、查 HR 主数据并签发 ticket 的云函数（只读、不涉权）。

---

## 文件
| 文件 | 作用 | 对应步骤 |
|---|---|---|
| `inventory_snapshot.schema.json` | 盘点表集合定义（字段照字典，`effective_stage` 预留） | ① 建盘点表 |
| `field-dictionary.js` | 字段名单一事实源 + app6开关↔字典映射 + mock种子 | 全程（防新造字段） |
| `cloudbase-client.js` | SDK 加载 + 真登录(手机号/工号)→唯一身份 + 盘点读写（mock兜底） | ② 真登录 / ③ fetch |
| `../inventory-summary.html` | 管理层只读汇总：某店某SKU 哪些开关 ON/OFF | ④ 只读汇总页 |
| `../ica-v35-0601.html` | 增量补丁：替换 `ica_user_v35` 本机存名为真登录；写死SKU状态换fetch；上报顺带写合规盘点 | ②③ |
| `../inf-xd-v6712-0601.html` | 增量补丁：督导侧**只读**消费盘点（`window.infxdInventory()`） | ③ |

## 双轨怎么切（原则4）
- `CB_ENV_ID` 是占位符 / SDK加载失败 → **mock 模式**：用 `field-dictionary.js` 种子 + localStorage，离线可跑。
- 填真实 `CB_ENV_ID` → **真接模式**：登录、读写走 CloudBase。
- 两个 app 与汇总页右上角都有「真接 / 双轨·mock」徽标，所见即当前模式。

## 铁律落实
- **不重写前端**：两个 HTML 仅在 `</body>` 前**追加**补丁脚本（沿用仓库既有「止血补丁」增量风格），原 UI/交互/逻辑零改动。
- **字段名照字典、不新造**：全部集中在 `field-dictionary.js`。
- **涉钱涉权不自动执行**：本回路只采集/只读盘点；补货下单、改权限、发钱**不提供接口**。
- **判级/护栏不改**：`bas_inventory_skill_v0_1.md`（SKILL）未改动。
- **可审计**：每条盘点带 `source_ref{source,submission_id,raw_ref,app} + ts + reporter`。
