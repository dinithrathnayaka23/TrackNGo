package com.trackngo.app.service;

import com.stripe.exception.StripeException;
import com.stripe.model.checkout.Session;
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
 * Monthly per-bus billing for corporate contracts. A contract's single
 * monthly {@code billing_amount} is split equally across its assigned buses
 * (any odd cent goes to the last bus so the split sums exactly) — the
 * pricing model prices the whole contract, not per bus, so an equal split is
 * the simplest defensible allocation. Payment reuses the same Stripe
 * checkout-session flow already proven for the advance deposit
 * ({@link CorporateService#processAdvancePayment}).
 */
@Service
@Slf4j
@RequiredArgsConstructor
public class CorporateInvoiceService {

    private final JdbcTemplate jdbcTemplate;

    /**
     * Creates the first billing period's invoices for a contract, one per
     * assigned bus. Called once, right after the contract is finalized.
     */
    public void generateInvoicesForContract(Long contractId) {
        Map<String, Object> contract = jdbcTemplate.queryForMap(
                "SELECT billing_amount FROM corporate_contract WHERE contract_id = ?", contractId);
        BigDecimal billingAmount = (BigDecimal) contract.get("billing_amount");
        List<Long> busIds = jdbcTemplate.queryForList(
                "SELECT bus_id FROM corporate_contract_bus WHERE contract_id = ?", Long.class, contractId);
        if (busIds.isEmpty() || billingAmount == null) {
            log.warn("Cannot generate invoices for contract {}: no assigned buses or billing amount", contractId);
            return;
        }
        LocalDate periodStart = LocalDate.now();
        LocalDate periodEnd = periodStart.plusMonths(1);
        insertPeriodInvoices(contractId, busIds, billingAmount, periodStart, periodEnd);
    }

    /**
     * Scheduled entry point: rolls every active, finalized contract forward
     * to its next billing period once the current one has ended (looping in
     * case more than one period has elapsed), and flags overdue invoices.
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

        jdbcTemplate.update("""
                UPDATE corporate_invoices
                SET status = 'overdue'
                WHERE status = 'pending' AND due_date < CURRENT_DATE
                """);
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
                "SELECT MAX(period_end) FROM corporate_invoices WHERE contract_id = ?", java.sql.Date.class, contractId);
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

    private void insertPeriodInvoices(
            Long contractId, List<Long> busIds, BigDecimal totalAmount, LocalDate periodStart, LocalDate periodEnd
    ) {
        int busCount = busIds.size();
        BigDecimal perBus = totalAmount.divide(BigDecimal.valueOf(busCount), 2, RoundingMode.DOWN);
        BigDecimal allocated = perBus.multiply(BigDecimal.valueOf(busCount - 1));
        BigDecimal lastBusAmount = totalAmount.subtract(allocated);

        for (int i = 0; i < busCount; i++) {
            BigDecimal amount = (i == busCount - 1) ? lastBusAmount : perBus;
            jdbcTemplate.update("""
                    INSERT INTO corporate_invoices
                        (contract_id, bus_id, amount, status, period_start, period_end, due_date)
                    VALUES (?, ?, ?, 'pending', ?, ?, ?)
                    """, contractId, busIds.get(i), amount, periodStart, periodEnd, periodEnd);
        }
    }

    /**
     * Verifies and records payment of one invoice — mirrors
     * {@link CorporateService#processAdvancePayment} exactly.
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
        // Idempotent on retry — see CorporateService.processAdvancePayment for why.
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
