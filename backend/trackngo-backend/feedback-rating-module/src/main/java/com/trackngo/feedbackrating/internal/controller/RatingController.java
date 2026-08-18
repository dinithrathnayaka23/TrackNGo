package com.trackngo.feedbackrating.internal.controller;

import com.trackngo.commons.ApiResponse;
import com.trackngo.commons.exception.BusinessException;
import com.trackngo.feedbackrating.api.RatingService;
import com.trackngo.feedbackrating.api.dto.RatingContextDto;
import com.trackngo.feedbackrating.api.dto.RatingDto;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/ratings")
@RequiredArgsConstructor
public class RatingController {
    private final RatingService service;
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

    /** Returns the driver/bus/journey to rate for a booking, including any prior submission. */
    @GetMapping("/context")
    public ApiResponse<RatingContextDto> getContext(
            Authentication authentication,
            @RequestParam(required = false) Long userId,
            @RequestParam String bookingReference) {
        String email = resolveEmail(authentication, userId);
        return ApiResponse.ok("Fetched", service.getContext(email, bookingReference));
    }

    /** Creates or updates the authenticated passenger's rating for a past booking. */
    @PostMapping
    public ApiResponse<RatingDto> submit(
            Authentication authentication,
            @RequestParam(required = false) Long userId,
            @Valid @RequestBody RatingDto dto) {
        String email = resolveEmail(authentication, userId);
        return ApiResponse.ok("Rating submitted", service.submit(email, dto));
    }
}
