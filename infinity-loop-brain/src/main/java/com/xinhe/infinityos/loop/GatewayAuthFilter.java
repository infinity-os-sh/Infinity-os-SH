package com.xinhe.infinityos.loop;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

/**
 * 核心开发③ · 鉴权 —— 接公司现有鉴权(企微/网关),按现有 ICA App 的方式。
 *
 * 现实落地:公司网关(企微/统一网关)在转发前注入身份头(默认 X-Gateway-User)。
 * 本过滤器只校验「身份头存在」,把真正的换票/校签留在网关侧 —— 与 ICA App 一致。
 * 若团队用 Bearer 令牌,设 loop.auth.mode=bearer + loop.auth.token=<网关下发令牌>。
 *
 * 开关:loop.auth.enabled(默认 false,方便本地/H2 联调)。生产置 true。
 * 预检 OPTIONS、健康检查 /actuator/** 直接放行。
 */
@Component
public class GatewayAuthFilter extends OncePerRequestFilter {

    private final boolean enabled;
    private final String mode;       // "header"(网关注入身份头) | "bearer"(令牌)
    private final String userHeader; // header 模式:身份头名
    private final String token;      // bearer 模式:期望令牌

    public GatewayAuthFilter(
            @Value("${loop.auth.enabled:false}") boolean enabled,
            @Value("${loop.auth.mode:header}") String mode,
            @Value("${loop.auth.user-header:X-Gateway-User}") String userHeader,
            @Value("${loop.auth.token:}") String token) {
        this.enabled = enabled;
        this.mode = mode;
        this.userHeader = userHeader;
        this.token = token;
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        if (!enabled) return true;                                   // 关闭即全放行
        if ("OPTIONS".equalsIgnoreCase(request.getMethod())) return true; // CORS 预检
        String uri = request.getRequestURI();
        return uri.startsWith("/actuator");                          // 健康检查放行
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        boolean ok;
        if ("bearer".equalsIgnoreCase(mode)) {
            String auth = request.getHeader("Authorization");
            ok = auth != null && auth.startsWith("Bearer ")
                    && !token.isBlank() && token.equals(auth.substring(7).trim());
        } else { // header 模式:网关已换票并注入身份头
            String user = request.getHeader(userHeader);
            ok = user != null && !user.isBlank();
        }
        if (!ok) {
            response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
            response.setContentType("application/json;charset=UTF-8");
            response.getWriter().write("{\"error\":\"unauthorized\"}");
            return;
        }
        chain.doFilter(request, response);
    }
}
