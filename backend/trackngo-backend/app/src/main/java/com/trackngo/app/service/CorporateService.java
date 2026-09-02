package com.trackngo.app.service;

import com.trackngo.app.dto.AdminContractSummaryDto;
import com.trackngo.app.dto.ContractBusDto;
import com.trackngo.app.dto.ContractCancellationDto;
import com.trackngo.app.dto.ContractStatusUpdateRequest;
import com.trackngo.app.dto.CorporateContractDetailDto;
import com.trackngo.app.dto.CorporateContractDto;
import com.trackngo.app.dto.CorporateInvoiceDto;
import com.trackngo.app.dto.CorporateAdvancePaymentDto;
import com.trackngo.app.dto.ShiftLegDto;
import com.trackngo.app.util.ProfileValidation;
import com.trackngo.notification.api.NotificationDispatcher;
import com.trackngo.notification.api.NotificationService;
import com.trackngo.notification.api.NotificationType;
import com.trackngo.notification.api.dto.NotificationDto;
import com.stripe.exception.StripeException;
import com.stripe.model.checkout.Session;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.jdbc.support.KeyHolder;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Map;

@Service
@Slf4j
@RequiredArgsConstructor
public class CorporateService {

    private final JdbcTemplate jdbcTemplate;
    private final NotificationService notificationService;
    private final NotificationDispatcher notifications;
    private final CorporatePricingService pricingService;
    private final CorporateInvoiceService corporateInvoiceService;

    private static final List<String> VALID_SHIFT_TYPES = List.of("morning", "evening", "both");
    private static final List<String> VALID_BUS_TYPES = List.of("standard", "mini");
    private static final List<String> VALID_CONTRACT_STATUSES = List.of("pending", "active", "expired", "cancelled");
    private static final List<String> VALID_CANCEL_ROLES = List.of("admin", "corporate");

    /** Mirrors MIN/MAX_CANCEL_REASON_LENGTH on the passenger app's contract-detail screen. */
    private static final int MIN_CANCEL_REASON_LENGTH = 10;
    private static final int MAX_CANCEL_REASON_LENGTH = 500;
    private static final int MIN_ADMIN_CANCEL_NOTICE_DAYS = 14;
    private static final int MIN_EMPLOYEE_COUNT = 20;

    /**
     * Furthest a contract's start date can be booked in advance. Mirrors
     * MAX_CONTRACT_START_LEAD_DAYS in the passenger app's new-contract screen.
     */
    private static final int MAX_CONTRACT_START_LEAD_DAYS = 90;

