import type { Accommodation, ItineraryItem, Travel, TravelReview } from '../types/tripcheck';

export type ValidatableTripRecord = {
  id: string;
  travel: Travel;
  accommodation: Accommodation;
  itinerary: ItineraryItem[];
  review: TravelReview;
};

export type ItineraryImprovementOption = {
  id: string;
  title: string;
  detail: string;
  defaultMinutes: number;
  minuteLabel: string;
  apply: (items: ItineraryItem[], minutes: number) => ItineraryItem[];
};

export function parseLocalDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }
  return date;
}

export function daysUntil(date: string, now = new Date()) {
  const target = parseLocalDate(date);
  if (!target) return null;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.max(0, Math.ceil((target.getTime() - today.getTime()) / 86_400_000));
}

export function tripScheduleLabel(record: ValidatableTripRecord, now = new Date()) {
  const startDate = parseLocalDate(record.travel.startDate);
  const endDate = parseLocalDate(record.travel.endDate || record.travel.startDate);
  if (!startDate || !endDate) return null;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (today > endDate) return '終了';
  if (today >= startDate) return '旅行中';
  return `出発まであと${daysUntil(record.travel.startDate, now)}日`;
}

export function tripDateTime(record: ValidatableTripRecord) {
  return parseLocalDate(record.travel.startDate)?.getTime() ?? Number.POSITIVE_INFINITY;
}

export function isCurrentOrFutureTrip(record: ValidatableTripRecord, now = new Date()) {
  const lastDate = parseLocalDate(record.travel.endDate || record.travel.startDate);
  if (!lastDate) return false;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return lastDate.getTime() >= today.getTime();
}

export function normalizeItineraryDates(
  items: Array<ItineraryItem | (Omit<ItineraryItem, 'date'> & { date?: string })>,
  fallbackDate: string,
): ItineraryItem[] {
  return items.map((item) => ({ ...item, date: item.date || fallbackDate }));
}

export function validateTripRecord(record: ValidatableTripRecord) {
  const errors: string[] = [];
  const { travel, accommodation, itinerary } = record;
  const startDate = parseLocalDate(travel.startDate);
  const endDate = parseLocalDate(travel.endDate);

  if (!travel.name.trim()) errors.push('旅行名を入力してください');
  if (!startDate) errors.push('正しい出発日を入力してください');
  if (!endDate) errors.push('正しい帰宅日を入力してください');
  if (startDate && endDate && endDate < startDate) {
    errors.push('帰宅日は出発日以降にしてください');
  }
  if (!travel.origin.trim()) errors.push('出発地を入力してください');
  if (!Number.isInteger(travel.people) || travel.people < 1) {
    errors.push('人数は1人以上で入力してください');
  }
  if (!Number.isFinite(travel.budget) || travel.budget < 0) {
    errors.push('旅行予算は0円以上で入力してください');
  }
  if (!Number.isFinite(accommodation.price) || accommodation.price < 0) {
    errors.push('宿泊料金は0円以上で入力してください');
  }

  itinerary.forEach((item, index) => {
    const label = item.title.trim() || `旅程${index + 1}`;
    const itemDate = parseLocalDate(item.date);
    if (!item.title.trim()) errors.push(`旅程${index + 1}のタイトルを入力してください`);
    if (!itemDate) {
      errors.push(`${label}の日付を入力してください`);
    } else if (startDate && endDate && (itemDate < startDate || itemDate > endDate)) {
      errors.push(`${label}の日付は旅行期間内にしてください`);
    }
    if (toMinutes(item.end) <= toMinutes(item.start)) {
      errors.push(`${label}の終了時間は開始時間より後にしてください`);
    }
  });

  const byDate = new Map<string, ItineraryItem[]>();
  itinerary.forEach((item) => {
    const rows = byDate.get(item.date) ?? [];
    rows.push(item);
    byDate.set(item.date, rows);
  });
  byDate.forEach((items, date) => {
    const sorted = [...items].sort((a, b) => toMinutes(a.start) - toMinutes(b.start));
    sorted.slice(1).forEach((item, index) => {
      if (toMinutes(item.start) < toMinutes(sorted[index].end)) {
        errors.push(`${date}の「${sorted[index].title}」と「${item.title}」の時間が重複しています`);
      }
    });
  });

  return [...new Set(errors)];
}

