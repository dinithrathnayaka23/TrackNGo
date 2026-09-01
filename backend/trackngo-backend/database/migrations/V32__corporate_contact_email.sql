-- The corporate sign-up and profile screens collect a contact person email
-- address, separate from the account's own login email, but no column ever
-- backed it — it was held in UI state only and silently discarded on save.
-- This adds the missing column so it actually persists.
ALTER TABLE corporate_user
    ADD COLUMN contact_email VARCHAR(255) NULL;
