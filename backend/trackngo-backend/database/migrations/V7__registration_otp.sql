-- Adds the table backing the passenger/corporate self-registration email OTP
-- pipeline (auth-user-module RegistrationOtp / RegistrationOtpServiceImpl).
-- Unlike password_reset_otp this is keyed by email, not user_id, since the
-- account does not exist yet when the code is requested and verified.
-- ddl-auto=update will also create this table automatically, but it is
-- tracked here for parity with the other versioned migrations in this
-- directory and for environments that disable Hibernate DDL management.

CREATE TABLE IF NOT EXISTS registration_otp (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    email VARCHAR(254) NOT NULL,
    otp_hash VARCHAR(255) NOT NULL,
    verification_token VARCHAR(64) NULL,
    expires_at TIMESTAMP NOT NULL,
    verified_at TIMESTAMP NULL,
    consumed BOOLEAN NOT NULL DEFAULT FALSE,
    attempts INT NOT NULL DEFAULT 0,
    last_sent_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_registration_otp_email (email, consumed),
    INDEX idx_registration_otp_verification_token (verification_token)
);
