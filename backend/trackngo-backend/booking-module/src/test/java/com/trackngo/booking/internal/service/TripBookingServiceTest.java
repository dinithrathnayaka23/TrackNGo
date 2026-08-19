package com.trackngo.booking.internal.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.trackngo.booking.internal.entity.TripBooking;
import com.trackngo.booking.internal.repository.TripBookingRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.jdbc.core.JdbcTemplate;

import java.time.LocalDate;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TripBookingServiceTest {

    @Mock
    private TripBookingRepository tripBookingRepository;

    @Mock
    private JdbcTemplate jdbc;

    @Mock
    private ObjectMapper mapper;

    @InjectMocks
    private TripBookingService service;

    @Test
    void assignBus_rejectsAnInclusiveDateOverlap() {
        TripBooking booking = booking(1L, 101L);
        when(tripBookingRepository.findById(1L)).thenReturn(Optional.of(booking));
        when(jdbc.queryForList(anyString(), any(Object[].class)))
                .thenReturn(List.of(lockedBooking(101L)))
                .thenReturn(List.of(Map.of("bus_id", 7L, "seat_capacity", 40)))
                .thenReturn(List.of(Map.of("trip_booking_id", 2L)));

        assertThatThrownBy(() -> service.assignBus(1L, 7L, 101L))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("overlapping dates");

        verify(jdbc, times(1)).queryForList(contains("reserved_date BETWEEN"), any(Object[].class));
        verify(jdbc, times(0)).update(contains("INSERT INTO trip_bus_reservation"), any(Object[].class));
    }

    @Test
    void assignBus_reservesEveryDayAndUpdatesOnlyAfterTheReservationGuard() {
        TripBooking booking = booking(1L, 101L);
        when(tripBookingRepository.findById(1L)).thenReturn(Optional.of(booking));
        when(jdbc.queryForList(anyString(), any(Object[].class)))
                .thenReturn(List.of(lockedBooking(101L)))
                .thenReturn(List.of(Map.of("bus_id", 7L, "seat_capacity", 40)))
                .thenReturn(List.of())
                .thenReturn(List.of(Map.of("bus_id", 7L, "seat_capacity", 40)))
                .thenReturn(List.of());
        when(jdbc.update(anyString(), any(Object[].class))).thenReturn(1);

        TripBooking result = service.assignBus(1L, 7L, 101L);

        assertThat(result.getBusId()).isEqualTo(7L);
        verify(jdbc, times(3)).update(contains("INSERT INTO trip_bus_reservation"), any(Object[].class));
        verify(jdbc).update(contains("UPDATE trip_booking SET bus_id"), any(Object[].class));
    }

    private TripBooking booking(Long id, Long passengerId) {
        TripBooking booking = new TripBooking();
        booking.setId(id);
        booking.setPassengerId(passengerId);
        booking.setPassengerCount(8);
        booking.setBookingStatus("pending");
        booking.setStartDate(LocalDate.of(2026, 9, 10));
        booking.setReturnDate(LocalDate.of(2026, 9, 12));
        return booking;
    }

    private Map<String, Object> lockedBooking(Long passengerId) {
        Map<String, Object> row = new HashMap<>();
        row.put("trip_booking_id", 1L);
        row.put("passenger_id", passengerId);
        row.put("passenger_count", 8);
        row.put("start_date", java.sql.Date.valueOf("2026-09-10"));
        row.put("return_date", java.sql.Date.valueOf("2026-09-12"));
        row.put("booking_status", "pending");
        row.put("bus_id", null);
        return row;
    }
}
