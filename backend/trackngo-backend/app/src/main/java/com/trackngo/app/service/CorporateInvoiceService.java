package com.trackngo.app.service;

import com.stripe.exception.StripeException;
import com.stripe.model.checkout.Session;
import com.trackngo.notification.api.NotificationService;
import com.trackngo.notification.api.dto.NotificationDto;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

/**
 * Monthly per-bus billing for corporate contracts.
 * 
 * Rules:
 * 1. Billing cycle starts from the contract's period start date (start_date), NOT the creation date.
 * 2. Monthly bill is due on the 3rd week of each billing month (period_start + 21 days).
 * 3. Payment reminders are dispatched 3 days before the due date and on the due date.
 * 4. Split across assigned buses according to the contract's monthly calculation.
 * 5. On contract renewal, the fair carried balance (prorated used portion from predecessor)
 *    is merged directly into the first month's total billing amount (no separate invoice),
 *    and the predecessor contract's unpaid invoices are cancelled to prevent double-paying.
 */
@Service
@Slf4j
@RequiredArgsConstructor
public class CorporateInvoiceService {

    private final JdbcTemplate jdbcTemplate;
    private final NotificationService notificationService;

    /**
     * Creates the first billing period's invoices for a contract, aligned with
     * the contract's start_date and due on the 3rd week (day 21).
     * 
     * If this contract is a renewal with a carried balance, that carried balance is
     * added directly to the first month's total billing amount rather than creating
     * a separate invoice.
     */
    public void generateInvoicesForContract(Long contractId) {
        Map<String, Object> contract = jdbcTemplate.queryForMap(
                "SELECT billing_amount, start_date, carried_balance, renewed_from_contract_id FROM corporate_contract WHERE contract_id = ?", contractId);
        BigDecimal billingAmount = (BigDecimal) contract.get("billing_amount");
        java.sql.Date startDateSql = (java.sql.Date) contract.get("start_date");
        LocalDate periodStart = startDateSql != null ? startDateSql.toLocalDate() : LocalDate.now();
        LocalDate periodEnd = periodStart.plusMonths(1);

        List<Long> busIds = jdbcTemplate.queryForList(
                "SELECT bus_id FROM corporate_contract_bus WHERE contract_id = ?", Long.class, contractId);
        if (busIds.isEmpty() || billingAmount == null) {
            log.warn("Cannot generate invoices for contract {}: no assigned buses or billing amount", contractId);
            return;
        }

        BigDecimal carriedBalance = (BigDecimal) contract.get("carried_balance");
        Long renewedFromId = contract.get("renewed_from_contract_id") != null
                ? ((Number) contract.get("renewed_from_contract_id")).longValue()
                : null;

        BigDecimal firstMonthTotal = billingAmount;
        if (carriedBalance != null && carriedBalance.compareTo(BigDecimal.ZERO) > 0) {
            firstMonthTotal = firstMonthTotal.add(carriedBalance);
        }

        // Insert monthly invoices for each bus for the first period (combined with any carried balance)
        insertPeriodInvoices(contractId, busIds, firstMonthTotal, periodStart, periodEnd);

        // Automatically cancel the predecessor contract's unpaid invoices to prevent double-paying
        if (renewedFromId != null && carriedBalance != null && carriedBalance.compareTo(BigDecimal.ZERO) > 0) {
            jdbcTemplate.update("""
                    UPDATE corporate_invoices
                    SET status = 'cancelled'
                    WHERE contract_id = ? AND status IN ('pending', 'overdue')
                    """, renewedFromId);
            log.info("Cancelled unpaid invoices on predecessor contract {} as fair balance {} was merged into contract {} first month bill",
                    renewedFromId, carriedBalance, contractId);
        }
    }

