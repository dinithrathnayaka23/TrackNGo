ALTER TABLE user_settings
    ADD COLUMN IF NOT EXISTS two_factor_secret VARCHAR(64) NULL,
    ADD COLUMN IF NOT EXISTS two_factor_pending_secret VARCHAR(64) NULL,
    ADD COLUMN IF NOT EXISTS two_factor_enabled_at TIMESTAMP NULL;
