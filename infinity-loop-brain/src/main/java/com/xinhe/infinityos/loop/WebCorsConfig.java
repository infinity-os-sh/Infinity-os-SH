package com.xinhe.infinityos.loop;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/**
 * 核心开发③ · CORS —— 放行 CloudBase 前端域(ICA App 那套 / 各渠道 App)。
 * 域名由 loop.cors.allowed-origins 配置(逗号分隔);默认含本地联调与 CloudBase 占位域。
 * 生产把 allowed-origins 收敛到真实前端域,不要长期放 "*"。
 */
@Configuration
public class WebCorsConfig implements WebMvcConfigurer {

    private final String[] allowedOrigins;

    public WebCorsConfig(@Value("${loop.cors.allowed-origins:http://localhost:3000,http://localhost:5173}") String origins) {
        this.allowedOrigins = origins.split("\\s*,\\s*");
    }

    @Override
    public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping("/loop/**")
                .allowedOriginPatterns(allowedOrigins)
                .allowedMethods("GET", "POST", "OPTIONS")
                .allowedHeaders("*")
                .allowCredentials(true)
                .maxAge(3600);
    }
}