export function buildDynamicImprovements(
  itinerary: ItineraryItem[],
  accommodation: Accommodation,
): ItineraryImprovementOption[] {
  const options: ItineraryImprovementOption[] = [];
  const sorted = [...itinerary].sort(compareItinerary);

  for (let index = 1; index < sorted.length; index += 1) {
    const previous = sorted[index - 1];
    const current = sorted[index];
    if (previous.date !== current.date) continue;
    const gap = toMinutes(current.start) - toMinutes(previous.end);
    if (gap >= 30) continue;
    const newStart = Math.min(23 * 60 + 55, toMinutes(previous.end) + 30);
    options.push({
      id: `buffer-${current.id}`,
      title: `${current.title}の前に余裕を追加`,
      detail: `${previous.title}との間を30分確保し、${formatMinutes(newStart)}開始へ変更`,
      defaultMinutes: 30,
      minuteLabel: '予定間の余裕',
      apply: (items, minutes) =>
        items.map((item) =>
          item.id === current.id
            ? (() => {
                const duration = Math.max(5, toMinutes(item.end) - toMinutes(item.start));
                const adjustedStart = Math.min(
                  23 * 60 + 55,
                  toMinutes(previous.end) + normalizeMinutes(minutes),
                );
                return {
                  ...item,
                  start: formatMinutes(adjustedStart),
                  end: formatMinutes(adjustedStart + duration),
                };
              })()
            : item,
        ),
    });
    break;
  }

  const longSightseeing = sorted.find(
    (item) => item.category === '観光' && toMinutes(item.end) - toMinutes(item.start) > 100,
  );
  if (longSightseeing) {
    options.push({
      id: `shorten-${longSightseeing.id}`,
      title: `${longSightseeing.title}の滞在を調整`,
      detail: '滞在を20分短縮し、後続予定への余裕を作る',
      defaultMinutes: 20,
      minuteLabel: '短縮時間',
      apply: (items, minutes) =>
        items.map((item) =>
          item.id === longSightseeing.id
            ? {
                ...item,
                end: formatMinutes(
                  Math.max(
                    toMinutes(item.start) + 5,
                    toMinutes(item.end) - normalizeMinutes(minutes),
                  ),
                ),
              }
            : item,
        ),
    });
  }

  const checkIn = sorted.find((item) => item.category === '宿泊');
  if (checkIn && accommodation.dinner) {
    const dinner = toMinutes(accommodation.dinner);
    const checkInStart = toMinutes(checkIn.start);
    if (dinner > checkInStart && dinner - checkInStart < 60) {
      options.push({
        id: `checkin-${checkIn.id}`,
        title: '宿到着を前倒し',
        detail: `${accommodation.dinner}の夕食まで60分確保する`,
        defaultMinutes: 60,
        minuteLabel: '夕食までの余裕',
        apply: (items, minutes) =>
          items.map((item) =>
            item.id === checkIn.id
              ? (() => {
                  const duration = Math.max(5, toMinutes(item.end) - toMinutes(item.start));
                  const adjustedStart = Math.max(0, dinner - normalizeMinutes(minutes));
                  return {
                    ...item,
                    start: formatMinutes(adjustedStart),
                    end: formatMinutes(adjustedStart + duration),
                  };
                })()
              : item,
          ),
      });
    }
  }

  return options.slice(0, 3);
}

export function toMinutes(time: string) {
  const [hour = '0', minute = '0'] = time.split(':');
  return Number(hour) * 60 + Number(minute);
}

export function formatMinutes(value: number) {
  const minutes = Math.max(0, Math.min(23 * 60 + 55, value));
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}

function normalizeMinutes(value: number) {
  if (!Number.isFinite(value)) return 5;
  return Math.max(5, Math.min(180, Math.round(value / 5) * 5));
}

function compareItinerary(a: ItineraryItem, b: ItineraryItem) {
  return a.date.localeCompare(b.date) || toMinutes(a.start) - toMinutes(b.start);
}
