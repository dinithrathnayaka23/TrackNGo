package com.trackngo.app.service;

import com.trackngo.app.dto.ContractBusDto;
import com.trackngo.app.dto.CorporateContractDetailDto;
import com.trackngo.app.dto.CorporateContractDto;
import com.trackngo.app.dto.CorporateInvoiceDto;
import com.trackngo.app.dto.ShiftLegDto;
import com.trackngo.notification.api.NotificationService;
import com.trackngo.notification.api.dto.NotificationDto;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.jdbc.support.KeyHolder;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.time.LocalTime;
import java.util.List;
import java.util.Map;

@Service
@Slf4j
@RequiredArgsConstructor
public class CorporateService {

    private final JdbcTemplate jdbcTemplate;
    private final NotificationService notificationService;
    private final CorporatePricingService pricingService;

    private static final List<String> VALID_SHIFT_TYPES = List.of("morning", "evening", "both");
    private static final List<String> VALID_BUS_TYPES = List.of("standard", "ac", "mini");

    private static final String CONTRACT_COLUMNS = """
                contract_id, contract_name, starting_location, destination,
                shift_type, start_shift_time, end_shift_time,
                morning_pickup_location, morning_pickup_lat, morning_pickup_lng, morning_pickup_time,
                morning_dropoff_location, morning_dropoff_lat, morning_dropoff_lng, morning_dropoff_time,
                morning_distance_km,
                evening_pickup_location, evening_pickup_lat, evening_pickup_lng, evening_pickup_time,
                evening_dropoff_location, evening_dropoff_lat, evening_dropoff_lng, evening_dropoff_time,
                evening_distance_km,
                employee_count, working_days, bus_type, distance_km,
                status, billing_amount,
                start_date, end_date, created_at, corporate_user_id, bus_id
            """;

    private static final String CONTRACTS_SQL = """
            SELECT %s
            FROM corporate_contract
            WHERE corporate_user_id = ?
            ORDER BY created_at DESC
            """.formatted(CONTRACT_COLUMNS);

    private static final String REQUIRED_PROFILE_FIELDS_SQL = """
            SELECT business_registration_number, industry, address,
                   contact_person_designation, contact_phone
            FROM corporate_user
            WHERE corporate_user_id = ?
            """;

    private static final String INVOICES_SQL = """
            SELECT
                i.invoice_number, i.contract_id, i.amount, i.status,
                i.date, i.due_date, i.created_at
            FROM corporate_invoices i
            JOIN corporate_contract c ON i.contract_id = c.contract_id
            WHERE c.corporate_user_id = ?
            ORDER BY i.date DESC
            """;

    private static final String CONTRACT_INVOICES_SQL = """
            SELECT
                invoice_number, contract_id, amount, status,
                date, due_date, created_at
            FROM corporate_invoices
            WHERE contract_id = ?
            ORDER BY date DESC
            """;

    private static final String CONTRACT_DETAIL_SQL = """
            SELECT
                c.contract_id, c.contract_name, c.starting_location, c.destination,
                c.shift_type, c.start_shift_time, c.end_shift_time,
                c.morning_pickup_location, c.morning_pickup_lat, c.morning_pickup_lng, c.morning_pickup_time,
                c.morning_dropoff_location, c.morning_dropoff_lat, c.morning_dropoff_lng, c.morning_dropoff_time,
                c.morning_distance_km,
                c.evening_pickup_location, c.evening_pickup_lat, c.evening_pickup_lng, c.evening_pickup_time,
                c.evening_dropoff_location, c.evening_dropoff_lat, c.evening_dropoff_lng, c.evening_dropoff_time,
                c.evening_distance_km,
                c.employee_count, c.working_days, c.bus_type, c.distance_km,
                c.status, c.billing_amount,
                c.start_date, c.end_date, c.created_at, c.corporate_user_id, c.bus_id,
                cu.company_name, cu.contact_person_name, cu.contact_phone,
                b.bus_number, b.bus_brand, b.registration_number, b.seat_capacity,
                b.amenities, b.bus_condition, b.status AS bus_status,
                r.route_name,
                d.driver_id, d.phone_number AS driver_phone,
                du.first_name AS driver_first_name, du.last_name AS driver_last_name
            FROM corporate_contract c
            LEFT JOIN corporate_user cu ON cu.corporate_user_id = c.corporate_user_id
            LEFT JOIN bus b ON b.bus_id = c.bus_id
            LEFT JOIN route r ON r.route_id = b.route_id
            LEFT JOIN driver d ON d.driver_id = b.driver_id
            LEFT JOIN `user` du ON du.user_id = d.driver_id
            WHERE c.contract_id = ?
            """;

