-- The corporate profile edit screen has always collected a company website
-- and employee count, but no columns backed them (marked "UI Only" in the
-- mobile app) so anything entered was silently discarded. This adds the
-- missing columns so those fields actually persist.
ALTER TABLE corporate_user
    ADD COLUMN website VARCHAR(255) NULL,
    ADD COLUMN employee_count INT NULL;
