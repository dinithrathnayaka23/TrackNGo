package com.trackngo.booking.internal.service;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.jdbc.core.JdbcTemplate;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class BookingCompletionServiceTest {

    @Mock
    private JdbcTemplate jdbc;

    @InjectMocks
    private BookingCompletionService service;

    @Test
    void completesElapsedSeatAndTripBookings() {
        when(jdbc.update(anyString())).thenReturn(1);

        service.completeElapsedBookings();

        ArgumentCaptor<String> sql = ArgumentCaptor.forClass(String.class);
        verify(jdbc, times(2)).update(sql.capture());
        assertThat(sql.getAllValues()).anyMatch(statement ->
                statement.contains("UPDATE seat_booking") && statement.contains("status = 'completed'"));
        assertThat(sql.getAllValues()).anyMatch(statement ->
                statement.contains("UPDATE trip_booking") && statement.contains("booking_status = 'completed'"));
    }

    @Test
    void neverCompletesCancelledBookings() {
        when(jdbc.update(anyString())).thenReturn(0);

        service.completeElapsedBookings();

        ArgumentCaptor<String> sql = ArgumentCaptor.forClass(String.class);
        verify(jdbc, times(2)).update(sql.capture());
        assertThat(sql.getAllValues()).noneMatch(statement -> statement.contains("'cancelled'"));
    }

    /** A pending trip request the driver never accepted was never a journey. */
    @Test
    void neverCompletesPendingTripBookings() {
        when(jdbc.update(anyString())).thenReturn(0);

        service.completeElapsedTripBookings();

        ArgumentCaptor<String> sql = ArgumentCaptor.forClass(String.class);
        verify(jdbc).update(sql.capture());
        assertThat(sql.getValue()).doesNotContain("'pending'");
        assertThat(sql.getValue()).contains("'approved', 'confirmed', 'in_progress'");
    }

    /** A scheduled task that throws stops rescheduling, so failures must stay contained. */
    @Test
    void survivesDatabaseFailure() {
        doThrow(new RuntimeException("db down")).when(jdbc).update(anyString());

        service.completeElapsedBookings();

        verify(jdbc).update(anyString());
    }
}
