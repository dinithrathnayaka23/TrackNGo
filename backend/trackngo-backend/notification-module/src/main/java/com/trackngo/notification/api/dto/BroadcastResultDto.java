package com.trackngo.notification.api.dto;

/** How many notices a broadcast actually created, broken down by audience. */
public record BroadcastResultDto(long passengers, long drivers, long corporate, long total) {

    public static BroadcastResultDto of(long passengers, long drivers, long corporate) {
        return new BroadcastResultDto(passengers, drivers, corporate, passengers + drivers + corporate);
    }
}
