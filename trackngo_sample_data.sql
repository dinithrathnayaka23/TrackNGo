
-- =============================================
-- SEED DATA - SRI LANKAN SAMPLE DATA
-- All passwords are hashed bcrypt of 'Test@1234'
-- Hash: $2a$10$E6A/9lJIRKfoTDKU0UpQ4.tbLDAoP8uu8kDeDPbrFrwXoMGk33HsK
-- =============================================

-- =============================================
-- USERS (26 records)
-- =============================================

INSERT INTO user (user_id, first_name, last_name, email, password, user_type, is_email_verified, is_active, language_preference, theme_preference, last_login) VALUES
(1,  'Suresh',  'Perera',       'suresh.perera@trackngo.lk',   '$2a$10$E6A/9lJIRKfoTDKU0UpQ4.tbLDAoP8uu8kDeDPbrFrwXoMGk33HsK', 'admin',     true,  true,  'en', 'light', NOW()),
(2,  'Nimali',  'Fernando',     'nimali.fernando@trackngo.lk', '$2a$10$E6A/9lJIRKfoTDKU0UpQ4.tbLDAoP8uu8kDeDPbrFrwXoMGk33HsK', 'admin',     true,  true,  'si', 'dark',  NOW()),
(3,  'Kasun',   'Jayawardena',  'kasun.jayawardena@trackngo.lk','$2a$10$E6A/9lJIRKfoTDKU0UpQ4.tbLDAoP8uu8kDeDPbrFrwXoMGk33HsK', 'admin',     true,  true,  'en', 'auto',  NOW()),
(4,  'Amara',   'Silva',        'amara.silva@gmail.com',       '$2a$10$E6A/9lJIRKfoTDKU0UpQ4.tbLDAoP8uu8kDeDPbrFrwXoMGk33HsK', 'passenger', true,  true,  'en', 'light', NULL),
(5,  'Dilan',   'Rajapaksa',    'dilan.rajapaksa@gmail.com',   '$2a$10$E6A/9lJIRKfoTDKU0UpQ4.tbLDAoP8uu8kDeDPbrFrwXoMGk33HsK', 'passenger', true,  true,  'si', 'dark',  NULL),
(6,  'Sanduni', 'Wickramasinghe','sanduni.wick@yahoo.com',     '$2a$10$E6A/9lJIRKfoTDKU0UpQ4.tbLDAoP8uu8kDeDPbrFrwXoMGk33HsK', 'passenger', false, true,  'en', 'light', NULL),
(7,  'Chathura','Bandara',      'chathura.b@hotmail.com',      '$2a$10$E6A/9lJIRKfoTDKU0UpQ4.tbLDAoP8uu8kDeDPbrFrwXoMGk33HsK', 'passenger', true,  true,  'si', 'auto',  NULL),
(8,  'Hiruni',  'Dissanayake',  'hiruni.d@gmail.com',          '$2a$10$E6A/9lJIRKfoTDKU0UpQ4.tbLDAoP8uu8kDeDPbrFrwXoMGk33HsK', 'passenger', true,  true,  'en', 'light', NULL),
(9,  'Nuwan',   'Kumara',       'nuwan.kumara@gmail.com',      '$2a$10$E6A/9lJIRKfoTDKU0UpQ4.tbLDAoP8uu8kDeDPbrFrwXoMGk33HsK', 'passenger', true,  true,  'en', 'dark',  NULL),
(10, 'Tharushi','Gunasekara',   'tharushi.g@gmail.com',        '$2a$10$E6A/9lJIRKfoTDKU0UpQ4.tbLDAoP8uu8kDeDPbrFrwXoMGk33HsK', 'passenger', false, true,  'si', 'light', NULL),
(11, 'Prasad',  'Rathnayake',   'prasad.r@gmail.com',          '$2a$10$E6A/9lJIRKfoTDKU0UpQ4.tbLDAoP8uu8kDeDPbrFrwXoMGk33HsK', 'passenger', true,  true,  'en', 'auto',  NULL),
(12, 'Malsha',  'Seneviratne',  'malsha.s@gmail.com',          '$2a$10$E6A/9lJIRKfoTDKU0UpQ4.tbLDAoP8uu8kDeDPbrFrwXoMGk33HsK', 'passenger', true,  true,  'si', 'dark',  NULL),
(13, 'Lahiru',  'Pathirana',    'lahiru.p@gmail.com',          '$2a$10$E6A/9lJIRKfoTDKU0UpQ4.tbLDAoP8uu8kDeDPbrFrwXoMGk33HsK', 'passenger', true,  false, 'en', 'light', NULL),
(14, 'Roshan',  'Mendis',       'roshan.mendis@gmail.com',     '$2a$10$E6A/9lJIRKfoTDKU0UpQ4.tbLDAoP8uu8kDeDPbrFrwXoMGk33HsK', 'driver',    true,  true,  'en', 'light', NULL),
(15, 'Thilina', 'Samarasinghe', 'thilina.s@gmail.com',         '$2a$10$E6A/9lJIRKfoTDKU0UpQ4.tbLDAoP8uu8kDeDPbrFrwXoMGk33HsK', 'driver',    true,  true,  'si', 'dark',  NULL),
(16, 'Chamara', 'Herath',       'chamara.h@gmail.com',         '$2a$10$E6A/9lJIRKfoTDKU0UpQ4.tbLDAoP8uu8kDeDPbrFrwXoMGk33HsK', 'driver',    false, true,  'en', 'auto',  NULL),
(17, 'Asanka',  'Priyantha',    'asanka.p@gmail.com',          '$2a$10$E6A/9lJIRKfoTDKU0UpQ4.tbLDAoP8uu8kDeDPbrFrwXoMGk33HsK', 'driver',    true,  true,  'si', 'light', NULL),
(18, 'Nimal',   'Weerasinghe',  'nimal.w@gmail.com',           '$2a$10$E6A/9lJIRKfoTDKU0UpQ4.tbLDAoP8uu8kDeDPbrFrwXoMGk33HsK', 'driver',    true,  true,  'en', 'dark',  NULL),
(19, 'Isuru',   'Liyanage',     'isuru.l@gmail.com',           '$2a$10$E6A/9lJIRKfoTDKU0UpQ4.tbLDAoP8uu8kDeDPbrFrwXoMGk33HsK', 'driver',    true,  true,  'si', 'light', NULL),
(20, 'Ruwan',   'Karunaratne',  'ruwan.k@gmail.com',           '$2a$10$E6A/9lJIRKfoTDKU0UpQ4.tbLDAoP8uu8kDeDPbrFrwXoMGk33HsK', 'driver',    false, true,  'en', 'auto',  NULL),
(21, 'Sanjeewa','Dharmasiri',   'sanjeewa.d@gmail.com',        '$2a$10$E6A/9lJIRKfoTDKU0UpQ4.tbLDAoP8uu8kDeDPbrFrwXoMGk33HsK', 'driver',    true,  true,  'si', 'dark',  NULL),
(22, 'Sachini', 'Amaratunga',   'admin@dialogaxiata.lk',       '$2a$10$E6A/9lJIRKfoTDKU0UpQ4.tbLDAoP8uu8kDeDPbrFrwXoMGk33HsK', 'corporate', true,  true,  'en', 'light', NULL),
(23, 'Ruwan',   'Abeysekara',   'hr@johnkeellsgroup.lk',       '$2a$10$E6A/9lJIRKfoTDKU0UpQ4.tbLDAoP8uu8kDeDPbrFrwXoMGk33HsK', 'corporate', true,  true,  'si', 'auto',  NULL),
(24, 'Thilini', 'Ratnayake',    'transport@hayleys.lk',        '$2a$10$E6A/9lJIRKfoTDKU0UpQ4.tbLDAoP8uu8kDeDPbrFrwXoMGk33HsK', 'corporate', true,  true,  'en', 'dark',  NULL),
(25, 'Pradeep', 'Gunawardena',  'admin@virtusatech.lk',        '$2a$10$E6A/9lJIRKfoTDKU0UpQ4.tbLDAoP8uu8kDeDPbrFrwXoMGk33HsK', 'corporate', false, true,  'en', 'light', NULL),
(26, 'Nalika',  'Jayasuriya',   'staff@sltelecom.lk',          '$2a$10$E6A/9lJIRKfoTDKU0UpQ4.tbLDAoP8uu8kDeDPbrFrwXoMGk33HsK', 'corporate', true,  true,  'si', 'light', NULL);

