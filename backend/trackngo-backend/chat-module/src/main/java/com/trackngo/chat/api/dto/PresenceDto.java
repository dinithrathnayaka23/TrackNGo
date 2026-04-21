package com.trackngo.chat.api.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * DTO for chat presence updates. The changed user is carried in userId/online,
 * while onlineUserIds gives clients a complete current snapshot.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PresenceDto {

    private Long userId;
    private boolean online;
    private List<Long> onlineUserIds;
}
