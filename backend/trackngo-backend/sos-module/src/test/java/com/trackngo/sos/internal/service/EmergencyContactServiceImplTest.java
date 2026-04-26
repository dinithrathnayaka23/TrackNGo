package com.trackngo.sos.internal.service;

import com.trackngo.commons.exception.ResourceNotFoundException;
import com.trackngo.sos.api.dto.CreateEmergencyContactRequest;
import com.trackngo.sos.api.dto.EmergencyContactDto;
import com.trackngo.sos.internal.entity.EmergencyContact;
import com.trackngo.sos.internal.repository.EmergencyContactRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class EmergencyContactServiceImplTest {

    @Mock
    private EmergencyContactRepository repository;

    @InjectMocks
    private EmergencyContactServiceImpl service;

    /** Verifies that owner contacts are returned in DTO form with the stored values preserved. */
    @Test
    void getContactsByOwnerShouldMapEmergencyContactDtos() {
        when(repository.findByOwnerIdAndOwnerTypeOrderByCreatedAtDesc(12L, "passenger"))
                .thenReturn(List.of(buildContact(1L, "passenger", "Alice"), buildContact(2L, "passenger", "Bob")));

        List<EmergencyContactDto> result = service.getContactsByOwner(12L, "passenger");

        assertEquals(2, result.size());
        assertEquals("Alice", result.get(0).getName());
        assertEquals("Bob", result.get(1).getName());
        assertEquals("passenger", result.get(0).getOwnerType());
    }

    /** Verifies that contact creation normalizes the owner type before persisting the new record. */
    @Test
    void addContactShouldNormalizeOwnerTypeAndPersistEntity() {
        CreateEmergencyContactRequest request = new CreateEmergencyContactRequest();
        request.setOwnerId(41L);
        request.setOwnerType("Passenger");
        request.setName("Jane Doe");
        request.setTeleNumber("0712345678");
        request.setRelationship("Sister");

        when(repository.save(any(EmergencyContact.class))).thenAnswer(invocation -> {
            EmergencyContact entity = invocation.getArgument(0);
            entity.setContactId(77L);
            return entity;
        });

        EmergencyContactDto result = service.addContact(request);

        ArgumentCaptor<EmergencyContact> captor = ArgumentCaptor.forClass(EmergencyContact.class);
        verify(repository).save(captor.capture());
        assertEquals("passenger", captor.getValue().getOwnerType());
        assertEquals(77L, result.getContactId());
        assertEquals("Jane Doe", result.getName());
    }

    /** Verifies that deleting an existing emergency contact delegates to the repository. */
    @Test
    void deleteContactShouldRemoveExistingContact() {
        when(repository.existsById(9L)).thenReturn(true);

        service.deleteContact(9L);

        verify(repository).deleteById(9L);
    }

    /** Verifies that deleting an unknown emergency contact raises a not-found error. */
    @Test
    void deleteContactShouldThrowWhenContactDoesNotExist() {
        when(repository.existsById(9L)).thenReturn(false);

        assertThrows(ResourceNotFoundException.class, () -> service.deleteContact(9L));
    }

    /** Builds a representative emergency contact entity for service-level tests. */
    private EmergencyContact buildContact(Long contactId, String ownerType, String name) {
        EmergencyContact entity = new EmergencyContact();
        entity.setContactId(contactId);
        entity.setOwnerId(12L);
        entity.setOwnerType(ownerType);
        entity.setName(name);
        entity.setTeleNumber("0712345678");
        entity.setRelationship("Friend");
        return entity;
    }
}
