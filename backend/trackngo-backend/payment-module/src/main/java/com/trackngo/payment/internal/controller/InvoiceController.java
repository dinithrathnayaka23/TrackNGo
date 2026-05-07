package com.trackngo.payment.internal.controller;

import com.trackngo.payment.api.InvoiceService;
import com.trackngo.payment.api.dto.InvoiceDto;
import com.trackngo.commons.ApiResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/invoices")
@RequiredArgsConstructor
public class InvoiceController {
    // Keep controller thin: delegate all business logic to service layer.
    private final InvoiceService service;

    @PostMapping
    public ApiResponse<InvoiceDto> create(@Valid @RequestBody InvoiceDto dto) {
        // Validated request body + wrapped success response format.
        return ApiResponse.ok("Created", service.create(dto));
    }

    @GetMapping("/{id}")
    public ApiResponse<InvoiceDto> get(@PathVariable Long id) {
        // Fetch one invoice by URL path id.
        return ApiResponse.ok("Fetched", service.get(id));
    }

    @GetMapping
    public ApiResponse<List<InvoiceDto>> getAll() {
        // List endpoint for invoice tables/dropdowns.
        return ApiResponse.ok("Fetched", service.getAll());
    }

    @PutMapping("/{id}")
    public ApiResponse<InvoiceDto> update(@PathVariable Long id, @Valid @RequestBody InvoiceDto dto) {
        // Full update of invoice details.
        return ApiResponse.ok("Updated", service.update(id, dto));
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(@PathVariable Long id) {
        // Delete is void; response message confirms completion.
        service.delete(id);
        return ApiResponse.ok("Deleted", null);
    }
}
