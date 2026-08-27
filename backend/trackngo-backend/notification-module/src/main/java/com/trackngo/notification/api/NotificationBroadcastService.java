package com.trackngo.notification.api;

import com.trackngo.notification.api.dto.AudienceCountsDto;
import com.trackngo.notification.api.dto.BroadcastNotificationRequest;
import com.trackngo.notification.api.dto.BroadcastResultDto;

/** Sends an administrator's own notice to whole audiences rather than to one account. */
public interface NotificationBroadcastService {

    /** Counts the accounts each audience would reach right now. */
    AudienceCountsDto getAudienceCounts();

    /** Writes one notice per recipient and reports how many were created. */
    BroadcastResultDto broadcast(BroadcastNotificationRequest request);
}
