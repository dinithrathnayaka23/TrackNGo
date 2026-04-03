package com.trackngo.payment.api.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class PaymentDto {
    private Long id;
    @NotBlank
    private String name;
}
