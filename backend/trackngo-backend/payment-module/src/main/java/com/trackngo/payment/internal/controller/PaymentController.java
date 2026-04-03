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
    private final PaymentService service;

    @PostMapping
    public ApiResponse<PaymentDto> create(@Valid @RequestBody PaymentDto dto) {
        return ApiResponse.ok("Created", service.create(dto));
    }

    @GetMapping("/{id}")
    public ApiResponse<PaymentDto> get(@PathVariable Long id) {
        return ApiResponse.ok("Fetched", service.get(id));
    }

    @GetMapping
    public ApiResponse<List<PaymentDto>> getAll() {
        return ApiResponse.ok("Fetched", service.getAll());
    }

    @PutMapping("/{id}")
    public ApiResponse<PaymentDto> update(@PathVariable Long id, @Valid @RequestBody PaymentDto dto) {
        return ApiResponse.ok("Updated", service.update(id, dto));
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(@PathVariable Long id) {
        service.delete(id);
        return ApiResponse.ok("Deleted", null);
    }
}
