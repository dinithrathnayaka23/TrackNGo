
package com.trackngo.app.config;

import com.trackngo.chat.internal.websocket.ChatWebSocketHandler;
import com.trackngo.tracking.internal.websocket.TrackingWebSocketHandler;
import lombok.RequiredArgsConstructor;
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

    @Override
    public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
        registry.addHandler(chatHandler, "/ws/chat").setAllowedOriginPatterns("*");
        registry.addHandler(trackingHandler, "/ws/tracking").setAllowedOriginPatterns("*");
    }
}

