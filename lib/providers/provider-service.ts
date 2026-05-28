import { EspnTennisProvider } from "@/lib/providers/espn-tennis-provider";
import type { TennisDataProvider } from "@/lib/providers/tennis-data-provider";

/**
 * Tennis data provider registry. Only ESPN's (community-maintained) feed is
 * supported — every other registration was scaffolding for providers we never
 * wired up.
 */
export function getTennisDataProvider(providerName = "espn"): TennisDataProvider {
  if (providerName === "espn" || providerName === "EspnTennisProvider") {
    return new EspnTennisProvider();
  }
  throw new Error(`No tennis data provider registered for ${providerName}`);
}
