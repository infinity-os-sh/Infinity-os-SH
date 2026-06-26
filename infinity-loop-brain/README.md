# INFINITY OS · L5 算账中枢「脑子」· 经营环引擎服务

> 对应任务书:`脑子开发包/00_任务书.md`（DS · 2026-06-26）。
> 定位:INFINITY OS 芯片五层里 **L5 集成/算账层** 的脑;前端各渠道 App 是另一条线,共用本脑的 `/loop/series`。

把已验证的经营环引擎(五步环 + RECORD 契约 + HALF_EVEN 取整)在 Spring Boot 里**真接数据 + 真起服务 + 真暴露端点**,
前端(CloudBase/ICA App / 各渠道 App)调 `GET /loop/series` 拿逐期 RECORD。

---

## 一、跑起来(本地自检 + 联调,零外部依赖)

默认 profile=dev,用 H2 内存库,起即端到端跑通(种子数据=福海路黄金记录 + 青岛第2店)。

```bash
cd infinity-loop-brain
mvn test          # 自检:LoopEngineGoldenTest(6条黄金记录+取整坑) + 端到端接数测试 全绿
mvn spring-boot:run
# 另开一个终端:
curl "http://localhost:8080/loop/series?store=3001156859&sku=PS01080160&year=2026"
```

期望:1–5 月 `gap` = `+6 / -11 / -9 / -37 / +2`,5 月 `gap_pct=2`(HALF_EVEN,非3),6 月 `partial`(`gap=null`,绝不写0)。

---

## 二、做了什么(对照任务书 §1 边界)

| 部件 | 状态 | 本工程 |
|---|---|---|
| `LoopEngine` / `Record` / `LearningSample` / `LoopController` / `ActualRepository` / `LoopEngineGoldenTest` | ✅ 已验证 | **照搬,逐字未改** |
| `LoopConfig` | ⬜ 内联示例 | 仅加 `register()` 入口;配置**外置到 DB 表 `loop_config`**(内联块留作无库兜底/自检默认) |
| `HanxunActualRepository` | ⬜ 待开发 | **新增**:JdbcTemplate 真取数,SUM 聚合,no_data 不补0,`202604→2026-04` |
| `LoopConfigLoader` / `LoopConfigController` | ⬜ | **新增**:启动从 `loop_config` 装载;`POST /loop/config/reload` 热生效 |
| 起服务 / CORS / 鉴权 | ⬜ | **新增**:`LoopBrainApplication` + `WebCorsConfig` + `GatewayAuthFilter` |

### 锁死项(任务书 §2)均遵守
- 五步环顺序、RECORD 形状、`gap=null` 绝不写0:引擎照搬未动。
- 取整 HALF_EVEN:回归测试 `取整坑回归_2点5百分号必须等于2` 绿;5月 2/80=2.5%→2。
- 目标列弃用:`r_target` 走 `loop_config.r_target_topdown`(top_down),绝不取数据目标列。
- 口径 sell-in:`r_actual` = IPO10 门店出货量(瓶),`calibrated:false`。
- 命门=单期阈值 `state`(`gap_pct≤−40%`),非序列 argmin。
- 预测占位不动:`r_forecast=近3月均值`;`forecast_locked_at/outcome/version` 字段全留(挖好的坑不填平)。

---

## 三、核心开发①:接汉询(`HanxunActualRepository`)

口径 SQL(`src/main/resources/sql/ipo10_monthly_actual.sql`):

```sql
SELECT period, SUM(actual_bottles) AS qty
FROM <汉询IPO10出货量表/视图>
WHERE store_id=? AND sku_id=? AND period LIKE ?  -- '2026%'
GROUP BY period ORDER BY period;
```

- 多行 → SUM 聚合(种子里1月拆 40+46=86 验证)。
- 某月无行 → **不放进返回 map**(引擎据此出 no_data,绝不补0)。
- 表名走配置 `loop.hanxun.actual-table`(默认 `ipo10_sales`),**生产换成汉询真实表/视图,不改代码**。

## 四、核心开发②:配置外置(`loop_config` 表)

一行 = 一个 `store×sku`。**横向复制 = 加一行**,引擎一字不改(1引擎N插)。DDL 见 `db/schema.sql`:

```
store_id, sku_id, store_name, tier, city, sku_name, unit, avg_price,
r_target_topdown,           -- 自上而下·人维护·严禁实际倒推
closed_periods  (JSON 数组), -- ["2026-01",...]
partial_periods (JSON 对象), -- {"2026-06":[15,30]}
anomaly_floor
```

启动自动装载;加行后 `POST /loop/config/reload` 热生效,无需重启。

## 五、核心开发③:端点 + CORS + 鉴权

- `GET /loop/series?store=&sku=&year=` → 200 + `RECORD[]`(period 升序)。
- **CORS**:`loop.cors.allowed-origins`(逗号分隔)放行 CloudBase 前端域;生产收敛真实域。
- **鉴权**:`GatewayAuthFilter`,接公司网关(企微换票在网关侧,注入身份头 `X-Gateway-User`),与 ICA App 一致。
  - `loop.auth.enabled`(dev=false,生产=true);`loop.auth.mode=header|bearer`。

---

## 六、上生产(Hologres)

汉询走 PostgreSQL 协议。用 `hologres` profile(`application-hologres.yml`),只需环境变量,**不改一行代码**:

```bash
export HOLOGRES_JDBC_URL='jdbc:postgresql://<host>:80/<db>'
export HOLOGRES_USER=...   HOLOGRES_PASSWORD=...
export HANXUN_ACTUAL_TABLE='dws.ipo10_sales_mv'      # 汉询真实出货量表/视图
export LOOP_CORS_ORIGINS='https://<cloudbase前端域>'
java -jar target/infinity-loop-brain-0.1.0.jar --spring.profiles.active=hologres
```

生产前提:汉询库已建 `loop_config` 表(DDL 见 `db/schema.sql`)并由业务/JBP 维护 `r_target_topdown`;
IPO10 出货量表/视图就位。`spring.sql.init.mode=never`,生产库不建表不灌数。

---

## 七、验收对照(任务书 §6)

| # | 验收 | 状态 | 证据 |
|---|---|---|---|
| [1] | 自检绿(6条黄金记录 + 取整坑) | ✅ 已验证 | `LoopEngineGoldenTest` 绿 |
| [2] | 接数真:1-5月 gap=+6/-11/-9/-37/+2,6月 partial | ✅ 已验证(走 DB→引擎) | `LoopSeriesIntegrationTest` 绿 + 实跑 `/loop/series` |
| [3] | 配置活:加一行 store×sku 即跑通,引擎未改 | ✅ 已验证 | 青岛店只在 `loop_config` 表,端到端跑通 |
| [4] | 脸联通:前端 fetchSeries 拉 RECORD,渲染命门/验果/半月 | ⏳ 待前端接 | 端点已就绪,RECORD null 字段完整序列化(`@JsonInclude(ALWAYS)` 已验证) |
| [5] | 取整对:5月 gap_pct=2(非3) | ✅ 已验证 | 测试 + 实跑均为 2 |

> [4] 属前端线:把前端 mock 数据源换成 `fetchSeries()` 调本 `/loop/series` 即可。本服务侧已就绪(CORS/鉴权/null 序列化均通)。

## 八、端点速查

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/loop/series?store=&sku=&year=` | 逐期 RECORD(主端点) |
| GET | `/loop/config/keys` | 已注册 store×sku 清单(排障) |
| POST | `/loop/config/reload` | 从 DB 热装 `loop_config` |
| GET | `/actuator/health` | 健康检查 |
