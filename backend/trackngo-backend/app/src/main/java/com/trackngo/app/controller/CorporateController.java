package com.trackngo.app.controller;

import com.trackngo.app.dto.AdminContractSummaryDto;
import com.trackngo.app.dto.ContractBusDto;
import com.trackngo.app.dto.ContractStatusUpdateRequest;
import com.trackngo.app.dto.CorporateContractDetailDto;
import com.trackngo.app.dto.CorporateContractDto;
import com.trackngo.app.dto.CorporateInvoiceDto;
import com.trackngo.app.dto.CorporatePricingEstimateRequest;
import com.trackngo.app.dto.CorporatePricingSettingsDto;
import com.trackngo.app.service.CorporatePricingService;
import com.trackngo.app.service.CorporateService;
import com.trackngo.commons.ApiResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.math.BigDecimal;
import java.time.LocalDate;
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

    /**
     * Every corporate contract across every company — the admin dashboard's
     * contract list. Optionally filtered by status (e.g. "pending" for the
     * approval queue).
     */
    @GetMapping("/contracts/admin")
    public ApiResponse<List<AdminContractSummaryDto>> getAllContracts(
            @RequestParam(value = "status", required = false) String status) {
        return ApiResponse.ok("Contracts fetched successfully", corporateService.getAllContracts(status));
    }

    /**
     * Admin approves, rejects, cancels or expires a contract.
     */
    @PutMapping("/contracts/{contractId}/status")
    public ApiResponse<CorporateContractDto> updateContractStatus(
            @PathVariable("contractId") Long contractId,
            @RequestBody ContractStatusUpdateRequest request) {
        try {
            CorporateContractDto updated = corporateService.updateContractStatus(contractId, request.status());
            return ApiResponse.ok("Contract status updated successfully", updated);
        } catch (IllegalStateException | IllegalArgumentException ex) {
            return ApiResponse.fail(ex.getMessage());
        }
    }

    /**
     * The corporate user confirms the final offer after admin approval,
     * turning an "approved" pending request into a true running contract.
     */
    @PutMapping("/contracts/{contractId}/finalize")
    public ApiResponse<CorporateContractDto> finalizeContract(
            @PathVariable("contractId") Long contractId,
            @RequestParam(value = "userId", required = false) Long userId) {
        try {
            CorporateContractDto finalized = corporateService.finalizeContract(contractId, userId);
            return ApiResponse.ok("Contract finalized successfully", finalized);
        } catch (IllegalStateException | IllegalArgumentException ex) {
            return ApiResponse.fail(ex.getMessage());
        }
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

    /**
     * Corporate buses available for the given contract term, with optional
     * seat/search/amenity filters. Backs the bus-selection step of contract
     * creation — only buses free for the whole requested date range are returned.
     */
    @GetMapping("/buses/available")
    public ApiResponse<List<ContractBusDto>> getAvailableBuses(
            @RequestParam("startDate") @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam("endDate") @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate,
            @RequestParam(value = "minSeats", required = false) Integer minSeats,
            @RequestParam(value = "search", required = false) String search,
            @RequestParam(value = "amenity", required = false) String amenity) {
        try {
            List<ContractBusDto> buses = corporateService.getAvailableBuses(startDate, endDate, minSeats, search, amenity);
            return ApiResponse.ok("Available buses fetched successfully", buses);
        } catch (IllegalArgumentException ex) {
            return ApiResponse.fail(ex.getMessage());
        }
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

    /**
     * The admin-configurable rates driving the pricing formula (rate per km
     * by bus size, AC/Mini Bus surcharges, working-days-per-month).
     */
    @GetMapping("/pricing-settings")
    public ApiResponse<CorporatePricingSettingsDto> getPricingSettings() {
        return ApiResponse.ok("Pricing settings fetched successfully", pricingService.getSettings());
    }

    @PutMapping("/pricing-settings")
    public ApiResponse<CorporatePricingSettingsDto> updatePricingSettings(
            @RequestBody CorporatePricingSettingsDto request) {
        try {
            return ApiResponse.ok("Pricing settings updated successfully", pricingService.updateSettings(request));
        } catch (IllegalArgumentException ex) {
            return ApiResponse.fail(ex.getMessage());
        }
    }
}
