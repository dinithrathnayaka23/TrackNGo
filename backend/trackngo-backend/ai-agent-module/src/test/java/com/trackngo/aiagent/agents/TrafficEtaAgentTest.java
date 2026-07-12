package com.trackngo.aiagent.agents;

import com.trackngo.aiagent.services.TrafficEtaAgentService;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class TrafficEtaAgentTest {

    @Test
    void shouldProvideEtaDetails() {
        TrafficEtaAgent trafficEtaAgent = new TrafficEtaAgent(new TrafficEtaAgentService());
        TrafficEtaAgent.EtaRequest request = new TrafficEtaAgent.EtaRequest("BUS-101");

        var function = trafficEtaAgent.getLiveEta();
        TrafficEtaAgent.EtaResponse response = function.apply(request);

        assertNotNull(response);
        assertNotNull(response.currentLocation());
        assertTrue(response.estimatedDelayMinutes() >= 0);
        assertTrue(response.message().contains("delayed") || response.message().contains("traffic"));
    }
}
