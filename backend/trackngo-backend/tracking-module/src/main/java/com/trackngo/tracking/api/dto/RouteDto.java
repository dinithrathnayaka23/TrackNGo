
package com.trackngo.tracking.api.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class RouteDto {
    private Long id;
    @NotBlank
    private String name;
}

