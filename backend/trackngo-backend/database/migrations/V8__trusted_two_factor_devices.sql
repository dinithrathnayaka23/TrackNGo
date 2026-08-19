CREATE TABLE IF NOT EXISTS trusted_two_factor_devices (
    device_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT NOT NULL,
    token_hash CHAR(64) NOT NULL UNIQUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_used_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NOT NULL,
    revoked_at TIMESTAMP NULL,
    CONSTRAINT fk_trusted_2fa_device_user FOREIGN KEY (user_id)
        REFERENCES `user`(user_id) ON DELETE CASCADE,
    INDEX idx_trusted_2fa_device_user (user_id),
    INDEX idx_trusted_2fa_device_lookup (user_id, token_hash)
);