-- =============================================
-- ADMINS (3 records)
-- =============================================

INSERT INTO admin (admin_id, phone_number, role, status) VALUES
(1, '+94771234501', 'super_admin', 'active'),
(2, '+94771234502', 'moderator',   'active'),
(3, '+94771234503', 'moderator',   'active');


-- =============================================
-- PASSENGERS (10 records)
-- =============================================

INSERT INTO passenger (passenger_id, profile_photo, mobile_number, is_phone_verified, status) VALUES
(4,  NULL, '+94701111001', true,  'active'),
(5,  NULL, '+94701111002', true,  'active'),
(6,  NULL, '+94701111003', true,  'active'),
(7,  NULL, '+94701111004', false, 'active'),
(8,  NULL, '+94701111005', true,  'active'),
(9,  NULL, '+94701111006', true,  'active'),
(10, NULL, '+94701111007', false, 'active'),
(11, NULL, '+94701111008', true,  'active'),
(12, NULL, '+94701111009', true,  'active'),
(13, NULL, '+94701111010', false, 'suspended');


-- =============================================
-- DRIVERS (8 records)
-- =============================================

INSERT INTO driver (driver_id, licence_expiry, years_of_experience, profile_photo, account_number, phone_number, is_phone_verified, license_number, driver_earnings, status, is_verified, average_rating, joined_date) VALUES
(14, '2027-06-30', 12, NULL, '7890123456', '+94712221001', true,  'B1234567', 285000.00, 'active',    true,  4.80, '2015-03-10'),
(15, '2026-09-15', 8,  NULL, '7890234567', '+94712221002', true,  'B2345678', 198000.00, 'active',    true,  4.60, '2016-07-22'),
(16, '2025-12-31', 5,  NULL, '7890345678', '+94712221003', true,  'B3456789', 142000.00, 'active',    true,  4.40, '2019-11-05'),
(17, '2028-03-20', 15, NULL, '7890456789', '+94712221004', false, 'B4567890', 420000.00, 'active',    true,  4.90, '2009-05-18'),
(18, '2026-07-10', 10, NULL, '7890567890', '+94712221005', true,  'B5678901', 310000.00, 'active',    true,  4.70, '2014-08-30'),
(19, '2027-11-25', 7,  NULL, '7890678901', '+94712221006', true,  'B6789012', 175000.00, 'on_leave',  true,  4.30, '2017-02-14'),
(20, '2025-05-08', 3,  NULL, '7890789012', '+94712221007', false, 'B7890123',  45000.00, 'active',    false, 0.00, '2021-06-01'),
(21, '2029-01-15', 20, NULL, '7890890123', '+94712221008', true,  'B8901234', 680000.00, 'active',    true,  4.95, '2004-09-20');


