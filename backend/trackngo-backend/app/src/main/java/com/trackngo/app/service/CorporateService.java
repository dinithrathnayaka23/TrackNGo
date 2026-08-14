package com.trackngo.app.service;

import com.trackngo.app.dto.CorporateContractDto;
import com.trackngo.app.dto.CorporateInvoiceDto;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
public class CorporateService {

    private final JdbcTemplate jdbcTemplate;

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

    public void createContract(CorporateContractDto dto) {
        String insertSql = """
                INSERT INTO corporate_contract (
                    contract_name, starting_location, destination,
                    start_shift_time, end_shift_time, billing_amount,
                    start_date, end_date, corporate_user_id, status
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING')
                """;
        jdbcTemplate.update(insertSql,
                dto.contractName(),
                dto.startingLocation(),
                dto.destination(),
                dto.startShiftTime(),
                dto.endShiftTime(),
                dto.billingAmount(),
                dto.startDate(),
                dto.endDate(),
                dto.corporateUserId()
        );
    }
}
