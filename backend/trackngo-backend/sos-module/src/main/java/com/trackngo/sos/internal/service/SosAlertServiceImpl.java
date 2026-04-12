package com.trackngo.sos.internal.service;

import com.trackngo.commons.exception.ResourceNotFoundException;
import com.trackngo.commons.exception.BusinessException;
import com.trackngo.sos.api.SosAlertService;
import com.trackngo.sos.api.dto.SosAlertDto;
import com.trackngo.sos.api.dto.EmergencyContactDto;
import com.trackngo.sos.api.dto.TriggerSosAlertRequest;
import com.trackngo.sos.internal.entity.SosAlert;
import com.trackngo.sos.internal.repository.SosAlertRepository;
import com.trackngo.sos.internal.repository.EmergencyContactRepository;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class SosAlertServiceImpl implements SosAlertService {

    private final SosAlertRepository repository;
    private final EmergencyContactRepository emergencyContactRepository;
    private final JdbcTemplate jdbcTemplate;

    @PostConstruct
    public void ensureSosAlertColumns() {
        ensureColumnExists("bus_id", "BIGINT NULL");
        ensureColumnExists("bus_number", "VARCHAR(255) NULL");
        ensureColumnExists("start_location", "VARCHAR(255) NULL");
        ensureColumnExists("end_location", "VARCHAR(255) NULL");
    }

    @Override
    public SosAlertDto triggerAlert(TriggerSosAlertRequest request) {
        if (request == null || (request.getPassengerId() == null && request.getDriverId() == null)) {
            throw new BusinessException("Passenger or driver is required to trigger SOS alert");
        }

        SosAlert alert = new SosAlert();
        alert.setPassengerId(request.getPassengerId());
        alert.setDriverId(request.getDriverId());
        alert.setSharedLocation(request.getSharedLocation());

        String requestedBusNumber = trimToNull(request.getBusNumber());
        String requestedStart = trimToNull(request.getStartLocation());
        String requestedEnd = trimToNull(request.getEndLocation());

        if (requestedBusNumber != null) {
            List<Map<String, Object>> busRows = jdbcTemplate.queryForList(
                """
                SELECT b.bus_id, b.bus_number, b.driver_id, r.start_location, r.end_location
                FROM bus b
                LEFT JOIN route r ON r.route_id = b.route_id
                WHERE b.bus_number = ?
                LIMIT 1
                """,
                requestedBusNumber
            );

            if (!busRows.isEmpty()) {
                Map<String, Object> busRow = busRows.get(0);
                Number busIdValue = (Number) busRow.get("bus_id");
                Number driverIdValue = (Number) busRow.get("driver_id");

                if (busIdValue != null) {
                    alert.setBusId(busIdValue.longValue());
                }
                if (alert.getDriverId() == null && driverIdValue != null) {
                    alert.setDriverId(driverIdValue.longValue());
                }

                String dbBusNumber = trimToNull((String) busRow.get("bus_number"));
                String dbStart = trimToNull((String) busRow.get("start_location"));
                String dbEnd = trimToNull((String) busRow.get("end_location"));

                alert.setBusNumber(requestedBusNumber != null ? requestedBusNumber : dbBusNumber);
                alert.setStartLocation(requestedStart != null ? requestedStart : dbStart);
                alert.setEndLocation(requestedEnd != null ? requestedEnd : dbEnd);
            } else {
                alert.setBusNumber(requestedBusNumber);
                alert.setStartLocation(requestedStart);
                alert.setEndLocation(requestedEnd);
            }
        } else {
            alert.setStartLocation(requestedStart);
            alert.setEndLocation(requestedEnd);
        }

        SosAlert saved = repository.save(alert);
        return toDto(saved);
    }

    @Override
    public List<SosAlertDto> getActiveAlerts() {
        String sql = """
            SELECT s.sos_id, s.shared_location, s.status,
                   s.triggered_at, s.resolved_at, s.passenger_id, s.driver_id, s.admin_id,
                   CASE WHEN s.passenger_id IS NOT NULL THEN 'passenger' ELSE 'driver' END AS triggered_by_type,
                   pu.first_name AS passenger_first_name,
                   pu.last_name AS passenger_last_name,
                   p.mobile_number AS passenger_phone_number,
                   p.profile_photo AS passenger_profile_photo,
                   du.first_name AS driver_first_name,
                   du.last_name AS driver_last_name,
                   d.phone_number AS driver_phone_number,
                   COALESCE(s.start_location, r.start_location) AS start_location,
                   COALESCE(s.end_location, r.end_location) AS end_location,
                   COALESCE(s.bus_number, b.bus_number) AS bus_number,
                   r.route_name,
                   s.bus_id
            FROM sos_alert s
            LEFT JOIN bus b ON b.bus_id = s.bus_id
            LEFT JOIN route r ON r.route_id = b.route_id
            LEFT JOIN passenger p ON p.passenger_id = s.passenger_id
            LEFT JOIN user pu ON pu.user_id = p.passenger_id
            LEFT JOIN driver d ON d.driver_id = COALESCE(s.driver_id, b.driver_id)
            LEFT JOIN user du ON du.user_id = d.driver_id
            WHERE s.status = 'triggered'
            ORDER BY s.triggered_at DESC
            """;

        List<Map<String, Object>> rows = jdbcTemplate.queryForList(sql);

        return rows.stream().map(row -> {
            SosAlertDto dto = new SosAlertDto();
            dto.setSosId(((Number) row.get("sos_id")).longValue());
            dto.setSharedLocation((String) row.get("shared_location"));
            dto.setStatus((String) row.get("status"));
            dto.setTriggeredAt(row.get("triggered_at") != null
                    ? ((java.sql.Timestamp) row.get("triggered_at")).toLocalDateTime() : null);
            dto.setResolvedAt(row.get("resolved_at") != null
                    ? ((java.sql.Timestamp) row.get("resolved_at")).toLocalDateTime() : null);
            dto.setPassengerId(row.get("passenger_id") != null
                    ? ((Number) row.get("passenger_id")).longValue() : null);
            dto.setDriverId(row.get("driver_id") != null
                    ? ((Number) row.get("driver_id")).longValue() : null);
            dto.setTriggeredByType((String) row.get("triggered_by_type"));

                String passengerName = joinName(
                    (String) row.get("passenger_first_name"),
                    (String) row.get("passenger_last_name")
                );
                String driverName = joinName(
                    (String) row.get("driver_first_name"),
                    (String) row.get("driver_last_name")
                );

                dto.setPassengerName(passengerName);
                dto.setPassengerPhoneNumber((String) row.get("passenger_phone_number"));
                dto.setDriverName(driverName);
                dto.setDriverPhoneNumber((String) row.get("driver_phone_number"));

                if ("passenger".equals(dto.getTriggeredByType())) {
                dto.setName(passengerName);
                dto.setPhoneNumber(dto.getPassengerPhoneNumber());
                dto.setProfilePhoto((String) row.get("passenger_profile_photo"));
                } else {
                dto.setName(driverName);
                dto.setPhoneNumber(dto.getDriverPhoneNumber());
                dto.setProfilePhoto(null);
                }

            dto.setRouteName((String) row.get("route_name"));
                dto.setBusNumber((String) row.get("bus_number"));
                dto.setStartLocation((String) row.get("start_location"));
                dto.setEndLocation((String) row.get("end_location"));

            // Fetch emergency contacts for the person who triggered the SOS
            Long ownerId = dto.getPassengerId() != null ? dto.getPassengerId() : dto.getDriverId();
            String ownerType = dto.getTriggeredByType();
            if (ownerId != null && ownerType != null) {
                List<EmergencyContactDto> contacts = emergencyContactRepository
                        .findByOwnerIdAndOwnerTypeOrderByCreatedAtDesc(ownerId, ownerType)
                        .stream()
                        .map(ec -> {
                            EmergencyContactDto ecDto = new EmergencyContactDto();
                            ecDto.setContactId(ec.getContactId());
                            ecDto.setOwnerId(ec.getOwnerId());
                            ecDto.setOwnerType(ec.getOwnerType());
                            ecDto.setName(ec.getName());
                            ecDto.setTeleNumber(ec.getTeleNumber());
                            ecDto.setRelationship(ec.getRelationship());
                            return ecDto;
                        }).toList();
                dto.setEmergencyContacts(contacts);
            } else {
                dto.setEmergencyContacts(new ArrayList<>());
            }

            return dto;
        }).toList();
    }

    @Override
    public SosAlertDto resolveAlert(Long sosId, Long adminId) {
        SosAlert alert = repository.findById(sosId)
                .orElseThrow(() -> new ResourceNotFoundException("SOS alert not found"));
        alert.setStatus(SosAlert.SosStatus.resolved);
        alert.setAdminId(adminId);
        alert.setResolvedAt(LocalDateTime.now());
        repository.save(alert);
        return toDto(alert);
    }

    @Override
    public SosAlertDto dismissAlert(Long sosId, Long adminId) {
        SosAlert alert = repository.findById(sosId)
                .orElseThrow(() -> new ResourceNotFoundException("SOS alert not found"));
        alert.setStatus(SosAlert.SosStatus.false_alarm);
        alert.setAdminId(adminId);
        alert.setResolvedAt(LocalDateTime.now());
        repository.save(alert);
        return toDto(alert);
    }

    private SosAlertDto toDto(SosAlert alert) {
        SosAlertDto dto = new SosAlertDto();
        dto.setSosId(alert.getSosId());
        dto.setSharedLocation(alert.getSharedLocation());
        dto.setStatus(alert.getStatus().name());
        dto.setTriggeredAt(alert.getTriggeredAt());
        dto.setResolvedAt(alert.getResolvedAt());
        dto.setPassengerId(alert.getPassengerId());
        dto.setDriverId(alert.getDriverId());
        dto.setBusNumber(alert.getBusNumber());
        dto.setStartLocation(alert.getStartLocation());
        dto.setEndLocation(alert.getEndLocation());
        dto.setTriggeredByType(alert.getPassengerId() != null ? "passenger" : "driver");
        return dto;
    }

    private static String joinName(String firstName, String lastName) {
        String joined = ((firstName == null ? "" : firstName.trim()) + " " + (lastName == null ? "" : lastName.trim())).trim();
        return joined.isBlank() ? null : joined;
    }

    private static String trimToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private void ensureColumnExists(String columnName, String definition) {
        Integer count = jdbcTemplate.queryForObject(
            """
            SELECT COUNT(*)
            FROM information_schema.columns
            WHERE table_schema = DATABASE()
              AND table_name = 'sos_alert'
              AND column_name = ?
            """,
            Integer.class,
            columnName
        );

        if (count != null && count == 0) {
            jdbcTemplate.execute("ALTER TABLE sos_alert ADD COLUMN " + columnName + " " + definition);
        }
    }
}
