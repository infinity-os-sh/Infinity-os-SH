package com.xinhe.infinityos.loop;

import com.fasterxml.jackson.annotation.JsonInclude;

/**
 * ① 验果回写结论(流程优化·让第5步箭头接回第1步)。
 * 比较「上期开的应对」与「本期 gap 是否收窄」,产出闭环判定 + 一条规则种子。
 * 种子只追加进 rule_learning_log(只进不改,对齐 LearningSample 纪律);机器不自动改规则。
 */
@JsonInclude(JsonInclude.Include.ALWAYS)
public class Closure {
    public String prev_period;     // 上期
    public String prev_state;      // 上期状态(场景)
    public String prev_response;   // 上期开的应对
    public String gap_change;      // "收窄" | "扩大" | "持平" | null(不可比)
    public String verdict;         // "应对有效" | "应对无效·要找因果" | "未执行无法判定"
    public RuleSeed learned_rule_seed;  // 规则种子(可为 null)

    /** 规则种子 {场景, 应对, 效果} —— 入 rule_learning_log,供人/将来学习模块决定是否升正式规则。 */
    @JsonInclude(JsonInclude.Include.ALWAYS)
    public static class RuleSeed {
        public String scenario;   // 场景 = prev_state(如 "欠-命门")
        public String response;   // 应对 = prev_response(如 "查陈列/缺货/竞品价")
        public String effect;     // 效果 = verdict(如 "应对有效")
    }
}
