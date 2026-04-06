
package com.trackngo.tracking.api.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class BusLocationDto {
    private Long id;
    @NotBlank
    private String name;
}