-- =============================================
-- CORPORATE USERS (5 records)
-- =============================================

INSERT INTO corporate_user (corporate_user_id, address, company_name, profile_photo, contact_person_name, contact_phone, contact_person_designation, status, business_registration_number, industry) VALUES
(22, 'No. 57, Dharmapala Mawatha, Colombo 03',                'Dialog Axiata PLC',       NULL, 'Sachini Amaratunga',  '+94112456789', 'HR Manager',           'active',               'PV00007062', 'Telecommunications'),
(23, 'No. 117, Sir Chittampalam A. Gardiner Mawatha, Col 02', 'John Keells Holdings PLC',NULL, 'Ruwan Abeysekara',    '+94112331000', 'Admin Officer',        'active',               'PV00003521', 'Conglomerate'),
(24, 'No. 400, Deans Road, Colombo 10',                       'Hayleys PLC',             NULL, 'Thilini Ratnayake',   '+94112627000', 'Transport Coordinator','active',               'PV00001503', 'Manufacturing'),
(25, 'No. 1 Forum, Rajagiriya, Sri Jayawardenepura',          'Virtusa Corporation',     NULL, 'Pradeep Gunawardena', '+94112318088', 'Facilities Manager',   'pending_verification', 'PV00045321', 'Information Technology'),
(26, 'Lotus Road, Colombo 01',                                'Sri Lanka Telecom PLC',   NULL, 'Nalika Jayasuriya',   '+94112021000', 'HR Director',         'active',               'PV00002841', 'Telecommunications');


-- =============================================
-- ROUTES (6 records)
-- =============================================

INSERT INTO route (route_id, route_name, start_location, end_location, est_distance_difference, estimated_time_duration, fee, is_active) VALUES
(1, 'Colombo to Kandy Express',       'Colombo Fort',       'Kandy',            115.50, 165, 450.00, true),
(2, 'Colombo to Galle Highway',       'Colombo Fort',       'Galle',            119.00, 100, 400.00, true),
(3, 'Colombo to Jaffna Long Distance','Colombo Fort',       'Jaffna',           396.00, 480, 1800.00, true),
(4, 'Kandy to Nuwara Eliya',          'Kandy',              'Nuwara Eliya',     79.00,  120, 350.00, true),
(5, 'Colombo to Matara',              'Colombo Fort',       'Matara',           160.00, 150, 550.00, true),
(6, 'Colombo to Negombo',             'Colombo Fort',       'Negombo',          37.00,  60,  200.00, true);


-- =============================================
-- ROUTE STOPS
-- =============================================

-- Route 1: Colombo to Kandy
INSERT INTO route_stop (route_id, name, priority, latitude, longitude, distance_from_start, estimated_arrival_mins) VALUES
(1, 'Colombo Fort',      1,  6.93369,  79.84868,   0.00,   0),
(1, 'Kelaniya',          2,  7.00000,  79.91667,   11.50,  20),
(1, 'Kadawatha',         3,  7.04330,  79.95140,   18.00,  30),
(1, 'Nittambuwa',        4,  7.06667,  80.01667,   35.00,  55),
(1, 'Warakapola',        5,  7.10000,  80.13333,   60.00,  90),
(1, 'Mawanella',         6,  7.25000,  80.45000,   85.00,  125),
(1, 'Peradeniya',        7,  7.26667,  80.59333,   108.00, 155),
(1, 'Kandy',             8,  7.29118,  80.63330,   115.50, 165);

-- Route 2: Colombo to Galle
INSERT INTO route_stop (route_id, name, priority, latitude, longitude, distance_from_start, estimated_arrival_mins) VALUES
(2, 'Colombo Fort',      1,  6.93369,  79.84868,   0.00,   0),
(2, 'Panadura',          2,  6.71389,  79.90361,   26.00,  25),
(2, 'Kalutara',          3,  6.58556,  79.96139,   43.00,  40),
(2, 'Bentota',           4,  6.42611,  80.00000,   63.00,  60),
(2, 'Ambalangoda',       5,  6.23333,  80.05000,   83.00,  78),
(2, 'Hikkaduwa',         6,  6.14167,  80.10000,   100.00, 90),
(2, 'Galle',             7,  6.03333,  80.21667,   119.00, 100);

-- Route 3: Colombo to Jaffna
INSERT INTO route_stop (route_id, name, priority, latitude, longitude, distance_from_start, estimated_arrival_mins) VALUES
(3, 'Colombo Fort',      1,  6.93369,  79.84868,   0.00,   0),
(3, 'Kurunegala',        2,  7.48694,  80.36250,   93.00,  110),
(3, 'Dambulla',          3,  7.86667,  80.65000,   148.00, 180),
(3, 'Vavuniya',          4,  8.75194,  80.49722,   256.00, 300),
(3, 'Kilinochchi',       5,  9.39528,  80.40111,   330.00, 390),
(3, 'Jaffna',            6,  9.66833,  80.00722,   396.00, 480);

