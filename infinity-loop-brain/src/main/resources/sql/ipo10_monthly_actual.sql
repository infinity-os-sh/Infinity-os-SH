-- ════════════════════════════════════════════════════════════
-- 量实↑ 取数 · IPO10 月度实际(sell-in)· 给 HanxunActualRepository
-- 口径(v3.10锁):r_actual = IPO10 门店出货量(基本单位_瓶),按 店×SKU×月 聚合求和
-- no_data:某月无行 → 不返回该期(引擎据此出 no_data,绝不写 0)
-- ════════════════════════════════════════════════════════════

-- 主查询(替换表名/列名为汉询真实对象)
SELECT
    period,                              -- 形如 202604;Java 转 "2026-04"
    SUM(actual_bottles) AS qty           -- ★ 多行聚合求和(同店同SKU同月可能多行)
FROM ipo10_sales                         -- ← 换成汉询真实表/视图(IPO10_门店出货量来源)
WHERE store_id = :store_id               -- 门店编码,如 3001156859
  AND sku_id   = :sku_id                 -- SKU编码,如 PS01080160
  AND period LIKE :year_prefix           -- 如 '2026%'
GROUP BY period
ORDER BY period;

-- ── 字段映射(IPO10 月门店SKU 文件 → 本查询)──
--   门店编码                          → store_id
--   SKU编码                           → sku_id
--   月份                              → period
--   IPO10_门店出货量(基本单位_瓶)     → actual_bottles   ★这是 r_actual 的唯一口径
--   IPO10_目标出货量(基本单位_瓶)     → 【弃用】占位/不可信,r_target 走 top_down,不取这列
--   IPO10_LY出货量(基本单位_瓶)       → 预测基准用(可选,另查)

-- ── 未结月(半月)判定 ──
--   引擎 LoopConfig.partial_periods 标 [已过天数, 当月总天数]。
--   取数本身照常返回该月已出货量(如6月=3);是否"半月"由配置决定,SQL 不必区分。
--   生产可由"数据截止日 vs 月末"动态算 days_elapsed,替代写死配置。

-- ── 坏数据防护(盘点类数据才需要;IPO10销售文件相对干净)──
--   若改用日盘点的售出/库存:【不要】。售出列=脏delta、库存有坏盘日(见 v3.10 §六)。
--   r_actual 一律用本 IPO10 销售文件,不用盘点售出/库存。
