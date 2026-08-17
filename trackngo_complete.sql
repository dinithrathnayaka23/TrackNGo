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

CREATE TABLE roles (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(255) NOT NULL UNIQUE
);

CREATE TABLE admin (
    admin_id BIGINT PRIMARY KEY,
    phone_number VARCHAR(20) UNIQUE NOT NULL,
    employee_id VARCHAR(20) UNIQUE,
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
    route_code VARCHAR(50) UNIQUE,
    route_type VARCHAR(50),
    start_location VARCHAR(255) NOT NULL,
    end_location VARCHAR(255) NOT NULL,
    est_distance_difference DECIMAL(10, 2),
    estimated_time_duration INT,
    fee DECIMAL(10, 2),
    active_buses INT DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_active (is_active),
    INDEX idx_locations (start_location, end_location),
    INDEX idx_route_code (route_code)
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
    return_start_time TIME,
    return_end_time TIME,
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

CREATE TABLE seat_layout (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    bus_id BIGINT NOT NULL,
    seat_label VARCHAR(10) NOT NULL,
    row_num INT NOT NULL,
    position_group VARCHAR(10) NOT NULL COMMENT 'left, right, back',
    position_index INT NOT NULL,
    blocked BOOLEAN NOT NULL DEFAULT FALSE,

    FOREIGN KEY (bus_id) REFERENCES bus(bus_id) ON DELETE CASCADE,
    UNIQUE KEY unique_bus_seat (bus_id, seat_label),
    INDEX idx_bus (bus_id)
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
    status          ENUM('triggered', 'resolved', 'false_alarm') DEFAULT 'triggered',
    triggered_at    TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    resolved_at     TIMESTAMP    NULL,
    passenger_id    BIGINT       NULL COMMENT 'Set if triggered by passenger',
    driver_id       BIGINT       NULL COMMENT 'Set if triggered by driver',
    bus_id          BIGINT       NULL COMMENT 'Bus identified at trigger time',
    bus_number      VARCHAR(255) NULL COMMENT 'Bus number captured at trigger time',
    start_location  VARCHAR(255) NULL COMMENT 'Journey start location at trigger time',
    end_location    VARCHAR(255) NULL COMMENT 'Journey end location at trigger time',
    admin_id        BIGINT       NULL COMMENT 'Admin who resolved',
    notify_emergency_contacts BOOLEAN DEFAULT false COMMENT 'Whether emergency contacts were notified',
 
    FOREIGN KEY (passenger_id) REFERENCES passenger(passenger_id) ON DELETE CASCADE,
    FOREIGN KEY (driver_id)    REFERENCES driver(driver_id)       ON DELETE CASCADE,
    FOREIGN KEY (bus_id)       REFERENCES bus(bus_id)             ON DELETE SET NULL,
    FOREIGN KEY (admin_id)     REFERENCES admin(admin_id)         ON DELETE SET NULL,
 
    CONSTRAINT chk_sos_triggered_by CHECK (
        passenger_id IS NOT NULL OR driver_id IS NOT NULL
    ),
 
    INDEX idx_passenger  (passenger_id, status),
    INDEX idx_driver     (driver_id, status),
    INDEX idx_bus        (bus_id),
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
    notification_type ENUM('booking', 'journey', 'payment', 'cancellation', 'rating', 'complaint', 'promotion', 'system_alert', 'sos') NOT NULL,
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
    last_message_type ENUM('text', 'image', 'voice', 'location', 'system') NULL,
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
    booking_reference VARCHAR(50),
    complaint_type ENUM('driver_behavior', 'bus_condition', 'route_issue', 'late_arrival', 'payment_issue', 'booking_issue', 'safety_concern', 'other') NOT NULL,
    priority ENUM('low', 'medium', 'high') DEFAULT 'medium',
    description TEXT NOT NULL,
    status ENUM('pending', 'under_review', 'resolved', 'rejected') DEFAULT 'pending',
    admin_response TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    resolved_at DATETIME NULL,
    passenger_id BIGINT,
    driver_id BIGINT,
    corporate_user_id BIGINT,
    bus_id BIGINT NULL,
    assigned_to_admin_id BIGINT,

    FOREIGN KEY (passenger_id) REFERENCES passenger(passenger_id) ON DELETE CASCADE,
    FOREIGN KEY (driver_id) REFERENCES driver(driver_id) ON DELETE CASCADE,
    FOREIGN KEY (corporate_user_id) REFERENCES corporate_user(corporate_user_id) ON DELETE CASCADE,
    FOREIGN KEY (bus_id) REFERENCES bus(bus_id) ON DELETE SET NULL,
    FOREIGN KEY (assigned_to_admin_id) REFERENCES admin(admin_id) ON DELETE SET NULL,
    INDEX idx_passenger (passenger_id, status),
    INDEX idx_driver (driver_id, status),
    INDEX idx_corporate (corporate_user_id, status),
    INDEX idx_bus (bus_id),
    INDEX idx_booking_reference (booking_reference),
    INDEX idx_status_priority (status, priority),
    INDEX idx_type (complaint_type),
    INDEX idx_created (created_at DESC)
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
    recipient_id BIGINT NULL,
    sender_type ENUM('passenger', 'driver', 'admin', 'corporate') NOT NULL,
    message_type ENUM('text', 'image', 'voice', 'location', 'system') DEFAULT 'text',
    content TEXT NOT NULL,
    status ENUM('sent', 'delivered', 'read') DEFAULT 'sent',
    client_message_id VARCHAR(255) NULL COMMENT 'Client-generated UUID for deduplication',
    media_url TEXT,
    compressed_media_url TEXT,
    file_name VARCHAR(255) NULL,
    media_mime_type VARCHAR(100) NULL,
    media_size_bytes BIGINT NULL,
    compressed_size_bytes BIGINT NULL,
    duration_seconds INT NULL COMMENT 'Duration in seconds for voice messages',
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    is_read BOOLEAN DEFAULT false,
    read_by_participant_1 BOOLEAN DEFAULT false,
    read_by_participant_2 BOOLEAN DEFAULT false,
    is_deleted BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    delivered_at TIMESTAMP NULL,
    read_at TIMESTAMP NULL,

    FOREIGN KEY (conversation_id) REFERENCES conversation(conversation_id) ON DELETE CASCADE,
    INDEX idx_conversation_time (conversation_id, created_at DESC),
    INDEX idx_sender (sender_id, sender_type),
    INDEX idx_unread (conversation_id, is_read),
    INDEX idx_status (status),
    INDEX idx_client_msg (client_message_id)
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

CREATE TABLE promotion (
    promotion_id BIGINT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(160) NOT NULL,
    description TEXT,
    target_type ENUM('HIGHWAY', 'LONG_DISTANCE', 'HIGHWAY_AND_LONG_DISTANCE', 'REGULAR_CUSTOMERS', 'PROMO_CODE') NOT NULL,
    discount_type ENUM('PERCENTAGE', 'FIXED_AMOUNT') NOT NULL,
    discount_value DECIMAL(10, 2) NOT NULL,
    promo_code VARCHAR(60) UNIQUE,
    regular_customer_min_completed_bookings INT,
    max_bookings INT NOT NULL,
    used_bookings INT NOT NULL DEFAULT 0,
    status ENUM('ACTIVE', 'CANCELLED', 'ENDED') NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    INDEX idx_status_target (status, target_type),
    INDEX idx_promo_code (promo_code)
);

CREATE TABLE payment (
    payment_id BIGINT PRIMARY KEY AUTO_INCREMENT,
    transaction_id VARCHAR(100) UNIQUE NOT NULL,
    payment_method ENUM('credit_card', 'debit_card', 'payhere', 'bank_transfer', 'cash', 'stripe') NOT NULL,
    payment_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    payment_status ENUM('pending', 'success', 'failed', 'refunded') DEFAULT 'pending',
    amount DECIMAL(10, 2) NOT NULL,
    provider_transaction_id VARCHAR(255),
    trip_booking_id BIGINT,

    FOREIGN KEY (trip_booking_id) REFERENCES trip_booking(trip_booking_id) ON DELETE CASCADE,
    INDEX idx_trip_booking (trip_booking_id),
    INDEX idx_transaction (transaction_id),
    INDEX idx_status (payment_status),
    INDEX idx_provider_transaction (provider_transaction_id),
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
    from_stop VARCHAR(255) COMMENT 'Passenger boarding stop name',
    to_stop VARCHAR(255) COMMENT 'Passenger alighting stop name',
    cancellation_reason TEXT,
    restoration_notified_at TIMESTAMP NULL,

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

-- One row per currently-held seat.  The unique key is the database-level
-- concurrency guarantee for seat booking; seat_booking.seat_number remains
-- as a backwards-compatible display field.
CREATE TABLE seat_booking_seat (
    seat_booking_seat_id BIGINT PRIMARY KEY AUTO_INCREMENT,
    seat_booking_id BIGINT NOT NULL,
    bus_id BIGINT NOT NULL,
    journey_date DATE NOT NULL,
    seat_number VARCHAR(10) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_seat_booking_seat_booking
        FOREIGN KEY (seat_booking_id) REFERENCES seat_booking(seat_booking_id) ON DELETE CASCADE,
    CONSTRAINT fk_seat_booking_seat_bus
        FOREIGN KEY (bus_id) REFERENCES bus(bus_id) ON DELETE RESTRICT,
    UNIQUE KEY uq_active_bus_date_seat (bus_id, journey_date, seat_number),
    INDEX idx_seat_booking_seat_booking (seat_booking_id),
    INDEX idx_seat_booking_seat_date (bus_id, journey_date)
);

CREATE TABLE promotion_redemption (
    redemption_id BIGINT PRIMARY KEY AUTO_INCREMENT,
    promotion_id BIGINT NOT NULL,
    passenger_id BIGINT NOT NULL,
    booking_reference VARCHAR(50) UNIQUE NOT NULL,
    discount_amount DECIMAL(10, 2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (promotion_id) REFERENCES promotion(promotion_id) ON DELETE CASCADE,
    FOREIGN KEY (passenger_id) REFERENCES passenger(passenger_id) ON DELETE CASCADE,
    FOREIGN KEY (booking_reference) REFERENCES seat_booking(booking_reference) ON DELETE CASCADE,
    INDEX idx_promotion (promotion_id),
    INDEX idx_passenger (passenger_id),
    INDEX idx_created (created_at DESC)
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
    disruption_key VARCHAR(160) UNIQUE,
    provider_refund_id VARCHAR(255),
    last_error TEXT,
    attempt_count INT NOT NULL DEFAULT 0,
    payment_id BIGINT NOT NULL,

    FOREIGN KEY (payment_id) REFERENCES payment(payment_id) ON DELETE CASCADE,
    INDEX idx_payment (payment_id),
    INDEX idx_status (refund_status),
    INDEX idx_provider_refund (provider_refund_id),
    INDEX idx_created (created_date DESC)
);


-- =============================================
-- MODULE SCAFFOLD TABLES
-- Placeholder tables for Hibernate entity mapping.
-- These will be expanded as modules are developed.
-- =============================================

CREATE TABLE adminlogs (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(255) NOT NULL
);

CREATE TABLE bookings (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(255) NOT NULL
);

CREATE TABLE seats (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(255) NOT NULL
);

CREATE TABLE trips (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(255) NOT NULL
);

CREATE TABLE fleets (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(255) NOT NULL
);

CREATE TABLE drivers (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(255) NOT NULL
);

CREATE TABLE buss (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(255) NOT NULL
);

CREATE TABLE feedbacks (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(255) NOT NULL
);

CREATE TABLE ratings (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(255) NOT NULL
);

CREATE TABLE notifications (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(255) NOT NULL
);

CREATE TABLE invoices (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(255) NOT NULL
);

CREATE TABLE payments (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(255) NOT NULL
);

CREATE TABLE bus_locations (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    bus_number VARCHAR(50) NOT NULL,
    latitude DECIMAL(10, 8) NOT NULL,
    longitude DECIMAL(11, 8) NOT NULL,
    heading DECIMAL(5, 2) NULL COMMENT 'Direction in degrees (0-360)',
    speed DECIMAL(6, 2) NULL COMMENT 'Speed in km/h',
    recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_bus_number (bus_number),
    INDEX idx_recorded (recorded_at DESC)
);

CREATE TABLE ai_chat_message (
    ai_chat_message_id BIGINT PRIMARY KEY AUTO_INCREMENT,
    chat_id VARCHAR(120) NOT NULL,
    user_id BIGINT NULL,
    user_email VARCHAR(255) NULL,
    role VARCHAR(30) NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_ai_chat_message_chat (chat_id, created_at),
    INDEX idx_ai_chat_message_user (user_id, created_at)
);

CREATE TABLE ai_agent_interaction (
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
);

CREATE TABLE ai_feedback (
    ai_feedback_id BIGINT PRIMARY KEY AUTO_INCREMENT,
    chat_id VARCHAR(120) NOT NULL,
    ai_chat_message_id BIGINT NULL,
    user_id BIGINT NULL,
    rating TINYINT NOT NULL,
    comment TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_ai_feedback_chat (chat_id),
    INDEX idx_ai_feedback_user (user_id)
);

CREATE TABLE ai_domain_knowledge (
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
);

-- =============================================
-- ADMIN "FORGOT PASSWORD" OTP PIPELINE
-- Backs auth-user-module's PasswordResetOtp / PasswordResetServiceImpl.
-- =============================================

CREATE TABLE password_reset_otp (
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
