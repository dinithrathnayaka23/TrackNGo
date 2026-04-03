import os, textwrap
from pathlib import Path

root = Path(r"c:\Users\MSI GF63\Pictures\web\TrackNGo\backend\trackngo-backend")

files = {}

def add(path, content):
    files[path] = textwrap.dedent(content).lstrip('\n')

# Parent pom
add("pom.xml", """
<project xmlns="http://maven.apache.org/POM/4.0.0"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 http://maven.apache.org/xsd/maven-4.0.0.xsd">
  <modelVersion>4.0.0</modelVersion>

  <groupId>com.trackngo</groupId>
  <artifactId>trackngo-backend</artifactId>
  <version>1.0.0-SNAPSHOT</version>
  <packaging>pom</packaging>

  <modules>
    <module>commons</module>
    <module>auth-user-module</module>
    <module>booking-module</module>
    <module>tracking-module</module>
    <module>driver-fleet-module</module>
    <module>payment-module</module>
    <module>notification-module</module>
    <module>complaint-module</module>
    <module>chat-module</module>
    <module>feedback-rating-module</module>
    <module>admin-module</module>
    <module>app</module>
  </modules>

  <properties>
    <java.version>17</java.version>
    <spring-boot.version>3.3.4</spring-boot.version>
    <jjwt.version>0.11.5</jjwt.version>
  </properties>

  <dependencyManagement>
    <dependencies>
      <dependency>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-dependencies</artifactId>
        <version>${spring-boot.version}</version>
        <type>pom</type>
        <scope>import</scope>
      </dependency>
      <dependency>
        <groupId>io.jsonwebtoken</groupId>
        <artifactId>jjwt-bom</artifactId>
        <version>${jjwt.version}</version>
        <type>pom</type>
        <scope>import</scope>
      </dependency>
    </dependencies>
  </dependencyManagement>

  <build>
    <pluginManagement>
      <plugins>
        <plugin>
          <groupId>org.springframework.boot</groupId>
          <artifactId>spring-boot-maven-plugin</artifactId>
          <version>${spring-boot.version}</version>
        </plugin>
      </plugins>
    </pluginManagement>
  </build>
</project>
""")

# commons pom
add("commons/pom.xml", """
<project xmlns="http://maven.apache.org/POM/4.0.0"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 http://maven.apache.org/xsd/maven-4.0.0.xsd">
  <modelVersion>4.0.0</modelVersion>
  <parent>
    <groupId>com.trackngo</groupId>
    <artifactId>trackngo-backend</artifactId>
    <version>1.0.0-SNAPSHOT</version>
  </parent>

  <artifactId>commons</artifactId>
  <packaging>jar</packaging>

  <dependencies>
    <dependency>
      <groupId>org.springframework.boot</groupId>
      <artifactId>spring-boot-starter-web</artifactId>
    </dependency>
    <dependency>
      <groupId>org.springframework.boot</groupId>
      <artifactId>spring-boot-starter-validation</artifactId>
    </dependency>
    <dependency>
      <groupId>org.springframework.boot</groupId>
      <artifactId>spring-boot-starter-security</artifactId>
    </dependency>
    <dependency>
      <groupId>io.jsonwebtoken</groupId>
      <artifactId>jjwt-api</artifactId>
    </dependency>
    <dependency>
      <groupId>io.jsonwebtoken</groupId>
      <artifactId>jjwt-impl</artifactId>
      <scope>runtime</scope>
    </dependency>
    <dependency>
      <groupId>io.jsonwebtoken</groupId>
      <artifactId>jjwt-jackson</artifactId>
      <scope>runtime</scope>
    </dependency>
    <dependency>
      <groupId>org.projectlombok</groupId>
      <artifactId>lombok</artifactId>
      <optional>true</optional>
    </dependency>
  </dependencies>
</project>
""")

# app pom
add("app/pom.xml", """
<project xmlns="http://maven.apache.org/POM/4.0.0"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 http://maven.apache.org/xsd/maven-4.0.0.xsd">
  <modelVersion>4.0.0</modelVersion>
  <parent>
    <groupId>com.trackngo</groupId>
    <artifactId>trackngo-backend</artifactId>
    <version>1.0.0-SNAPSHOT</version>
  </parent>

  <artifactId>app</artifactId>
  <packaging>jar</packaging>

  <dependencies>
    <dependency>
      <groupId>org.springframework.boot</groupId>
      <artifactId>spring-boot-starter-web</artifactId>
    </dependency>
    <dependency>
      <groupId>org.springframework.boot</groupId>
      <artifactId>spring-boot-starter-data-jpa</artifactId>
    </dependency>
    <dependency>
      <groupId>org.springframework.boot</groupId>
      <artifactId>spring-boot-starter-security</artifactId>
    </dependency>
    <dependency>
      <groupId>org.springframework.boot</groupId>
      <artifactId>spring-boot-starter-validation</artifactId>
    </dependency>
    <dependency>
      <groupId>org.springframework.boot</groupId>
      <artifactId>spring-boot-starter-websocket</artifactId>
    </dependency>
    <dependency>
      <groupId>com.mysql</groupId>
      <artifactId>mysql-connector-j</artifactId>
      <scope>runtime</scope>
    </dependency>
    <dependency>
      <groupId>org.projectlombok</groupId>
      <artifactId>lombok</artifactId>
      <optional>true</optional>
    </dependency>

    <dependency>
      <groupId>com.trackngo</groupId>
      <artifactId>commons</artifactId>
      <version>${project.version}</version>
    </dependency>
    <dependency>
      <groupId>com.trackngo</groupId>
      <artifactId>auth-user-module</artifactId>
      <version>${project.version}</version>
    </dependency>
    <dependency>
      <groupId>com.trackngo</groupId>
      <artifactId>booking-module</artifactId>
      <version>${project.version}</version>
    </dependency>
    <dependency>
      <groupId>com.trackngo</groupId>
      <artifactId>tracking-module</artifactId>
      <version>${project.version}</version>
    </dependency>
    <dependency>
      <groupId>com.trackngo</groupId>
      <artifactId>driver-fleet-module</artifactId>
      <version>${project.version}</version>
    </dependency>
    <dependency>
      <groupId>com.trackngo</groupId>
      <artifactId>payment-module</artifactId>
      <version>${project.version}</version>
    </dependency>
    <dependency>
      <groupId>com.trackngo</groupId>
      <artifactId>notification-module</artifactId>
      <version>${project.version}</version>
    </dependency>
    <dependency>
      <groupId>com.trackngo</groupId>
      <artifactId>complaint-module</artifactId>
      <version>${project.version}</version>
    </dependency>
    <dependency>
      <groupId>com.trackngo</groupId>
      <artifactId>chat-module</artifactId>
      <version>${project.version}</version>
    </dependency>
    <dependency>
      <groupId>com.trackngo</groupId>
      <artifactId>feedback-rating-module</artifactId>
      <version>${project.version}</version>
    </dependency>
    <dependency>
      <groupId>com.trackngo</groupId>
      <artifactId>admin-module</artifactId>
      <version>${project.version}</version>
    </dependency>
  </dependencies>

  <build>
    <plugins>
      <plugin>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-maven-plugin</artifactId>
      </plugin>
    </plugins>
  </build>
</project>
""")

