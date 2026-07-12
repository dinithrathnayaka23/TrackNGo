package com.trackngo.aiagent.agents;

import com.trackngo.aiagent.services.TripPlanningAgentService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Description;

import java.util.List;
import java.util.function.Function;

@Configuration
@Slf4j
public class TripPlanningAgent {

    private final TripPlanningAgentService tripPlanningAgentService;

    public TripPlanningAgent(TripPlanningAgentService tripPlanningAgentService) {
        this.tripPlanningAgentService = tripPlanningAgentService;
    }

    public record RouteRequest(String source, String destination, String date) {}
    public record RouteResponse(List<String> routes) {}

    @Bean
    @Description("Finds the best available bus routes between a source and destination on a given date.")
    public Function<RouteRequest, RouteResponse> findRoutes() {
        return request -> tripPlanningAgentService.findRoutes(request);
    }
}
