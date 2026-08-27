
package com.trackngo.app.config;

import com.trackngo.auth.internal.security.JwtFilter;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.AuthenticationEntryPoint;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.access.AccessDeniedHandler;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;

import jakarta.servlet.http.HttpServletResponse;

import java.io.IOException;
import java.nio.charset.StandardCharsets;

@Configuration
@EnableMethodSecurity
@RequiredArgsConstructor
public class SecurityConfig {
    private final JwtFilter jwtFilter;

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
            .csrf(csrf -> csrf.disable())
            .sessionManagement(sm -> sm.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .exceptionHandling(ex -> ex
                .authenticationEntryPoint(restAuthenticationEntryPoint())
                .accessDeniedHandler(restAccessDeniedHandler())
            )
            .authorizeHttpRequests(auth -> auth
                .requestMatchers("/api/auth/**", "/health").permitAll()
                // Registration is performed by an anonymous caller.
                .requestMatchers(HttpMethod.POST, "/api/users").permitAll()
                .requestMatchers("/ws/**").permitAll()
                .requestMatchers("/chat/**").permitAll()
                .requestMatchers("/api/routes/**").permitAll()
                .requestMatchers("/api/users/*/conversations/**").permitAll()
                .requestMatchers(HttpMethod.GET, "/api/users/*/profile").permitAll()
                .requestMatchers("/api/users/*/profile").authenticated()
                .requestMatchers("/api/users/*/settings").authenticated()
                .requestMatchers("/api/users/*/password").authenticated()
                .requestMatchers("/api/users/*/two-factor/**").authenticated()
                .requestMatchers("/api/users/*/corporate").permitAll()
                .requestMatchers("/api/conversations/**").permitAll()
                .requestMatchers("/api/chat/presence").permitAll()
                .requestMatchers("/api/messages/**").permitAll()
                .requestMatchers("/api/media/**").permitAll()
                .requestMatchers("/uploads/**").permitAll()
                .requestMatchers("/api/emergency-numbers/**").permitAll()
                .requestMatchers("/api/emergency-contacts/**").permitAll()
                .requestMatchers("/api/sos-alerts/**").permitAll()
                .requestMatchers("/api/tracking/**").permitAll()
                .requestMatchers("/api/booking-flow/**").permitAll()
                .requestMatchers("/api/bookings/**").permitAll()
                .requestMatchers("/api/v1/ai/**").permitAll()
                .requestMatchers("/api/notifications/**").permitAll()
                .requestMatchers("/api/complaints", "/api/complaints/mine").permitAll()
                .requestMatchers("/api/ratings/**").permitAll()
                .requestMatchers("/api/admin/buses/**").permitAll()
                .requestMatchers("/api/admin/complaints/**").permitAll()
                .requestMatchers("/api/admin/promotions", "/api/admin/promotions/**").permitAll()
                .requestMatchers("/api/admin/emergency-numbers/**").permitAll()
                .requestMatchers("/api/admin/support/**").permitAll()
                .requestMatchers("/bus-sharer.html").permitAll()
                .requestMatchers("/api/locations/**").permitAll()
                .requestMatchers("/api/trips/**").permitAll()
                .requestMatchers("/api/corporate/**").permitAll()
                .anyRequest().authenticated()
            )
            .addFilterBefore(jwtFilter, UsernamePasswordAuthenticationFilter.class);
        return http.build();
    }

    /**
     * Without these, an unauthenticated request is answered with an empty 403 body,
     * which is indistinguishable from a genuine authorization failure and gives the
     * client nothing to act on. A missing or expired token now returns 401 with a
     * JSON body so callers can tell "log in again" apart from "not allowed".
     */
    private AuthenticationEntryPoint restAuthenticationEntryPoint() {
        return (request, response, authException) -> writeError(
                response, HttpServletResponse.SC_UNAUTHORIZED, "Authentication required or token expired.");
    }

    private AccessDeniedHandler restAccessDeniedHandler() {
        return (request, response, accessDeniedException) -> writeError(
                response, HttpServletResponse.SC_FORBIDDEN, "You do not have permission to access this resource.");
    }

    private void writeError(HttpServletResponse response, int status, String message) throws IOException {
        response.setStatus(status);
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.setCharacterEncoding(StandardCharsets.UTF_8.name());
        response.getWriter().write("{\"success\":false,\"message\":\"" + message + "\",\"data\":null}");
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    public AuthenticationManager authenticationManager(AuthenticationConfiguration config) throws Exception {
        return config.getAuthenticationManager();
    }
}

