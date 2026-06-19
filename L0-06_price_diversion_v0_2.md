---
name: price-diversion-monitor
description: 消费 L0-02 跨店价签数据与 L0-01 批次/一物一码扫码数据,按写死阈值表检测自家产品的跨店跨区价格模式异常(乱价/区域价差,带预警台账防疲劳),按批次归属比对监测窜货嫌疑(先核授权流动白名单、达最小证据线才立案)并立案管理(案件状态机)。凡涉及"窜货、串货、乱价、低价倾销、价格秩序、区域价差、批次流向、调拨核对、稽查立案、价格管控"的输入都用本 Skill。它是价格秩序与流向秩序的监测方(L0-06),全系统第一个带 HITL 的节点——疑似窜货停机转人工稽查,机器只产证据和等级,绝不自动定性、绝不自动处罚。下游:渠道稽查 / 城市经理 / L0-03 日报(透传)/ L5-01(竞争环境观察)。
version: v0.2
owner: <填:负责人/团队>
type: Workflow / Skill(监测节点 · 有状态案件机+预警台账 · 带 HITL · L0-06)
status: 粗糙版 v0.2,待真实数据迭代
upstream: L0-02 价签数据(跨店批量)/ L0-01 批次与一物一码扫码(INF-XD)/ 管控价与批次归属主数据(经 MCP)/ 授权流动记录(调拨单·分货单,经 MCP)/ L0-04 门店档案(区域归属,按日期取历史版)/ 案件台账 / 价格预警台账
downstream: 渠道稽查(HITL)/ 城市经理 / L0-03 日报(透传)/ L5-01(竞争环境观察)/ 案件台账 + 价格预警台账(回写)
backlog: L0-06
---

# 价格异常 & 窜货监测 Skill v0.2 · 监测节点(L0-06)

> 本 Skill 依据《INFINITY OS · Agent 设计标准 v1.0》编写。
> 它是一个 **Workflow**(写死轨道)+ **案件状态机 + 价格预警台账**(有状态,沿用 L0-07 的台账与日历天语义)。
> **全系统第一个带 HITL 的节点**:机器的权限止于产证据、立案、定级、通知;**定性与处置永远是人**。

> **v0.2 变更摘要(三处都是防错告/防疲劳加固):** ①**授权流动白名单**——调拨/分货不是窜货,立案前必核授权记录,核不了不指控,授权量超额只对超额部分立案;②**最小立案证据线**——单瓶跨区是噪音(异地购买/礼品),≥K 条扫码或 ≥K 家店或 1 条箱码才立案,未达线进观察窗口累积;③**价格预警上台账**——同模式不重复轰炸,恶化才再响,跌出阈值 R 天自动解除,语义全套沿用 L0-07。

---

## 1. 角色与目标 + 三道边界【先读这个】

你是自家产品**价格秩序**和**流向秩序**的监测方。检测模式、归集证据、立案分级——然后**停下,把案卷推给人**。

**与兄弟节点的边界(谁的地盘归谁):**

| 信息 | 真相源/管辖 | 本节点的角色 |
|---|---|---|
| 单店价签 vs 系统价(合规) | **L0-02** | 不重复;只消费其跨店汇集数据找**模式** |
| 竞品价格情报 | **L0-05** | 不碰;本节点只看自家 |
| 批次/扫码事实 | **L0-01**(INF-XD 一物一码) | 消费其批次数据;L0-01 的疑似窜货 flag(经 L0-07 carry 透传)在本节点**归集立案** |
| 仓间调拨/区域分货 | **L2-03** | 不管调拨执行;只**消费其授权记录**做白名单核对(v0.2) |
| 跨店乱价模式 / 区域价差 / 窜货案件 | **L0-06(本节点)** | 唯一检测与立案方 |

**机器与人的边界(本节点的灵魂):**
- 机器可以:检测、立案(suspect)、归集证据链、定级、通知、防重复。
- 机器不可以:把案件置为 `confirmed` 或 `dismissed`(只有人能)、触发处罚/断供/扣款、在人确认前生成处置建议。
- **缺证据不指控**:批次归属缺失、授权记录核不了、证据未达最小线 → 只观察,不立案。

---

## 2. 输入(Input)

| 来源 | 字段 | 用途 |
|---|---|---|
| L0-02 价签批量 | price_compliance[](sku/tag_price/system_price/mismatch/conf)、store/ts | 跨店乱价模式检测;**只取 mismatch==true 且 conf 足够的**(price_uncertain 已被 L0-02 排除) |
| L0-01 批次/扫码 | items[].sku / batch_id / scan(箱码·一物一码,**含码级:bottle/case**)/ store / ts、疑似窜货 flags | 窜货证据链主料;**箱码 = 整箱流动,证据权重高于瓶码(v0.2)** |
| 管控价主数据 | 经 MCP:SKU × 区域管控价 / 区域价差阈值 | 乱价与价差的比对基准 |
| 批次归属主数据 | 经 MCP:batch_id → 发货区域/经销商 | 流向比对基准;**缺 → 只观察不立案** |
| **授权流动记录(v0.2)** | 经 MCP(L2-03 产):调拨单/分货单/经销商调剂授权:batch_id × 流向 × **授权数量** × 有效期 | **白名单核对**:命中不立案;核不了不指控;超额只对超额立案 |
| L0-04 门店档案 | store → region(**按扫码/价签日期取历史版本**) | 发现区归属;用错口径会制造假窜货 |
| 案件台账 | suspect/investigating/confirmed/dismissed 案件 + **观察清单(含窗口)** | 防重复立案、复案、证据累积(v0.2) |
| **价格预警台账(v0.2)** | active/resolved 价格预警(kind/sku/region/since/escalation_count) | 价格线防重复、升级、解除 |
| 当前时间 `now` | — | 日历天计算基准(同 L0-07 C0) |

---

## 3. 参数定义(Parameters)

### 3a. 价格异常预警(v0.2:上台账,语义同 L0-07)

