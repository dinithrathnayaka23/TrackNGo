package com.trackngo.booking.internal.controller;

import com.trackngo.commons.ApiResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.Map;

@RestController
@RequestMapping("/api/booking-flow/payhere")
public class PayHereController {

    private static final Logger log = LoggerFactory.getLogger(PayHereController.class);

    @Value("${payhere.merchant-id}")
    private String merchantId;

    @Value("${payhere.merchant-secret}")
    private String merchantSecret;

    @Value("${payhere.sandbox:true}")
    private boolean sandbox;

    /**
     * Generate the PayHere checkout hash.
     */
    @PostMapping("/hash")
    public ApiResponse<Map<String, String>> generateHash(@RequestBody HashRequest request) {
        String mid = merchantId.trim();
        String secret = merchantSecret.trim();
        logPayHereConfig(mid, secret);

        String amountFormatted = new BigDecimal(request.amount())
                .setScale(2, RoundingMode.HALF_UP)
                .toPlainString();

        String secretHash = md5(secret).toUpperCase();
        String raw = mid + request.orderId() + amountFormatted + request.currency() + secretHash;
        String hash = md5(raw).toUpperCase();

        log.info("[PayHere Hash] merchantId='{}', orderId='{}', amount='{}', currency='{}', secretLen={}, secretHash='{}', hash='{}'",
                mid, request.orderId(), amountFormatted, request.currency(),
                secret.length(), secretHash, hash);

        return ApiResponse.ok("Hash generated", Map.of(
                "merchant_id", mid,
                "hash", hash
        ));
    }

    /**
     * Quick browser test page — open http://localhost:8080/api/booking-flow/payhere/test
     * in your COMPUTER's browser to isolate domain/origin issues.
     */
    @GetMapping("/test")
    public ResponseEntity<String> testPage() {
        String mid = merchantId.trim();
        String secret = merchantSecret.trim();
        String orderId = "TEST-" + System.currentTimeMillis();
        String amount = "50.00";
        String currency = "LKR";

        String secretHash = md5(secret).toUpperCase();
        String raw = mid + orderId + amount + currency + secretHash;
        String hash = md5(raw).toUpperCase();

        log.info("[PayHere TEST] mid='{}', orderId='{}', amount='{}', currency='{}', secretHash='{}', hash='{}'",
                mid, orderId, amount, currency, secretHash, hash);

        String html = "<!DOCTYPE html><html><head>"
                + "<meta charset='UTF-8'>"
                + "<script src='https://www.payhere.lk/lib/payhere.js'></script>"
                + "</head><body>"
                + "<h2>PayHere Sandbox Test</h2>"
                + "<p>Merchant ID: " + escHtml(mid) + "</p>"
                + "<p>Order: " + escHtml(orderId) + "</p>"
                + "<p>Amount: " + amount + " " + currency + "</p>"
                + "<p>Hash: " + escHtml(hash) + "</p>"
                + "<button id='payBtn' style='padding:12px 24px;font-size:16px;cursor:pointer;'>Pay with PayHere</button>"
                + "<pre id='log' style='margin-top:20px;background:#f0f0f0;padding:12px;'></pre>"
                + "<script>"
                + "function log(msg){document.getElementById('log').textContent += msg + '\\n';}"
                + "payhere.onCompleted = function(orderId){log('SUCCESS orderId=' + orderId);};"
                + "payhere.onDismissed = function(){log('DISMISSED');};"
                + "payhere.onError = function(err){log('ERROR: ' + err);};"
                + "document.getElementById('payBtn').onclick = function(){"
                + "  log('Starting payment...');"
                + "  payhere.startPayment({"
                + "    sandbox: true,"
                + "    merchant_id: '" + escJs(mid) + "',"
                + "    return_url: undefined,"
                + "    cancel_url: undefined,"
                + "    notify_url: 'http://localhost:8080/api/booking-flow/payhere/notify',"
                + "    order_id: '" + escJs(orderId) + "',"
                + "    items: 'Test Item',"
                + "    amount: '" + amount + "',"
                + "    currency: '" + currency + "',"
                + "    hash: '" + escJs(hash) + "',"
                + "    first_name: 'John',"
                + "    last_name: 'Doe',"
                + "    email: 'john@example.com',"
                + "    phone: '0771234567',"
                + "    address: 'No.1 Test St',"
                + "    city: 'Colombo',"
                + "    country: 'Sri Lanka'"
                + "  });"
                + "};"
                + "</script></body></html>";

        return ResponseEntity.ok().contentType(MediaType.TEXT_HTML).body(html);
    }

