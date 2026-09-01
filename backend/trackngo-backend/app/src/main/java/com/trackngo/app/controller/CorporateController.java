package com.trackngo.app.controller;

import com.trackngo.app.dto.AdminContractSummaryDto;
import com.trackngo.app.dto.CancellationRequestDto;
import com.trackngo.app.dto.CancellationResponseDto;
import com.trackngo.app.dto.ContractBusDto;
import com.trackngo.app.dto.ContractStatusUpdateRequest;
import com.trackngo.app.dto.CorporateContractDetailDto;
import com.trackngo.app.dto.CorporateContractDto;
import com.trackngo.app.dto.CorporateInvoiceDto;
import com.trackngo.app.dto.CorporatePricingEstimateRequest;
import com.trackngo.app.dto.CorporatePricingSettingsDto;
import com.trackngo.app.dto.CorporateAdvancePaymentDto;
import com.trackngo.app.dto.RenewalRequestDto;
import com.trackngo.app.dto.RenewalIntentRequestDto;
import com.trackngo.app.dto.RenewalResponseDto;
import com.trackngo.app.service.CorporatePricingService;
import com.trackngo.app.service.CorporateService;
import com.trackngo.commons.ApiResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
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
@Slf4j
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
            CorporateContractDto updated = corporateService.updateContractStatus(contractId, request);
            return ApiResponse.ok("Contract status updated successfully", updated);
        } catch (Exception ex) {
            log.error("Error updating contract status for {}: {}", contractId, ex.getMessage(), ex);
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
        } catch (Exception ex) {
            log.error("Error finalizing contract {}: {}", contractId, ex.getMessage(), ex);
            return ApiResponse.fail(ex.getMessage());
        }
    }

    @PostMapping("/contracts/{contractId}/advance-payment")
    public ApiResponse<CorporateContractDto> processAdvancePayment(
            @PathVariable("contractId") Long contractId,
            @RequestBody CorporateAdvancePaymentDto request) {
        try {
            CorporateContractDto updated = corporateService.processAdvancePayment(contractId, request);
            return ApiResponse.ok("Advance payment processed successfully", updated);
        } catch (Exception ex) {
            log.error("Error processing advance payment for contract {}: {}", contractId, ex.getMessage(), ex);
            return ApiResponse.fail(ex.getMessage());
        }
    }

    @PostMapping("/contracts/{contractId}/waive-advance-payment")
    public ApiResponse<CorporateContractDto> waiveAdvancePayment(
            @PathVariable("contractId") Long contractId) {
        try {
            CorporateContractDto updated = corporateService.waiveAdvancePayment(contractId);
            return ApiResponse.ok("Advance payment waived successfully", updated);
        } catch (Exception ex) {
            log.error("Error waiving advance payment for contract {}: {}", contractId, ex.getMessage(), ex);
            return ApiResponse.fail(ex.getMessage());
        }
    }

    /**
     * Either party requests to cancel a pending or active contract, with a
     * required reason. The other party must accept via {@code /cancel-response}
     * before anything changes.
     */
    @PostMapping("/contracts/{contractId}/cancel-request")
    public ApiResponse<CorporateContractDto> requestCancellation(
            @PathVariable("contractId") Long contractId,
            @RequestBody CancellationRequestDto request) {
        try {
            CorporateContractDto updated = corporateService.requestCancellation(contractId, request.role(), request.reason());
            return ApiResponse.ok("Cancellation requested successfully", updated);
        } catch (Exception ex) {
            log.error("Error requesting cancellation for contract {}: {}", contractId, ex.getMessage(), ex);
            return ApiResponse.fail(ex.getMessage());
        }
    }

    /**
     * The party who did not request cancellation accepts or rejects it.
     */
    @PostMapping("/contracts/{contractId}/cancel-response")
    public ApiResponse<CorporateContractDto> respondToCancellation(
            @PathVariable("contractId") Long contractId,
            @RequestBody CancellationResponseDto request) {
        try {
            CorporateContractDto updated = corporateService.respondToCancellation(
                    contractId, request.role(), request.accept(), request.responseReason(), request.cancelTiming());
            return ApiResponse.ok("Cancellation response recorded successfully", updated);
        } catch (Exception ex) {
            log.error("Error responding to cancellation for contract {}: {}", contractId, ex.getMessage(), ex);
            return ApiResponse.fail(ex.getMessage());
        }
    }

    /**
     * Renews a contract nearing its end date by submitting a new pending
     * contract that continues from where this one leaves off, cloning its
     * route/shift/bus setup. Callable by either the corporate client or an
     * admin — both follow the same renewal flow.
     */
    @PostMapping("/contracts/{contractId}/renew")
    public ApiResponse<CorporateContractDto> renewContract(
            @PathVariable("contractId") Long contractId,
            @RequestBody RenewalRequestDto request) {
        try {
            CorporateContractDto renewed = corporateService.renewContract(contractId, request.userId(), request.role());
            return ApiResponse.ok("Renewal request submitted successfully", renewed);
        } catch (Exception ex) {
            log.error("Error renewing contract {}: {}", contractId, ex.getMessage(), ex);
            return ApiResponse.fail(ex.getMessage());
        }
    }

    /**
     * The corporate client asks admin for permission to renew an active
     * contract — always available, not just near its end date. Admin must
     * approve via {@code /renewal-response} before the client can proceed to
     * fill out and submit the actual renewal contract.
     */
    @PostMapping("/contracts/{contractId}/renewal-request")
    public ApiResponse<CorporateContractDto> requestRenewal(
            @PathVariable("contractId") Long contractId,
            @RequestBody RenewalIntentRequestDto request) {
        try {
            CorporateContractDto updated = corporateService.requestRenewal(contractId, request.userId());
            return ApiResponse.ok("Renewal request submitted successfully", updated);
        } catch (Exception ex) {
            log.error("Error requesting renewal for contract {}: {}", contractId, ex.getMessage(), ex);
            return ApiResponse.fail(ex.getMessage());
        }
    }

    /** Admin accepts or declines a corporate client's renewal request. */
    @PostMapping("/contracts/{contractId}/renewal-response")
    public ApiResponse<CorporateContractDto> respondToRenewalRequest(
            @PathVariable("contractId") Long contractId,
            @RequestBody RenewalResponseDto request) {
        try {
            CorporateContractDto updated = corporateService.respondToRenewalRequest(contractId, request.approve());
            return ApiResponse.ok("Renewal response recorded successfully", updated);
        } catch (Exception ex) {
            log.error("Error responding to renewal for contract {}: {}", contractId, ex.getMessage(), ex);
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

    @GetMapping("/invoices/{invoiceNumber}")
    public ApiResponse<CorporateInvoiceDto> getInvoice(@PathVariable("invoiceNumber") Long invoiceNumber) {
        CorporateInvoiceDto invoice = corporateService.getInvoice(invoiceNumber);
        if (invoice == null) {
            return ApiResponse.fail("Invoice not found");
        }
        return ApiResponse.ok("Invoice fetched successfully", invoice);
    }

    @PostMapping("/invoices/{invoiceNumber}/pay")
    public ApiResponse<Void> payInvoice(
            @PathVariable("invoiceNumber") Long invoiceNumber,
            @RequestBody CorporateAdvancePaymentDto request) {
        try {
            corporateService.payInvoice(invoiceNumber, request.sessionId());
            return ApiResponse.ok("Invoice paid successfully", null);
        } catch (Exception ex) {
            log.error("Error paying invoice {}: {}", invoiceNumber, ex.getMessage(), ex);
            return ApiResponse.fail(ex.getMessage());
        }
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
        } catch (Exception ex) {
            log.error("Error fetching available buses: {}", ex.getMessage(), ex);
            return ApiResponse.fail(ex.getMessage());
        }
    }

    @PostMapping("/contracts")
    public ApiResponse<CorporateContractDto> createContract(@RequestBody CorporateContractDto request) {
        try {
            CorporateContractDto created = corporateService.createContract(request);
            return ApiResponse.ok("Contract request submitted successfully", created);
        } catch (Exception ex) {
            log.error("Error creating corporate contract: {}", ex.getMessage(), ex);
            return ApiResponse.fail(ex.getMessage());
        }
    }

    @GetMapping("/contracts/carried-balance")
    public ApiResponse<BigDecimal> getCarriedBalance(
            @RequestParam("predecessorContractId") Long predecessorContractId,
            @RequestParam(value = "startDate", required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate) {
        try {
            BigDecimal fairBalance = corporateService.calculateFairCarriedBalance(predecessorContractId, startDate);
            return ApiResponse.ok("Carried balance calculated", fairBalance);
        } catch (Exception ex) {
            log.error("Error calculating carried balance: {}", ex.getMessage(), ex);
            return ApiResponse.fail(ex.getMessage());
        }
    }

    @PostMapping("/contracts/estimate")
    public ApiResponse<BigDecimal> estimateMonthlyAmount(@RequestBody CorporatePricingEstimateRequest request) {
        if (request.morningDistanceKm() == null && request.eveningDistanceKm() == null) {
            return ApiResponse.fail("At least one shift distance is required.");
        }
        try {
            BigDecimal estimated = pricingService.calculateMonthlyAmount(
                    request.morningDistanceKm(),
                    request.eveningDistanceKm(),
                    request.shiftType(),
                    request.workingDays(),
                    request.busType(),
                    request.isAc()
            );
            return ApiResponse.ok("Estimate calculated", estimated);
        } catch (Exception ex) {
            log.error("Error calculating monthly estimate: {}", ex.getMessage(), ex);
            return ApiResponse.fail(ex.getMessage());
        }
    }

    @GetMapping("/pricing-settings")
    public ApiResponse<CorporatePricingSettingsDto> getPricingSettings() {
        return ApiResponse.ok("Pricing settings fetched successfully", pricingService.getSettings());
    }

    @PutMapping("/pricing-settings")
    public ApiResponse<CorporatePricingSettingsDto> updatePricingSettings(@RequestBody CorporatePricingSettingsDto request) {
        try {
            CorporatePricingSettingsDto updated = pricingService.updateSettings(request);
            return ApiResponse.ok("Pricing settings updated successfully", updated);
        } catch (Exception ex) {
            log.error("Error updating pricing settings: {}", ex.getMessage(), ex);
            return ApiResponse.fail(ex.getMessage());
        }
    }
}