| 字段 | 类型 | 说明 |
|---|---|---|
| `alert_id` | string | 预警编号 |
| `kind` | enum | `乱价` / `区域价差`。**台账主键 = (kind, sku, region)(v0.2)** |
| `sku` / `region` | string | 涉及品与区域 |
| `store_count` / `stores[]` | number / string[] | 涉及店数与清单 |
| `since` | string | 首次命中时间(v0.2;日历天锚点) |
| `duration_days` | number | **= now − since 日历天重算,不累加(v0.2,同 L0-07 C0)** |
| `escalation_count` | number | 阶梯升级计数(v0.2,同 L0-07) |
| `status` | enum | `active` / `resolved`(v0.2) |
| `resolved_at` / `resolution_duration` | string / number | 解除记录(v0.2) |
| `deviation` | number | 偏离管控价幅度(如 -0.18 = 低 18%) |
| `level` | enum | `P0` / `P1` / `P2`(照 §7.1 表 + 阶梯) |
| `ack_required` / `_acked` | bool | P0 必为 true;**P1→P0 跃迁重置 ack,重新走人确认(v0.2)** |
| `evidence_refs[]` | string[] | 指回 L0-02 原始记录 |
| `flags` | string[] | `dedup_suppressed:*` / `worsened:*`(恶化再响)等 |

### 3b. 窜货案件

| 字段 | 类型 | 说明 |
|---|---|---|
| `case_id` | string | 案件编号 |
| `dedup_key` | string | **= batch_id + 发货区 + 发现区**(同批次同流向不重复立案) |
| `batch_id` / `sku` | string | 批次与品 |
| `origin_region` / `origin_dealer` | string | 批次归属(发货区/经销商,主数据) |
| `found_region` / `found_stores[]` | string / object[] | 发现区与门店清单(store/ts/scan_ref/**scan_level: bottle/case**/photo_ref) |
| **`evidence_score`(v0.2)** | object | `{scans: 独立扫码数, stores: 不同门店数, case_code_hit: bool}`;**达线规则见 §4 C2.5** |
| **`authorized_baseline`(v0.2)** | object\|null | 命中授权但超额时:`{transfer_ref, authorized_qty, observed_qty, excess}` |
| `evidence_chain` | object | **完整证据链**:批次 → 归属 → **授权核对结果(v0.2)** → 扫码记录 → 门店 → 区域口径版本(L0-04 version)→ 照片引用;缺任一不立案 |
| `status` | enum | `suspect` / `investigating` / `confirmed` / `dismissed`。**机器只能产 suspect;investigating 起全部人置** |
| `hitl_required` | bool | **立案即 true,永不为 false** |
| `reopen_count` / `prior_case_id` | number / string\|null | 复案计数与原案链接 |
| `since` / `duration_days` | string / number | 立案时间与日历天 |
| `flags` | string[] | `batch_master_missing:*` / `observation_only:*` / `authorized_transfer:*` / `observation_only:transfer_unverified:*` / `below_evidence_threshold:*` / `dedup_suppressed:*` / `reopened:*` |

---

## 4. 处理流程(Steps · 路由 → 双线检测 → 案件状态机 → HITL)

### Step A — 路由(Routing):两条线分流
- L0-02 价签批量 → **价格线**(Step B)
- L0-01 批次/扫码 + L0-01 透传的疑似窜货 flags → **流向线**(Step C)

### Step B — 价格线(链式,全脚本;v0.2 上台账)
1. **汇集** — 按 (sku, region) 聚合 L0-02 的 mismatch 记录;**单店低价不进本线**(那是 L0-02 的单店合规,已在它那里标过 mismatch),本线只认**模式**:≥2 店才开始看。
2. **乱价检测** — 写死规则:同 (sku, city/region) 内 **≥ `<N_店>` 家店、持续 ≥ `<D_天>` 个日历天、低于管控价 ≥ `<X_pct>`** → 命中,按 §7.1 定级。
3. **区域价差检测** — 同 SKU 区域间均价差(pool 口径,同 L5-01 §4 B0:Σ金额加权,不平均店级价)≥ `<价差阈值>` → 命中。
4. **(v0.2)台账步(语义全套沿用 L0-07 状态机)** — 命中后对照价格预警台账:
   - **同 (kind, sku, region) 已有 active 且未恶化** → **不新发不通知**,`duration_days` 按日历天重算,flag `dedup_suppressed`。
   - **恶化才再响**(写死阈值):`store_count` 增加 ≥ `<恶化_店数>`(如 +2)或 `deviation` 扩大 ≥ `<恶化_偏离pp>`(如 +5pp)→ 升级通知,flag `worsened:{明细}`;**若等级 P1→P0 跃迁 → `ack_required` 重置,重新走人确认**(更大的事要重新过人,旧 ack 不豁免)。
   - **阶梯升级**(同 L0-07):active 每满 `<升级天数>` 个日历天未解决 → level −1 级数字,封顶 P0,`escalation_count` 计数;升到 P0 同样触发 ack。
   - **自动解除**:连续 `<R_天>` 个日历天跌出命中阈值 → `status:resolved`,记 `resolution_duration`,发轻量"已恢复"通知。
5. **P0 的 HITL** — level=P0(大面积乱价)→ `ack_required:true`:通知城市经理 + 渠道稽查后**停**,处置建议在人确认(ack)后才生成。P1/P2 通知即可,不卡。

### Step C — 流向线(链式 + 立案)
1. **归属比对** — 扫码记录的 batch_id 查批次归属主数据 → 发货区;门店查 **L0-04 按扫码日期的历史版本** → 发现区。`发货区 ≠ 发现区` → 窜货嫌疑命中。
2. **(v0.2)【白名单闸门】授权流动核对(命中后、证据闸门前)** — 查授权流动记录(调拨单/分货单/经销商调剂,经 MCP):
   - **该批次该流向命中有效授权、且观测量 ≤ 授权量** → **不立案**,标 `authorized_transfer:{batch_id}`,记入观察台账供对账(调拨执行情况留痕,非案件)。
   - **授权记录服务不可用 / 该批次记录暂缺** → **降为观察**,标 `observation_only:transfer_unverified:{batch_id}`,**不立案**——核对不了就不指控;服务恢复后下一轮重核。
   - **授权量与观测量明显不符**(如调拨 100 箱、流向区观测 500 箱)→ **超出部分仍可立案**:`authorized_baseline` 记 `{transfer_ref, authorized_qty, observed_qty, excess}`,证据链注明授权基线,案情 = 超额部分。
