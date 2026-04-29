package com.trackngo.complaint.internal.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.trackngo.complaint.api.dto.AdminComplaintDtos.AdminComplaintDetail;
import com.trackngo.complaint.api.dto.AdminComplaintDtos.AdminComplaintListItem;
import com.trackngo.complaint.api.dto.AdminComplaintDtos.AdminComplaintUpdateRequest;
import com.trackngo.complaint.internal.entity.Complaint;
import com.trackngo.complaint.internal.repository.ComplaintRepository;
import com.trackngo.commons.exception.BusinessException;
import com.trackngo.commons.exception.ResourceNotFoundException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.jdbc.core.JdbcTemplate;

import java.sql.Timestamp;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AdminComplaintServiceTest {

    @Mock
    private JdbcTemplate jdbc;

    @Mock
    private ComplaintRepository repository;

    private AdminComplaintService service;

    /** Creates a fresh service instance with a real object mapper for image parsing tests. */
    @BeforeEach
    void setUp() {
        service = new AdminComplaintService(jdbc, repository, new ObjectMapper());
    }

    /** Verifies that the admin complaint list row is transformed into dashboard-friendly labels. */
    @Test
    void listComplaintsShouldMapDashboardFields() {
        when(jdbc.queryForList(anyString())).thenReturn(List.of(buildListRow()));

        List<AdminComplaintListItem> complaints = service.listComplaints();

        assertEquals(1, complaints.size());
        assertEquals("#CP-0042", complaints.get(0).id());
        assertEquals("High", complaints.get(0).priority());
        assertEquals("Driver Behavior", complaints.get(0).type());
        assertEquals("Alice Perera", complaints.get(0).passengerName());
        assertEquals("AP", complaints.get(0).passengerInitials());
        assertEquals("NB-17", complaints.get(0).busId());
        assertEquals("Nimal Silva", complaints.get(0).driverName());
        assertTrue(complaints.get(0).hasImages());
        assertEquals("gallery", complaints.get(0).imageType());
        assertEquals("Under Review", complaints.get(0).status());
        assertEquals("Apr 20, 09:30 AM", complaints.get(0).created());
    }

    /** Verifies that resolving a complaint stores the normalized status, response, and timestamp. */
    @Test
    void updateComplaintShouldPersistResolvedStateAndResponse() {
        Complaint complaint = new Complaint();
        complaint.setId(42L);
        complaint.setStatus("pending");

        when(repository.findById(42L)).thenReturn(Optional.of(complaint));
        when(repository.save(any(Complaint.class))).thenAnswer(invocation -> invocation.getArgument(0));

        service.updateComplaint(42L, new AdminComplaintUpdateRequest("resolved", "  Investigated and closed.  "));

        assertEquals("resolved", complaint.getStatus());
        assertEquals("Investigated and closed.", complaint.getAdminResponse());
        assertNotNull(complaint.getResolvedAt());
        verify(repository).save(complaint);
    }

    /** Verifies that unsupported admin status values are rejected before saving changes. */
    @Test
    void updateComplaintShouldRejectInvalidStatus() {
        Complaint complaint = new Complaint();
        complaint.setId(42L);
        when(repository.findById(42L)).thenReturn(Optional.of(complaint));

        BusinessException exception = assertThrows(
            BusinessException.class,
            () -> service.updateComplaint(42L, new AdminComplaintUpdateRequest("closed", "ignored"))
        );

        assertEquals("Invalid complaint status", exception.getMessage());
        verify(repository, never()).save(any(Complaint.class));
    }

    /** Verifies that complaint detail responses parse JSON image arrays and default blank optional fields. */
    @Test
    void getComplaintDetailShouldMapJsonImages() {
        when(jdbc.queryForList(anyString(), eq(42L))).thenReturn(List.of(buildDetailRow()));

        AdminComplaintDetail detail = service.getComplaintDetail(42L);

        assertEquals("#CP-0042", detail.id());
        assertEquals("Safety Concern", detail.type());
        assertEquals("Pending", detail.status());
        assertEquals("Alice Perera", detail.passengerName());
        assertEquals("0712345678", detail.passengerPhoneNumber());
        assertEquals("Nimal Silva", detail.driverName());
        assertEquals("--", detail.adminResponse());
        assertEquals(List.of("https://cdn.example.com/a.jpg", "https://cdn.example.com/b.jpg"), detail.images());
    }

    /** Verifies that requesting a missing complaint detail returns a not-found error. */
    @Test
    void getComplaintDetailShouldThrowWhenComplaintDoesNotExist() {
        when(jdbc.queryForList(anyString(), anyLong())).thenReturn(List.of());

        ResourceNotFoundException exception =
            assertThrows(ResourceNotFoundException.class, () -> service.getComplaintDetail(999L));

        assertEquals("Complaint not found", exception.getMessage());
    }

    /** Builds a representative list row used by the admin complaint dashboard mapping test. */
    private Map<String, Object> buildListRow() {
        Map<String, Object> row = new HashMap<>();
        row.put("complaint_id", 42L);
        row.put("priority", "high");
        row.put("complaint_type", "driver_behavior");
        row.put("description", "Driver skipped a stop.");
        row.put("image", "[\"https://cdn.example.com/a.jpg\"]");
        row.put("status", "under_review");
        row.put("created_at", Timestamp.valueOf(LocalDateTime.of(2026, 4, 20, 9, 30)));
        row.put("booking_reference", "BK-1001");
        row.put("bus_number", "NB-17");
        row.put("reporter_first_name", "Alice");
        row.put("reporter_last_name", "Perera");
        row.put("driver_first_name", "Nimal");
        row.put("driver_last_name", "Silva");
        return row;
    }

    /** Builds a representative detail row used by the admin complaint detail mapping test. */
    private Map<String, Object> buildDetailRow() {
        Map<String, Object> row = new HashMap<>();
        row.put("complaint_id", 42L);
        row.put("priority", "medium");
        row.put("complaint_type", "safety_concern");
        row.put("description", "Door was not closing properly.");
        row.put("image", "[\"https://cdn.example.com/a.jpg\", \" \", \"https://cdn.example.com/b.jpg\"]");
        row.put("status", "pending");
        row.put("created_at", Timestamp.valueOf(LocalDateTime.of(2026, 4, 21, 14, 45)));
        row.put("admin_response", null);
        row.put("booking_reference", "BK-2002");
        row.put("bus_number", "ND-08");
        row.put("reporter_first_name", "Alice");
        row.put("reporter_last_name", "Perera");
        row.put("passenger_phone_number", "0712345678");
        row.put("driver_first_name", "Nimal");
        row.put("driver_last_name", "Silva");
        row.put("driver_phone_number", "0777654321");
        return row;
    }
}
