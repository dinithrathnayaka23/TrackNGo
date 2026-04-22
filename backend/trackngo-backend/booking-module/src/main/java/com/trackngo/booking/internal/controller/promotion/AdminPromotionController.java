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
@RequestMapping({"/api/admin/promotions", "/api/admin/buses/promotions"})
public class AdminPromotionController {

    private final PromotionService promotionService;

    public AdminPromotionController(PromotionService promotionService) {
        this.promotionService = promotionService;
    }

    @GetMapping
    public ApiResponse<List<PromotionSummary>> listPromotions() {
        return ApiResponse.ok("Promotions", promotionService.listPromotions());
    }

    @PostMapping
    public ApiResponse<PromotionSummary> createPromotion(@RequestBody SavePromotionRequest request) {
        return ApiResponse.ok("Promotion created", promotionService.createPromotion(request));
    }

    @PutMapping("/{promotionId}")
    public ApiResponse<PromotionSummary> updatePromotion(
            @PathVariable Long promotionId,
            @RequestBody SavePromotionRequest request
    ) {
        return ApiResponse.ok("Promotion updated", promotionService.updatePromotion(promotionId, request));
    }

    @PatchMapping("/{promotionId}/cancel")
    public ApiResponse<PromotionSummary> cancelPromotion(@PathVariable Long promotionId) {
        return ApiResponse.ok("Promotion cancelled", promotionService.cancelPromotion(promotionId));
    }

    @DeleteMapping("/{promotionId}")
    public ApiResponse<Void> deletePromotion(@PathVariable Long promotionId) {
        promotionService.deleteInactivePromotion(promotionId);
        return ApiResponse.ok("Promotion removed", null);
    }
}
