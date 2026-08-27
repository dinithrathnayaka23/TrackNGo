package com.trackngo.complaint.internal.service;

import com.trackngo.complaint.api.dto.ComplaintDto;
import com.trackngo.complaint.events.ComplaintCreatedEvent;
import com.trackngo.complaint.internal.entity.Complaint;
import com.trackngo.complaint.internal.repository.ComplaintRepository;
import com.trackngo.commons.events.EventPublisher;
import com.trackngo.commons.exception.BusinessException;
import com.trackngo.commons.exception.ResourceNotFoundException;
import com.trackngo.notification.api.NotificationDispatcher;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.ZoneId;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ComplaintServiceImplTest {

    @Mock
    private ComplaintRepository repository;

    @Mock
    private EventPublisher eventPublisher;

    @Mock
    private JdbcTemplate jdbc;

    @Mock
    private NotificationDispatcher notifications;

    @InjectMocks
    private ComplaintServiceImpl service;

    /** Verifies that a valid passenger complaint is persisted and emits a created event. */
    @Test
    void createShouldPersistPassengerComplaintAndPublishEvent() {
        String email = "passenger@trackngo.com";
        ComplaintDto request = buildCreateRequest();
        request.setComplaintType("Driver Behavior");
        request.setPriority("High");

        stubPassengerOwner(email, 7L);
        stubBookingLookup(email, "BK-1001", LocalDateTime.now().minusDays(2), "confirmed");
        when(repository.save(any(Complaint.class))).thenAnswer(invocation -> {
            Complaint complaint = invocation.getArgument(0);
            complaint.setId(55L);
            return complaint;
        });

        ComplaintDto created = service.create(email, request);

        assertEquals(55L, created.getId());
        assertEquals("driver_behavior", created.getComplaintType());
        assertEquals("high", created.getPriority());
        assertEquals("pending", created.getStatus());
        assertEquals("BK-1001", created.getBookingReference());
        assertEquals(7L, created.getPassengerId());
        assertEquals("Bus driver was rude.", created.getDescription());
        assertNotNull(created.getCreatedAt());
        assertNull(created.getResolvedAt());

        ArgumentCaptor<ComplaintCreatedEvent> eventCaptor = ArgumentCaptor.forClass(ComplaintCreatedEvent.class);
        verify(eventPublisher).publish(eventCaptor.capture());
        assertEquals(55L, eventCaptor.getValue().getId());
    }

    /** Verifies that passenger complaints cannot be created without a booking reference. */
    @Test
    void createShouldRejectMissingBookingReferenceForPassenger() {
        String email = "passenger@trackngo.com";
        ComplaintDto request = buildCreateRequest();
        request.setBookingReference(null);

        stubPassengerOwner(email, 7L);

        BusinessException exception = assertThrows(BusinessException.class, () -> service.create(email, request));

        assertEquals("Booking reference is required for passenger complaints", exception.getMessage());
        verify(repository, never()).save(any(Complaint.class));
    }

    /** Verifies that complaints can only be submitted for bookings that already happened. */
    @Test
    void createShouldRejectFutureBooking() {
        String email = "passenger@trackngo.com";
        ComplaintDto request = buildCreateRequest();

        stubPassengerOwner(email, 7L);
        stubBookingLookup(email, "BK-1001", LocalDateTime.now().plusDays(1), "confirmed");

        BusinessException exception = assertThrows(BusinessException.class, () -> service.create(email, request));

        assertEquals("Complaints can only be submitted for past bookings", exception.getMessage());
        verify(repository, never()).save(any(Complaint.class));
    }

    /**
     * Booking history lists trip bookings under a synthesised 'BK-{tripBookingId}'
     * reference that has no row in seat_booking, so complaining about one used to be
     * rejected outright as an unknown booking.
     */
    @Test
    void createShouldAcceptPastTripBooking() {
        String email = "passenger@trackngo.com";
        ComplaintDto request = buildCreateRequest();

        stubPassengerOwner(email, 7L);
        stubMissingSeatBooking(email, "BK-1001");
        stubTripBookingLookup(email, 1001L, LocalDate.now().minusDays(3), "confirmed");
        when(repository.save(any(Complaint.class))).thenAnswer(invocation -> {
            Complaint complaint = invocation.getArgument(0);
            complaint.setId(56L);
            return complaint;
        });

        ComplaintDto created = service.create(email, request);

        assertEquals("BK-1001", created.getBookingReference());
        assertEquals(7L, created.getPassengerId());
    }

    /** Verifies that a trip booking whose start date has not passed is still rejected. */
    @Test
    void createShouldRejectFutureTripBooking() {
        String email = "passenger@trackngo.com";
        ComplaintDto request = buildCreateRequest();

        stubPassengerOwner(email, 7L);
        stubMissingSeatBooking(email, "BK-1001");
        stubTripBookingLookup(email, 1001L, LocalDate.now(), "confirmed");

        BusinessException exception = assertThrows(BusinessException.class, () -> service.create(email, request));

        assertEquals("Complaints can only be submitted for past bookings", exception.getMessage());
        verify(repository, never()).save(any(Complaint.class));
    }

    /** Verifies that a reference matching neither booking kind is reported as not found. */
    @Test
    void createShouldRejectUnknownBookingReference() {
        String email = "passenger@trackngo.com";
        ComplaintDto request = buildCreateRequest();

        stubPassengerOwner(email, 7L);
        stubMissingSeatBooking(email, "BK-1001");
        when(jdbc.queryForMap(contains("FROM trip_booking tb"), eq(email), eq(1001L)))
            .thenThrow(new EmptyResultDataAccessException(1));

        BusinessException exception = assertThrows(BusinessException.class, () -> service.create(email, request));

        assertEquals("Past booking not found for this passenger", exception.getMessage());
        verify(repository, never()).save(any(Complaint.class));
    }

    /** Verifies that passenger-owned complaints are mapped back to DTOs for the mine endpoint. */
    @Test
    void getMineShouldReturnComplaintsOwnedByPassenger() {
        Complaint complaint = buildComplaintEntity(18L);
        when(repository.findOwnedByEmail("passenger@trackngo.com")).thenReturn(List.of(complaint));

        List<ComplaintDto> complaints = service.getMine("passenger@trackngo.com");

        assertEquals(1, complaints.size());
        assertEquals(18L, complaints.get(0).getId());
        assertEquals("BK-1001", complaints.get(0).getBookingReference());
        assertEquals("driver_behavior", complaints.get(0).getComplaintType());
    }

    /** Verifies that resolving a complaint assigns a timestamp when none is provided. */
    @Test
    void updateShouldSetResolvedAtWhenStatusBecomesResolved() {
        Complaint complaint = buildComplaintEntity(18L);
        ComplaintDto request = new ComplaintDto();
        request.setImage(" https://cdn.example.com/updated.jpg ");
        request.setBookingReference(" BK-2002 ");
        request.setComplaintType("Late Arrival");
        request.setPriority(" high ");
        request.setDescription("  Driver arrived late.  ");
        request.setStatus("resolved");
        request.setAdminResponse("  Issue confirmed.  ");

        when(repository.findById(18L)).thenReturn(Optional.of(complaint));
        when(repository.save(any(Complaint.class))).thenAnswer(invocation -> invocation.getArgument(0));

        LocalDateTime beforeUpdate = LocalDateTime.now(ZoneId.of("Asia/Colombo"));
        ComplaintDto updated = service.update(18L, request);
        LocalDateTime afterUpdate = LocalDateTime.now(ZoneId.of("Asia/Colombo"));

        assertEquals("https://cdn.example.com/updated.jpg", updated.getImage());
        assertEquals("BK-2002", updated.getBookingReference());
        assertEquals("late_arrival", updated.getComplaintType());
        assertEquals("high", updated.getPriority());
        assertEquals("Driver arrived late.", updated.getDescription());
        assertEquals("resolved", updated.getStatus());
        assertEquals("Issue confirmed.", updated.getAdminResponse());
        assertNotNull(updated.getResolvedAt());
        assertTrue(!updated.getResolvedAt().isBefore(beforeUpdate) && !updated.getResolvedAt().isAfter(afterUpdate));
    }

    /** Verifies that updating a missing complaint reports a not-found error. */
    @Test
    void updateShouldThrowWhenComplaintDoesNotExist() {
        ComplaintDto request = new ComplaintDto();
        request.setComplaintType("other");
        request.setDescription("Still missing.");

        when(repository.findById(999L)).thenReturn(Optional.empty());

        ResourceNotFoundException exception =
            assertThrows(ResourceNotFoundException.class, () -> service.update(999L, request));

        assertEquals("Complaint not found", exception.getMessage());
    }

    /** Builds a valid complaint creation request that tests can customize. */
    private ComplaintDto buildCreateRequest() {
        ComplaintDto dto = new ComplaintDto();
        dto.setImage(" https://cdn.example.com/image.jpg ");
        dto.setBookingReference("BK-1001");
        dto.setComplaintType("driver_behavior");
        dto.setPriority("medium");
        dto.setDescription("  Bus driver was rude.  ");
        return dto;
    }

    /** Builds a stored complaint entity used when validating read and update mappings. */
    private Complaint buildComplaintEntity(Long id) {
        Complaint complaint = new Complaint();
        complaint.setId(id);
        complaint.setImage("https://cdn.example.com/image.jpg");
        complaint.setBookingReference("BK-1001");
        complaint.setComplaintType("driver_behavior");
        complaint.setPriority("medium");
        complaint.setDescription("Original complaint.");
        complaint.setStatus("pending");
        complaint.setAdminResponse(null);
        complaint.setCreatedAt(LocalDateTime.of(2026, 4, 20, 10, 15));
        complaint.setResolvedAt(null);
        complaint.setPassengerId(7L);
        return complaint;
    }

    /** Stubs the authenticated owner lookup and validates that the passenger profile exists. */
    private void stubPassengerOwner(String email, long userId) {
        when(jdbc.queryForMap(contains("SELECT user_id, user_type FROM `user`"), eq(email)))
            .thenReturn(Map.of("user_id", userId, "user_type", "passenger"));
        when(jdbc.queryForObject(contains("FROM passenger"), eq(Boolean.class), eq(userId))).thenReturn(true);
    }

    /** Stubs the booking lookup used to confirm a passenger is complaining about a past trip. */
    /** Makes the seat_booking lookup miss so resolution falls through to trip bookings. */
    private void stubMissingSeatBooking(String email, String bookingReference) {
        when(jdbc.queryForMap(contains("FROM seat_booking sb"), eq(email), eq(bookingReference)))
            .thenThrow(new EmptyResultDataAccessException(1));
    }

    private void stubTripBookingLookup(String email, long tripBookingId, LocalDate startDate, String status) {
        when(jdbc.queryForMap(contains("FROM trip_booking tb"), eq(email), eq(tripBookingId)))
            .thenReturn(Map.of(
                "status", status,
                "journey_date", startDate
            ));
    }

    private void stubBookingLookup(String email, String bookingReference, LocalDateTime journeyDateTime, String status) {
        when(jdbc.queryForMap(contains("FROM seat_booking sb"), eq(email), eq(bookingReference)))
            .thenReturn(Map.of(
                "booking_reference", bookingReference,
                "status", status,
                "journey_date", LocalDate.from(journeyDateTime),
                "journey_time", LocalTime.from(journeyDateTime)
            ));
    }
}
