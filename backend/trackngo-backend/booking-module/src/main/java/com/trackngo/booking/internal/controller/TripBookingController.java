package com.trackngo.booking.internal.controller;

import com.trackngo.booking.api.dto.TripBusResponse;
import com.trackngo.booking.internal.entity.TripBooking;
import com.trackngo.booking.internal.service.TripBookingService;
import com.trackngo.commons.ApiResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * Step 4: The Controller (The API Receptionist)
 */
@RestController
@RequestMapping("/api/trips")
@CrossOrigin(originPatterns = "*") // 🔹 ALLOWS ADMIN PANEL SECURELY
@RequiredArgsConstructor
public class TripBookingController {

    private final TripBookingService tripBookingService;

    /**
     * Endpoint to get buses that are available for private trip bookings.
     * Usage: GET /api/trips/available-buses?passengers=10
     */
    @GetMapping("/available-buses")
    public List<TripBusResponse> getAvailableBuses(
            @RequestParam(defaultValue = "1") int passengers,
            @RequestParam(required = false) String requirement
    ) {
        return tripBookingService.getAvailableBuses(passengers, requirement);
    }

    @PostMapping("/book")
    public ResponseEntity<TripBooking> bookTrip(@RequestBody TripBooking booking) {
        TripBooking savedBooking = tripBookingService.createBooking(booking);
        return ResponseEntity.ok(savedBooking);
    }

    @GetMapping("/book/{id}")
    public TripBooking getBookingById(@PathVariable Long id) {
        return tripBookingService.getBookingById(id);
    }

    @GetMapping("/all")
    public List<TripBooking> getAllBookings() {
        return tripBookingService.getAllBookings();
    }

    @PostMapping("/update-status/{id}")
    public ResponseEntity<String> updateStatus(@PathVariable Long id, @RequestParam String status) {
        tripBookingService.updateBookingStatus(id, status);
        return ResponseEntity.ok("Status updated to " + status);
    }

    @GetMapping("/passenger/{passengerId}")
    public ResponseEntity<List<TripBooking>> getBookings(@PathVariable Long passengerId) {
        List<TripBooking> bookings = tripBookingService.getBookingsForPassenger(passengerId);
        return ResponseEntity.ok(bookings);
    }

    /**
     * Endpoint 3: Official Verification Page (HTML)
     * This is what shows up when the QR code is scanned!
     */
    @GetMapping(value = "/verify/{id}", produces = "text/html")
    @ResponseBody
    public String verifyBooking(@PathVariable Long id) {
        TripBooking b = tripBookingService.getBookingById(id);
        if (b == null) {
            return "<div style='text-align:center;padding:50px;font-family:sans-serif;'>" +
                    "<h1 style='color:#EF4444;'>❌ Invalid Ticket</h1>" +
                    "<p>This booking record could not be found.</p></div>";
        }

        return "<!DOCTYPE html><html><head>" +
                "<meta name='viewport' content='width=device-width, initial-scale=1.0'>" +
                "<style>" +
                "body{background:#F8FAFC;font-family:sans-serif;margin:0;display:flex;justify-content:center;align-items:center;min-height:100vh;}"
                +
                ".card{background:white;width:90%;max-width:400px;border-radius:20px;box-shadow:0 10px 25px rgba(0,0,0,0.05);overflow:hidden;border:1px solid #E2E8F0;}"
                +
                ".header{background:linear-gradient(135deg, #2563EB, #1D4ED8);padding:30px;text-align:center;color:white;}"
                +
                ".status-badge{background:#DCFCE7;color:#166534;padding:6px 16px;border-radius:50px;font-size:12px;font-weight:bold;display:inline-block;margin-top:10px;text-transform:uppercase;}"
                +
                ".content{padding:30px;}" +
                ".route{display:flex;justify-content:space-between;align-items:center;margin-bottom:30px;}" +
                ".city{font-size:24px;font-weight:bold;color:#1E293B;}" +
                ".arrow{color:#94A3B8;font-size:20px;}" +
                ".info-grid{display:grid;grid-template-columns:1fr 1fr;gap:20px;}" +
                ".label{font-size:11px;color:#94A3B8;font-weight:bold;margin-bottom:4px;text-transform:uppercase;}" +
                ".value{font-size:15px;color:#1E293B;font-weight:bold;}" +
                ".footer{background:#F1F5F9;padding:20px;text-align:center;font-size:12px;color:#64748B;border-top:1px solid #E2E8F0;}"
                +
                "</style></head><body>" +
                "<div class='card'>" +
                "  <div class='header'>" +
                "    <div style='font-size:24px;font-weight:bold;letter-spacing:1px;'>TRACKNGo</div>" +
                "    <div class='status-badge'>✅ Verified Booking</div>" +
                "  </div>" +
                "  <div class='content'>" +
                "    <div class='route'>" +
                "      <div class='city'>" + b.getStartLocation() + "</div>" +
                "      <div class='arrow'>→</div>" +
                "      <div class='city'>" + b.getDestination() + "</div>" +
                "    </div>" +
                "    <div class='info-grid'>" +
                "      <div><div class='label'>Booking ID</div><div class='value'>#" + b.getId() + "</div></div>" +
                "      <div><div class='label'>Date</div><div class='value'>" + b.getStartDate() + "</div></div>" +
                "      <div><div class='label'>Amount Paid</div><div class='value'>LKR " + b.getFinalPrice()
                + "</div></div>" +
                "      <div><div class='label'>Status</div><div class='value' style='color:#2563EB;'>" + b.getBookingStatus().toUpperCase() + "</div></div>"
                +
                "    </div>" +
                "  </div>" +
                "  <div class='footer'>Official E-Ticket Verification Hub</div>" +
                "</div>" +
                "</body></html>";
    }
}
