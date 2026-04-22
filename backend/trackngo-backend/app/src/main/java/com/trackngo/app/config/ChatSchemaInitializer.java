package com.trackngo.app.config;

import lombok.RequiredArgsConstructor;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/**
 * Keeps older local databases compatible with the current chat module schema.
 * Hibernate schema update can be conservative with MySQL enum/text additions,
 * so these targeted checks make the admin/mobile chat features work after an
 * app restart without requiring a manual SQL import.
 */
@Component
@RequiredArgsConstructor
public class ChatSchemaInitializer implements ApplicationRunner {

    private final JdbcTemplate jdbcTemplate;

    @Override
    public void run(ApplicationArguments args) {
        addColumnIfMissing(
                "conversation",
                "last_message_type",
                "ENUM('text','image','voice','location','system') NULL");

        addColumnIfMissing("chat_message", "recipient_id", "BIGINT NULL");
        addColumnIfMissing("chat_message", "client_message_id", "VARCHAR(255) NULL");
        addColumnIfMissing("chat_message", "compressed_media_url", "TEXT NULL");
        addColumnIfMissing("chat_message", "file_name", "VARCHAR(255) NULL");
        addColumnIfMissing("chat_message", "media_mime_type", "VARCHAR(100) NULL");
        addColumnIfMissing("chat_message", "media_size_bytes", "BIGINT NULL");
        addColumnIfMissing("chat_message", "compressed_size_bytes", "BIGINT NULL");
        addColumnIfMissing("chat_message", "duration_seconds", "INT NULL");
        addColumnIfMissing("chat_message", "delivered_at", "TIMESTAMP NULL");
        addColumnIfMissing("chat_message", "read_at", "TIMESTAMP NULL");

        jdbcTemplate.update("""
                UPDATE conversation
                SET last_message_type = 'text'
                WHERE last_message_type IS NULL
                  AND last_message IS NOT NULL
                """);
    }

    private void addColumnIfMissing(String tableName, String columnName, String definition) {
        Integer count = jdbcTemplate.queryForObject("""
                SELECT COUNT(*)
                FROM INFORMATION_SCHEMA.COLUMNS
                WHERE TABLE_SCHEMA = DATABASE()
                  AND TABLE_NAME = ?
                  AND COLUMN_NAME = ?
                """, Integer.class, tableName, columnName);

        if (count != null && count > 0) {
            return;
        }

        jdbcTemplate.execute("ALTER TABLE `" + tableName + "` ADD COLUMN `" + columnName + "` " + definition);
    }
}