    /**
     * Serve an HTML page that auto-submits a form POST to PayHere's checkout.
     * This avoids JS SDK origin restrictions — works from any WebView origin.
     */
    @GetMapping("/checkout")
    public ResponseEntity<String> checkoutPage(
            @RequestParam String order_id,
            @RequestParam String amount,
            @RequestParam String currency,
            @RequestParam String items,
            @RequestParam String first_name,
            @RequestParam String last_name,
            @RequestParam String email,
            @RequestParam String phone,
            @RequestParam String address,
            @RequestParam String city,
            @RequestParam String country,
            @RequestParam String base_url
    ) {
        String mid = merchantId.trim();
        String secret = merchantSecret.trim();
        logPayHereConfig(mid, secret);

        String amountFormatted = new BigDecimal(amount)
                .setScale(2, RoundingMode.HALF_UP)
                .toPlainString();

        String secretHash = md5(secret).toUpperCase();
        String raw = mid + order_id + amountFormatted + currency + secretHash;
        String hash = md5(raw).toUpperCase();

        String normalizedBaseUrl = base_url.endsWith("/")
                ? base_url.substring(0, base_url.length() - 1)
                : base_url;

        String notifyUrl = normalizedBaseUrl + "/api/booking-flow/payhere/notify";
        String returnUrl = normalizedBaseUrl + "/api/booking-flow/payhere/return?order_id=" + order_id;
        String cancelUrl = normalizedBaseUrl + "/api/booking-flow/payhere/cancel?order_id=" + order_id;
        String checkoutAction = sandbox
                ? "https://sandbox.payhere.lk/pay/checkout"
                : "https://www.payhere.lk/pay/checkout";
        String secretTail = secret.length() <= 6 ? secret : secret.substring(secret.length() - 6);

        log.info("[PayHere Checkout v2] sandbox={}, checkoutAction='{}', merchantId='{}', secretLen={}, secretTail='{}', orderId='{}', amount='{}', currency='{}', hash='{}', notifyHost='{}'",
                sandbox, checkoutAction, mid, secret.length(), secretTail, order_id, amountFormatted, currency, hash, normalizedBaseUrl);

        String html = "<!DOCTYPE html>\n"
                + "<html><head><meta charset='UTF-8'>\n"
                + "<meta name='viewport' content='width=device-width,initial-scale=1.0'>\n"
                + "<meta name='referrer' content='no-referrer'>\n"
                + "<style>body{margin:0;display:flex;justify-content:center;align-items:center;"
                + "height:100vh;font-family:sans-serif;background:#F6F7F9;}"
                + ".msg{color:#64748B;text-align:center;}"
                + ".spinner{margin:0 auto 16px;width:40px;height:40px;"
                + "border:4px solid #E2E8F0;border-top-color:#1474F2;"
                + "border-radius:50%;animation:spin .8s linear infinite;}"
                + "@keyframes spin{to{transform:rotate(360deg);}}</style>\n"
                + "</head><body>\n"
                + "<div class='msg'><div class='spinner'></div><p>Redirecting to PayHere...</p></div>\n"
                + "<form id='phForm' method='POST' action='" + escHtml(checkoutAction) + "'>\n"
                + hidden("merchant_id", mid)
                + hidden("return_url", returnUrl)
                + hidden("cancel_url", cancelUrl)
                + hidden("notify_url", notifyUrl)
                + hidden("order_id", order_id)
                + hidden("items", items)
                + hidden("currency", currency)
                + hidden("amount", amountFormatted)
                + hidden("first_name", first_name)
                + hidden("last_name", last_name)
                + hidden("email", email)
                + hidden("phone", phone)
                + hidden("address", address)
                + hidden("city", city)
                + hidden("country", country)
                + hidden("hash", hash)
                + "</form>\n"
                + "<script>document.getElementById('phForm').submit();</script>\n"
                + "</body></html>";

        return ResponseEntity.ok()
                .contentType(MediaType.TEXT_HTML)
                .body(html);
    }