-- Route 4: Kandy to Nuwara Eliya
INSERT INTO route_stop (route_id, name, priority, latitude, longitude, distance_from_start, estimated_arrival_mins) VALUES
(4, 'Kandy',             1,  7.29118,  80.63330,   0.00,   0),
(4, 'Peradeniya',        2,  7.26667,  80.59333,   6.00,   10),
(4, 'Gampola',           3,  7.16430,  80.56960,   23.00,  35),
(4, 'Pussellawa',        4,  7.00480,  80.66780,   48.00,  75),
(4, 'Nuwara Eliya',      5,  6.94970,  80.78910,   79.00,  120);

-- Route 5: Colombo to Matara
INSERT INTO route_stop (route_id, name, priority, latitude, longitude, distance_from_start, estimated_arrival_mins) VALUES
(5, 'Colombo Fort',      1,  6.93369,  79.84868,   0.00,   0),
(5, 'Kalutara',          2,  6.58556,  79.96139,   43.00,  40),
(5, 'Hikkaduwa',         3,  6.14167,  80.10000,   100.00, 90),
(5, 'Galle',             4,  6.03333,  80.21667,   119.00, 110),
(5, 'Weligama',          5,  5.97250,  80.42917,   140.00, 130),
(5, 'Matara',            6,  5.94444,  80.53528,   160.00, 150);

-- Route 6: Colombo to Negombo
INSERT INTO route_stop (route_id, name, priority, latitude, longitude, distance_from_start, estimated_arrival_mins) VALUES
(6, 'Colombo Fort',      1,  6.93369,  79.84868,   0.00,   0),
(6, 'Peliyagoda',        2,  6.96750,  79.88972,   7.00,   12),
(6, 'Ja-Ela',            3,  7.07278,  79.89194,   19.00,  28),
(6, 'Katunayake',        4,  7.16917,  79.88583,   29.00,  45),
(6, 'Negombo',           5,  7.20917,  79.83583,   37.00,  60);


-- =============================================
-- BUSES (10 records)
-- =============================================

INSERT INTO bus (bus_id, bus_number, bus_brand, start_time, end_time, registration_number, amenities, seat_capacity, bus_condition, bus_type, status, insurance_exp_date, driver_id, route_id) VALUES
(1, 'NB-0012', 'Ashok Leyland', '05:30:00', '22:00:00', 'WP CAB-0012', '["ac","wifi","charging_ports","entertainment"]', 45, 'excellent', 'highway',       'active',      '2026-08-31', 14, 1),
(2, 'NB-0034', 'TATA Motors',   '06:00:00', '21:00:00', 'WP CAB-0034', '["ac","charging_ports"]',                       40, 'good',      'highway',       'active',      '2025-12-31', 15, 2),
(3, 'NB-0056', 'Ashok Leyland', '04:30:00', '23:00:00', 'WP CAB-0056', '["ac","wifi","charging_ports","entertainment"]', 50, 'excellent', 'long_distance', 'active',      '2026-11-30', 16, 3),
(4, 'NB-0078', 'TATA Motors',   '07:00:00', '20:00:00', 'WP CAB-0078', '["ac"]',                                        35, 'good',      'highway',       'active',      '2026-03-15', 17, 4),
(5, 'NB-0090', 'Ashok Leyland', '05:00:00', '22:30:00', 'WP CAB-0090', '["ac","charging_ports"]',                       45, 'good',      'highway',       'active',      '2026-06-30', 18, 5),
(6, 'NB-0112', 'TATA Motors',   '06:30:00', '20:00:00', 'WP CAB-0112', '["ac"]',                                        40, 'fair',      'highway',       'active',      '2025-10-31', 21, 6),
(7, 'TB-0201', 'Rosa Bus',      NULL,        NULL,        'WP CAB-0201', '["ac","wifi","charging_ports"]',                 25, 'excellent', 'trip_booking',  'active',      '2027-01-31', 20, NULL),
(8, 'TB-0202', 'TATA Motors',   NULL,        NULL,        'WP CAB-0202', '["ac"]',                                        30, 'good',      'trip_booking',  'active',      '2026-09-30', NULL, NULL),
(9, 'CB-0301', 'Ashok Leyland', '06:00:00', '20:00:00', 'WP CAB-0301', '["ac","wifi","charging_ports"]',                 40, 'excellent', 'corporate',     'active',      '2026-12-31', 19, NULL),
(10, 'CB-0302', 'Rosa Bus',      '06:00:00', '20:00:00', 'WP CAB-0302', '["ac","charging_ports"]',                        35, 'good',      'corporate',     'maintenance', '2026-07-31', NULL, NULL);


-- =============================================
-- OTP VERIFICATION (sample recent OTPs)
-- =============================================

