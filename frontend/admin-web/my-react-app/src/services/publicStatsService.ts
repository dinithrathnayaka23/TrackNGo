import { fetchBuses, fetchDriverOptions } from './busService'
import { fetchRoutes } from './routeService'

/**
 * Live counts for the branding panel on the auth screens.
 *
 * Every source here is an endpoint the API already serves without a token
 * (/api/admin/buses, /api/admin/buses/options/drivers and /api/routes are all
 * permitAll in SecurityConfig), so these load before sign-in. Registered user
 * counts are NOT included: /api/users requires a bearer token, and opening it
 * up just to decorate the login page is not a trade worth making.
 *
 * A count is null when its request failed. Callers hide that stat rather than
 * substituting a placeholder number, so the panel never shows a figure that
 * isn't real.
 */

export type PublicStats = {
  buses: number | null
  routes: number | null
  drivers: number | null
}

async function countOf(load: () => Promise<unknown[]>): Promise<number | null> {
  try {
    const rows = await load()
    return Array.isArray(rows) ? rows.length : null
  } catch {
    return null
  }
}

export async function fetchPublicStats(): Promise<PublicStats> {
  const [buses, routes, drivers] = await Promise.all([
    countOf(fetchBuses),
    countOf(fetchRoutes),
    countOf(fetchDriverOptions),
  ])

  return { buses, routes, drivers }
}
