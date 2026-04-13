package com.trackngo.sos.api;

import com.trackngo.sos.api.dto.SosAlertDto;
import com.trackngo.sos.api.dto.TriggerSosAlertRequest;

import java.util.List;

public interface SosAlertService {
    SosAlertDto triggerAlert(TriggerSosAlertRequest request);
    List<SosAlertDto> getActiveAlerts();
    SosAlertDto resolveAlert(Long sosId, Long adminId);
    SosAlertDto dismissAlert(Long sosId, Long adminId);
}