3. **(v0.2)【最小证据线】单瓶是噪音不是案情** — 达线规则写死(满足任一):
   - 同 dedup_key 累计独立扫码 ≥ `<K_scans>`(如 3);
   - 或不同门店数 ≥ `<K_stores>`(如 2);
   - 或命中**箱码级**扫码(case 码 = 整箱流动,非消费者行为,**1 条即达线**)。
   - **未达线** → 不立案,进**观察清单**:同 dedup_key 在 `<W_天>` 日历天窗口内累积,窗口内达线即立案(**观察期全部记录并入证据链**),过期未达线清零。单瓶跨区可能是异地购买/礼品/退换——错告概率高。
4. **【证据闸门】** — 立案前证据链必须**完整**:批次号 + 归属记录 + **授权核对结果** + 扫码记录(含时间/门店/码级)+ 发现区口径(L0-04 版本号)。**批次归属主数据缺失 → 不立案**,标 `batch_master_missing:{batch_id}` + `observation_only`,进观察清单。缺证据不指控——错告经销商窜货比漏掉一单代价大得多。
5. **立案(状态机,§4D)** — 白名单未命中 + 证据达线且完整 → 查台账防重复 → 新案 `status:suspect`、`hitl_required:true`,推给渠道稽查。

### Step D — 案件状态机(有状态,日历天语义同 L0-07)

```
                机器可写                      只有人可写
  ┌─────────────────────────────┐   ┌──────────────────────────┐
  │  [检测命中] ─白名单─证据线─▶ suspect ──▶ investigating ──▶ confirmed │
  │     │   (立案+证据链+通知)   │   │   (稽查领案)      (人定性) │
  │     │                       │   │                 └▶ dismissed│
  │  同 dedup_key 已有非 dismissed 案 │   └──────────────────────────┘
  │     └─▶ 证据追加,不另立案      │
  │  dismissed 后同 key 再现:       │
  │     ├─ 有新证据(新店/新扫码)──▶ 复案 suspect(reopen_count+1,挂 prior_case_id,通知)
  │     └─ 无新证据 ──▶ 静默(尊重人的裁决,标 dedup_suppressed)
  └─────────────────────────────┘
```

- **防重复**:dedup_key = (batch_id, 发货区, 发现区)。同 key 已有 suspect/investigating/confirmed 案 → **不另立案**,新发现门店/扫码**追加进原案证据链**(追加要通知承办稽查,案情扩大了)。
- **复案**:dismissed 后同 key 再现且有**新证据**(新门店或新扫码记录,非旧记录重放)→ 复案:新 suspect、`reopen_count+1`、链接 `prior_case_id`、通知;**复案同样要过白名单与证据线(v0.2)**——人 dismiss 后补签的授权记录是常见情形。
- `duration_days` = 日历天(now − since 重算,同 L0-07 C0);承办超时提醒(SHOULD)。

### Step E — 出件与扇出
按 §6 schema 输出 → 跑 §10 校验 → 按 §7.2 扇出 → 回写案件台账 + 价格预警台账。

---

## 5. 规则与强度(RFC2119)

| 强度 | 规则 |
|---|---|
| **MUST NOT** | **机器绝不把案件置为 confirmed / dismissed,绝不自动认定窜货,绝不触发处罚/断供/扣款,绝不在人确认前生成 P0 处置建议。** 定性与处置永远是人。 |
| **MUST** | 流向线立案前必须核对授权流动记录:**命中有效授权且量内 → 不立案**(标 authorized_transfer 留观察台账);**授权服务不可用/记录暂缺 → 只观察不立案**(transfer_unverified)——核对不了就不指控;授权量超额 → 仅对超额部分立案并在证据链注明授权基线。**(v0.2)** |
| **MUST** | 立案必须达**最小证据线**:≥`<K_scans>` 条独立扫码 或 ≥`<K_stores>` 家不同门店 或 1 条箱码级扫码;未达线只进观察窗口(`<W_天>` 日历天)累积,达线立案时观察期记录全部并入证据链。**(v0.2)** |
| **MUST** | 价格预警必须走台账(语义同 L0-07):同 (kind,sku,region) active 未恶化不新发;恶化(店数+`<恶化_店数>` 或偏离+`<恶化_偏离pp>`)才升级再响;P1→P0 跃迁必须重置 ack 重新过人;连续 `<R_天>` 跌出阈值自动 resolved 并记时长。**(v0.2)** |
| **MUST** | 窜货立案必带**完整证据链**(批次+归属+授权核对+扫码+门店+区域口径版本);缺任一不得立案。 |
| **MUST** | 批次归属主数据缺失只标 `observation_only` 进观察清单,**不得立案**——缺证据不指控。 |
| **MUST** | 同 dedup_key(批次+发货区+发现区)且台账有非 dismissed 案 → 不重复立案,证据追加进原案并通知承办人。 |
| **MUST** | 乱价/价差检测阈值必须照 §7.1 写死表;持续天数用**日历天**(同 L0-07 口径);严禁临场定级。 |
| **MUST** | 窜货案件 `hitl_required` 恒为 true;P0 价格预警 `ack_required` 恒为 true,处置建议 gate 在人 ack 之后。 |
| **MUST** | 发现区归属必须取 **L0-04 按事件日期的历史版本**,证据链记版本号——区域调整不得制造假窜货。 |
| **MUST** | 单店价签不符不进乱价线(那是 L0-02 单店合规);竞品价格不进本节点(归 L0-05)。 |
| **SHOULD** | dismissed 后同 key 再现且有新证据应复案(reopen,挂原案;复案同过白名单与证据线);无新证据应静默。 |
| **SHOULD** | investigating 超 `<承办时限>` 天应提醒承办稽查(只提醒,不代办)。 |
| **SHOULD** | 乱价喂 L5-01 应走「竞争环境观察」通道,**不计入对手压制度**(自家秩序问题 ≠ 对手攻势)。 |
| **MAY** | 观察清单(observation_only / 授权对账 / 未达线累积)可定期汇总给渠道稽查参考,非立案件。 |

---

## 6. 输出(Output · Artifact 契约)

### 6a. 价格异常预警(v0.2:带台账字段)

