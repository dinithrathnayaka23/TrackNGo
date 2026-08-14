package com.trackngo.booking.internal.service;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.jdbc.core.JdbcTemplate;

import java.math.BigDecimal;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class BookingDisruptionServiceTest {

    @Mock
    private JdbcTemplate jdbc;

    @Mock
    private RefundProcessor refundProcessor;

    @InjectMocks
    private BookingDisruptionService service;

    @Test
    void cancelsBookingCreatesRefundAndNotifiesPassenger() {
        when(jdbc.queryForList(anyString(), any(Object[].class)))
                .thenReturn(List.of(bookingRow()));
        when(jdbc.update(anyString(), any(Object[].class))).thenReturn(1);

        service.cancelFutureBookingsForBus(7L, "the bus was placed under maintenance");

        ArgumentCaptor<String> sql = ArgumentCaptor.forClass(String.class);
        verify(jdbc, times(4)).update(sql.capture(), any(Object[].class));
        assertThat(sql.getAllValues()).anyMatch(statement ->
                statement.contains("UPDATE seat_booking SET status = 'cancelled'"));
        assertThat(sql.getAllValues()).anyMatch(statement -> statement.contains("INSERT INTO refund"));
        assertThat(sql.getAllValues()).anyMatch(statement -> statement.contains("INSERT INTO notification"));
    }

    @Test
    void doesNotCreateSideEffectsIfBookingWasAlreadyCancelled() {
        when(jdbc.queryForList(anyString(), any(Object[].class)))
                .thenReturn(List.of(bookingRow()));
        when(jdbc.update(anyString(), any(Object[].class))).thenReturn(0);

        service.cancelFutureBookingsForRoute(3L, "the route was removed from service");

        verify(jdbc).update(anyString(), any(Object[].class));
    }

    @Test
    void restoredBusNotifiesPassengerOnce() {
        when(jdbc.queryForList(anyString(), any(Object[].class)))
                .thenReturn(List.of(bookingRow()));
        when(jdbc.update(anyString(), any(Object[].class))).thenReturn(1);

        service.notifyFutureBookingPassengersBusRestored(7L);

        ArgumentCaptor<String> sql = ArgumentCaptor.forClass(String.class);
        verify(jdbc, times(2)).update(sql.capture(), any(Object[].class));
        assertThat(sql.getAllValues()).anyMatch(statement ->
                statement.contains("restoration_notified_at"));
        assertThat(sql.getAllValues()).anyMatch(statement ->
                statement.contains("INSERT INTO notification"));
    }

    private Map<String, Object> bookingRow() {
        Map<String, Object> row = new HashMap<>();
        row.put("seat_booking_id", 11L);
        row.put("booking_reference", "BK-DISRUPTION-001");
        row.put("passenger_id", 22L);
        row.put("payment_id", 33L);
        row.put("refund_amount", new BigDecimal("2500.00"));
        return row;
    }
}
