package com.trackngo.complaint.api.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

import java.time.LocalDateTime;

@Data
public class ComplaintDto {
    private Long id;
    private String image;
    private String bookingReference;
    @NotBlank
    private String complaintType;
    private String priority;
    @NotBlank
    private String description;
    private String status;
    private String adminResponse;
    private LocalDateTime createdAt;
    private LocalDateTime resolvedAt;
    private Long passengerId;
    private Long driverId;
}