```json
{
  "alert_id": "PA-2026-0612-001",
  "kind": "乱价",
  "sku": "6MX-TJ-380",
  "region": "上海",
  "store_count": 5,
  "stores": ["ST-SH-00301", "ST-SH-00420", "..."],
  "since": "2026-06-09T00:00:00+08:00",
  "duration_days": 3,
  "escalation_count": 0,
  "status": "active",
  "resolved_at": null,
  "resolution_duration": null,
  "deviation": -0.18,
  "control_price": 18.9,
  "observed_avg": 15.5,
  "level": "P0",
  "ack_required": true,
  "disposal_suggestion": null,
  "evidence_refs": ["L0-02:rpt_0608a#price", "L0-02:rpt_0612c#price"],
  "flags": [],
  "fanout": ["渠道稽查:乱价P0", "城市经理:乱价P0", "日报:透传:乱价", "L5-01:竞争环境观察:乱价(不入压制度)"]
}
```
> `disposal_suggestion` 在 `ack_required:true` 且未 ack 时**必为 null**——处置建议 gate 在人后面。
> **(v0.2)台账行为示例**:次日同模式未恶化 → 不新发,flag `dedup_suppressed`,duration_days 重算为 4;店数 5→7 → flag `worsened:store_count+2`,升级通知;连续 `<R_天>` 跌出阈值 → `status:resolved` + "已恢复"轻量通知。

### 6b. 窜货案件(v0.2:带授权核对与证据分)

```json
{
  "case_id": "DV-2026-0612-007",
  "dedup_key": "B20260501-077|华中区|华东区",
  "batch_id": "B20260501-077",
  "sku": "6MX-JDX",
  "origin_region": "华中区",
  "origin_dealer": "DL-WH-012",
  "found_region": "华东区",
  "found_stores": [
    { "store": "ST-SH-00420", "ts": "2026-06-12T11:02:00+08:00", "scan_ref": "XD-scan-88172", "scan_level": "case", "photo_ref": "ph_220" }
  ],
  "evidence_score": { "scans": 1, "stores": 1, "case_code_hit": true },
  "authorized_baseline": null,
  "evidence_chain": {
    "batch_master": "MCP:batch_master@B20260501-077",
    "transfer_check": "MCP:authorized_transfers@B20260501-077:no_record(已核,无授权)",
    "scan_records": ["XD-scan-88172"],
    "region_basis": "L0-04:ST-SH-00420@v3(2026-06-12生效版)",
    "complete": true
  },
  "status": "suspect",
  "hitl_required": true,
  "reopen_count": 0,
  "prior_case_id": null,
  "since": "2026-06-12T14:00:00+08:00",
  "duration_days": 0,
  "flags": [],
  "fanout": ["渠道稽查:立案:DV-2026-0612-007", "日报:透传:疑似窜货", "城市经理:知会"]
}
```
> 观察件示例:`flags:["batch_master_missing:B2026xx","observation_only"]` 或 `["observation_only:transfer_unverified:B2026xx"]` 或 `["below_evidence_threshold:B2026xx(1瓶1店,窗口累积中)"]` —— 均不产 case,进观察清单。
> 授权对账件示例:`flags:["authorized_transfer:B20260501-077"]`,不立案,留观察台账。
> 超额立案示例:`authorized_baseline:{"transfer_ref":"TR-2026-0511-03","authorized_qty":100,"observed_qty":500,"excess":400}`,证据链 transfer_check 注明基线,案情 = 超额 400 箱。

---

## 7. 阈值表 + 扇出(写死)

### 7.1 价格异常分级表(初版拍的,回测校准;改阈值只改这张表)

| kind | 触发条件 | 等级 |
|---|---|---|
| 乱价 | ≥ `<N_店P0>`(如 5)家店 × ≥ `<D_天>`(如 3)日历天 × 低于管控价 ≥ `<X_pct>`(如 15%),或跨 ≥2 城 | **P0**(ack_required) |
| 乱价 | ≥ `<N_店P1>`(如 3)家店 × ≥ `<D_天>` 天 × ≥ `<X_pct>` | **P1** |
| 乱价 | 2 家店命中幅度但未满天数 | **P2**(观察) |
| 区域价差 | 区间 pool 均价差 ≥ `<价差阈值>`(如 12%) | **P1** |
| 任意 | 数据覆盖不足 / conf 不够 | **最高 P2 观察,不产 P0/P1** |

> **(v0.2)台账叠加规则**:恶化再响线 = 店数 +`<恶化_店数>`(如 2)或偏离 +`<恶化_偏离pp>`(如 5pp);阶梯升级 = 每满 `<升级天数>` 日历天 −1 级,封顶 P0;升到 P0(含跃迁)即重置 ack;解除线 = 连续 `<R_天>` 跌出命中阈值。

### 7.2 扇出规则

| 条件 | 触发下游 | 性质 |
|---|---|---|
| 窜货立案(suspect)/ 复案 | 渠道稽查(承办)+ 城市经理(知会) | **HITL:停机等人** |
| 证据追加 | 承办稽查 | 案情更新通知 |
| 价格 P0(新发 / 跃迁 / 阶梯升到 P0) | 渠道稽查 + 城市经理 | **ack 前不出处置建议;跃迁重置 ack(v0.2)** |
| 价格恶化升级(未到 P0) | 城市经理 | 升级通知(v0.2) |
| 价格 P1/P2 新发 | 城市经理 | 通知即可 |
| 价格 resolved | 原通知对象 | 轻量"已恢复"(v0.2) |
| 同模式未恶化 | **不通知**(dedup_suppressed) | 静默更新台账(v0.2) |
| 授权对账件 / 观察件 | 观察清单(定期汇总) | 非案件,不通知承办 |
| 一切预警/案件 | L0-03 日报透传 | 单店当日视图 |
| 乱价/价差 | L5-01「竞争环境观察」 | **不入压制度** |
| — | **绝不**触发处罚/断供/扣款/自动定性 | 人的地盘 |

---

## 8. HITL 卡点 —— 本节点【有】(全系统第一个)

按《Agent 设计标准 §6》,HITL 卡在**高风险不可逆动作执行前**。本节点的不可逆动作是**定性与处置**(认定窜货、处罚经销商、断供、扣返利)——商誉与商务关系上不可逆,错告的代价极大。

| 卡点 | 机器做到哪 | 停在哪 | 谁解锁 |
|---|---|---|---|
| 窜货案件 | 检测 → 白名单核对 → 证据线 → 立案 suspect → 证据链 → 通知 | **status 推进**:investigating 起全部人置;confirmed/dismissed 机器物理写不进(§10 拦) | 渠道稽查 |
| 价格 P0(含跃迁/阶梯升至) | 检测 → 定级 → 通知 | **处置建议生成**:ack 前 `disposal_suggestion` 恒 null;**跃迁重置 ack,旧确认不豁免新等级(v0.2)** | 城市经理/渠道稽查 ack |
| 处罚/断供/扣款 | 不做、不建议、不触发 | 本节点无此通道 | 商务流程(节点外) |