module_pom = """
<project xmlns="http://maven.apache.org/POM/4.0.0"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 http://maven.apache.org/xsd/maven-4.0.0.xsd">
  <modelVersion>4.0.0</modelVersion>
  <parent>
    <groupId>com.trackngo</groupId>
    <artifactId>trackngo-backend</artifactId>
    <version>1.0.0-SNAPSHOT</version>
  </parent>

  <artifactId>{artifact}</artifactId>
  <packaging>jar</packaging>

  <dependencies>
    <dependency>
      <groupId>org.springframework.boot</groupId>
      <artifactId>spring-boot-starter-web</artifactId>
    </dependency>
    <dependency>
      <groupId>org.springframework.boot</groupId>
      <artifactId>spring-boot-starter-data-jpa</artifactId>
    </dependency>
    <dependency>
      <groupId>org.springframework.boot</groupId>
      <artifactId>spring-boot-starter-validation</artifactId>
    </dependency>
    <dependency>
      <groupId>org.springframework.boot</groupId>
      <artifactId>spring-boot-starter-security</artifactId>
    </dependency>
    <dependency>
      <groupId>org.projectlombok</groupId>
      <artifactId>lombok</artifactId>
      <optional>true</optional>
    </dependency>
    <dependency>
      <groupId>com.trackngo</groupId>
      <artifactId>commons</artifactId>
      <version>${project.version}</version>
    </dependency>
  </dependencies>
</project>
"""

for mod in [
    "auth-user-module",
    "booking-module",
    "tracking-module",
    "driver-fleet-module",
    "payment-module",
    "notification-module",
    "complaint-module",
    "chat-module",
    "feedback-rating-module",
    "admin-module",
]:
    add(f"{mod}/pom.xml", module_pom.format(artifact=mod))

# commons code
add("commons/src/main/java/com/trackngo/commons/ApiResponse.java", """
package com.trackngo.commons;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class ApiResponse<T> {
    private boolean success;
    private String message;
    private T data;

    public static <T> ApiResponse<T> ok(String message, T data) {
        return new ApiResponse<>(true, message, data);
    }

    public static <T> ApiResponse<T> fail(String message) {
        return new ApiResponse<>(false, message, null);
    }
}
""")

add("commons/src/main/java/com/trackngo/commons/exception/ResourceNotFoundException.java", """
package com.trackngo.commons.exception;

public class ResourceNotFoundException extends RuntimeException {
    public ResourceNotFoundException(String message) {
        super(message);
    }
}
""")

add("commons/src/main/java/com/trackngo/commons/exception/BusinessException.java", """
package com.trackngo.commons.exception;

public class BusinessException extends RuntimeException {
    public BusinessException(String message) {
        super(message);
    }
}
""")
add("commons/src/main/java/com/trackngo/commons/exception/GlobalExceptionHandler.java", """
package com.trackngo.commons.exception;

import com.trackngo.commons.ApiResponse;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(ResourceNotFoundException.class)
    public ResponseEntity<ApiResponse<Void>> handleNotFound(ResourceNotFoundException ex) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(ApiResponse.fail(ex.getMessage()));
    }

    @ExceptionHandler(BusinessException.class)
    public ResponseEntity<ApiResponse<Void>> handleBusiness(BusinessException ex) {
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(ApiResponse.fail(ex.getMessage()));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ApiResponse<Void>> handleValidation(MethodArgumentNotValidException ex) {
        String msg = ex.getBindingResult().getFieldErrors().stream()
                .map(err -> err.getField() + ": " + err.getDefaultMessage())
                .findFirst().orElse("Validation error");
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(ApiResponse.fail(msg));
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiResponse<Void>> handleOther(Exception ex) {
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(ApiResponse.fail("Unexpected error"));
    }
}
""")

add("commons/src/main/java/com/trackngo/commons/events/BaseEvent.java", """
package com.trackngo.commons.events;

import java.time.Instant;

public abstract class BaseEvent {
    private final Instant occurredAt = Instant.now();

    public Instant getOccurredAt() {
        return occurredAt;
    }
}
""")

add("commons/src/main/java/com/trackngo/commons/events/EventPublisher.java", """
package com.trackngo.commons.events;

import lombok.RequiredArgsConstructor;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class EventPublisher {
    private final ApplicationEventPublisher publisher;

    public void publish(BaseEvent event) {
        publisher.publishEvent(event);
    }
}
""")

add("commons/src/main/java/com/trackngo/commons/util/JwtUtil.java", """
package com.trackngo.commons.util;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.SignatureAlgorithm;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.security.Key;
import java.util.Date;
import java.util.Map;

@Component
public class JwtUtil {
    private final Key key;
    private final long expirationMs;

    public JwtUtil(@Value("${trackngo.jwt.secret}") String secret,
                   @Value("${trackngo.jwt.expiration-ms}") long expirationMs) {
        this.key = Keys.hmacShaKeyFor(secret.getBytes());
        this.expirationMs = expirationMs;
    }

    public String generateToken(String subject, Map<String, Object> claims) {
        Date now = new Date();
        Date exp = new Date(now.getTime() + expirationMs);
        return Jwts.builder()
                .setClaims(claims)
                .setSubject(subject)
                .setIssuedAt(now)
                .setExpiration(exp)
                .signWith(key, SignatureAlgorithm.HS256)
                .compact();
    }

    public Claims parse(String token) {
        return Jwts.parserBuilder().setSigningKey(key).build().parseClaimsJws(token).getBody();
    }
}
""")

add("commons/src/main/java/com/trackngo/commons/util/DateUtil.java", """
package com.trackngo.commons.util;

import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;

public class DateUtil {
    public static LocalDateTime toLocalDateTime(Instant instant) {
        return LocalDateTime.ofInstant(instant, ZoneId.systemDefault());
    }
}
""")

add("commons/src/main/java/com/trackngo/commons/constants/AppConstants.java", """
package com.trackngo.commons.constants;

public final class AppConstants {
    private AppConstants() {}

    public static final String API_PREFIX = "/api";
}
""")

