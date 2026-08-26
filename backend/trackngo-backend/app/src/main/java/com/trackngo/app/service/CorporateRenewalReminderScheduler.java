package com.trackngo.app.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

/**
 * Notifies admin and the corporate client once a contract is nearing its end
 * date, so a contract that runs up to its one-year maximum term doesn't just
 * silently lapse. Mirrors the scheduling pattern already used by
 * {@code CorporateCancellationScheduler}.
 */
@Service
@Slf4j
@RequiredArgsConstructor
public class CorporateRenewalReminderScheduler {

    private final CorporateService corporateService;

    @Scheduled(cron = "${trackngo.corporate.renewal-reminder-cron:0 0 8 * * *}")
    public void sendRenewalReminders() {
        try {
            corporateService.sendRenewalReminders();
        } catch (Exception ex) {
            log.error("Failed to process corporate contract renewal reminders", ex);
        }
    }
}
