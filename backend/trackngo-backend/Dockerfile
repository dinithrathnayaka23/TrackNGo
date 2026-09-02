# syntax=docker/dockerfile:1

# ---- Build stage --------------------------------------------------------
# Builds the whole multi-module Maven reactor (commons, auth-user-module,
# booking-module, ... , app) so the app module's inter-module dependencies
# resolve, then packages the Spring Boot fat jar.
FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /build

COPY . .

RUN mvn -B clean package -DskipTests

# ---- Runtime stage --------------------------------------------------------
# Non-Alpine JRE: the app renders profile-picture thumbnails via AWT/ImageIO
# (Thumbnails/Scalr), which wants a full glibc + fontconfig environment that
# Alpine's musl base doesn't reliably provide.
FROM eclipse-temurin:21-jre
WORKDIR /app

# Matches backend/trackngo-backend/app/target/app-1.0.0-SNAPSHOT.jar from the
# build stage above.
COPY --from=build /build/app/target/app-1.0.0-SNAPSHOT.jar app.jar

# Documents the default local port; Render supplies its own $PORT at runtime,
# which application.yml already reads via server.port: ${PORT:8080} — nothing
# in this image hardcodes a port.
EXPOSE 8080

ENTRYPOINT ["java", "-Djava.awt.headless=true", "-jar", "app.jar"]