add("commons/src/main/java/com/trackngo/commons/constants/Roles.java", """
package com.trackngo.commons.constants;

public final class Roles {
    private Roles() {}

    public static final String ROLE_ADMIN = "ADMIN";
    public static final String ROLE_USER = "USER";
    public static final String ROLE_DRIVER = "DRIVER";
}
""")

# app main and configs
add("app/src/main/java/com/trackngo/app/TrackNGoApplication.java", """
package com.trackngo.app;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication(scanBasePackages = "com.trackngo")
public class TrackNGoApplication {
    public static void main(String[] args) {
        SpringApplication.run(TrackNGoApplication.class, args);
    }
}
""")

add("app/src/main/java/com/trackngo/app/config/SecurityConfig.java", """
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
                .requestMatchers("/api/auth/**").permitAll()
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
""")

add("app/src/main/java/com/trackngo/app/config/JwtConfig.java", """
package com.trackngo.app.config;

import org.springframework.context.annotation.Configuration;

@Configuration
public class JwtConfig {
}
""")

add("app/src/main/java/com/trackngo/app/config/WebConfig.java", """
package com.trackngo.app.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class WebConfig implements WebMvcConfigurer {
    @Override
    public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping("/**")
            .allowedOriginPatterns("*")
            .allowedMethods("GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS")
            .allowedHeaders("*")
            .allowCredentials(true);
    }
}
""")

add("app/src/main/java/com/trackngo/app/config/WebSocketConfig.java", """
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
""")

add("app/src/main/resources/application.yml", """
server:
  port: 8080

spring:
  datasource:
    url: jdbc:mysql://localhost:3306/trackngo?useSSL=false&allowPublicKeyRetrieval=true&serverTimezone=UTC
    username: root
    password: root
  jpa:
    hibernate:
      ddl-auto: update
    properties:
      hibernate:
        format_sql: true
    open-in-view: false

trackngo:
  jwt:
    secret: "change-this-secret-change-this-secret"
    expiration-ms: 86400000
""")

# helper for simple modules

def add_simple_module(module, entities):
    base = f"{module}/src/main/java/com/trackngo/{module.replace('-module','').replace('-', '')}"
    pkg = f"com.trackngo.{module.replace('-module','').replace('-', '')}"

    for entity in entities:
        dto = f"{entity}Dto"
        add(f"{base}/api/dto/{dto}.java", f"""
package {pkg}.api.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class {dto} {{
    private Long id;
    @NotBlank
    private String name;
}}
""")

        add(f"{base}/api/{entity}Service.java", f"""
package {pkg}.api;

import {pkg}.api.dto.{dto};

import java.util.List;

public interface {entity}Service {{
    {dto} create({dto} dto);
    {dto} get(Long id);
    List<{dto}> getAll();
    {dto} update(Long id, {dto} dto);
    void delete(Long id);
}}
""")

        add(f"{base}/events/{entity}CreatedEvent.java", f"""
package {pkg}.events;

import com.trackngo.commons.events.BaseEvent;
import lombok.AllArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor
public class {entity}CreatedEvent extends BaseEvent {{
    private final Long id;
}}
""")

        add(f"{base}/internal/entity/{entity}.java", f"""
package {pkg}.internal.entity;

import jakarta.persistence.*;
import lombok.Data;

@Entity
@Data
@Table(name = "{entity.lower()}s")
public class {entity} {{
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String name;
}}
""")

        add(f"{base}/internal/repository/{entity}Repository.java", f"""
package {pkg}.internal.repository;

import {pkg}.internal.entity.{entity};
import org.springframework.data.jpa.repository.JpaRepository;

public interface {entity}Repository extends JpaRepository<{entity}, Long> {{
}}
""")

        add(f"{base}/internal/service/{entity}ServiceImpl.java", f"""
package {pkg}.internal.service;

import {pkg}.api.{entity}Service;
import {pkg}.api.dto.{dto};
import {pkg}.events.{entity}CreatedEvent;
import {pkg}.internal.entity.{entity};
import {pkg}.internal.repository.{entity}Repository;
import com.trackngo.commons.events.EventPublisher;
import com.trackngo.commons.exception.ResourceNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
public class {entity}ServiceImpl implements {entity}Service {{
    private final {entity}Repository repository;
    private final EventPublisher eventPublisher;

    @Override
    public {dto} create({dto} dto) {{
        {entity} entity = new {entity}();
        entity.setName(dto.getName());
        {entity} saved = repository.save(entity);
        eventPublisher.publish(new {entity}CreatedEvent(saved.getId()));
        return toDto(saved);
    }}

    @Override
    public {dto} get(Long id) {{
        return toDto(repository.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("{entity} not found")));
    }}

    @Override
    public List<{dto}> getAll() {{
        return repository.findAll().stream().map(this::toDto).toList();
    }}

    @Override
    public {dto} update(Long id, {dto} dto) {{
        {entity} entity = repository.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("{entity} not found"));
        entity.setName(dto.getName());
        return toDto(repository.save(entity));
    }}

    @Override
    public void delete(Long id) {{
        repository.deleteById(id);
    }}

    private {dto} toDto({entity} entity) {{
        {dto} dto = new {dto}();
        dto.setId(entity.getId());
        dto.setName(entity.getName());
        return dto;
    }}
}}
""")

        add(f"{base}/internal/controller/{entity}Controller.java", f"""
package {pkg}.internal.controller;

import {pkg}.api.{entity}Service;
import {pkg}.api.dto.{dto};
import com.trackngo.commons.ApiResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/{entity.lower()}s")
@RequiredArgsConstructor
public class {entity}Controller {{
    private final {entity}Service service;

    @PostMapping
    public ApiResponse<{dto}> create(@Valid @RequestBody {dto} dto) {{
        return ApiResponse.ok("Created", service.create(dto));
    }}

    @GetMapping("/{{id}}")
    public ApiResponse<{dto}> get(@PathVariable Long id) {{
        return ApiResponse.ok("Fetched", service.get(id));
    }}

    @GetMapping
    public ApiResponse<List<{dto}>> getAll() {{
        return ApiResponse.ok("Fetched", service.getAll());
    }}

    @PutMapping("/{{id}}")
    public ApiResponse<{dto}> update(@PathVariable Long id, @Valid @RequestBody {dto} dto) {{
        return ApiResponse.ok("Updated", service.update(id, dto));
    }}

    @DeleteMapping("/{{id}}")
    public ApiResponse<Void> delete(@PathVariable Long id) {{
        service.delete(id);
        return ApiResponse.ok("Deleted", null);
    }}
}}
""")

