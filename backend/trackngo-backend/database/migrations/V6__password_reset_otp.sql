-- Adds the table backing the admin "forgot password" OTP pipeline
-- (auth-user-module PasswordResetOtp / PasswordResetServiceImpl).
-- ddl-auto=update will also create this table automatically, but it is
-- tracked here for parity with the other versioned migrations in this
-- directory and for environments that disable Hibernate DDL management.

CREATE TABLE IF NOT EXISTS password_reset_otp (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id BIGINT NOT NULL,
    channel VARCHAR(16) NOT NULL,
    destination VARCHAR(255) NOT NULL,
    otp_hash VARCHAR(255) NOT NULL,
    reset_token VARCHAR(64) NULL,
    expires_at TIMESTAMP NOT NULL,
    verified_at TIMESTAMP NULL,
    consumed BOOLEAN NOT NULL DEFAULT FALSE,
    attempts INT NOT NULL DEFAULT 0,
    last_sent_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_password_reset_otp_user
        FOREIGN KEY (user_id) REFERENCES `user`(user_id) ON DELETE CASCADE,
    INDEX idx_password_reset_otp_user (user_id, consumed),
    INDEX idx_password_reset_otp_reset_token (reset_token)
);
