package com.trackngo.app.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer;

/**
 * Configures a STOMP message broker over SockJS so the mobile
 * front-end ({@code @stomp/stompjs} + {@code sockjs-client}) can
 * subscribe to real-time chat events.
 */
@Configuration
@EnableWebSocketMessageBroker
public class StompWebSocketConfig implements WebSocketMessageBrokerConfigurer {

    // Only matters for browser clients — the origin check is skipped
    // entirely when no Origin header is present, which is how native mobile
    // SockJS/XHR clients connect, so this doesn't affect the mobile app.
    @Value("${trackngo.cors.allowed-origins}")
    private String allowedOriginsProperty;

    @Override
    public void configureMessageBroker(MessageBrokerRegistry registry) {
        registry.enableSimpleBroker("/topic");
        registry.setApplicationDestinationPrefixes("/app");
    }

    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        registry.addEndpoint("/chat")
                .setAllowedOriginPatterns(CorsOrigins.parse(allowedOriginsProperty))
                .withSockJS();
    }
}