    public List<CorporateContractDto> getContracts(Long userId) {
        return jdbcTemplate.query(CONTRACTS_SQL, (rs, rowNum) -> mapContract(rs), userId);
    }

    private static CorporateContractDto mapContract(ResultSet rs) throws SQLException {
        return new CorporateContractDto(
                rs.getLong("contract_id"),
                rs.getString("contract_name"),
                rs.getString("starting_location"),
                rs.getString("destination"),
                rs.getString("shift_type"),
                timeOrNull(rs, "start_shift_time"),
                timeOrNull(rs, "end_shift_time"),
                legOrNull(rs, "morning_pickup_location", "morning_pickup_lat", "morning_pickup_lng", "morning_pickup_time"),
                legOrNull(rs, "morning_dropoff_location", "morning_dropoff_lat", "morning_dropoff_lng", "morning_dropoff_time"),
                rs.getBigDecimal("morning_distance_km"),
                legOrNull(rs, "evening_pickup_location", "evening_pickup_lat", "evening_pickup_lng", "evening_pickup_time"),
                legOrNull(rs, "evening_dropoff_location", "evening_dropoff_lat", "evening_dropoff_lng", "evening_dropoff_time"),
                rs.getBigDecimal("evening_distance_km"),
                rs.getInt("employee_count"),
                rs.getString("working_days"),
                rs.getString("bus_type"),
                rs.getBigDecimal("distance_km"),
                rs.getString("status"),
                rs.getBigDecimal("billing_amount"),
                rs.getDate("start_date") != null ? rs.getDate("start_date").toLocalDate() : null,
                rs.getDate("end_date") != null ? rs.getDate("end_date").toLocalDate() : null,
                rs.getString("created_at"),
                rs.getLong("corporate_user_id"),
                rs.getLong("bus_id") == 0 ? null : rs.getLong("bus_id")
        );
    }

    private static LocalTime timeOrNull(ResultSet rs, String column) throws SQLException {
        java.sql.Time time = rs.getTime(column);
        return time != null ? time.toLocalTime() : null;
    }

    private static ShiftLegDto legOrNull(
            ResultSet rs, String locationCol, String latCol, String lngCol, String timeCol
    ) throws SQLException {
        String location = rs.getString(locationCol);
        if (location == null) {
            return null;
        }
        return new ShiftLegDto(location, rs.getBigDecimal(latCol), rs.getBigDecimal(lngCol), timeOrNull(rs, timeCol));
    }

    public List<CorporateInvoiceDto> getInvoices(Long userId) {
        return jdbcTemplate.query(INVOICES_SQL, (rs, rowNum) -> new CorporateInvoiceDto(
                rs.getLong("invoice_number"),
                rs.getLong("contract_id"),
                rs.getBigDecimal("amount"),
                rs.getString("status"),
                rs.getDate("date") != null ? rs.getDate("date").toLocalDate() : null,
                rs.getDate("due_date") != null ? rs.getDate("due_date").toLocalDate() : null,
                rs.getString("created_at")
        ), userId);
    }

