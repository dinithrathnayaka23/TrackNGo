package com.trackngo.app.dto;

/**
 * Bus assigned to a corporate contract, together with its driver.
 * All fields are nullable because a contract may not have a bus assigned yet.
 */
public record ContractBusDto(
        Long busId,
        String busNumber,
        String busBrand,
        String registrationNumber,
        Integer seatCapacity,
        String amenities,
        String busCondition,
        String status,
        String routeName,
        Long driverId,
        String driverName,
        String driverPhone
) {
}
