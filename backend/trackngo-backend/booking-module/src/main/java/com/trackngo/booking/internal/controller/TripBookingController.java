package com.trackngo.booking.internal.controller;

import com.trackngo.booking.api.dto.TripBookingRequest;
import com.trackngo.booking.api.dto.TripBusResponse;
import com.trackngo.booking.api.dto.TripPaymentRequest;
import com.trackngo.booking.api.dto.TripBookingReviewRequest;
import com.trackngo.booking.internal.entity.TripBooking;
import com.trackngo.booking.internal.service.TripBookingService;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/trips")
@CrossOrigin(originPatterns = "*")
@RequiredArgsConstructor
public class TripBookingController {

    private final TripBookingService tripBookingService;
    private final JdbcTemplate jdbc;

    @GetMapping("/available-buses")
    public List<TripBusResponse> getAvailableBuses(
            @RequestParam(defaultValue = "1") int passengers,
            @RequestParam(required = false) String requirement,
            @RequestParam(required = false) @org.springframework.format.annotation.DateTimeFormat(iso = org.springframework.format.annotation.DateTimeFormat.ISO.DATE) java.time.LocalDate startDate,
            @RequestParam(required = false) @org.springframework.format.annotation.DateTimeFormat(iso = org.springframework.format.annotation.DateTimeFormat.ISO.DATE) java.time.LocalDate returnDate,
            @RequestParam(required = false) Long bookingId) {
        return tripBookingService.getAvailableBuses(passengers, requirement, startDate, returnDate, bookingId);
    }

    @PostMapping("/book")
    public TripBooking bookTrip(@RequestBody TripBookingRequest request, Authentication authentication) {
        return tripBookingService.createBooking(request, currentUserId(authentication));
    }

    @GetMapping("/book/{id}")
    public TripBooking getBookingById(@PathVariable Long id, Authentication authentication) {
        return tripBookingService.getOwnedBooking(id, currentUserId(authentication));
    }

    @PutMapping("/book/{id}/bus")
    public TripBooking assignBus(@PathVariable Long id, @RequestParam Long busId, Authentication authentication) {
        return tripBookingService.assignBus(id, busId, currentUserId(authentication));
    }

    @PostMapping("/book/{id}/payment")
    public TripBooking confirmPayment(@PathVariable Long id, @RequestBody TripPaymentRequest request,
                                      Authentication authentication) {
        return tripBookingService.confirmPayment(id, currentUserId(authentication), request.sessionId());
    }

    @PostMapping("/book/{id}/review")
    public TripBooking reviewBooking(@PathVariable Long id,
                                     @RequestBody TripBookingReviewRequest request,
                                     Authentication authentication) {
        requireAdmin(authentication);
        return tripBookingService.reviewBooking(id, request);
    }

    @GetMapping("/all")
    public List<TripBooking> getAllBookings(Authentication authentication) {
        requireAdmin(authentication);
        return tripBookingService.getAllBookings();
    }

    @PostMapping("/update-status/{id}")
    public String updateStatus(@PathVariable Long id, @RequestParam String status, Authentication authentication) {
        requireAdmin(authentication);
        tripBookingService.updateBookingStatus(id, status);
        return "Status updated to " + status;
    }

    @GetMapping("/passenger/{passengerId}")
    public List<TripBooking> getBookings(@PathVariable Long passengerId, Authentication authentication) {
        Long currentUserId = currentUserId(authentication);
        if (!isAdmin(authentication) && !currentUserId.equals(passengerId)) {
            throw new SecurityException("You cannot access another passenger's bookings.");
        }
        return tripBookingService.getBookingsForPassenger(passengerId);
    }

    @PostMapping("/book/{id}/cancellation-request")
    public TripBooking requestCancellation(
            @PathVariable Long id,
            @RequestBody(required = false) java.util.Map<String, String> body,
            Authentication authentication
    ) {
        String requesterType = isAdmin(authentication) ? "admin" : "user";
        String reason = body != null && body.containsKey("reason") ? body.get("reason") : "Cancellation requested";
        return tripBookingService.requestCancellation(id, requesterType, reason);
    }

