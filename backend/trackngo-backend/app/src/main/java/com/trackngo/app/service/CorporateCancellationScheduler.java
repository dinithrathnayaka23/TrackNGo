package com.trackngo.app.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

/**
 * Cancels active contracts whose admin-initiated, corporate-accepted
 * cancellation notice period has elapsed. Mirrors the scheduling pattern
 * already used by {@code RefundProcessor} in the booking module.
 */
@Service
@Slf4j
@RequiredArgsConstructor
public class CorporateCancellationScheduler {

    private final CorporateService corporateService;

    @Scheduled(fixedDelayString = "${trackngo.corporate.cancellation-poll-ms:3600000}")
    public void expireDueCancellations() {
        try {
            corporateService.expireDueCancellations();
        } catch (Exception ex) {
            log.error("Failed to process due corporate contract cancellations", ex);
        }
    }
}
