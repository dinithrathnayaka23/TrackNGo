package com.trackngo.notification.api.dto;

/**
 * How many accounts each audience currently holds.
 *
 * The admin web shows these before a send so the size of the audience is known while
 * the notice is still being composed, rather than discovered afterwards. The total is
 * left to the caller, which only ever sums the audiences actually selected.
 */
public record AudienceCountsDto(long passengers, long drivers, long corporate) {
}
