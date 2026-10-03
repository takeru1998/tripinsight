import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildDynamicImprovements,
  daysUntil,
  normalizeItineraryDates,
  tripScheduleLabel,
  validateTripRecord,
} from './tripLogic.ts';
import type { ValidatableTripRecord } from './tripLogic.ts';

const record: ValidatableTripRecord = {
  id: 'trip-1',
  travel: {
    id: 'trip-1',
    name: '京都旅行',
    startDate: '2026-10-10',
    endDate: '2026-10-11',
    origin: '東京',
    transport: '電車',
    companion: '友人',
    people: 2,
    budget: 80000,
    memo: '',
  },
  accommodation: {
    name: 'ホテル',
    location: '京都',
    price: 30000,
    checkIn: '15:00',
    checkOut: '10:00',
    dinner: '',
    breakfast: '',
    url: '',
    note: '',
  },
  itinerary: [
    {
      id: 'item-1',
      date: '2026-10-10',
      title: '移動',
      place: '京都駅',
      start: '10:00',
      end: '11:00',
      category: '移動',
      priority: 3,
      memo: '',
    },
  ],
  review: {
    hotelSatisfaction: 3,
    foodSatisfaction: 3,
    sightseeingSatisfaction: 3,
    transitFatigue: 3,
    scheduleAmount: 3,
    overallSatisfaction: 3,
    good: '',
    failed: '',
  },
};

void test('daysUntil uses the supplied current date', () => {
  assert.equal(daysUntil('2026-10-10', new Date(2026, 9, 2, 18)), 8);
});

void test('tripScheduleLabel distinguishes upcoming, active, and finished trips', () => {
  assert.equal(tripScheduleLabel(record, new Date(2026, 9, 2)), '出発まであと8日');
  assert.equal(tripScheduleLabel(record, new Date(2026, 9, 10)), '旅行中');
  assert.equal(tripScheduleLabel(record, new Date(2026, 9, 12)), '終了');
});

void test('normalizeItineraryDates migrates old itinerary data', () => {
  const migrated = normalizeItineraryDates(
    [{ ...record.itinerary[0], date: undefined }],
    '2026-10-10',
  );
  assert.equal(migrated[0].date, '2026-10-10');
});

void test('validateTripRecord rejects invalid dates and time ranges', () => {
  const errors = validateTripRecord({
    ...record,
    travel: { ...record.travel, endDate: '2026-10-09' },
    itinerary: [{ ...record.itinerary[0], end: '09:00' }],
  });
  assert.ok(errors.some((error) => error.includes('帰宅日')));
  assert.ok(errors.some((error) => error.includes('終了時間')));
});

void test('improvement minutes can be edited before applying an option', () => {
  const longVisit = {
    ...record.itinerary[0],
    id: 'sight-1',
    title: '美術館',
    category: '観光' as const,
    start: '10:00',
    end: '12:00',
  };
  const option = buildDynamicImprovements([longVisit], record.accommodation).find(
    (candidate) => candidate.id === 'shorten-sight-1',
  );
  assert.ok(option);
  assert.equal(option.defaultMinutes, 20);
  assert.equal(option.apply([longVisit], 35)[0].end, '11:25');
});
