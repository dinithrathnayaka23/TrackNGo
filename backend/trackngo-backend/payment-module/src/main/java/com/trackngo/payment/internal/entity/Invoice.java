package com.trackngo.payment.internal.entity;

import jakarta.persistence.*;
import lombok.Data;

@Entity
@Data
@Table(name = "invoices")
public class Invoice {
    // Auto-generated primary key in the invoices table.
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    // Required invoice name.
    @Column(nullable = false)
    private String name;
}
