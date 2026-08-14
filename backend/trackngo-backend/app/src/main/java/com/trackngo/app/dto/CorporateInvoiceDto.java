package com.trackngo.app.dto;

import java.math.BigDecimal;
import java.time.LocalDate;

public record CorporateInvoiceDto(
        Long invoiceNumber,
        Long contractId,
        BigDecimal amount,
        String status,
        LocalDate date,
        LocalDate dueDate,
        String createdAt
) {
}
