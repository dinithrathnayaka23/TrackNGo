package com.trackngo.sos.internal.service;

import com.trackngo.commons.exception.BusinessException;
import com.trackngo.commons.exception.ResourceNotFoundException;
import com.trackngo.sos.api.dto.AdminEmergencyNumberDtos.SaveEmergencyNumberRequest;
import com.trackngo.sos.api.dto.EmergencyNumberDto;
import com.trackngo.sos.internal.entity.EmergencyNumber;
import com.trackngo.sos.internal.repository.EmergencyNumberRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class EmergencyNumberServiceImplTest {

    @Mock
    private EmergencyNumberRepository repository;

    @InjectMocks
    private EmergencyNumberServiceImpl service;

    /** Verifies that the service returns the currently active emergency number row. */
    @Test
    void getActiveEmergencyNumbersShouldReturnActiveRow() {
        when(repository.findFirstByIsActiveTrueOrderByEmergencyIdAsc())
                .thenReturn(Optional.of(buildEntity(1L, "Sri Lanka Default", true)));

        EmergencyNumberDto result = service.getActiveEmergencyNumbers();

        assertEquals(1L, result.getEmergencyId());
        assertEquals("Sri Lanka Default", result.getLabel());
        assertEquals(true, result.getIsActive());
    }

    /** Verifies that the first created emergency number becomes active even when the request marks it inactive. */
    @Test
    void createEmergencyNumberShouldAutoActivateFirstRow() {
        SaveEmergencyNumberRequest request = buildRequest("  National SOS  ", "110", false);
        when(repository.countByIsActiveTrue()).thenReturn(0L);
        when(repository.save(any(EmergencyNumber.class))).thenAnswer(invocation -> invocation.getArgument(0));

        EmergencyNumberDto result = service.createEmergencyNumber(request);

        ArgumentCaptor<EmergencyNumber> captor = ArgumentCaptor.forClass(EmergencyNumber.class);
        verify(repository).save(captor.capture());
        assertEquals("National SOS", captor.getValue().getLabel());
        assertEquals(true, captor.getValue().getIsActive());
        assertEquals(true, result.getIsActive());
        verify(repository, never()).deactivateAll();
    }

    /** Verifies that explicitly activating a new row deactivates the existing active rows first. */
    @Test
    void createEmergencyNumberShouldDeactivateOthersWhenRequestIsActive() {
        SaveEmergencyNumberRequest request = buildRequest("Active Row", "119", true);
        when(repository.save(any(EmergencyNumber.class))).thenAnswer(invocation -> invocation.getArgument(0));

        EmergencyNumberDto result = service.createEmergencyNumber(request);

        verify(repository).deactivateAll();
        assertEquals(true, result.getIsActive());
    }

    /** Verifies that the last active emergency number cannot be updated into an inactive state. */
    @Test
    void updateEmergencyNumberShouldRejectDeactivatingLastActiveRow() {
        SaveEmergencyNumberRequest request = buildRequest("Updated Row", "111", false);
        when(repository.findById(5L)).thenReturn(Optional.of(buildEntity(5L, "Current", true)));
        when(repository.countByIsActiveTrue()).thenReturn(1L);

        assertThrows(BusinessException.class, () -> service.updateEmergencyNumber(5L, request));
    }

    /** Verifies that activating an existing row deactivates the other rows and persists trimmed values. */
    @Test
    void updateEmergencyNumberShouldActivateSelectedRowAndPersistTrimmedValues() {
        SaveEmergencyNumberRequest request = buildRequest("  Updated Row  ", "118", true);
        EmergencyNumber existing = buildEntity(5L, "Current", false);
        when(repository.findById(5L)).thenReturn(Optional.of(existing));
        when(repository.save(any(EmergencyNumber.class))).thenAnswer(invocation -> invocation.getArgument(0));

        EmergencyNumberDto result = service.updateEmergencyNumber(5L, request);

        verify(repository).deactivateAllExcept(5L);
        assertEquals("Updated Row", existing.getLabel());
        assertEquals(true, existing.getIsActive());
        assertEquals("118", result.getFireBrigade());
    }

    /** Verifies that blank required values are rejected before an emergency number is persisted. */
    @Test
    void createEmergencyNumberShouldRejectBlankRequiredFields() {
        SaveEmergencyNumberRequest request = new SaveEmergencyNumberRequest(" ", "110", "1990", "119", "1919", true);

        assertThrows(BusinessException.class, () -> service.createEmergencyNumber(request));
    }

    /** Verifies that unknown emergency number ids surface a not-found error. */
    @Test
    void updateEmergencyNumberShouldThrowWhenRowDoesNotExist() {
        when(repository.findById(99L)).thenReturn(Optional.empty());

        assertThrows(ResourceNotFoundException.class, () -> service.updateEmergencyNumber(99L, buildRequest("Row", "110", true)));
    }

    /** Builds a representative admin request for emergency number service tests. */
    private SaveEmergencyNumberRequest buildRequest(String label, String fireBrigade, boolean active) {
        return new SaveEmergencyNumberRequest(label, fireBrigade, "1990", "119", "1919", active);
    }

    /** Builds a representative emergency number entity used by the mocked repository. */
    private EmergencyNumber buildEntity(Long emergencyId, String label, boolean active) {
        EmergencyNumber entity = new EmergencyNumber();
        entity.setEmergencyId(emergencyId);
        entity.setLabel(label);
        entity.setFireBrigade("110");
        entity.setAmbulance("1990");
        entity.setPolice("119");
        entity.setHelpCenter("1919");
        entity.setIsActive(active);
        return entity;
    }
}