add_simple_module("driver-fleet-module", ["Driver", "Bus", "Fleet"])
add_simple_module("booking-module", ["Booking", "Seat", "Trip"])
add_simple_module("payment-module", ["Payment", "Invoice"])
add_simple_module("notification-module", ["Notification"])
add_simple_module("complaint-module", ["Complaint"])
add_simple_module("feedback-rating-module", ["Feedback", "Rating"])
add_simple_module("admin-module", ["AdminLog"])
# auth module
add("auth-user-module/src/main/java/com/trackngo/auth/api/dto/AuthRequest.java", """
package com.trackngo.auth.api.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class AuthRequest {
    @NotBlank
    private String username;
    @NotBlank
    private String password;
}
""")

add("auth-user-module/src/main/java/com/trackngo/auth/api/dto/AuthResponse.java", """
package com.trackngo.auth.api.dto;

import lombok.AllArgsConstructor;
import lombok.Data;

@Data
@AllArgsConstructor
public class AuthResponse {
    private String token;
}
""")

add("auth-user-module/src/main/java/com/trackngo/auth/api/dto/UserDto.java", """
package com.trackngo.auth.api.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class UserDto {
    private Long id;
    @NotBlank
    private String username;
    private String password;
    private String role;
}
""")

add("auth-user-module/src/main/java/com/trackngo/auth/api/AuthService.java", """
package com.trackngo.auth.api;

import com.trackngo.auth.api.dto.AuthRequest;
import com.trackngo.auth.api.dto.AuthResponse;

public interface AuthService {
    AuthResponse login(AuthRequest request);
    AuthResponse register(AuthRequest request);
}
""")

add("auth-user-module/src/main/java/com/trackngo/auth/api/UserService.java", """
package com.trackngo.auth.api;

import com.trackngo.auth.api.dto.UserDto;

import java.util.List;

public interface UserService {
    UserDto create(UserDto dto);
    UserDto get(Long id);
    List<UserDto> getAll();
    UserDto update(Long id, UserDto dto);
    void delete(Long id);
}
""")

add("auth-user-module/src/main/java/com/trackngo/auth/events/UserRegisteredEvent.java", """
package com.trackngo.auth.events;

import com.trackngo.commons.events.BaseEvent;
import lombok.AllArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor
public class UserRegisteredEvent extends BaseEvent {
    private final Long userId;
}
""")

add("auth-user-module/src/main/java/com/trackngo/auth/internal/entity/Role.java", """
package com.trackngo.auth.internal.entity;

import jakarta.persistence.*;
import lombok.Data;

@Entity
@Data
@Table(name = "roles")
public class Role {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private String name;
}
""")

add("auth-user-module/src/main/java/com/trackngo/auth/internal/entity/User.java", """
package com.trackngo.auth.internal.entity;

import jakarta.persistence.*;
import lombok.Data;

import java.util.HashSet;
import java.util.Set;

@Entity
@Data
@Table(name = "users")
public class User {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private String username;

    @Column(nullable = false)
    private String password;

    @ManyToMany(fetch = FetchType.EAGER)
    @JoinTable(
        name = "user_roles",
        joinColumns = @JoinColumn(name = "user_id"),
        inverseJoinColumns = @JoinColumn(name = "role_id")
    )
    private Set<Role> roles = new HashSet<>();
}
""")

add("auth-user-module/src/main/java/com/trackngo/auth/internal/repository/UserRepository.java", """
package com.trackngo.auth.internal.repository;

import com.trackngo.auth.internal.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface UserRepository extends JpaRepository<User, Long> {
    Optional<User> findByUsername(String username);
    boolean existsByUsername(String username);
}
""")

add("auth-user-module/src/main/java/com/trackngo/auth/internal/repository/RoleRepository.java", """
package com.trackngo.auth.internal.repository;

import com.trackngo.auth.internal.entity.Role;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface RoleRepository extends JpaRepository<Role, Long> {
    Optional<Role> findByName(String name);
}
""")

add("auth-user-module/src/main/java/com/trackngo/auth/internal/service/AuthServiceImpl.java", """
package com.trackngo.auth.internal.service;

import com.trackngo.auth.api.AuthService;
import com.trackngo.auth.api.dto.AuthRequest;
import com.trackngo.auth.api.dto.AuthResponse;
import com.trackngo.auth.events.UserRegisteredEvent;
import com.trackngo.auth.internal.entity.Role;
import com.trackngo.auth.internal.entity.User;
import com.trackngo.auth.internal.repository.RoleRepository;
import com.trackngo.auth.internal.repository.UserRepository;
import com.trackngo.commons.constants.Roles;
import com.trackngo.commons.events.EventPublisher;
import com.trackngo.commons.exception.BusinessException;
import com.trackngo.commons.util.JwtUtil;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.util.Map;

@Service
@RequiredArgsConstructor
public class AuthServiceImpl implements AuthService {
    private final UserRepository userRepository;
    private final RoleRepository roleRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtUtil jwtUtil;
    private final EventPublisher eventPublisher;

    @Override
    public AuthResponse login(AuthRequest request) {
        User user = userRepository.findByUsername(request.getUsername())
            .orElseThrow(() -> new BusinessException("Invalid credentials"));
        if (!passwordEncoder.matches(request.getPassword(), user.getPassword())) {
            throw new BusinessException("Invalid credentials");
        }
        String role = user.getRoles().stream().findFirst().map(Role::getName).orElse(Roles.ROLE_USER);
        String token = jwtUtil.generateToken(user.getUsername(), Map.of("role", role));
        return new AuthResponse(token);
    }

    @Override
    public AuthResponse register(AuthRequest request) {
        if (userRepository.existsByUsername(request.getUsername())) {
            throw new BusinessException("Username already exists");
        }
        Role role = roleRepository.findByName(Roles.ROLE_USER)
            .orElseGet(() -> {
                Role r = new Role();
                r.setName(Roles.ROLE_USER);
                return roleRepository.save(r);
            });
        User user = new User();
        user.setUsername(request.getUsername());
        user.setPassword(passwordEncoder.encode(request.getPassword()));
        user.getRoles().add(role);
        User saved = userRepository.save(user);
        eventPublisher.publish(new UserRegisteredEvent(saved.getId()));
        String token = jwtUtil.generateToken(saved.getUsername(), Map.of("role", role.getName()));
        return new AuthResponse(token);
    }
}
""")