INSERT INTO otp_verification (otp_id, user_id, phone_number, email, otp_code, otp_type, is_verified, attempts, expires_at, verified_at) VALUES
(1, 4,  '+94701111001', 'amara.silva@gmail.com',     '847291', 'registration',       true,  1, DATE_ADD(NOW(), INTERVAL 10 MINUTE), NOW()),
(2, 5,  '+94701111002', 'dilan.rajapaksa@gmail.com', '362819', 'registration',       true,  1, DATE_ADD(NOW(), INTERVAL 10 MINUTE), NOW()),
(3, 6,  '+94701111003', 'sanduni.wick@yahoo.com',    '591047', 'phone_verification', false, 0, DATE_ADD(NOW(), INTERVAL 5 MINUTE),  NULL),
(4, 14, '+94712221001', 'roshan.mendis@gmail.com',   '714382', 'login',              true,  1, DATE_ADD(NOW(), INTERVAL 10 MINUTE), NOW()),
(5, 8,  '+94701111005', 'hiruni.d@gmail.com',        '229954', 'password_reset',     true,  2, DATE_ADD(NOW(), INTERVAL 10 MINUTE), NOW()),
(6, 22, '+94112456789', 'admin@dialogaxiata.lk',     '883021', 'registration',       true,  1, DATE_ADD(NOW(), INTERVAL 10 MINUTE), NOW());


-- =============================================
-- SOCIAL LOGIN (sample OAuth records)
-- =============================================

INSERT INTO social_login (social_login_id, user_id, provider, provider_user_id, email, profile_photo_url, is_active, last_login) VALUES
(1, 4,  'google',   '108234567890123456781', 'amara.silva@gmail.com',     'https://lh3.googleusercontent.com/a/amara',   true, NOW()),
(2, 5,  'facebook', 'fb_1023456789012345',   'dilan.rajapaksa@gmail.com', 'https://graph.facebook.com/dilan/picture',    true, NOW()),
(3, 8,  'google',   '108234567890123456785', 'hiruni.d@gmail.com',        'https://lh3.googleusercontent.com/a/hiruni',  true, NOW()),
(4, 9,  'google',   '108234567890123456786', 'nuwan.kumara@gmail.com',     'https://lh3.googleusercontent.com/a/nuwan',  true, NOW()),
(5, 22, 'google',   '108234567890123456791', 'admin@dialogaxiata.lk',      'https://lh3.googleusercontent.com/a/dialog', true, NOW());


-- =============================================
-- TRIP BOOKINGS (8 records)
-- =============================================

INSERT INTO trip_booking (trip_booking_id, passenger_count, advance_payment, start_location, destination, start_date, return_date, final_price, booking_status, passenger_id, driver_id, bus_id) VALUES
(1, 25, 12500.00, 'Colombo',   'Sigiriya',       '2025-02-15', '2025-02-15', 25000.00,  'completed', 4, 14, 7),
(2, 12, 6000.00,  'Kandy',     'Nuwara Eliya',   '2025-03-20', '2025-03-21', 15000.00,  'completed', 5, 15, 7),
(3, 30, 15000.00, 'Colombo',   'Yala',           '2025-04-05', '2025-04-07', 45000.00,  'completed', 6, 16, 8),
(4, 20, 10000.00, 'Colombo',   'Trincomalee',    '2025-05-10', '2025-05-12', 38000.00,  'completed', 8, 17, 7),
(5, 15, 7500.00,  'Colombo',   'Arugam Bay',     '2025-06-20', NULL,         22000.00,  'completed', 9, 18, 8),
(6, 10, 5000.00,  'Colombo',   'Pinnawala',      '2025-07-14', '2025-07-14', 12000.00,  'confirmed', 11, 14, 7),
(7, 35, 17500.00, 'Colombo',   'Anuradhapura',   '2025-08-01', '2025-08-02', 48000.00,  'pending',   7, NULL, NULL),
(8, 18, 9000.00,  'Colombo',   'Mirissa',        '2025-09-05', '2025-09-06', 30000.00,  'cancelled', 12, 15, 8);


-- =============================================
-- CONVERSATIONS (6 records)
-- =============================================

INSERT INTO conversation (conversation_id, participant_1_id, participant_1_type, participant_2_id, participant_2_type, participant_1_unread, participant_2_unread, last_message, last_message_timestamp) VALUES
(1, 4, 'passenger', 14, 'driver',    0, 2, 'Where is the bus now?',       NOW()),
(2, 5, 'passenger', 15, 'driver',    1, 0, 'Is booking confirmed?',     DATE_SUB(NOW(), INTERVAL 2 HOUR)),
(3, 4, 'passenger', 1,  'admin',     0, 1, 'There is a payment issue', DATE_SUB(NOW(), INTERVAL 1 DAY)),
(4, 6, 'passenger', 16, 'driver',    2, 0, 'How are you?',                           DATE_SUB(NOW(), INTERVAL 3 HOUR)),
(5, 22, 'corporate', 2, 'admin',     0, 3, 'Contract renewal regarding',                             DATE_SUB(NOW(), INTERVAL 5 HOUR)),
(6, 8, 'passenger', 17, 'driver',    1, 1, 'Pick up location sinhalen kiyannako?',                  DATE_SUB(NOW(), INTERVAL 30 MINUTE));


-- =============================================
-- CHAT MESSAGES (20 records)
-- =============================================

