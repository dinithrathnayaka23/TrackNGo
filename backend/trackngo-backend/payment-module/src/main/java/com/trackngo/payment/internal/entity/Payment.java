package com.trackngo.payment.internal.entity;

import jakarta.persistence.*;
import lombok.Data;

@Entity
@Data
@Table(name = "payments")
public class Payment {
    // Auto-generated primary key in the payments table.
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    // Required payment name/label.
    @Column(nullable = false)
    private String name;
}