add("auth-user-module/src/main/java/com/trackngo/auth/internal/service/UserServiceImpl.java", """
package com.trackngo.auth.internal.service;

import com.trackngo.auth.api.UserService;
import com.trackngo.auth.api.dto.UserDto;
import com.trackngo.auth.internal.entity.Role;
import com.trackngo.auth.internal.entity.User;
import com.trackngo.auth.internal.repository.RoleRepository;
import com.trackngo.auth.internal.repository.UserRepository;
import com.trackngo.commons.constants.Roles;
import com.trackngo.commons.exception.ResourceNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
public class UserServiceImpl implements UserService {
    private final UserRepository userRepository;
    private final RoleRepository roleRepository;
    private final PasswordEncoder passwordEncoder;

    @Override
    public UserDto create(UserDto dto) {
        User user = new User();
        user.setUsername(dto.getUsername());
        if (dto.getPassword() != null) {
            user.setPassword(passwordEncoder.encode(dto.getPassword()));
        }
        String roleName = dto.getRole() == null ? Roles.ROLE_USER : dto.getRole();
        Role role = roleRepository.findByName(roleName)
            .orElseGet(() -> {
                Role r = new Role();
                r.setName(roleName);
                return roleRepository.save(r);
            });
        user.getRoles().add(role);
        return toDto(userRepository.save(user));
    }

    @Override
    public UserDto get(Long id) {
        return toDto(userRepository.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("User not found")));
    }

    @Override
    public List<UserDto> getAll() {
        return userRepository.findAll().stream().map(this::toDto).toList();
    }

    @Override
    public UserDto update(Long id, UserDto dto) {
        User user = userRepository.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("User not found"));
        user.setUsername(dto.getUsername());
        if (dto.getPassword() != null) {
            user.setPassword(passwordEncoder.encode(dto.getPassword()));
        }
        return toDto(userRepository.save(user));
    }

    @Override
    public void delete(Long id) {
        userRepository.deleteById(id);
    }

    private UserDto toDto(User user) {
        UserDto dto = new UserDto();
        dto.setId(user.getId());
        dto.setUsername(user.getUsername());
        dto.setRole(user.getRoles().stream().findFirst().map(Role::getName).orElse(Roles.ROLE_USER));
        return dto;
    }
}
""")

add("auth-user-module/src/main/java/com/trackngo/auth/internal/security/CustomUserDetailsService.java", """
package com.trackngo.auth.internal.security;

import com.trackngo.auth.internal.entity.User;
import com.trackngo.auth.internal.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;

import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class CustomUserDetailsService implements UserDetailsService {
    private final UserRepository userRepository;

    @Override
    public UserDetails loadUserByUsername(String username) throws UsernameNotFoundException {
        User user = userRepository.findByUsername(username)
            .orElseThrow(() -> new UsernameNotFoundException("User not found"));
        return new org.springframework.security.core.userdetails.User(
            user.getUsername(),
            user.getPassword(),
            user.getRoles().stream()
                .map(role -> new SimpleGrantedAuthority("ROLE_" + role.getName()))
                .collect(Collectors.toSet())
        );
    }
}
""")

add("auth-user-module/src/main/java/com/trackngo/auth/internal/security/JwtFilter.java", """
package com.trackngo.auth.internal.security;

import com.trackngo.commons.util.JwtUtil;
import io.jsonwebtoken.Claims;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

@Component
@RequiredArgsConstructor
public class JwtFilter extends OncePerRequestFilter {
    private final JwtUtil jwtUtil;
    private final UserDetailsService userDetailsService;

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
        throws ServletException, IOException {
        String auth = request.getHeader("Authorization");
        if (auth != null && auth.startsWith("Bearer ")) {
            String token = auth.substring(7);
            Claims claims = jwtUtil.parse(token);
            String username = claims.getSubject();
            if (username != null && SecurityContextHolder.getContext().getAuthentication() == null) {
                var userDetails = userDetailsService.loadUserByUsername(username);
                var authToken = new UsernamePasswordAuthenticationToken(userDetails, null, userDetails.getAuthorities());
                SecurityContextHolder.getContext().setAuthentication(authToken);
            }
        }
        filterChain.doFilter(request, response);
    }
}
""")

add("auth-user-module/src/main/java/com/trackngo/auth/internal/controller/AuthController.java", """
package com.trackngo.auth.internal.controller;

import com.trackngo.auth.api.AuthService;
import com.trackngo.auth.api.dto.AuthRequest;
import com.trackngo.auth.api.dto.AuthResponse;
import com.trackngo.commons.ApiResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {
    private final AuthService authService;

    @PostMapping("/login")
    public ApiResponse<AuthResponse> login(@Valid @RequestBody AuthRequest request) {
        return ApiResponse.ok("Login successful", authService.login(request));
    }

    @PostMapping("/register")
    public ApiResponse<AuthResponse> register(@Valid @RequestBody AuthRequest request) {
        return ApiResponse.ok("Registration successful", authService.register(request));
    }
}
""")

add("auth-user-module/src/main/java/com/trackngo/auth/internal/controller/UserController.java", """
package com.trackngo.auth.internal.controller;

import com.trackngo.auth.api.UserService;
import com.trackngo.auth.api.dto.UserDto;
import com.trackngo.commons.ApiResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/users")
@RequiredArgsConstructor
public class UserController {
    private final UserService userService;

    @PostMapping
    public ApiResponse<UserDto> create(@Valid @RequestBody UserDto dto) {
        return ApiResponse.ok("User created", userService.create(dto));
    }

    @GetMapping("/{id}")
    public ApiResponse<UserDto> get(@PathVariable Long id) {
        return ApiResponse.ok("User fetched", userService.get(id));
    }

    @GetMapping
    public ApiResponse<List<UserDto>> getAll() {
        return ApiResponse.ok("Users fetched", userService.getAll());
    }

    @PutMapping("/{id}")
    public ApiResponse<UserDto> update(@PathVariable Long id, @Valid @RequestBody UserDto dto) {
        return ApiResponse.ok("User updated", userService.update(id, dto));
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(@PathVariable Long id) {
        userService.delete(id);
        return ApiResponse.ok("User deleted", null);
    }
}
""")
# tracking module
add("tracking-module/src/main/java/com/trackngo/tracking/api/dto/BusLocationDto.java", """
package com.trackngo.tracking.api.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class BusLocationDto {
    private Long id;
    @NotBlank
    private String name;
}
""")

add("tracking-module/src/main/java/com/trackngo/tracking/api/dto/RouteDto.java", """
package com.trackngo.tracking.api.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class RouteDto {
    private Long id;
    @NotBlank
    private String name;
}
""")

add("tracking-module/src/main/java/com/trackngo/tracking/api/BusLocationService.java", """
package com.trackngo.tracking.api;

import com.trackngo.tracking.api.dto.BusLocationDto;

import java.util.List;

public interface BusLocationService {
    BusLocationDto create(BusLocationDto dto);
    BusLocationDto get(Long id);
    List<BusLocationDto> getAll();
    BusLocationDto update(Long id, BusLocationDto dto);
    void delete(Long id);
}
""")