    /**
     * Return URL — PayHere redirects here after successful payment.
     * Serves a page that sends a postMessage to the React Native WebView.
     */
    @GetMapping("/return")
    public ResponseEntity<String> returnPage(@RequestParam String order_id) {
        log.info("[PayHere Return] orderId='{}'", order_id);
        return ResponseEntity.ok()
                .contentType(MediaType.TEXT_HTML)
                .body(postMessagePage("completed", order_id));
    }

    /**
     * Cancel URL — PayHere redirects here when user cancels.
     */
    @GetMapping("/cancel")
    public ResponseEntity<String> cancelPage(@RequestParam String order_id) {
        log.info("[PayHere Cancel] orderId='{}'", order_id);
        return ResponseEntity.ok()
                .contentType(MediaType.TEXT_HTML)
                .body(postMessagePage("cancelled", order_id));
    }

    /**
     * PayHere server-side payment notification callback.
     */
    @PostMapping("/notify")
    public String paymentNotify(
            @RequestParam String merchant_id,
            @RequestParam String order_id,
            @RequestParam String payhere_amount,
            @RequestParam String payhere_currency,
            @RequestParam int status_code,
            @RequestParam String md5sig
    ) {
        String secretHash = md5(merchantSecret.trim()).toUpperCase();
        String localSig = md5(
                merchant_id + order_id + payhere_amount + payhere_currency + status_code + secretHash
        ).toUpperCase();

        if (!localSig.equals(md5sig)) {
            log.warn("[PayHere Notify] INVALID signature for order '{}'", order_id);
            return "INVALID_SIGNATURE";
        }

        log.info("[PayHere Notify] orderId='{}', status={}", order_id, status_code);

        if (status_code == 2) {
            return "OK";
        }
        return "STATUS_" + status_code;
    }

    // ── Helpers ────────────────────────────────────────────

    private String postMessagePage(String type, String orderId) {
        return "<!DOCTYPE html><html><head>"
                + "<meta name='viewport' content='width=device-width,initial-scale=1.0'>"
                + "<style>body{margin:0;display:flex;justify-content:center;align-items:center;"
                + "height:100vh;font-family:sans-serif;background:#F6F7F9;}"
                + ".msg{text-align:center;color:#64748B;}"
                + ".icon{font-size:48px;margin-bottom:12px;}</style></head><body>"
                + "<div class='msg'>"
                + (type.equals("completed") ? "<div class='icon'>✅</div><p>Payment successful!</p>" : "<div class='icon'>❌</div><p>Payment cancelled</p>")
                + "<p style='font-size:12px;color:#94A3B8;'>Returning to app...</p></div>"
                + "<script>"
                + "if(window.ReactNativeWebView){"
                + "window.ReactNativeWebView.postMessage(JSON.stringify({type:'" + type + "',orderId:'" + escJs(orderId) + "'}));"
                + "}else{"
                + "setTimeout(function(){window.close();},2000);"
                + "}</script></body></html>";
    }

    private static String hidden(String name, String value) {
        return "<input type='hidden' name='" + escHtml(name) + "' value='" + escHtml(value) + "'/>\n";
    }

    private static String escHtml(String s) {
        if (s == null) return "";
        return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
                .replace("\"", "&quot;").replace("'", "&#39;");
    }

    private static String escJs(String s) {
        if (s == null) return "";
        return s.replace("\\", "\\\\").replace("'", "\\'").replace("\"", "\\\"");
    }

    private void logPayHereConfig(String mid, String secret) {
        String tail = secret.length() <= 6 ? secret : secret.substring(secret.length() - 6);
        log.info("[PayHere Config] sandbox={}, merchantId='{}', secretLength={}, secretTail='{}'",
                sandbox, mid, secret.length(), tail);
    }

    private String md5(String input) {
        try {
            MessageDigest md = MessageDigest.getInstance("MD5");
            byte[] digest = md.digest(input.getBytes(StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder();
            for (byte b : digest) {
                sb.append(String.format("%02x", b));
            }
            return sb.toString();
        } catch (NoSuchAlgorithmException e) {
            throw new RuntimeException("MD5 not available", e);
        }
    }

    public record HashRequest(String orderId, String amount, String currency) {}
}
