package com.trackngo.complaint.api.dto;

import java.util.List;

public final class AdminComplaintDtos {

    private AdminComplaintDtos() {}

    public record AdminComplaintListItem(
        String id,
        String priority,
        String type,
        String passengerName,
        String passengerInitials,
        String description,
        String bookingId,
        String busId,
        String driverName,
        boolean hasImages,
        String imageType,
        String status,
        String created,
        String createdAt,
        long createdSort
    ) {}

    public record AdminComplaintDetail(
        String id,
        String priority,
        String type,
        String status,
        String created,
        String createdAt,
        String description,
        String bookingId,
        String busId,
        String passengerName,
        String passengerPhoneNumber,
        String driverName,
        String driverPhoneNumber,
        String adminResponse,
        List<String> images
    ) {}

    public record AdminComplaintUpdateRequest(
        String status,
        String adminResponse
    ) {}
}
