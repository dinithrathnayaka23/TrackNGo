package com.trackngo.aiagent.services;

import com.trackngo.aiagent.agents.TrafficEtaAgent;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

@Service
@Slf4j
public class TrafficEtaAgentService {

    public TrafficEtaAgent.EtaResponse getLiveEta(TrafficEtaAgent.EtaRequest request) {
        log.info("Fetching ETA and traffic data for bus: {}", request.busId());

        return new TrafficEtaAgent.EtaResponse(
                "Highway 42, near Exit 5",
                15,
                "Bus is delayed by 15 minutes due to heavy traffic."
        );
    }
}
