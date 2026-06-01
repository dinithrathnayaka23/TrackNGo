package com.trackngo.booking.internal.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.math.BigDecimal;
import com.trackngo.booking.api.dto.TripBusResponse;
import com.trackngo.booking.internal.entity.TripBooking;
import com.trackngo.booking.internal.repository.TripBookingRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class TripBookingService {

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
            b.setBookingStatus(rs.getString("booking_status"));
            b.setPassengerId(rs.getLong("passenger_id"));
            return b;
        });
    }

    public void updateBookingStatus(Long id, String status) {
        String sql = "UPDATE trip_booking SET booking_status = ? WHERE trip_booking_id = ?";
        jdbc.update(sql, status, id);
    }

    public List<TripBusResponse> getAvailableBuses(int passengerCount, String requirement) {
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

        try {
            List<Map<String, Object>> rows = jdbc.queryForList(sql.toString(), params.toArray());
            List<TripBusResponse> results = new ArrayList<>();

            for (Map<String, Object> row : rows) {
                results.add(new TripBusResponse(
                        ((Number) row.get("bus_id")).longValue(),
                        (String) row.get("bus_number"),
                        (String) row.get("bus_brand"),
                        ((Number) row.get("seat_capacity")).intValue(),
                        parseAmenities(row.get("amenities")),
                        (String) row.get("status")
                ));
            }
            return results;
        } catch (Exception e) {
            System.err.println("❌ ERROR IN getAvailableBuses: " + e.getMessage());
            e.printStackTrace();
            throw e;
        }
    }

    private List<String> parseAmenities(Object obj) {
        if (obj == null) return List.of();
        try {
            return mapper.readValue(obj.toString(), new TypeReference<List<String>>() {});
        } catch (Exception e) {
            return List.of();
        }
    }

    public TripBooking createBooking(TripBooking booking) {
        System.out.println("📦 SAVING NEW BOOKING: " + booking.getStartLocation() + " to " + booking.getDestination());
        booking.setBookingStatus("pending");
        if (booking.getFinalPrice() == null) {
            throw new RuntimeException("Booking cannot be saved without a calculated price.");
        }
        return tripBookingRepository.save(booking);
    }

    public List<TripBooking> getBookingsForPassenger(Long passengerId) {
        return tripBookingRepository.findByPassengerId(passengerId);
    }

    public TripBooking getBookingById(Long id) {
        return tripBookingRepository.findById(id).orElse(null);
    }
}
