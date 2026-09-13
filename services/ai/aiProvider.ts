import type {
  Accommodation,
  HotelCompatibilityDiagnosis,
  ItineraryItem,
  RiskDiagnosis,
  Travel,
  TravelDiagnosis,
  UserTravelPreference,
} from '@/types/tripcheck';

export type AiProvider = {
  diagnoseHotel: (
    preference: UserTravelPreference,
    accommodation: Accommodation,
  ) => HotelCompatibilityDiagnosis;
  judgeItinerary: (
    travel: Travel,
    accommodation: Accommodation,
    itinerary: ItineraryItem[],
  ) => TravelDiagnosis;
  forecastRisk: (travel: Travel, itinerary: ItineraryItem[]) => RiskDiagnosis;
};

export function clampScore(score: number) {
  return Math.max(0, Math.min(100, Math.round(score)));
}

export function validateScoreMap(map: Record<string, number>) {
  return Object.fromEntries(
    Object.entries(map).map(([key, value]) => [key, clampScore(value)]),
  );
}
