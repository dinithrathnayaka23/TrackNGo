
package com.trackngo.app.config;

import com.trackngo.chat.internal.websocket.ChatWebSocketHandler;
import com.trackngo.tracking.internal.websocket.TrackingWebSocketHandler;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.socket.config.annotation.EnableWebSocket;
import org.springframework.web.socket.config.annotation.WebSocketConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry;

@Configuration
@EnableWebSocket
@RequiredArgsConstructor
public class WebSocketConfig implements WebSocketConfigurer {
    private final ChatWebSocketHandler chatHandler;
    private final TrackingWebSocketHandler trackingHandler;

    // Only matters for browser clients (the admin dashboard) — native mobile
    // WebSocket clients don't send an Origin header, so this never blocks them.
    @Value("${trackngo.cors.allowed-origins}")
    private String allowedOriginsProperty;

    @Override
    public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
        String[] origins = CorsOrigins.parse(allowedOriginsProperty);
        registry.addHandler(chatHandler, "/ws/chat").setAllowedOriginPatterns(origins);
        registry.addHandler(trackingHandler, "/ws/tracking").setAllowedOriginPatterns(origins);
    }
}

