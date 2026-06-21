package com.trackngo.payment.api.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class InvoiceDto {
    // Null for create requests, filled by backend in responses.
    private Long id;

    // Display name/title of the invoice.
    @NotBlank
    private String name;
}
