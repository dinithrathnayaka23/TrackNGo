
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
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.http.HttpMethod;

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
            .authorizeHttpRequests(auth -> auth
                .requestMatchers("/api/auth/**", "/health").permitAll()
                .requestMatchers("/ws/**").permitAll()
                .requestMatchers("/chat/**").permitAll()
                .requestMatchers("/api/routes/**").permitAll()
                .requestMatchers("/api/users/*/conversations/**").permitAll()
                .requestMatchers(HttpMethod.GET, "/api/users/*/profile").permitAll()
                .requestMatchers("/api/users/*/profile").authenticated()
                .requestMatchers("/api/users/*/settings").authenticated()
                .requestMatchers("/api/users/*/password").authenticated()
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

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    public AuthenticationManager authenticationManager(AuthenticationConfiguration config) throws Exception {
        return config.getAuthenticationManager();
    }
}

