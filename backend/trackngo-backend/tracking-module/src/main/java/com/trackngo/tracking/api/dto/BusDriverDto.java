package com.trackngo.tracking.api.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * The driver currently assigned to a bus, as needed to start a chat with them
 * from the live tracking screen.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class BusDriverDto {
    /** The driver's user id, which is also their chat participant id. */
    private Long driverId;
    private String name;
    private String profilePhoto;
}
