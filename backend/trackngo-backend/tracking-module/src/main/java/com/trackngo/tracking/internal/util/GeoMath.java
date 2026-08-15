package com.trackngo.tracking.internal.util;

/*
  Small geodesic helpers shared by the tracking module.
  Distances use the spherical earth model, which is accurate to roughly 0.5%
  over the distances a bus covers between two GPS fixes.
*/
public final class GeoMath {

    private static final double EARTH_RADIUS_METERS = 6_371_008.8;

    private GeoMath() {
    }

    /*
      Great-circle distance between two coordinates, in metres.
    */
    public static double distanceMeters(double lat1, double lon1, double lat2, double lon2) {
        double dLat = Math.toRadians(lat2 - lat1);
        double dLon = Math.toRadians(lon2 - lon1);
        double a = Math.sin(dLat / 2) * Math.sin(dLat / 2)
                + Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2))
                * Math.sin(dLon / 2) * Math.sin(dLon / 2);
        return EARTH_RADIUS_METERS * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }

    /*
      Initial bearing from point 1 to point 2, in degrees clockwise from true
      north, normalised to the range [0, 360).
    */
    public static double bearingDegrees(double lat1, double lon1, double lat2, double lon2) {
        double phi1 = Math.toRadians(lat1);
        double phi2 = Math.toRadians(lat2);
        double dLambda = Math.toRadians(lon2 - lon1);

        double y = Math.sin(dLambda) * Math.cos(phi2);
        double x = Math.cos(phi1) * Math.sin(phi2)
                - Math.sin(phi1) * Math.cos(phi2) * Math.cos(dLambda);

        return (Math.toDegrees(Math.atan2(y, x)) + 360) % 360;
    }
}
