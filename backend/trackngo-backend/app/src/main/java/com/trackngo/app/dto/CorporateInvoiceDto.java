package com.trackngo.app.dto;

import java.math.BigDecimal;
import java.time.LocalDate;

public record CorporateInvoiceDto(
        Long invoiceNumber,
        Long contractId,
        Long busId,
        String busNumber,
        BigDecimal amount,
        String status,
        LocalDate date,
        LocalDate periodEnd,
        LocalDate dueDate,
        String invoiceType,
        String stripeTransactionId,
        String paidAt,
        String createdAt
) {
}
