-- =============================================
-- TRACKNGO DATABASE - COMPLETE SCHEMA
-- =============================================

DROP DATABASE IF EXISTS trackngo;
CREATE DATABASE IF NOT EXISTS trackngo;
USE trackngo;

-- =============================================
-- LEVEL 0: CORE USER TABLE
-- Common auth + profile columns for every user type
-- =============================================

CREATE TABLE user (
    user_id BIGINT PRIMARY KEY AUTO_INCREMENT,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL COMMENT 'Hashed password (bcrypt)',
    user_type ENUM('passenger', 'driver', 'corporate', 'admin') NOT NULL,
    is_email_verified BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    language_preference ENUM('en', 'si') DEFAULT 'en',
    theme_preference ENUM('light', 'dark', 'auto') DEFAULT 'light',
    last_login TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_email (email),
    INDEX idx_user_type (user_type)
);


-- =============================================
-- LEVEL 1: INDEPENDENT TABLES
-- Each table stores only fields unique to that user type.
-- Primary key equals user.user_id to enforce 1:1 mapping.
-- =============================================

CREATE TABLE admin (
    admin_id BIGINT PRIMARY KEY,
    phone_number VARCHAR(20) UNIQUE NOT NULL,
    `role` ENUM('super_admin', 'moderator') DEFAULT 'moderator',
    status ENUM('active', 'inactive') DEFAULT 'active',

    FOREIGN KEY (admin_id) REFERENCES user(user_id) ON DELETE CASCADE,
    INDEX idx_role (role)
);

CREATE TABLE passenger (
    passenger_id BIGINT PRIMARY KEY,
    profile_photo TEXT,
    mobile_number VARCHAR(20) UNIQUE NOT NULL,
    is_phone_verified BOOLEAN DEFAULT false,
    status ENUM('active', 'inactive', 'suspended') DEFAULT 'active',

    FOREIGN KEY (passenger_id) REFERENCES user(user_id) ON DELETE CASCADE,
    INDEX idx_mobile (mobile_number),
    INDEX idx_status (status)
);

CREATE TABLE corporate_user (
    corporate_user_id BIGINT PRIMARY KEY,
    address TEXT NOT NULL,
    company_name VARCHAR(255) NOT NULL,
    profile_photo TEXT,
    contact_person_name VARCHAR(255) NOT NULL,
    contact_phone VARCHAR(20) NOT NULL,
    contact_person_designation VARCHAR(100),
    status ENUM('active', 'inactive', 'pending_verification', 'suspended') DEFAULT 'pending_verification',
    business_registration_number VARCHAR(100) UNIQUE NOT NULL,
    industry VARCHAR(100),

    FOREIGN KEY (corporate_user_id) REFERENCES user(user_id) ON DELETE CASCADE,
    INDEX idx_status (status),
    INDEX idx_registration (business_registration_number)
);

CREATE TABLE driver (
    driver_id BIGINT PRIMARY KEY,
    licence_expiry DATE NOT NULL,
    years_of_experience INT DEFAULT 0,
    profile_photo TEXT,
    account_number VARCHAR(50),
    phone_number VARCHAR(20) UNIQUE NOT NULL,
    is_phone_verified BOOLEAN DEFAULT false,
    license_number VARCHAR(50) UNIQUE NOT NULL,
    driver_earnings DECIMAL(10, 2) DEFAULT 0.00,
    status ENUM('active', 'inactive', 'on_leave', 'suspended') DEFAULT 'active',
    is_verified BOOLEAN DEFAULT false,
    average_rating DECIMAL(3, 2) DEFAULT 0.00,
    joined_date DATE,

    FOREIGN KEY (driver_id) REFERENCES user(user_id) ON DELETE CASCADE,
    INDEX idx_phone (phone_number),
    INDEX idx_license (license_number),
    INDEX idx_status (status),
    INDEX idx_verified (is_verified)
);

