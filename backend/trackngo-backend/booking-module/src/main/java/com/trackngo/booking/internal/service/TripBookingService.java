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

    private final TripBookingRepository tripBookingRepository;
    private final JdbcTemplate jdbc;
    private final ObjectMapper mapper;

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
        return enrich(tripBookingRepository.save(booking));
    }

    @Transactional
    public TripBooking assignBus(Long bookingId, Long busId, Long passengerId) {
        TripBooking booking = getOwnedBooking(bookingId, passengerId);
        if (!"pending".equalsIgnoreCase(booking.getBookingStatus())) {
            throw new IllegalStateException("This booking is no longer awaiting bus selection.");
        }

        Integer capacity = jdbc.queryForObject(
                "SELECT seat_capacity FROM bus WHERE bus_id = ? AND bus_type = 'trip_booking' AND status = 'active'",
                Integer.class, busId);
        if (capacity == null || capacity < booking.getPassengerCount()) {
            throw new IllegalStateException("The selected bus is not available for this passenger count.");
        }

        jdbc.update("UPDATE trip_booking SET bus_id = ?, booking_status = 'pending' WHERE trip_booking_id = ?", busId, bookingId);
        booking.setBusId(busId);
        booking.setBookingStatus("pending");
        return enrich(booking);
    }

    @Transactional
    public TripBooking reviewBooking(Long bookingId, TripBookingReviewRequest request) {
        if (request == null || request.decision() == null) {
            throw new IllegalArgumentException("A booking decision is required.");
        }
        TripBooking booking = getBookingById(bookingId);
        if (booking == null) throw new IllegalArgumentException("Trip booking was not found.");
        boolean reviewable = "pending".equalsIgnoreCase(booking.getBookingStatus())
                || ("confirmed".equalsIgnoreCase(booking.getBookingStatus()) && booking.getNegotiatedAt() == null);
        if (!reviewable) {
            throw new IllegalStateException("Only pending trip requests can be reviewed.");
        }
        String decision = request.decision().trim().toLowerCase();
        if ("rejected".equals(decision) || "reject".equals(decision)) {
            int updated = jdbc.update("UPDATE trip_booking SET booking_status = 'cancelled', admin_note = ?, negotiated_at = NOW() WHERE trip_booking_id = ? AND booking_status IN ('pending', 'confirmed') AND negotiated_at IS NULL",
                    cleanNote(request.adminNote()), bookingId);
            if (updated == 0) throw new IllegalStateException("This trip request has already been reviewed.");
            booking.setBookingStatus("cancelled");
            booking.setAdminNote(cleanNote(request.adminNote()));
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
        BigDecimal finalPrice = request.finalPrice().setScale(2, RoundingMode.HALF_UP);
        BigDecimal advance = finalPrice.multiply(ADVANCE_RATE).setScale(2, RoundingMode.HALF_UP);
        String note = cleanNote(request.adminNote());
        int updated = jdbc.update("UPDATE trip_booking SET final_price = ?, advance_payment = ?, discount_amount = ?, admin_note = ?, negotiated_at = NOW(), booking_status = 'confirmed' WHERE trip_booking_id = ? AND booking_status IN ('pending', 'confirmed') AND negotiated_at IS NULL",
                finalPrice, advance, discount.setScale(2, RoundingMode.HALF_UP), note, bookingId);
        if (updated == 0) throw new IllegalStateException("This trip request has already been reviewed.");
        booking.setFinalPrice(finalPrice);
        booking.setAdvancePayment(advance);
        booking.setDiscountAmount(discount.setScale(2, RoundingMode.HALF_UP));
        booking.setAdminNote(note);
        booking.setBookingStatus("confirmed");
        return enrich(booking);
    }

    public void updateBookingStatus(Long id, String status) {
        String normalized = status == null ? "" : status.trim().toLowerCase();
        if (!List.of("pending", "confirmed", "in_progress", "completed", "cancelled").contains(normalized)) {
            throw new IllegalArgumentException("Unsupported trip booking status.");
        }
        if (jdbc.update("UPDATE trip_booking SET booking_status = ? WHERE trip_booking_id = ?", normalized, id) == 0) {
            throw new IllegalArgumentException("Trip booking was not found.");
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
        if (!"confirmed".equalsIgnoreCase(booking.getBookingStatus()) || booking.getNegotiatedAt() == null) {
            throw new IllegalStateException("This booking is waiting for admin approval.");
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

    private String cleanNote(String note) {
        if (note == null) return null;
        String trimmed = note.trim();
        return trimmed.isEmpty() ? null : trimmed.substring(0, Math.min(500, trimmed.length()));
    }

    private record Fare(BigDecimal finalPrice, BigDecimal advancePayment) {}
}
