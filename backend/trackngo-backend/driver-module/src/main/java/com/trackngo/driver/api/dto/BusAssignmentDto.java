package com.trackngo.driver.api.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;
import java.time.LocalTime;

@Data //getters and setters
@NoArgsConstructor
@AllArgsConstructor
public class BusAssignmentDto {
    private Long busId;
    private String busNumber;
    private String busBrand;
    private String registrationNumber;
    private LocalTime startTime;
    private LocalTime endTime;
    private LocalTime returnStartTime;
    private LocalTime returnEndTime;
    private Integer seatCapacity;
    private String busCondition;
    private String busType;
    private String status;
    private LocalDate insuranceExpDate;
    private String amenities;
    private Long routeId;
    private String routeName;
}
