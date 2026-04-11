package com.trackngo.sos.api.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class CreateEmergencyContactRequest {
    @NotNull
    private Long ownerId;

    @NotBlank
    private String ownerType;

    @NotBlank
    private String name;

    @NotBlank
    private String teleNumber;

    private String relationship;
}
