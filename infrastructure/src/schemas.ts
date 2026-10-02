import { z } from 'zod';

const preferenceKeys = [
  'onsen', 'food', 'views', 'quiet', 'smallHotel', 'shortTransit',
  'valueSatisfaction', 'manySights', 'slowTravel', 'carTolerance',
  'crowdSensitive', 'lateRiser',
] as const;

const preferenceValue = z.number().int().min(1).max(5);

export const preferenceSchema = z.object(
  Object.fromEntries(preferenceKeys.map((key) => [key, preferenceValue])) as Record<
    (typeof preferenceKeys)[number],
    typeof preferenceValue
  >,
);

export const accommodationSchema = z.object({
  name: z.string().max(200),
  location: z.string().max(300),
  price: z.number().nonnegative(),
  checkIn: z.string().max(20),
  checkOut: z.string().max(20),
  dinner: z.string().max(20),
  breakfast: z.string().max(20),
  url: z.string().max(2000),
  note: z.string().max(5000),
});

export const itineraryItemSchema = z.object({
  id: z.string().min(1).max(100),
  date: z.string().max(20).optional().default(''),
  title: z.string().min(1).max(200),
  place: z.string().max(300),
  start: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  end: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  category: z.enum(['移動', '食事', '観光', '温泉', '宿泊', '休憩', 'その他']),
  transportMode: z.enum(['車', '電車', '飛行機', '徒歩', 'バス', 'タクシー', 'その他']).optional(),
  priority: z.number().int().min(1).max(5),
  memo: z.string().max(5000),
});

export const reviewSchema = z.object({
  hotelSatisfaction: preferenceValue,
  foodSatisfaction: preferenceValue,
  sightseeingSatisfaction: preferenceValue,
  transitFatigue: preferenceValue,
  scheduleAmount: preferenceValue,
  overallSatisfaction: preferenceValue,
  good: z.string().max(5000),
  failed: z.string().max(5000),
});

export const travelSchema = z.object({
  id: z.string().min(1).max(100),
  name: z.string().min(1).max(200),
  startDate: z.string().max(20),
  endDate: z.string().max(20),
  origin: z.string().max(300),
  transport: z.enum(['車', '電車', '飛行機', 'その他']),
  companion: z.enum(['一人', 'カップル', '夫婦', '友人', '家族']),
  people: z.number().int().min(1).max(100),
  budget: z.number().nonnegative(),
  memo: z.string().max(5000),
}).superRefine((travel, context) => {
  if (travel.startDate && travel.endDate && travel.endDate < travel.startDate) {
    context.addIssue({
      code: 'custom',
      path: ['endDate'],
      message: 'endDate must be on or after startDate',
    });
  }
});

export const tripRecordSchema = z.object({
  id: z.string().min(1).max(100),
  travel: travelSchema,
  accommodation: accommodationSchema,
  itinerary: z.array(itineraryItemSchema).max(200),
  review: reviewSchema,
}).superRefine((record, context) => {
  record.itinerary.forEach((item, index) => {
    if (item.end <= item.start) {
      context.addIssue({
        code: 'custom',
        path: ['itinerary', index, 'end'],
        message: 'end must be after start',
      });
    }
    if (
      item.date &&
      record.travel.startDate &&
      record.travel.endDate &&
      (item.date < record.travel.startDate || item.date > record.travel.endDate)
    ) {
      context.addIssue({
        code: 'custom',
        path: ['itinerary', index, 'date'],
        message: 'date must be within the travel period',
      });
    }
  });
});

export const diagnosisRequestSchema = z.object({
  kind: z.enum(['hotel', 'itinerary', 'risk', 'summary']),
  trip: tripRecordSchema,
  preference: preferenceSchema,
});

export type TripRecordInput = z.infer<typeof tripRecordSchema>;
export type DiagnosisRequest = z.infer<typeof diagnosisRequestSchema>;
