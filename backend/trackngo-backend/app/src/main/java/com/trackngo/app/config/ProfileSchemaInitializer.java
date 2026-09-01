package com.trackngo.app.config;

import lombok.RequiredArgsConstructor;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/** Adds profile fields needed by existing databases that predate admin profiles. */
@Component
@RequiredArgsConstructor
public class ProfileSchemaInitializer implements ApplicationRunner {

    private final JdbcTemplate jdbcTemplate;

    @Override
    public void run(ApplicationArguments args) {
        addColumnIfMissing("admin", "profile_photo", "TEXT NULL");
        addColumnIfMissing("driver", "bank_name", "VARCHAR(120) NULL");
        // UserProfileService joins corporate_user for every profile lookup,
        // including passenger accounts. Older databases that have not run
        // V21 therefore fail every profile request when these fields are absent.
        addColumnIfMissing("corporate_user", "website", "VARCHAR(255) NULL");
        addColumnIfMissing("corporate_user", "employee_count", "INT NULL");
    }

    private void addColumnIfMissing(String tableName, String columnName, String definition) {
        Integer count = jdbcTemplate.queryForObject("""
                SELECT COUNT(*)
                FROM INFORMATION_SCHEMA.COLUMNS
                WHERE TABLE_SCHEMA = DATABASE()
                  AND TABLE_NAME = ?
                  AND COLUMN_NAME = ?
                """, Integer.class, tableName, columnName);

        if (count == null || count > 0) {
            return;
        }

        jdbcTemplate.execute("ALTER TABLE `" + tableName + "` ADD COLUMN `" + columnName + "` " + definition);
    }
}
