package com.trackngo.complaint.api.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class ComplaintDto {
    private Long id;
    @NotBlank
    private String name;
}