add("tracking-module/src/main/java/com/trackngo/tracking/api/RouteService.java", """
package com.trackngo.tracking.api;

import com.trackngo.tracking.api.dto.RouteDto;

import java.util.List;

public interface RouteService {
    RouteDto create(RouteDto dto);
    RouteDto get(Long id);
    List<RouteDto> getAll();
    RouteDto update(Long id, RouteDto dto);
    void delete(Long id);
}
""")

add("tracking-module/src/main/java/com/trackngo/tracking/events/TrackingUpdatedEvent.java", """
package com.trackngo.tracking.events;

import com.trackngo.commons.events.BaseEvent;
import lombok.AllArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor
public class TrackingUpdatedEvent extends BaseEvent {
    private final Long id;
}
""")

add("tracking-module/src/main/java/com/trackngo/tracking/internal/entity/BusLocation.java", """
package com.trackngo.tracking.internal.entity;

import jakarta.persistence.*;
import lombok.Data;

@Entity
@Data
@Table(name = "bus_locations")
public class BusLocation {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String name;
}
""")

add("tracking-module/src/main/java/com/trackngo/tracking/internal/entity/Route.java", """
package com.trackngo.tracking.internal.entity;

import jakarta.persistence.*;
import lombok.Data;

@Entity
@Data
@Table(name = "routes")
public class Route {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String name;
}
""")

add("tracking-module/src/main/java/com/trackngo/tracking/internal/repository/BusLocationRepository.java", """
package com.trackngo.tracking.internal.repository;

import com.trackngo.tracking.internal.entity.BusLocation;
import org.springframework.data.jpa.repository.JpaRepository;

public interface BusLocationRepository extends JpaRepository<BusLocation, Long> {
}
""")

add("tracking-module/src/main/java/com/trackngo/tracking/internal/repository/RouteRepository.java", """
package com.trackngo.tracking.internal.repository;

import com.trackngo.tracking.internal.entity.Route;
import org.springframework.data.jpa.repository.JpaRepository;

public interface RouteRepository extends JpaRepository<Route, Long> {
}
""")

add("tracking-module/src/main/java/com/trackngo/tracking/internal/service/BusLocationServiceImpl.java", """
package com.trackngo.tracking.internal.service;

import com.trackngo.commons.events.EventPublisher;
import com.trackngo.commons.exception.ResourceNotFoundException;
import com.trackngo.tracking.api.BusLocationService;
import com.trackngo.tracking.api.dto.BusLocationDto;
import com.trackngo.tracking.events.TrackingUpdatedEvent;
import com.trackngo.tracking.internal.entity.BusLocation;
import com.trackngo.tracking.internal.repository.BusLocationRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
public class BusLocationServiceImpl implements BusLocationService {
    private final BusLocationRepository repository;
    private final EventPublisher eventPublisher;

    @Override
    public BusLocationDto create(BusLocationDto dto) {
        BusLocation entity = new BusLocation();
        entity.setName(dto.getName());
        BusLocation saved = repository.save(entity);
        eventPublisher.publish(new TrackingUpdatedEvent(saved.getId()));
        return toDto(saved);
    }

    @Override
    public BusLocationDto get(Long id) {
        return toDto(repository.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("BusLocation not found")));
    }

    @Override
    public List<BusLocationDto> getAll() {
        return repository.findAll().stream().map(this::toDto).toList();
    }

    @Override
    public BusLocationDto update(Long id, BusLocationDto dto) {
        BusLocation entity = repository.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("BusLocation not found"));
        entity.setName(dto.getName());
        BusLocation saved = repository.save(entity);
        eventPublisher.publish(new TrackingUpdatedEvent(saved.getId()));
        return toDto(saved);
    }

    @Override
    public void delete(Long id) {
        repository.deleteById(id);
    }

    private BusLocationDto toDto(BusLocation entity) {
        BusLocationDto dto = new BusLocationDto();
        dto.setId(entity.getId());
        dto.setName(entity.getName());
        return dto;
    }
}
""")

add("tracking-module/src/main/java/com/trackngo/tracking/internal/service/RouteServiceImpl.java", """
package com.trackngo.tracking.internal.service;

import com.trackngo.commons.exception.ResourceNotFoundException;
import com.trackngo.tracking.api.RouteService;
import com.trackngo.tracking.api.dto.RouteDto;
import com.trackngo.tracking.internal.entity.Route;
import com.trackngo.tracking.internal.repository.RouteRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
public class RouteServiceImpl implements RouteService {
    private final RouteRepository repository;

    @Override
    public RouteDto create(RouteDto dto) {
        Route entity = new Route();
        entity.setName(dto.getName());
        return toDto(repository.save(entity));
    }

    @Override
    public RouteDto get(Long id) {
        return toDto(repository.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("Route not found")));
    }

    @Override
    public List<RouteDto> getAll() {
        return repository.findAll().stream().map(this::toDto).toList();
    }

    @Override
    public RouteDto update(Long id, RouteDto dto) {
        Route entity = repository.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("Route not found"));
        entity.setName(dto.getName());
        return toDto(repository.save(entity));
    }

    @Override
    public void delete(Long id) {
        repository.deleteById(id);
    }

    private RouteDto toDto(Route entity) {
        RouteDto dto = new RouteDto();
        dto.setId(entity.getId());
        dto.setName(entity.getName());
        return dto;
    }
}
""")

add("tracking-module/src/main/java/com/trackngo/tracking/internal/controller/BusLocationController.java", """
package com.trackngo.tracking.internal.controller;

import com.trackngo.commons.ApiResponse;
import com.trackngo.tracking.api.BusLocationService;
import com.trackngo.tracking.api.dto.BusLocationDto;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/bus-locations")
@RequiredArgsConstructor
public class BusLocationController {
    private final BusLocationService service;

    @PostMapping
    public ApiResponse<BusLocationDto> create(@Valid @RequestBody BusLocationDto dto) {
        return ApiResponse.ok("Created", service.create(dto));
    }

    @GetMapping("/{id}")
    public ApiResponse<BusLocationDto> get(@PathVariable Long id) {
        return ApiResponse.ok("Fetched", service.get(id));
    }

    @GetMapping
    public ApiResponse<List<BusLocationDto>> getAll() {
        return ApiResponse.ok("Fetched", service.getAll());
    }

    @PutMapping("/{id}")
    public ApiResponse<BusLocationDto> update(@PathVariable Long id, @Valid @RequestBody BusLocationDto dto) {
        return ApiResponse.ok("Updated", service.update(id, dto));
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(@PathVariable Long id) {
        service.delete(id);
        return ApiResponse.ok("Deleted", null);
    }
}
""")

