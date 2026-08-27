-- Adds Tamil ('ta') as a supported passenger language preference, alongside
-- the existing English ('en') and Sinhala ('si') options. Without this, the
-- UserSettingsService's UPDATE user SET language_preference = 'ta' statement
-- is rejected by MySQL because the column is an ENUM('en', 'si').
ALTER TABLE `user`
    MODIFY COLUMN language_preference ENUM('en', 'si', 'ta') DEFAULT 'en';
