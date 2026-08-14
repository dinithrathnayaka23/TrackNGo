
package com.trackngo.tracking.internal.entity;

import jakarta.persistence.*;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Data
@Table(name = "bus_locations")
public class BusLocation {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String name;

    @Column(name = "bus_number")
    private String busNumber;

    @Column(precision = 10, scale = 8)
    private BigDecimal latitude;

    @Column(precision = 11, scale = 8)
    private BigDecimal longitude;

    @Column(precision = 6, scale = 2)
    private BigDecimal heading;

    @Column(precision = 6, scale = 2)
    private BigDecimal speed;

    @Column(name = "recorded_at")
    private LocalDateTime recordedAt;
}

