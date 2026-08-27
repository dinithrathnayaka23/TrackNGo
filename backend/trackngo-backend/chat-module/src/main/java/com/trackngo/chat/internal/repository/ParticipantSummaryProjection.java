package com.trackngo.chat.internal.repository;

/**
 * Name and avatar for the other side of a conversation, resolved in a single
 * query so the conversation list does not need a second lookup per row.
 *
 * <p>The profile photo lives on whichever role table backs the user
 * (passenger, driver, corporate_user or admin), mirroring the COALESCE used by
 * the user profile endpoint.
 */
public interface ParticipantSummaryProjection {

    String getDisplayName();

    String getProfilePhoto();
}
