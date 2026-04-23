package com.trackngo.booking.internal.controller.promotion;

import com.trackngo.booking.api.dto.PromotionDtos.PromotionQuoteRequest;
import com.trackngo.booking.api.dto.PromotionDtos.PromotionQuoteResult;
import com.trackngo.booking.internal.service.PromotionService;
import com.trackngo.commons.ApiResponse;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/booking-flow/promotions")
public class PromotionController {

    private final PromotionService promotionService;

    public PromotionController(PromotionService promotionService) {
        this.promotionService = promotionService;
    }

    @PostMapping("/quote")
    public ApiResponse<PromotionQuoteResult> quote(@RequestBody PromotionQuoteRequest request) {
        return ApiResponse.ok("Promotion quote", promotionService.quote(request));
    }
}
