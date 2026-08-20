-- Lets a corporate contract be served by more than one bus when the employee
-- headcount exceeds a single bus's seat capacity. corporate_contract.bus_id
-- is kept as a legacy "primary bus" pointer (first bus assigned) so existing
-- single-bus display code keeps working; the join table is the source of
-- truth for the full assignment.
CREATE TABLE corporate_contract_bus (
    contract_id BIGINT NOT NULL,
    bus_id BIGINT NOT NULL,
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (contract_id, bus_id),
    FOREIGN KEY (contract_id) REFERENCES corporate_contract(contract_id) ON DELETE CASCADE,
    FOREIGN KEY (bus_id) REFERENCES bus(bus_id) ON DELETE RESTRICT,
    INDEX idx_bus (bus_id)
);

-- Backfill: every contract that already had a single bus_id gets one row.
INSERT INTO corporate_contract_bus (contract_id, bus_id)
SELECT contract_id, bus_id
FROM corporate_contract
WHERE bus_id IS NOT NULL;