    /**
     * Returns the full detail of a single contract (bus, driver, company and invoices).
     * Returns null when the contract does not exist, or when userId is supplied and
     * does not own the contract.
     */
    public CorporateContractDetailDto getContractDetail(Long contractId, Long userId) {
        List<CorporateInvoiceDto> invoices =
                jdbcTemplate.query(CONTRACT_INVOICES_SQL, (rs, rowNum) -> new CorporateInvoiceDto(
                        rs.getLong("invoice_number"),
                        rs.getLong("contract_id"),
                        rs.getBigDecimal("amount"),
                        rs.getString("status"),
                        rs.getDate("date") != null ? rs.getDate("date").toLocalDate() : null,
                        rs.getDate("due_date") != null ? rs.getDate("due_date").toLocalDate() : null,
                        rs.getString("created_at")
                ), contractId);

        BigDecimal totalBilled = sumInvoices(invoices, "pending", "overdue", "paid");
        BigDecimal totalPaid = sumInvoices(invoices, "paid");
        BigDecimal outstanding = sumInvoices(invoices, "pending", "overdue");

        CorporateContractDetailDto detail = jdbcTemplate.query(CONTRACT_DETAIL_SQL, rs -> {
            if (!rs.next()) {
                return null;
            }
            Long busId = rs.getObject("bus_id") != null ? rs.getLong("bus_id") : null;
            ContractBusDto bus = busId == null ? null : new ContractBusDto(
                    busId,
                    rs.getString("bus_number"),
                    rs.getString("bus_brand"),
                    rs.getString("registration_number"),
                    rs.getObject("seat_capacity") != null ? rs.getInt("seat_capacity") : null,
                    rs.getString("amenities"),
                    rs.getString("bus_condition"),
                    rs.getString("bus_status"),
                    rs.getString("route_name"),
                    rs.getObject("driver_id") != null ? rs.getLong("driver_id") : null,
                    buildDriverName(rs.getString("driver_first_name"), rs.getString("driver_last_name")),
                    rs.getString("driver_phone")
            );

            return new CorporateContractDetailDto(
                    rs.getLong("contract_id"),
                    rs.getString("contract_name"),
                    rs.getString("starting_location"),
                    rs.getString("destination"),
                    rs.getString("shift_type"),
                    timeOrNull(rs, "start_shift_time"),
                    timeOrNull(rs, "end_shift_time"),
                    legOrNull(rs, "morning_pickup_location", "morning_pickup_lat", "morning_pickup_lng", "morning_pickup_time"),
                    legOrNull(rs, "morning_dropoff_location", "morning_dropoff_lat", "morning_dropoff_lng", "morning_dropoff_time"),
                    rs.getBigDecimal("morning_distance_km"),
                    legOrNull(rs, "evening_pickup_location", "evening_pickup_lat", "evening_pickup_lng", "evening_pickup_time"),
                    legOrNull(rs, "evening_dropoff_location", "evening_dropoff_lat", "evening_dropoff_lng", "evening_dropoff_time"),
                    rs.getBigDecimal("evening_distance_km"),
                    rs.getInt("employee_count"),
                    rs.getString("working_days"),
                    rs.getString("bus_type"),
                    rs.getBigDecimal("distance_km"),
                    rs.getString("status"),
                    rs.getBigDecimal("billing_amount"),
                    rs.getDate("start_date") != null ? rs.getDate("start_date").toLocalDate() : null,
                    rs.getDate("end_date") != null ? rs.getDate("end_date").toLocalDate() : null,
                    rs.getString("created_at"),
                    rs.getLong("corporate_user_id"),
                    busId,
                    rs.getString("company_name"),
                    rs.getString("contact_person_name"),
                    rs.getString("contact_phone"),
                    bus,
                    invoices,
                    totalBilled,
                    totalPaid,
                    outstanding
            );
        }, contractId);

        if (detail == null) {
            return null;
        }
        if (userId != null && !userId.equals(detail.corporateUserId())) {
            return null;
        }
        return detail;
    }

