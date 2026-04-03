
package com.trackngo.chat.internal.controller;

import com.trackngo.chat.api.ConversationService;
import com.trackngo.chat.api.dto.ConversationDto;
import com.trackngo.commons.ApiResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/conversations")
@RequiredArgsConstructor
public class ConversationController {
    private final ConversationService service;

    @PostMapping
    public ApiResponse<ConversationDto> create(@Valid @RequestBody ConversationDto dto) {
        return ApiResponse.ok("Created", service.create(dto));
    }

    @GetMapping("/{id}")
    public ApiResponse<ConversationDto> get(@PathVariable Long id) {
        return ApiResponse.ok("Fetched", service.get(id));
    }

    @GetMapping
    public ApiResponse<List<ConversationDto>> getAll() {
        return ApiResponse.ok("Fetched", service.getAll());
    }

    @PutMapping("/{id}")
    public ApiResponse<ConversationDto> update(@PathVariable Long id, @Valid @RequestBody ConversationDto dto) {
        return ApiResponse.ok("Updated", service.update(id, dto));
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(@PathVariable Long id) {
        service.delete(id);
        return ApiResponse.ok("Deleted", null);
    }
}

