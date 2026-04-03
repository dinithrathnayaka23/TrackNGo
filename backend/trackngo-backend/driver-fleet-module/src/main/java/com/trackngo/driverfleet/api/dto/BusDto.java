package com.trackngo.driverfleet.api.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class BusDto {
    private Long id;
    @NotBlank
    private String name;
}
