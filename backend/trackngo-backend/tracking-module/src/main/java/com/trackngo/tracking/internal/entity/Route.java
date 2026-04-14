
package com.trackngo.tracking.internal.entity;

import jakarta.persistence.*;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Data
@Table(name = "route")
public class Route {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "route_id")
    private Long id;

    @Column(name = "route_name", nullable = false)
    private String routeName;

    @Column(name = "route_code", unique = true)
    private String routeCode;

    @Column(name = "route_type")
    private String routeType;

    @Column(name = "start_location", nullable = false)
    private String startLocation;

    @Column(name = "end_location", nullable = false)
    private String endLocation;

    @Column(name = "est_distance_difference")
    private BigDecimal estDistanceDifference;

    @Column(name = "estimated_time_duration")
    private Integer estimatedTimeDuration;

    @Column(name = "fee")
    private BigDecimal fee;

    @Column(name = "active_buses")
    private Integer activeBuses;

    @Column(name = "is_active")
    private Boolean isActive = true;

    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @OneToMany(mappedBy = "route", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("id.priority ASC")
    private List<RouteStop> stops = new ArrayList<>();

    @PrePersist
    protected void onCreate() {
        if (createdAt == null) {
            createdAt = LocalDateTime.now();
        }
    }
}

