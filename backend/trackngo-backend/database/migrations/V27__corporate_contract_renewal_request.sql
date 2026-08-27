-- Two-step contract renewal: the corporate client first asks admin for
-- permission to renew (renewal_request_status), and only once admin approves
-- can the client submit the actual renewal contract through the normal
-- create-and-approve pipeline. renewed_from_contract_id tags that new
-- contract as a renewal of this one, so approving it waives the advance
-- deposit instead of requiring a fresh one (enforced in
-- CorporateService.updateContractStatus).
ALTER TABLE corporate_contract
    ADD COLUMN renewal_request_status ENUM('none', 'requested', 'approved', 'declined') NOT NULL DEFAULT 'none',
    ADD COLUMN renewed_from_contract_id BIGINT NULL;
