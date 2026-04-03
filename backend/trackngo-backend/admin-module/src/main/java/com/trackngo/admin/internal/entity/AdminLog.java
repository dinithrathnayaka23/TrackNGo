package com.trackngo.admin.internal.entity;

import jakarta.persistence.*;
import lombok.Data;

@Entity
@Data
@Table(name = "adminlogs")
public class AdminLog {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String name;
}
