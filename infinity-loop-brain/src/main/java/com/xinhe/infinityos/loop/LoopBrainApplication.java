package com.xinhe.infinityos.loop;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

/**
 * INFINITY OS · L5 算账中枢「脑子」启动类。
 * 起服务后暴露 GET /loop/series,前端各渠道 App(CloudBase/ICA)调它拿逐期 RECORD。
 * 组件扫描根 = com.xinhe.infinityos.loop(引擎 + 取数 + 配置 + 缝 全在此包)。
 */
@SpringBootApplication
public class LoopBrainApplication {
    public static void main(String[] args) {
        SpringApplication.run(LoopBrainApplication.class, args);
    }
}
