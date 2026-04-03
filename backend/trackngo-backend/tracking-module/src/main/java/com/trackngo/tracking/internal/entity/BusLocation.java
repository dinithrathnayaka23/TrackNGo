
package com.trackngo.tracking.internal.entity;

import jakarta.persistence.*;
import lombok.Data;

@Entity
@Data
@Table(name = "bus_locations")
public class BusLocation {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String name;
}

