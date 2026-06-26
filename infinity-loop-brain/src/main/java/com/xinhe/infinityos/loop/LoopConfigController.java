package com.xinhe.infinityos.loop;

import org.springframework.web.bind.annotation.*;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * 配置运维口(开发②配套):往 loop_config 加完一行后,无需重启,POST 此口热装。
 * 支持验收 [3]「配置活:加一行 → 该 store×sku 能跑通,引擎未改一字」。
 */
@RestController
@RequestMapping("/loop/config")
public class LoopConfigController {

    private final LoopConfigLoader loader;

    public LoopConfigController(LoopConfigLoader loader) {
        this.loader = loader;
    }

    /** 重新从 DB 装载 loop_config(热生效)。 */
    @PostMapping("/reload")
    public Map<String, Object> reload() {
        int n = loader.reload();
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("reloaded", n);
        m.put("keys", LoopConfig.keys());
        return m;
    }

    /** 当前已注册的 store×sku 清单(自检/排障)。 */
    @GetMapping("/keys")
    public Map<String, Object> keys() {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("keys", LoopConfig.keys());
        return m;
    }
}
