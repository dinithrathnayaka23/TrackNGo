package com.trackngo.app.controller;

import com.trackngo.app.dto.CorporateContractDetailDto;
import com.trackngo.app.dto.CorporateContractDto;
import com.trackngo.app.dto.CorporateInvoiceDto;
import com.trackngo.app.dto.CorporatePricingEstimateRequest;
import com.trackngo.app.service.CorporatePricingService;
import com.trackngo.app.service.CorporateService;
import com.trackngo.commons.ApiResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.math.BigDecimal;
import java.util.List;

@RestController
@RequestMapping("/api/corporate")
@RequiredArgsConstructor
public class CorporateController {

    private final CorporateService corporateService;
    private final CorporatePricingService pricingService;

    @GetMapping("/contracts")
    public ApiResponse<List<CorporateContractDto>> getContracts(@RequestParam("userId") Long userId) {
        return ApiResponse.ok("Contracts fetched successfully", corporateService.getContracts(userId));
    }

    @GetMapping("/contracts/{contractId}")
    public ApiResponse<CorporateContractDetailDto> getContractDetail(
            @PathVariable("contractId") Long contractId,
            @RequestParam(value = "userId", required = false) Long userId) {
        CorporateContractDetailDto detail = corporateService.getContractDetail(contractId, userId);
        if (detail == null) {
            return ApiResponse.fail("Contract not found");
        }
        return ApiResponse.ok("Contract fetched successfully", detail);
    }

    @GetMapping("/invoices")
    public ApiResponse<List<CorporateInvoiceDto>> getInvoices(@RequestParam("userId") Long userId) {
        return ApiResponse.ok("Invoices fetched successfully", corporateService.getInvoices(userId));
    }

    @org.springframework.web.bind.annotation.PostMapping("/contracts")
    public ApiResponse<CorporateContractDto> createContract(@org.springframework.web.bind.annotation.RequestBody CorporateContractDto contractDto) {
        try {
            CorporateContractDto created = corporateService.createContract(contractDto);
            return ApiResponse.ok("Contract created successfully", created);
        } catch (IllegalStateException | IllegalArgumentException ex) {
            return ApiResponse.fail(ex.getMessage());
        }
    }

    /**
     * Previews the standard monthly billing amount for a contract before it is
     * submitted, so the mobile app can show a live estimate as the corporate
     * user fills in the route, shift type and employee count.
     */
    @org.springframework.web.bind.annotation.PostMapping("/contracts/estimate")
    public ApiResponse<BigDecimal> estimatePricing(
            @org.springframework.web.bind.annotation.RequestBody CorporatePricingEstimateRequest request) {
        try {
            BigDecimal amount = pricingService.calculateMonthlyAmount(
                    request.morningDistanceKm(),
                    request.eveningDistanceKm(),
                    request.employeeCount() == null ? 0 : request.employeeCount(),
                    request.shiftType(),
                    request.workingDays(),
                    request.busType()
            );
            return ApiResponse.ok("Estimate calculated", amount);
        } catch (IllegalArgumentException ex) {
            return ApiResponse.fail(ex.getMessage());
        }
    }
}
