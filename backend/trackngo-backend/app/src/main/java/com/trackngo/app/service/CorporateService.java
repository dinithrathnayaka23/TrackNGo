package com.trackngo.app.service;

import com.trackngo.app.dto.ContractBusDto;
import com.trackngo.app.dto.CorporateContractDetailDto;
import com.trackngo.app.dto.CorporateContractDto;
import com.trackngo.app.dto.CorporateInvoiceDto;
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
import java.sql.Statement;
import java.util.List;

@Service
@Slf4j
@RequiredArgsConstructor
public class CorporateService {

    private final JdbcTemplate jdbcTemplate;
    private final NotificationService notificationService;

    private static final String CONTRACTS_SQL = """
            SELECT
                contract_id, contract_name, starting_location, destination,
                start_shift_time, end_shift_time, status, billing_amount,
                start_date, end_date, created_at, corporate_user_id, bus_id
            FROM corporate_contract
            WHERE corporate_user_id = ?
            ORDER BY created_at DESC
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
                c.start_shift_time, c.end_shift_time, c.status, c.billing_amount,
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
        return jdbcTemplate.query(CONTRACTS_SQL, (rs, rowNum) -> new CorporateContractDto(
                rs.getLong("contract_id"),
                rs.getString("contract_name"),
                rs.getString("starting_location"),
                rs.getString("destination"),
                rs.getTime("start_shift_time") != null ? rs.getTime("start_shift_time").toLocalTime() : null,
                rs.getTime("end_shift_time") != null ? rs.getTime("end_shift_time").toLocalTime() : null,
                rs.getString("status"),
                rs.getBigDecimal("billing_amount"),
                rs.getDate("start_date") != null ? rs.getDate("start_date").toLocalDate() : null,
                rs.getDate("end_date") != null ? rs.getDate("end_date").toLocalDate() : null,
                rs.getString("created_at"),
                rs.getLong("corporate_user_id"),
                rs.getLong("bus_id") == 0 ? null : rs.getLong("bus_id")
        ), userId);
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
                    rs.getTime("start_shift_time") != null ? rs.getTime("start_shift_time").toLocalTime() : null,
                    rs.getTime("end_shift_time") != null ? rs.getTime("end_shift_time").toLocalTime() : null,
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
        String insertSql = """
                INSERT INTO corporate_contract (
                    contract_name, starting_location, destination,
                    start_shift_time, end_shift_time, billing_amount,
                    start_date, end_date, corporate_user_id, status
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')
                """;
        KeyHolder keyHolder = new GeneratedKeyHolder();
        jdbcTemplate.update(con -> {
            PreparedStatement ps = con.prepareStatement(insertSql, Statement.RETURN_GENERATED_KEYS);
            ps.setString(1, dto.contractName());
            ps.setString(2, dto.startingLocation());
            ps.setString(3, dto.destination());
            ps.setObject(4, dto.startShiftTime());
            ps.setObject(5, dto.endShiftTime());
            ps.setBigDecimal(6, dto.billingAmount());
            ps.setObject(7, dto.startDate());
            ps.setObject(8, dto.endDate());
            ps.setLong(9, dto.corporateUserId());
            return ps;
        }, keyHolder);

        long newId = keyHolder.getKey().longValue();
        notifyContractSubmitted(dto, newId);

        // Fetch and return the newly created contract
        String fetchSql = """
                SELECT contract_id, contract_name, starting_location, destination,
                       start_shift_time, end_shift_time, status, billing_amount,
                       start_date, end_date, created_at, corporate_user_id, bus_id
                FROM corporate_contract WHERE contract_id = ?
                """;
        return jdbcTemplate.queryForObject(fetchSql, (rs, rowNum) -> new CorporateContractDto(
                rs.getLong("contract_id"),
                rs.getString("contract_name"),
                rs.getString("starting_location"),
                rs.getString("destination"),
                rs.getTime("start_shift_time") != null ? rs.getTime("start_shift_time").toLocalTime() : null,
                rs.getTime("end_shift_time") != null ? rs.getTime("end_shift_time").toLocalTime() : null,
                rs.getString("status"),
                rs.getBigDecimal("billing_amount"),
                rs.getDate("start_date") != null ? rs.getDate("start_date").toLocalDate() : null,
                rs.getDate("end_date") != null ? rs.getDate("end_date").toLocalDate() : null,
                rs.getString("created_at"),
                rs.getLong("corporate_user_id"),
                rs.getLong("bus_id") == 0 ? null : rs.getLong("bus_id")
        ), newId);
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
                    dto.contractName(), dto.startingLocation(), dto.destination()));
            notification.setCorporateUserId(dto.corporateUserId());
            notification.setRead(false);
            notificationService.create(notification);
        } catch (Exception ex) {
            log.warn("Failed to create submission notification for contract {}", contractId, ex);
        }
    }
}
