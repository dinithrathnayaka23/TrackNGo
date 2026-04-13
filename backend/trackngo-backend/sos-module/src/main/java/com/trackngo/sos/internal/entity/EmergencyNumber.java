package com.trackngo.sos.internal.entity;

import jakarta.persistence.*;
import lombok.Data;

@Entity
@Data
@Table(name = "emergency_numbers")
public class EmergencyNumber {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "emergency_id")
    private Long emergencyId;

    @Column(nullable = false, length = 100)
    private String label;

    @Column(name = "fire_brigade", nullable = false, length = 20)
    private String fireBrigade;

    @Column(nullable = false, length = 20)
    private String ambulance;

    @Column(nullable = false, length = 20)
    private String police;

    @Column(name = "help_center", nullable = false, length = 20)
    private String helpCenter;

    @Column(name = "is_active")
    private Boolean isActive;
}
