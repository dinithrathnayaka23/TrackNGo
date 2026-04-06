package com.trackngo.admin.api.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class AdminLogDto {
    private Long id;
    @NotBlank
    private String name;
}
