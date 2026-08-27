package com.trackngo.app.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

/**
 * Rolls every active corporate contract forward to its next monthly billing
 * period and flags overdue invoices. Nightly is frequent enough — billing
 * periods are monthly, nothing here is time-sensitive to the hour.
 */
@Service
@Slf4j
@RequiredArgsConstructor
public class CorporateBillingScheduler {

    private final CorporateInvoiceService corporateInvoiceService;

    @Scheduled(cron = "${trackngo.corporate.billing-cycle-cron:0 0 2 * * *}")
    public void runBillingCycle() {
        try {
            corporateInvoiceService.runBillingCycle();
        } catch (Exception ex) {
            log.error("Failed to run corporate billing cycle", ex);
        }
    }
}
