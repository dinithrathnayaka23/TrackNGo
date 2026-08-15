package com.trackngo.tracking.api.dto;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class LiveBusLocationDto {

    @NotBlank(message = "Bus number is required")
    private String busNumber;

    @NotNull(message = "Latitude is required")
    @DecimalMin(value = "-90.0", message = "Latitude must be between -90 and 90")
    @DecimalMax(value = "90.0", message = "Latitude must be between -90 and 90")
    private Double latitude;

    @NotNull(message = "Longitude is required")
    @DecimalMin(value = "-180.0", message = "Longitude must be between -180 and 180")
    @DecimalMax(value = "180.0", message = "Longitude must be between -180 and 180")
    private Double longitude;

    /* Direction of travel in degrees clockwise from true north (0-360). */
    private Double heading;

    /* Ground speed in metres per second. */
    private Double speed;

    /*
      Horizontal accuracy radius reported by the device, in metres. The true
      position lies within this radius of (latitude, longitude) with ~68%
      probability. Smaller is better; a hand-held phone with a clear sky view
      typically reports 3-10 m.
    */
    private Double accuracy;

    /*
      Quality of the GPS fix itself, 0-100, derived from {@code accuracy}.
      Computed by the server so every client shows the same number.
    */
    private Integer accuracyPercent;

    /*
      Quality of the fix combined with how old it is, 0-100. Equal to
      accuracyPercent at the moment of publishing and decaying as the fix ages.
    */
    private Integer confidencePercent;

    /* Device clock time of the fix, epoch milliseconds. */
    private Long timestamp;

    /* Server clock time the fix was accepted, epoch milliseconds. */
    private Long serverTimestamp;

    /* Age of the fix in seconds, filled in when the location is read back. */
    private Long ageSeconds;

    /* True once the fix is too old to be trusted as the bus's current position. */
    private Boolean stale;
}
