-- Adds email-based (non-authenticator) two-factor login for accounts that
-- enable it from their profile settings (currently the driver app), plus the
-- table backing the one-time codes emailed at login time.
-- Both are also self-healed at startup (UserSettingsService.ensureSchema /
-- AuthServiceImpl.ensureLoginOtpSchema), but are tracked here for parity with
-- the other versioned migrations in this directory.

-- No "IF NOT EXISTS" here: some MySQL builds in this project's dev environments
-- don't support it on ADD COLUMN. Drop this statement if the column already exists.
ALTER TABLE user_settings
    ADD COLUMN email_otp_login_enabled BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS login_otp (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id BIGINT NOT NULL,
    otp_hash VARCHAR(255) NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    consumed BOOLEAN NOT NULL DEFAULT FALSE,
    attempts INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_login_otp_user
        FOREIGN KEY (user_id) REFERENCES `user`(user_id) ON DELETE CASCADE,
    INDEX idx_login_otp_user (user_id, consumed)
);
