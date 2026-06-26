package com.xinhe.infinityos.loop;

import org.springframework.web.bind.annotation.*;
import java.util.*;

/**
 * 缝 · GET /loop/series —— 引擎吐 RECORD 数组,脸 fetchSeries() 拉这个。
 * 契约见《对接契约_fetchSeries_脸接引擎》。
 */
@RestController
@RequestMapping("/loop")
public class LoopController {

    private final LoopService loopService;

    public LoopController(LoopService loopService) { this.loopService = loopService; }

    /**
     * GET /loop/series?store=3001156859&sku=PS01080160&year=2026
     * → [ RECORD, ... ] 按 period 升序;一年最多12条(或到当前期)。
     * 编排(取数 → 闭环增量 → 留痕)收口在 LoopService。
     */
    @GetMapping("/series")
    public List<Record> series(@RequestParam("store") String store,
                               @RequestParam("sku")   String sku,
                               @RequestParam("year")  String year) {
        return loopService.series(store, sku, year);
    }

    @ExceptionHandler(IllegalArgumentException.class)
    @ResponseStatus(org.springframework.http.HttpStatus.BAD_REQUEST)
    public Map<String, Object> onBadReq(IllegalArgumentException e,
                                        @RequestParam(value="store",required=false) String store,
                                        @RequestParam(value="sku",required=false) String sku) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("error", e.getMessage()); m.put("store", store); m.put("sku", sku);
        return m;
    }
}
