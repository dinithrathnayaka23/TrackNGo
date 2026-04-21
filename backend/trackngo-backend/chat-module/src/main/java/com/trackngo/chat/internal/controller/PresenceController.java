package com.trackngo.chat.internal.controller;

import com.trackngo.chat.api.dto.PresenceDto;
import com.trackngo.chat.internal.service.ChatPresenceService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Provides the current chat presence snapshot for clients that may have missed
 * the initial websocket presence event while subscribing.
 */
@RestController
@RequestMapping("/api/chat/presence")
@RequiredArgsConstructor
public class PresenceController {

    private final ChatPresenceService chatPresenceService;

    @GetMapping
    public PresenceDto getPresenceSnapshot() {
        return chatPresenceService.snapshot();
    }
}
