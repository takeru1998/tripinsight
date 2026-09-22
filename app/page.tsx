'use client';

import {
  AlertTriangle,
  Bed,
  CalendarDays,
  Check,
  ChevronRight,
  CloudDownload,
  CloudRain,
  CloudUpload,
  ClipboardList,
  CreditCard,
  Eye,
  ListFilter,
  LogIn,
  LogOut,
  MailCheck,
  MapPin,
  Pencil,
  Plus,
  RotateCcw,
  Route,
  Save,
  ShieldAlert,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  TimerReset,
  Trash2,
  Train,
  Umbrella,
  UserPlus,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Textarea } from '@/components/ui/textarea';
import {
  mockAccommodation,
  mockItinerary,
  mockPreference,
  mockReview,
  mockTravel,
} from '@/data/mockTrip';
import { mockAiProvider } from '@/services/ai/mockProvider';
import { createTripCheckApi } from '@/services/api/tripcheckApi';
import {
  confirmSignUp,
  getAccessToken,
  getCurrentUserEmail,
  signIn,
  signOut,
  signUp,
} from '@/services/auth/cognitoAuth';
import { awsConfig } from '@/services/aws/config';
import type {
  Accommodation,
  ItineraryItem,
  PreferenceKey,
  RiskDiagnosis,
  Travel,
  TravelReview,
  UserTravelPreference,
} from '@/types/tripcheck';

type TripCheckState = {
  preference: UserTravelPreference;
  travel: Travel;
  accommodation: Accommodation;
  itinerary: ItineraryItem[];
  review: TravelReview;
  trips?: TripRecord[];
  selectedTripId?: string | null;
  riskDetailTripId?: string | null;
  detailTripId?: string | null;
  riskPlanTripId?: string | null;
};

type TripRecord = {
  id: string;
  travel: Travel;
  accommodation: Accommodation;
  itinerary: ItineraryItem[];
  review: TravelReview;
};

type TripListFilter = 'all' | 'attention' | 'missing';
type TripListSort = 'date' | 'risk';
type AuthMode = 'signin' | 'signup' | 'confirm';

const storageKey = 'tripcheck-mvp-state-v1';

const emptyTravel: Travel = {
  id: '',
  name: '',
  startDate: '',
  endDate: '',
  origin: '',
  transport: '電車',
  companion: '一人',
  people: 1,
  budget: 0,
  memo: '',
};

const emptyAccommodation: Accommodation = {
  name: '',
  location: '',
  price: 0,
  checkIn: '',
  checkOut: '',
  dinner: '',
  breakfast: '',
  url: '',
  note: '',
};

const emptyReview: TravelReview = {
  hotelSatisfaction: 3,
  foodSatisfaction: 3,
  sightseeingSatisfaction: 3,
  transitFatigue: 3,
  scheduleAmount: 3,
  overallSatisfaction: 3,
  good: '',
  failed: '',
};

const mockTrips: TripRecord[] = [
  {
    id: mockTravel.id,
    travel: mockTravel,
    accommodation: mockAccommodation,
    itinerary: mockItinerary,
    review: mockReview,
  },
  {
    id: 'travel-hakone-002',
    travel: {
      ...mockTravel,
      id: 'travel-hakone-002',
      name: '箱根温泉リセット旅',
      startDate: '2026-10-05',
      endDate: '2026-10-06',
      origin: '新宿駅',
      transport: '電車',
      companion: 'カップル',
      budget: 76000,
      memo: '移動を少なめにして温泉中心にしたい。',
    },
    accommodation: {
      ...mockAccommodation,
      name: '箱根 静庭の湯',
      location: '神奈川県足柄下郡箱根町',
    },
    itinerary: [],
    review: emptyReview,
  },
  {
    id: 'travel-kyoto-003',
    travel: {
      ...mockTravel,
      id: 'travel-kyoto-003',
      name: '京都ゆっくり紅葉旅',
      startDate: '2026-11-18',
      endDate: '2026-11-20',
      origin: '品川駅',
      transport: '電車',
      companion: '友人',
      people: 3,
      budget: 140000,
      memo: '混雑を避けつつ紅葉と食事を楽しみたい。',
    },
    accommodation: {
      ...mockAccommodation,
      name: '東山 小径ホテル',
      location: '京都府京都市東山区',
      dinner: '',
    },
    itinerary: [],
    review: emptyReview,
  },
];

const preferenceLabels: Record<PreferenceKey, string> = {
  onsen: '温泉',
  food: '食事',
  views: '景色',
  quiet: '静けさ',
  smallHotel: '大型ホテルが苦手',
  shortTransit: '移動は短め',
  valueSatisfaction: '満足度優先',
  manySights: '観光量',
  slowTravel: 'ゆっくり旅行',
  carTolerance: '車移動許容',
  crowdSensitive: '人混みが苦手',
  lateRiser: '早起きが苦手',
};

const tabs = [
  'ホーム',
  '旅行登録',
  '宿診断',
  'リスク診断',
  'カルテ',
  'プラン',
  'プロフィール',
];

const timeOptions = Array.from({ length: 24 * 12 }, (_, index) => {
  const hour = Math.floor(index / 12);
  const minute = (index % 12) * 5;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
});

const itineraryCategoryOptions: ItineraryItem['category'][] = [
  '移動',
  '食事',
  '観光',
  '温泉',
  '宿泊',
  '休憩',
  'その他',
];

const transportModeOptions: NonNullable<ItineraryItem['transportMode']>[] = [
  '車',
  '電車',
  '飛行機',
  '徒歩',
  'バス',
  'タクシー',
  'その他',
];

type ItineraryImprovementId =
  | 'cafe-time'
  | 'kiyotsukyo-stay'
  | 'early-checkin';

const itineraryImprovementOptions: Array<{
  id: ItineraryImprovementId;
  title: string;
  detail: string;
  apply: (item: ItineraryItem) => ItineraryItem;
}> = [
  {
    id: 'cafe-time',
    title: 'カフェ時間を調整',
    detail: 'カフェを15:30から15:05へ変更し、滞在を短縮',
    apply: (item) =>
      item.title === '温泉街カフェ'
        ? { ...item, start: '15:05', end: '15:45' }
        : item,
  },
  {
    id: 'kiyotsukyo-stay',
    title: '観光滞在を短縮',
    detail: '清津峡の滞在を90分から70分へ変更',
    apply: (item) =>
      item.title === '清津峡' ? { ...item, end: '14:50' } : item,
  },
  {
    id: 'early-checkin',
    title: '宿到着を前倒し',
    detail: '宿到着予定を16:30へ前倒し',
    apply: (item) =>
      item.title === '旅館チェックイン'
        ? { ...item, start: '16:30', end: '16:50' }
        : item,
  },
];

const reviewMetrics: Array<{
  label: string;
  key: keyof Pick<
    TravelReview,
    | 'hotelSatisfaction'
    | 'foodSatisfaction'
    | 'sightseeingSatisfaction'
    | 'transitFatigue'
    | 'scheduleAmount'
    | 'overallSatisfaction'
  >;
}> = [
  { label: '宿満足度', key: 'hotelSatisfaction' },
  { label: '食事満足度', key: 'foodSatisfaction' },
  { label: '観光満足度', key: 'sightseeingSatisfaction' },
  { label: '移動疲労', key: 'transitFatigue' },
  { label: '予定量', key: 'scheduleAmount' },
  { label: '総合満足度', key: 'overallSatisfaction' },
];

function currency(value: number) {
  return new Intl.NumberFormat('ja-JP').format(value);
}

function daysUntil(date: string) {
  if (!date) return null;
  const now = new Date('2026-09-13T00:00:00-07:00');
  const target = new Date(`${date}T00:00:00-07:00`);
  if (Number.isNaN(target.getTime())) return null;
  return Math.max(
    0,
    Math.ceil((target.getTime() - now.getTime()) / 86_400_000),
  );
}

function tripDateTime(record: TripRecord) {
  if (!record.travel.startDate) return Number.POSITIVE_INFINITY;
  const target = new Date(`${record.travel.startDate}T00:00:00-07:00`);
  return Number.isNaN(target.getTime())
    ? Number.POSITIVE_INFINITY
    : target.getTime();
}