> 与"治理流程"的区分(沿用 L0-05/L0-04 §8 口径):疑似重复建档转人工是数据治理;**本节点的转人工是真 HITL**——因为下游动作(处罚)不可逆且高风险,机器必须停机等人,这正是标准 §6 定义的卡点。
> 防 HITL 形同虚设(标准 §6 的 ATM 类比):卡点只设在**立案与 P0**,不是每条价签差异都叫人——P1/P2 通知即可,观察件只进清单,**未恶化的同模式连通知都不发(v0.2)**。人只在高风险处出现。

---

## 9. References

### 9a. 管控价 / 区域价差主数据(示例,经 MCP 替换)

| SKU | 区域 | 管控价 | 区域间价差阈值 |
|---|---|---|---|
| 6MX-TJ-380 | 上海 | 18.9 | 12% |
| 6MX-JDX | 全国 | 22.9 | 12% |

### 9b. 批次归属 / 授权流动主数据(示例,经 MCP 替换;INF-XD 一物一码 + L2-03 调拨)

| batch_id | 发货区域 | 经销商 |
|---|---|---|
| B20260501-077 | 华中区 | DL-WH-012 |

| transfer_ref | batch_id | 授权流向 | 授权数量 | 有效期 |
|---|---|---|---|---|
| TR-2026-0511-03 | B20260501-080 | 华中区→华东区 | 100 箱 | 2026-05-11 ~ 06-30 |

### 9c. 术语表

| 术语 | 含义 | 处理 |
|---|---|---|
| 窜货 | 货品越过授权区域销售 | 批次归属 ≠ 发现区 → 嫌疑;**先核白名单;定性归人** |
| 授权流动 | 调拨/分货/经销商调剂(L2-03) | 白名单:量内不立案;超额对超额立案 |
| 乱价 | 多店持续显著低于管控价 | 模式检测(N店×D天×X%),单店不算 |
| 一物一码(INF-XD) | 批次/箱码扫码追溯 | 流向证据主料,来自 L0-01;**箱码权重 > 瓶码** |
| 证据线 | 最小立案证据量 | K 扫码 / K 店 / 1 箱码;未达线观察窗口累积 |
| dedup_key | 批次+发货区+发现区 | 同流向一案,新店追加证据 |
| 复案(reopen) | dismissed 后新证据再现 | 新 suspect 挂原案,计 reopen_count;同过白名单证据线 |
| 观察件 | 证据不全/核不了/未达线的命中 | 不立案,进观察清单 |

### 9d. 踩坑记录(每次撞墙补一条)

- ❌ 批次主数据缺也立了案,稽查到场发现查无此批 → 错告经销商 → ✅ 证据闸门:缺归属只观察不立案。
- ❌ 同一批货流向同一区,8 家店扫到立了 8 个案 → 稽查重复跑 → ✅ dedup_key 同流向一案,新店追加证据。
- ❌ 门店上月从 A 区划到 B 区,用现行区域口径判出"假窜货" → ✅ 发现区取 L0-04 按扫码日期历史版,证据链记版本号。
- ❌ 模型"综合判断这就是窜货"写进了结论 → 机器替人定性 → ✅ 机器只到 suspect,confirmed/dismissed 物理写不进。
- ❌ 单店一张低价签被报成"乱价" → 和 L0-02 重复且小题大做 → ✅ 乱价 ≥2 店起看,模式才是本节点的地盘。
- ❌(v0.2)公司仓正常调拨 100 箱到华东,被按"批次归属≠发现区"立了案 → 稽查白跑,调拨一次告一次 → ✅ 白名单闸门:授权流动核对,量内不立案,留观察台账对账。
- ❌(v0.2)授权记录服务宕机,核不了就照立 → 错告 → ✅ transfer_unverified 只观察,服务恢复重核;核对不了就不指控。
- ❌(v0.2)一瓶一物一码在外区被扫(消费者出差带过去的),立了案 → 错告 → ✅ 最小证据线:K 扫码/K 店/箱码达线才立案,单瓶进观察窗口。
- ❌(v0.2)同一片乱价每天检测每天新发一条 alert → 重演 L0-07 的预警疲劳坑 → ✅ 价格台账:未恶化静默、恶化才响、R 天跌出自动解除。
- ❌(v0.2)P1 时人 ack 过,后来跃迁到 P0 沿用旧 ack 直接出处置建议 → 更大的事没重新过人 → ✅ 跃迁重置 ack。
- _(后续迭代继续往下加)_

---

## 10. Scripts — 阈值重放 / 白名单 / 证据线 / 台账 / 状态机(出件前必跑)

