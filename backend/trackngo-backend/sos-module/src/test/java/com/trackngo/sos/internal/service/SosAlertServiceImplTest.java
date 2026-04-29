package com.trackngo.sos.internal.service;

import com.trackngo.commons.exception.BusinessException;
import com.trackngo.commons.exception.ResourceNotFoundException;
import com.trackngo.sos.api.dto.SosAlertDto;
import com.trackngo.sos.api.dto.TriggerSosAlertRequest;
import com.trackngo.sos.internal.entity.EmergencyContact;
import com.trackngo.sos.internal.entity.SosAlert;
import com.trackngo.sos.internal.repository.EmergencyContactRepository;
import com.trackngo.sos.internal.repository.SosAlertRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
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
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class SosAlertServiceImplTest {

    @Mock
    private SosAlertRepository repository;

    @Mock
    private EmergencyContactRepository emergencyContactRepository;

    @Mock
    private JdbcTemplate jdbcTemplate;

    @Mock
    private SmsProvider smsProvider;

    @InjectMocks
    private SosAlertServiceImpl service;

    /** Verifies that an SOS alert cannot be triggered without either a passenger or a driver id. */
    @Test
    void triggerAlertShouldRejectRequestsWithoutPassengerOrDriver() {
        TriggerSosAlertRequest request = new TriggerSosAlertRequest();

        assertThrows(BusinessException.class, () -> service.triggerAlert(request));
    }

    /** Verifies that bus details are enriched and emergency contacts receive SMS notifications when enabled. */
    @Test
    void triggerAlertShouldEnrichBusDataAndNotifyEmergencyContacts() {
        TriggerSosAlertRequest request = new TriggerSosAlertRequest();
        request.setPassengerId(15L);
        request.setSharedLocation("Colombo 07 - Logged user location");
        request.setBusNumber(" NB-17 ");
        request.setNotifyEmergencyContacts(true);

        when(jdbcTemplate.queryForList(contains("FROM bus"), eq("NB-17"))).thenReturn(List.of(buildBusRow()));
        when(jdbcTemplate.queryForList(contains("FROM user"), eq(15L))).thenReturn(List.of(buildUserRow("Jane", "Doe")));
        when(emergencyContactRepository.findByOwnerIdAndOwnerTypeOrderByCreatedAtDesc(15L, "passenger"))
                .thenReturn(List.of(buildEmergencyContact("Alice", "0711111111"), buildEmergencyContact("Bob", "0722222222")));
        when(smsProvider.isConfigured()).thenReturn(true);
        when(repository.save(any(SosAlert.class))).thenAnswer(invocation -> {
            SosAlert alert = invocation.getArgument(0);
            alert.setSosId(88L);
            alert.setTriggeredAt(LocalDateTime.of(2026, 4, 26, 10, 0));
            alert.setStatus(SosAlert.SosStatus.triggered);
            return alert;
        });

        SosAlertDto result = service.triggerAlert(request);

        ArgumentCaptor<SosAlert> captor = ArgumentCaptor.forClass(SosAlert.class);
        verify(repository).save(captor.capture());
        SosAlert savedAlert = captor.getValue();
        assertEquals(51L, savedAlert.getBusId());
        assertEquals(90L, savedAlert.getDriverId());
        assertEquals("NB-17", savedAlert.getBusNumber());
        assertEquals("Colombo", savedAlert.getStartLocation());
        assertEquals("Kandy", savedAlert.getEndLocation());

        ArgumentCaptor<String> messageCaptor = ArgumentCaptor.forClass(String.class);
        verify(smsProvider).sendSms(eq("0711111111"), messageCaptor.capture());
        verify(smsProvider).sendSms(eq("0722222222"), anyString());
        assertEquals(88L, result.getSosId());
        assertEquals("triggered", result.getStatus());
        assertEquals("passenger", result.getTriggeredByType());
        String message = messageCaptor.getValue();
        assertEquals(true, message.contains("Passenger Jane Doe triggered an emergency."));
        assertEquals(true, message.contains("Bus: NB-17."));
        assertEquals(true, message.contains("Route: Colombo to Kandy."));
        assertEquals(true, message.contains("Current location: Colombo 07."));
    }

    /** Verifies that missing SMS configuration skips emergency-contact notifications safely. */
    @Test
    void triggerAlertShouldSkipSmsWhenProviderIsNotConfigured() {
        TriggerSosAlertRequest request = new TriggerSosAlertRequest();
        request.setDriverId(9L);
        request.setStartLocation("Matara");
        request.setEndLocation("Galle");
        request.setNotifyEmergencyContacts(true);

        when(smsProvider.isConfigured()).thenReturn(false);
        when(smsProvider.getProviderName()).thenReturn("mock-sms");
        when(repository.save(any(SosAlert.class))).thenAnswer(invocation -> {
            SosAlert alert = invocation.getArgument(0);
            alert.setSosId(45L);
            alert.setTriggeredAt(LocalDateTime.now());
            alert.setStatus(SosAlert.SosStatus.triggered);
            return alert;
        });

        SosAlertDto result = service.triggerAlert(request);

        assertEquals("driver", result.getTriggeredByType());
        verify(emergencyContactRepository, never()).findByOwnerIdAndOwnerTypeOrderByCreatedAtDesc(any(), any());
        verify(smsProvider, never()).sendSms(anyString(), anyString());
    }

    /** Verifies that active SOS rows are mapped into DTOs with passenger details and emergency contacts. */
    @Test
    void getActiveAlertsShouldMapJoinedAlertRowsAndContacts() {
        when(jdbcTemplate.queryForList(anyString())).thenReturn(List.of(buildActiveAlertRow()));
        when(emergencyContactRepository.findByOwnerIdAndOwnerTypeOrderByCreatedAtDesc(15L, "passenger"))
                .thenReturn(List.of(buildEmergencyContact("Alice", "0711111111")));

        List<SosAlertDto> result = service.getActiveAlerts();

        assertEquals(1, result.size());
        SosAlertDto alert = result.get(0);
        assertEquals(88L, alert.getSosId());
        assertEquals("Jane Doe", alert.getPassengerName());
        assertEquals("Nimal Silva", alert.getDriverName());
        assertEquals("Jane Doe", alert.getName());
        assertEquals("0712345678", alert.getPhoneNumber());
        assertEquals("NB-17", alert.getBusNumber());
        assertEquals("Colombo", alert.getStartLocation());
        assertEquals("Kandy", alert.getEndLocation());
        assertEquals(1, alert.getEmergencyContacts().size());
        assertEquals("Alice", alert.getEmergencyContacts().get(0).getName());
    }

    /** Verifies that resolving an SOS alert records the admin id and resolution timestamp. */
    @Test
    void resolveAlertShouldSetResolvedStateAndAdmin() {
        SosAlert alert = new SosAlert();
        alert.setSosId(7L);
        alert.setPassengerId(15L);
        alert.setStatus(SosAlert.SosStatus.triggered);
        when(repository.findById(7L)).thenReturn(Optional.of(alert));
        when(repository.save(any(SosAlert.class))).thenAnswer(invocation -> invocation.getArgument(0));

        SosAlertDto result = service.resolveAlert(7L, 3L);

        assertEquals("resolved", result.getStatus());
        assertEquals("passenger", result.getTriggeredByType());
        assertNotNull(result.getResolvedAt());
        assertEquals(3L, alert.getAdminId());
    }

    /** Verifies that dismissing an unknown SOS alert surfaces a not-found error. */
    @Test
    void dismissAlertShouldThrowWhenAlertDoesNotExist() {
        when(repository.findById(70L)).thenReturn(Optional.empty());

        assertThrows(ResourceNotFoundException.class, () -> service.dismissAlert(70L, 4L));
    }

    /** Builds the bus lookup row returned by the JDBC enrichment query. */
    private Map<String, Object> buildBusRow() {
        Map<String, Object> row = new HashMap<>();
        row.put("bus_id", 51L);
        row.put("bus_number", "NB-17");
        row.put("driver_id", 90L);
        row.put("start_location", "Colombo");
        row.put("end_location", "Kandy");
        return row;
    }

    /** Builds the user lookup row used to compose emergency-contact SMS messages. */
    private Map<String, Object> buildUserRow(String firstName, String lastName) {
        Map<String, Object> row = new HashMap<>();
        row.put("first_name", firstName);
        row.put("last_name", lastName);
        return row;
    }

    /** Builds the active-alert row returned by the admin dashboard query. */
    private Map<String, Object> buildActiveAlertRow() {
        Map<String, Object> row = new HashMap<>();
        row.put("sos_id", 88L);
        row.put("shared_location", "Colombo 07");
        row.put("status", "triggered");
        row.put("triggered_at", Timestamp.valueOf(LocalDateTime.of(2026, 4, 26, 9, 30)));
        row.put("resolved_at", null);
        row.put("passenger_id", 15L);
        row.put("driver_id", 90L);
        row.put("admin_id", null);
        row.put("triggered_by_type", "passenger");
        row.put("passenger_first_name", "Jane");
        row.put("passenger_last_name", "Doe");
        row.put("passenger_phone_number", "0712345678");
        row.put("passenger_profile_photo", "/uploads/jane.jpg");
        row.put("driver_first_name", "Nimal");
        row.put("driver_last_name", "Silva");
        row.put("driver_phone_number", "0771234567");
        row.put("start_location", "Colombo");
        row.put("end_location", "Kandy");
        row.put("bus_number", "NB-17");
        row.put("route_name", "Colombo-Kandy Express");
        row.put("bus_id", 51L);
        return row;
    }

    /** Builds a representative emergency contact entity used for notification and mapping tests. */
    private EmergencyContact buildEmergencyContact(String name, String teleNumber) {
        EmergencyContact contact = new EmergencyContact();
        contact.setContactId(1L);
        contact.setOwnerId(15L);
        contact.setOwnerType("passenger");
        contact.setName(name);
        contact.setTeleNumber(teleNumber);
        contact.setRelationship("Sibling");
        return contact;
    }
}