CREATE TABLE route (
    route_id BIGINT PRIMARY KEY AUTO_INCREMENT,
    route_name VARCHAR(255) NOT NULL,
    start_location VARCHAR(255) NOT NULL,
    end_location VARCHAR(255) NOT NULL,
    est_distance_difference DECIMAL(10, 2),
    estimated_time_duration INT,
    fee DECIMAL(10, 2),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_active (is_active),
    INDEX idx_locations (start_location, end_location)
);


-- =============================================
-- LEVEL 2: DEPENDENT ON LEVEL 1
-- =============================================

CREATE TABLE route_stop (
    route_id BIGINT NOT NULL,
    name VARCHAR(255) NOT NULL,
    priority INT NOT NULL,
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    distance_from_start DECIMAL(10, 2),
    estimated_arrival_mins INT,

    PRIMARY KEY (route_id, priority),
    FOREIGN KEY (route_id) REFERENCES route(route_id) ON DELETE CASCADE,
    INDEX idx_name (name),
    UNIQUE KEY unique_route_name (route_id, name)
);

CREATE TABLE bus (
    bus_id BIGINT PRIMARY KEY AUTO_INCREMENT,
    bus_number VARCHAR(50) UNIQUE NOT NULL,
    bus_brand VARCHAR(100),
    start_time TIME,
    end_time TIME,
    registration_number VARCHAR(50) UNIQUE NOT NULL,
    amenities JSON,
    seat_capacity INT NOT NULL,
    bus_condition ENUM('excellent', 'good', 'fair', 'needs_maintenance') DEFAULT 'good',
    bus_type ENUM('highway', 'long_distance', 'trip_booking', 'corporate') NOT NULL,
    status ENUM('active', 'maintenance', 'inactive') DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    insurance_exp_date DATE NOT NULL,
    driver_id BIGINT,
    route_id BIGINT,

    FOREIGN KEY (driver_id) REFERENCES driver(driver_id) ON DELETE SET NULL,
    FOREIGN KEY (route_id) REFERENCES route(route_id) ON DELETE SET NULL,
    INDEX idx_driver (driver_id),
    INDEX idx_route (route_id),
    INDEX idx_type_status (bus_type, status),
    INDEX idx_insurance (insurance_exp_date)
);

CREATE TABLE emergency_numbers (
    emergency_id    BIGINT PRIMARY KEY AUTO_INCREMENT,
    label           VARCHAR(100) NOT NULL COMMENT 'e.g., Sri Lanka National, Western Province',
    fire_brigade    VARCHAR(20)  NOT NULL,
    ambulance       VARCHAR(20)  NOT NULL,
    police          VARCHAR(20)  NOT NULL,
    help_center     VARCHAR(20)  NOT NULL COMMENT 'TrackNgo internal help line',
    is_active       BOOLEAN      DEFAULT true,
    created_at      TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
 
    INDEX idx_active (is_active)
);

CREATE TABLE sos_alert (
    sos_id          BIGINT PRIMARY KEY AUTO_INCREMENT,
    shared_location VARCHAR(255) COMMENT 'GPS coordinates at time of trigger',
    audio_recorded  TEXT         COMMENT 'URL to recorded audio clip',
    status          ENUM('triggered', 'acknowledged', 'resolved', 'false_alarm') DEFAULT 'triggered',
    triggered_at    TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    resolved_at     TIMESTAMP    NULL,
 
    passenger_id    BIGINT       NULL COMMENT 'Set if triggered by passenger',
    driver_id       BIGINT       NULL COMMENT 'Set if triggered by driver',
    admin_id        BIGINT       NULL COMMENT 'Admin who acknowledged/resolved',
 
    FOREIGN KEY (passenger_id) REFERENCES passenger(passenger_id) ON DELETE CASCADE,
    FOREIGN KEY (driver_id)    REFERENCES driver(driver_id)       ON DELETE CASCADE,
    FOREIGN KEY (admin_id)     REFERENCES admin(admin_id)         ON DELETE SET NULL,
 
    CONSTRAINT chk_sos_triggered_by CHECK (
        passenger_id IS NOT NULL OR driver_id IS NOT NULL
    ),
 
    INDEX idx_passenger  (passenger_id, status),
    INDEX idx_driver     (driver_id, status),
    INDEX idx_admin      (admin_id),
    INDEX idx_status     (status),
    INDEX idx_triggered  (triggered_at DESC)
);