```python
from datetime import datetime

MACHINE_WRITABLE_STATUS = {"suspect"}          # 机器只能产 suspect
HUMAN_ONLY_STATUS = {"investigating", "confirmed", "dismissed"}

def calendar_days(since: str, now: str) -> int:
    return (datetime.fromisoformat(now) - datetime.fromisoformat(since)).days

# ---- v0.2 白名单核对 ----
def transfer_check(batch_id, flow, observed_qty, transfers) -> dict:
    """返回 {verdict: clear|authorized|unverified|excess, ...}"""
    if transfers is None:                                   # 服务不可用/记录暂缺
        return {"verdict": "unverified"}
    rec = transfers.get((batch_id, flow))
    if rec is None:
        return {"verdict": "clear"}                         # 无授权 → 可走立案流程
    if observed_qty <= rec["authorized_qty"]:
        return {"verdict": "authorized", "transfer_ref": rec["ref"]}
    return {"verdict": "excess", "transfer_ref": rec["ref"],
            "authorized_qty": rec["authorized_qty"],
            "observed_qty": observed_qty,
            "excess": observed_qty - rec["authorized_qty"]}

# ---- v0.2 最小证据线 ----
def evidence_met(score: dict) -> bool:
    return (score.get("case_code_hit")                      # 箱码 1 条即达线
            or score.get("scans", 0) >= K_SCANS
            or score.get("stores", 0) >= K_STORES)

def price_level(store_count, duration_days, deviation, cross_city, coverage_ok):
    """§7.1 表驱动定级;数据不足封顶 P2。"""
    if not coverage_ok:
        return "P2"
    hit = abs(deviation) >= X_PCT and duration_days >= D_DAYS
    if hit and (store_count >= N_P0 or cross_city):
        return "P0"
    if hit and store_count >= N_P1:
        return "P1"
    if store_count >= 2 and abs(deviation) >= X_PCT:
        return "P2"
    return None

ORDER = ["P0", "P1", "P2"]

def price_alert_action(ledger, key, new, now):
    """v0.2 价格台账状态机(语义同 L0-07)。"""
    cur = ledger.get(key)
    if new is None or new.get("below_threshold_days", 0) >= R_DAYS:
        if cur and cur["status"] == "active":
            return {"action": "resolve"}
        return {"action": "noop"}
    if cur and cur["status"] == "active":
        worsened = (new["store_count"] - cur["store_count"] >= WORSE_STORES
                    or abs(new["deviation"]) - abs(cur["deviation"]) >= WORSE_DEV_PP)
        dur = calendar_days(cur["since"], now)
        expected = dur // ESCALATE_DAYS
        if worsened or expected > cur.get("escalation_count", 0):
            return {"action": "escalate", "worsened": worsened,
                    "duration_days": dur, "to_escalation_count": max(expected, cur.get("escalation_count", 0))}
        return {"action": "suppress", "duration_days": dur}
    return {"action": "new"}

def evidence_complete(case: dict) -> bool:
    ec = case.get("evidence_chain", {})
    return all([case.get("batch_id"), case.get("origin_region"),
                ec.get("batch_master"), ec.get("transfer_check"),   # v0.2: 授权核对必在链上
                ec.get("scan_records"),
                case.get("found_stores"), ec.get("region_basis")])

def case_action(ledger: dict, dedup_key: str, has_new_evidence: bool) -> str:
    cur = ledger.get(dedup_key)
    if cur is None:
        return "file_new"                                  # 新立案 suspect
    if cur["status"] in ("suspect", "investigating", "confirmed"):
        return "append_evidence"                           # 同流向一案,追加并通知承办
    if cur["status"] == "dismissed":
        return "reopen" if has_new_evidence else "suppress"  # 复案 vs 静默
    return "suppress"

def validate(out: dict, ledger_before: dict, price_ledger_before: dict, now: str) -> list[str]:
    errs = []
    # ===== HITL 硬约束 =====
    if out.get("case_id"):
        if out["status"] not in MACHINE_WRITABLE_STATUS:
            errs.append(f"machine_wrote_human_status:{out['case_id']}")  # 机器只能 suspect
        if out.get("hitl_required") is not True:
            errs.append(f"case_without_hitl:{out['case_id']}")
        # ---- v0.2 白名单:命中授权(量内)/核不了 → 不得成案 ----
        tc = out.get("_transfer_verdict")
        if tc == "authorized":
            errs.append(f"case_filed_on_authorized_transfer:{out['case_id']}")
        if tc == "unverified":
            errs.append(f"case_filed_transfer_unverified:{out['case_id']}")
        if tc == "excess" and not out.get("authorized_baseline"):
            errs.append(f"excess_case_without_baseline:{out['case_id']}")
        # ---- v0.2 证据线:未达线不得成案 ----
        if not evidence_met(out.get("evidence_score", {})):
            errs.append(f"case_below_evidence_threshold:{out['case_id']}")
        # 证据链完整性(含授权核对)
        if not evidence_complete(out):
            errs.append(f"case_without_full_evidence:{out['case_id']}")
        if not out.get("evidence_chain", {}).get("region_basis", "").startswith("L0-04:"):
            errs.append(f"region_basis_not_versioned:{out['case_id']}")
        # 防重复:同 dedup_key 非 dismissed 在案不得另立
        cur = ledger_before.get(out["dedup_key"])
        if cur and cur["status"] != "dismissed" and out.get("reopen_count", 0) == 0:
            errs.append(f"duplicate_case:{out['dedup_key']}")
        # 复案配对
        if out.get("reopen_count", 0) > 0 and not out.get("prior_case_id"):
            errs.append(f"reopen_without_prior:{out['case_id']}")
        # 日历天可重放
        if out.get("duration_days") != calendar_days(out["since"], now):
            errs.append(f"duration_not_calendar:{out['case_id']}")
    # 批次缺失不得成案
    if any(f.startswith("batch_master_missing") for f in out.get("flags", [])) and out.get("case_id"):
        errs.append("case_filed_without_batch_master")
    # ===== 价格预警(v0.2:台账断言) =====
    if out.get("alert_id"):
        lvl = price_level(out["store_count"], out["duration_days"], out["deviation"],
                          out.get("_cross_city", False), out.get("_coverage_ok", True))
        # 阶梯叠加后重放
        if lvl and out.get("escalation_count", 0) > 0:
            lvl = ORDER[max(ORDER.index(lvl) - out["escalation_count"], 0)]
        if out["status"] == "active" and out["level"] != lvl:
            errs.append(f"level_not_from_table:{out['alert_id']}")     # 阈值+阶梯重放
        # 日历天可重放
        if out.get("since") and out["status"] == "active" and \
           out.get("duration_days") != calendar_days(out["since"], now):
            errs.append(f"duration_not_calendar:{out['alert_id']}")
        # 防重复:同键 active 未恶化不得新发
        key = (out["kind"], out["sku"], out["region"])
        cur = price_ledger_before.get(key)
        if cur and cur["status"] == "active" and out["status"] == "active" and \
           not any(f.startswith("worsened") for f in out.get("flags", [])) and \
           out.get("escalation_count", 0) == cur.get("escalation_count", 0) and \
           "dedup_suppressed" not in str(out.get("flags", [])):
            errs.append(f"duplicate_price_alert:{out['alert_id']}")
        # 解除配对
        if out["status"] == "resolved" and \
           (out.get("resolved_at") is None or out.get("resolution_duration") is None):
            errs.append(f"resolve_without_record:{out['alert_id']}")
        # P0 ack:含跃迁重置
        if out["level"] == "P0":
            if out.get("ack_required") is not True:
                errs.append(f"p0_without_ack:{out['alert_id']}")
            if out.get("disposal_suggestion") is not None and not out.get("_acked"):
                errs.append(f"disposal_before_ack:{out['alert_id']}")  # 处置 gate 在人后
            if out.get("_transitioned_to_p0") and out.get("_acked"):
                errs.append(f"stale_ack_after_transition:{out['alert_id']}")  # 跃迁须重置 ack
        if out["store_count"] < 2:
            errs.append(f"single_store_in_pattern_line:{out['alert_id']}")  # 单店归 L0-02
    # 扇出禁区
    for f in out.get("fanout", []):
        if any(f.startswith(p) for p in ("处罚", "断供", "扣款", "认定")):
            errs.append(f"illegal_disposal_fanout:{f}")
        if "压制度" in f:
            errs.append(f"own_disorder_into_pressure:{f}")             # 乱价不入压制度
    return errs
```

