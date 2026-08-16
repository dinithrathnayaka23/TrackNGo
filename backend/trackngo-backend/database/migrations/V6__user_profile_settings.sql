CREATE TABLE IF NOT EXISTS user_settings (
    user_id BIGINT PRIMARY KEY,
    language_code VARCHAR(8) NOT NULL DEFAULT 'en',
    share_location BOOLEAN NOT NULL DEFAULT TRUE,
    two_factor_authentication BOOLEAN NOT NULL DEFAULT FALSE,
    push_notifications BOOLEAN NOT NULL DEFAULT TRUE,
    sms_alerts BOOLEAN NOT NULL DEFAULT FALSE,
    email_updates BOOLEAN NOT NULL DEFAULT TRUE,
    booking_updates BOOLEAN NOT NULL DEFAULT TRUE,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_user_settings_user FOREIGN KEY (user_id)
        REFERENCES `user`(user_id) ON DELETE CASCADE
);