CREATE TABLE emergency_contact (
    contact_id      BIGINT       PRIMARY KEY AUTO_INCREMENT,
    owner_type      ENUM('passenger', 'driver') NOT NULL,
    owner_id        BIGINT       NOT NULL COMMENT 'passenger_id or driver_id depending on owner_type',
    name            VARCHAR(100) NOT NULL,
    tele_number     VARCHAR(20)  NOT NULL,
    relationship    VARCHAR(50)  COMMENT 'e.g., Mother, Spouse, Friend',
    created_at      TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
 
    UNIQUE KEY unique_owner_contact (owner_type, owner_id, tele_number),
 
    INDEX idx_owner  (owner_id, owner_type)
);

CREATE TABLE notification (
    notification_id BIGINT PRIMARY KEY AUTO_INCREMENT,
    notification_type ENUM('booking_confirmation', 'journey_reminder', 'payment_success', 'cancellation', 'rating_request', 'complaint_update', 'promotion', 'system_alert', 'sos_alert') NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    passenger_id BIGINT,
    corporate_user_id BIGINT,
    driver_id BIGINT,
    admin_id BIGINT,

    FOREIGN KEY (passenger_id) REFERENCES passenger(passenger_id) ON DELETE CASCADE,
    FOREIGN KEY (corporate_user_id) REFERENCES corporate_user(corporate_user_id) ON DELETE CASCADE,
    FOREIGN KEY (driver_id) REFERENCES driver(driver_id) ON DELETE CASCADE,
    FOREIGN KEY (admin_id) REFERENCES admin(admin_id) ON DELETE CASCADE,
    INDEX idx_passenger (passenger_id, is_read),
    INDEX idx_corporate (corporate_user_id, is_read),
    INDEX idx_driver (driver_id, is_read),
    INDEX idx_admin (admin_id, is_read),
    INDEX idx_created (created_at DESC),

    CONSTRAINT chk_notification_user CHECK (
        passenger_id IS NOT NULL OR
        corporate_user_id IS NOT NULL OR
        driver_id IS NOT NULL OR
        admin_id IS NOT NULL
    )
);

CREATE TABLE conversation (
    conversation_id BIGINT PRIMARY KEY AUTO_INCREMENT,
    participant_1_id BIGINT NOT NULL,
    participant_1_type ENUM('passenger', 'driver', 'admin', 'corporate') NOT NULL,
    participant_2_id BIGINT NOT NULL,
    participant_2_type ENUM('passenger', 'driver', 'admin', 'corporate') NOT NULL,
    participant_1_unread INT DEFAULT 0,
    participant_2_unread INT DEFAULT 0,
    last_message TEXT,
    last_message_timestamp TIMESTAMP NULL,
    -- generated columns to support symmetric uniqueness in MySQL without functional index
    participant_min_id BIGINT AS (LEAST(participant_1_id, participant_2_id)) STORED,
    participant_max_id BIGINT AS (GREATEST(participant_1_id, participant_2_id)) STORED,
    participant_min_type ENUM('passenger', 'driver', 'admin', 'corporate') AS (LEAST(participant_1_type, participant_2_type)) STORED,
    participant_max_type ENUM('passenger', 'driver', 'admin', 'corporate') AS (GREATEST(participant_1_type, participant_2_type)) STORED,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    INDEX idx_participant_1 (participant_1_id, participant_1_type),
    INDEX idx_participant_2 (participant_2_id, participant_2_type),
    INDEX idx_updated (updated_at DESC),
    UNIQUE KEY unique_participants (
        participant_min_id,
        participant_min_type,
        participant_max_id,
        participant_max_type
    )
);

