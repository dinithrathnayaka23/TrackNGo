package com.trackngo.booking.internal.controller;

import com.stripe.Stripe;
import com.stripe.exception.StripeException;
import com.stripe.model.checkout.Session;
import com.stripe.param.checkout.SessionCreateParams;
import com.trackngo.commons.ApiResponse;
import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/booking-flow/stripe")
public class StripeController {

    private static final Logger log = LoggerFactory.getLogger(StripeController.class);

    @Value("${stripe.secret-key}")
    private String secretKey;

    @Value("${stripe.publishable-key}")
    private String publishableKey;

    @PostConstruct
    public void init() {
        Stripe.apiKey = secretKey;
        log.info("[Stripe] Initialized with publishable key: {}...{}", 
                publishableKey.substring(0, Math.min(12, publishableKey.length())),
                publishableKey.substring(Math.max(0, publishableKey.length() - 4)));
    }

    /**
     * Create a Stripe Checkout Session.
     * The mobile app opens the returned URL in a WebView.
     */
    @PostMapping("/create-checkout-session")
    public ApiResponse<Map<String, String>> createCheckoutSession(@RequestBody CheckoutRequest request) {
        try {
            long amountInCents = Math.round(request.amount() * 100);

            SessionCreateParams params = SessionCreateParams.builder()
                    .setMode(SessionCreateParams.Mode.PAYMENT)
                    .setSuccessUrl(request.successUrl())
                    .setCancelUrl(request.cancelUrl())
                    .setCustomerEmail(request.email())
                    .addLineItem(
                            SessionCreateParams.LineItem.builder()
                                    .setQuantity(1L)
                                    .setPriceData(
                                            SessionCreateParams.LineItem.PriceData.builder()
                                                    .setCurrency(request.currency().toLowerCase())
                                                    .setUnitAmount(amountInCents)
                                                    .setProductData(
                                                            SessionCreateParams.LineItem.PriceData.ProductData.builder()
                                                                    .setName(request.itemName())
                                                                    .setDescription(request.itemDescription())
                                                                    .build()
                                                    )
                                                    .build()
                                    )
                                    .build()
                    )
                    .putMetadata("order_id", request.orderId())
                    .build();

            Session session = Session.create(params);

            log.info("[Stripe] Created checkout session '{}' for order '{}', amount={} {}",
                    session.getId(), request.orderId(), request.amount(), request.currency());

            return ApiResponse.ok("Checkout session created", Map.of(
                    "sessionId", session.getId(),
                    "url", session.getUrl()
            ));
        } catch (StripeException e) {
            log.error("[Stripe] Failed to create checkout session for order '{}'", request.orderId(), e);
            return ApiResponse.fail("Failed to create payment session: " + e.getMessage());
        }
    }

    /**
     * Verify a Stripe Checkout Session status.
     * Called by mobile app after redirect to check if payment succeeded.
     */
    @GetMapping("/session-status")
    public ApiResponse<Map<String, String>> getSessionStatus(@RequestParam String sessionId) {
        try {
            Session session = Session.retrieve(sessionId);
            String paymentStatus = session.getPaymentStatus();
            String orderId = session.getMetadata().getOrDefault("order_id", "");

            log.info("[Stripe] Session '{}' status='{}', paymentStatus='{}', orderId='{}'",
                    sessionId, session.getStatus(), paymentStatus, orderId);

            return ApiResponse.ok("Session status retrieved", Map.of(
                    "status", session.getStatus(),
                    "paymentStatus", paymentStatus,
                    "orderId", orderId,
                    "paymentIntentId", session.getPaymentIntent() != null ? session.getPaymentIntent() : ""
            ));
        } catch (StripeException e) {
            log.error("[Stripe] Failed to retrieve session '{}'", sessionId, e);
            return ApiResponse.fail("Failed to retrieve session: " + e.getMessage());
        }
    }

    /**
     * Success page — Stripe redirects here after payment.
     * Sends a postMessage to React Native WebView.
     */
    @GetMapping("/success")
    public ResponseEntity<String> successPage(
            @RequestParam(name = "session_id") String sessionId) {
        log.info("[Stripe] Success redirect for session '{}'", sessionId);
        String html = resultPage("completed", sessionId, true);
        return ResponseEntity.ok().contentType(MediaType.TEXT_HTML).body(html);
    }

    /**
     * Cancel page — Stripe redirects here when user cancels.
     */
    @GetMapping("/cancel")
    public ResponseEntity<String> cancelPage(
            @RequestParam(name = "session_id", required = false, defaultValue = "") String sessionId) {
        log.info("[Stripe] Cancel redirect for session '{}'", sessionId);
        String html = resultPage("cancelled", sessionId, false);
        return ResponseEntity.ok().contentType(MediaType.TEXT_HTML).body(html);
    }

    // ── Helpers ────────────────────────────────────────────

    private String resultPage(String type, String sessionId, boolean success) {
        return "<!DOCTYPE html><html><head>"
                + "<meta name='viewport' content='width=device-width,initial-scale=1.0'>"
                + "<style>body{margin:0;display:flex;justify-content:center;align-items:center;"
                + "height:100vh;font-family:sans-serif;background:#F6F7F9;}"
                + ".msg{text-align:center;color:#64748B;}"
                + ".icon{font-size:48px;margin-bottom:12px;}</style></head><body>"
                + "<div class='msg'>"
                + (success ? "<div class='icon'>&#10004;</div><p>Payment successful!</p>"
                        : "<div class='icon'>&#10060;</div><p>Payment cancelled</p>")
                + "<p style='font-size:12px;color:#94A3B8;'>Returning to app...</p></div>"
                + "<script>"
                + "if(window.ReactNativeWebView){"
                + "window.ReactNativeWebView.postMessage(JSON.stringify({"
                + "type:'" + type + "',"
                + "sessionId:'" + escJs(sessionId) + "'"
                + "}));"
                + "}else{"
                + "setTimeout(function(){window.close();},2000);"
                + "}</script></body></html>";
    }

    private static String escJs(String s) {
        if (s == null) return "";
        return s.replace("\\", "\\\\").replace("'", "\\'").replace("\"", "\\\"");
    }

    public record CheckoutRequest(
            String orderId,
            double amount,
            String currency,
            String itemName,
            String itemDescription,
            String email,
            String successUrl,
            String cancelUrl
    ) {}
}
