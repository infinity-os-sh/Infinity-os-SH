package com.xinhe.infinityos.loop;

import com.fasterxml.jackson.annotation.JsonInclude;

/**
 * ④ 上报升一层信号(流程优化·关不掉的差=升一层)。
 * 连续 N 期同一 state(欠/欠-命门)且 gap 未收窄 → 产此信号。只产信号,不自动派给谁。
 * 写入 RECORD + escalation_log。未触发时整个对象为 null。
 */
@JsonInclude(JsonInclude.Include.ALWAYS)
public class Escalation {
    public boolean triggered;        // 是否触发
    public String  reason;           // "连续N期未关闭差距"
    public String  from_level;       // "店×SKU"
    public String  to_level;         // 升一层去向,如 "城市/客户"
    public Integer periods_unclosed; // 连续未关闭期数
}