CREATE TABLE complaint (
    complaint_id BIGINT PRIMARY KEY AUTO_INCREMENT,
    image TEXT,
    complaint_type ENUM('driver_behavior', 'bus_condition', 'route_issue', 'payment_issue', 'booking_issue', 'safety_concern', 'other') NOT NULL,
    priority ENUM('low', 'medium', 'high', 'urgent') DEFAULT 'medium',
    description TEXT NOT NULL,
    status ENUM('pending', 'under_review', 'resolved', 'closed', 'rejected') DEFAULT 'pending',
    admin_response TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMP NULL,
    passenger_id BIGINT,
    driver_id BIGINT,
    corporate_user_id BIGINT,
    assigned_to_admin_id BIGINT,

    FOREIGN KEY (passenger_id) REFERENCES passenger(passenger_id) ON DELETE CASCADE,
    FOREIGN KEY (driver_id) REFERENCES driver(driver_id) ON DELETE CASCADE,
    FOREIGN KEY (corporate_user_id) REFERENCES corporate_user(corporate_user_id) ON DELETE CASCADE,
    FOREIGN KEY (assigned_to_admin_id) REFERENCES admin(admin_id) ON DELETE SET NULL,
    INDEX idx_passenger (passenger_id, status),
    INDEX idx_driver (driver_id, status),
    INDEX idx_corporate (corporate_user_id, status),
    INDEX idx_status_priority (status, priority),
    INDEX idx_type (complaint_type),
    INDEX idx_created (created_at DESC),

    CONSTRAINT chk_complaint_user CHECK (
        passenger_id IS NOT NULL OR
        driver_id IS NOT NULL OR
        corporate_user_id IS NOT NULL
    )
);

CREATE TABLE otp_verification (
    otp_id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id BIGINT NOT NULL,
    phone_number VARCHAR(20) NOT NULL,
    email VARCHAR(255),
    otp_code VARCHAR(6) NOT NULL,
    otp_type ENUM('registration', 'login', 'password_reset', 'phone_verification', 'transaction') NOT NULL,
    is_verified BOOLEAN DEFAULT false,
    attempts INT DEFAULT 0,
    expires_at TIMESTAMP NOT NULL,
    verified_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (user_id) REFERENCES user(user_id) ON DELETE CASCADE,
    INDEX idx_user (user_id),
    INDEX idx_phone (phone_number, otp_type),
    INDEX idx_email (email, otp_type),
    INDEX idx_expires (expires_at),
    INDEX idx_created (created_at DESC)
);

CREATE TABLE social_login (
    social_login_id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id BIGINT NOT NULL,
    provider ENUM('google', 'facebook', 'apple') NOT NULL,
    provider_user_id VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    profile_photo_url TEXT,
    access_token TEXT,
    refresh_token TEXT,
    token_expires_at TIMESTAMP NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP NULL,

    FOREIGN KEY (user_id) REFERENCES user(user_id) ON DELETE CASCADE,
    INDEX idx_user (user_id),
    INDEX idx_provider (provider, provider_user_id),
    INDEX idx_email (email),
    UNIQUE KEY unique_social_account (provider, provider_user_id)
);


-- =============================================
-- LEVEL 3: DEPENDENT ON LEVEL 2
-- =============================================

