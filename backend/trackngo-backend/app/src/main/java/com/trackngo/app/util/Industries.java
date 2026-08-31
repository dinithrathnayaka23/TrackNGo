package com.trackngo.app.util;

import java.util.List;
import java.util.Set;

/**
 * The fixed list of industries offered on the corporate sign-up and profile
 * screens, covering the sectors that actually request employee transport
 * contracts in Sri Lanka. Kept in one place so the mobile app's dropdown and
 * this server-side check can never drift out of sync with each other.
 */
public final class Industries {

    public static final List<String> ALL = List.of(
            "Information Technology & BPO",
            "Telecommunications",
            "Banking & Finance",
            "Insurance",
            "Apparel & Textiles",
            "Manufacturing",
            "Conglomerate",
            "Import & Export",
            "Healthcare & Pharmaceuticals",
            "Education",
            "Tourism & Hospitality",
            "Construction & Engineering",
            "Retail & E-commerce",
            "Logistics & Supply Chain",
            "Private Transport",
            "Government & Public Sector",
            "Agriculture & Plantations",
            "Energy & Utilities",
            "Media & Communications",
            "Other"
    );

    private static final Set<String> ALL_SET = Set.copyOf(ALL);

    private Industries() {
    }

    /** True only for an exact match against {@link #ALL} — the field is a fixed selection, not free text. */
    public static boolean isValid(String value) {
        return value != null && ALL_SET.contains(value.trim());
    }
}