    /**
     * Scheduled entry point: rolls active, finalized contracts forward to their next
     * billing period, updates overdue status, and triggers 3rd-week due reminders.
     */
    public void runBillingCycle() {
        List<Map<String, Object>> contracts = jdbcTemplate.queryForList("""
                SELECT contract_id, billing_amount
                FROM corporate_contract
                WHERE status = 'active' AND finalized_at IS NOT NULL
                """);
        for (Map<String, Object> contract : contracts) {
            Long contractId = ((Number) contract.get("contract_id")).longValue();
            BigDecimal billingAmount = (BigDecimal) contract.get("billing_amount");
            rollForwardIfDue(contractId, billingAmount);
        }

        // Flag overdue invoices past their 3rd week due date
        jdbcTemplate.update("""
                UPDATE corporate_invoices
                SET status = 'overdue'
                WHERE status = 'pending' AND due_date < CURRENT_DATE
                """);

        // Send payment reminder notifications
        sendPaymentReminders();
    }

    private void rollForwardIfDue(Long contractId, BigDecimal billingAmount) {
        if (billingAmount == null) {
            return;
        }
        List<Long> busIds = jdbcTemplate.queryForList(
                "SELECT bus_id FROM corporate_contract_bus WHERE contract_id = ?", Long.class, contractId);
        if (busIds.isEmpty()) {
            return;
        }

        List<java.sql.Date> latestPeriodEnd = jdbcTemplate.queryForList(
                "SELECT MAX(period_end) FROM corporate_invoices WHERE contract_id = ? AND invoice_type = 'monthly'",
                java.sql.Date.class, contractId);
        LocalDate periodEnd = (!latestPeriodEnd.isEmpty() && latestPeriodEnd.get(0) != null)
                ? latestPeriodEnd.get(0).toLocalDate()
                : LocalDate.now();

        int guard = 0;
        while (periodEnd.isBefore(LocalDate.now()) && guard < 24) {
            LocalDate nextStart = periodEnd;
            LocalDate nextEnd = nextStart.plusMonths(1);
            insertPeriodInvoices(contractId, busIds, billingAmount, nextStart, nextEnd);
            periodEnd = nextEnd;
            guard++;
        }
    }

    private static LocalDate calculateDueDate(LocalDate periodStart, LocalDate periodEnd) {
        LocalDate thirdWeekDue = periodStart.plusDays(21);
        return thirdWeekDue.isAfter(periodEnd) ? periodEnd : thirdWeekDue;
    }

    private void insertPeriodInvoices(
            Long contractId, List<Long> busIds, BigDecimal totalAmount, LocalDate periodStart, LocalDate periodEnd
    ) {
        int busCount = busIds.size();
        BigDecimal perBus = totalAmount.divide(BigDecimal.valueOf(busCount), 2, RoundingMode.DOWN);
        BigDecimal allocated = perBus.multiply(BigDecimal.valueOf(busCount - 1));
        BigDecimal lastBusAmount = totalAmount.subtract(allocated);
        LocalDate dueDate = calculateDueDate(periodStart, periodEnd);

        for (int i = 0; i < busCount; i++) {
            BigDecimal amount = (i == busCount - 1) ? lastBusAmount : perBus;
            jdbcTemplate.update("""
                    INSERT INTO corporate_invoices
                        (contract_id, bus_id, amount, status, period_start, period_end, due_date, invoice_type)
                    VALUES (?, ?, ?, 'pending', ?, ?, ?, 'monthly')
                    """, contractId, busIds.get(i), amount, periodStart, periodEnd, dueDate);
        }
    }