INSERT INTO chat_message (message_id, conversation_id, sender_id, sender_type, message_type, content, is_read) VALUES
(1, 1, 4,  'passenger', 'text',     'Hello! Where is the bus now?', true),
(2, 1, 14, 'driver',    'text',     'At Kadawatha junction, will come in 20 mins', true),
(3, 1, 4,  'passenger', 'text',     'Okay, I will wait',                         true),
(4, 1, 14, 'driver',    'text',     'Did you take from Peradeniya toll?', false),
(5, 1, 4,  'passenger', 'text',     'Not yet',                                                  false),
(6, 2, 5,  'passenger', 'text',     'My booking for March 20 to Nuwara Eliya confirmed?',                    true),
(7, 2, 15, 'driver',    'text',     'Yes, confirmed! I will pick you from Kandy clock tower at 7am',         true),
(8, 2, 5,  'passenger', 'text',     'Thank you! Can we stop at Ramboda Falls?',                              false),
(9, 3, 4,  'passenger', 'text',     'I paid via PayHere but booking shows pending',                          true),
(10, 3, 1, 'admin',     'text',     'Did you give transaction ID?', true),
(11, 3, 4, 'passenger', 'text',     'TXN-20250115-0042',                                                     false),
(12, 4, 6, 'passenger', 'text',     'Please come for the Yala trip on the mentioned time', true),
(13, 4, 16,'driver',    'text',     'I will come at 5.30',                            true),
(14, 4, 6, 'passenger', 'location', '6.3705, 80.7447',                                                       false),
(15, 5, 22,'corporate', 'text',     'Dialog contract renewal for next year - need 2 buses',                  true),
(16, 5, 2, 'admin',     'text',     'Thank you. Our agent will contact you within 24 hours',                 false),
(17, 6, 8, 'passenger', 'text',     'Can we talk about pick up time?', true),
(18, 6, 17,'driver',    'text',     'How about 6.15?',                                    true),
(19, 6, 8, 'passenger', 'text',     'Okay',                                                           false),
(20, 6, 17,'driver',    'text',     'Will call when ready',                false);


-- =============================================
-- COMPLAINTS (6 records)
-- =============================================

INSERT INTO complaint (complaint_id, complaint_type, priority, description, status, admin_response, passenger_id, driver_id, assigned_to_admin_id, resolved_at) VALUES
(1, 'driver_behavior', 'high',   'Driver was rude and used phone while driving on Colombo-Kandy route. Very unsafe behavior.', 'resolved', 'We investigated and gave the driver a formal warning. Thank you for reporting.', 4, 14, 1, DATE_SUB(NOW(), INTERVAL 10 DAY)),
(2, 'payment_issue',   'medium', 'I paid Rs.1800 via PayHere for Jaffna trip but received no confirmation email.',              'under_review', NULL,                                                                           6, NULL, 2, NULL),
(3, 'bus_condition',   'low',    'AC was not working properly on the Colombo to Galle route. Very uncomfortable journey.',      'resolved', 'Bus was sent for maintenance. AC has been repaired.',                              8, 15, 1, DATE_SUB(NOW(), INTERVAL 5 DAY)),
(4, 'route_issue',     'medium', 'Bus took wrong turn at Kurunegala and was 45 minutes late to Dambulla stop.',                 'pending',  NULL,                                                                           5, 16, NULL, NULL),
(5, 'safety_concern',  'urgent', 'Driver was speeding heavily between Nittambuwa and Warakapola. Passengers were scared.',      'under_review', NULL,                                                                           9, 18, 2, NULL),
(6, 'booking_issue',   'low',    'I cancelled my seat 3 days before but refund has not been processed after 2 weeks.',          'resolved', 'Refund was processed. Please allow 3-5 business days to reflect.',                11, NULL, 1, DATE_SUB(NOW(), INTERVAL 2 DAY));


-- =============================================
-- SOS RECORDS (3 records)
-- =============================================

INSERT INTO sos (sos_id, shared_location, fire_brigade, ambulance_number, police_number, emergency_contact, admin_id, passenger_id) VALUES
(1, '7.0621, 80.0001 - Near Warakapola, Colombo-Kandy Road', '011-2422222', '1990', '119', '+94715551001', 1, 4),
(2, '6.1417, 80.1000 - Near Hikkaduwa Beach Road',            '091-2222222', '1990', '119', '+94715552002', 2, 8),
(3, '6.9336, 79.8486 - Colombo Fort Bus Station',             '011-2422222', '1990', '119', '+94715553003', 1, 6);


-- =============================================
-- NOTIFICATIONS (15 records)
-- =============================================

