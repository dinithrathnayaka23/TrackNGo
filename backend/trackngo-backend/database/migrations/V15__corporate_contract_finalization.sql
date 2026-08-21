-- Distinguishes "admin approved this contract" (status = 'active') from "the
-- corporate user has confirmed the final offer" — the mobile app's Pending
-- Contracts list needs to keep showing an admin-approved contract (as
-- "Request Approved") until the user finalizes it in the negotiation flow,
-- only then does it become a true running contract.
ALTER TABLE corporate_contract
    ADD COLUMN finalized_at TIMESTAMP NULL AFTER status;
