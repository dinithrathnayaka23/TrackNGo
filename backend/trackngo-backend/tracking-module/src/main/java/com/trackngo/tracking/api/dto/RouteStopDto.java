package com.trackngo.tracking.api.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class RouteStopDto {
    private String name;
    private Double latitude;
    private Double longitude;
    private Integer priority;
    private Double distanceFromStart;
    private Integer estimatedArrivalMins;
}