    /**
     * Sends payment reminders to corporate users for bills due on the 3rd week (day 21)
     * and 3 days before (day 18).
     */
    public void sendPaymentReminders() {
        try {
            List<Map<String, Object>> dueInvoices = jdbcTemplate.queryForList("""
                    SELECT i.invoice_number, i.contract_id, i.amount, i.due_date,
                           c.corporate_user_id, c.contract_name
                    FROM corporate_invoices i
                    JOIN corporate_contract c ON c.contract_id = i.contract_id
                    WHERE i.status = 'pending'
                      AND (i.due_date = DATE_ADD(CURRENT_DATE, INTERVAL 3 DAY) OR i.due_date = CURRENT_DATE)
                      AND (i.reminder_sent_at IS NULL OR DATE(i.reminder_sent_at) < CURRENT_DATE)
                    """);

            for (Map<String, Object> row : dueInvoices) {
                Long invoiceNumber = ((Number) row.get("invoice_number")).longValue();
                Long corporateUserId = ((Number) row.get("corporate_user_id")).longValue();
                String contractName = (String) row.get("contract_name");
                BigDecimal amount = (BigDecimal) row.get("amount");
                java.sql.Date dueDateSql = (java.sql.Date) row.get("due_date");
                LocalDate dueDate = dueDateSql.toLocalDate();

                boolean isToday = dueDate.equals(LocalDate.now());
                String title = isToday ? "Corporate Payment Due Today" : "Corporate Payment Due in 3 Days";
                String message = isToday
                        ? String.format("Invoice #%d for \"%s\" (Rs. %s) is due today (3rd week of billing cycle). Please complete payment.",
                                invoiceNumber, contractName, amount)
                        : String.format("Invoice #%d for \"%s\" (Rs. %s) is due on %s (3rd week of billing cycle).",
                                invoiceNumber, contractName, amount, dueDate);

                NotificationDto notif = new NotificationDto();
                notif.setNotificationType("system_alert");
                notif.setTitle(title);
                notif.setMessage(message);
                notif.setCorporateUserId(corporateUserId);
                notif.setRead(false);
                notificationService.create(notif);

                jdbcTemplate.update("UPDATE corporate_invoices SET reminder_sent_at = CURRENT_TIMESTAMP WHERE invoice_number = ?", invoiceNumber);
            }
        } catch (Exception ex) {
            log.warn("Failed to send corporate payment reminders", ex);
        }
    }

    /**
     * Verifies and records payment of one invoice via Stripe.
     */
    public void payInvoice(Long invoiceNumber, String stripeSessionId) {
        if (stripeSessionId == null || stripeSessionId.isBlank()) {
            throw new IllegalArgumentException("Stripe session is required.");
        }
        List<Map<String, Object>> rows = jdbcTemplate.queryForList(
                "SELECT amount, status FROM corporate_invoices WHERE invoice_number = ?", invoiceNumber);
        if (rows.isEmpty()) {
            throw new IllegalArgumentException("Invoice not found.");
        }
        Map<String, Object> row = rows.get(0);
        String status = (String) row.get("status");
        if ("paid".equalsIgnoreCase(status)) {
            return;
        }
        if ("cancelled".equalsIgnoreCase(status)) {
            throw new IllegalStateException("This invoice has been cancelled.");
        }
        BigDecimal amount = (BigDecimal) row.get("amount");

        try {
            Session session = Session.retrieve(stripeSessionId);
            String orderId = session.getMetadata() == null ? "" : session.getMetadata().getOrDefault("order_id", "");
            long expectedCents = amount.setScale(2, RoundingMode.HALF_UP).movePointRight(2).longValueExact();
            if (!("CORP-INV-" + invoiceNumber).equals(orderId)
                    || !"paid".equalsIgnoreCase(session.getPaymentStatus())
                    || session.getAmountTotal() == null
                    || session.getAmountTotal() != expectedCents) {
                throw new IllegalStateException("Stripe payment could not be verified for this invoice.");
            }

            jdbcTemplate.update("""
                    UPDATE corporate_invoices
                    SET status = 'paid', paid_at = CURRENT_TIMESTAMP, stripe_transaction_id = ?
                    WHERE invoice_number = ?
                    """, session.getPaymentIntent(), invoiceNumber);
        } catch (StripeException e) {
            throw new IllegalStateException("Stripe payment verification failed.", e);
        }
    }
}
