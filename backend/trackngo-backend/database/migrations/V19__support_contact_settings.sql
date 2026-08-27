-- Admin-editable "who to contact" details shown to clients while a booking
-- or contract is awaiting review (e.g. the corporate contract negotiation
-- screen), so this is no longer hardcoded in the mobile app. Single-row
-- settings table (id is always 1), same shape as corporate_pricing_settings.
CREATE TABLE support_contact_settings (
    id TINYINT PRIMARY KEY DEFAULT 1,
    name VARCHAR(120) NOT NULL,
    role VARCHAR(120) NOT NULL,
    phone VARCHAR(30) NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT chk_support_contact_settings_single_row CHECK (id = 1)
);

-- Seed with the values that were previously hardcoded in new-contract.tsx,
-- so nothing regresses on deploy.
INSERT INTO support_contact_settings (id, name, role, phone)
VALUES (1, 'Dinith Rathnayaka', 'Main Admin', '+94701803826');
