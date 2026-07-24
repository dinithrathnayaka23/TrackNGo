package com.trackngo.app.config;

import lombok.RequiredArgsConstructor;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class AiSchemaInitializer implements ApplicationRunner {
    private final JdbcTemplate jdbcTemplate;

    @Override
    public void run(ApplicationArguments args) {
        migrateOperationalTables();

        jdbcTemplate.execute("""
                CREATE TABLE IF NOT EXISTS ai_chat_message (
                    ai_chat_message_id BIGINT PRIMARY KEY AUTO_INCREMENT,
                    chat_id VARCHAR(120) NOT NULL,
                    user_id BIGINT NULL,
                    user_email VARCHAR(255) NULL,
                    role VARCHAR(30) NOT NULL,
                    content TEXT NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    INDEX idx_ai_chat_message_chat (chat_id, created_at),
                    INDEX idx_ai_chat_message_user (user_id, created_at)
                )
                """);

        jdbcTemplate.execute("""
                CREATE TABLE IF NOT EXISTS ai_agent_interaction (
                    ai_agent_interaction_id BIGINT PRIMARY KEY AUTO_INCREMENT,
                    chat_id VARCHAR(120) NOT NULL,
                    user_id BIGINT NULL,
                    user_email VARCHAR(255) NULL,
                    detected_intent VARCHAR(80) NULL,
                    status VARCHAR(40) NOT NULL,
                    latency_ms INT NULL,
                    model_name VARCHAR(120) NULL,
                    error_message TEXT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    INDEX idx_ai_agent_interaction_chat (chat_id, created_at),
                    INDEX idx_ai_agent_interaction_intent (detected_intent, status)
                )
                """);

        jdbcTemplate.execute("""
                CREATE TABLE IF NOT EXISTS ai_feedback (
                    ai_feedback_id BIGINT PRIMARY KEY AUTO_INCREMENT,
                    chat_id VARCHAR(120) NOT NULL,
                    ai_chat_message_id BIGINT NULL,
                    user_id BIGINT NULL,
                    rating TINYINT NOT NULL,
                    comment TEXT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    INDEX idx_ai_feedback_chat (chat_id),
                    INDEX idx_ai_feedback_user (user_id)
                )
                """);

        jdbcTemplate.execute("""
                CREATE TABLE IF NOT EXISTS ai_domain_knowledge (
                    ai_domain_knowledge_id BIGINT PRIMARY KEY AUTO_INCREMENT,
                    title VARCHAR(180) NOT NULL,
                    content TEXT NOT NULL,
                    tags VARCHAR(255) NOT NULL DEFAULT 'all',
                    priority INT NOT NULL DEFAULT 0,
                    active BOOLEAN NOT NULL DEFAULT TRUE,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    FULLTEXT KEY ft_ai_domain_knowledge (title, content),
                    INDEX idx_ai_domain_knowledge_active (active, priority)
                )
                """);

        seedKnowledge("TrackNGo Sri Lankan Route Network",
                "TrackNGo route search should prefer active Sri Lankan bus routes and stops saved in the database, including Colombo Fort, Kandy, Galle, Matara, Jaffna, Negombo, Kadawatha, Panadura, Kalutara, Hikkaduwa, Weligama, Kurunegala, Dambulla, Vavuniya, Kilinochchi, Peradeniya, Gampola, and Nuwara Eliya.",
                "all,routes,booking", 100);
        seedKnowledge("Booking Safety Rule",
                "The assistant must not invent booking references or payment confirmations. A booking is confirmed only when the booking tool returns a booking reference from the TrackNGo database transaction.",
                "all,booking,safety", 100);
        seedKnowledge("Sri Lankan Payment Language",
                "Use LKR for fares and mention PayHere, card, or TrackNGo counter payment only when the booking flow supports or requests it.",
                "all,payments,booking", 80);
        seedKnowledge("Passenger Delay Handling",
                "For late buses, combine live GPS ETA with alternative active buses on the same source and destination. Offer cancellation or rebooking only after confirming seat availability.",
                "all,eta,support", 90);
    }

    private void migrateOperationalTables() {
        addColumnIfMissing("bus", "return_start_time", "return_start_time TIME NULL");
        addColumnIfMissing("bus", "return_end_time", "return_end_time TIME NULL");
        jdbcTemplate.execute("""
                UPDATE bus b
                JOIN route r ON b.route_id = r.route_id
                SET b.return_start_time = COALESCE(
                    b.return_start_time,
                    ADDTIME(b.start_time, SEC_TO_TIME((COALESCE(r.estimated_time_duration, 0) + 45) * 60))
                )
                WHERE b.route_id IS NOT NULL
                  AND b.start_time IS NOT NULL
                """);
        jdbcTemplate.execute("""
                UPDATE bus b
                JOIN route r ON b.route_id = r.route_id
                SET b.return_end_time = COALESCE(
                    b.return_end_time,
                    ADDTIME(
                        COALESCE(
                            b.return_start_time,
                            ADDTIME(b.start_time, SEC_TO_TIME((COALESCE(r.estimated_time_duration, 0) + 45) * 60))
                        ),
                        SEC_TO_TIME(COALESCE(r.estimated_time_duration, 0) * 60)
                    )
                )
                WHERE b.route_id IS NOT NULL
                  AND b.start_time IS NOT NULL
                """);

        addColumnIfMissing("bus_locations", "bus_number", "bus_number VARCHAR(50) NULL");
        addColumnIfMissing("bus_locations", "latitude", "latitude DECIMAL(10, 8) NULL");
        addColumnIfMissing("bus_locations", "longitude", "longitude DECIMAL(11, 8) NULL");
        addColumnIfMissing("bus_locations", "heading", "heading DECIMAL(6, 2) NULL");
        addColumnIfMissing("bus_locations", "speed", "speed DECIMAL(6, 2) NULL");
        addColumnIfMissing("bus_locations", "recorded_at", "recorded_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP");
        jdbcTemplate.execute("""
                UPDATE bus_locations
                SET bus_number = COALESCE(bus_number, NULLIF(name, '')),
                    latitude = COALESCE(latitude, 7.29360),
                    longitude = COALESCE(longitude, 80.63500),
                    heading = COALESCE(heading, 45.00),
                    speed = COALESCE(speed, 32.00),
                    recorded_at = COALESCE(recorded_at, CURRENT_TIMESTAMP)
                WHERE bus_number IS NULL
                   OR latitude IS NULL
                   OR longitude IS NULL
                   OR speed IS NULL
                """);
        jdbcTemplate.execute("""
                INSERT INTO bus_locations (name, bus_number, latitude, longitude, heading, speed, recorded_at)
                SELECT b.bus_number, b.bus_number, 7.29360, 80.63500, 45.00, 28.00, CURRENT_TIMESTAMP
                FROM bus b
                WHERE b.bus_number = 'NB-0012'
                  AND NOT EXISTS (SELECT 1 FROM bus_locations bl WHERE bl.bus_number = b.bus_number)
                LIMIT 1
                """);
    }

    private void addColumnIfMissing(String tableName, String columnName, String columnDefinition) {
        Integer count = jdbcTemplate.queryForObject("""
                SELECT COUNT(*)
                FROM information_schema.columns
                WHERE table_schema = DATABASE()
                  AND table_name = ?
                  AND column_name = ?
                """, Integer.class, tableName, columnName);
        if (count != null && count > 0) {
            return;
        }
        jdbcTemplate.execute("ALTER TABLE " + tableName + " ADD COLUMN " + columnDefinition);
    }

    private void seedKnowledge(String title, String content, String tags, int priority) {
        Integer count = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM ai_domain_knowledge WHERE title = ?",
                Integer.class,
                title);
        if (count != null && count > 0) {
            return;
        }
        jdbcTemplate.update("""
                INSERT INTO ai_domain_knowledge (title, content, tags, priority, active)
                VALUES (?, ?, ?, ?, TRUE)
                """, title, content, tags, priority);
    }
}
