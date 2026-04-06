package com.trackngo.booking.api.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class SeatDto {
    private Long id;
    @NotBlank
    private String name;
}
