package com.trackngo.booking.internal.service;

import java.math.BigDecimal;

/** The computed total price and required advance for a private trip booking. */
public record TripFareQuote(BigDecimal finalPrice, BigDecimal advancePayment) {}
