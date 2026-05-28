import { MockTennisDataProvider } from "@/lib/providers/mock-tennis-data-provider";
import { EspnTennisProvider } from "@/lib/providers/espn-tennis-provider";
import { TennisApiProvider } from "@/lib/providers/tennis-api-provider";
import type { TennisDataProvider } from "@/lib/providers/tennis-data-provider";

export function getTennisDataProvider(providerName = "mock"): TennisDataProvider {
  if (providerName === "mock" || providerName === "MockTennisDataProvider") {
    return new MockTennisDataProvider();
  }

  if (providerName === "tennis_api" || providerName === "TennisApiProvider") {
    return new TennisApiProvider();
  }

  if (providerName === "espn" || providerName === "EspnTennisProvider") {
    return new EspnTennisProvider();
  }

  throw new Error(`No tennis data provider registered for ${providerName}`);
}