CREATE TABLE trip_booking (
    trip_booking_id BIGINT PRIMARY KEY AUTO_INCREMENT,
    passenger_count INT NOT NULL DEFAULT 1,
    advance_payment DECIMAL(10, 2),
    start_location VARCHAR(255) NOT NULL,
    destination VARCHAR(255) NOT NULL,
    start_date DATE NOT NULL,
    return_date DATE,
    final_price DECIMAL(10, 2),
    booking_status ENUM('pending', 'confirmed', 'in_progress', 'completed', 'cancelled') DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    passenger_id BIGINT NOT NULL,
    driver_id BIGINT,
    bus_id BIGINT,

    FOREIGN KEY (passenger_id) REFERENCES passenger(passenger_id) ON DELETE CASCADE,
    FOREIGN KEY (driver_id) REFERENCES driver(driver_id) ON DELETE SET NULL,
    FOREIGN KEY (bus_id) REFERENCES bus(bus_id) ON DELETE SET NULL,
    INDEX idx_passenger (passenger_id, booking_status),
    INDEX idx_driver (driver_id, booking_status),
    INDEX idx_bus (bus_id),
    INDEX idx_start_date (start_date),
    INDEX idx_status (booking_status),
    INDEX idx_created (created_at DESC)
);

CREATE TABLE chat_message (
    message_id BIGINT PRIMARY KEY AUTO_INCREMENT,
    conversation_id BIGINT NOT NULL,
    sender_id BIGINT NOT NULL,
    sender_type ENUM('passenger', 'driver', 'admin', 'corporate') NOT NULL,
    message_type ENUM('text', 'image', 'voice', 'location') DEFAULT 'text',
    content TEXT NOT NULL,
    media_url TEXT,
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    is_read BOOLEAN DEFAULT false,
    is_deleted BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (conversation_id) REFERENCES conversation(conversation_id) ON DELETE CASCADE,
    INDEX idx_conversation_time (conversation_id, created_at DESC),
    INDEX idx_sender (sender_id, sender_type),
    INDEX idx_unread (conversation_id, is_read)
);

CREATE TABLE corporate_contract (
    contract_id BIGINT PRIMARY KEY AUTO_INCREMENT,
    contract_name VARCHAR(255) NOT NULL,
    starting_location VARCHAR(255) NOT NULL,
    destination VARCHAR(255) NOT NULL,
    start_shift_time TIME NOT NULL,
    end_shift_time TIME NOT NULL,
    status ENUM('pending', 'active', 'expired', 'cancelled') DEFAULT 'pending',
    billing_amount DECIMAL(10, 2) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    corporate_user_id BIGINT NOT NULL,
    bus_id BIGINT,

    FOREIGN KEY (corporate_user_id) REFERENCES corporate_user(corporate_user_id) ON DELETE CASCADE,
    FOREIGN KEY (bus_id) REFERENCES bus(bus_id) ON DELETE SET NULL,
    INDEX idx_corporate_user (corporate_user_id, status),
    INDEX idx_status (status),
    INDEX idx_dates (start_date, end_date),
    INDEX idx_created (created_at DESC)
);


-- =============================================
-- LEVEL 4: DEPENDENT ON LEVEL 3
-- =============================================

CREATE TABLE payment (
    payment_id BIGINT PRIMARY KEY AUTO_INCREMENT,
    transaction_id VARCHAR(100) UNIQUE NOT NULL,
    payment_method ENUM('credit_card', 'debit_card', 'payhere', 'bank_transfer', 'cash') NOT NULL,
    payment_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    payment_status ENUM('pending', 'success', 'failed', 'refunded') DEFAULT 'pending',
    amount DECIMAL(10, 2) NOT NULL,
    trip_booking_id BIGINT,

    FOREIGN KEY (trip_booking_id) REFERENCES trip_booking(trip_booking_id) ON DELETE CASCADE,
    INDEX idx_trip_booking (trip_booking_id),
    INDEX idx_transaction (transaction_id),
    INDEX idx_status (payment_status),
    INDEX idx_date (payment_date DESC)
);