INSERT INTO notification (notification_id, notification_type, title, message, is_read, passenger_id, driver_id, corporate_user_id, admin_id) VALUES
(1, 'booking_confirmation', 'Booking Confirmed!',           'Your trip to Sigiriya on Feb 15 has been confirmed. Driver: Roshan Mendis.',          true,  4,    NULL, NULL, NULL),
(2, 'payment_success',      'Payment Received',             'Rs. 12,500 advance payment received for Sigiriya trip. Booking Ref: TB-001.',          true,  4,    NULL, NULL, NULL),
(3, 'journey_reminder',     'Trip Tomorrow!',               'Reminder: Your Kandy to Nuwara Eliya trip is tomorrow at 7:00 AM.',                   true,  5,    NULL, NULL, NULL),
(4, 'rating_request',       'Rate Your Journey',            'How was your Yala trip? Please rate your experience.',                                 false, 6,    NULL, NULL, NULL),
(5, 'cancellation',         'Booking Cancelled',            'Your Mirissa trip booking has been cancelled. Refund will be processed in 3-5 days.',  true,  12,   NULL, NULL, NULL),
(6, 'complaint_update',     'Complaint Update',             'Your complaint #1 regarding driver behavior has been resolved.',                       true,  4,    NULL, NULL, NULL),
(7, 'promotion',            'Special Offer!',               'Book any highway seat this week and get 15% off! Use code: SAVE15.',                   false, 7,    NULL, NULL, NULL),
(8, 'system_alert',         'License Expiry Alert',         'Your driving license expires on 2025-12-31. Please renew soon.',                       false, NULL, 16,   NULL, NULL),
(9, 'booking_confirmation', 'New Trip Booking',             'New trip booking from Amara Silva. Sigiriya, Feb 15. Please confirm.',                 true,  NULL, 14,   NULL, NULL),
(10, 'rating_request',       'You Got a New Rating!',        'Amara Silva gave you 5 stars for the Sigiriya trip. Great work!',                      true,  NULL, 14,   NULL, NULL),
(11, 'sos_alert',            'SOS Alert Received',           'Passenger Amara Silva triggered SOS near Warakapola. Coordinates shared.',             false, NULL, NULL, NULL, 1),
(12, 'complaint_update',     'New Complaint Assigned',       'Complaint #5 regarding speeding has been assigned to you for review.',                 false, NULL, NULL, NULL, 2),
(13, 'booking_confirmation', 'Contract Application Received','Your corporate transport contract application is under review.',                       false, NULL, NULL, 22,   NULL),
(14, 'promotion',            'Contract Renewal Reminder',    'Your employee transport contract expires on 2025-12-31. Renew now for discounts.',      false, NULL, NULL, 23,   NULL),
(15, 'system_alert',         'Invoice Ready',                'Monthly invoice #3 for Jan 2025 is ready. Amount: Rs. 280,000.',                        true,  NULL, NULL, 22,   NULL);


-- =============================================
-- CORPORATE CONTRACTS (4 records)
-- =============================================

INSERT INTO corporate_contract (contract_id, contract_name, starting_location, destination, start_shift_time, end_shift_time, status, billing_amount, start_date, end_date, corporate_user_id, bus_id) VALUES
(1, 'Dialog Axiata Employee Transport - Colombo HQ',   'Nugegoda',      'Colombo 03',  '06:30:00', '19:00:00', 'active',   280000.00, '2025-01-01', '2025-12-31', 22, 9),
(2, 'John Keells Employee Shuttle - Colombo',          'Maharagama',    'Colombo 02',  '07:00:00', '18:30:00', 'active',   260000.00, '2025-01-01', '2025-12-31', 23, 10),
(3, 'Hayleys Employee Transport - Deans Road',         'Kaduwela',      'Colombo 10',  '06:00:00', '19:00:00', 'active',   245000.00, '2025-01-01', '2025-06-30', 24, NULL),
(4, 'Virtusa Rajagiriya Staff Transport',              'Battaramulla',  'Rajagiriya',  '07:30:00', '20:00:00', 'pending',  190000.00, '2025-03-01', '2026-02-28', 25, NULL);


-- =============================================
-- PAYMENTS (10 records)
-- =============================================

INSERT INTO payment (payment_id, transaction_id, payment_method, payment_status, amount, trip_booking_id) VALUES
(1, 'TXN-20250215-0001', 'payhere',       'success',  12500.00, 1),
(2, 'TXN-20250215-0002', 'bank_transfer', 'success',  12500.00, 1),
(3, 'TXN-20250320-0003', 'payhere',       'success',  15000.00, 2),
(4, 'TXN-20250405-0004', 'credit_card',   'success',  45000.00, 3),
(5, 'TXN-20250510-0005', 'payhere',       'success',  38000.00, 4),
(6, 'TXN-20250620-0006', 'debit_card',    'success',  22000.00, 5),
(7, 'TXN-20250714-0007', 'payhere',       'success',   5000.00, 6),
(8, 'TXN-20250801-0008', 'cash',          'pending',      0.00, 7),
(9, 'TXN-20250905-0009', 'payhere',       'refunded',  9000.00, 8),
(10, 'TXN-20250115-0042', 'payhere',       'pending',   1800.00, NULL);


-- =============================================
-- SEAT BOOKINGS (10 records)
-- =============================================

INSERT INTO seat_booking (seat_booking_id, booking_reference, journey_date, journey_time, seat_number, special_request, total_amount, status, passenger_id, bus_id, route_id, payment_id) VALUES
(1, 'SB-20250115-001', '2025-01-15', '06:00:00', 'A1,A2',    'Window seats please',         900.00,  'completed', 4,  1, 1, 1),
(2, 'SB-20250115-002', '2025-01-15', '06:00:00', 'B3',       NULL,                          450.00,  'completed', 5,  1, 1, 3),
(3, 'SB-20250116-001', '2025-01-16', '07:00:00', 'A5',       'Front seat preferred',        400.00,  'completed', 6,  2, 2, 4),
(4, 'SB-20250120-001', '2025-01-20', '04:30:00', 'C1,C2,C3', 'Traveling with family',      5400.00,  'completed', 8,  3, 3, 5),
(5, 'SB-20250125-001', '2025-01-25', '06:00:00', 'B1',       NULL,                          450.00,  'completed', 9,  1, 1, 6),
(6, 'SB-20250201-001', '2025-02-01', '05:00:00', 'A3,A4',    'AC seat required',           1100.00,  'completed', 11, 5, 5, 7),
(7, 'SB-20250210-001', '2025-02-10', '06:30:00', 'D2',       NULL,                          200.00,  'cancelled', 12, 6, 6, 9),
(8, 'SB-20250301-001', '2025-03-01', '05:00:00', 'A1',       NULL,                         1800.00,  'confirmed', 7,  3, 3, 10),
(9, 'SB-20250315-001', '2025-03-15', '07:00:00', 'B2,B3',    'Elderly passenger, need AC',  700.00,  'confirmed', 10, 4, 4, NULL),
(10, 'SB-20250401-001', '2025-04-01', '05:00:00', 'E5',       NULL,                         1800.00,  'confirmed', 4,  3, 3, NULL);


