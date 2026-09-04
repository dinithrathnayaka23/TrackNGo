package com.trackngo.booking.internal.service;

import com.stripe.exception.StripeException;
import com.stripe.model.checkout.Session;
import com.stripe.net.RequestOptions;
import com.trackngo.commons.exception.BusinessException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;

/**
 * Asks Stripe directly whether a Checkout Session was actually paid.
 *
 * The passenger's device reports the outcome of a payment it just made, which is
 * exactly the claim an attacker would forge to turn a held seat into a ticket
 * without paying. Settling a reservation therefore ignores what the app says and
 * re-reads the session from Stripe, using the secret key that only the server
 * holds.
 */
@Service
@Slf4j
public class StripeSessionVerifier {

    private final String secretKey;

    public StripeSessionVerifier(@Value("${stripe.secret-key}") String secretKey) {
        this.secretKey = secretKey;
    }

    /** What Stripe says about a session, once it has been checked against the booking. */
    public record VerifiedPayment(String paymentIntentId, BigDecimal amountPaid) {}

    /**
     * Confirms that {@code sessionId} was paid, was created for {@code expectedOrderId},
     * and covers {@code expectedAmount}.
     *
     * The order id is carried in the session's own metadata, so a session paid for a
     * different booking cannot be replayed against this one, and a cheap session
     * cannot settle an expensive reservation.
     *
     * @throws BusinessException when the session is unpaid, belongs elsewhere, or is short.
     */
    public VerifiedPayment verifyPaidFor(String sessionId, String expectedOrderId, BigDecimal expectedAmount) {
        if (sessionId == null || sessionId.isBlank()) {
            throw new BusinessException("A Stripe session id is required to confirm this payment.");
        }

        Session session;
        try {
            session = Session.retrieve(
                    sessionId,
                    RequestOptions.builder().setApiKey(secretKey).build());
        } catch (StripeException ex) {
            log.warn("[Stripe] Could not retrieve session '{}' while settling '{}': {}",
                    sessionId, expectedOrderId, ex.getMessage());
            throw new BusinessException("We could not confirm that payment with Stripe. Please try again.");
        }

        if (!"paid".equalsIgnoreCase(session.getPaymentStatus())) {
            throw new BusinessException("That payment has not completed, so the booking was left reserved.");
        }

        String orderId = session.getMetadata() == null
                ? null
                : session.getMetadata().get("order_id");
        if (orderId == null || !orderId.equals(expectedOrderId)) {
            log.warn("[Stripe] Session '{}' carries order '{}' but was presented for '{}'",
                    sessionId, orderId, expectedOrderId);
            throw new BusinessException("That payment belongs to a different booking.");
        }

        // Stripe works in the currency's smallest unit; LKR amounts are sent as cents.
        BigDecimal amountPaid = BigDecimal.valueOf(
                        session.getAmountTotal() == null ? 0L : session.getAmountTotal())
                .divide(new BigDecimal("100"), 2, RoundingMode.HALF_UP);

        if (expectedAmount != null && amountPaid.compareTo(expectedAmount) < 0) {
            log.warn("[Stripe] Session '{}' paid {} against an expected {} for '{}'",
                    sessionId, amountPaid, expectedAmount, expectedOrderId);
            throw new BusinessException("The amount paid does not cover this booking.");
        }

        return new VerifiedPayment(
                session.getPaymentIntent() == null ? sessionId : session.getPaymentIntent(),
                amountPaid);
    }
}