CREATE TABLE seat_booking (
    seat_booking_id BIGINT PRIMARY KEY AUTO_INCREMENT,
    booking_reference VARCHAR(50) UNIQUE NOT NULL,
    journey_date DATE NOT NULL,
    journey_time TIME NOT NULL,
    seat_number VARCHAR(255) NOT NULL,
    special_request TEXT,
    total_amount DECIMAL(10, 2) NOT NULL,
    status ENUM('confirmed', 'cancelled', 'completed') DEFAULT 'confirmed',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    passenger_id BIGINT NOT NULL,
    bus_id BIGINT NOT NULL,
    route_id BIGINT NOT NULL,
    payment_id BIGINT,

    FOREIGN KEY (passenger_id) REFERENCES passenger(passenger_id) ON DELETE CASCADE,
    FOREIGN KEY (bus_id) REFERENCES bus(bus_id) ON DELETE RESTRICT,
    FOREIGN KEY (route_id) REFERENCES route(route_id) ON DELETE RESTRICT,
    FOREIGN KEY (payment_id) REFERENCES payment(payment_id) ON DELETE SET NULL,
    INDEX idx_passenger (passenger_id, status),
    INDEX idx_bus_date (bus_id, journey_date),
    INDEX idx_route (route_id),
    INDEX idx_journey (journey_date, journey_time),
    INDEX idx_reference (booking_reference),
    INDEX idx_payment (payment_id)
);

CREATE TABLE rating (
    rating_id BIGINT PRIMARY KEY AUTO_INCREMENT,
    driver_rating INT CHECK (driver_rating >= 1 AND driver_rating <= 5),
    bus_condition_rating INT CHECK (bus_condition_rating >= 1 AND bus_condition_rating <= 5),
    journey_rating INT CHECK (journey_rating >= 1 AND journey_rating <= 5),
    review_text TEXT,
    image TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    trip_booking_id BIGINT,
    passenger_id BIGINT NOT NULL,
    bus_id BIGINT NOT NULL,
    driver_id BIGINT NOT NULL,

    FOREIGN KEY (trip_booking_id) REFERENCES trip_booking(trip_booking_id) ON DELETE CASCADE,
    FOREIGN KEY (passenger_id) REFERENCES passenger(passenger_id) ON DELETE CASCADE,
    FOREIGN KEY (bus_id) REFERENCES bus(bus_id) ON DELETE CASCADE,
    FOREIGN KEY (driver_id) REFERENCES driver(driver_id) ON DELETE CASCADE,
    INDEX idx_passenger (passenger_id),
    INDEX idx_driver (driver_id),
    INDEX idx_bus (bus_id),
    INDEX idx_trip_booking (trip_booking_id),
    INDEX idx_created (created_at DESC),
    UNIQUE KEY unique_trip_rating (trip_booking_id, passenger_id)
);

CREATE TABLE corporate_invoices (
    invoice_number BIGINT NOT NULL,
    contract_id BIGINT NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    status ENUM('pending', 'paid', 'overdue', 'cancelled') DEFAULT 'pending',
    date DATE NOT NULL,
    due_date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (contract_id, invoice_number),
    FOREIGN KEY (contract_id) REFERENCES corporate_contract(contract_id) ON DELETE CASCADE,
    INDEX idx_status (status),
    INDEX idx_date (date DESC),
    INDEX idx_due_date (due_date)
);


-- =============================================
-- LEVEL 5: DEPENDENT ON LEVEL 4
-- =============================================

CREATE TABLE refund (
    refund_id BIGINT PRIMARY KEY AUTO_INCREMENT,
    refund_reason TEXT NOT NULL,
    refund_status ENUM('pending', 'processed', 'rejected') DEFAULT 'pending',
    processed_date TIMESTAMP NULL,
    refund_amount DECIMAL(10, 2) NOT NULL,
    created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    payment_id BIGINT NOT NULL,

    FOREIGN KEY (payment_id) REFERENCES payment(payment_id) ON DELETE CASCADE,
    INDEX idx_payment (payment_id),
    INDEX idx_status (refund_status),
    INDEX idx_created (created_date DESC)
);