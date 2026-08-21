package com.trackngo.app.service;

import com.trackngo.app.dto.AdminContractSummaryDto;
import com.trackngo.app.dto.ContractBusDto;
import com.trackngo.app.dto.CorporateContractDetailDto;
import com.trackngo.app.dto.CorporateContractDto;
import com.trackngo.app.dto.CorporateInvoiceDto;
import com.trackngo.app.dto.CorporateAdvancePaymentDto;
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
    private static final List<String> VALID_CONTRACT_STATUSES = List.of("pending", "active", "expired", "cancelled");

    /** Admin-driven status transitions. Expired/cancelled contracts are terminal. */
    private static final Map<String, List<String>> ALLOWED_STATUS_TRANSITIONS = Map.of(
            "pending", List.of("active", "cancelled"),
            "active", List.of("cancelled", "expired")
    );

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
                status, finalized_at, billing_amount,
                start_date, end_date, created_at, corporate_user_id, bus_id
            """;

    private static final String CONTRACTS_SQL = """
            SELECT %s
            FROM corporate_contract
            WHERE corporate_user_id = ?
            ORDER BY created_at DESC
            """.formatted(CONTRACT_COLUMNS);

    private static final String ADMIN_CONTRACTS_BASE_SQL = """
            SELECT
                c.contract_id, c.contract_name, c.shift_type, c.employee_count, c.bus_type,
                c.distance_km, c.status, c.billing_amount, c.start_date, c.end_date,
                c.created_at, c.corporate_user_id,
                cu.company_name, cu.contact_person_name, cu.contact_phone,
                (SELECT COUNT(*) FROM corporate_contract_bus ccb WHERE ccb.contract_id = c.contract_id) AS bus_count
            FROM corporate_contract c
            LEFT JOIN corporate_user cu ON cu.corporate_user_id = c.corporate_user_id
            """;

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
                c.status, c.finalized_at, c.billing_amount,
                c.start_date, c.end_date, c.created_at, c.corporate_user_id, c.bus_id,
                c.advance_amount, c.advance_payment_status, c.advance_paid_at,
                cu.company_name, cu.contact_person_name, cu.contact_phone
            FROM corporate_contract c
            LEFT JOIN corporate_user cu ON cu.corporate_user_id = c.corporate_user_id
            WHERE c.contract_id = ?
            """;

    private static final String ASSIGNED_BUSES_SQL = """
            SELECT b.bus_id, b.bus_number, b.bus_brand, b.registration_number, b.seat_capacity,
                   b.amenities, b.bus_condition, b.status AS bus_status,
                   r.route_name,
                   d.driver_id, d.phone_number AS driver_phone,
                   du.first_name AS driver_first_name, du.last_name AS driver_last_name
            FROM corporate_contract_bus ccb
            JOIN bus b ON b.bus_id = ccb.bus_id
            LEFT JOIN route r ON r.route_id = b.route_id
            LEFT JOIN driver d ON d.driver_id = b.driver_id
            LEFT JOIN `user` du ON du.user_id = d.driver_id
            WHERE ccb.contract_id = ?
            ORDER BY ccb.assigned_at
            """;

    private static final String AVAILABLE_BUSES_BASE_SQL = """
            SELECT b.bus_id, b.bus_number, b.bus_brand, b.registration_number, b.seat_capacity,
                   b.amenities, b.bus_condition, b.status AS bus_status,
                   r.route_name,
                   d.driver_id, d.phone_number AS driver_phone,
                   du.first_name AS driver_first_name, du.last_name AS driver_last_name
            FROM bus b
            LEFT JOIN route r ON r.route_id = b.route_id
            LEFT JOIN driver d ON d.driver_id = b.driver_id
            LEFT JOIN `user` du ON du.user_id = d.driver_id
            WHERE b.bus_type = 'corporate'
              AND b.status = 'active'
              AND NOT EXISTS (
                  SELECT 1 FROM corporate_contract_bus ccb
                  JOIN corporate_contract c ON c.contract_id = ccb.contract_id
                  WHERE ccb.bus_id = b.bus_id
                    AND c.status = 'active'
                    AND c.start_date <= ?
                    AND c.end_date >= ?
              )
            """;

    private static ContractBusDto mapBusRow(ResultSet rs) throws SQLException {
        return new ContractBusDto(
                rs.getLong("bus_id"),
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
    }

    public List<ContractBusDto> getAssignedBuses(Long contractId) {
        return jdbcTemplate.query(ASSIGNED_BUSES_SQL, (rs, rowNum) -> mapBusRow(rs), contractId);
    }

    /**
     * Every corporate-fleet bus that isn't already reserved by another
     * <em>active</em> (admin-approved) contract whose term overlaps the
     * requested date range. A pending request doesn't reserve anything —
     * it's just a proposal, so the same bus can still be offered to other
     * requests until one of them is actually approved. A bus is booked for
     * its contract's entire term (it runs the same shift every working day),
     * so availability is checked at the date-range level rather than per
     * calendar day.
     */
    public List<ContractBusDto> getAvailableBuses(
            java.time.LocalDate startDate, java.time.LocalDate endDate,
            Integer minSeats, String search, String amenity
    ) {
        if (startDate == null || endDate == null) {
            throw new IllegalArgumentException("Start and end date are required to check bus availability.");
        }
        StringBuilder sql = new StringBuilder(AVAILABLE_BUSES_BASE_SQL);
        List<Object> params = new java.util.ArrayList<>(List.of(endDate, startDate));
        if (minSeats != null && minSeats > 0) {
            sql.append(" AND b.seat_capacity >= ? ");
            params.add(minSeats);
        }
        if (search != null && !search.isBlank()) {
            sql.append(" AND (UPPER(b.bus_number) LIKE ? OR UPPER(b.bus_brand) LIKE ?) ");
            String like = "%" + search.trim().toUpperCase() + "%";
            params.add(like);
            params.add(like);
        }
        if (amenity != null && !amenity.isBlank()) {
            sql.append(" AND UPPER(b.amenities) LIKE ? ");
            params.add("%" + amenity.trim().toUpperCase() + "%");
        }
        sql.append(" ORDER BY b.seat_capacity DESC ");
        return jdbcTemplate.query(sql.toString(), (rs, rowNum) -> mapBusRow(rs), params.toArray());
    }

    /**
     * Since pending requests no longer reserve a bus, several pending
     * contracts can legitimately point at the same bus for overlapping
     * dates — only one of them should ever actually be approved. Called
     * right before a contract is approved, to catch the case where the bus
     * was, in the meantime, already committed to a different active
     * contract for an overlapping term.
     */
    private void requireNoBusConflicts(Long contractId) {
        List<Map<String, Object>> conflicts = jdbcTemplate.queryForList("""
                SELECT DISTINCT other.contract_id, other.contract_name
                FROM corporate_contract_bus mine
                JOIN corporate_contract_bus theirs ON theirs.bus_id = mine.bus_id AND theirs.contract_id <> mine.contract_id
                JOIN corporate_contract this_contract ON this_contract.contract_id = mine.contract_id
                JOIN corporate_contract other ON other.contract_id = theirs.contract_id
                WHERE mine.contract_id = ?
                  AND other.status = 'active'
                  AND other.start_date <= this_contract.end_date
                  AND other.end_date >= this_contract.start_date
                """, contractId);
        if (!conflicts.isEmpty()) {
            String names = conflicts.stream()
                    .map(row -> String.valueOf(row.get("contract_name")))
                    .distinct()
                    .reduce((a, b) -> a + ", " + b)
                    .orElse("");
            throw new IllegalStateException(
                    "Cannot approve: one or more assigned buses are already committed to another active contract for overlapping dates (" + names + "). Reassign a different bus first.");
        }
    }

    public List<CorporateContractDto> getContracts(Long userId) {
        return jdbcTemplate.query(CONTRACTS_SQL, (rs, rowNum) -> mapContract(rs), userId);
    }

    /**
     * Every corporate contract across every company, for the admin dashboard.
     * Optionally filtered by status (e.g. "pending" for the approval queue).
     */
    public List<AdminContractSummaryDto> getAllContracts(String statusFilter) {
        StringBuilder sql = new StringBuilder(ADMIN_CONTRACTS_BASE_SQL);
        List<Object> params = new java.util.ArrayList<>();
        if (statusFilter != null && !statusFilter.isBlank() && !"all".equalsIgnoreCase(statusFilter)) {
            sql.append(" WHERE c.status = ? ");
            params.add(statusFilter.toLowerCase());
        }
        sql.append(" ORDER BY c.created_at DESC ");
        return jdbcTemplate.query(sql.toString(), (rs, rowNum) -> new AdminContractSummaryDto(
                rs.getLong("contract_id"),
                rs.getString("contract_name"),
                rs.getString("company_name"),
                rs.getString("contact_person_name"),
                rs.getString("contact_phone"),
                rs.getString("shift_type"),
                rs.getInt("employee_count"),
                rs.getString("bus_type"),
                rs.getBigDecimal("distance_km"),
                rs.getString("status"),
                rs.getBigDecimal("billing_amount"),
                rs.getDate("start_date") != null ? rs.getDate("start_date").toLocalDate() : null,
                rs.getDate("end_date") != null ? rs.getDate("end_date").toLocalDate() : null,
                rs.getString("created_at"),
                rs.getLong("corporate_user_id"),
                rs.getInt("bus_count")
        ), params.toArray());
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
                rs.getString("finalized_at"),
                rs.getBigDecimal("billing_amount"),
                rs.getDate("start_date") != null ? rs.getDate("start_date").toLocalDate() : null,
                rs.getDate("end_date") != null ? rs.getDate("end_date").toLocalDate() : null,
                rs.getString("created_at"),
                rs.getLong("corporate_user_id"),
                rs.getLong("bus_id") == 0 ? null : rs.getLong("bus_id"),
                null // busIds are only populated where the caller explicitly fetches them (see getContractDetail / createContract)
        );
    }

    private static CorporateContractDto withBusIds(CorporateContractDto base, List<Long> busIds) {
        return new CorporateContractDto(
                base.contractId(), base.contractName(), base.startingLocation(), base.destination(),
                base.shiftType(), base.startShiftTime(), base.endShiftTime(),
                base.morningPickup(), base.morningDropoff(), base.morningDistanceKm(),
                base.eveningPickup(), base.eveningDropoff(), base.eveningDistanceKm(),
                base.employeeCount(), base.workingDays(), base.busType(), base.distanceKm(),
                base.status(), base.finalizedAt(), base.billingAmount(), base.startDate(), base.endDate(),
                base.createdAt(), base.corporateUserId(), base.busId(), busIds
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

        List<ContractBusDto> assignedBuses = getAssignedBuses(contractId);
        ContractBusDto primaryBus = assignedBuses.isEmpty() ? null : assignedBuses.get(0);

        CorporateContractDetailDto detail = jdbcTemplate.query(CONTRACT_DETAIL_SQL, rs -> {
            if (!rs.next()) {
                return null;
            }
            Long busId = rs.getObject("bus_id") != null ? rs.getLong("bus_id") : null;

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
                    rs.getString("finalized_at"),
                    rs.getBigDecimal("billing_amount"),
                    rs.getDate("start_date") != null ? rs.getDate("start_date").toLocalDate() : null,
                    rs.getDate("end_date") != null ? rs.getDate("end_date").toLocalDate() : null,
                    rs.getString("created_at"),
                    rs.getLong("corporate_user_id"),
                    busId,
                    rs.getString("company_name"),
                    rs.getString("contact_person_name"),
                    rs.getString("contact_phone"),
                    primaryBus,
                    assignedBuses,
                    invoices,
                    totalBilled,
                    totalPaid,
                    outstanding,
                    rs.getBigDecimal("advance_amount"),
                    rs.getString("advance_payment_status"),
                    rs.getString("advance_paid_at")
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

    @org.springframework.transaction.annotation.Transactional
    public CorporateContractDto createContract(CorporateContractDto dto) {
        requireCompleteProfile(dto.corporateUserId());
        validateShiftDetails(dto);
        validateContractDates(dto);
        List<ContractBusDto> assignedBuses = validateAndResolveBuses(dto);
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
        assignBuses(newId, assignedBuses);
        notifyContractSubmitted(dto, newId);

        CorporateContractDto created = jdbcTemplate.queryForObject(
                "SELECT %s FROM corporate_contract WHERE contract_id = ?".formatted(CONTRACT_COLUMNS),
                (rs, rowNum) -> mapContract(rs), newId);
        return withBusIds(created, assignedBuses.stream().map(ContractBusDto::busId).toList());
    }

    /**
     * Validates the requested bus selection: every bus must still be
     * available for the contract's date range (re-checked here in case the
     * client's list is stale), and the combined seat capacity must cover the
     * employee headcount — a company whose staff outnumber one bus's seats
     * must select additional buses rather than being blocked.
     */
    private List<ContractBusDto> validateAndResolveBuses(CorporateContractDto dto) {
        List<Long> requestedBusIds = dto.busIds();
        if (requestedBusIds == null || requestedBusIds.isEmpty()) {
            throw new IllegalArgumentException("Select at least one bus for this contract.");
        }
        List<ContractBusDto> available = getAvailableBuses(dto.startDate(), dto.endDate(), null, null, null);
        Map<Long, ContractBusDto> availableById = available.stream()
                .collect(java.util.stream.Collectors.toMap(ContractBusDto::busId, b -> b));

        List<ContractBusDto> resolved = new java.util.ArrayList<>();
        int totalSeats = 0;
        for (Long busId : requestedBusIds) {
            ContractBusDto bus = availableById.get(busId);
            if (bus == null) {
                throw new IllegalStateException("One or more selected buses are no longer available for these dates.");
            }
            resolved.add(bus);
            totalSeats += bus.seatCapacity() == null ? 0 : bus.seatCapacity();
        }
        if (dto.employeeCount() != null && totalSeats < dto.employeeCount()) {
            throw new IllegalArgumentException(
                    "Selected buses only seat " + totalSeats + " but " + dto.employeeCount()
                            + " employees need transport. Select more buses.");
        }
        return resolved;
    }

    private void assignBuses(long contractId, List<ContractBusDto> buses) {
        String sql = "INSERT INTO corporate_contract_bus (contract_id, bus_id) VALUES (?, ?)";
        for (ContractBusDto bus : buses) {
            jdbcTemplate.update(sql, contractId, bus.busId());
        }
        jdbcTemplate.update(
                "UPDATE corporate_contract SET bus_id = ? WHERE contract_id = ?",
                buses.get(0).busId(), contractId);
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

    /**
     * Contract term rules: the start date must give at least a week's notice,
     * the term must run at least one month, and it must not exceed one year —
     * beyond that the company has to come back and renew rather than book an
     * open-ended contract.
     */
    private void validateContractDates(CorporateContractDto dto) {
        if (dto.startDate() == null || dto.endDate() == null) {
            throw new IllegalArgumentException("Start and end date are required.");
        }
        java.time.LocalDate earliestStart = java.time.LocalDate.now().plusWeeks(1);
        if (dto.startDate().isBefore(earliestStart)) {
            throw new IllegalArgumentException("Contract start date must be at least one week from today.");
        }
        if (dto.endDate().isBefore(dto.startDate().plusMonths(1))) {
            throw new IllegalArgumentException("Contract term must be at least one month.");
        }
        if (dto.endDate().isAfter(dto.startDate().plusYears(1))) {
            throw new IllegalArgumentException("Contract term cannot exceed one year; renew after a year instead.");
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
            notification.setNotificationType("system_alert");
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

    /**
     * Admin approves, rejects, cancels or expires a contract. Only the
     * transitions in {@link #ALLOWED_STATUS_TRANSITIONS} are permitted —
     * expired and cancelled contracts are terminal and cannot be reopened.
     */
    public CorporateContractDto updateContractStatus(Long contractId, String newStatus) {
        if (newStatus == null || !VALID_CONTRACT_STATUSES.contains(newStatus.toLowerCase())) {
            throw new IllegalArgumentException("Status must be one of: pending, active, expired, cancelled.");
        }
        String normalized = newStatus.toLowerCase();

        List<Map<String, Object>> rows = jdbcTemplate.queryForList(
                "SELECT status, corporate_user_id, contract_name FROM corporate_contract WHERE contract_id = ?",
                contractId);
        if (rows.isEmpty()) {
            throw new IllegalArgumentException("Contract not found.");
        }
        Map<String, Object> row = rows.get(0);
        String currentStatus = (String) row.get("status");
        List<String> allowedNext = ALLOWED_STATUS_TRANSITIONS.getOrDefault(currentStatus, List.of());
        if (!allowedNext.contains(normalized)) {
            throw new IllegalStateException(
                    "Cannot change contract status from '" + currentStatus + "' to '" + normalized + "'.");
        }
        if ("active".equals(normalized)) {
            requireNoBusConflicts(contractId);
            jdbcTemplate.update("UPDATE corporate_contract SET status = ?, advance_amount = billing_amount, advance_payment_status = 'pending' WHERE contract_id = ?", normalized, contractId);
        } else {
            jdbcTemplate.update("UPDATE corporate_contract SET status = ? WHERE contract_id = ?", normalized, contractId);
        }

        Long corporateUserId = ((Number) row.get("corporate_user_id")).longValue();
        notifyStatusChange(contractId, corporateUserId, (String) row.get("contract_name"), normalized);

        return jdbcTemplate.queryForObject(
                "SELECT %s FROM corporate_contract WHERE contract_id = ?".formatted(CONTRACT_COLUMNS),
                (rs, rowNum) -> mapContract(rs), contractId);
    }

    public CorporateContractDto processAdvancePayment(Long contractId, CorporateAdvancePaymentDto paymentDto) {
        List<Map<String, Object>> rows = jdbcTemplate.queryForList(
                "SELECT advance_amount, advance_payment_status FROM corporate_contract WHERE contract_id = ?",
                contractId);
        if (rows.isEmpty()) {
            throw new IllegalArgumentException("Contract not found.");
        }
        Map<String, Object> row = rows.get(0);
        String advanceStatus = (String) row.get("advance_payment_status");
        if ("paid".equalsIgnoreCase(advanceStatus)) {
            throw new IllegalStateException("Advance deposit is already paid.");
        }
        if ("waived".equalsIgnoreCase(advanceStatus)) {
            throw new IllegalStateException("Advance deposit is already waived.");
        }
        BigDecimal advanceAmount = (BigDecimal) row.get("advance_amount");
        if (advanceAmount != null && paymentDto.amount().compareTo(advanceAmount) != 0) {
            throw new IllegalArgumentException("Payment amount does not match the required advance deposit.");
        }
        
        jdbcTemplate.update(
                "UPDATE corporate_contract SET advance_payment_status = 'paid', advance_paid_at = CURRENT_TIMESTAMP, advance_transaction_id = ? WHERE contract_id = ?",
                paymentDto.transactionId(), contractId);

        return jdbcTemplate.queryForObject(
                "SELECT %s FROM corporate_contract WHERE contract_id = ?".formatted(CONTRACT_COLUMNS),
                (rs, rowNum) -> mapContract(rs), contractId);
    }

    public CorporateContractDto waiveAdvancePayment(Long contractId) {
        List<Map<String, Object>> rows = jdbcTemplate.queryForList(
                "SELECT advance_payment_status FROM corporate_contract WHERE contract_id = ?",
                contractId);
        if (rows.isEmpty()) {
            throw new IllegalArgumentException("Contract not found.");
        }
        Map<String, Object> row = rows.get(0);
        String advanceStatus = (String) row.get("advance_payment_status");
        if ("paid".equalsIgnoreCase(advanceStatus)) {
            throw new IllegalStateException("Advance deposit is already paid.");
        }
        if ("waived".equalsIgnoreCase(advanceStatus)) {
            throw new IllegalStateException("Advance deposit is already waived.");
        }
        
        jdbcTemplate.update(
                "UPDATE corporate_contract SET advance_payment_status = 'waived', advance_paid_at = CURRENT_TIMESTAMP, advance_transaction_id = 'WAIVED' WHERE contract_id = ?",
                contractId);

        return jdbcTemplate.queryForObject(
                "SELECT %s FROM corporate_contract WHERE contract_id = ?".formatted(CONTRACT_COLUMNS),
                (rs, rowNum) -> mapContract(rs), contractId);
    }

    /**
     * The corporate user confirms the final offer after admin approval. This
     * is distinct from {@code status}: admin approval alone (status =
     * 'active') only means the request was accepted — the mobile app keeps
     * showing it under "Pending Contracts" as "Request Approved" until the
     * user finalizes it here, at which point it becomes a true running
     * contract in their Active Contracts list.
     */
    public CorporateContractDto finalizeContract(Long contractId, Long corporateUserId) {
        List<Map<String, Object>> rows = jdbcTemplate.queryForList(
                "SELECT status, finalized_at, corporate_user_id, advance_payment_status FROM corporate_contract WHERE contract_id = ?",
                contractId);
        if (rows.isEmpty()) {
            throw new IllegalArgumentException("Contract not found.");
        }
        Map<String, Object> row = rows.get(0);
        Long ownerId = ((Number) row.get("corporate_user_id")).longValue();
        if (corporateUserId != null && !corporateUserId.equals(ownerId)) {
            throw new IllegalStateException("You do not have access to this contract.");
        }
        String status = (String) row.get("status");
        if (!"active".equalsIgnoreCase(status)) {
            throw new IllegalStateException("This contract must be approved by admin before it can be finalized.");
        }
        String advanceStatus = (String) row.get("advance_payment_status");
        if (!"paid".equalsIgnoreCase(advanceStatus) && !"waived".equalsIgnoreCase(advanceStatus)) {
            throw new IllegalStateException("Advance deposit must be paid before finalizing the contract.");
        }
        if (row.get("finalized_at") != null) {
            throw new IllegalStateException("This contract has already been finalized.");
        }

        jdbcTemplate.update("UPDATE corporate_contract SET finalized_at = CURRENT_TIMESTAMP WHERE contract_id = ?", contractId);

        return jdbcTemplate.queryForObject(
                "SELECT %s FROM corporate_contract WHERE contract_id = ?".formatted(CONTRACT_COLUMNS),
                (rs, rowNum) -> mapContract(rs), contractId);
    }

    private void notifyStatusChange(Long contractId, Long corporateUserId, String contractName, String newStatus) {
        try {
            String message = switch (newStatus) {
                case "active" -> "Your contract request \"" + contractName + "\" has been approved and is now active.";
                case "cancelled" -> "Your contract \"" + contractName + "\" has been cancelled.";
                case "expired" -> "Your contract \"" + contractName + "\" has expired.";
                default -> "Your contract \"" + contractName + "\" status changed to " + newStatus + ".";
            };
            NotificationDto notification = new NotificationDto();
            notification.setNotificationType("system_alert");
            notification.setTitle("Contract Status Updated");
            notification.setMessage(message);
            notification.setCorporateUserId(corporateUserId);
            notification.setRead(false);
            notificationService.create(notification);
        } catch (Exception ex) {
            log.warn("Failed to create status-change notification for contract {}", contractId, ex);
        }
    }
}
