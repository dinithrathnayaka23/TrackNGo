package com.trackngo.tracking.internal.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;

import java.io.Serializable;

@Embeddable
@Data
@NoArgsConstructor
@AllArgsConstructor
public class RouteStopId implements Serializable {
    @Column(name = "route_id")
    private Long routeId;

    @Column(name = "priority")
    private Integer priority;
}
