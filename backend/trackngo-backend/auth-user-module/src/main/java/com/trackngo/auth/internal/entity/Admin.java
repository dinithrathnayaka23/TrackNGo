package com.trackngo.auth.internal.entity;

import jakarta.persistence.*;
import lombok.Data;

@Entity
@Data
@Table(name = "admin")
public class Admin {
    @Id
    @Column(name = "admin_id")
    private Long adminId;

    @Column(name = "phone_number", nullable = false, unique = true)
    private String phoneNumber;

    @Column(name = "employee_id", unique = true)
    private String employeeId;

    @Column(name = "role")
    private String role;

    @Column(name = "status")
    private String status;
}
