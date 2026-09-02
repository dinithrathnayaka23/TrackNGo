package com.trackngo.driver.internal.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate; // for date
import java.time.LocalTime;

@Entity //jpa annonations , 'this is a db table'
@Data
@NoArgsConstructor
@AllArgsConstructor
@Table(name = "bus")
public class DriverBus {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "bus_id")
    private Long busId;

    @Column(name = "bus_number", unique = true)
    private String busNumber;

    @Column(name = "bus_brand")
    private String busBrand;

    @Column(name = "start_time")
    private LocalTime startTime;

    @Column(name = "end_time")
    private LocalTime endTime;

    @Column(name = "return_start_time")
    private LocalTime returnStartTime;

    @Column(name = "return_end_time")
    private LocalTime returnEndTime;

    @Column(name = "registration_number", unique = true)
    private String registrationNumber;

    @Column(name = "amenities", columnDefinition = "JSON")
    private String amenities;

    @Column(name = "seat_capacity")
    private Integer seatCapacity;

    @Column(name = "bus_condition")
    private String busCondition;

    @Column(name = "bus_type")
    private String busType;

    @Column(name = "status")
    private String status;

    @Column(name = "insurance_exp_date")
    private LocalDate insuranceExpDate;

    @Column(name = "driver_id")
    private Long driverId;

    @Column(name = "route_id")
    private Long routeId;

    @Column(name = "created_at")
    private String createdAt;
}
