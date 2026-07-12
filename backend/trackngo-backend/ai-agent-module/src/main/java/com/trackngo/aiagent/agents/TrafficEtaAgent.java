package com.trackngo.aiagent.agents;

import com.trackngo.aiagent.services.TrafficEtaAgentService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Description;

import java.util.function.Function;

@Configuration
@Slf4j
public class TrafficEtaAgent {

    private final TrafficEtaAgentService trafficEtaAgentService;

    public TrafficEtaAgent(TrafficEtaAgentService trafficEtaAgentService) {
        this.trafficEtaAgentService = trafficEtaAgentService;
    }

    public record EtaRequest(String busId) {}
    public record EtaResponse(String currentLocation, int estimatedDelayMinutes, String message) {}

    @Bean
    @Description("Predicts delays and provides ETA using GPS and traffic data for a specific bus.")
    public Function<EtaRequest, EtaResponse> getLiveEta() {
        return trafficEtaAgentService::getLiveEta;
    }
}
