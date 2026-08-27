-- Tracks whether the one-time "your contract is expiring soon, renew it"
-- reminder has already been sent for a contract, so the daily scheduler
-- (CorporateRenewalReminderScheduler) doesn't re-notify admin and the
-- corporate client every day for the same contract.
ALTER TABLE corporate_contract
    ADD COLUMN renewal_reminder_sent_at DATETIME NULL;
