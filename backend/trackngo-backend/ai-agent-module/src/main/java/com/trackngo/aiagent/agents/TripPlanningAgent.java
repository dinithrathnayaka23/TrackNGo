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

    public record RouteRequest(
            String source,
            String destination,
            String date,
            String busCategory,
            String preferredTime) {
        public RouteRequest(String source, String destination, String date) {
            this(source, destination, date, null, null);
        }
    }

    public record RouteOption(
            Long busId,
            String busNumber,
            String busType,
            String routeName,
            String departureTime,
            String arrivalTime,
            String fare,
            int availableSeats,
            List<String> amenities,
            String reason) {}

    public record RouteResponse(List<String> routes, List<RouteOption> options, String confidence, String source) {
        public RouteResponse(List<String> routes) {
            this(routes, List.of(), "low", "fallback");
        }
    }

    @Bean
    @Description("Finds the best available bus routes between a source and destination on a given date.")
    public Function<RouteRequest, RouteResponse> findRoutes() {
        return request -> tripPlanningAgentService.findRoutes(request);
    }
}
