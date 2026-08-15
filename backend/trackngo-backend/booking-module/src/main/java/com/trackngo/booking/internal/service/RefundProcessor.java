package com.trackngo.booking.internal.service;

import com.stripe.Stripe;
import com.stripe.exception.StripeException;
import com.stripe.model.Refund;
import com.stripe.net.RequestOptions;
import com.stripe.param.RefundCreateParams;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

/**
 * Processes disruption refunds after the cancellation transaction commits.
 * Stripe idempotency keys make retries safe if multiple app instances run it.
 */
@Service
public class RefundProcessor {

    private static final Logger log = LoggerFactory.getLogger(RefundProcessor.class);

    private final JdbcTemplate jdbc;

    @Value("${stripe.secret-key:}")
    private String stripeSecretKey;

    public RefundProcessor(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @Scheduled(fixedDelayString = "${trackngo.refunds.poll-ms:1000}")
    public void processPendingStripeRefunds() {
        if (stripeSecretKey == null || stripeSecretKey.isBlank()) {
            return;
        }

        List<Map<String, Object>> rows = jdbc.queryForList("""
                SELECT r.refund_id,
                       r.refund_amount,
                       r.disruption_key,
                       sb.passenger_id,
                       p.payment_id,
                       p.provider_transaction_id
                FROM refund r
                JOIN payment p ON p.payment_id = r.payment_id
                JOIN seat_booking sb ON sb.payment_id = p.payment_id
                WHERE r.refund_status = 'pending'
                  AND p.payment_method = 'stripe'
                  AND p.provider_transaction_id IS NOT NULL
                  AND p.provider_transaction_id <> ''
                ORDER BY r.refund_id
                LIMIT 25
                """);

        if (!rows.isEmpty()) {
            log.info("Processing {} pending Stripe disruption refund(s)", rows.size());
        }

        Stripe.apiKey = stripeSecretKey;
        for (Map<String, Object> row : rows) {
            processOne(row);
        }
    }

    private void processOne(Map<String, Object> row) {
        Long refundId = number(row.get("refund_id"));
        Long paymentId = number(row.get("payment_id"));
        Long passengerId = number(row.get("passenger_id"));
        String providerTransactionId = (String) row.get("provider_transaction_id");
        String disruptionKey = (String) row.get("disruption_key");
        BigDecimal amount = (BigDecimal) row.get("refund_amount");

        try {
            RefundCreateParams params = RefundCreateParams.builder()
                    .setPaymentIntent(providerTransactionId)
                    .setAmount(amount.movePointRight(2).longValueExact())
                    .putMetadata("disruption_key", disruptionKey)
                    .build();
            RequestOptions options = RequestOptions.builder()
                    .setIdempotencyKey(disruptionKey)
                    .build();
            Refund refund = Refund.create(params, options);

            int processed = jdbc.update("""
                    UPDATE refund
                    SET refund_status = 'processed',
                        provider_refund_id = ?,
                        processed_date = CURRENT_TIMESTAMP,
                        attempt_count = attempt_count + 1,
                        last_error = NULL
                    WHERE refund_id = ? AND refund_status = 'pending'
                    """, refund.getId(), refundId);
            if (processed == 1) {
                jdbc.update("UPDATE payment SET payment_status = 'refunded' WHERE payment_id = ?", paymentId);
                jdbc.update("""
                        INSERT INTO notification
                            (notification_type, title, message, passenger_id)
                        VALUES ('payment', ?, ?, ?)
                        """,
                        "Refund processed",
                        "Your disruption refund of LKR " + amount + " has been processed successfully.",
                        passengerId
                );
            }
        } catch (StripeException | ArithmeticException ex) {
            jdbc.update("""
                    UPDATE refund
                    SET attempt_count = attempt_count + 1,
                        last_error = ?
                    WHERE refund_id = ? AND refund_status = 'pending'
                    """, ex.getMessage(), refundId);
            log.warn("Refund {} failed and will be retried: {}", refundId, ex.getMessage());
        } catch (RuntimeException ex) {
            jdbc.update("""
                    UPDATE refund
                    SET attempt_count = attempt_count + 1,
                        last_error = ?
                    WHERE refund_id = ? AND refund_status = 'pending'
                    """, ex.getMessage(), refundId);
            log.error("Unexpected refund-processing failure for refund {}; it will be retried", refundId, ex);
        }
    }

    private Long number(Object value) {
        return value == null ? null : ((Number) value).longValue();
    }
}
