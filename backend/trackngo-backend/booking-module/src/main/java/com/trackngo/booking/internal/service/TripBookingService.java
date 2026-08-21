package com.trackngo.booking.internal.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.stripe.exception.StripeException;
import com.stripe.model.checkout.Session;
import com.trackngo.booking.api.dto.TripBookingRequest;
import com.trackngo.booking.api.dto.TripBookingReviewRequest;
import com.trackngo.booking.api.dto.TripBusResponse;
import com.trackngo.booking.internal.entity.TripBooking;
import com.trackngo.booking.internal.repository.TripBookingRepository;
import com.trackngo.notification.api.NotificationDispatcher;
import com.trackngo.notification.api.NotificationType;
import org.springframework.dao.DuplicateKeyException;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class TripBookingService {

    private static final BigDecimal DAILY_RATE = new BigDecimal("12000");
    private static final BigDecimal SMALL_BUS_RATE_PER_KM = new BigDecimal("250");
    private static final BigDecimal LARGE_BUS_RATE_PER_KM = new BigDecimal("400");
    private static final BigDecimal ADVANCE_RATE = new BigDecimal("0.15");
    private static final List<String> BUS_RESERVING_STATUSES = List.of(
            "pending", "approved", "confirmed", "in_progress"
    );

    private final TripBookingRepository tripBookingRepository;
    private final JdbcTemplate jdbc;
    private final ObjectMapper mapper;
    private final NotificationDispatcher notifications;

    public List<TripBooking> getAllBookings() {
        String sql = "SELECT * FROM trip_booking ORDER BY trip_booking_id DESC";
        return jdbc.query(sql, (rs, rowNum) -> {
            TripBooking b = new TripBooking();
            b.setId(rs.getLong("trip_booking_id"));
            b.setStartLocation(rs.getString("start_location"));
            b.setDestination(rs.getString("destination"));
            java.sql.Date startDate = rs.getDate("start_date");
            if (startDate != null) b.setStartDate(startDate.toLocalDate());
            java.sql.Date returnDate = rs.getDate("return_date");
            if (returnDate != null) b.setReturnDate(returnDate.toLocalDate());
            b.setPassengerCount(rs.getInt("passenger_count"));
            b.setAdvancePayment(rs.getBigDecimal("advance_payment"));
            b.setFinalPrice(rs.getBigDecimal("final_price"));
            b.setEstimatedPrice(rs.getBigDecimal("estimated_price"));
            b.setDiscountAmount(rs.getBigDecimal("discount_amount"));
            b.setAdminNote(rs.getString("admin_note"));
            java.sql.Timestamp negotiatedAt = rs.getTimestamp("negotiated_at");
            if (negotiatedAt != null) b.setNegotiatedAt(negotiatedAt.toLocalDateTime());
            b.setBookingStatus(rs.getString("booking_status"));
            b.setPassengerId(rs.getLong("passenger_id"));
            b.setDriverId((Long) rs.getObject("driver_id"));
            b.setBusId((Long) rs.getObject("bus_id"));
            return enrich(b);
        });
    }

    @Transactional
    public TripBooking createBooking(TripBookingRequest request, Long passengerId) {
        validateRequest(request);
        Fare fare = calculateFare(request);

        TripBooking booking = new TripBooking();
        booking.setStartLocation(request.startLocation().trim());
        booking.setDestination(request.destination().trim());
        booking.setStartDate(request.startDate());
        booking.setReturnDate(request.returnDate());
        booking.setPassengerCount(request.passengerCount());
        booking.setAdvancePayment(fare.advancePayment());
        booking.setFinalPrice(fare.finalPrice());
        booking.setEstimatedPrice(fare.finalPrice());
        booking.setDiscountAmount(BigDecimal.ZERO.setScale(2));
        booking.setBookingStatus("pending");
        booking.setPassengerId(passengerId);
        TripBooking submitted = enrich(tripBookingRepository.save(booking));

        notifications.toPassenger(
                passengerId,
                NotificationType.BOOKING,
                "Trip Request Submitted",
                "Your trip request from " + submitted.getStartLocation() + " to " + submitted.getDestination()
                        + " on " + submitted.getStartDate() + " for " + submitted.getPassengerCount()
                        + " passenger(s) was submitted. We will let you know once it has been reviewed."
        );

        notifications.toAllAdmins(
                NotificationType.BOOKING,
                "New Trip Request",
                "A trip request from " + submitted.getStartLocation() + " to " + submitted.getDestination()
                        + " on " + submitted.getStartDate() + " for " + submitted.getPassengerCount()
                        + " passenger(s) is waiting for review."
        );

        return submitted;
    }

    @Transactional
    public TripBooking assignBus(Long bookingId, Long busId, Long passengerId) {
        TripBooking booking = getOwnedBooking(bookingId, passengerId);
        Map<String, Object> lockedBooking = lockBookingRow(bookingId);
        String currentStatus = String.valueOf(lockedBooking.get("booking_status"));
        if (!passengerId.equals(((Number) lockedBooking.get("passenger_id")).longValue())) {
            throw new SecurityException("You cannot access this booking.");
        }
        if (!"pending".equalsIgnoreCase(currentStatus)) {
            throw new IllegalStateException("This booking is no longer awaiting bus selection.");
        }

        Map<String, Object> bus = lockAvailableTripBus(busId);
        int capacity = ((Number) bus.get("seat_capacity")).intValue();
        int passengerCount = ((Number) lockedBooking.get("passenger_count")).intValue();
        if (capacity < passengerCount) {
            throw new IllegalStateException("The selected bus is not available for this passenger count.");
        }

        LocalDate startDate = toLocalDate(lockedBooking.get("start_date"));
        LocalDate returnDate = toLocalDate(lockedBooking.get("return_date"));
        Long conflictId = findConflictingTripBooking(busId, bookingId, startDate, returnDate);
        if (conflictId != null) {
            throw new IllegalStateException("This bus is already booked for overlapping dates.");
        }
        reserveBusDates(bookingId, busId, startDate, returnDate);
        jdbc.update("UPDATE trip_booking SET bus_id = ?, booking_status = 'pending' WHERE trip_booking_id = ?", busId, bookingId);
        booking.setBusId(busId);
        booking.setBookingStatus("pending");
        TripBooking assigned = enrich(booking);

        notifications.toPassenger(
                passengerId,
                NotificationType.JOURNEY,
                "Bus Reserved for Your Trip",
                "Bus " + assigned.getBusNumber() + " is held for your trip to " + assigned.getDestination()
                        + ". The request is now waiting for admin approval."
        );

        return assigned;
    }

    @Transactional
    public TripBooking reviewBooking(Long bookingId, TripBookingReviewRequest request) {
        if (request == null || request.decision() == null) {
            throw new IllegalArgumentException("A booking decision is required.");
        }
        TripBooking booking = getBookingById(bookingId);
        if (booking == null) throw new IllegalArgumentException("Trip booking was not found.");
        lockBookingRow(bookingId);
        boolean reviewable = "pending".equalsIgnoreCase(booking.getBookingStatus())
                || (("confirmed".equalsIgnoreCase(booking.getBookingStatus())
                || "approved".equalsIgnoreCase(booking.getBookingStatus())) && booking.getNegotiatedAt() == null);
        if (!reviewable) {
            throw new IllegalStateException("Only pending trip requests can be reviewed.");
        }
        String decision = request.decision().trim().toLowerCase();
        if ("rejected".equals(decision) || "reject".equals(decision)) {
            int updated = jdbc.update("UPDATE trip_booking SET booking_status = 'cancelled', admin_note = ?, negotiated_at = NOW() WHERE trip_booking_id = ? AND booking_status IN ('pending', 'approved', 'confirmed') AND negotiated_at IS NULL",
                    cleanNote(request.adminNote()), bookingId);
            if (updated == 0) throw new IllegalStateException("This trip request has already been reviewed.");
            releaseBusDates(bookingId);
            booking.setBookingStatus("cancelled");
            booking.setAdminNote(cleanNote(request.adminNote()));

            String declineNote = cleanNote(request.adminNote());
            notifications.toPassenger(
                    booking.getPassengerId(),
                    NotificationType.CANCELLATION,
                    "Trip Request Declined",
                    "Your trip request from " + booking.getStartLocation() + " to " + booking.getDestination()
                            + " could not be approved."
                            + (declineNote == null ? "" : " Reason: " + declineNote)
            );

            return enrich(booking);
        }
        if (booking.getBusId() == null) {
            throw new IllegalStateException("The passenger must select an available bus before this request can be approved.");
        }
        if (!"approved".equals(decision) && !"confirmed".equals(decision)) {
            throw new IllegalArgumentException("Decision must be approved or rejected.");
        }
        if (request.finalPrice() == null || request.finalPrice().compareTo(BigDecimal.ZERO) <= 0) {
            throw new IllegalArgumentException("A positive final negotiated amount is required.");
        }
        BigDecimal discount = request.discountAmount() == null ? BigDecimal.ZERO : request.discountAmount();
        if (discount.compareTo(BigDecimal.ZERO) < 0) {
            throw new IllegalArgumentException("Discount cannot be negative.");
        }
        reserveBusDates(bookingId, booking.getBusId(), booking.getStartDate(), booking.getReturnDate());
        BigDecimal finalPrice = request.finalPrice().setScale(2, RoundingMode.HALF_UP);
        BigDecimal advance = finalPrice.multiply(ADVANCE_RATE).setScale(2, RoundingMode.HALF_UP);
        String note = cleanNote(request.adminNote());
        int updated = jdbc.update("UPDATE trip_booking SET final_price = ?, advance_payment = ?, discount_amount = ?, admin_note = ?, negotiated_at = NOW(), booking_status = 'confirmed' WHERE trip_booking_id = ? AND booking_status IN ('pending', 'approved', 'confirmed') AND negotiated_at IS NULL",
                finalPrice, advance, discount.setScale(2, RoundingMode.HALF_UP), note, bookingId);
        if (updated == 0) throw new IllegalStateException("This trip request has already been reviewed.");
        booking.setFinalPrice(finalPrice);
        booking.setAdvancePayment(advance);
        booking.setDiscountAmount(discount.setScale(2, RoundingMode.HALF_UP));
        booking.setAdminNote(note);
        booking.setBookingStatus("confirmed");

        notifications.toPassenger(
                booking.getPassengerId(),
                NotificationType.BOOKING,
                "Trip Request Approved",
                "Your trip from " + booking.getStartLocation() + " to " + booking.getDestination()
                        + " is approved at " + formatAmount(finalPrice) + ". Pay the advance of "
                        + formatAmount(advance) + " to confirm the booking."
                        + (note == null ? "" : " Note from admin: " + note)
        );

        return enrich(booking);
    }

    @Transactional
    public void updateBookingStatus(Long id, String status) {
        String normalized = status == null ? "" : status.trim().toLowerCase();
        if (!List.of("pending", "approved", "confirmed", "in_progress", "completed", "cancelled").contains(normalized)) {
            throw new IllegalArgumentException("Unsupported trip booking status.");
        }
        Map<String, Object> booking = lockBookingRow(id);
        if (BUS_RESERVING_STATUSES.contains(normalized)) {
            Long busId = toLong(booking.get("bus_id"));
            if (busId != null) {
                reserveBusDates(
                        id,
                        busId,
                        toLocalDate(booking.get("start_date")),
                        toLocalDate(booking.get("return_date"))
                );
            }
        }
        String updateSql = List.of("approved", "confirmed").contains(normalized)
                ? "UPDATE trip_booking SET booking_status = ?, negotiated_at = COALESCE(negotiated_at, NOW()) WHERE trip_booking_id = ?"
                : "UPDATE trip_booking SET booking_status = ? WHERE trip_booking_id = ?";
        if (jdbc.update(updateSql, normalized, id) == 0) {
            throw new IllegalArgumentException("Trip booking was not found.");
        }
        if (!BUS_RESERVING_STATUSES.contains(normalized)) {
            releaseBusDates(id);
        }
    }

    public List<TripBusResponse> getAvailableBuses(int passengerCount, String requirement) {
        if (passengerCount < 1) throw new IllegalArgumentException("Passenger count must be at least 1.");
        StringBuilder sql = new StringBuilder("""
                SELECT bus_id, bus_number, bus_brand, seat_capacity, amenities, status
                FROM bus
                WHERE bus_type = 'trip_booking'
                  AND status = 'active'
                  AND seat_capacity >= ?
                """);
        List<Object> params = new ArrayList<>();
        params.add(passengerCount);
        if ("AC".equalsIgnoreCase(requirement)) {
            sql.append(" AND UPPER(amenities) LIKE '%AC%' ");
        } else if ("Standard".equalsIgnoreCase(requirement)) {
            sql.append(" AND UPPER(amenities) NOT LIKE '%AC%' ");
        } else if ("Mini Bus".equalsIgnoreCase(requirement)) {
            sql.append(" AND UPPER(bus_brand) LIKE '%ROSA%' ");
        }

        return jdbc.queryForList(sql.toString(), params.toArray()).stream().map(row -> new TripBusResponse(
                ((Number) row.get("bus_id")).longValue(),
                (String) row.get("bus_number"),
                (String) row.get("bus_brand"),
                ((Number) row.get("seat_capacity")).intValue(),
                parseAmenities(row.get("amenities")),
                (String) row.get("status")
        )).toList();
    }

    public List<TripBooking> getBookingsForPassenger(Long passengerId) {
        return tripBookingRepository.findByPassengerId(passengerId).stream().map(this::enrich).toList();
    }

    public TripBooking getBookingById(Long id) {
        return tripBookingRepository.findById(id).map(this::enrich).orElse(null);
    }

    public TripBooking getOwnedBooking(Long id, Long passengerId) {
        TripBooking booking = getBookingById(id);
        if (booking == null) throw new IllegalArgumentException("Trip booking was not found.");
        if (!passengerId.equals(booking.getPassengerId())) throw new SecurityException("You cannot access this booking.");
        return booking;
    }

    @Transactional
    public TripBooking confirmPayment(Long bookingId, Long passengerId, String sessionId) {
        if (sessionId == null || sessionId.isBlank()) throw new IllegalArgumentException("Stripe session is required.");
        TripBooking booking = getOwnedBooking(bookingId, passengerId);
        if (booking.getBusId() == null) throw new IllegalStateException("Select a bus before paying.");
        String bookingStatus = booking.getBookingStatus() == null
                ? ""
                : booking.getBookingStatus().trim().toLowerCase();
        boolean approvedForPayment = "confirmed".equals(bookingStatus)
                || "approved".equals(bookingStatus)
                // Older approval records can retain pending status while the
                // negotiated timestamp and approved prices are already saved.
                || ("pending".equals(bookingStatus) && booking.getNegotiatedAt() != null);
        if (!approvedForPayment) {
            throw new IllegalStateException("This booking is waiting for admin approval.");
        }
        if (booking.getFinalPrice() == null || booking.getFinalPrice().compareTo(BigDecimal.ZERO) <= 0
                || booking.getAdvancePayment() == null || booking.getAdvancePayment().compareTo(BigDecimal.ZERO) <= 0) {
            throw new IllegalStateException("The approved payment amount is not available for this booking.");
        }

        try {
            Session session = Session.retrieve(sessionId);
            String orderId = session.getMetadata() == null ? "" : session.getMetadata().getOrDefault("order_id", "");
            long expectedCents = booking.getAdvancePayment().setScale(2, RoundingMode.HALF_UP)
                    .movePointRight(2).longValueExact();
            if (!("TRIP-" + bookingId).equals(orderId)
                    || !"paid".equalsIgnoreCase(session.getPaymentStatus())
                    || session.getAmountTotal() == null
                    || session.getAmountTotal() != expectedCents) {
                throw new IllegalStateException("Stripe payment could not be verified for this booking.");
            }

            Map<String, Object> existing = jdbc.queryForList(
                    "SELECT transaction_id, payment_status FROM payment WHERE trip_booking_id = ? ORDER BY payment_id DESC LIMIT 1",
                    bookingId).stream().findFirst().orElse(null);
            if (existing == null || !"success".equalsIgnoreCase(String.valueOf(existing.get("payment_status")))) {
                String transactionId = "TRIP-" + bookingId + "-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase();
                jdbc.update("INSERT INTO payment (transaction_id, payment_method, payment_status, amount, provider_transaction_id, trip_booking_id) VALUES (?, 'stripe', 'success', ?, ?, ?)",
                        transactionId, booking.getAdvancePayment(), session.getPaymentIntent(), bookingId);
            }
            jdbc.update("UPDATE trip_booking SET booking_status = 'confirmed' WHERE trip_booking_id = ?", bookingId);

            notifications.toPassenger(
                    passengerId,
                    NotificationType.PAYMENT,
                    "Advance Payment Received",
                    formatAmount(booking.getAdvancePayment()) + " was received for your trip to "
                            + booking.getDestination() + ". Your trip booking is now confirmed."
            );

            return enrich(booking);
        } catch (StripeException e) {
            throw new IllegalStateException("Stripe payment verification failed.", e);
        }
    }

    private void validateRequest(TripBookingRequest request) {
        if (request == null || request.startLocation() == null || request.startLocation().isBlank()
                || request.destination() == null || request.destination().isBlank()) {
            throw new IllegalArgumentException("Pickup and destination are required.");
        }
        if (request.startDate() == null || request.startDate().isBefore(LocalDate.now())) {
            throw new IllegalArgumentException("Departure date must be today or later.");
        }
        if (request.returnDate() == null || request.returnDate().isBefore(request.startDate())) {
            throw new IllegalArgumentException("Return date cannot be before departure.");
        }
        if (request.passengerCount() == null || request.passengerCount() < 1 || request.passengerCount() > 100) {
            throw new IllegalArgumentException("Passenger count must be between 1 and 100.");
        }
    }

    private Fare calculateFare(TripBookingRequest request) {
        long days = Math.max(1, ChronoUnit.DAYS.between(request.startDate(), request.returnDate()));
        double distance = resolveDistance(request);
        BigDecimal rate = request.passengerCount() <= 20 ? SMALL_BUS_RATE_PER_KM : LARGE_BUS_RATE_PER_KM;
        BigDecimal distanceCost = BigDecimal.valueOf(distance).multiply(rate);
        if ("AC".equalsIgnoreCase(request.requirement())) distanceCost = distanceCost.multiply(new BigDecimal("1.25"));
        if ("Mini Bus".equalsIgnoreCase(request.requirement())) distanceCost = distanceCost.add(new BigDecimal("1500"));
        BigDecimal total = DAILY_RATE.multiply(BigDecimal.valueOf(days)).add(distanceCost).setScale(2, RoundingMode.HALF_UP);
        BigDecimal advance = total.multiply(ADVANCE_RATE).setScale(2, RoundingMode.HALF_UP);
        return new Fare(total, advance);
    }

    private double resolveDistance(TripBookingRequest request) {
        if (request.startLatitude() != null && request.startLongitude() != null
                && request.destinationLatitude() != null && request.destinationLongitude() != null) {
            double lat1 = Math.toRadians(request.startLatitude());
            double lat2 = Math.toRadians(request.destinationLatitude());
            double dLat = Math.toRadians(request.destinationLatitude() - request.startLatitude());
            double dLon = Math.toRadians(request.destinationLongitude() - request.startLongitude());
            double a = Math.sin(dLat / 2) * Math.sin(dLat / 2)
                    + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
            return Math.min(5000, Math.max(0, 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))));
        }
        return request.distanceKm() == null ? 0 : Math.min(5000, Math.max(0, request.distanceKm()));
    }

    private TripBooking enrich(TripBooking booking) {
        if (booking == null) return null;
        if (booking.getEstimatedPrice() == null) booking.setEstimatedPrice(booking.getFinalPrice());
        if (booking.getDiscountAmount() == null) booking.setDiscountAmount(BigDecimal.ZERO.setScale(2));
        if (booking.getBusId() != null) {
            jdbc.query("SELECT bus_number, bus_brand FROM bus WHERE bus_id = ?", rs -> {
                booking.setBusNumber(rs.getString("bus_number"));
                booking.setBusBrand(rs.getString("bus_brand"));
            }, booking.getBusId());
        }
        jdbc.query("SELECT payment_status, transaction_id FROM payment WHERE trip_booking_id = ? ORDER BY payment_id DESC LIMIT 1", rs -> {
            booking.setPaymentStatus(rs.getString("payment_status"));
            booking.setTransactionId(rs.getString("transaction_id"));
        }, booking.getId());
        return booking;
    }

    private List<String> parseAmenities(Object obj) {
        if (obj == null) return List.of();
        try { return mapper.readValue(obj.toString(), new TypeReference<List<String>>() {}); }
        catch (Exception ignored) { return List.of(); }
    }

    /** Formats an amount the way the passenger app displays trip prices. */
    private String formatAmount(BigDecimal amount) {
        BigDecimal value = amount == null ? BigDecimal.ZERO : amount;
        return "LKR " + value.setScale(2, RoundingMode.HALF_UP).toPlainString();
    }

    private String cleanNote(String note) {
        if (note == null) return null;
        String trimmed = note.trim();
        return trimmed.isEmpty() ? null : trimmed.substring(0, Math.min(500, trimmed.length()));
    }

    private Map<String, Object> lockBookingRow(Long bookingId) {
        List<Map<String, Object>> rows = jdbc.queryForList("""
                SELECT trip_booking_id, passenger_id, passenger_count, start_date, return_date,
                       booking_status, bus_id
                FROM trip_booking
                WHERE trip_booking_id = ?
                FOR UPDATE
                """, bookingId);
        if (rows.isEmpty()) throw new IllegalArgumentException("Trip booking was not found.");
        return rows.get(0);
    }

    private Map<String, Object> lockAvailableTripBus(Long busId) {
        List<Map<String, Object>> rows = jdbc.queryForList("""
                SELECT bus_id, seat_capacity
                FROM bus
                WHERE bus_id = ?
                  AND bus_type = 'trip_booking'
                  AND status = 'active'
                FOR UPDATE
                """, busId);
        if (rows.isEmpty()) {
            throw new IllegalStateException("The selected bus is no longer available.");
        }
        return rows.get(0);
    }

    private Long findConflictingTripBooking(Long busId, Long bookingId, LocalDate startDate, LocalDate returnDate) {
        LocalDate endDate = returnDate == null ? startDate : returnDate;
        List<Map<String, Object>> rows = jdbc.queryForList("""
                SELECT r.trip_booking_id
                FROM trip_bus_reservation r
                INNER JOIN trip_booking b ON b.trip_booking_id = r.trip_booking_id
                WHERE r.bus_id = ?
                  AND r.reserved_date BETWEEN ? AND ?
                  AND r.trip_booking_id <> ?
                  AND b.booking_status IN ('pending', 'approved', 'confirmed', 'in_progress')
                ORDER BY r.reserved_date, r.trip_booking_id
                LIMIT 1
                """, busId, startDate, endDate, bookingId);
        return rows.isEmpty() ? null : ((Number) rows.get(0).get("trip_booking_id")).longValue();
    }

    private void reserveBusDates(Long bookingId, Long busId, LocalDate startDate, LocalDate returnDate) {
        if (busId == null || startDate == null) return;
        LocalDate endDate = returnDate == null ? startDate : returnDate;
        if (endDate.isBefore(startDate)) {
            throw new IllegalArgumentException("Return date cannot be before departure.");
        }

        lockAvailableTripBus(busId);
        Long conflictId = findConflictingTripBooking(busId, bookingId, startDate, endDate);
        if (conflictId != null) {
            throw new IllegalStateException("This bus is already booked for overlapping dates.");
        }

        // Reassignment is safe because the booking row and the bus row are both
        // locked in this transaction. The unique key is the final cross-instance
        // concurrency guard when two users select the same bus simultaneously.
        releaseBusDates(bookingId);
        try {
            for (LocalDate date = startDate; !date.isAfter(endDate); date = date.plusDays(1)) {
                jdbc.update(
                        "INSERT INTO trip_bus_reservation (trip_booking_id, bus_id, reserved_date) VALUES (?, ?, ?)",
                        bookingId, busId, date
                );
            }
        } catch (DuplicateKeyException ex) {
            throw new IllegalStateException("This bus was just booked for overlapping dates. Please choose another bus.", ex);
        }
    }

    private void releaseBusDates(Long bookingId) {
        jdbc.update("DELETE FROM trip_bus_reservation WHERE trip_booking_id = ?", bookingId);
    }

    private LocalDate toLocalDate(Object value) {
        if (value == null) return null;
        if (value instanceof LocalDate date) return date;
        if (value instanceof java.sql.Date date) return date.toLocalDate();
        return LocalDate.parse(value.toString());
    }

    private Long toLong(Object value) {
        return value == null ? null : ((Number) value).longValue();
    }

    private record Fare(BigDecimal finalPrice, BigDecimal advancePayment) {}
}
