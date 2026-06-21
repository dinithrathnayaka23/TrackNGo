package com.trackngo.feedbackrating.api.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class RatingDto {
    private Long id;
    @NotBlank
    private String name;
}
