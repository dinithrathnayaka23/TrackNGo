package com.trackngo.complaint.internal.controller;

import com.trackngo.complaint.api.ComplaintService;
import com.trackngo.complaint.api.dto.ComplaintDto;
import com.trackngo.commons.ApiResponse;
import com.trackngo.commons.exception.BusinessException;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/complaints")
@RequiredArgsConstructor
public class ComplaintController {
    private final ComplaintService service;
    private final JdbcTemplate jdbc;

    /** Resolves the caller email from authentication first, then falls back to a user id lookup. */
    private String resolveEmail(Authentication authentication, Long userId) {
        if (authentication != null
                && !(authentication instanceof AnonymousAuthenticationToken)
                && authentication.getName() != null
                && !authentication.getName().isBlank()) {
            return authentication.getName();
        }
        if (userId != null) {
            return jdbc.queryForObject(
                "SELECT email FROM `user` WHERE user_id = ?",
                String.class,
                userId
            );
        }
        throw new BusinessException("Unauthorized request");
    }

    /** Creates a new complaint for the authenticated passenger. */
    @PostMapping
    public ApiResponse<ComplaintDto> create(
            Authentication authentication,
            @RequestParam(required = false) Long userId,
            @Valid @RequestBody ComplaintDto dto) {
        String email = resolveEmail(authentication, userId);
        return ApiResponse.ok("Created", service.create(email, dto));
    }

    /** Returns complaints submitted by the current passenger. */
    @GetMapping("/mine")
    public ApiResponse<List<ComplaintDto>> getMine(
            Authentication authentication,
            @RequestParam(required = false) Long userId) {
        String email = resolveEmail(authentication, userId);
        return ApiResponse.ok("Fetched", service.getMine(email));
    }

    /** Returns a single complaint for admin users. */
    @GetMapping("/{id:\\d+}")
    @PreAuthorize("hasRole('ADMIN')")
    public ApiResponse<ComplaintDto> get(@PathVariable Long id) {
        return ApiResponse.ok("Fetched", service.get(id));
    }

    /** Returns every complaint for admin users. */
    @GetMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ApiResponse<List<ComplaintDto>> getAll() {
        return ApiResponse.ok("Fetched", service.getAll());
    }

    /** Updates a complaint for admin users. */
    @PutMapping("/{id:\\d+}")
    @PreAuthorize("hasRole('ADMIN')")
    public ApiResponse<ComplaintDto> update(@PathVariable Long id, @Valid @RequestBody ComplaintDto dto) {
        return ApiResponse.ok("Updated", service.update(id, dto));
    }

    /** Deletes a complaint for admin users. */
    @DeleteMapping("/{id:\\d+}")
    @PreAuthorize("hasRole('ADMIN')")
    public ApiResponse<Void> delete(@PathVariable Long id) {
        service.delete(id);
        return ApiResponse.ok("Deleted", null);
    }
}
