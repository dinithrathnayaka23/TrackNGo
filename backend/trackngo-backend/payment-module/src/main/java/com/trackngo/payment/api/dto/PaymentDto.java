package com.trackngo.payment.api.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class PaymentDto {
    // Null for create requests, filled by backend in responses.
    private Long id;

    // Human-readable payment label/name.
    @NotBlank
    private String name;
}