-- =============================================
-- RATINGS (5 records)
-- =============================================

INSERT INTO rating (rating_id, driver_rating, bus_condition_rating, journey_rating, review_text, passenger_id, bus_id, driver_id, trip_booking_id) VALUES
(1, 5, 5, 5, 'Roshan aiya excellent driver! Very safe, punctual and friendly. Bus was clean and AC worked perfectly. Highly recommend!', 4, 7, 14, 1),
(2, 4, 4, 5, 'Good trip to Nuwara Eliya. Driver was professional. Minor delay at Ramboda but acceptable. Would book again.',            5, 7, 15, 2),
(3, 5, 4, 5, 'Amazing Yala trip! Driver was very experienced and knew all the routes. Bus was comfortable for the 3 day trip.',         6, 8, 16, 3),
(4, 4, 5, 4, 'Trincomalee trip was great. Bus condition was excellent - new AC, charging ports. Driver was a bit quiet but safe.',      8, 7, 17, 4),
(5, 3, 3, 3, 'Average experience for Arugam Bay. Bus AC kept stopping. Driver was okay but seemed tired. Need improvement.',            9, 8, 18, 5);


-- =============================================
-- CORPORATE INVOICES (8 records)
-- =============================================

INSERT INTO corporate_invoices (invoice_number, contract_id, amount, status, date, due_date) VALUES
(1, 1, 280000.00, 'paid',    '2025-01-31', '2025-02-10'),
(2, 1, 280000.00, 'paid',    '2025-02-28', '2025-03-10'),
(3, 1, 280000.00, 'pending', '2025-03-31', '2025-04-10'),
(1, 2, 260000.00, 'paid',    '2025-01-31', '2025-02-10'),
(2, 2, 260000.00, 'paid',    '2025-02-28', '2025-03-10'),
(3, 2, 260000.00, 'overdue', '2025-03-31', '2025-04-10'),
(1, 3, 245000.00, 'paid',    '2025-01-31', '2025-02-10'),
(2, 3, 245000.00, 'paid',    '2025-02-28', '2025-03-10');


-- =============================================
-- REFUNDS (2 records)
-- =============================================

INSERT INTO refund (refund_id, refund_reason, refund_status, processed_date, refund_amount, payment_id) VALUES
(1, 'Passenger cancelled 3 days before journey date. Eligible for 80% refund as per policy.', 'processed', DATE_SUB(NOW(), INTERVAL 7 DAY), 7200.00, 9),
(2, 'Bus breakdown on route. Full refund issued to all passengers.',                           'pending',   NULL,                             1800.00, 10);


-- =============================================
-- VERIFY
-- =============================================
SHOW TABLES;
SELECT 'user'               AS tbl, COUNT(*) AS row_count FROM user
UNION ALL SELECT 'admin',              COUNT(*) FROM admin
UNION ALL SELECT 'passenger',          COUNT(*) FROM passenger
UNION ALL SELECT 'driver',             COUNT(*) FROM driver
UNION ALL SELECT 'corporate_user',     COUNT(*) FROM corporate_user
UNION ALL SELECT 'route',              COUNT(*) FROM route
UNION ALL SELECT 'route_stop',         COUNT(*) FROM route_stop
UNION ALL SELECT 'bus',                COUNT(*) FROM bus
UNION ALL SELECT 'otp_verification',   COUNT(*) FROM otp_verification
UNION ALL SELECT 'social_login',       COUNT(*) FROM social_login
UNION ALL SELECT 'trip_booking',       COUNT(*) FROM trip_booking
UNION ALL SELECT 'conversation',       COUNT(*) FROM conversation
UNION ALL SELECT 'chat_message',       COUNT(*) FROM chat_message
UNION ALL SELECT 'complaint',          COUNT(*) FROM complaint
UNION ALL SELECT 'sos',                COUNT(*) FROM sos
UNION ALL SELECT 'notification',       COUNT(*) FROM notification
UNION ALL SELECT 'corporate_contract', COUNT(*) FROM corporate_contract
UNION ALL SELECT 'payment',            COUNT(*) FROM payment
UNION ALL SELECT 'seat_booking',       COUNT(*) FROM seat_booking
UNION ALL SELECT 'rating',             COUNT(*) FROM rating
UNION ALL SELECT 'corporate_invoices', COUNT(*) FROM corporate_invoices
UNION ALL SELECT 'refund',             COUNT(*) FROM refund;