    private static BigDecimal sumInvoices(List<CorporateInvoiceDto> invoices, String... statuses) {
        List<String> wanted = List.of(statuses);
        return invoices.stream()
                .filter(inv -> inv.status() != null && wanted.contains(inv.status().toLowerCase()))
                .map(inv -> inv.amount() != null ? inv.amount() : BigDecimal.ZERO)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    private static String buildDriverName(String firstName, String lastName) {
        String name = ((firstName != null ? firstName : "") + " " + (lastName != null ? lastName : "")).trim();
        return name.isEmpty() ? null : name;
    }

    public CorporateContractDto createContract(CorporateContractDto dto) {
        requireCompleteProfile(dto.corporateUserId());
        validateShiftDetails(dto);
        String busType = dto.busType() == null ? "standard" : dto.busType().toLowerCase();

        boolean needsMorning = needsMorning(dto.shiftType());
        boolean needsEvening = needsEvening(dto.shiftType());
        BigDecimal totalDistanceKm = BigDecimal.ZERO;
        if (needsMorning) totalDistanceKm = totalDistanceKm.add(dto.morningDistanceKm());
        if (needsEvening) totalDistanceKm = totalDistanceKm.add(dto.eveningDistanceKm());

        BigDecimal billingAmount = pricingService.calculateMonthlyAmount(dto);

        String insertSql = """
                INSERT INTO corporate_contract (
                    contract_name, starting_location, destination,
                    shift_type, start_shift_time, end_shift_time,
                    morning_pickup_location, morning_pickup_lat, morning_pickup_lng, morning_pickup_time,
                    morning_dropoff_location, morning_dropoff_lat, morning_dropoff_lng, morning_dropoff_time,
                    morning_distance_km,
                    evening_pickup_location, evening_pickup_lat, evening_pickup_lng, evening_pickup_time,
                    evening_dropoff_location, evening_dropoff_lat, evening_dropoff_lng, evening_dropoff_time,
                    evening_distance_km,
                    employee_count, working_days, bus_type, distance_km,
                    billing_amount, start_date, end_date, corporate_user_id, status
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')
                """;
        ShiftLegDto morningPickup = dto.morningPickup();
        ShiftLegDto morningDropoff = dto.morningDropoff();
        ShiftLegDto eveningPickup = dto.eveningPickup();
        ShiftLegDto eveningDropoff = dto.eveningDropoff();

        KeyHolder keyHolder = new GeneratedKeyHolder();
        BigDecimal finalTotalDistanceKm = totalDistanceKm;
        jdbcTemplate.update(con -> {
            PreparedStatement ps = con.prepareStatement(insertSql, Statement.RETURN_GENERATED_KEYS);
            ps.setString(1, dto.contractName());
            ps.setString(2, resolveStartingLocation(dto));
            ps.setString(3, resolveDestination(dto));
            ps.setString(4, dto.shiftType());
            ps.setObject(5, resolveStartShift(dto));
            ps.setObject(6, resolveEndShift(dto));
            ps.setString(7, morningPickup != null ? morningPickup.location() : null);
            ps.setBigDecimal(8, morningPickup != null ? morningPickup.latitude() : null);
            ps.setBigDecimal(9, morningPickup != null ? morningPickup.longitude() : null);
            ps.setObject(10, morningPickup != null ? morningPickup.time() : null);
            ps.setString(11, morningDropoff != null ? morningDropoff.location() : null);
            ps.setBigDecimal(12, morningDropoff != null ? morningDropoff.latitude() : null);
            ps.setBigDecimal(13, morningDropoff != null ? morningDropoff.longitude() : null);
            ps.setObject(14, morningDropoff != null ? morningDropoff.time() : null);
            ps.setBigDecimal(15, dto.morningDistanceKm());
            ps.setString(16, eveningPickup != null ? eveningPickup.location() : null);
            ps.setBigDecimal(17, eveningPickup != null ? eveningPickup.latitude() : null);
            ps.setBigDecimal(18, eveningPickup != null ? eveningPickup.longitude() : null);
            ps.setObject(19, eveningPickup != null ? eveningPickup.time() : null);
            ps.setString(20, eveningDropoff != null ? eveningDropoff.location() : null);
            ps.setBigDecimal(21, eveningDropoff != null ? eveningDropoff.latitude() : null);
            ps.setBigDecimal(22, eveningDropoff != null ? eveningDropoff.longitude() : null);
            ps.setObject(23, eveningDropoff != null ? eveningDropoff.time() : null);
            ps.setBigDecimal(24, dto.eveningDistanceKm());
            ps.setInt(25, dto.employeeCount());
            ps.setString(26, dto.workingDays());
            ps.setString(27, busType);
            ps.setBigDecimal(28, finalTotalDistanceKm);
            ps.setBigDecimal(29, billingAmount);
            ps.setObject(30, dto.startDate());
            ps.setObject(31, dto.endDate());
            ps.setLong(32, dto.corporateUserId());
            return ps;
        }, keyHolder);

        long newId = keyHolder.getKey().longValue();
        notifyContractSubmitted(dto, newId);

        return jdbcTemplate.queryForObject(
                "SELECT %s FROM corporate_contract WHERE contract_id = ?".formatted(CONTRACT_COLUMNS),
                (rs, rowNum) -> mapContract(rs), newId);
    }

    /**
     * A corporate user's profile must be fully filled in before they can request
     * a contract — mirrors the check already enforced on the mobile client, but
     * applied here too so the API can't be used to bypass it.
     */
    private void requireCompleteProfile(Long corporateUserId) {
        List<Map<String, Object>> rows = jdbcTemplate.queryForList(REQUIRED_PROFILE_FIELDS_SQL, corporateUserId);
        if (rows.isEmpty()) {
            throw new IllegalStateException("Complete your corporate profile before requesting a contract.");
        }
        Map<String, Object> profile = rows.get(0);
        boolean complete = List.of("business_registration_number", "industry", "address",
                        "contact_person_designation", "contact_phone")
                .stream()
                .allMatch(field -> profile.get(field) != null && !profile.get(field).toString().isBlank());
        if (!complete) {
            throw new IllegalStateException("Complete your corporate profile before requesting a contract.");
        }
    }

    private static boolean needsMorning(String shiftType) {
        return "morning".equalsIgnoreCase(shiftType) || "both".equalsIgnoreCase(shiftType);
    }

    private static boolean needsEvening(String shiftType) {
        return "evening".equalsIgnoreCase(shiftType) || "both".equalsIgnoreCase(shiftType);
    }

    private void validateShiftDetails(CorporateContractDto dto) {
        String shiftType = dto.shiftType();
        if (shiftType == null || !VALID_SHIFT_TYPES.contains(shiftType.toLowerCase())) {
            throw new IllegalArgumentException("Shift type must be 'morning', 'evening', or 'both'.");
        }
        if (dto.busType() != null && !VALID_BUS_TYPES.contains(dto.busType().toLowerCase())) {
            throw new IllegalArgumentException("Bus type must be 'standard', 'ac', or 'mini'.");
        }
        if (dto.employeeCount() == null || dto.employeeCount() <= 0) {
            throw new IllegalArgumentException("Employee count must be greater than zero.");
        }

        if (needsMorning(shiftType)) {
            requireLeg(dto.morningPickup(), "Morning pickup");
            requireLeg(dto.morningDropoff(), "Morning drop-off");
            requirePositiveDistance(dto.morningDistanceKm(), "Morning");
        }
        if (needsEvening(shiftType)) {
            requireLeg(dto.eveningPickup(), "Evening pickup");
            requireLeg(dto.eveningDropoff(), "Evening drop-off");
            requirePositiveDistance(dto.eveningDistanceKm(), "Evening");
        }
    }

    private static void requireLeg(ShiftLegDto leg, String label) {
        if (leg == null || leg.location() == null || leg.location().isBlank()
                || leg.latitude() == null || leg.longitude() == null || leg.time() == null) {
            throw new IllegalArgumentException(label + " location and time are required.");
        }
    }

    private static void requirePositiveDistance(BigDecimal distanceKm, String label) {
        if (distanceKm == null || distanceKm.signum() <= 0) {
            throw new IllegalArgumentException(label + " route distance could not be calculated.");
        }
    }

    /** Legacy starting_location column: the first pickup point of the day. */
    private static String resolveStartingLocation(CorporateContractDto dto) {
        if (dto.morningPickup() != null) return dto.morningPickup().location();
        if (dto.eveningPickup() != null) return dto.eveningPickup().location();
        return null;
    }

    /** Legacy destination column: the last drop-off point of the day. */
    private static String resolveDestination(CorporateContractDto dto) {
        if (dto.eveningDropoff() != null) return dto.eveningDropoff().location();
        if (dto.morningDropoff() != null) return dto.morningDropoff().location();
        return null;
    }

    /** The legacy start_shift_time column spans the earliest pickup of the day. */
    private static LocalTime resolveStartShift(CorporateContractDto dto) {
        if (dto.morningPickup() != null) return dto.morningPickup().time();
        if (dto.eveningPickup() != null) return dto.eveningPickup().time();
        return null;
    }

    /** The legacy end_shift_time column spans the latest drop-off of the day. */
    private static LocalTime resolveEndShift(CorporateContractDto dto) {
        if (dto.eveningDropoff() != null) return dto.eveningDropoff().time();
        if (dto.morningDropoff() != null) return dto.morningDropoff().time();
        return null;
    }

    /**
     * Drops a notification into the corporate user's feed when they submit a
     * contract request. A notification failure must never fail the contract
     * itself, so the error is logged and swallowed.
     */
    private void notifyContractSubmitted(CorporateContractDto dto, long contractId) {
        try {
            NotificationDto notification = new NotificationDto();
            notification.setNotificationType("booking");
            notification.setTitle("Contract Request Submitted");
            notification.setMessage(String.format(
                    "Your contract request \"%s\" (%s → %s) has been submitted and is awaiting admin approval.",
                    dto.contractName(), resolveStartingLocation(dto), resolveDestination(dto)));
            notification.setCorporateUserId(dto.corporateUserId());
            notification.setRead(false);
            notificationService.create(notification);
        } catch (Exception ex) {
            log.warn("Failed to create submission notification for contract {}", contractId, ex);
        }
    }
}
