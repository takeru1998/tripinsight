export type PreferenceKey =
  | 'onsen'
  | 'food'
  | 'views'
  | 'quiet'
  | 'smallHotel'
  | 'shortTransit'
  | 'valueSatisfaction'
  | 'manySights'
  | 'slowTravel'
  | 'carTolerance'
  | 'crowdSensitive'
  | 'lateRiser';

export type UserTravelPreference = Record<PreferenceKey, number>;

export type Travel = {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  origin: string;
  transport: '車' | '電車' | '飛行機' | 'その他';
  companion: '一人' | 'カップル' | '夫婦' | '友人' | '家族';
  people: number;
  budget: number;
  memo: string;
};

export type Accommodation = {
  name: string;
  location: string;
  price: number;
  checkIn: string;
  checkOut: string;
  dinner: string;
  breakfast: string;
  url: string;
  note: string;
};

export type ItineraryItem = {
  id: string;
  title: string;
  place: string;
  start: string;
  end: string;
  category:
    | '移動'
    | '食事'
    | '観光'
    | '温泉'
    | '宿泊'
    | '休憩'
    | 'その他';
  priority: number;
  memo: string;
};

export type ScoreMap = Record<string, number>;

export type TravelDiagnosis = {
  score: number;
  categoryScores: ScoreMap;
  issues: string[];
  recommendations: string[];
};

export type RiskDiagnosis = {
  riskPercent: number;
  categoryRisks: ScoreMap;
  critical: string;
  warnings: string[];
};

export type HotelCompatibilityDiagnosis = {
  score: number;
  categoryScores: ScoreMap;
  reasons: string[];
  regretPoints: string[];
};

export type TravelReview = {
  hotelSatisfaction: number;
  foodSatisfaction: number;
  sightseeingSatisfaction: number;
  transitFatigue: number;
  scheduleAmount: number;
  overallSatisfaction: number;
  good: string;
  failed: string;
};
