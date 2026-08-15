package com.trackngo.commons.booking;

/**
 * Coordinates passenger-impacting changes to routes and buses.
 * The implementation lives in the booking module so route/fleet modules do
 * not need to depend directly on each other.
 */
public interface BookingDisruptionHandler {
    void cancelFutureBookingsForRoute(Long routeId, String reason);

    void cancelFutureBookingsForBus(Long busId, String reason);

    void notifyFutureBookingPassengersRouteRestored(Long routeId);

    void notifyFutureBookingPassengersBusRestored(Long busId);
}
