-- Enforces "one driver, one bus" at the database level.
--
-- AdminBusService already rejects assigning a driver who is already on
-- another in-service bus, but nothing stopped it before that check existed,
-- so live data can already have a driver on two or more buses. That breaks
-- BusRepository.findFirstByDriverIdOrderByBusIdAsc()'s single-row assumption
-- and, before that defensive rename, crashed the driver app's
-- assignment/profile screens outright with a 500
-- (IncorrectResultSizeDataAccessException).
--
-- Step 1 repairs existing duplicates: for each driver assigned to more than
-- one non-inactive bus, keep one (preferring an 'active' bus, falling back
-- to the lowest bus_id) and release the driver from the rest. This is a
-- low-stakes, easily-reversible admin action - an operator can just
-- reassign the released bus to a driver from the admin UI afterward - so it
-- repairs automatically rather than halting for manual resolution.
--
-- Step 2 adds a generated column that mirrors driver_id only while the bus
-- is in service (status <> 'inactive'), and a unique index on it. MySQL
-- never treats two NULLs as a collision, so retired ('inactive') buses -
-- kept around for booking/refund/audit history - never block their old
-- driver from being assigned to a new bus.
--
-- MySQL refuses to add a STORED generated column to a table that has any
-- foreign key defined on it at all (error 1215, "Cannot add foreign key
-- constraint" - misleading, since no FK is being touched at that point).
-- The foreign keys have to be dropped first and re-created afterward.
-- Separately, MySQL also refuses ON DELETE SET NULL/CASCADE on a column
-- that a generated column depends on, so driver_id's FK is re-created as
-- ON DELETE RESTRICT instead of its original SET NULL. Nothing in this
-- codebase hard-deletes a driver row (accounts are deactivated, not
-- dropped), so this is a behavior change in name only - and RESTRICT is
-- strictly safer than silently orphaning a bus's driver_id if that ever
-- changes. bus_ibfk_1/bus_ibfk_2 are the auto-generated names MySQL gives
-- the two unnamed FOREIGN KEY clauses in the original CREATE TABLE bus (in
-- trackngo_complete.sql); check `SHOW CREATE TABLE bus` first if a fresh
-- environment ever named them differently.
ALTER TABLE bus DROP FOREIGN KEY bus_ibfk_1;
ALTER TABLE bus DROP FOREIGN KEY bus_ibfk_2;

-- Step 1: repair pre-existing double-assignments.
CREATE TEMPORARY TABLE tmp_keep_bus (
    driver_id BIGINT PRIMARY KEY,
    keep_bus_id BIGINT NOT NULL
);

INSERT INTO tmp_keep_bus (driver_id, keep_bus_id)
SELECT driver_id, MIN(bus_id)
FROM bus
WHERE driver_id IS NOT NULL
  AND status = 'active'
GROUP BY driver_id;

-- MySQL cannot reference a TEMPORARY table twice in one statement (a
-- correlated NOT-EXISTS subquery against tmp_keep_bus here fails with
-- "Can't reopen table"), so the "driver only ever had a maintenance bus"
-- fallback instead tries to insert for every driver and relies on the
-- primary key + INSERT IGNORE to silently skip the ones step 1 already
-- covered, keeping their active-bus row instead.
INSERT IGNORE INTO tmp_keep_bus (driver_id, keep_bus_id)
SELECT driver_id, MIN(bus_id)
FROM bus
WHERE driver_id IS NOT NULL
  AND status <> 'inactive'
GROUP BY driver_id;

UPDATE bus b
INNER JOIN tmp_keep_bus k ON k.driver_id = b.driver_id
SET b.driver_id = NULL
WHERE b.status <> 'inactive'
  AND b.bus_id <> k.keep_bus_id;

DROP TEMPORARY TABLE tmp_keep_bus;

-- Step 2: add the database-level guard.
ALTER TABLE bus
    ADD COLUMN driver_id_if_active BIGINT
        GENERATED ALWAYS AS (CASE WHEN status <> 'inactive' THEN driver_id ELSE NULL END) STORED;

ALTER TABLE bus ADD CONSTRAINT bus_ibfk_1
    FOREIGN KEY (driver_id) REFERENCES driver(driver_id) ON DELETE RESTRICT;
ALTER TABLE bus ADD CONSTRAINT bus_ibfk_2
    FOREIGN KEY (route_id) REFERENCES route(route_id) ON DELETE SET NULL;

ALTER TABLE bus
    ADD UNIQUE INDEX uq_bus_active_driver (driver_id_if_active);

-- Verify: should return zero rows.
--
-- SELECT driver_id, COUNT(*) AS bus_count
-- FROM bus
-- WHERE driver_id IS NOT NULL AND status <> 'inactive'
-- GROUP BY driver_id
-- HAVING COUNT(*) > 1;