---

## 11. 评测起手式(Eval Starter)

> 离线建设期做。攒历史扫码与价签数据(含人工已定性的真实窜货/误报案例 + 调拨记录),跑本 Skill 对照打分。先放 15 条种子。

**样例格式:**
```json
{ "id": "...", "input": { "now": "...", "l0_02": [...], "l0_01_scans": [...], "batch_master": {...}, "transfers": {...}, "ledger": {...}, "price_ledger": {...}, "store_archive": {...} }, "expect": { ... }, "tags": ["场景"] }
```

**种子样例(15 条):**
```json
[
 {"id":"v01",
  "input":{"l0_01_scans":[{"batch_id":"B20260501-077","store":"ST-SH-00420","ts":"2026-06-12T11:02:00+08:00","scan_ref":"XD-scan-88172","scan_level":"case"}],
           "batch_master":{"B20260501-077":{"region":"华中区","dealer":"DL-WH-012"}},
           "transfers":{},
           "store_archive":{"ST-SH-00420@2026-06-12":{"region":"华东区","version":3}},
           "ledger":{}},
  "expect":{"case_filed":true,"status":"suspect","hitl_required":true,
            "evidence_chain_complete":true,"transfer_check_in_chain":true,
            "region_basis_contains":"L0-04","no_auto_confirm":true},
  "tags":["跨区箱码命中(已核无授权)→立案 suspect+完整证据链+HITL"]},

 {"id":"v02",
  "input":{"l0_01_scans":[{"batch_id":"B2026XX-999","store":"ST-SH-00420","ts":"2026-06-12T11:00:00+08:00"}],
           "batch_master":{},"ledger":{}},
  "expect":{"case_filed":false,"flags_contains":["batch_master_missing:B2026XX-999","observation_only"]},
  "tags":["证据不全(批次归属缺)→只观察不立案,缺证据不指控"]},

 {"id":"v03",
  "input":{"l0_01_scans":[{"batch_id":"B20260501-077","store":"ST-SH-00301","ts":"2026-06-13T09:00:00+08:00","scan_ref":"XD-scan-90001","scan_level":"case"}],
           "batch_master":{"B20260501-077":{"region":"华中区"}},
           "transfers":{},
           "store_archive":{"ST-SH-00301@2026-06-13":{"region":"华东区","version":2}},
           "ledger":{"B20260501-077|华中区|华东区":{"case_id":"DV-2026-0612-007","status":"investigating"}}},
  "expect":{"no_new_case":true,"evidence_appended_to":"DV-2026-0612-007","handler_notified":true},
  "tags":["同批次同流向再现→不重复立案,证据追加并通知承办"]},

 {"id":"v04",
  "input":{"now":"2026-06-12","l0_02":"上海 5 店 6MX-TJ-380 价签 15.5 上下,管控价 18.9(低 18%),自 6/9 起持续 4 个日历天",
           "price_ledger":{},"params":{"N_P0":5,"N_P1":3,"D_DAYS":3,"X_PCT":0.15}},
  "expect":{"kind":"乱价","level":"P0","store_count":5,"duration_days":4,"status":"active",
            "ack_required":true,"disposal_suggestion":null},
  "tags":["乱价 N店D天命中→P0 新发;ack 前处置建议必为 null"]},

 {"id":"v05",
  "input":{"l0_02":"单店 ST-SH-00420 一张价签 16.9 vs 系统价 18.9(L0-02 已标 mismatch)"},
  "expect":{"no_alert":true,"note":"单店合规归 L0-02,本节点只认 ≥2 店模式"},
  "tags":["单店低价不算乱价——边界:那是 L0-02 的地盘"]},

 {"id":"v06",
  "input":{"l0_01_scans":[{"batch_id":"B20260501-077","store":"ST-SH-00777","ts":"2026-07-02T10:00:00+08:00","scan_ref":"XD-scan-95210","scan_level":"case"}],
           "batch_master":{"B20260501-077":{"region":"华中区"}},
           "transfers":{},
           "store_archive":{"ST-SH-00777@2026-07-02":{"region":"华东区","version":1}},
           "ledger":{"B20260501-077|华中区|华东区":{"case_id":"DV-2026-0612-007","status":"dismissed"}}},
  "expect":{"reopened":true,"new_status":"suspect","reopen_count":1,
            "prior_case_id":"DV-2026-0612-007","handler_notified":true},
  "tags":["dismissed 后同流向再现+新证据→复案挂原案;复案同过白名单与证据线"]},

 {"id":"v07",
  "input":{"l0_02":"杭州 3 店 6MX-JDX 低于管控价 16%,持续 3 天","price_ledger":{},"params":{"N_P0":5,"N_P1":3,"D_DAYS":3,"X_PCT":0.15}},
  "expect":{"level":"P1","ack_required_absent_or_false":true,"notify":["城市经理"],
            "fanout_contains":"L5-01:竞争环境观察","fanout_not_contains":"压制度"},
  "tags":["P1 乱价:通知不卡 HITL;喂 L5-01 走观察通道不入压制度"]},

 {"id":"v08",
  "input":{"l0_02":"6MX-TJ-380 华东 pool 均价 18.5 vs 华中 pool 均价 15.9,价差 14%(阈值 12%)"},
  "expect":{"kind":"区域价差","level":"P1","pool_basis":true},
  "tags":["区域价差超阈→P1;均价用 pool 口径(同 L5-01),不平均店级价"]},

 {"id":"v09",
  "input":{"l0_01_scans":[{"batch_id":"B20260501-080","store":"ST-SH-00420","ts":"2026-06-12T10:00:00+08:00","scan_level":"case"}],
           "batch_master":{"B20260501-080":{"region":"华中区"}},
           "transfers":{"B20260501-080|华中区→华东区":{"ref":"TR-2026-0511-03","authorized_qty":100}},
           "observed_qty":60,
           "store_archive":{"ST-SH-00420@2026-06-12":{"region":"华东区","version":3}},
           "ledger":{}},
  "expect":{"case_filed":false,"flags_contains":"authorized_transfer:B20260501-080",
            "observation_ledger_entry":true},
  "tags":["v0.2-①a:合法调拨(量内)→不立案,留观察台账对账"]},

 {"id":"v10",
  "input":{"l0_01_scans":"同批次 B20260501-080 华东区多店箱码扫码,观测合计 500 箱",
           "batch_master":{"B20260501-080":{"region":"华中区"}},
           "transfers":{"B20260501-080|华中区→华东区":{"ref":"TR-2026-0511-03","authorized_qty":100}},
           "observed_qty":500,"ledger":{}},
  "expect":{"case_filed":true,"authorized_baseline":{"authorized_qty":100,"observed_qty":500,"excess":400},
            "evidence_chain_mentions_baseline":true},
  "tags":["v0.2-①b:授权量超额→仅超额部分立案,证据链注明授权基线;另:授权服务不可用→transfer_unverified 只观察"]},

 {"id":"v11",
  "input":{"now":"2026-06-12","l0_01_scans":[{"batch_id":"B20260501-077","store":"ST-SH-00420","ts":"2026-06-12T09:00:00+08:00","scan_level":"bottle"}],
           "batch_master":{"B20260501-077":{"region":"华中区"}},"transfers":{},
           "store_archive":{"ST-SH-00420@2026-06-12":{"region":"华东区","version":3}},
           "ledger":{},"params":{"K_SCANS":3,"K_STORES":2,"W_DAYS":14}},
  "expect":{"case_filed":false,"flags_contains":"below_evidence_threshold",
            "observation_window_entry":true},
  "tags":["v0.2-②a:单瓶单店(可能异地购买)→未达线,进观察窗口不立案"]},

 {"id":"v12",
  "input":{"now":"2026-06-20","l0_01_scans":"窗口内同 dedup_key 第3家店瓶码扫码到达",
           "observation_window":{"B20260501-077|华中区|华东区":{"scans":2,"stores":2,"since":"2026-06-12"}},
           "params":{"K_SCANS":3,"K_STORES":2,"W_DAYS":14}},
  "expect":{"case_filed":true,"evidence_score":{"scans":3,"stores":3},
            "observation_records_merged_into_chain":true},
  "tags":["v0.2-②b:窗口内累积达线→立案,观察期记录全部并入证据链;过期(>W天)则清零"]},

 {"id":"v13",
  "input":{"now":"2026-06-13","l0_02":"上海同 5 店乱价持续,店数与偏离与昨日相同",
           "price_ledger":{"乱价|6MX-TJ-380|上海":{"status":"active","level":"P0","since":"2026-06-09","store_count":5,"deviation":-0.18,"escalation_count":0}}},
  "expect":{"no_new_alert":true,"flags_contains":"dedup_suppressed","duration_days":4,"no_notify":true},
  "tags":["v0.2-③a:同模式次日再检未恶化→静默更新台账,不轰炸"]},

 {"id":"v14",
  "input":{"now":"2026-06-14","l0_02":"上海乱价扩大到 7 店(+2),且原为 P1",
           "price_ledger":{"乱价|6MX-JDX|杭州":{"status":"active","level":"P1","since":"2026-06-10","store_count":3,"deviation":-0.16,"escalation_count":0,"_acked":false}},
           "params":{"WORSE_STORES":2}},
  "expect":{"escalated":true,"flags_contains":"worsened:store_count+2",
            "if_reaches_P0":"ack_required 重置,重新走人确认",
            "notified":true},
  "tags":["v0.2-③b:恶化(店数+2)→升级再响;P1→P0 跃迁重置 ack,旧确认不豁免"]},

 {"id":"v15",
  "input":{"now":"2026-06-20","l0_02":"上海 6MX-TJ-380 连续 3 个日历天均价回到管控价附近(跌出命中阈值)",
           "price_ledger":{"乱价|6MX-TJ-380|上海":{"status":"active","level":"P0","since":"2026-06-09"}},
           "params":{"R_DAYS":3}},
  "expect":{"status":"resolved","resolution_duration_recorded":true,"light_notify":true},
  "tags":["v0.2-③c:跌出阈值 R 天→自动解除,记持续时长,轻量已恢复通知"]}
]
```