    @PostMapping("/book/{id}/cancellation-response")
    public TripBooking respondToCancellation(
            @PathVariable Long id,
            @RequestBody java.util.Map<String, Object> body,
            Authentication authentication
    ) {
        String responderType = isAdmin(authentication) ? "admin" : "user";
        boolean accept = body != null && Boolean.TRUE.equals(body.get("accept"));
        String rejectReason = body != null && body.containsKey("rejectReason") ? (String) body.get("rejectReason") : null;
        return tripBookingService.respondToCancellation(id, responderType, accept, rejectReason);
    }

    @GetMapping(value = "/verify/{id}", produces = "text/html")
    @ResponseBody
    public String verifyBooking(@PathVariable Long id) {
        TripBooking b = tripBookingService.getBookingById(id);
        if (b == null) {
            return "<div style='text-align:center;padding:50px;font-family:sans-serif;'><h1 style='color:#EF4444;'>Invalid Ticket</h1><p>This booking record could not be found.</p></div>";
        }
        return "<!DOCTYPE html><html><head><meta name='viewport' content='width=device-width, initial-scale=1.0'><style>body{background:#F8FAFC;font-family:sans-serif;margin:0;display:flex;justify-content:center;align-items:center;min-height:100vh}.card{background:white;width:90%;max-width:400px;border-radius:20px;box-shadow:0 10px 25px rgba(0,0,0,.05);overflow:hidden;border:1px solid #E2E8F0}.header{background:linear-gradient(135deg,#2563EB,#1D4ED8);padding:30px;text-align:center;color:white}.status-badge{background:#DCFCE7;color:#166534;padding:6px 16px;border-radius:50px;font-size:12px;font-weight:bold;display:inline-block;margin-top:10px;text-transform:uppercase}.content{padding:30px}.route{display:flex;justify-content:space-between;align-items:center;margin-bottom:30px}.city{font-size:20px;font-weight:bold;color:#1E293B}.info-grid{display:grid;grid-template-columns:1fr 1fr;gap:20px}.label{font-size:11px;color:#94A3B8;font-weight:bold;margin-bottom:4px;text-transform:uppercase}.value{font-size:15px;color:#1E293B;font-weight:bold}.footer{background:#F1F5F9;padding:20px;text-align:center;font-size:12px;color:#64748B;border-top:1px solid #E2E8F0}</style></head><body><div class='card'><div class='header'><div style='font-size:24px;font-weight:bold;letter-spacing:1px;'>TRACKNGo</div><div class='status-badge'>Verified Booking</div></div><div class='content'><div class='route'><div class='city'>" + escape(b.getStartLocation()) + "</div><div>→</div><div class='city'>" + escape(b.getDestination()) + "</div></div><div class='info-grid'><div><div class='label'>Booking ID</div><div class='value'>#" + b.getId() + "</div></div><div><div class='label'>Date</div><div class='value'>" + b.getStartDate() + "</div></div><div><div class='label'>Amount Paid</div><div class='value'>LKR " + (b.getAdvancePayment() == null ? "0" : b.getAdvancePayment()) + "</div></div><div><div class='label'>Status</div><div class='value'>" + escape(b.getBookingStatus()) + "</div></div></div></div><div class='footer'>Official E-Ticket Verification Hub</div></div></body></html>";
    }

    private Long currentUserId(Authentication authentication) {
        if (authentication == null || authentication instanceof AnonymousAuthenticationToken || authentication.getName() == null) {
            throw new SecurityException("Authentication is required.");
        }
        return jdbc.queryForObject("SELECT user_id FROM `user` WHERE email = ?", Long.class, authentication.getName());
    }

    private void requireAdmin(Authentication authentication) {
        if (!isAdmin(authentication)) throw new SecurityException("Administrator access is required.");
    }

    private boolean isAdmin(Authentication authentication) {
        return authentication != null && authentication.getAuthorities().stream()
                .map(authority -> authority.getAuthority() == null ? "" : authority.getAuthority().trim())
                .anyMatch(authority -> "ROLE_ADMIN".equalsIgnoreCase(authority) || "ADMIN".equalsIgnoreCase(authority));
    }

    private String escape(String value) {
        if (value == null) return "";
        return value.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace("\"", "&quot;");
    }
}
