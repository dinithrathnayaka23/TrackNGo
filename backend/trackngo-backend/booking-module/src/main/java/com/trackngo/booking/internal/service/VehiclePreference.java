package com.trackngo.booking.internal.service;

import java.util.Arrays;
import java.util.LinkedHashSet;
import java.util.Locale;
import java.util.Set;

/**
 * The two independent choices a passenger makes about the vehicle for a private trip:
 * how big the bus is, and whether it is air conditioned.
 *
 * These used to be one field offering "Standard", "AC" or "Mini Bus", which forced a
 * passenger who wanted a mini bus to give up saying anything about air conditioning.
 * The booking still travels as a single {@code requirement} string so nothing else in
 * the schema or the apps had to change; this parses the two answers back out of it.
 *
 * <p>Accepted form is a comma-separated list of tokens, for example
 * {@code "Mini Bus, Non-AC"}. Tokens are matched whole rather than by substring,
 * because "Non-AC" contains "AC" and a contains-check would read it as the opposite
 * of what the passenger asked for. Bookings saved before the split carry a single
 * token and still parse: an unstated dimension simply goes unfiltered.
 */
record VehiclePreference(boolean standard, boolean miniBus, boolean airConditioned, boolean nonAirConditioned) {

    private static final String STANDARD = "standard";
    private static final String MINI_BUS = "mini bus";
    private static final String AC = "ac";
    private static final String NON_AC = "non-ac";

    static VehiclePreference parse(String requirement) {
        if (requirement == null || requirement.isBlank()) {
            return new VehiclePreference(false, false, false, false);
        }

        Set<String> tokens = new LinkedHashSet<>();
        Arrays.stream(requirement.split(","))
                .map(token -> token.trim().toLowerCase(Locale.ROOT))
                .filter(token -> !token.isEmpty())
                .forEach(tokens::add);

        return new VehiclePreference(
                tokens.contains(STANDARD),
                tokens.contains(MINI_BUS),
                tokens.contains(AC),
                tokens.contains(NON_AC)
        );
    }
}
