package com.trackngo.payment.internal.controller;

import com.trackngo.payment.api.PaymentService;
import com.trackngo.payment.api.dto.PaymentDto;
import com.trackngo.commons.ApiResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/payments")
@RequiredArgsConstructor
public class PaymentController {
    // Keep controller thin: delegate all business logic to service layer.
    private final PaymentService service;

    @PostMapping
    public ApiResponse<PaymentDto> create(@Valid @RequestBody PaymentDto dto) {
        // Validated request body + wrapped success response format.
        return ApiResponse.ok("Created", service.create(dto));
    }

    @GetMapping("/{id}")
    public ApiResponse<PaymentDto> get(@PathVariable Long id) {
        // Fetch one payment by URL path id.
        return ApiResponse.ok("Fetched", service.get(id));
    }

    @GetMapping
    public ApiResponse<List<PaymentDto>> getAll() {
        // List endpoint for payment tables/dropdowns.
        return ApiResponse.ok("Fetched", service.getAll());
    }

    @PutMapping("/{id}")
    public ApiResponse<PaymentDto> update(@PathVariable Long id, @Valid @RequestBody PaymentDto dto) {
        // Full update of payment details.
        return ApiResponse.ok("Updated", service.update(id, dto));
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(@PathVariable Long id) {
        // Delete is void; response message confirms completion.
        service.delete(id);
        return ApiResponse.ok("Deleted", null);
    }
}