add("tracking-module/src/main/java/com/trackngo/tracking/internal/controller/RouteController.java", """
package com.trackngo.tracking.internal.controller;

import com.trackngo.commons.ApiResponse;
import com.trackngo.tracking.api.RouteService;
import com.trackngo.tracking.api.dto.RouteDto;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/routes")
@RequiredArgsConstructor
public class RouteController {
    private final RouteService service;

    @PostMapping
    public ApiResponse<RouteDto> create(@Valid @RequestBody RouteDto dto) {
        return ApiResponse.ok("Created", service.create(dto));
    }

    @GetMapping("/{id}")
    public ApiResponse<RouteDto> get(@PathVariable Long id) {
        return ApiResponse.ok("Fetched", service.get(id));
    }

    @GetMapping
    public ApiResponse<List<RouteDto>> getAll() {
        return ApiResponse.ok("Fetched", service.getAll());
    }

    @PutMapping("/{id}")
    public ApiResponse<RouteDto> update(@PathVariable Long id, @Valid @RequestBody RouteDto dto) {
        return ApiResponse.ok("Updated", service.update(id, dto));
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(@PathVariable Long id) {
        service.delete(id);
        return ApiResponse.ok("Deleted", null);
    }
}
""")

add("tracking-module/src/main/java/com/trackngo/tracking/internal/websocket/TrackingWebSocketHandler.java", """
package com.trackngo.tracking.internal.websocket;

import org.springframework.stereotype.Component;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

@Component
public class TrackingWebSocketHandler extends TextWebSocketHandler {
    private final Set<WebSocketSession> sessions = ConcurrentHashMap.newKeySet();

    @Override
    public void afterConnectionEstablished(WebSocketSession session) {
        sessions.add(session);
    }

    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) throws Exception {
        for (WebSocketSession s : sessions) {
            if (s.isOpen()) {
                s.sendMessage(message);
            }
        }
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, org.springframework.web.socket.CloseStatus status) {
        sessions.remove(session);
    }
}
""")
# chat module
add("chat-module/src/main/java/com/trackngo/chat/api/dto/MessageDto.java", """
package com.trackngo.chat.api.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class MessageDto {
    private Long id;
    @NotBlank
    private String name;
}
""")

add("chat-module/src/main/java/com/trackngo/chat/api/dto/ConversationDto.java", """
package com.trackngo.chat.api.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class ConversationDto {
    private Long id;
    @NotBlank
    private String name;
}
""")

add("chat-module/src/main/java/com/trackngo/chat/api/MessageService.java", """
package com.trackngo.chat.api;

import com.trackngo.chat.api.dto.MessageDto;

import java.util.List;

public interface MessageService {
    MessageDto create(MessageDto dto);
    MessageDto get(Long id);
    List<MessageDto> getAll();
    MessageDto update(Long id, MessageDto dto);
    void delete(Long id);
}
""")

add("chat-module/src/main/java/com/trackngo/chat/api/ConversationService.java", """
package com.trackngo.chat.api;

import com.trackngo.chat.api.dto.ConversationDto;

import java.util.List;

public interface ConversationService {
    ConversationDto create(ConversationDto dto);
    ConversationDto get(Long id);
    List<ConversationDto> getAll();
    ConversationDto update(Long id, ConversationDto dto);
    void delete(Long id);
}
""")

add("chat-module/src/main/java/com/trackngo/chat/events/MessageCreatedEvent.java", """
package com.trackngo.chat.events;

import com.trackngo.commons.events.BaseEvent;
import lombok.AllArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor
public class MessageCreatedEvent extends BaseEvent {
    private final Long id;
}
""")

add("chat-module/src/main/java/com/trackngo/chat/internal/entity/Message.java", """
package com.trackngo.chat.internal.entity;

import jakarta.persistence.*;
import lombok.Data;

@Entity
@Data
@Table(name = "messages")
public class Message {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String name;
}
""")

add("chat-module/src/main/java/com/trackngo/chat/internal/entity/Conversation.java", """
package com.trackngo.chat.internal.entity;

import jakarta.persistence.*;
import lombok.Data;

@Entity
@Data
@Table(name = "conversations")
public class Conversation {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String name;
}
""")

add("chat-module/src/main/java/com/trackngo/chat/internal/repository/MessageRepository.java", """
package com.trackngo.chat.internal.repository;

import com.trackngo.chat.internal.entity.Message;
import org.springframework.data.jpa.repository.JpaRepository;

public interface MessageRepository extends JpaRepository<Message, Long> {
}
""")

add("chat-module/src/main/java/com/trackngo/chat/internal/repository/ConversationRepository.java", """
package com.trackngo.chat.internal.repository;

import com.trackngo.chat.internal.entity.Conversation;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ConversationRepository extends JpaRepository<Conversation, Long> {
}
""")

add("chat-module/src/main/java/com/trackngo/chat/internal/service/MessageServiceImpl.java", """
package com.trackngo.chat.internal.service;

import com.trackngo.chat.api.MessageService;
import com.trackngo.chat.api.dto.MessageDto;
import com.trackngo.chat.events.MessageCreatedEvent;
import com.trackngo.chat.internal.entity.Message;
import com.trackngo.chat.internal.repository.MessageRepository;
import com.trackngo.commons.events.EventPublisher;
import com.trackngo.commons.exception.ResourceNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
public class MessageServiceImpl implements MessageService {
    private final MessageRepository repository;
    private final EventPublisher eventPublisher;

    @Override
    public MessageDto create(MessageDto dto) {
        Message entity = new Message();
        entity.setName(dto.getName());
        Message saved = repository.save(entity);
        eventPublisher.publish(new MessageCreatedEvent(saved.getId()));
        return toDto(saved);
    }

    @Override
    public MessageDto get(Long id) {
        return toDto(repository.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("Message not found")));
    }

    @Override
    public List<MessageDto> getAll() {
        return repository.findAll().stream().map(this::toDto).toList();
    }

    @Override
    public MessageDto update(Long id, MessageDto dto) {
        Message entity = repository.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("Message not found"));
        entity.setName(dto.getName());
        return toDto(repository.save(entity));
    }

    @Override
    public void delete(Long id) {
        repository.deleteById(id);
    }

    private MessageDto toDto(Message entity) {
        MessageDto dto = new MessageDto();
        dto.setId(entity.getId());
        dto.setName(entity.getName());
        return dto;
    }
}
""")

