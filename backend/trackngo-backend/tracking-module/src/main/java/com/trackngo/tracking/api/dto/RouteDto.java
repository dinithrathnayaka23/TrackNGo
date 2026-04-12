
package com.trackngo.tracking.api.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.util.List;

@Data
public class RouteDto {
    private Long id;

    @NotBlank
    private String name;

    private String code;

    private String type;

    private String distance;

    private String duration;

    @Size(min = 2, message = "At least two stops are required")
    private List<String> stops;

    private Integer activeBuses;

    private String baseFare;

    private String status;
}