**打分维度(每条 0/1):**
1. 窜货立案正确(v01:证据链全含授权核对、suspect、hitl_required、区域口径带版本)
2. 证据闸门(v02:缺归属只观察)
3. 防重复 + 证据追加(v03)
4. 复案规则(v06:新证据 reopen 挂原案;复案同过白名单证据线)
5. **白名单正确**(v09 量内不立案 / v10 超额对超额立案带基线 / 服务不可用只观察)
6. **证据线正确**(v11 单瓶观察 / v12 窗口累积达线并入证据链 / 箱码 1 条即达线)
7. 乱价阈值重放(v04/v07,§10 复算一致)+ P0 ack gate(v04 处置为 null)
8. **价格台账正确**(v13 静默 / v14 恶化再响+跃迁重置 ack / v15 自动解除)
9. 单店边界(v05)+ 价差 pool 口径(v08)+ 乱价不入压制度(v07)
10. JSON 过 §10 校验(机器写人态/处罚扇出/授权成案/未达线成案全拦)

> 跑完看哪一维最常错——本节点最危险的错不是漏报,是**错告**(v02/v09/v11 这组闸门漏了任何一道)。错告经销商的代价远大于晚抓一单,阈值与闸门宁紧勿松。

---

## 待填变量(套用时替换)
- `owner` — 本 Skill 负责人/团队;承办稽查角色与 `<承办时限>`
- §7.1 全部阈值(`<N_店P0>` `<N_店P1>` `<D_天>` `<X_pct>` `<价差阈值>`)— 用历史已定性案例回测校准
- **证据线参数 `<K_scans>` `<K_stores>` `<W_天>`** — 用历史误报(异地购买类)回测定(v0.2)
- **价格台账参数 `<恶化_店数>` `<恶化_偏离pp>` `<升级天数>` `<R_天>`** — 回测定(v0.2)
- §9a 管控价 / §9b 批次归属 + **授权流动记录(L2-03,经 MCP)** — 接真实主数据(INF-XD)
- 案件台账 + 价格预警台账存储 — 状态机落库方案(与 L0-07 台账同基建分表,建议)
- ack 通道 — P0 价格确认的交互方式(App 内确认 / 企微审批)
