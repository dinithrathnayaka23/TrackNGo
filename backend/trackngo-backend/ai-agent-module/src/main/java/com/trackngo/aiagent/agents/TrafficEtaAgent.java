package com.trackngo.aiagent.agents;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Description;
import java.util.function.Function;
import lombok.extern.slf4j.Slf4j;

@Configuration
@Slf4j
public class TrafficEtaAgent {

    public record EtaRequest(String busId) {}
    public record EtaResponse(String currentLocation, int estimatedDelayMinutes, String message) {}

    @Bean
    @Description("Predicts delays and provides ETA using GPS and traffic data for a specific bus.")
    public Function<EtaRequest, EtaResponse> getLiveEta() {
        return request -> {
            log.info("Fetching ETA and traffic data for bus: {}", request.busId());
            // Mocking the response for now. Will connect to tracking-module
            return new EtaResponse("Highway 42, near Exit 5", 15, "Bus is delayed by 15 minutes due to heavy traffic.");
        };
    }
}