function clampPercent(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function toMinutes(time: string) {
  const [hour = '0', minute = '0'] = time.split(':');
  return Number(hour) * 60 + Number(minute);
}

function countTightGaps(itineraryItems: ItineraryItem[]) {
  return itineraryItems.slice(1).filter((item, index) => {
    const previous = itineraryItems[index];
    return toMinutes(item.start) - toMinutes(previous.end) < 25;
  }).length;
}

function scoreTone(score: number) {
  if (score >= 85) return 'text-emerald-700';
  if (score >= 70) return 'text-teal-700';
  return 'text-amber-700';
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label className="text-xs font-medium text-slate-600">{children}</label>;
}

function SelectField({
  value,
  options,
  onChange,
  label,
}: {
  value: string;
  options: string[];
  onChange: (value: string) => void;
  label: string;
}) {
  return (
    <select
      aria-label={label}
      className="h-9 w-full rounded-lg border border-input bg-background px-2 text-sm outline-none transition focus-visible:ring-3 focus-visible:ring-ring/50"
      onChange={(event) => onChange(event.target.value)}
      value={value}
    >
      {options.map((option) => (
        <option key={option} value={option}>
          {option}
        </option>
      ))}
    </select>
  );
}

function TimeSelect({
  value,
  onChange,
  label,
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
}) {
  return (
    <select
      aria-label={label}
      className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none transition focus-visible:ring-3 focus-visible:ring-ring/50"
      onChange={(event) => onChange(event.target.value)}
      value={value}
    >
      {timeOptions.map((time) => (
        <option key={time} value={time}>
          {time}
        </option>
      ))}
    </select>
  );
}

function priorityColor(level: number) {
  if (level <= 1) return 'bg-slate-300';
  if (level === 2) return 'bg-teal-300';
  if (level === 3) return 'bg-teal-500';
  if (level === 4) return 'bg-emerald-600';
  return 'bg-amber-500';
}

function priorityLabel(level: number) {
  return ['低め', '控えめ', '標準', '高め', '最優先'][level - 1];
}

function PriorityControl({
  value,
  onChange,
  label,
}: {
  value: number;
  onChange: (value: number) => void;
  label: string;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium text-slate-600">優先度</span>
        <span className="rounded-full bg-emerald-50 px-2 py-0.5 font-semibold text-emerald-800">
          {value} / {priorityLabel(value)}
        </span>
      </div>
      <div
        aria-label={label}
        className="grid grid-cols-5 gap-1.5"
        role="radiogroup"
      >
        {[1, 2, 3, 4, 5].map((level) => (
          <button
            aria-checked={value === level}
            aria-label={`優先度${level}`}
            className={`h-8 rounded-md border transition ${
              level <= value
                ? `${priorityColor(level)} border-transparent shadow-sm`
                : 'border-slate-200 bg-slate-50'
            } ${value === level ? 'ring-2 ring-emerald-900/20' : ''}`}
            key={level}
            onClick={() => onChange(level)}
            role="radio"
            type="button"
          >
            <span
              className={`text-xs font-semibold ${
                level <= value ? 'text-white' : 'text-slate-400'
              }`}
            >
              {level}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

function ScoreCard({
  title,
  value,
  icon: Icon,
  caption,
}: {
  title: string;
  value: number;
  icon: React.ElementType;
  caption: string;
}) {
  return (
    <Card className="rounded-lg border-emerald-950/10 bg-white shadow-sm">
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm font-medium text-slate-600">
            <Icon className="size-4 text-teal-700" />
            {title}
          </div>
          <span className={`text-2xl font-semibold ${scoreTone(value)}`}>
            {value}
          </span>
        </div>
        <Progress value={value} className="h-2" />
        <p className="text-xs leading-relaxed text-slate-500">{caption}</p>
      </CardContent>
    </Card>
  );
}

function MiniBar({ label, value }: { label: string; value: number }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-3 text-xs">
        <span className="text-slate-600">{label}</span>
        <span className="font-medium text-slate-800">{value}</span>
      </div>
      <Progress value={value} className="h-1.5" />
    </div>
  );
}

function riskTone(percent: number) {
  if (percent >= 70) {
    return {
      label: '高リスク',
      badge: 'bg-rose-100 text-rose-800',
      bar: 'bg-rose-500',
      text: 'text-rose-700',
    };
  }
  if (percent >= 50) {
    return {
      label: '注意',
      badge: 'bg-amber-100 text-amber-800',
      bar: 'bg-amber-500',
      text: 'text-amber-700',
    };
  }
  return {
    label: '低リスク',
    badge: 'bg-emerald-100 text-emerald-800',
    bar: 'bg-emerald-600',
    text: 'text-emerald-700',
  };
}

function topRiskLabel(risk: RiskDiagnosis) {
  const [label, value] = Object.entries(risk.categoryRisks).sort(
    (a, b) => b[1] - a[1],
  )[0] ?? ['未判定', 0];
  return `${label} ${value}`;
}

function buildContextualRisk(record: TripRecord): RiskDiagnosis {
  const outdoorPlans = record.itinerary.filter(
    (item) => item.category === '観光',
  ).length;
  const movePlans = record.itinerary.filter((item) => item.category === '移動');
  const mealPlans = record.itinerary.filter((item) => item.category === '食事');
  const tightGaps = countTightGaps(record.itinerary);
  const hasAccommodation = Boolean(record.accommodation.name);
  const hasDinner = Boolean(record.accommodation.dinner);
  const hasMemo = Boolean(record.travel.memo);
  const isCar = record.travel.transport === '車';
  const base = 26 + outdoorPlans * 8 + tightGaps * 7 + movePlans.length * 3;
  const riskPercent = clampPercent(
    base +
      (isCar ? 10 : 0) +
      (!hasAccommodation ? 12 : 0) +
      (!hasDinner ? 6 : 0) +
      (!hasMemo ? 4 : 0),
  );
  const primaryPlace =
    record.itinerary.find((item) => item.category === '観光')?.place ||
    record.accommodation.location ||
    record.travel.origin ||
    '旅行先';

  const warnings = [
    tightGaps > 0
      ? `予定間の余裕が短い箇所が${tightGaps}件あります。移動や待ち時間が伸びると後続予定に響きます`
      : '予定間の余裕は大きく崩れていませんが、人気エリアでは待ち時間を見込むと安心です',
    mealPlans.length === 0
      ? '食事予定が未登録です。昼食・夕食の候補がないと当日の混雑に弱くなります'
      : '食事予定はあります。混雑時の第2候補まで決めると満足度が安定します',
    hasAccommodation
      ? `${record.accommodation.name}のチェックイン条件と到着予定の整合性を確認してください`
      : '宿情報が未登録です。チェックイン時間、食事時間、送迎条件の診断精度が下がります',
  ];

  if (isCar) {
    warnings.push('車移動のため、渋滞・駐車場満車・給油タイミングを事前に見ておく必要があります');
  } else {
    warnings.push(`${record.travel.transport}移動のため、遅延時の代替便や乗換余裕を確認してください`);
  }

  return {
    riskPercent,
    categoryRisks: {
      天候リスク: clampPercent(34 + outdoorPlans * 12),
      渋滞リスク: clampPercent(isCar ? 58 + movePlans.length * 5 : 20),
      食事リスク: clampPercent(mealPlans.length ? 34 : 62),
      駐車場リスク: clampPercent(isCar ? 56 : 12),
      営業時間リスク: clampPercent(36 + (record.itinerary.length ? 4 : 18)),
      遅延リスク: clampPercent(32 + tightGaps * 12 + movePlans.length * 4),
      疲労リスク: clampPercent(34 + record.itinerary.length * 5),
    },
    critical:
      outdoorPlans > 0
        ? `${primaryPlace}周辺の屋外予定は天候と混雑の影響を受けやすいです。午前寄せか屋内代替を用意すると安全です。`
        : `${primaryPlace}周辺は大きな屋外予定が少ないため、交通遅延と食事候補の不足を重点的に確認してください。`,
    warnings,
  };
}

function buildAvoidancePlans(record: TripRecord, risk: RiskDiagnosis) {
  const plans = [
    `${record.travel.transport}移動は、出発前日の夜に遅延・運休・渋滞情報を確認し、30分早い代替ルートを1つ控える`,
    '屋外予定は午前寄せ、雨天時は屋内施設・宿ラウンジ・駅周辺散策へ切り替える',
    '昼食や人気店は第2候補まで決め、混雑時は予約済み/回転の早い店へ移す',
  ];

  if (record.accommodation.dinner) {
    plans.push(
      `${record.accommodation.dinner}の夕食に対して、宿到着は少なくとも60分前を目標にする`,
    );
  }
  if (risk.categoryRisks.駐車場リスク >= 40) {
    plans.push('駐車場は満車時の近隣候補と支払い方法を事前に確認する');
  }
  if (record.itinerary.length >= 4) {
    plans.push('優先度が低い予定を1つ「削る候補」にして、当日の疲労で即調整できるようにする');
  }

  return plans;
}

function buildNextActions(record: TripRecord | null, risk: RiskDiagnosis) {
  if (!record) {
    return ['旅行を1件登録して、宿・旅程・リスクをまとめて診断する'];
  }

  const actions = [];
  if (!record.accommodation.name) {
    actions.push('宿泊先を登録して、チェックイン・食事時間のリスクを確認する');
  }
  if (record.itinerary.length === 0) {
    actions.push('旅程を1件以上追加して、移動時間と疲労リスクを診断する');
  }
  if (risk.categoryRisks.食事リスク >= 50) {
    actions.push('昼食・夕食の第2候補を追加して、混雑時の迷いを減らす');
  }
  if (risk.categoryRisks.天候リスク >= 50) {
    actions.push('雨天時の屋内代替案を1つ登録する');
  }
  if (risk.categoryRisks.遅延リスク >= 45) {
    actions.push('移動予定に30分の予備時間を確保する');
  }

  return actions.slice(0, 3);
}

function buildRiskChecks(record: TripRecord) {
  return [
    {
      label: '前日18時',
      title: '天気と服装',
      text: '雨量・気温差・傘や防寒具の要否を確認',
    },
    {
      label: '当日朝',
      title: '交通状況',
      text: `${record.travel.transport}の遅延、道路混雑、乗換余裕を確認`,
    },
    {
      label: '3日前',
      title: '予約と営業時間',
      text: '食事・観光・送迎・チェックイン条件を再確認',
    },
    {
      label: '出発前',
      title: 'キャンセル条件',
      text: '宿・体験・交通の締切と連絡先を控える',
    },
  ];
}

function errorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === 'object' && error && 'message' in error) {
    return String(error.message);
  }
  return '処理に失敗しました。時間をおいてもう一度お試しください。';
}

export default function Home() {
  const [activeTab, setActiveTab] = useState('ホーム');
  const [preference, setPreference] =
    useState<UserTravelPreference>(mockPreference);
  const [travel, setTravel] = useState<Travel>(mockTravel);
  const [accommodation, setAccommodation] =
    useState<Accommodation>(mockAccommodation);
  const [itinerary, setItinerary] = useState<ItineraryItem[]>(mockItinerary);
  const [review, setReview] = useState<TravelReview>(mockReview);
  const [trips, setTrips] = useState<TripRecord[]>(mockTrips);
  const [selectedTripId, setSelectedTripId] = useState<string | null>(
    mockTravel.id,
  );
  const [riskDetailTripId, setRiskDetailTripId] = useState<string | null>(
    mockTravel.id,
  );
  const [detailTripId, setDetailTripId] = useState<string | null>(mockTravel.id);
  const [riskPlanTripId, setRiskPlanTripId] = useState<string | null>(null);
  const [detailReturnTab, setDetailReturnTab] = useState('ホーム');
  const [tripFilter, setTripFilter] = useState<TripListFilter>('all');
  const [tripSort, setTripSort] = useState<TripListSort>('date');
  const [improved, setImproved] = useState(false);
  const [previousItinerary, setPreviousItinerary] = useState<
    ItineraryItem[] | null
  >(null);
  const [selectedImprovementId, setSelectedImprovementId] =
    useState<ItineraryImprovementId | null>(null);
  const [saveState, setSaveState] = useState('端末内に自動保存');
  const [authMode, setAuthMode] = useState<AuthMode>('signin');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authCode, setAuthCode] = useState('');
  const [authUserEmail, setAuthUserEmail] = useState<string | null>(null);
  const [authBusy, setAuthBusy] = useState(false);
  const [authMessage, setAuthMessage] = useState('');
  const cloudApi = useMemo(
    () => createTripCheckApi({ baseUrl: awsConfig.apiUrl, getAccessToken }),
    [],
  );

  useEffect(() => {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return;

    try {
      const stored = JSON.parse(raw) as Partial<TripCheckState>;
      if (stored.preference) setPreference(stored.preference);
      if (stored.travel) setTravel(stored.travel);
      if (stored.accommodation) setAccommodation(stored.accommodation);
      if (stored.itinerary) setItinerary(stored.itinerary);
      if (stored.review) setReview(stored.review);
      if (stored.trips?.length) setTrips(stored.trips);
      if ('selectedTripId' in stored) {
        setSelectedTripId(stored.selectedTripId ?? null);
      }
      if ('riskDetailTripId' in stored) {
        setRiskDetailTripId(stored.riskDetailTripId ?? null);
      }
      if ('detailTripId' in stored) {
        setDetailTripId(stored.detailTripId ?? null);
      }
      if ('riskPlanTripId' in stored) {
        setRiskPlanTripId(stored.riskPlanTripId ?? null);
      }
      setSaveState('保存済みデータを読み込みました');
    } catch {
      setSaveState('保存データを読み込めませんでした');
    }
  }, []);

  useEffect(() => {
    getCurrentUserEmail().then((email) => setAuthUserEmail(email ?? null));
  }, []);

  useEffect(() => {
    const state: TripCheckState = {
      preference,
      travel,
      accommodation,
      itinerary,
      review,
      trips,
      selectedTripId,
      riskDetailTripId,
      detailTripId,
      riskPlanTripId,
    };
    window.localStorage.setItem(storageKey, JSON.stringify(state));
  }, [
    preference,
    travel,
    accommodation,
    itinerary,
    review,
    trips,
    selectedTripId,
    riskDetailTripId,
    detailTripId,
    riskPlanTripId,
  ]);

  const hotelDiagnosis = useMemo(
    () => mockAiProvider.diagnoseHotel(preference, accommodation),
    [preference, accommodation],
  );
  const itineraryDiagnosis = useMemo(
    () => mockAiProvider.judgeItinerary(travel, accommodation, itinerary),
    [travel, accommodation, itinerary],
  );
  const riskDetailTrip = useMemo(
    () =>
      trips.find((trip) => trip.id === riskDetailTripId) ?? trips[0] ?? null,
    [trips, riskDetailTripId],
  );
  const riskDetailDiagnosis = useMemo(
    () => (riskDetailTrip ? buildContextualRisk(riskDetailTrip) : null),
    [riskDetailTrip],
  );
  const riskDetailPlans = useMemo(
    () =>
      riskDetailTrip && riskDetailDiagnosis
        ? buildAvoidancePlans(riskDetailTrip, riskDetailDiagnosis)
        : [],
    [riskDetailTrip, riskDetailDiagnosis],
  );
  const riskDetailChecks = useMemo(
    () => (riskDetailTrip ? buildRiskChecks(riskDetailTrip) : []),
    [riskDetailTrip],
  );
  const nearestTrip = useMemo(() => {
    const now = new Date('2026-09-13T00:00:00-07:00').getTime();
    const futureTrips = trips
      .filter((trip) => tripDateTime(trip) >= now)
      .sort((a, b) => tripDateTime(a) - tripDateTime(b));
    return futureTrips[0] ?? trips[0] ?? null;
  }, [trips]);
  const detailTrip = useMemo(
    () =>
      trips.find((trip) => trip.id === detailTripId) ??
      trips.find((trip) => trip.id === selectedTripId) ??
      nearestTrip ??
      null,
    [trips, detailTripId, selectedTripId, nearestTrip],
  );
  const detailRiskDiagnosis = useMemo(
    () => (detailTrip ? buildContextualRisk(detailTrip) : null),
    [detailTrip],
  );
  const detailHotelDiagnosis = useMemo(
    () =>
      detailTrip
        ? mockAiProvider.diagnoseHotel(preference, detailTrip.accommodation)
        : null,
    [preference, detailTrip],
  );
  const detailItineraryDiagnosis = useMemo(
    () =>
      detailTrip
        ? mockAiProvider.judgeItinerary(
            detailTrip.travel,
            detailTrip.accommodation,
            detailTrip.itinerary,
          )
        : null,
    [detailTrip],
  );
  const detailAvoidancePlans = useMemo(
    () =>
      detailTrip && detailRiskDiagnosis
        ? buildAvoidancePlans(detailTrip, detailRiskDiagnosis).slice(0, 3)
        : [],
    [detailTrip, detailRiskDiagnosis],
  );
  const topTravel = nearestTrip?.travel ?? travel;
  const topAccommodation = nearestTrip?.accommodation ?? accommodation;
  const topItinerary = nearestTrip?.itinerary ?? itinerary;
  const topHotelDiagnosis = useMemo(
    () => mockAiProvider.diagnoseHotel(preference, topAccommodation),
    [preference, topAccommodation],
  );
  const topItineraryDiagnosis = useMemo(
    () =>
      mockAiProvider.judgeItinerary(topTravel, topAccommodation, topItinerary),
    [topTravel, topAccommodation, topItinerary],
  );
  const topRiskDiagnosis = useMemo(
    () =>
      buildContextualRisk({
        id: nearestTrip?.id ?? 'top',
        travel: topTravel,
        accommodation: topAccommodation,
        itinerary: topItinerary,
        review: nearestTrip?.review ?? review,
      }),
    [nearestTrip, topTravel, topAccommodation, topItinerary, review],
  );
  const nextActions = useMemo(
    () => buildNextActions(nearestTrip, topRiskDiagnosis),
    [nearestTrip, topRiskDiagnosis],
  );
  const displayedTrips = useMemo(() => {
    const rows = trips.map((trip) => ({
      trip,
      risk: buildContextualRisk(trip),
      missing:
        !trip.travel.startDate ||
        !trip.travel.endDate ||
        !trip.accommodation.name ||
        trip.itinerary.length === 0,
    }));
    return rows
      .filter(({ risk, missing }) => {
        if (tripFilter === 'attention') return risk.riskPercent >= 50;
        if (tripFilter === 'missing') return missing;
        return true;
      })
      .sort((a, b) => {
        if (tripSort === 'risk') return b.risk.riskPercent - a.risk.riskPercent;
        return tripDateTime(a.trip) - tripDateTime(b.trip);
      });
  }, [trips, tripFilter, tripSort]);
  const remainingDays = daysUntil(topTravel.startDate);
  function updatePreference(key: PreferenceKey, value: number) {
    setPreference((current) => ({ ...current, [key]: value }));
  }

  async function submitAuth() {
    setAuthBusy(true);
    setAuthMessage('');
    try {
      if (authMode === 'signup') {
        await signUp(authEmail.trim(), authPassword);
        setAuthMode('confirm');
        setAuthMessage('確認コードをメールへ送信しました');
      } else if (authMode === 'confirm') {
        await confirmSignUp(authEmail.trim(), authCode.trim());
        setAuthMode('signin');
        setAuthCode('');
        setAuthMessage('メール確認が完了しました。ログインしてください');
      } else {
        await signIn(authEmail.trim(), authPassword);
        setAuthUserEmail(authEmail.trim());
        setAuthPassword('');
        setAuthMessage('ログインしました');
      }
    } catch (error) {
      setAuthMessage(errorMessage(error));
    } finally {
      setAuthBusy(false);
    }
  }

  function logoutFromAws() {
    signOut();
    setAuthUserEmail(null);
    setAuthMessage('ログアウトしました');
  }

  async function saveAllToAws() {
    setAuthBusy(true);
    setAuthMessage('');
    try {
      await cloudApi.saveProfile(preference);
      await Promise.all(trips.map((trip) => cloudApi.saveTrip(trip)));
      setAuthMessage(`${trips.length}件の旅行をAWSへ保存しました`);
    } catch (error) {
      setAuthMessage(errorMessage(error));
    } finally {
      setAuthBusy(false);
    }
  }

  async function loadAllFromAws() {
    setAuthBusy(true);
    setAuthMessage('');
    try {
      const [storedPreference, storedTrips] = await Promise.all([
        cloudApi.getProfile(),
        cloudApi.listTrips(),
      ]);
      setPreference(storedPreference);
      setTrips(storedTrips.items);
      const firstTrip = storedTrips.items[0];
      if (firstTrip) editTrip(firstTrip);
      setAuthMessage(`${storedTrips.items.length}件の旅行をAWSから読み込みました`);
    } catch (error) {
      setAuthMessage(errorMessage(error));
    } finally {
      setAuthBusy(false);
    }
  }

  function updateItinerary(id: string, patch: Partial<ItineraryItem>) {
    setItinerary((items) =>
      items.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    );
  }

  function addItineraryItem() {
    setItinerary((items) => [
      ...items,
      {
        id: `i${Date.now()}`,
        title: '新しい予定',
        place: '',
        start: '10:00',
        end: '11:00',
        category: '観光',
        transportMode: '電車',
        priority: 3,
        memo: '',
      },
    ]);
    setActiveTab('旅行登録');
  }

  function removeItineraryItem(id: string) {
    setItinerary((items) => items.filter((item) => item.id !== id));
  }

  function resetDemo() {
    setPreference(mockPreference);
    setTravel(mockTravel);
    setAccommodation(mockAccommodation);
    setItinerary(mockItinerary);
    setReview(mockReview);
    setTrips(mockTrips);
    setSelectedTripId(mockTravel.id);
    setRiskDetailTripId(mockTravel.id);
    setDetailTripId(mockTravel.id);
    setRiskPlanTripId(null);
    setImproved(false);
    setPreviousItinerary(null);
    setSelectedImprovementId(null);
    setSaveState('モック旅行に戻しました');
  }

  function startNewTrip() {
    setTravel({
      ...emptyTravel,
      id: `travel-${Date.now()}`,
    });
    setAccommodation(emptyAccommodation);
    setItinerary([]);
    setReview(emptyReview);
    setSelectedTripId(null);
    setRiskDetailTripId(null);
    setDetailTripId(null);
    setRiskPlanTripId(null);
    setPreviousItinerary(null);
    setSelectedImprovementId(null);
    setImproved(false);
    setActiveTab('旅行登録');
    setSaveState('新規旅行を作成中');
  }

  function saveCurrentTrip() {
    const id = selectedTripId || travel.id || `travel-${Date.now()}`;
    const savedTravel = {
      ...travel,
      id,
      name: travel.name || '名称未設定の旅行',
    };
    const record: TripRecord = {
      id,
      travel: savedTravel,
      accommodation,
      itinerary,
      review,
    };

    setTravel(savedTravel);
    setSelectedTripId(id);
    setRiskDetailTripId(id);
    setDetailTripId(id);
    setTrips((items) => {
      const exists = items.some((item) => item.id === id);
      if (exists) {
        return items.map((item) => (item.id === id ? record : item));
      }
      return [record, ...items];
    });
    setSaveState('保存しました');
  }

  function editTrip(record: TripRecord) {
    setTravel(record.travel);
    setAccommodation(record.accommodation);
    setItinerary(record.itinerary);
    setReview(record.review);
    setSelectedTripId(record.id);
    setDetailTripId(record.id);
    setPreviousItinerary(null);
    setSelectedImprovementId(null);
    setImproved(false);
    setActiveTab('旅行登録');
    setSaveState(`${record.travel.name}を表示中`);
  }

  function scrollToRiskDetail() {
    window.setTimeout(() => {
      document
        .getElementById('risk-detail-panel')
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 80);
  }

  function openRiskDetail(record: TripRecord, shouldScroll = true) {
    setTravel(record.travel);
    setAccommodation(record.accommodation);
    setItinerary(record.itinerary);
    setReview(record.review);
    setSelectedTripId(record.id);
    setRiskDetailTripId(record.id);
    setDetailTripId(record.id);
    setPreviousItinerary(null);
    setImproved(false);
    setActiveTab('リスク診断');
    setSaveState(`${record.travel.name}のリスク診断を表示中`);
    if (shouldScroll) scrollToRiskDetail();
  }

  function openTripDetail(record: TripRecord, returnTab = 'ホーム') {
    setTravel(record.travel);
    setAccommodation(record.accommodation);
    setItinerary(record.itinerary);
    setReview(record.review);
    setSelectedTripId(record.id);
    setDetailTripId(record.id);
    setDetailReturnTab(returnTab);
    setPreviousItinerary(null);
    setSelectedImprovementId(null);
    setImproved(false);
    setActiveTab('旅行詳細');
    setSaveState(`${record.travel.name}の詳細を表示中`);
  }

  function showRiskPlanInTripDetail(record: TripRecord) {
    setRiskPlanTripId(record.id);
    openTripDetail(record, 'リスク診断');
  }

  function applyImprovement() {
    const selectedImprovement = itineraryImprovementOptions.find(
      (option) => option.id === selectedImprovementId,
    );
    if (!selectedImprovement) return;

    setPreviousItinerary(itinerary);
    setItinerary(itinerary.map(selectedImprovement.apply));
    setImproved(true);
  }

  function undoImprovement() {
    if (!previousItinerary) return;
    setItinerary(previousItinerary);
    setPreviousItinerary(null);
    setSelectedImprovementId(null);
    setImproved(false);
  }

  return (
    <main className="trip-app min-h-screen bg-[var(--app-bg)] text-slate-900">
      <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 py-4 sm:px-6 lg:px-8">
        <header className="sticky top-0 z-20 -mx-4 border-b border-white/70 bg-white/75 px-4 py-3 shadow-sm backdrop-blur-xl sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="grid size-10 place-items-center rounded-lg bg-gradient-to-br from-emerald-900 to-teal-700 text-white shadow-sm shadow-emerald-900/25">
                <ShieldCheck className="size-5" />
              </div>
              <div>
                <p className="text-lg font-semibold leading-tight">TripCheck</p>
                <p className="text-xs text-slate-500">
                  旅行の失敗を事前に見つけるAI
                </p>
              </div>
            </div>
            <Button
              className="bg-emerald-900 hover:bg-emerald-800"
              onClick={startNewTrip}
            >
              <Plus className="size-4" />
              新しい旅行を診断
            </Button>
          </div>
          <p className="mt-2 flex items-center gap-1 text-xs text-slate-500">
            <Save className="size-3.5" />
            {saveState}
          </p>
        </header>

        <section className="grid gap-4 py-5 lg:grid-cols-[1.1fr_0.9fr]">
          <Card className="rounded-lg border-white/70 bg-[linear-gradient(135deg,#ffffff_0%,#f2faf6_54%,#e7f3f1_100%)] shadow-xl shadow-emerald-950/8">
            <CardContent className="space-y-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="space-y-2">
                  {remainingDays === null ? (
                    <Badge className="w-fit bg-slate-100 text-slate-700 ring-1 ring-slate-300">
                      新規旅行を作成中
                    </Badge>
                  ) : (
                    <Badge className="w-fit bg-teal-50 text-teal-800 ring-1 ring-teal-700/15">
                      次の旅行まであと{remainingDays}日
                    </Badge>
                  )}
                  <div>
                    <h1 className="text-2xl font-semibold leading-tight sm:text-3xl">
                      {topTravel.name || '予定された旅行'}
                    </h1>
                    <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-500">
                      <MapPin className="size-4" />
                      {topTravel.origin || '出発地未設定'}発 /{' '}
                      {topTravel.companion} / {topTravel.people}名
                    </p>
                    <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-500">
                      <CalendarDays className="size-4" />
                      {topTravel.startDate || '日程未設定'} -{' '}
                      {topTravel.endDate || '日程未設定'} /{' '}
                      {topAccommodation.name || '宿未設定'} / 旅程
                      {topItinerary.length}件
                    </p>
                  </div>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <ScoreCard
                  title="宿相性"
                  value={topHotelDiagnosis.score}
                  icon={Bed}
                  caption="口コミ点ではなく、あなたの好みとの一致を評価"
                />
                <ScoreCard
                  title="旅程"
                  value={topItineraryDiagnosis.score}
                  icon={Route}
                  caption="時間余裕、疲労、宿到着との整合性を診断"
                />
                <ScoreCard
                  title="耐性"
                  value={100 - topRiskDiagnosis.riskPercent}
                  icon={CloudRain}
                  caption="天気・遅延・混雑に対する強さ"
                />
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-lg border-amber-200/80 bg-[linear-gradient(135deg,#fff8eb_0%,#fffbf2_100%)] shadow-xl shadow-amber-900/8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-amber-950">
                <AlertTriangle className="size-5" />
                重要な注意
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm leading-relaxed text-amber-950">
                {topRiskDiagnosis.critical}
              </p>
              <div className="rounded-lg bg-white/70 p-3 text-sm text-slate-700">
                次にやるべきこと
                <ul className="mt-2 space-y-2 text-sm">
                  {nextActions.map((action) => (
                    <li key={action}>{action}</li>
                  ))}
                </ul>
              </div>
            </CardContent>
          </Card>
        </section>

        <nav className="no-scrollbar fixed inset-x-0 bottom-0 z-30 flex gap-1 overflow-x-auto border-t border-emerald-950/10 bg-white/95 px-3 py-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] shadow-[0_-10px_28px_rgb(15_23_42/10%)] backdrop-blur-xl sm:static sm:mx-0 sm:gap-2 sm:rounded-lg sm:border sm:border-white/70 sm:bg-white/70 sm:px-4 sm:pb-2 sm:shadow-sm">
          {tabs.map((tab) => (
            <button
              key={tab}
              className={`shrink-0 rounded-lg px-3 py-2 text-xs font-medium transition sm:text-sm ${
                activeTab === tab
                  ? 'bg-emerald-900 text-white'
                  : 'text-slate-600 hover:bg-emerald-50'
              }`}
              onClick={() => setActiveTab(tab)}
              type="button"
            >
              {tab}
            </button>
          ))}
        </nav>

        <section className="grid flex-1 gap-4 pb-28 pt-5 sm:pb-5 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="space-y-4">
            {activeTab === 'ホーム' && (
              <div className="grid gap-4">
                <Card className="rounded-lg border-emerald-950/10 bg-white shadow-sm">
                  <CardHeader>
                    <CardTitle className="flex flex-wrap items-center justify-between gap-3">
                      <span className="flex items-center gap-2">
                        <ListFilter className="size-5 text-teal-700" />
                        予定された旅行
                      </span>
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="w-32">
                          <SelectField
                            label="旅行一覧の絞り込み"
                            options={['すべて', '注意あり', '未入力あり']}
                            value={
                              tripFilter === 'attention'
                                ? '注意あり'
                                : tripFilter === 'missing'
                                  ? '未入力あり'
                                  : 'すべて'
                            }
                            onChange={(value) =>
                              setTripFilter(
                                value === '注意あり'
                                  ? 'attention'
                                  : value === '未入力あり'
                                    ? 'missing'
                                    : 'all',
                              )
                            }
                          />
                        </div>
                        <div className="w-32">
                          <SelectField
                            label="旅行一覧の並び順"
                            options={['出発日順', 'リスク順']}
                            value={tripSort === 'risk' ? 'リスク順' : '出発日順'}
                            onChange={(value) =>
                              setTripSort(value === 'リスク順' ? 'risk' : 'date')
                            }
                          />
                        </div>
                        <Button variant="outline" onClick={startNewTrip}>
                          <Plus className="size-4" />
                          新規登録
                        </Button>
                      </div>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {trips.length === 0 ? (
                      <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600">
                        予定された旅行はまだありません。新規登録から旅行・宿・旅程を入力できます。
                      </div>
                    ) : displayedTrips.length === 0 ? (
                      <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600">
                        条件に合う旅行はありません。絞り込みを変更してください。
                      </div>
                    ) : (
                      displayedTrips.map(({ trip, risk, missing }) => {
                        const tripDays = daysUntil(trip.travel.startDate);
                        const isSelected = selectedTripId === trip.id;
                        const tone = riskTone(risk.riskPercent);
                        return (
                          <div
                            key={trip.id}
                            className={`grid gap-3 rounded-lg border p-3 sm:grid-cols-[1fr_auto] ${
                              isSelected
                                ? 'border-emerald-700 bg-emerald-50'
                                : 'border-slate-200 bg-white'
                            }`}
                          >
                            <div className="space-y-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="font-medium text-slate-900">
                                  {trip.travel.name}
                                </p>
                                <Badge className={tone.badge}>
                                  {risk.riskPercent}%
                                </Badge>
                                {missing && (
                                  <Badge variant="outline">未入力あり</Badge>
                                )}
                              </div>
                              <p className="text-xs text-slate-500">
                                {trip.travel.startDate || '日程未設定'} -{' '}
                                {trip.travel.endDate || '日程未設定'} /{' '}
                                {trip.travel.transport} / {trip.travel.people}名
                              </p>
                              <p className="text-xs text-slate-500">
                                {trip.accommodation.name || '宿未設定'} / 旅程{' '}
                                {trip.itinerary.length}件
                                {tripDays !== null && ` / 出発まであと${tripDays}日`}
                              </p>
                              <p className="text-xs text-slate-500">
                                最も注意: {topRiskLabel(risk)}
                              </p>
                            </div>
                            <div className="flex flex-wrap gap-2 self-center sm:justify-end">
                              <Button
                                onClick={() => openTripDetail(trip)}
                                variant="outline"
                              >
                                <Eye className="size-4" />
                                詳細
                              </Button>
                              <Button
                                onClick={() => editTrip(trip)}
                                variant={isSelected ? 'secondary' : 'outline'}
                              >
                                <Pencil className="size-4" />
                                編集
                              </Button>
                              <Button
                                className="bg-emerald-900 hover:bg-emerald-800"
                                onClick={() => openRiskDetail(trip)}
                              >
                                <ShieldAlert className="size-4" />
                                リスク診断
                              </Button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </CardContent>
                </Card>
                <Card className="rounded-lg border-emerald-950/10 bg-white shadow-sm">
                  <CardHeader>
                    <CardTitle>直近旅行の診断サマリー</CardTitle>
                  </CardHeader>
                  <CardContent className="grid gap-4 sm:grid-cols-2">
                    {Object.entries(topItineraryDiagnosis.categoryScores).map(
                      ([label, value]) => (
                        <MiniBar key={label} label={label} value={value} />
                      ),
                    )}
                  </CardContent>
                </Card>
                <Card className="rounded-lg border-emerald-950/10 bg-white shadow-sm">
                  <CardHeader>
                    <CardTitle>AIが見つけた問題点</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {topItineraryDiagnosis.issues.slice(0, 5).map((issue) => (
                      <div
                        key={issue}
                        className="flex gap-3 rounded-lg bg-slate-50 p-3 text-sm text-slate-700"
                      >
                        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" />
                        {issue}
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>
            )}

            {activeTab === '旅行詳細' &&
              detailTrip &&
              detailRiskDiagnosis &&
              detailHotelDiagnosis &&
              detailItineraryDiagnosis && (
                <div className="space-y-4">
                  <Card className="rounded-lg border-emerald-950/10 bg-white shadow-sm">
                    <CardHeader>
                      <CardTitle className="flex flex-wrap items-center justify-between gap-3">
                        <span>{detailTrip.travel.name}の詳細</span>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            onClick={() => setActiveTab(detailReturnTab)}
                            variant="outline"
                          >
                            <RotateCcw className="size-4" />
                            元に戻す
                          </Button>
                          <Button
                            onClick={() => editTrip(detailTrip)}
                            variant="outline"
                          >
                            <Pencil className="size-4" />
                            旅行の予定を編集
                          </Button>
                          <Button
                            className="bg-emerald-900 hover:bg-emerald-800"
                            onClick={() => openRiskDetail(detailTrip)}
                          >
                            <ShieldAlert className="size-4" />
                            リスク診断を見る
                          </Button>
                        </div>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-5">
                      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                        <div className="rounded-lg bg-slate-50 p-3">
                          <p className="text-xs text-slate-500">日程</p>
                          <p className="mt-1 text-sm font-medium text-slate-900">
                            {detailTrip.travel.startDate || '未設定'} -{' '}
                            {detailTrip.travel.endDate || '未設定'}
                          </p>
                        </div>
                        <div className="rounded-lg bg-slate-50 p-3">
                          <p className="text-xs text-slate-500">出発・人数</p>
                          <p className="mt-1 text-sm font-medium text-slate-900">
                            {detailTrip.travel.origin || '未設定'} /{' '}
                            {detailTrip.travel.people}名
                          </p>
                        </div>
                        <div className="rounded-lg bg-slate-50 p-3">
                          <p className="text-xs text-slate-500">移動手段</p>
                          <p className="mt-1 text-sm font-medium text-slate-900">
                            {detailTrip.travel.transport}
                          </p>
                        </div>
                        <div className="rounded-lg bg-slate-50 p-3">
                          <p className="text-xs text-slate-500">予算</p>
                          <p className="mt-1 text-sm font-medium text-slate-900">
                            ¥{currency(detailTrip.travel.budget)}
                          </p>
                        </div>
                      </div>

                      <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
                        <Card className="rounded-lg border-slate-200 bg-white shadow-none">
                          <CardHeader>
                            <CardTitle className="text-base">宿</CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-2 text-sm text-slate-700">
                            <p className="font-medium text-slate-900">
                              {detailTrip.accommodation.name || '宿未設定'}
                            </p>
                            <p>{detailTrip.accommodation.location || '所在地未設定'}</p>
                            <p>
                              チェックイン {detailTrip.accommodation.checkIn || '未設定'} / 
                              チェックアウト {detailTrip.accommodation.checkOut || '未設定'}
                            </p>
                            <p>
                              夕食 {detailTrip.accommodation.dinner || '未設定'} / 
                              朝食 {detailTrip.accommodation.breakfast || '未設定'}
                            </p>
                          </CardContent>
                        </Card>

                        <Card className="rounded-lg border-slate-200 bg-white shadow-none">
                          <CardHeader>
                            <CardTitle className="text-base">診断サマリー</CardTitle>
                          </CardHeader>
                          <CardContent className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
                            <MiniBar label="宿相性" value={detailHotelDiagnosis.score} />
                            <MiniBar
                              label="旅程"
                              value={detailItineraryDiagnosis.score}
                            />
                            <MiniBar
                              label="リスク耐性"
                              value={100 - detailRiskDiagnosis.riskPercent}
                            />
                          </CardContent>
                        </Card>
                      </div>

                      <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
                        <Card className="rounded-lg border-slate-200 bg-white shadow-none">
                          <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-base">
                              <ClipboardList className="size-4 text-teal-700" />
                              旅程
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-2">
                            {detailTrip.itinerary.length === 0 ? (
                              <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
                                旅程はまだ登録されていません。
                              </p>
                            ) : (
                              detailTrip.itinerary.map((item) => (
                                <div
                                  className="grid gap-1 rounded-lg bg-slate-50 p-3 text-sm sm:grid-cols-[110px_1fr_auto]"
                                  key={item.id}
                                >
                                  <p className="font-medium text-slate-700">
                                    {item.start} - {item.end}
                                  </p>
                                  <div>
                                    <p className="font-medium text-slate-900">
                                      {item.title}
                                    </p>
                                    <p className="text-xs text-slate-500">
                                      {item.place || '場所未設定'}
                                    </p>
                                  </div>
                                  <Badge variant="outline">{item.category}</Badge>
                                </div>
                              ))
                            )}
                          </CardContent>
                        </Card>

                        <Card className="rounded-lg border-amber-200 bg-amber-50 shadow-none">
                          <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-base text-amber-950">
                              <AlertTriangle className="size-4" />
                              リスク要点
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-3 text-sm text-amber-950">
                            <p>{detailRiskDiagnosis.critical}</p>
                            <div className="rounded-lg bg-white/70 p-3 text-slate-700">
                              <p className="font-medium text-slate-900">
                                次にやること
                              </p>
                              <ul className="mt-2 space-y-2">
                                {buildNextActions(detailTrip, detailRiskDiagnosis).map(
                                  (action) => (
                                    <li key={action}>{action}</li>
                                  ),
                                )}
                              </ul>
                            </div>
                          </CardContent>
                        </Card>
                      </div>

                      {riskPlanTripId === detailTrip.id && (
                        <Card className="rounded-lg border-emerald-200 bg-emerald-50 shadow-none">
                          <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-base text-emerald-950">
                              <Umbrella className="size-4" />
                              リスク回避プラン
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-3">
                            {detailAvoidancePlans.map((plan, index) => (
                              <div
                                className="flex gap-3 rounded-lg bg-white/80 p-3 text-sm text-emerald-950"
                                key={plan}
                              >
                                <span className="grid size-6 shrink-0 place-items-center rounded-full bg-emerald-900 text-xs font-semibold text-white">
                                  {index + 1}
                                </span>
                                <span>{plan}</span>
                              </div>
                            ))}
                          </CardContent>
                        </Card>
                      )}

                      <div className="rounded-lg bg-emerald-50 p-4 text-sm leading-relaxed text-emerald-950">
                        <p className="font-medium">旅行メモ</p>
                        <p className="mt-1">
                          {detailTrip.travel.memo || 'メモはまだ登録されていません。'}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}

            {activeTab === 'プロフィール' && (
              <div className="space-y-4">
                <Card className="rounded-lg border-emerald-950/10 bg-white shadow-sm">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <ShieldCheck className="size-5 text-teal-700" />
                      アカウント
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {authUserEmail ? (
                      <div className="space-y-4">
                        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-emerald-50 p-3">
                          <div>
                            <p className="text-xs text-emerald-700">ログイン中</p>
                            <p className="font-medium text-emerald-950">
                              {authUserEmail}
                            </p>
                          </div>
                          <Button onClick={logoutFromAws} variant="outline">
                            <LogOut className="size-4" />
                            ログアウト
                          </Button>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            className="bg-emerald-900 hover:bg-emerald-800"
                            disabled={authBusy}
                            onClick={saveAllToAws}
                          >
                            <CloudUpload className="size-4" />
                            AWSへ保存
                          </Button>
                          <Button
                            disabled={authBusy}
                            onClick={loadAllFromAws}
                            variant="outline"
                          >
                            <CloudDownload className="size-4" />
                            AWSから読込
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="max-w-md space-y-3">
                        <div className="grid grid-cols-2 gap-2">
                          <Button
                            onClick={() => {
                              setAuthMode('signin');
                              setAuthMessage('');
                            }}
                            variant={authMode === 'signin' ? 'default' : 'outline'}
                          >
                            <LogIn className="size-4" />
                            ログイン
                          </Button>
                          <Button
                            onClick={() => {
                              setAuthMode('signup');
                              setAuthMessage('');
                            }}
                            variant={authMode === 'signup' ? 'default' : 'outline'}
                          >
                            <UserPlus className="size-4" />
                            新規登録
                          </Button>
                        </div>
                        <div className="space-y-1.5">
                          <FieldLabel>メールアドレス</FieldLabel>
                          <Input
                            autoComplete="email"
                            onChange={(event) => setAuthEmail(event.target.value)}
                            type="email"
                            value={authEmail}
                          />
                        </div>
                        {authMode === 'confirm' ? (
                          <div className="space-y-1.5">
                            <FieldLabel>確認コード</FieldLabel>
                            <Input
                              autoComplete="one-time-code"
                              inputMode="numeric"
                              onChange={(event) => setAuthCode(event.target.value)}
                              value={authCode}
                            />
                          </div>
                        ) : (
                          <div className="space-y-1.5">
                            <FieldLabel>パスワード</FieldLabel>
                            <Input
                              autoComplete={
                                authMode === 'signup'
                                  ? 'new-password'
                                  : 'current-password'
                              }
                              minLength={10}
                              onChange={(event) => setAuthPassword(event.target.value)}
                              type="password"
                              value={authPassword}
                            />
                          </div>
                        )}
                        <Button
                          className="bg-emerald-900 hover:bg-emerald-800"
                          disabled={
                            authBusy ||
                            !authEmail.trim() ||
                            (authMode === 'confirm'
                              ? !authCode.trim()
                              : authPassword.length < 10)
                          }
                          onClick={submitAuth}
                        >
                          {authMode === 'confirm' ? (
                            <MailCheck className="size-4" />
                          ) : authMode === 'signup' ? (
                            <UserPlus className="size-4" />
                          ) : (
                            <LogIn className="size-4" />
                          )}
                          {authMode === 'confirm'
                            ? 'コードを確認'
                            : authMode === 'signup'
                              ? 'アカウントを作成'
                              : 'ログイン'}
                        </Button>
                      </div>
                    )}
                    {authMessage && (
                      <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-700">
                        {authMessage}
                      </p>
                    )}
                  </CardContent>
                </Card>

                <Card className="rounded-lg border-emerald-950/10 bg-white shadow-sm">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <SlidersHorizontal className="size-5 text-teal-700" />
                      旅行の好み
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="grid gap-4 sm:grid-cols-2">
                    {(Object.keys(preferenceLabels) as PreferenceKey[]).map(
                      (key) => (
                        <div key={key} className="space-y-2">
                          <div className="flex items-center justify-between">
                            <FieldLabel>{preferenceLabels[key]}</FieldLabel>
                            <span className="text-sm font-semibold text-emerald-800">
                              {preference[key]}
                            </span>
                          </div>
                          <input
                            aria-label={preferenceLabels[key]}
                            className="w-full accent-emerald-800"
                            max="5"
                            min="1"
                            onChange={(event) =>
                              updatePreference(key, Number(event.target.value))
                            }
                            type="range"
                            value={preference[key]}
                          />
                        </div>
                      ),
                    )}
                  </CardContent>
                </Card>
              </div>
            )}

            {activeTab === '旅行登録' && (
              <div className="space-y-4">
                <Card className="rounded-lg border-emerald-950/10 bg-white shadow-sm">
                  <CardHeader className="pb-2">
                    <CardTitle>
                      {selectedTripId ? '旅行の予定を編集' : '旅行の予定を登録'}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="max-w-[760px] space-y-3">
                    <div className="grid gap-3 sm:grid-cols-[minmax(180px,280px)_132px_132px]">
                      <div className="min-w-0 space-y-1">
                        <FieldLabel>旅行名</FieldLabel>
                        <Input
                          value={travel.name}
                          onChange={(event) =>
                            setTravel({ ...travel, name: event.target.value })
                          }
                        />
                      </div>
                      <div className="min-w-0 space-y-1">
                        <FieldLabel>出発日</FieldLabel>
                        <Input
                          type="date"
                          value={travel.startDate}
                          onChange={(event) =>
                            setTravel({
                              ...travel,
                              startDate: event.target.value,
                            })
                          }
                        />
                      </div>
                      <div className="min-w-0 space-y-1">
                        <FieldLabel>帰宅日</FieldLabel>
                        <Input
                          type="date"
                          value={travel.endDate}
                          onChange={(event) =>
                            setTravel({ ...travel, endDate: event.target.value })
                          }
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-[160px_88px_92px_64px_112px]">
                      <div className="min-w-0 space-y-1">
                        <FieldLabel>出発地</FieldLabel>
                        <Input
                          value={travel.origin}
                          onChange={(event) =>
                            setTravel({ ...travel, origin: event.target.value })
                          }
                        />
                      </div>
                      <div className="min-w-0 space-y-1">
                        <FieldLabel>移動手段</FieldLabel>
                        <SelectField
                          label="移動手段"
                          options={['車', '電車', '飛行機', 'その他']}
                          value={travel.transport}
                          onChange={(value) =>
                            setTravel({
                              ...travel,
                              transport: value as Travel['transport'],
                            })
                          }
                        />
                      </div>
                      <div className="min-w-0 space-y-1">
                        <FieldLabel>同行者</FieldLabel>
                        <SelectField
                          label="同行者"
                          options={['一人', 'カップル', '夫婦', '友人', '家族']}
                          value={travel.companion}
                          onChange={(value) =>
                            setTravel({
                              ...travel,
                              companion: value as Travel['companion'],
                            })
                          }
                        />
                      </div>
                      <div className="min-w-0 space-y-1">
                        <FieldLabel>人数</FieldLabel>
                        <Input
                          className="px-2 text-center"
                          min="1"
                          type="number"
                          value={travel.people}
                          onChange={(event) =>
                            setTravel({
                              ...travel,
                              people: Number(event.target.value),
                            })
                          }
                        />
                      </div>
                      <div className="min-w-0 space-y-1">
                        <FieldLabel>旅行予算</FieldLabel>
                        <Input
                          className="px-2"
                          type="number"
                          value={travel.budget}
                          onChange={(event) =>
                            setTravel({
                              ...travel,
                              budget: Number(event.target.value),
                            })
                          }
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <FieldLabel>自由入力メモ</FieldLabel>
                      <Textarea
                        value={travel.memo}
                        onChange={(event) =>
                          setTravel({ ...travel, memo: event.target.value })
                        }
                      />
                    </div>
                    <div className="flex flex-wrap gap-2 pt-1">
                      <Button
                        className="bg-teal-800 hover:bg-teal-700"
                        onClick={saveCurrentTrip}
                      >
                        <Save className="size-4" />
                        保存
                      </Button>
                      <Button
                        className="bg-emerald-900 hover:bg-emerald-800"
                        onClick={() => setActiveTab('宿診断')}
                      >
                        <Bed className="size-4" />
                        宿を入力する
                      </Button>
                      <Button variant="outline" onClick={resetDemo}>
                        <RotateCcw className="size-4" />
                        モック旅行に戻す
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                {selectedTripId && (
                  <Card className="rounded-lg border-teal-200 bg-teal-50 shadow-sm">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Sparkles className="size-5 text-teal-700" />
                        AIで改善
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <p className="text-sm text-slate-700">
                        採用したい改善案を1つ選択してください。選択した案だけ旅程に反映されます。
                      </p>
                      <div className="grid gap-2 text-sm text-slate-700">
                        {itineraryImprovementOptions.map((option) => {
                          const isChecked = selectedImprovementId === option.id;
                          return (
                            <label
                              className={`flex cursor-pointer gap-3 rounded-lg border p-3 transition ${
                                isChecked
                                  ? 'border-teal-600 bg-white shadow-sm'
                                  : 'border-teal-100 bg-teal-50/60 hover:bg-white'
                              }`}
                              key={option.id}
                            >
                              <input
                                checked={isChecked}
                                className="mt-1 size-4 accent-teal-700"
                                name="itinerary-improvement"
                                onChange={() => setSelectedImprovementId(option.id)}
                                type="radio"
                              />
                              <span className="space-y-0.5">
                                <span className="block font-medium text-slate-900">
                                  {option.title}
                                </span>
                                <span className="block text-slate-600">
                                  {option.detail}
                                </span>
                              </span>
                            </label>
                          );
                        })}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          className="bg-teal-800 hover:bg-teal-700"
                          disabled={!selectedImprovementId}
                          onClick={applyImprovement}
                        >
                          <Check className="size-4" />
                          改善案を採用
                        </Button>
                        <Button
                          disabled={!previousItinerary}
                          onClick={undoImprovement}
                          variant="outline"
                        >
                          <RotateCcw className="size-4" />
                          元に戻す
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}

                <Card className="rounded-lg border-emerald-950/10 bg-white shadow-sm">
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between gap-3">
                      旅程
                      <Badge className="bg-emerald-50 text-emerald-800">
                        旅行スコア {itineraryDiagnosis.score}点
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex justify-end">
                      <Button variant="outline" onClick={addItineraryItem}>
                        <Plus className="size-4" />
                        予定を追加
                      </Button>
                    </div>
                    {itinerary.map((item) => (
                      <div
                        key={item.id}
                        className="grid gap-3 rounded-lg border border-slate-200 p-3 sm:grid-cols-2 lg:grid-cols-[minmax(220px,1.7fr)_120px_minmax(220px,1.1fr)_auto]"
                      >
                        <div className="space-y-1.5 sm:col-span-2 lg:col-span-1">
                          <FieldLabel>タイトル</FieldLabel>
                          <Input
                            aria-label={`${item.title}タイトル`}
                            value={item.title}
                            onChange={(event) =>
                              updateItinerary(item.id, { title: event.target.value })
                            }
                          />
                        </div>
                        <div className="space-y-1.5">
                          <FieldLabel>項目</FieldLabel>
                          <SelectField
                            label={`${item.title}カテゴリ`}
                            options={itineraryCategoryOptions}
                            value={item.category}
                            onChange={(value) =>
                              updateItinerary(item.id, {
                                category: value as ItineraryItem['category'],
                              })
                            }
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1.5">
                            <FieldLabel>開始時間</FieldLabel>
                            <TimeSelect
                              label={`${item.title}開始時間`}
                              value={item.start}
                              onChange={(value) =>
                                updateItinerary(item.id, { start: value })
                              }
                            />
                          </div>
                          <div className="space-y-1.5">
                            <FieldLabel>終了時間</FieldLabel>
                            <TimeSelect
                              label={`${item.title}終了時間`}
                              value={item.end}
                              onChange={(value) =>
                                updateItinerary(item.id, { end: value })
                              }
                            />
                          </div>
                        </div>
                        <Button
                          aria-label={`${item.title}を削除`}
                          className="self-end justify-self-end text-rose-700 hover:text-rose-800"
                          onClick={() => removeItineraryItem(item.id)}
                          size="icon"
                          variant="ghost"
                        >
                          <Trash2 className="size-4" />
                        </Button>
                        <div className="space-y-1.5">
                          <FieldLabel>場所</FieldLabel>
                          <Input
                            aria-label={`${item.title}場所`}
                            placeholder="場所"
                            value={item.place}
                            onChange={(event) =>
                              updateItinerary(item.id, { place: event.target.value })
                            }
                          />
                        </div>
                        {item.category === '移動' && (
                          <div className="space-y-1.5">
                            <FieldLabel>移動手段</FieldLabel>
                            <SelectField
                              label={`${item.title}移動手段`}
                              options={transportModeOptions}
                              value={item.transportMode || '電車'}
                              onChange={(value) =>
                                updateItinerary(item.id, {
                                  transportMode:
                                    value as ItineraryItem['transportMode'],
                                })
                              }
                            />
                          </div>
                        )}
                        <div className="space-y-2 sm:col-span-2 lg:col-span-1">
                          <PriorityControl
                            label={`${item.title}優先度`}
                            value={item.priority}
                            onChange={(value) =>
                              updateItinerary(item.id, { priority: value })
                            }
                          />
                        </div>
                        <div className="space-y-1.5 sm:col-span-2 lg:col-span-4">
                          <FieldLabel>備考</FieldLabel>
                          <Textarea
                            aria-label={`${item.title}備考`}
                            className="min-h-24"
                            placeholder="予約条件、混雑時の代替案、注意点など"
                            value={item.memo}
                            onChange={(event) =>
                              updateItinerary(item.id, { memo: event.target.value })
                            }
                          />
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>

              </div>
            )}

            {activeTab === '宿診断' && (
              <div className="grid gap-4">
                <Card className="rounded-lg border-emerald-950/10 bg-white shadow-sm">
                  <CardHeader>
                    <CardTitle>宿泊先AI診断</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <FieldLabel>宿泊施設名</FieldLabel>
                        <Input
                          value={accommodation.name}
                          onChange={(event) =>
                            setAccommodation({
                              ...accommodation,
                              name: event.target.value,
                            })
                          }
                        />
                      </div>
                      <div className="space-y-1.5">
                        <FieldLabel>所在地</FieldLabel>
                        <Input
                          value={accommodation.location}
                          onChange={(event) =>
                            setAccommodation({
                              ...accommodation,
                              location: event.target.value,
                            })
                          }
                        />
                      </div>
                      <div className="space-y-1.5">
                        <FieldLabel>宿泊料金</FieldLabel>
                        <Input
                          type="number"
                          value={accommodation.price}
                          onChange={(event) =>
                            setAccommodation({
                              ...accommodation,
                              price: Number(event.target.value),
                            })
                          }
                        />
                      </div>
                      <div className="space-y-1.5">
                        <FieldLabel>宿URL</FieldLabel>
                        <Input
                          value={accommodation.url}
                          onChange={(event) =>
                            setAccommodation({
                              ...accommodation,
                              url: event.target.value,
                            })
                          }
                        />
                      </div>
                      <div className="space-y-1.5">
                        <FieldLabel>チェックイン時間</FieldLabel>
                        <Input
                          value={accommodation.checkIn}
                          onChange={(event) =>
                            setAccommodation({
                              ...accommodation,
                              checkIn: event.target.value,
                            })
                          }
                        />
                      </div>
                      <div className="space-y-1.5">
                        <FieldLabel>チェックアウト時間</FieldLabel>
                        <Input
                          value={accommodation.checkOut}
                          onChange={(event) =>
                            setAccommodation({
                              ...accommodation,
                              checkOut: event.target.value,
                            })
                          }
                        />
                      </div>
                      <div className="space-y-1.5">
                        <FieldLabel>夕食時間</FieldLabel>
                        <Input
                          value={accommodation.dinner}
                          onChange={(event) =>
                            setAccommodation({
                              ...accommodation,
                              dinner: event.target.value,
                            })
                          }
                        />
                      </div>
                      <div className="space-y-1.5">
                        <FieldLabel>朝食時間</FieldLabel>
                        <Input
                          value={accommodation.breakfast}
                          onChange={(event) =>
                            setAccommodation({
                              ...accommodation,
                              breakfast: event.target.value,
                            })
                          }
                        />
                      </div>
                      <div className="space-y-1.5 sm:col-span-2">
                        <FieldLabel>ユーザーによる補足情報</FieldLabel>
                        <Textarea
                          value={accommodation.note}
                          onChange={(event) =>
                            setAccommodation({
                              ...accommodation,
                              note: event.target.value,
                            })
                          }
                        />
                      </div>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {Object.entries(hotelDiagnosis.categoryScores).map(
                        ([label, value]) => (
                          <MiniBar key={label} label={label} value={value} />
                        ),
                      )}
                    </div>
                  </CardContent>
                </Card>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Card className="rounded-lg border-emerald-950/10 bg-white shadow-sm">
                    <CardHeader>
                      <CardTitle>この宿が向いている理由</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {hotelDiagnosis.reasons.map((reason) => (
                        <p key={reason} className="flex gap-2 text-sm text-slate-700">
                          <Check className="mt-0.5 size-4 shrink-0 text-emerald-700" />
                          {reason}
                        </p>
                      ))}
                    </CardContent>
                  </Card>
                  <Card className="rounded-lg border-rose-200 bg-rose-50 shadow-sm">
                    <CardHeader>
                      <CardTitle>後悔する可能性があるポイント</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {hotelDiagnosis.regretPoints.map((point) => (
                        <p key={point} className="text-sm text-rose-950">
                          {point}
                        </p>
                      ))}
                    </CardContent>
                  </Card>
                </div>
              </div>
            )}

            {activeTab === 'リスク診断' && (
              <div className="space-y-4">
                <Card className="rounded-lg border-emerald-950/10 bg-white shadow-sm">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <ShieldAlert className="size-5 text-amber-600" />
                      旅行別リスク診断
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {trips.length === 0 ? (
                      <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600">
                        予定された旅行はまだありません。旅行登録から保存すると、ここにリスク診断が表示されます。
                      </div>
                    ) : (
                      trips.map((trip) => {
                        const tripRisk = buildContextualRisk(trip);
                        const tone = riskTone(tripRisk.riskPercent);
                        const isOpen = riskDetailTrip?.id === trip.id;
                        return (
                          <div
                            className={`grid gap-3 rounded-lg border p-3 sm:grid-cols-[1fr_auto] ${
                              isOpen
                                ? 'border-emerald-700 bg-emerald-50'
                                : 'border-slate-200 bg-white'
                            }`}
                            key={trip.id}
                          >
                            <div className="space-y-2">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="font-medium text-slate-900">
                                  {trip.travel.name}
                                </p>
                                <Badge className={tone.badge}>{tone.label}</Badge>
                                {isOpen && (
                                  <Badge className="bg-emerald-900 text-white">
                                    詳細表示中
                                  </Badge>
                                )}
                              </div>
                              <p className="text-xs text-slate-500">
                                {trip.travel.startDate || '日程未設定'} -{' '}
                                {trip.travel.endDate || '日程未設定'} /{' '}
                                {trip.accommodation.name || '宿未設定'}
                              </p>
                              <div className="flex items-center gap-3">
                                <div className="h-2 flex-1 rounded-full bg-slate-100">
                                  <div
                                    className={`h-full rounded-full ${tone.bar}`}
                                    style={{ width: `${tripRisk.riskPercent}%` }}
                                  />
                                </div>
                                <span
                                  className={`w-12 text-right text-sm font-semibold ${tone.text}`}
                                >
                                  {tripRisk.riskPercent}%
                                </span>
                              </div>
                              <p className="text-xs text-slate-500">
                                最も注意: {topRiskLabel(tripRisk)}
                              </p>
                            </div>
                            <Button
                              className="self-center"
                              onClick={() => openRiskDetail(trip, true)}
                              variant={isOpen ? 'secondary' : 'outline'}
                            >
                              <ChevronRight className="size-4" />
                              詳細
                            </Button>
                          </div>
                        );
                      })
                    )}
                  </CardContent>
                </Card>

                {riskDetailTrip && riskDetailDiagnosis && (
                  <div
                    className="grid scroll-mt-24 gap-4 xl:grid-cols-[minmax(0,1fr)_320px]"
                    id="risk-detail-panel"
                  >
                    <Card className="rounded-lg border-emerald-950/10 bg-white shadow-sm">
                      <CardHeader>
                        <CardTitle className="flex flex-wrap items-center justify-between gap-3">
                          <span>{riskDetailTrip.travel.name}のリスク詳細</span>
                          <Button
                            onClick={() => editTrip(riskDetailTrip)}
                            variant="outline"
                          >
                            <Pencil className="size-4" />
                            この旅行の旅程を編集
                          </Button>
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-5">
                        <div className="grid gap-3 sm:grid-cols-[180px_1fr]">
                          <div className="rounded-lg bg-slate-950 p-4 text-white">
                            <p className="text-sm text-slate-300">
                              総合リスク
                            </p>
                            <p className="text-4xl font-semibold">
                              {riskDetailDiagnosis.riskPercent}%
                            </p>
                            <p className="mt-2 text-xs text-slate-300">
                              {riskTone(riskDetailDiagnosis.riskPercent).label}
                            </p>
                          </div>
                          <div className="rounded-lg bg-amber-50 p-4 text-sm leading-relaxed text-amber-950">
                            <div className="mb-2 flex items-center gap-2 font-medium">
                              <AlertTriangle className="size-4" />
                              最重要アラート
                            </div>
                            {riskDetailDiagnosis.critical}
                          </div>
                        </div>

                        <div className="grid gap-3 sm:grid-cols-2">
                          {Object.entries(riskDetailDiagnosis.categoryRisks).map(
                            ([label, value]) => (
                              <MiniBar key={label} label={label} value={value} />
                            ),
                          )}
                        </div>

                        <div className="space-y-2">
                          <p className="text-sm font-medium text-slate-900">
                            主なリスク
                          </p>
                          {riskDetailDiagnosis.warnings.map((warning) => (
                            <div
                              className="flex gap-3 rounded-lg bg-slate-50 p-3 text-sm text-slate-700"
                              key={warning}
                            >
                              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" />
                              {warning}
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>

                    <div className="space-y-4">
                      <Card className="rounded-lg border-emerald-950/10 bg-white shadow-sm">
                        <CardHeader>
                          <CardTitle className="flex items-center gap-2">
                            <Umbrella className="size-5 text-teal-700" />
                            回避プラン
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          {riskDetailPlans.slice(0, 3).map((plan, index) => (
                            <div
                              className="flex gap-3 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-950"
                              key={plan}
                            >
                              <span className="grid size-6 shrink-0 place-items-center rounded-full bg-emerald-900 text-xs font-semibold text-white">
                                {index + 1}
                              </span>
                              <span>{plan}</span>
                            </div>
                          ))}
                          <Button
                            className="mt-2 w-full bg-emerald-900 hover:bg-emerald-800"
                            onClick={() => showRiskPlanInTripDetail(riskDetailTrip)}
                          >
                            <Pencil className="size-4" />
                            旅行プランを編集
                          </Button>
                        </CardContent>
                      </Card>

                      <Card className="rounded-lg border-emerald-950/10 bg-white shadow-sm">
                        <CardHeader>
                          <CardTitle className="flex items-center gap-2">
                            <TimerReset className="size-5 text-teal-700" />
                            追加チェック
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          {riskDetailChecks.map((check) => (
                            <div
                              className="rounded-lg border border-slate-200 p-3"
                              key={check.title}
                            >
                              <div className="flex items-center justify-between gap-3">
                                <p className="font-medium text-slate-900">
                                  {check.title}
                                </p>
                                <Badge variant="outline">{check.label}</Badge>
                              </div>
                              <p className="mt-1 text-xs leading-relaxed text-slate-500">
                                {check.text}
                              </p>
                            </div>
                          ))}
                        </CardContent>
                      </Card>
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'カルテ' && (
              <Card className="rounded-lg border-emerald-950/10 bg-white shadow-sm">
                <CardHeader>
                  <CardTitle>旅行カルテ</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-3 sm:grid-cols-2">
                    {reviewMetrics.map(({ label, key }) => (
                      <div key={key} className="space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-600">{label}</span>
                          <span className="font-medium text-emerald-800">
                            {review[key]}
                          </span>
                        </div>
                        <input
                          aria-label={label}
                          className="w-full accent-emerald-800"
                          max="5"
                          min="1"
                          onChange={(event) =>
                            setReview({
                              ...review,
                              [key]: Number(event.target.value),
                            })
                          }
                          type="range"
                          value={review[key]}
                        />
                      </div>
                    ))}
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <FieldLabel>よかったこと</FieldLabel>
                      <Textarea
                        value={review.good}
                        onChange={(event) =>
                          setReview({ ...review, good: event.target.value })
                        }
                      />
                    </div>
                    <div className="space-y-1.5">
                      <FieldLabel>失敗したこと</FieldLabel>
                      <Textarea
                        value={review.failed}
                        onChange={(event) =>
                          setReview({ ...review, failed: event.target.value })
                        }
                      />
                    </div>
                  </div>
                  <div className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-950">
                    過去の旅行を見ると、1日4ヶ所以上観光すると満足度が下がる傾向を学習できます。
                  </div>
                </CardContent>
              </Card>
            )}

            {activeTab === 'プラン' && (
              <div className="grid gap-4 sm:grid-cols-2">
                <Card className="rounded-lg border-emerald-950/10 bg-white shadow-sm">
                  <CardHeader>
                    <CardTitle>Free</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm text-slate-700">
                    <p className="text-3xl font-semibold text-slate-900">¥0</p>
                    <p>旅行診断 月1回</p>
                    <p>基本旅行スコア</p>
                    <p>宿相性診断</p>
                    <p>過去旅行3件</p>
                  </CardContent>
                </Card>
                <Card className="rounded-lg border-emerald-800 bg-emerald-950 text-white shadow-sm">
                  <CardHeader>
                    <CardTitle>Premium</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm text-emerald-50">
                    <p className="text-3xl font-semibold">¥580/月</p>
                    <p>旅行診断無制限</p>
                    <p>AI旅程改善・トラブル予報</p>
                    <p>前日/当日再診断</p>
                    <p>旅行カルテと嗜好学習</p>
                    <Button className="mt-2 bg-white text-emerald-950 hover:bg-emerald-50">
                      <CreditCard className="size-4" />
                      Premiumを確認
                    </Button>
                  </CardContent>
                </Card>
              </div>
            )}
          </div>

          <aside className="space-y-4">
            <Card className="rounded-lg border-emerald-950/10 bg-white shadow-sm">
              <CardHeader>
                <CardTitle>次の旅行</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <p className="flex items-center gap-2 text-slate-600">
                  <CalendarDays className="size-4 text-teal-700" />
                  {topTravel.startDate || '日程未設定'} -{' '}
                  {topTravel.endDate || '日程未設定'}
                </p>
                <p className="flex items-center gap-2 text-slate-600">
                  <Train className="size-4 text-teal-700" />
                  {topTravel.transport} / 予算 ¥{currency(topTravel.budget)}
                </p>
                <p className="rounded-lg bg-slate-50 p-3 text-slate-600">
                  {topTravel.memo || 'メモはまだ登録されていません。'}
                </p>
              </CardContent>
            </Card>

            <Card className="rounded-lg border-emerald-950/10 bg-white shadow-sm">
              <CardHeader>
                <CardTitle>予定された旅行</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {trips.length === 0 ? (
                  <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
                    保存された旅行はまだありません。
                  </p>
                ) : (
                  trips.slice(0, 3).map((trip) => (
                    <button
                      key={trip.id}
                      className="flex w-full items-center justify-between rounded-lg border border-slate-200 p-3 text-left text-sm hover:bg-slate-50"
                      onClick={() => editTrip(trip)}
                      type="button"
                    >
                      <span>
                        <span className="block font-medium">{trip.travel.name}</span>
                        <span className="block text-xs text-slate-500">
                          {trip.travel.startDate || '日程未設定'}
                        </span>
                      </span>
                      <ChevronRight className="size-4 text-slate-400" />
                    </button>
                  ))
                )}
              </CardContent>
            </Card>

            <Card className="rounded-lg border-emerald-950/10 bg-white shadow-sm">
              <CardHeader>
                <CardTitle>連携予定</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-slate-600">
                <p>AWS: Cognito / API Gateway / Lambda / DynamoDB / S3</p>
                <p>AI: Bedrock優先、OpenAI APIへ切り替え可能</p>
                <p>外部API: 天気 / Maps / Places / 交通 / 営業時間</p>
              </CardContent>
            </Card>
          </aside>
        </section>
      </div>
    </main>
  );
}
