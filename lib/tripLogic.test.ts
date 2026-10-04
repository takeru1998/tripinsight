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
      departurePlace: '東京駅',
      arrivalPlace: '京都駅',
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
  const {
    departurePlace: _departurePlace,
    arrivalPlace: _arrivalPlace,
    ...legacyItem
  } = record.itinerary[0];
  const migrated = normalizeItineraryDates(
    [{ ...legacyItem, date: undefined }],
    '2026-10-10',
  );
  assert.equal(migrated[0].date, '2026-10-10');
  assert.equal(migrated[0].departurePlace, '京都駅');
});

void test('validateTripRecord requires numeric trip values and move locations', () => {
  const errors = validateTripRecord({
    ...record,
    travel: { ...record.travel, people: null, budget: null },
    itinerary: [
      { ...record.itinerary[0], departurePlace: '', arrivalPlace: '' },
    ],
  });
  assert.ok(errors.some((error) => error.includes('人数')));
  assert.ok(errors.some((error) => error.includes('旅行予算')));
  assert.ok(errors.some((error) => error.includes('出発場所')));
  assert.ok(errors.some((error) => error.includes('到着場所')));
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

void test('validateTripRecord requires itinerary place and times', () => {
  const errors = validateTripRecord({
    ...record,
    itinerary: [
      {
        ...record.itinerary[0],
        category: '観光',
        title: '展望台',
        place: '',
        start: '',
        end: '',
      },
    ],
  });
  assert.ok(errors.some((error) => error.includes('場所')));
  assert.ok(errors.some((error) => error.includes('開始時間')));
  assert.ok(errors.some((error) => error.includes('終了時間')));
});

void test('improvement applies the proposed time without manual editing', () => {
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
  assert.equal(option.apply([longVisit])[0].end, '11:40');
});
