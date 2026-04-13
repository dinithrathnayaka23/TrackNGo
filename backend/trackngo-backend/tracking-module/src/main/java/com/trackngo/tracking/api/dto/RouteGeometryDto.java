package com.trackngo.tracking.api.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class RouteGeometryDto {
    private Long routeId;
    private String routeName;
    private String startLocation;
    private String endLocation;
    private List<RouteStopDto> stops;
}
