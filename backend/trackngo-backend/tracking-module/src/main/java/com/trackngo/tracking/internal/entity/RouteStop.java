package com.trackngo.tracking.internal.entity;

import jakarta.persistence.*;
import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.ToString;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

@Entity
@Data
@NoArgsConstructor
@Table(name = "route_stop")
public class RouteStop {
    @EmbeddedId
    private RouteStopId id;

    @MapsId("routeId")
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "route_id")
    @EqualsAndHashCode.Exclude
    @ToString.Exclude
    private Route route;

    @Column(name = "name", nullable = false)
    private String name;

    @Column(name = "latitude")
    private BigDecimal latitude;

    @Column(name = "longitude")
    private BigDecimal longitude;

    @Column(name = "distance_from_start")
    private BigDecimal distanceFromStart;

    @Column(name = "estimated_arrival_mins")
    private Integer estimatedArrivalMins;
}
