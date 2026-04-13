package com.trackngo.sos.api.dto;

import lombok.Data;

@Data
public class EmergencyContactDto {
    private Long contactId;
    private Long ownerId;
    private String ownerType;
    private String name;
    private String teleNumber;
    private String relationship;
}
