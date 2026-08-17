-- Adds employee_id to the admin table to support self-service admin
-- registration (auth-user-module Admin entity / AuthServiceImpl.registerAdmin).
-- ddl-auto=update will also add this column automatically, but it is
-- tracked here for parity with the other versioned migrations in this
-- directory and for environments that disable Hibernate DDL management.

ALTER TABLE admin
    ADD COLUMN employee_id VARCHAR(20) NULL UNIQUE AFTER phone_number;