add("chat-module/src/main/java/com/trackngo/chat/internal/service/ConversationServiceImpl.java", """
package com.trackngo.chat.internal.service;

import com.trackngo.chat.api.ConversationService;
import com.trackngo.chat.api.dto.ConversationDto;
import com.trackngo.chat.internal.entity.Conversation;
import com.trackngo.chat.internal.repository.ConversationRepository;
import com.trackngo.commons.exception.ResourceNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
public class ConversationServiceImpl implements ConversationService {
    private final ConversationRepository repository;

    @Override
    public ConversationDto create(ConversationDto dto) {
        Conversation entity = new Conversation();
        entity.setName(dto.getName());
        return toDto(repository.save(entity));
    }

    @Override
    public ConversationDto get(Long id) {
        return toDto(repository.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("Conversation not found")));
    }

    @Override
    public List<ConversationDto> getAll() {
        return repository.findAll().stream().map(this::toDto).toList();
    }

    @Override
    public ConversationDto update(Long id, ConversationDto dto) {
        Conversation entity = repository.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("Conversation not found"));
        entity.setName(dto.getName());
        return toDto(repository.save(entity));
    }

    @Override
    public void delete(Long id) {
        repository.deleteById(id);
    }

    private ConversationDto toDto(Conversation entity) {
        ConversationDto dto = new ConversationDto();
        dto.setId(entity.getId());
        dto.setName(entity.getName());
        return dto;
    }
}
""")

add("chat-module/src/main/java/com/trackngo/chat/internal/controller/MessageController.java", """
package com.trackngo.chat.internal.controller;

import com.trackngo.chat.api.MessageService;
import com.trackngo.chat.api.dto.MessageDto;
import com.trackngo.commons.ApiResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/messages")
@RequiredArgsConstructor
public class MessageController {
    private final MessageService service;

    @PostMapping
    public ApiResponse<MessageDto> create(@Valid @RequestBody MessageDto dto) {
        return ApiResponse.ok("Created", service.create(dto));
    }

    @GetMapping("/{id}")
    public ApiResponse<MessageDto> get(@PathVariable Long id) {
        return ApiResponse.ok("Fetched", service.get(id));
    }

    @GetMapping
    public ApiResponse<List<MessageDto>> getAll() {
        return ApiResponse.ok("Fetched", service.getAll());
    }

    @PutMapping("/{id}")
    public ApiResponse<MessageDto> update(@PathVariable Long id, @Valid @RequestBody MessageDto dto) {
        return ApiResponse.ok("Updated", service.update(id, dto));
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(@PathVariable Long id) {
        service.delete(id);
        return ApiResponse.ok("Deleted", null);
    }
}
""")

add("chat-module/src/main/java/com/trackngo/chat/internal/controller/ConversationController.java", """
package com.trackngo.chat.internal.controller;

import com.trackngo.chat.api.ConversationService;
import com.trackngo.chat.api.dto.ConversationDto;
import com.trackngo.commons.ApiResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/conversations")
@RequiredArgsConstructor
public class ConversationController {
    private final ConversationService service;

    @PostMapping
    public ApiResponse<ConversationDto> create(@Valid @RequestBody ConversationDto dto) {
        return ApiResponse.ok("Created", service.create(dto));
    }

    @GetMapping("/{id}")
    public ApiResponse<ConversationDto> get(@PathVariable Long id) {
        return ApiResponse.ok("Fetched", service.get(id));
    }

    @GetMapping
    public ApiResponse<List<ConversationDto>> getAll() {
        return ApiResponse.ok("Fetched", service.getAll());
    }

    @PutMapping("/{id}")
    public ApiResponse<ConversationDto> update(@PathVariable Long id, @Valid @RequestBody ConversationDto dto) {
        return ApiResponse.ok("Updated", service.update(id, dto));
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(@PathVariable Long id) {
        service.delete(id);
        return ApiResponse.ok("Deleted", null);
    }
}
""")

add("chat-module/src/main/java/com/trackngo/chat/internal/websocket/ChatWebSocketHandler.java", """
package com.trackngo.chat.internal.websocket;

import org.springframework.stereotype.Component;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

@Component
public class ChatWebSocketHandler extends TextWebSocketHandler {
    private final Set<WebSocketSession> sessions = ConcurrentHashMap.newKeySet();

    @Override
    public void afterConnectionEstablished(WebSocketSession session) {
        sessions.add(session);
    }

    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) throws Exception {
        for (WebSocketSession s : sessions) {
            if (s.isOpen()) {
                s.sendMessage(message);
            }
        }
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, org.springframework.web.socket.CloseStatus status) {
        sessions.remove(session);
    }
}
""")
# booking event + override impl
add("booking-module/src/main/java/com/trackngo/booking/events/BookingCreatedEvent.java", """
package com.trackngo.booking.events;

import com.trackngo.commons.events.BaseEvent;
import lombok.AllArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor
public class BookingCreatedEvent extends BaseEvent {
    private final Long id;
}
""")

add("booking-module/src/main/java/com/trackngo/booking/internal/service/BookingServiceImpl.java", """
package com.trackngo.booking.internal.service;

import com.trackngo.booking.api.BookingService;
import com.trackngo.booking.api.dto.BookingDto;
import com.trackngo.booking.events.BookingCreatedEvent;
import com.trackngo.booking.internal.entity.Booking;
import com.trackngo.booking.internal.repository.BookingRepository;
import com.trackngo.commons.events.EventPublisher;
import com.trackngo.commons.exception.ResourceNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
public class BookingServiceImpl implements BookingService {
    private final BookingRepository repository;
    private final EventPublisher eventPublisher;

    @Override
    public BookingDto create(BookingDto dto) {
        Booking entity = new Booking();
        entity.setName(dto.getName());
        Booking saved = repository.save(entity);
        eventPublisher.publish(new BookingCreatedEvent(saved.getId()));
        return toDto(saved);
    }

    @Override
    public BookingDto get(Long id) {
        return toDto(repository.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("Booking not found")));
    }

    @Override
    public List<BookingDto> getAll() {
        return repository.findAll().stream().map(this::toDto).toList();
    }

    @Override
    public BookingDto update(Long id, BookingDto dto) {
        Booking entity = repository.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("Booking not found"));
        entity.setName(dto.getName());
        return toDto(repository.save(entity));
    }

    @Override
    public void delete(Long id) {
        repository.deleteById(id);
    }

    private BookingDto toDto(Booking entity) {
        BookingDto dto = new BookingDto();
        dto.setId(entity.getId());
        dto.setName(entity.getName());
        return dto;
    }
}
""")

# write all files
for rel_path, content in files.items():
    path = root / rel_path
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")

print(f"Wrote {len(files)} files to {root}")
