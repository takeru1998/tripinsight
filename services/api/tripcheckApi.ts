import type {
  Accommodation,
  ItineraryItem,
  Travel,
  TravelReview,
  UserTravelPreference,
} from '@/types/tripcheck';

export type ApiTripRecord = {
  id: string;
  travel: Travel;
  accommodation: Accommodation;
  itinerary: ItineraryItem[];
  review: TravelReview;
};

export type DiagnosisKind = 'hotel' | 'itinerary' | 'risk' | 'summary';

type ApiClientOptions = {
  baseUrl: string;
  getAccessToken: () => Promise<string | null>;
};

export function createTripCheckApi({ baseUrl, getAccessToken }: ApiClientOptions) {
  async function request<T>(path: string, init?: RequestInit): Promise<T> {
    const token = await getAccessToken();
    if (!token) throw new Error('ログインが必要です');
    const response = await fetch(`${baseUrl.replace(/\/$/, '')}${path}`, {
      ...init,
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${token}`,
        ...init?.headers,
      },
    });
    if (!response.ok) {
      const message = await response.text();
      throw new Error(`TripCheck API ${response.status}: ${message}`);
    }
    return response.status === 204 ? (undefined as T) : response.json() as Promise<T>;
  }

  return {
    getProfile: () => request<UserTravelPreference>('/profile'),
    saveProfile: (profile: UserTravelPreference) => request<UserTravelPreference>('/profile', { method: 'PUT', body: JSON.stringify(profile) }),
    listTrips: () => request<{ items: ApiTripRecord[] }>('/trips'),
    getTrip: (id: string) => request<ApiTripRecord>(`/trips/${encodeURIComponent(id)}`),
    saveTrip: (trip: ApiTripRecord) => request<ApiTripRecord>(`/trips/${encodeURIComponent(trip.id)}`, { method: 'PUT', body: JSON.stringify(trip) }),
    deleteTrip: (id: string) => request<void>(`/trips/${encodeURIComponent(id)}`, { method: 'DELETE' }),
    diagnose: <T>(kind: DiagnosisKind, trip: ApiTripRecord, preference: UserTravelPreference) => request<T>('/diagnoses', { method: 'POST', body: JSON.stringify({ kind, trip, preference }) }),
  };
}
