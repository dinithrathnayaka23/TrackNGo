-- Mutual-consent cancellation: either the corporate client or admin can
-- request to cancel a pending or active contract with a reason, and the
-- other party must accept before anything actually changes. An
-- admin-initiated cancellation of an already-active contract carries a
-- minimum 2-week notice period (cancel_effective_date), enforced in
-- CorporateService.requestCancellation rather than in the database.
ALTER TABLE corporate_contract
    ADD COLUMN cancel_status ENUM('none', 'pending', 'accepted', 'rejected') NOT NULL DEFAULT 'none',
    ADD COLUMN cancel_requested_by ENUM('admin', 'corporate') NULL,
    ADD COLUMN cancel_reason VARCHAR(500) NULL,
    ADD COLUMN cancel_requested_at TIMESTAMP NULL,
    ADD COLUMN cancel_effective_date DATE NULL,
    ADD COLUMN cancel_response_reason VARCHAR(500) NULL;
