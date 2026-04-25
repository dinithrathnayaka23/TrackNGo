package com.trackngo.booking.internal.controller.promotion;

import com.trackngo.booking.api.dto.PromotionDtos.PromotionSummary;
import com.trackngo.booking.api.dto.PromotionDtos.SavePromotionRequest;
import com.trackngo.booking.internal.service.PromotionService;
import com.trackngo.commons.ApiResponse;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/admin/promotions")
public class AdminPromotionController {

    private final PromotionService promotionService;

    /** Creates the admin promotion controller with its service dependency. */
    public AdminPromotionController(PromotionService promotionService) {
        this.promotionService = promotionService;
    }

    /** Returns all promotions shown in the admin dashboard. */
    @GetMapping
    public ApiResponse<List<PromotionSummary>> listPromotions() {
        return ApiResponse.ok("Promotions", promotionService.listPromotions());
    }

    /** Creates a new promotion from the admin request payload. */
    @PostMapping
    public ApiResponse<PromotionSummary> createPromotion(@RequestBody SavePromotionRequest request) {
        return ApiResponse.ok("Promotion created", promotionService.createPromotion(request));
    }

    /** Updates an existing promotion from the admin request payload. */
    @PutMapping("/{promotionId}")
    public ApiResponse<PromotionSummary> updatePromotion(
            @PathVariable Long promotionId,
            @RequestBody SavePromotionRequest request
    ) {
        return ApiResponse.ok("Promotion updated", promotionService.updatePromotion(promotionId, request));
    }

    /** Cancels an existing promotion so it can no longer be used. */
    @PatchMapping("/{promotionId}/cancel")
    public ApiResponse<PromotionSummary> cancelPromotion(@PathVariable Long promotionId) {
        return ApiResponse.ok("Promotion cancelled", promotionService.cancelPromotion(promotionId));
    }

    /** Deletes a promotion that is no longer active. */
    @DeleteMapping("/{promotionId}")
    public ApiResponse<Void> deletePromotion(@PathVariable Long promotionId) {
        promotionService.deleteInactivePromotion(promotionId);
        return ApiResponse.ok("Promotion removed", null);
    }
}
