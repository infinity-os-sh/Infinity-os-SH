-- ════════════════════════════════════════════════════════════
-- 开发② 配置外置:loop_config 表(一行 = 一个 store×SKU)
-- 开发① 取数源:ipo10_sales(dev/H2 用;生产指向汉询真实 IPO10 出货量表/视图)
-- 生产 Hologres 同款 DDL 可直接建表(JSON 列用 text/jsonb 均可,本服务按文本读后 Jackson 解析)。
-- ════════════════════════════════════════════════════════════

-- 配置表:横向复制 = 往这张表加一行,引擎一字不改(1引擎N插)
CREATE TABLE IF NOT EXISTS loop_config (
    store_id          VARCHAR(64)  NOT NULL,
    sku_id            VARCHAR(64)  NOT NULL,
    store_name        VARCHAR(128),
    tier              VARCHAR(32),
    city              VARCHAR(64),
    sku_name          VARCHAR(128),
    unit              VARCHAR(16),
    avg_price         DOUBLE PRECISION,
    r_target_topdown  INTEGER,            -- 自上而下·人维护·严禁实际倒推
    closed_periods    VARCHAR(2000),      -- JSON 数组:["2026-01",...]
    partial_periods   VARCHAR(2000),      -- JSON 对象:{"2026-06":[15,30]}
    anomaly_floor     INTEGER,            -- 异常守门下限(瓶)
    PRIMARY KEY (store_id, sku_id)
);

-- 取数表(IPO10 sell-in 出货量;dev 用,生产以汉询真实表为准)
-- 口径:actual_bottles = IPO10「门店出货量(基本单位_瓶)」;目标列弃用,不建在此
CREATE TABLE IF NOT EXISTS ipo10_sales (
    store_id        VARCHAR(64) NOT NULL,
    sku_id          VARCHAR(64) NOT NULL,
    period          VARCHAR(6)  NOT NULL,   -- 形如 202604
    actual_bottles  INTEGER     NOT NULL
);