    /**
     * A pickup and a drop-off within this distance of each other are treated
     * as the same stop. Mirrors MIN_LOCATION_SEPARATION_KM on the passenger
     * app's new-contract screen.
     */
    private static final double MIN_LOCATION_SEPARATION_KM = 0.05;
    /** Contracts within this many days of their end date get a renewal reminder. */
    private static final int RENEWAL_REMINDER_WINDOW_DAYS = 30;

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
                employee_count, working_days, bus_type, is_ac, distance_km,
                status, finalized_at, billing_amount,
                start_date, end_date, created_at, corporate_user_id, bus_id,
                advance_amount, advance_payment_status, advance_paid_at,
                original_billing_amount, discount_amount, carried_balance, renewed_from_contract_id,
                cancel_status, cancel_requested_by, cancel_reason, cancel_requested_at,
                cancel_effective_date, cancel_response_reason, renewal_request_status
            """;

    private static final String CONTRACTS_SQL = """
            SELECT %s,
                (SELECT GROUP_CONCAT(bus_id ORDER BY assigned_at) FROM corporate_contract_bus WHERE contract_id = corporate_contract.contract_id) AS bus_ids_concat
            FROM corporate_contract
            WHERE corporate_user_id = ?
            ORDER BY created_at DESC
            """.formatted(CONTRACT_COLUMNS);

    private static final String ADMIN_CONTRACTS_BASE_SQL = """
            SELECT
                c.contract_id, c.contract_name, c.starting_location, c.destination,
                c.shift_type, c.employee_count, c.bus_type, c.is_ac,
                c.distance_km, c.status, c.billing_amount, c.start_date, c.end_date,
                c.created_at, c.corporate_user_id,
                c.advance_amount, c.advance_payment_status, c.advance_paid_at,
                c.original_billing_amount, c.discount_amount, c.carried_balance, c.renewed_from_contract_id,
                c.cancel_status, c.cancel_requested_by, c.cancel_reason, c.cancel_requested_at,
                c.cancel_effective_date, c.cancel_response_reason, c.renewal_request_status,
                cu.company_name, cu.contact_person_name, cu.contact_phone,
                (SELECT COUNT(*) FROM corporate_contract_bus ccb WHERE ccb.contract_id = c.contract_id) AS bus_count,
                (SELECT GROUP_CONCAT(b.bus_number ORDER BY ccb.assigned_at SEPARATOR ', ')
                 FROM corporate_contract_bus ccb JOIN bus b ON b.bus_id = ccb.bus_id
                 WHERE ccb.contract_id = c.contract_id) AS bus_numbers
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
                i.invoice_number, i.contract_id, i.bus_id, b.bus_number, i.amount, i.status,
                i.period_start, i.period_end, i.due_date, i.invoice_type, i.stripe_transaction_id, i.paid_at, i.created_at
            FROM corporate_invoices i
            JOIN corporate_contract c ON i.contract_id = c.contract_id
            LEFT JOIN bus b ON b.bus_id = i.bus_id
            WHERE c.corporate_user_id = ?
            ORDER BY i.period_start DESC
            """;

    private static final String CONTRACT_INVOICES_SQL = """
            SELECT
                i.invoice_number, i.contract_id, i.bus_id, b.bus_number, i.amount, i.status,
                i.period_start, i.period_end, i.due_date, i.invoice_type, i.stripe_transaction_id, i.paid_at, i.created_at
            FROM corporate_invoices i
            LEFT JOIN bus b ON b.bus_id = i.bus_id
            WHERE i.contract_id = ?
            ORDER BY i.period_start DESC
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
                c.employee_count, c.working_days, c.bus_type, c.is_ac, c.distance_km,
                c.status, c.finalized_at, c.billing_amount,
                c.start_date, c.end_date, c.created_at, c.corporate_user_id, c.bus_id,
                c.advance_amount, c.advance_payment_status, c.advance_paid_at, c.advance_transaction_id,
                c.original_billing_amount, c.discount_amount, c.carried_balance, c.renewed_from_contract_id, c.admin_note,
                c.cancel_status, c.cancel_requested_by, c.cancel_reason, c.cancel_requested_at,
                c.cancel_effective_date, c.cancel_response_reason, c.renewal_request_status,
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
                    AND (? IS NULL OR c.contract_id <> ?)
              )
            """;

    private static ContractCancellationDto mapCancellation(ResultSet rs) throws SQLException {
        java.sql.Date effectiveDate = rs.getDate("cancel_effective_date");
        return new ContractCancellationDto(
                rs.getString("cancel_status"),
                rs.getString("cancel_requested_by"),
                rs.getString("cancel_reason"),
                rs.getString("cancel_requested_at"),
                effectiveDate != null ? effectiveDate.toLocalDate() : null,
                rs.getString("cancel_response_reason")
        );
    }

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
     * <p>
     * {@code excludeContractId} is passed when checking availability for a
     * renewal: the predecessor contract stays {@code status = 'active'} (and
     * so keeps "reserving" its own buses) until its renewal is approved, so
     * without this exclusion a renewal that starts the day the old contract
     * ends would never see its own buses as available again.
     */
    public List<ContractBusDto> getAvailableBuses(
            java.time.LocalDate startDate, java.time.LocalDate endDate,
            Integer minSeats, String search, String amenity, Long excludeContractId
    ) {
        if (startDate == null || endDate == null) {
            throw new IllegalArgumentException("Start and end date are required to check bus availability.");
        }
        StringBuilder sql = new StringBuilder(AVAILABLE_BUSES_BASE_SQL);
        List<Object> params = new java.util.ArrayList<>();
        params.add(endDate);
        params.add(startDate);
        params.add(excludeContractId);
        params.add(excludeContractId);
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
        return jdbcTemplate.query(CONTRACTS_SQL,
                (rs, rowNum) -> withBusIds(mapContract(rs), parseBusIds(rs.getString("bus_ids_concat"))),
                userId);
    }

    private static List<Long> parseBusIds(String concat) {
        if (concat == null || concat.isBlank()) return null;
        return java.util.Arrays.stream(concat.split(",")).map(Long::parseLong).toList();
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
                rs.getString("starting_location"),
                rs.getString("destination"),
                rs.getString("shift_type"),
                rs.getInt("employee_count"),
                rs.getString("bus_type"),
                rs.getBoolean("is_ac"),
                rs.getBigDecimal("distance_km"),
                rs.getString("status"),
                rs.getBigDecimal("billing_amount"),
                rs.getDate("start_date") != null ? rs.getDate("start_date").toLocalDate() : null,
                rs.getDate("end_date") != null ? rs.getDate("end_date").toLocalDate() : null,
                rs.getString("created_at"),
                rs.getLong("corporate_user_id"),
                rs.getInt("bus_count"),
                rs.getString("bus_numbers"),
                rs.getBigDecimal("advance_amount"),
                rs.getString("advance_payment_status"),
                rs.getString("advance_paid_at"),
                rs.getBigDecimal("original_billing_amount"),
                rs.getBigDecimal("discount_amount"),
                rs.getBigDecimal("carried_balance"),
                rs.getObject("renewed_from_contract_id") != null ? rs.getLong("renewed_from_contract_id") : null,
                mapCancellation(rs),
                rs.getString("renewal_request_status")
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
                rs.getBoolean("is_ac"),
                rs.getBigDecimal("distance_km"),
                rs.getString("status"),
                rs.getString("finalized_at"),
                rs.getBigDecimal("billing_amount"),
                rs.getDate("start_date") != null ? rs.getDate("start_date").toLocalDate() : null,
                rs.getDate("end_date") != null ? rs.getDate("end_date").toLocalDate() : null,
                rs.getString("created_at"),
                rs.getLong("corporate_user_id"),
                rs.getLong("bus_id") == 0 ? null : rs.getLong("bus_id"),
                null, // busIds are only populated where the caller explicitly fetches them (see getContractDetail / createContract)
                rs.getBigDecimal("advance_amount"),
                rs.getString("advance_payment_status"),
                rs.getString("advance_paid_at"),
                rs.getBigDecimal("original_billing_amount"),
                rs.getBigDecimal("discount_amount"),
                rs.getBigDecimal("carried_balance"),
                mapCancellation(rs),
                rs.getObject("renewed_from_contract_id") != null ? rs.getLong("renewed_from_contract_id") : null,
                rs.getString("renewal_request_status")
        );
    }

    private static CorporateContractDto withBusIds(CorporateContractDto base, List<Long> busIds) {
        return new CorporateContractDto(
                base.contractId(), base.contractName(), base.startingLocation(), base.destination(),
                base.shiftType(), base.startShiftTime(), base.endShiftTime(),
                base.morningPickup(), base.morningDropoff(), base.morningDistanceKm(),
                base.eveningPickup(), base.eveningDropoff(), base.eveningDistanceKm(),
                base.employeeCount(), base.workingDays(), base.busType(), base.isAc(), base.distanceKm(),
                base.status(), base.finalizedAt(), base.billingAmount(), base.startDate(), base.endDate(),
                base.createdAt(), base.corporateUserId(), base.busId(), busIds,
                base.advanceAmount(), base.advancePaymentStatus(), base.advancePaidAt(),
                base.originalBillingAmount(), base.discountAmount(), base.carriedBalance(), base.cancellation(),
                base.renewedFromContractId(), base.renewalRequestStatus()
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

    private static CorporateInvoiceDto mapInvoiceRow(ResultSet rs) throws SQLException {
        return new CorporateInvoiceDto(
                rs.getLong("invoice_number"),
                rs.getLong("contract_id"),
                rs.getLong("bus_id"),
                rs.getString("bus_number"),
                rs.getBigDecimal("amount"),
                rs.getString("status"),
                rs.getDate("period_start") != null ? rs.getDate("period_start").toLocalDate() : null,
                rs.getDate("period_end") != null ? rs.getDate("period_end").toLocalDate() : null,
                rs.getDate("due_date") != null ? rs.getDate("due_date").toLocalDate() : null,
                rs.getString("invoice_type"),
                rs.getString("stripe_transaction_id"),
                rs.getString("paid_at"),
                rs.getString("created_at")
        );
    }

    public List<CorporateInvoiceDto> getInvoices(Long userId) {
        return jdbcTemplate.query(INVOICES_SQL, (rs, rowNum) -> mapInvoiceRow(rs), userId);
    }

    /** A single invoice's detail, for the pay screen. Returns null if not found. */
    public CorporateInvoiceDto getInvoice(Long invoiceNumber) {
        List<CorporateInvoiceDto> rows = jdbcTemplate.query("""
                SELECT i.invoice_number, i.contract_id, i.bus_id, b.bus_number, i.amount, i.status,
                       i.period_start, i.period_end, i.due_date, i.invoice_type, i.stripe_transaction_id, i.paid_at, i.created_at
                FROM corporate_invoices i
                LEFT JOIN bus b ON b.bus_id = i.bus_id
                WHERE i.invoice_number = ?
                """, (rs, rowNum) -> mapInvoiceRow(rs), invoiceNumber);
        return rows.isEmpty() ? null : rows.get(0);
    }

    /** Verifies and records payment of one monthly invoice via Stripe. */
    public void payInvoice(Long invoiceNumber, String stripeSessionId) {
        corporateInvoiceService.payInvoice(invoiceNumber, stripeSessionId);
    }

    /**
     * Returns the full detail of a single contract (bus, driver, company and invoices).
     * Returns null when the contract does not exist, or when userId is supplied and
     * does not own the contract.
     */
    public CorporateContractDetailDto getContractDetail(Long contractId, Long userId) {
        List<CorporateInvoiceDto> invoices =
                jdbcTemplate.query(CONTRACT_INVOICES_SQL, (rs, rowNum) -> mapInvoiceRow(rs), contractId);

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
                    rs.getBoolean("is_ac"),
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
                    rs.getString("advance_paid_at"),
                    rs.getString("advance_transaction_id"),
                    rs.getBigDecimal("original_billing_amount"),
                    rs.getBigDecimal("discount_amount"),
                    rs.getBigDecimal("carried_balance"),
                    rs.getObject("renewed_from_contract_id") != null ? rs.getLong("renewed_from_contract_id") : null,
                    rs.getString("admin_note"),
                    mapCancellation(rs),
                    rs.getString("renewal_request_status")
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
        boolean isAc = Boolean.TRUE.equals(dto.isAc());

        boolean needsMorning = needsMorning(dto.shiftType());
        boolean needsEvening = needsEvening(dto.shiftType());
        BigDecimal totalDistanceKm = BigDecimal.ZERO;
        if (needsMorning) totalDistanceKm = totalDistanceKm.add(dto.morningDistanceKm());
        if (needsEvening) totalDistanceKm = totalDistanceKm.add(dto.eveningDistanceKm());

        BigDecimal billingAmount = pricingService.calculateMonthlyAmount(dto, assignedBuses);

        BigDecimal carriedBalance = BigDecimal.ZERO;
        if (dto.renewedFromContractId() != null) {
            carriedBalance = calculateFairCarriedBalance(dto.renewedFromContractId(), dto.startDate());
        }

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
                    employee_count, working_days, bus_type, is_ac, distance_km,
                    billing_amount, start_date, end_date, corporate_user_id, status,
                    original_billing_amount, carried_balance, renewed_from_contract_id
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?)
                """;
        ShiftLegDto morningPickup = dto.morningPickup();
        ShiftLegDto morningDropoff = dto.morningDropoff();
        ShiftLegDto eveningPickup = dto.eveningPickup();
        ShiftLegDto eveningDropoff = dto.eveningDropoff();

        KeyHolder keyHolder = new GeneratedKeyHolder();
        BigDecimal finalTotalDistanceKm = totalDistanceKm;
        BigDecimal finalCarriedBalance = carriedBalance;
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
            ps.setBoolean(28, isAc);
            ps.setBigDecimal(29, finalTotalDistanceKm);
            ps.setBigDecimal(30, billingAmount);
            ps.setObject(31, dto.startDate());
            ps.setObject(32, dto.endDate());
            ps.setLong(33, dto.corporateUserId());
            ps.setBigDecimal(34, billingAmount);
            ps.setBigDecimal(35, finalCarriedBalance);
            ps.setObject(36, dto.renewedFromContractId());
            return ps;
        }, keyHolder);

        long newId = keyHolder.getKey().longValue();
        assignBuses(newId, assignedBuses);
        notifyContractSubmitted(dto, newId);

        if (dto.renewedFromContractId() != null) {
            // The renewal request this new contract fulfills is now consumed —
            // reset it so the old contract stops offering a "Proceed" action.
            jdbcTemplate.update(
                    "UPDATE corporate_contract SET renewal_request_status = 'none' WHERE contract_id = ?",
                    dto.renewedFromContractId());
        }

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
        List<ContractBusDto> available = getAvailableBuses(
                dto.startDate(), dto.endDate(), null, null, null, dto.renewedFromContractId());
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
        boolean complete =
                ProfileValidation.isRealText((String) profile.get("business_registration_number"), 3)
                        && ProfileValidation.isRealText((String) profile.get("industry"), 2)
                        && ProfileValidation.isRealText((String) profile.get("address"), 5)
                        && ProfileValidation.isRealText((String) profile.get("contact_person_designation"), 2)
                        && ProfileValidation.isValidPhone((String) profile.get("contact_phone"));
        if (!complete) {
            throw new IllegalStateException("Complete your corporate profile with real details before requesting a contract.");
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
        java.time.LocalDate latestStart = java.time.LocalDate.now().plusDays(MAX_CONTRACT_START_LEAD_DAYS);
        if (dto.startDate().isAfter(latestStart)) {
            throw new IllegalArgumentException(
                    "Contract start date cannot be more than " + MAX_CONTRACT_START_LEAD_DAYS + " days from today.");
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
        if (dto.employeeCount() == null || dto.employeeCount() < MIN_EMPLOYEE_COUNT) {
            throw new IllegalArgumentException("Employee count must be at least " + MIN_EMPLOYEE_COUNT + ".");
        }

        if (needsMorning(shiftType)) {
            requireLeg(dto.morningPickup(), "Morning pickup");
            requireLeg(dto.morningDropoff(), "Morning drop-off");
            requirePositiveDistance(dto.morningDistanceKm(), "Morning");
            requireDifferentLegs(dto.morningPickup(), dto.morningDropoff(), "Morning");
        }
        if (needsEvening(shiftType)) {
            requireLeg(dto.eveningPickup(), "Evening pickup");
            requireLeg(dto.eveningDropoff(), "Evening drop-off");
            requirePositiveDistance(dto.eveningDistanceKm(), "Evening");
            requireDifferentLegs(dto.eveningPickup(), dto.eveningDropoff(), "Evening");
        }
        // Both shifts running: the evening departure has to be after the
        // morning arrival — an employee can't leave for the day before (or
        // the instant) they arrive.
        if (needsMorning(shiftType) && needsEvening(shiftType)
                && dto.morningDropoff() != null && dto.eveningPickup() != null
                && dto.morningDropoff().time() != null && dto.eveningPickup().time() != null
                && !dto.eveningPickup().time().isAfter(dto.morningDropoff().time())) {
            throw new IllegalArgumentException(
                    "Evening departure time must be after the morning arrival time.");
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

    /** Rejects a pickup and drop-off that are effectively the same stop — not a real trip. */
    private static void requireDifferentLegs(ShiftLegDto pickup, ShiftLegDto dropoff, String label) {
        if (pickup == null || dropoff == null
                || pickup.latitude() == null || pickup.longitude() == null
                || dropoff.latitude() == null || dropoff.longitude() == null) {
            return;
        }
        double distanceKm = haversineKm(
                pickup.latitude().doubleValue(), pickup.longitude().doubleValue(),
                dropoff.latitude().doubleValue(), dropoff.longitude().doubleValue());
        if (distanceKm < MIN_LOCATION_SEPARATION_KM) {
            throw new IllegalArgumentException(label + " pickup and drop-off can't be the same place.");
        }
    }

    private static double haversineKm(double lat1, double lon1, double lat2, double lon2) {
        double earthRadiusKm = 6371;
        double dLat = Math.toRadians(lat2 - lat1);
        double dLon = Math.toRadians(lon2 - lon1);
        double a = Math.sin(dLat / 2) * Math.sin(dLat / 2)
                + Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2))
                * Math.sin(dLon / 2) * Math.sin(dLon / 2);
        return 2 * earthRadiusKm * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }

    /** Starting location: if both shifts, displays both pickup locations. */
    private static String resolveStartingLocation(CorporateContractDto dto) {
        if ("both".equalsIgnoreCase(dto.shiftType())) {
            String m = dto.morningPickup() != null ? dto.morningPickup().location() : "";
            String e = dto.eveningPickup() != null ? dto.eveningPickup().location() : "";
            if (!m.isBlank() && !e.isBlank()) {
                return m + " (M) & " + e + " (E)";
            }
        }
        if (dto.morningPickup() != null) return dto.morningPickup().location();
        if (dto.eveningPickup() != null) return dto.eveningPickup().location();
        return null;
    }

    /** Destination: if both shifts, displays both drop-off locations. */
    private static String resolveDestination(CorporateContractDto dto) {
        if ("both".equalsIgnoreCase(dto.shiftType())) {
            String m = dto.morningDropoff() != null ? dto.morningDropoff().location() : "";
            String e = dto.eveningDropoff() != null ? dto.eveningDropoff().location() : "";
            if (!m.isBlank() && !e.isBlank()) {
                return m + " (M) & " + e + " (E)";
            }
        }
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

        notifications.toAllAdmins(
                NotificationType.SYSTEM_ALERT,
                "New Contract Request",
                String.format(
                        "%s submitted contract request \"%s\" (%s → %s). It is waiting for approval.",
                        resolveCorporateCompanyName(dto.corporateUserId()),
                        dto.contractName(),
                        resolveStartingLocation(dto),
                        resolveDestination(dto)));
    }

    /** Names the company behind a contract request so admins know who is asking. */
    private String resolveCorporateCompanyName(Long corporateUserId) {
        if (corporateUserId == null) {
            return "A corporate account";
        }

        try {
            String companyName = jdbcTemplate.queryForObject(
                    "SELECT company_name FROM corporate_user WHERE corporate_user_id = ?",
                    String.class,
                    corporateUserId);
            return companyName == null || companyName.isBlank() ? "A corporate account" : companyName;
        } catch (Exception ex) {
            log.warn("Failed to resolve company name for corporate user {}", corporateUserId, ex);
            return "A corporate account";
        }
    }

    /**
     * Admin approves, rejects, cancels or expires a contract. Only the
     * transitions in {@link #ALLOWED_STATUS_TRANSITIONS} are permitted —
     * expired and cancelled contracts are terminal and cannot be reopened.
     * On approval ("active"), the admin may also apply a manual discount off
     * the auto-calculated {@code original_billing_amount}, mirroring the
     * discount already supported for trip bookings. A contract created as a
     * renewal ({@code renewed_from_contract_id} set) skips the advance
     * deposit on approval — it's a continuation of billing, not a fresh
     * contract, so the client shouldn't have to pay again. Approving a
     * renewal also deactivates the contract it renews (see
     * {@link #deactivateRenewedContract}); the whole method is transactional
     * so a failure partway through (e.g. a bus conflict) never leaves the
     * client with neither contract active.
     */
    @org.springframework.transaction.annotation.Transactional
    public CorporateContractDto updateContractStatus(Long contractId, ContractStatusUpdateRequest request) {
        String newStatus = request.status();
        if (newStatus == null || !VALID_CONTRACT_STATUSES.contains(newStatus.toLowerCase())) {
            throw new IllegalArgumentException("Status must be one of: pending, active, expired, cancelled.");
        }
        String normalized = newStatus.toLowerCase();

        List<Map<String, Object>> rows = jdbcTemplate.queryForList(
                "SELECT status, corporate_user_id, contract_name, original_billing_amount, cancel_status, renewed_from_contract_id FROM corporate_contract WHERE contract_id = ?",
                contractId);
        if (rows.isEmpty()) {
            throw new IllegalArgumentException("Contract not found.");
        }
        Map<String, Object> row = rows.get(0);
        String currentStatus = (String) row.get("status");
        if ("pending".equals(row.get("cancel_status"))) {
            throw new IllegalStateException(
                    "A cancellation request is already pending on this contract — resolve it before changing status.");
        }
        List<String> allowedNext = ALLOWED_STATUS_TRANSITIONS.getOrDefault(currentStatus, List.of());
        if (!allowedNext.contains(normalized)) {
            throw new IllegalStateException(
                    "Cannot change contract status from '" + currentStatus + "' to '" + normalized + "'.");
        }
        if ("active".equals(normalized)) {
            boolean isRenewal = row.get("renewed_from_contract_id") != null;
            if (isRenewal) {
                // Deactivate the prior contract before the bus-conflict check below,
                // so a renewal that starts while the old term is still technically
                // active (same bus, adjoining dates) isn't blocked by its own predecessor.
                Long renewedFromId = ((Number) row.get("renewed_from_contract_id")).longValue();
                deactivateRenewedContract(renewedFromId, (String) row.get("contract_name"));
            }
            requireNoBusConflicts(contractId);
            BigDecimal originalAmount = (BigDecimal) row.get("original_billing_amount");
            BigDecimal discount = request.discountAmount() == null ? BigDecimal.ZERO : request.discountAmount();
            if (discount.signum() < 0) {
                throw new IllegalArgumentException("Discount amount cannot be negative.");
            }
            if (originalAmount != null && discount.compareTo(originalAmount) > 0) {
                throw new IllegalArgumentException("Discount cannot exceed the original monthly amount.");
            }
            BigDecimal newBilling = (originalAmount == null ? BigDecimal.ZERO : originalAmount).subtract(discount);
            if (isRenewal) {
                jdbcTemplate.update("""
                        UPDATE corporate_contract
                        SET status = ?, billing_amount = ?, discount_amount = ?, admin_note = ?,
                            advance_amount = ?, advance_payment_status = 'waived', advance_paid_at = CURRENT_TIMESTAMP,
                            advance_transaction_id = 'RENEWAL'
                        WHERE contract_id = ?
                        """, normalized, newBilling, discount, request.adminNote(), newBilling, contractId);
            } else {
                jdbcTemplate.update("""
                        UPDATE corporate_contract
                        SET status = ?, billing_amount = ?, discount_amount = ?, admin_note = ?,
                            advance_amount = ?, advance_payment_status = 'pending'
                        WHERE contract_id = ?
                        """, normalized, newBilling, discount, request.adminNote(), newBilling, contractId);
            }
        } else {
            jdbcTemplate.update("UPDATE corporate_contract SET status = ? WHERE contract_id = ?", normalized, contractId);
        }

        Long corporateUserId = ((Number) row.get("corporate_user_id")).longValue();
        notifyStatusChange(contractId, corporateUserId, (String) row.get("contract_name"), normalized);

        return jdbcTemplate.queryForObject(
                "SELECT %s FROM corporate_contract WHERE contract_id = ?".formatted(CONTRACT_COLUMNS),
                (rs, rowNum) -> mapContract(rs), contractId);
    }

    /**
     * Marks the contract a just-approved renewal replaces as expired, so it
     * stops being treated as active (no longer blocks its buses for other
     * contracts, no longer billed, no longer shown as running). A no-op if
     * it's already left the active state some other way (e.g. the client
     * cancelled it in the meantime).
     */
    private void deactivateRenewedContract(Long oldContractId, String newContractName) {
        List<Map<String, Object>> oldRows = jdbcTemplate.queryForList(
                "SELECT status, corporate_user_id, contract_name FROM corporate_contract WHERE contract_id = ?",
                oldContractId);
        if (oldRows.isEmpty()) {
            return;
        }
        Map<String, Object> oldRow = oldRows.get(0);
        if (!"active".equals(oldRow.get("status"))) {
            return;
        }
        jdbcTemplate.update("UPDATE corporate_contract SET status = 'expired' WHERE contract_id = ?", oldContractId);
        Long corporateUserId = ((Number) oldRow.get("corporate_user_id")).longValue();
        String oldContractName = (String) oldRow.get("contract_name");
        notifyRenewedContractDeactivated(oldContractId, corporateUserId, oldContractName, newContractName);
    }

    private void notifyRenewedContractDeactivated(
            Long oldContractId, Long corporateUserId, String oldContractName, String newContractName) {
        try {
            NotificationDto notification = new NotificationDto();
            notification.setNotificationType("system_alert");
            notification.setTitle("Contract Renewed");
            notification.setMessage("Your contract \"" + oldContractName
                    + "\" has ended now that its renewal, \"" + newContractName + "\", is active.");
            notification.setCorporateUserId(corporateUserId);
            notification.setRead(false);
            notificationService.create(notification);
        } catch (Exception ex) {
            log.warn("Failed to create renewal-deactivated notification for contract {}", oldContractId, ex);
        }
    }

    /**
     * Either party requests to cancel a pending or active contract, with a
     * required reason. The other party must accept before anything changes
     * (see {@link #respondToCancellation}). An admin-initiated request on an
     * already-active contract lets the accepting corporate user choose, at
     * accept time, between cancelling immediately or keeping the contract
     * running for a minimum {@value #MIN_ADMIN_CANCEL_NOTICE_DAYS}-day notice
     * period (the scheduled {@link #expireDueCancellations()} job cancels it
     * once that date arrives). A corporate-initiated request, or an admin
     * request on a still-pending contract, always takes effect immediately
     * once accepted — no choice needed.
     */
    public CorporateContractDto requestCancellation(Long contractId, String role, String reason) {
        String normalizedRole = role == null ? "" : role.toLowerCase();
        if (!VALID_CANCEL_ROLES.contains(normalizedRole)) {
            throw new IllegalArgumentException("Role must be 'admin' or 'corporate'.");
        }
        if (reason == null || reason.isBlank()) {
            throw new IllegalArgumentException("A reason is required to request cancellation.");
        }
        if (reason.trim().length() < MIN_CANCEL_REASON_LENGTH) {
            throw new IllegalArgumentException(
                    "Please explain your reason for cancelling in at least " + MIN_CANCEL_REASON_LENGTH + " characters.");
        }
        if (reason.trim().length() > MAX_CANCEL_REASON_LENGTH) {
            throw new IllegalArgumentException(
                    "Cancellation reason must be " + MAX_CANCEL_REASON_LENGTH + " characters or fewer.");
        }

        List<Map<String, Object>> rows = jdbcTemplate.queryForList(
                "SELECT status, corporate_user_id, contract_name, cancel_status FROM corporate_contract WHERE contract_id = ?",
                contractId);
        if (rows.isEmpty()) {
            throw new IllegalArgumentException("Contract not found.");
        }
        Map<String, Object> row = rows.get(0);
        String status = (String) row.get("status");
        if (!"pending".equals(status) && !"active".equals(status)) {
            throw new IllegalStateException("Only a pending or active contract can be cancelled.");
        }
        if (!"none".equals(row.get("cancel_status")) && !"rejected".equals(row.get("cancel_status"))) {
            throw new IllegalStateException("A cancellation request is already in progress for this contract.");
        }

        // Enforce payment settlement: all payments up to current billing period must be settled
        Integer unpaidInvoices = jdbcTemplate.queryForObject("""
                SELECT COUNT(*) FROM corporate_invoices
                WHERE contract_id = ? AND status IN ('pending', 'overdue') AND period_start <= CURRENT_DATE
                """, Integer.class, contractId);
        if (unpaidInvoices != null && unpaidInvoices > 0) {
            throw new IllegalStateException("All monthly payments up to the current billing period must be settled before requesting cancellation. Please pay your outstanding invoices first.");
        }

        boolean offersNoticeChoice = "admin".equals(normalizedRole) && "active".equals(status);

        jdbcTemplate.update("""
                UPDATE corporate_contract
                SET cancel_status = 'pending', cancel_requested_by = ?, cancel_reason = ?,
                    cancel_requested_at = CURRENT_TIMESTAMP, cancel_effective_date = NULL, cancel_response_reason = NULL
                WHERE contract_id = ?
                """, normalizedRole, reason.trim(), contractId);

        Long corporateUserId = ((Number) row.get("corporate_user_id")).longValue();
        String contractName = (String) row.get("contract_name");
        notifyCancellationRequested(contractId, corporateUserId, contractName, normalizedRole, reason.trim(), offersNoticeChoice);

        return jdbcTemplate.queryForObject(
                "SELECT %s FROM corporate_contract WHERE contract_id = ?".formatted(CONTRACT_COLUMNS),
                (rs, rowNum) -> mapContract(rs), contractId);
    }

    /**
     * The party who did NOT request cancellation accepts or rejects it.
     * Accepting a corporate-initiated request, or an admin request on a
     * still-pending contract, cancels the contract immediately. Accepting an
     * admin request on an active contract requires {@code cancelTiming}
     * ("immediate" or "scheduled") so the accepting corporate user can choose
     * between cancelling right away or keeping the contract running until a
     * {@value #MIN_ADMIN_CANCEL_NOTICE_DAYS}-day notice period elapses.
     * Rejecting sets the cancellation state to 'rejected' with the reason
     * so the client can fulfill the requirement and request cancellation again.
     */
    public CorporateContractDto respondToCancellation(
            Long contractId, String role, boolean accept, String responseReason, String cancelTiming) {
        String normalizedRole = role == null ? "" : role.toLowerCase();
        if (!VALID_CANCEL_ROLES.contains(normalizedRole)) {
            throw new IllegalArgumentException("Role must be 'admin' or 'corporate'.");
        }

        List<Map<String, Object>> rows = jdbcTemplate.queryForList(
                "SELECT status, corporate_user_id, contract_name, cancel_status, cancel_requested_by FROM corporate_contract WHERE contract_id = ?",
                contractId);
        if (rows.isEmpty()) {
            throw new IllegalArgumentException("Contract not found.");
        }
        Map<String, Object> row = rows.get(0);
        if (!"pending".equals(row.get("cancel_status"))) {
            throw new IllegalStateException("There is no pending cancellation request on this contract.");
        }
        String requestedBy = (String) row.get("cancel_requested_by");
        if (normalizedRole.equals(requestedBy)) {
            throw new IllegalStateException("You cannot respond to your own cancellation request.");
        }
        String status = (String) row.get("status");

        Long corporateUserId = ((Number) row.get("corporate_user_id")).longValue();
        String contractName = (String) row.get("contract_name");

        if (!accept) {
            if (responseReason == null || responseReason.isBlank()) {
                throw new IllegalArgumentException("A reason is required when declining a cancellation request.");
            }
            jdbcTemplate.update("""
                    UPDATE corporate_contract
                    SET cancel_status = 'rejected', cancel_response_reason = ?,
                        cancel_requested_at = CURRENT_TIMESTAMP
                    WHERE contract_id = ?
                    """, responseReason.trim(), contractId);
            notifyCancellationDeclined(contractId, corporateUserId, contractName, requestedBy, responseReason.trim());
        } else {
            boolean offersNoticeChoice = "admin".equals(requestedBy) && "active".equals(status);
            boolean cancelNow = true;
            LocalDate effectiveDate = null;
            if (offersNoticeChoice) {
                String normalizedTiming = cancelTiming == null ? "" : cancelTiming.toLowerCase();
                if (!"immediate".equals(normalizedTiming) && !"scheduled".equals(normalizedTiming)) {
                    throw new IllegalArgumentException("cancelTiming must be 'immediate' or 'scheduled'.");
                }
                cancelNow = "immediate".equals(normalizedTiming);
                effectiveDate = cancelNow ? null : LocalDate.now().plusDays(MIN_ADMIN_CANCEL_NOTICE_DAYS);
            }

            if (cancelNow) {
                // Enforce payment settlement when completing cancellation
                Integer unpaidInvoices = jdbcTemplate.queryForObject("""
                        SELECT COUNT(*) FROM corporate_invoices
                        WHERE contract_id = ? AND status IN ('pending', 'overdue') AND period_start <= CURRENT_DATE
                        """, Integer.class, contractId);
                if (unpaidInvoices != null && unpaidInvoices > 0) {
                    throw new IllegalStateException("All monthly payments up to the current billing period must be settled before cancelling this contract. Please settle outstanding invoices first.");
                }
                jdbcTemplate.update("""
                        UPDATE corporate_contract
                        SET status = 'cancelled', cancel_status = 'accepted', cancel_response_reason = ?
                        WHERE contract_id = ?
                        """, responseReason, contractId);
                notifyStatusChange(contractId, corporateUserId, contractName, "cancelled");
            } else {
                jdbcTemplate.update("""
                        UPDATE corporate_contract
                        SET cancel_status = 'accepted', cancel_effective_date = ?, cancel_response_reason = ?
                        WHERE contract_id = ?
                        """, effectiveDate, responseReason, contractId);
                notifyCancellationAccepted(contractId, corporateUserId, contractName, effectiveDate);
            }
        }

        return jdbcTemplate.queryForObject(
                "SELECT %s FROM corporate_contract WHERE contract_id = ?".formatted(CONTRACT_COLUMNS),
                (rs, rowNum) -> mapContract(rs), contractId);
    }

    /**
     * Called by the scheduled {@code CorporateCancellationScheduler}: cancels
     * every active contract whose accepted admin-initiated cancellation
     * notice period has elapsed.
     */
    @org.springframework.transaction.annotation.Transactional
    public void expireDueCancellations() {
        List<Map<String, Object>> due = jdbcTemplate.queryForList("""
                SELECT contract_id, corporate_user_id, contract_name
                FROM corporate_contract
                WHERE cancel_status = 'accepted'
                  AND cancel_effective_date IS NOT NULL
                  AND cancel_effective_date <= CURRENT_DATE
                  AND status = 'active'
                """);
        for (Map<String, Object> row : due) {
            Long contractId = ((Number) row.get("contract_id")).longValue();
            Long corporateUserId = ((Number) row.get("corporate_user_id")).longValue();
            String contractName = (String) row.get("contract_name");
            jdbcTemplate.update("""
                    UPDATE corporate_contract
                    SET status = 'cancelled', cancel_status = 'none', cancel_requested_by = NULL,
                        cancel_reason = NULL, cancel_requested_at = NULL, cancel_effective_date = NULL
                    WHERE contract_id = ?
                    """, contractId);
            notifyStatusChange(contractId, corporateUserId, contractName, "cancelled");
        }
    }

    /**
     * Called daily by {@code CorporateRenewalReminderScheduler}: notifies both
     * the corporate client and every admin, once per contract, when an active
     * contract is within {@link #RENEWAL_REMINDER_WINDOW_DAYS} days of its end
     * date and hasn't already been reminded. The one-shot flag on the row
     * (rather than re-checking days-remaining on every run) keeps this from
     * re-notifying daily for the same contract.
     */
    public void sendRenewalReminders() {
        List<Map<String, Object>> due = jdbcTemplate.queryForList("""
                SELECT contract_id, corporate_user_id, contract_name, end_date
                FROM corporate_contract
                WHERE status = 'active'
                  AND renewal_reminder_sent_at IS NULL
                  AND end_date <= DATE_ADD(CURRENT_DATE, INTERVAL ? DAY)
                """, RENEWAL_REMINDER_WINDOW_DAYS);
        for (Map<String, Object> row : due) {
            Long contractId = ((Number) row.get("contract_id")).longValue();
            Long corporateUserId = ((Number) row.get("corporate_user_id")).longValue();
            String contractName = (String) row.get("contract_name");
            LocalDate endDate = ((java.sql.Date) row.get("end_date")).toLocalDate();
            notifyRenewalDue(contractId, corporateUserId, contractName, endDate);
            jdbcTemplate.update(
                    "UPDATE corporate_contract SET renewal_reminder_sent_at = CURRENT_TIMESTAMP WHERE contract_id = ?",
                    contractId);
        }
    }

    private void notifyRenewalDue(Long contractId, Long corporateUserId, String contractName, LocalDate endDate) {
        try {
            NotificationDto corporateNotification = new NotificationDto();
            corporateNotification.setNotificationType("system_alert");
            corporateNotification.setTitle("Contract Renewal Due Soon");
            corporateNotification.setMessage("Your contract \"" + contractName + "\" ends on " + endDate
                    + ". Renew it to keep the service running without interruption.");
            corporateNotification.setCorporateUserId(corporateUserId);
            corporateNotification.setRead(false);
            notificationService.create(corporateNotification);

            for (Long adminId : allAdminUserIds()) {
                NotificationDto adminNotification = new NotificationDto();
                adminNotification.setNotificationType("system_alert");
                adminNotification.setTitle("Contract Renewal Due Soon");
                adminNotification.setMessage("Contract \"" + contractName + "\" (#" + contractId + ") ends on " + endDate
                        + " and has not been renewed yet.");
                adminNotification.setAdminId(adminId);
                adminNotification.setRead(false);
                notificationService.create(adminNotification);
            }
        } catch (Exception ex) {
            log.warn("Failed to create renewal-due notification for contract {}", contractId, ex);
        }
    }

    /**
     * Renews a contract by submitting a new pending contract request that
     * continues immediately after the current term, cloning its route, shift
     * times, employee count, bus type and bus selection. Goes through the
     * same admin-approval flow as any new contract — renewing doesn't skip
     * review. Callable by either the corporate client or an admin, mirroring
     * the cancellation flow's role handling, so both sides follow the same
     * standardized process.
     */
    @org.springframework.transaction.annotation.Transactional
    public CorporateContractDto renewContract(Long contractId, Long requestedByUserId, String requestedByRole) {
        CorporateContractDto existing = jdbcTemplate.queryForObject(
                "SELECT %s FROM corporate_contract WHERE contract_id = ?".formatted(CONTRACT_COLUMNS),
                (rs, rowNum) -> mapContract(rs), contractId);
        if (existing == null) {
            throw new IllegalArgumentException("Contract not found.");
        }
        if (!"active".equalsIgnoreCase(existing.status())) {
            throw new IllegalStateException("Only an active contract can be renewed.");
        }
        if ("corporate".equals(requestedByRole) && requestedByUserId != null
                && !requestedByUserId.equals(existing.corporateUserId())) {
            throw new IllegalStateException("You do not have access to this contract.");
        }

        List<Long> busIds = jdbcTemplate.queryForList(
                "SELECT bus_id FROM corporate_contract_bus WHERE contract_id = ? ORDER BY assigned_at",
                Long.class, contractId);

        // The new term starts the day after the current one ends, unless that's
        // less than a week away — a contract can't be created starting sooner
        // than that, so a late renewal just starts as soon as it legally can.
        LocalDate earliestAllowedStart = LocalDate.now().plusWeeks(1);
        LocalDate newStart = existing.endDate().plusDays(1);
        if (newStart.isBefore(earliestAllowedStart)) {
            newStart = earliestAllowedStart;
        }
        long termDays = ChronoUnit.DAYS.between(existing.startDate(), existing.endDate());
        LocalDate newEnd = newStart.plusDays(Math.min(Math.max(termDays, 30), 365));

        BigDecimal carriedBalance = calculateFairCarriedBalance(contractId, newStart);

        CorporateContractDto renewalRequest = new CorporateContractDto(
                null, existing.contractName(), null, null,
                existing.shiftType(), null, null,
                existing.morningPickup(), existing.morningDropoff(), existing.morningDistanceKm(),
                existing.eveningPickup(), existing.eveningDropoff(), existing.eveningDistanceKm(),
                existing.employeeCount(), existing.workingDays(), existing.busType(), existing.isAc(), existing.distanceKm(),
                null, null, null, newStart, newEnd,
                null, existing.corporateUserId(), null, busIds,
                null, null, null, null, null, carriedBalance, null,
                existing.contractId(), null
        );

        CorporateContractDto created = createContract(renewalRequest);
        notifyRenewalSubmitted(existing, created);
        return created;
    }

    private void notifyRenewalSubmitted(CorporateContractDto existing, CorporateContractDto renewed) {
        try {
            for (Long adminId : allAdminUserIds()) {
                NotificationDto notification = new NotificationDto();
                notification.setNotificationType("system_alert");
                notification.setTitle("Contract Renewal Requested");
                notification.setMessage("A renewal request for contract \"" + existing.contractName() + "\" (#"
                        + existing.contractId() + ") was submitted as new contract #" + renewed.contractId()
                        + ", awaiting approval.");
                notification.setAdminId(adminId);
                notification.setRead(false);
                notificationService.create(notification);
            }
        } catch (Exception ex) {
            log.warn("Failed to create renewal-submitted admin notification for contract {}", existing.contractId(), ex);
        }
    }

    /**
     * The corporate client asks admin for permission to renew an active
     * contract. This is a lightweight yes/no ask — it doesn't create
     * anything yet. Once admin approves (see {@link #respondToRenewalRequest})
     * the client fills out and submits the actual renewal contract through
     * the normal {@link #createContract} flow, tagged with
     * {@code renewedFromContractId} so its approval skips the advance
     * deposit. Available any time a contract is active, not just near its
     * end date — the reminder in {@link #sendRenewalReminders()} is just a
     * nudge, not a gate.
     */
    @org.springframework.transaction.annotation.Transactional
    public CorporateContractDto requestRenewal(Long contractId, Long corporateUserId) {
        List<Map<String, Object>> rows = jdbcTemplate.queryForList(
                "SELECT status, corporate_user_id, contract_name, renewal_request_status FROM corporate_contract WHERE contract_id = ?",
                contractId);
        if (rows.isEmpty()) {
            throw new IllegalArgumentException("Contract not found.");
        }
        Map<String, Object> row = rows.get(0);
        if (!"active".equalsIgnoreCase((String) row.get("status"))) {
            throw new IllegalStateException("Only an active contract can be renewed.");
        }
        if (corporateUserId != null && !corporateUserId.equals(((Number) row.get("corporate_user_id")).longValue())) {
            throw new IllegalStateException("You do not have access to this contract.");
        }
        String currentRenewalStatus = (String) row.get("renewal_request_status");
        if ("requested".equals(currentRenewalStatus) || "approved".equals(currentRenewalStatus)) {
            throw new IllegalStateException("A renewal request is already in progress for this contract.");
        }

        jdbcTemplate.update(
                "UPDATE corporate_contract SET renewal_request_status = 'requested' WHERE contract_id = ?", contractId);

        String contractName = (String) row.get("contract_name");
        notifyRenewalRequested(contractId, contractName);

        return jdbcTemplate.queryForObject(
                "SELECT %s FROM corporate_contract WHERE contract_id = ?".formatted(CONTRACT_COLUMNS),
                (rs, rowNum) -> mapContract(rs), contractId);
    }

    /** Admin accepts or declines a corporate client's renewal request. */
    @org.springframework.transaction.annotation.Transactional
    public CorporateContractDto respondToRenewalRequest(Long contractId, boolean approve) {
        List<Map<String, Object>> rows = jdbcTemplate.queryForList(
                "SELECT corporate_user_id, contract_name, renewal_request_status FROM corporate_contract WHERE contract_id = ?",
                contractId);
        if (rows.isEmpty()) {
            throw new IllegalArgumentException("Contract not found.");
        }
        Map<String, Object> row = rows.get(0);
        if (!"requested".equals(row.get("renewal_request_status"))) {
            throw new IllegalStateException("There is no pending renewal request on this contract.");
        }

        String newStatus = approve ? "approved" : "declined";
        jdbcTemplate.update(
                "UPDATE corporate_contract SET renewal_request_status = ? WHERE contract_id = ?", newStatus, contractId);

        Long corporateUserId = ((Number) row.get("corporate_user_id")).longValue();
        String contractName = (String) row.get("contract_name");
        notifyRenewalResponse(contractId, corporateUserId, contractName, approve);

        return jdbcTemplate.queryForObject(
                "SELECT %s FROM corporate_contract WHERE contract_id = ?".formatted(CONTRACT_COLUMNS),
                (rs, rowNum) -> mapContract(rs), contractId);
    }

    private void notifyRenewalRequested(Long contractId, String contractName) {
        try {
            for (Long adminId : allAdminUserIds()) {
                NotificationDto notification = new NotificationDto();
                notification.setNotificationType("system_alert");
                notification.setTitle("Renewal Requested");
                notification.setMessage("A corporate client has requested to renew contract \"" + contractName
                        + "\" (#" + contractId + ").");
                notification.setAdminId(adminId);
                notification.setRead(false);
                notificationService.create(notification);
            }
        } catch (Exception ex) {
            log.warn("Failed to create renewal-requested admin notification for contract {}", contractId, ex);
        }
    }

    private void notifyRenewalResponse(Long contractId, Long corporateUserId, String contractName, boolean approve) {
        try {
            NotificationDto notification = new NotificationDto();
            notification.setNotificationType("system_alert");
            notification.setTitle(approve ? "Renewal Request Approved" : "Renewal Request Declined");
            notification.setMessage(approve
                    ? "Your request to renew contract \"" + contractName + "\" was approved. You can now submit your renewal."
                    : "You can't renew contract \"" + contractName + "\" right now — please contact admin for more information.");
            notification.setCorporateUserId(corporateUserId);
            notification.setRead(false);
            notificationService.create(notification);
        } catch (Exception ex) {
            log.warn("Failed to create renewal-response notification for contract {}", contractId, ex);
        }
    }

    private void notifyCancellationRequested(
            Long contractId, Long corporateUserId, String contractName,
            String requestedByRole, String reason, boolean offersNoticeChoice
    ) {
        try {
            String noticeText = offersNoticeChoice
                    ? (" If you accept, you can choose to cancel it immediately or keep it running for a "
                            + MIN_ADMIN_CANCEL_NOTICE_DAYS + "-day notice period.")
                    : "";
            if ("admin".equals(requestedByRole)) {
                NotificationDto notification = new NotificationDto();
                notification.setNotificationType("system_alert");
                notification.setTitle("Cancellation Requested");
                notification.setMessage("Admin has requested to cancel your contract \"" + contractName
                        + "\". Reason: " + reason + "." + noticeText);
                notification.setCorporateUserId(corporateUserId);
                notification.setRead(false);
                notificationService.create(notification);
            } else {
                for (Long adminId : allAdminUserIds()) {
                    NotificationDto notification = new NotificationDto();
                    notification.setNotificationType("system_alert");
                    notification.setTitle("Cancellation Requested");
                    notification.setMessage("A corporate client has requested to cancel contract \"" + contractName
                            + "\" (#" + contractId + "). Reason: " + reason + ".");
                    notification.setAdminId(adminId);
                    notification.setRead(false);
                    notificationService.create(notification);
                }
            }
        } catch (Exception ex) {
            log.warn("Failed to create cancellation-requested notification for contract {}", contractId, ex);
        }
    }

    private void notifyCancellationDeclined(
            Long contractId, Long corporateUserId, String contractName, String requestedByRole, String responseReason
    ) {
        try {
            String suffix = responseReason != null && !responseReason.isBlank() ? " Reason given: " + responseReason : "";
            if ("corporate".equals(requestedByRole)) {
                NotificationDto notification = new NotificationDto();
                notification.setNotificationType("system_alert");
                notification.setTitle("Cancellation Request Declined");
                notification.setMessage("Your request to cancel contract \"" + contractName + "\" was declined." + suffix);
                notification.setCorporateUserId(corporateUserId);
                notification.setRead(false);
                notificationService.create(notification);
            } else {
                for (Long adminId : allAdminUserIds()) {
                    NotificationDto notification = new NotificationDto();
                    notification.setNotificationType("system_alert");
                    notification.setTitle("Cancellation Request Declined");
                    notification.setMessage("The client declined admin's request to cancel contract \""
                            + contractName + "\" (#" + contractId + ")." + suffix);
                    notification.setAdminId(adminId);
                    notification.setRead(false);
                    notificationService.create(notification);
                }
            }
        } catch (Exception ex) {
            log.warn("Failed to create cancellation-declined notification for contract {}", contractId, ex);
        }
    }

    private void notifyCancellationAccepted(Long contractId, Long corporateUserId, String contractName, LocalDate effectiveDate) {
        try {
            NotificationDto notification = new NotificationDto();
            notification.setNotificationType("system_alert");
            notification.setTitle("Cancellation Accepted");
            notification.setMessage("You accepted admin's request to cancel contract \"" + contractName
                    + "\". It will end on " + effectiveDate + ".");
            notification.setCorporateUserId(corporateUserId);
            notification.setRead(false);
            notificationService.create(notification);
        } catch (Exception ex) {
            log.warn("Failed to create cancellation-accepted notification for contract {}", contractId, ex);
        }
    }

    /** No "assigned admin" concept exists today, so cancellation requests broadcast to every admin. */
    private List<Long> allAdminUserIds() {
        return jdbcTemplate.queryForList("SELECT user_id FROM `user` WHERE user_type = 'admin'", Long.class);
    }

    public CorporateContractDto processAdvancePayment(Long contractId, CorporateAdvancePaymentDto paymentDto) {
        if (paymentDto.sessionId() == null || paymentDto.sessionId().isBlank()) {
            throw new IllegalArgumentException("Stripe session is required.");
        }
        List<Map<String, Object>> rows = jdbcTemplate.queryForList(
                "SELECT advance_amount, advance_payment_status FROM corporate_contract WHERE contract_id = ?",
                contractId);
        if (rows.isEmpty()) {
            throw new IllegalArgumentException("Contract not found.");
        }
        Map<String, Object> row = rows.get(0);
        String advanceStatus = (String) row.get("advance_payment_status");
        // Idempotent on retry: a client re-confirming a session whose payment
        // already landed (e.g. the app closed mid-flow before finalizing)
        // should see success, not an error — mirrors TripBookingService's
        // confirmPayment, which never fails a duplicate confirmation.
        if ("paid".equalsIgnoreCase(advanceStatus)) {
            return jdbcTemplate.queryForObject(
                    "SELECT %s FROM corporate_contract WHERE contract_id = ?".formatted(CONTRACT_COLUMNS),
                    (rs, rowNum) -> mapContract(rs), contractId);
        }
        if ("waived".equalsIgnoreCase(advanceStatus)) {
            throw new IllegalStateException("Advance deposit is already waived.");
        }
        BigDecimal advanceAmount = (BigDecimal) row.get("advance_amount");
        if (advanceAmount == null || advanceAmount.compareTo(BigDecimal.ZERO) <= 0) {
            throw new IllegalStateException("The advance deposit amount is not available for this contract.");
        }

        try {
            Session session = Session.retrieve(paymentDto.sessionId());
            String orderId = session.getMetadata() == null ? "" : session.getMetadata().getOrDefault("order_id", "");
            long expectedCents = advanceAmount.setScale(2, RoundingMode.HALF_UP)
                    .movePointRight(2).longValueExact();
            if (!("CORP-ADV-" + contractId).equals(orderId)
                    || !"paid".equalsIgnoreCase(session.getPaymentStatus())
                    || session.getAmountTotal() == null
                    || session.getAmountTotal() != expectedCents) {
                throw new IllegalStateException("Stripe payment could not be verified for this contract.");
            }

            jdbcTemplate.update(
                    "UPDATE corporate_contract SET advance_payment_status = 'paid', advance_paid_at = CURRENT_TIMESTAMP, advance_transaction_id = ? WHERE contract_id = ?",
                    session.getPaymentIntent(), contractId);
        } catch (StripeException e) {
            throw new IllegalStateException("Stripe payment verification failed.", e);
        }

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
        corporateInvoiceService.generateInvoicesForContract(contractId);

        return jdbcTemplate.queryForObject(
                "SELECT %s FROM corporate_contract WHERE contract_id = ?".formatted(CONTRACT_COLUMNS),
                (rs, rowNum) -> mapContract(rs), contractId);
    }

    /**
     * Lets the corporate user immediately reject a contract that hasn't been
     * finalized yet — including one admin has already approved (status =
     * 'active', still showing as "Request Approved" until finalized). Unlike
     * {@link #requestCancellation}, this needs no admin counter-approval: no
     * invoices exist yet (those are only generated in {@link #finalizeContract}),
     * and the deposit can't have been charged through the normal flow either,
     * since paying it finalizes the contract in the same step — so there is
     * nothing on the admin's side that a self-service reject could undo
     * incorrectly. If a deposit was somehow marked paid without finalizing,
     * this is refused so that money is never lost silently; the corporate
     * user is directed to request cancellation instead, which an admin can
     * see through to a refund.
     */
    public void rejectUnfinalizedContract(Long contractId, Long corporateUserId) {
        List<Map<String, Object>> rows = jdbcTemplate.queryForList(
                "SELECT status, finalized_at, corporate_user_id, advance_payment_status, contract_name " +
                "FROM corporate_contract WHERE contract_id = ?",
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
        if (!"pending".equalsIgnoreCase(status) && !"active".equalsIgnoreCase(status)) {
            throw new IllegalStateException("This contract is not awaiting review.");
        }
        if (row.get("finalized_at") != null) {
            throw new IllegalStateException(
                    "This contract has already been finalized. Use Cancel Contract instead.");
        }
        String advanceStatus = (String) row.get("advance_payment_status");
        if ("paid".equalsIgnoreCase(advanceStatus)) {
            throw new IllegalStateException(
                    "An advance deposit has already been paid on this contract. " +
                    "Please request cancellation instead so the deposit can be refunded.");
        }

        int updated = jdbcTemplate.update("""
                UPDATE corporate_contract SET status = 'cancelled'
                WHERE contract_id = ? AND finalized_at IS NULL AND status IN ('pending', 'active')
                """, contractId);
        if (updated == 0) {
            throw new IllegalStateException("This contract could not be rejected — it may have just been updated.");
        }

        String contractName = (String) row.get("contract_name");
        notifications.toAllAdmins(
                NotificationType.SYSTEM_ALERT,
                "Contract Rejected by Client",
                String.format(
                        "%s rejected contract request \"%s\" before finalizing it.",
                        resolveCorporateCompanyName(ownerId), contractName));
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

    /**
     * Calculates the fair prorated carried balance from a predecessor contract.
     * Deducts any unused days from ongoing/future invoices so the client only pays
     * for days of service actually consumed under the predecessor contract.
     */
    public BigDecimal calculateFairCarriedBalance(Long predecessorContractId, LocalDate cutoffDate) {
        if (predecessorContractId == null) {
            return BigDecimal.ZERO;
        }
        LocalDate effectiveCutoff = LocalDate.now();
        if (cutoffDate != null && cutoffDate.isBefore(effectiveCutoff)) {
            effectiveCutoff = cutoffDate;
        }

        List<Map<String, Object>> invoices = jdbcTemplate.queryForList("""
                SELECT amount, status, period_start, period_end
                FROM corporate_invoices
                WHERE contract_id = ? AND status != 'cancelled'
                """, predecessorContractId);

        BigDecimal totalDebt = BigDecimal.ZERO;
        BigDecimal totalCredit = BigDecimal.ZERO;

        for (Map<String, Object> inv : invoices) {
            BigDecimal amount = (BigDecimal) inv.get("amount");
            String status = (String) inv.get("status");
            java.sql.Date startSql = (java.sql.Date) inv.get("period_start");
            java.sql.Date endSql = (java.sql.Date) inv.get("period_end");

            if (amount == null || amount.compareTo(BigDecimal.ZERO) <= 0) {
                continue;
            }

            LocalDate periodStart = startSql != null ? startSql.toLocalDate() : null;
            LocalDate periodEnd = endSql != null ? endSql.toLocalDate() : null;

            if (periodStart == null || periodEnd == null || !periodEnd.isAfter(periodStart)) {
                // Non-period or carried-balance invoice: full debt if unpaid
                if ("pending".equalsIgnoreCase(status) || "overdue".equalsIgnoreCase(status)) {
                    totalDebt = totalDebt.add(amount);
                }
                continue;
            }

            long totalDays = ChronoUnit.DAYS.between(periodStart, periodEnd);
            if (totalDays <= 0) {
                continue;
            }

            if (!effectiveCutoff.isAfter(periodStart)) {
                // Period hasn't started yet relative to cutoff: 0 used days
                if ("paid".equalsIgnoreCase(status)) {
                    totalCredit = totalCredit.add(amount);
                }
            } else if (!effectiveCutoff.isBefore(periodEnd)) {
                // Period completely elapsed: 100% used
                if ("pending".equalsIgnoreCase(status) || "overdue".equalsIgnoreCase(status)) {
                    totalDebt = totalDebt.add(amount);
                }
            } else {
                // Cutoff falls in the middle of the billing period: prorate fairly based on days worked
                long usedDays = ChronoUnit.DAYS.between(periodStart, effectiveCutoff);
                BigDecimal usedRatio = BigDecimal.valueOf(usedDays)
                        .divide(BigDecimal.valueOf(totalDays), 6, RoundingMode.HALF_UP);
                BigDecimal usedAmount = amount.multiply(usedRatio).setScale(2, RoundingMode.HALF_UP);
                BigDecimal unusedAmount = amount.subtract(usedAmount);

                if ("pending".equalsIgnoreCase(status) || "overdue".equalsIgnoreCase(status)) {
                    totalDebt = totalDebt.add(usedAmount);
                } else if ("paid".equalsIgnoreCase(status)) {
                    totalCredit = totalCredit.add(unusedAmount);
                }
            }
        }

        BigDecimal netCarried = totalDebt.subtract(totalCredit);
        return netCarried.compareTo(BigDecimal.ZERO) > 0 ? netCarried.setScale(2, RoundingMode.HALF_UP) : BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);
    }
}
