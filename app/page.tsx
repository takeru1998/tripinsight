'use client';

import {
  AlertTriangle,
  Bed,
  CalendarDays,
  Check,
  ChevronRight,
  CircleHelp,
  Cloud,
  CloudDownload,
  CloudFog,
  CloudLightning,
  CloudRain,
  CloudSnow,
  CloudSun,
  CloudUpload,
  ClipboardList,
  CreditCard,
  Eye,
  House,
  ListFilter,
  LogIn,
  LogOut,
  MailCheck,
  MapPin,
  Menu,
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
  UserRound,
  UserPlus,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
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
import { mockPreference } from '@/data/mockTrip';
import {
  buildDynamicImprovements,
  isCurrentOrFutureTrip,
  normalizeItineraryDates,
  toMinutes,
  tripDateTime,
  tripScheduleLabel,
  validateTripRecord,
  type ItineraryImprovementOption,
} from '@/lib/tripLogic';
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
import {
  fetchTripWeather,
  type TripWeather,
  type WeatherKind,
} from '@/services/weather/openMeteoWeather';
import type {
  Accommodation,
  HotelCompatibilityDiagnosis,
  ItineraryItem,
  PreferenceKey,
  RiskDiagnosis,
  Travel,
  TravelDiagnosis,
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
  diagnoses?: DiagnosisMap;
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
type DiagnosisKind = 'hotel' | 'itinerary' | 'risk';
type HotelView = 'list' | 'form' | 'detail';
type HotelFormMode = 'new' | 'edit';
type TripDiagnosisSet = {
  hotel?: HotelCompatibilityDiagnosis;
  itinerary?: TravelDiagnosis;
  risk?: RiskDiagnosis;
  updatedAt?: string;
};
type DiagnosisMap = Record<string, TripDiagnosisSet>;

const storageKey = 'tripcheck-mvp-state-v1';

const emptyTravel: Travel = {
  id: '',
  name: '',
  startDate: '',
  endDate: '',
  origin: '',
  transport: '電車',
  companion: '一人',
  people: null,
  budget: null,
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

const emptyItinerary: ItineraryItem[] = [];

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
];

const tabIcons: Record<string, React.ElementType> = {
  ホーム: House,
  旅行登録: Plus,
  宿診断: Bed,
  リスク診断: ShieldAlert,
};

const mobileTabLabels: Record<string, string> = {
  旅行登録: '登録',
  リスク診断: 'リスク',
};

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

function currency(value: number | null | undefined) {
  if (value === null || value === undefined) return '未設定';
  return new Intl.NumberFormat('ja-JP').format(value);
}

function clampPercent(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function countTightGaps(itineraryItems: ItineraryItem[]) {
  const ordered = [...itineraryItems].sort((a, b) =>
    `${a.date}T${a.start}`.localeCompare(`${b.date}T${b.start}`),
  );
  return ordered.slice(1).filter((item, index) => {
    const previous = ordered[index];
    return (
      item.date === previous.date &&
      toMinutes(item.start) - toMinutes(previous.end) < 25
    );
  }).length;
}

function scoreTone(score: number) {
  if (score >= 85) return 'text-emerald-700';
  if (score >= 70) return 'text-teal-700';
  return 'text-amber-700';
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label className="text-xs font-semibold text-slate-500">{children}</label>;
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
      className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm outline-none transition focus-visible:ring-3 focus-visible:ring-ring/50"
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
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
  placeholder?: string;
}) {
  return (
    <select
      aria-label={label}
      className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm outline-none transition focus-visible:ring-3 focus-visible:ring-ring/50"
      onChange={(event) => onChange(event.target.value)}
      value={value}
    >
      {placeholder && <option value="">{placeholder}</option>}
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
  if (level === 2) return 'bg-teal-500';
  if (level === 3) return 'bg-emerald-600';
  return 'bg-amber-500';
}

function priorityLabel(level: number) {
  return ['低', '中', '高', '最優先'][Math.min(4, Math.max(1, level)) - 1];
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
  const displayValue = Math.min(4, Math.max(1, value));
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium text-slate-600">予定の優先度</span>
        <span className="rounded-full bg-emerald-50 px-2 py-0.5 font-semibold text-emerald-800">
          {priorityLabel(displayValue)}
        </span>
      </div>
      <div
        aria-label={label}
        className="inline-grid grid-cols-4 gap-1"
      >
        {[4, 3, 2, 1].map((level) => (
          <button
            aria-pressed={displayValue === level}
            aria-label={`優先度 ${priorityLabel(level)}`}
            className={`h-8 w-14 rounded-md border transition ${
              level === displayValue
                ? `${priorityColor(level)} border-transparent shadow-sm`
                : 'border-slate-200 bg-slate-50'
            } ${displayValue === level ? 'ring-2 ring-emerald-900/20' : ''}`}
            key={level}
            onClick={() => onChange(level)}
            type="button"
          >
            <span
              className={`text-xs font-semibold ${
                level === displayValue ? 'text-white' : 'text-slate-500'
              }`}
            >
              {priorityLabel(level)}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

function WeatherGlyph({ kind }: { kind: WeatherKind }) {
  const icons: Record<WeatherKind, React.ElementType> = {
    sunny: CloudSun,
    cloudy: Cloud,
    fog: CloudFog,
    rain: CloudRain,
    snow: CloudSnow,
    storm: CloudLightning,
  };
  const Icon = icons[kind];
  return <Icon className="size-5" />;
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
    <div className="trip-score-tile min-w-0 rounded-lg p-3 sm:p-4">
      <div className="space-y-2.5">
        <div className="flex items-start justify-between gap-1.5 sm:gap-3">
          <div className="flex min-w-0 items-center gap-1.5 text-xs font-medium text-slate-600 sm:text-sm">
            <span className="grid size-7 shrink-0 place-items-center rounded-md bg-teal-50 text-teal-700 sm:size-8">
              <Icon className="size-3.5 sm:size-4" />
            </span>
            <span className="truncate">{title}</span>
          </div>
          <span className={`text-xl font-semibold sm:text-2xl ${scoreTone(value)}`}>
            {value}
          </span>
        </div>
        <Progress value={value} className="h-1.5" />
        <p className="hidden text-xs leading-relaxed text-slate-500 sm:block">
          {caption}
        </p>
      </div>
    </div>
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
  const [hotelView, setHotelView] = useState<HotelView>('list');
  const [hotelFormMode, setHotelFormMode] = useState<HotelFormMode>('new');
  const [isHeaderMenuOpen, setIsHeaderMenuOpen] = useState(false);
  const [preference, setPreference] =
    useState<UserTravelPreference>(mockPreference);
  const [travel, setTravel] = useState<Travel>(emptyTravel);
  const [accommodation, setAccommodation] =
    useState<Accommodation>(emptyAccommodation);
  const [itinerary, setItinerary] = useState<ItineraryItem[]>([]);
  const [review, setReview] = useState<TravelReview>(emptyReview);
  const [trips, setTrips] = useState<TripRecord[]>([]);
  const [selectedTripId, setSelectedTripId] = useState<string | null>(null);
  const [riskDetailTripId, setRiskDetailTripId] = useState<string | null>(null);
  const [detailTripId, setDetailTripId] = useState<string | null>(null);
  const [riskPlanTripId, setRiskPlanTripId] = useState<string | null>(null);
  const [detailReturnTab, setDetailReturnTab] = useState('ホーム');
  const [tripFilter, setTripFilter] = useState<TripListFilter>('all');
  const [tripSort, setTripSort] = useState<TripListSort>('date');
  const [previousItinerary, setPreviousItinerary] = useState<
    ItineraryItem[] | null
  >(null);
  const [selectedImprovementIds, setSelectedImprovementIds] = useState<string[]>([]);
  const [diagnoses, setDiagnoses] = useState<DiagnosisMap>({});
  const [diagnosisBusy, setDiagnosisBusy] = useState<DiagnosisKind | null>(null);
  const [diagnosisMessage, setDiagnosisMessage] = useState('');
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [pendingDeleteTripId, setPendingDeleteTripId] = useState<string | null>(null);
  const [pendingDeleteHotelId, setPendingDeleteHotelId] = useState<string | null>(null);
  const [deletingTripId, setDeletingTripId] = useState<string | null>(null);
  const [saveState, setSaveState] = useState('端末内に自動保存');
  const [tripWeather, setTripWeather] = useState<TripWeather | null>(null);
  const [tripWeatherLoading, setTripWeatherLoading] = useState(false);
  const [tripWeatherMessage, setTripWeatherMessage] = useState('');
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
      if (stored.itinerary) {
        setItinerary(
          normalizeItineraryDates(
            stored.itinerary,
            stored.travel?.startDate || '',
          ),
        );
      }
      if (stored.review) setReview(stored.review);
      if (stored.trips) {
        setTrips(
          stored.trips.map((record) => ({
            ...record,
            itinerary: normalizeItineraryDates(
              record.itinerary,
              record.travel.startDate,
            ),
          })),
        );
      }
      if (stored.diagnoses) setDiagnoses(stored.diagnoses);
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
    void getCurrentUserEmail()
      .then((email) => setAuthUserEmail(email ?? null))
      .catch(() => setAuthUserEmail(null));
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
      diagnoses,
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
    diagnoses,
  ]);

  const currentTripId = selectedTripId ?? travel.id;
  const isEditingSavedTrip = Boolean(
    selectedTripId && trips.some((trip) => trip.id === selectedTripId),
  );
  const hotelDiagnosis = useMemo(
    () =>
      diagnoses[currentTripId]?.hotel ??
      mockAiProvider.diagnoseHotel(preference, accommodation),
    [diagnoses, currentTripId, preference, accommodation],
  );
  const itineraryDiagnosis = useMemo(
    () =>
      diagnoses[currentTripId]?.itinerary ??
      mockAiProvider.judgeItinerary(travel, accommodation, itinerary),
    [diagnoses, currentTripId, travel, accommodation, itinerary],
  );
  const itineraryImprovementOptions = useMemo<ItineraryImprovementOption[]>(() => {
    const aiOptions = (itineraryDiagnosis.improvements ?? [])
      .filter((option) => itinerary.some((item) => item.id === option.targetItemId))
      .map((option) => ({
        id: option.id,
        title: option.title,
        detail: option.detail,
        apply: (items: ItineraryItem[]) =>
          items.map((item) =>
            item.id === option.targetItemId
              ? {
                  ...item,
                  ...(option.start ? { start: option.start } : {}),
                  ...(option.end ? { end: option.end } : {}),
                }
              : item,
          ),
      }));
    return aiOptions.length
      ? aiOptions
      : buildDynamicImprovements(itinerary, accommodation);
  }, [itineraryDiagnosis.improvements, itinerary, accommodation]);
  const riskDetailTrip = useMemo(
    () =>
      trips.find((trip) => trip.id === riskDetailTripId) ?? trips[0] ?? null,
    [trips, riskDetailTripId],
  );
  const riskDetailDiagnosis = useMemo(
    () =>
      riskDetailTrip
        ? diagnoses[riskDetailTrip.id]?.risk ?? buildContextualRisk(riskDetailTrip)
        : null,
    [diagnoses, riskDetailTrip],
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
    const futureTrips = trips
      .filter((trip) => isCurrentOrFutureTrip(trip))
      .sort((a, b) => tripDateTime(a) - tripDateTime(b));
    return futureTrips[0] ?? null;
  }, [trips]);
  const pendingDeleteTrip = useMemo(
    () => trips.find((trip) => trip.id === pendingDeleteTripId) ?? null,
    [trips, pendingDeleteTripId],
  );
  const registeredHotels = useMemo(
    () => trips.filter((trip) => trip.accommodation.name.trim()),
    [trips],
  );
  const hotelRegistrationTargets = useMemo(
    () => trips.filter((trip) => !trip.accommodation.name.trim()),
    [trips],
  );
  const pendingDeleteHotel = useMemo(
    () => trips.find((trip) => trip.id === pendingDeleteHotelId) ?? null,
    [trips, pendingDeleteHotelId],
  );
  const detailTrip = useMemo(
    () =>
      trips.find((trip) => trip.id === detailTripId) ??
      trips.find((trip) => trip.id === selectedTripId) ??
      nearestTrip ??
      null,
    [trips, detailTripId, selectedTripId, nearestTrip],
  );
  const detailRiskDiagnosis = useMemo(
    () =>
      detailTrip
        ? diagnoses[detailTrip.id]?.risk ?? buildContextualRisk(detailTrip)
        : null,
    [diagnoses, detailTrip],
  );
  const detailHotelDiagnosis = useMemo(
    () =>
      detailTrip
        ? diagnoses[detailTrip.id]?.hotel ??
          mockAiProvider.diagnoseHotel(preference, detailTrip.accommodation)
        : null,
    [diagnoses, preference, detailTrip],
  );
  const detailItineraryDiagnosis = useMemo(
    () =>
      detailTrip
        ? diagnoses[detailTrip.id]?.itinerary ??
          mockAiProvider.judgeItinerary(
            detailTrip.travel,
            detailTrip.accommodation,
            detailTrip.itinerary,
          )
        : null,
    [diagnoses, detailTrip],
  );
  const detailAvoidancePlans = useMemo(
    () =>
      detailTrip && detailRiskDiagnosis
        ? buildAvoidancePlans(detailTrip, detailRiskDiagnosis).slice(0, 3)
        : [],
    [detailTrip, detailRiskDiagnosis],
  );
  const topTravel = nearestTrip?.travel ?? emptyTravel;
  const topAccommodation = nearestTrip?.accommodation ?? emptyAccommodation;
  const topItinerary = nearestTrip?.itinerary ?? emptyItinerary;
  const topHotelDiagnosis = useMemo(
    () =>
      (nearestTrip ? diagnoses[nearestTrip.id]?.hotel : undefined) ??
      mockAiProvider.diagnoseHotel(preference, topAccommodation),
    [diagnoses, nearestTrip, preference, topAccommodation],
  );
  const topItineraryDiagnosis = useMemo(
    () =>
      (nearestTrip ? diagnoses[nearestTrip.id]?.itinerary : undefined) ??
      mockAiProvider.judgeItinerary(topTravel, topAccommodation, topItinerary),
    [diagnoses, nearestTrip, topTravel, topAccommodation, topItinerary],
  );
  const topRiskDiagnosis = useMemo(
    () =>
      (nearestTrip ? diagnoses[nearestTrip.id]?.risk : undefined) ??
      buildContextualRisk({
        id: nearestTrip?.id ?? 'top',
        travel: topTravel,
        accommodation: topAccommodation,
        itinerary: topItinerary,
        review: nearestTrip?.review ?? emptyReview,
      }),
    [diagnoses, nearestTrip, topTravel, topAccommodation, topItinerary],
  );
  const nextActions = useMemo(
    () => buildNextActions(nearestTrip, topRiskDiagnosis),
    [nearestTrip, topRiskDiagnosis],
  );
  const displayedTrips = useMemo(() => {
    const rows = trips.map((trip) => ({
      trip,
      risk: diagnoses[trip.id]?.risk ?? buildContextualRisk(trip),
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
        const aUpcoming = isCurrentOrFutureTrip(a.trip);
        const bUpcoming = isCurrentOrFutureTrip(b.trip);
        if (aUpcoming !== bUpcoming) return aUpcoming ? -1 : 1;
        return tripDateTime(a.trip) - tripDateTime(b.trip);
      });
  }, [diagnoses, trips, tripFilter, tripSort]);
  const topSchedule = nearestTrip ? tripScheduleLabel(nearestTrip) : null;
  const weatherLocation =
    topAccommodation.location.trim() || topTravel.name.trim();
  const weatherDate = topTravel.startDate
    ? topTravel.startDate < new Date().toLocaleDateString('sv-SE')
      ? new Date().toLocaleDateString('sv-SE')
      : topTravel.startDate
    : '';

  useEffect(() => {
    const controller = new AbortController();
    setTripWeather(null);
    setTripWeatherMessage('');

    if (!nearestTrip || !weatherDate) {
      setTripWeatherLoading(false);
      return () => controller.abort();
    }
    if (!weatherLocation) {
      setTripWeatherLoading(false);
      setTripWeatherMessage('宿の所在地を登録すると天気を表示できます');
      return () => controller.abort();
    }

    const today = new Date().toLocaleDateString('sv-SE');
    const forecastDays = Math.round(
      (Date.parse(`${weatherDate}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) /
        86_400_000,
    );
    if (forecastDays > 15) {
      setTripWeatherLoading(false);
      setTripWeatherMessage('天気予報は出発16日前から表示されます');
      return () => controller.abort();
    }

    setTripWeatherLoading(true);
    void fetchTripWeather(weatherLocation, weatherDate, controller.signal)
      .then((result) => setTripWeather(result))
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setTripWeatherMessage(errorMessage(error));
      })
      .finally(() => {
        if (!controller.signal.aborted) setTripWeatherLoading(false);
      });

    return () => controller.abort();
  }, [nearestTrip, weatherDate, weatherLocation]);

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
    const errors = trips.flatMap((trip) =>
      validateTripRecord(trip).map((error) => `${trip.travel.name || '名称未設定'}: ${error}`),
    );
    if (errors.length) {
      setAuthMessage(`AWS保存の前に入力を修正してください。${errors[0]}`);
      return;
    }
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
      const [profileResult, tripsResult] = await Promise.allSettled([
        cloudApi.getProfile(),
        cloudApi.listTrips(),
      ]);
      if (tripsResult.status === 'rejected') throw tripsResult.reason;
      if (profileResult.status === 'fulfilled') setPreference(profileResult.value);
      const loadedTrips = tripsResult.value.items.map((record) => ({
        ...record,
        itinerary: normalizeItineraryDates(
          record.itinerary,
          record.travel.startDate,
        ),
      }));
      setTrips(loadedTrips);
      setSelectedTripId(null);
      setRiskDetailTripId(loadedTrips[0]?.id ?? null);
      setDetailTripId(null);
      setActiveTab('ホーム');
      setAuthMessage(`${loadedTrips.length}件の旅行をAWSから読み込みました`);
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

  function updateMoveRoute(
    id: string,
    field: 'departurePlace' | 'arrivalPlace',
    value: string,
  ) {
    setItinerary((items) =>
      items.map((item) => {
        if (item.id !== id) return item;
        const departurePlace =
          field === 'departurePlace' ? value : item.departurePlace || '';
        const arrivalPlace =
          field === 'arrivalPlace' ? value : item.arrivalPlace || '';
        return {
          ...item,
          departurePlace,
          arrivalPlace,
          place: arrivalPlace || departurePlace,
          title:
            departurePlace && arrivalPlace
              ? `${departurePlace} → ${arrivalPlace}`
              : '移動',
        };
      }),
    );
  }

  function addItineraryItem() {
    setItinerary((items) => [
      ...items,
      {
        id: `i${Date.now()}`,
        date: travel.startDate,
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
    setSelectedImprovementIds([]);
    setValidationErrors([]);
    setDiagnosisMessage('');
    setActiveTab('旅行登録');
    setSaveState('新規旅行を作成中');
  }

  function saveCurrentTrip() {
    const id = selectedTripId || travel.id || `travel-${Date.now()}`;
    const savedTravel = {
      ...travel,
      id,
      name: travel.name.trim(),
    };
    const record: TripRecord = {
      id,
      travel: savedTravel,
      accommodation,
      itinerary,
      review,
    };

    const errors = validateTripRecord(record);
    if (errors.length) {
      setValidationErrors(errors);
      setSaveState('入力内容を確認してください');
      return false;
    }

    setValidationErrors([]);
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
    return true;
  }

  function editTrip(record: TripRecord) {
    setTravel(record.travel);
    setAccommodation(record.accommodation);
    setItinerary(record.itinerary);
    setReview(record.review);
    setSelectedTripId(record.id);
    setDetailTripId(record.id);
    setPreviousItinerary(null);
    setSelectedImprovementIds([]);
    setValidationErrors([]);
    setDiagnosisMessage('');
    setActiveTab('旅行登録');
    setSaveState(`${record.travel.name}を表示中`);
  }

  function loadHotelTrip(record: TripRecord, nextAccommodation: Accommodation) {
    setTravel(record.travel);
    setAccommodation(nextAccommodation);
    setItinerary(record.itinerary);
    setReview(record.review);
    setSelectedTripId(record.id);
    setDetailTripId(record.id);
    setValidationErrors([]);
    setDiagnosisMessage('');
  }

  function openNewHotelForm(record?: TripRecord) {
    const target =
      record ??
      hotelRegistrationTargets.find((trip) => trip.id === selectedTripId) ??
      hotelRegistrationTargets[0];
    if (!target) {
      if (trips.length === 0) {
        startNewTrip();
        setSaveState('宿を登録する旅行を先に入力してください');
      } else {
        setSaveState('すべての旅行に宿が登録済みです。宿の編集を使用してください');
      }
      return;
    }
    loadHotelTrip(target, emptyAccommodation);
    setHotelFormMode('new');
    setHotelView('form');
    setActiveTab('宿診断');
    setSaveState(`${target.travel.name}の宿を新規登録中`);
  }

  function openHotelFormFromTravel() {
    setHotelFormMode(accommodation.name.trim() ? 'edit' : 'new');
    setHotelView('form');
    setActiveTab('宿診断');
  }

  function editHotel(record: TripRecord) {
    loadHotelTrip(record, record.accommodation);
    setHotelFormMode('edit');
    setHotelView('form');
    setActiveTab('宿診断');
    setSaveState(`${record.accommodation.name}を編集中`);
  }

  function openHotelDetail(record: TripRecord) {
    loadHotelTrip(record, record.accommodation);
    setHotelView('detail');
    setActiveTab('宿診断');
    setSaveState(`${record.accommodation.name}の詳細を表示中`);
  }

  function saveHotel() {
    if (!accommodation.name.trim()) {
      setValidationErrors(['宿泊施設名を入力してください']);
      setSaveState('入力内容を確認してください');
      return;
    }
    if (saveCurrentTrip()) setHotelView('list');
  }

  async function deleteHotel(record: TripRecord) {
    const updatedRecord = { ...record, accommodation: emptyAccommodation };
    try {
      if (authUserEmail) await cloudApi.saveTrip(updatedRecord);
      setTrips((items) =>
        items.map((item) => (item.id === record.id ? updatedRecord : item)),
      );
      setDiagnoses((current) => ({
        ...current,
        [record.id]: { ...current[record.id], hotel: undefined },
      }));
      if (selectedTripId === record.id) setAccommodation(emptyAccommodation);
      setPendingDeleteHotelId(null);
      setHotelView('list');
      setSaveState(`${record.accommodation.name}を削除しました`);
    } catch (error) {
      setSaveState(errorMessage(error));
    }
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
    setSelectedImprovementIds([]);
    setActiveTab('旅行詳細');
    setSaveState(`${record.travel.name}の詳細を表示中`);
  }

  function showRiskPlanInTripDetail(record: TripRecord) {
    setRiskPlanTripId(record.id);
    openTripDetail(record, 'リスク診断');
  }

  function applyImprovement() {
    const selectedImprovements = itineraryImprovementOptions.filter((option) =>
      selectedImprovementIds.includes(option.id),
    );
    if (selectedImprovements.length === 0) return;

    setPreviousItinerary(itinerary);
    setItinerary(
      selectedImprovements.reduce(
        (items, option) => option.apply(items),
        itinerary,
      ),
    );
    setSaveState(
      `${selectedImprovements.length}件の改善案を反映しました。保存すると旅行一覧へ反映されます`,
    );
  }

  function undoImprovement() {
    if (!previousItinerary) return;
    setItinerary(previousItinerary);
    setPreviousItinerary(null);
    setSelectedImprovementIds([]);
    setSaveState('改善前の旅程へ戻しました');
  }

  function currentTripRecord(): TripRecord {
    const id = selectedTripId || travel.id || `travel-${Date.now()}`;
    return {
      id,
      travel: { ...travel, id, name: travel.name.trim() },
      accommodation,
      itinerary,
      review,
    };
  }

  async function runAiDiagnosis(kind: DiagnosisKind, record = currentTripRecord()) {
    setDiagnosisMessage('');
    if (!authUserEmail) {
      setDiagnosisMessage('AI診断を実行するには、左上メニューのプロフィールからログインしてください');
      return;
    }
    const errors = validateTripRecord(record);
    if (errors.length) {
      setValidationErrors(errors);
      setDiagnosisMessage('旅行の入力内容を確認してからAI診断を実行してください');
      return;
    }
    if (kind === 'hotel' && !record.accommodation.name.trim()) {
      setDiagnosisMessage('宿泊施設名を入力してください');
      return;
    }

    setDiagnosisBusy(kind);
    try {
      const result =
        kind === 'hotel'
          ? await cloudApi.diagnose<HotelCompatibilityDiagnosis>(
              'hotel',
              record,
              preference,
            )
          : kind === 'itinerary'
            ? await cloudApi.diagnose<TravelDiagnosis>(
                'itinerary',
                record,
                preference,
              )
            : await cloudApi.diagnose<RiskDiagnosis>('risk', record, preference);
      setDiagnoses((current) => ({
        ...current,
        [record.id]: {
          ...current[record.id],
          [kind]: result,
          updatedAt: new Date().toISOString(),
        },
      }));
      setDiagnosisMessage('AI診断が完了しました');
    } catch (error) {
      setDiagnosisMessage(errorMessage(error));
    } finally {
      setDiagnosisBusy(null);
    }
  }

  async function deleteTripRecord(record: TripRecord) {
    setDeletingTripId(record.id);
    try {
      if (authUserEmail) await cloudApi.deleteTrip(record.id);
      setTrips((items) => items.filter((item) => item.id !== record.id));
      setDiagnoses((current) => {
        const next = { ...current };
        delete next[record.id];
        return next;
      });
      if (selectedTripId === record.id) {
        setTravel(emptyTravel);
        setAccommodation(emptyAccommodation);
        setItinerary([]);
        setReview(emptyReview);
        setSelectedTripId(null);
        setPreviousItinerary(null);
        setSelectedImprovementIds([]);
      }
      if (riskDetailTripId === record.id) setRiskDetailTripId(null);
      if (detailTripId === record.id) setDetailTripId(null);
      setPendingDeleteTripId(null);
      setSaveState(`${record.travel.name}を削除しました`);
    } catch (error) {
      setSaveState(errorMessage(error));
    } finally {
      setDeletingTripId(null);
    }
  }

  return (
    <main className="trip-app fixed inset-0 overflow-hidden bg-[var(--app-bg)] text-slate-900">
      <div className="mx-auto flex h-full min-h-0 w-full max-w-6xl flex-col overflow-y-auto overscroll-y-contain px-4 pb-4 pt-[calc(env(safe-area-inset-top)+5.75rem)] sm:px-6 lg:px-8">
        <header className="fixed inset-x-0 top-0 z-50 border-b border-emerald-950/8 bg-[#fbfdfc]/98 pt-[env(safe-area-inset-top)] shadow-[0_8px_30px_rgb(15_23_42/7%)] backdrop-blur-xl">
          <div className="mx-auto w-full max-w-6xl px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between gap-3">
            <div className="relative flex min-w-0 items-center gap-2 sm:gap-3">
              <button
                aria-controls="account-menu"
                aria-expanded={isHeaderMenuOpen}
                aria-label="メニュー"
                className="grid size-10 shrink-0 place-items-center rounded-lg border border-emerald-700 bg-[#0f5a49] text-white shadow-md shadow-emerald-950/15 transition hover:bg-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 focus-visible:ring-offset-2"
                onClick={() => setIsHeaderMenuOpen((open) => !open)}
                type="button"
              >
                <Menu className="size-5" />
              </button>
              {isHeaderMenuOpen && (
                <div
                  className="absolute left-0 top-[calc(100%+0.75rem)] z-40 grid w-[min(78vw,260px)] gap-1.5 rounded-lg border border-emerald-950/10 bg-white p-2 shadow-2xl shadow-slate-950/15"
                  id="account-menu"
                >
                  {[
                    { label: 'プロフィール', icon: UserRound },
                    { label: 'プラン', icon: CreditCard },
                    { label: '使い方', icon: CircleHelp },
                  ].map(({ label, icon: MenuIcon }) => (
                    <button
                      className={`flex min-h-11 items-center gap-3 rounded-md px-3 text-left text-sm font-medium transition ${
                        activeTab === label
                          ? 'bg-emerald-900 text-white'
                          : 'text-slate-700 hover:bg-emerald-50 hover:text-emerald-950'
                      }`}
                      key={label}
                      onClick={() => {
                        setActiveTab(label);
                        setIsHeaderMenuOpen(false);
                      }}
                      type="button"
                    >
                      <MenuIcon className="size-4" />
                      {label}
                    </button>
                  ))}
                </div>
              )}
              <div className="min-w-0">
                <p
                  aria-label="TripInsight"
                  className="brand-wordmark text-[1.45rem] leading-none text-[#123f36] sm:text-[1.6rem]"
                >
                  <span>Trip</span>
                  <span className="text-[#15937c]">Insight</span>
                </p>
                <p className="hidden text-[11px] font-medium text-slate-500 sm:block">
                  旅行の失敗を事前に見つけるAI
                </p>
              </div>
            </div>
            <Button
              aria-label="新しい旅行を診断"
              className="size-10 rounded-lg bg-[#123f36] p-0 shadow-md shadow-emerald-950/15 hover:bg-[#0f5a49] sm:h-9 sm:w-auto sm:px-3"
              onClick={startNewTrip}
            >
              <Plus className="size-4" />
              <span className="hidden sm:inline">新しい旅行を診断</span>
            </Button>
          </div>
          <p className="mt-2 flex min-w-0 items-center gap-2 overflow-hidden text-[11px] font-medium text-slate-400">
            <span className="size-1.5 shrink-0 rounded-full bg-teal-500 shadow-[0_0_0_3px_rgb(20_184_166/10%)]" />
            <span className="truncate">{saveState}</span>
          </p>
          </div>
        </header>

        {activeTab === 'ホーム' && (
          <section className="grid gap-4 py-5 lg:grid-cols-[1.16fr_0.84fr]">
          {nearestTrip ? (
          <>
          <Card className="trip-hero-card overflow-hidden rounded-lg border-0 text-white">
            <CardContent className="space-y-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="space-y-2">
                  {topSchedule && (
                    <Badge className="w-fit bg-[#c9f2e5] text-[#123f36] ring-1 ring-white/20">
                      {topSchedule === '旅行中' ? topSchedule : `次の旅行まで${topSchedule.replace('出発まで', '')}`}
                    </Badge>
                  )}
                  <div>
                    <h1 className="text-2xl font-semibold leading-tight text-white sm:text-3xl">
                      {topTravel.name || '予定された旅行'}
                    </h1>
                    <p className="mt-2 flex flex-wrap items-center gap-2 text-sm text-emerald-100/80">
                      <MapPin className="size-4" />
                      {topTravel.origin || '出発地未設定'}発 /{' '}
                      {topTravel.companion} / {topTravel.people ?? '人数未設定'}
                      {topTravel.people !== null && '名'}
                    </p>
                    <p className="mt-1.5 flex flex-wrap items-center gap-2 text-sm text-emerald-100/80">
                      <CalendarDays className="size-4" />
                      {topTravel.startDate || '日程未設定'} -{' '}
                      {topTravel.endDate || '日程未設定'} /{' '}
                      {topAccommodation.name || '宿未設定'} / 旅程
                      {topItinerary.length}件
                    </p>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 sm:gap-3">
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
              <section
                aria-label="次の旅行先の天気"
                className="border-t border-white/15 pt-4"
              >
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="flex items-center gap-2 text-sm font-semibold text-white">
                      <CloudSun className="size-4 text-[#c9f2e5]" />
                      旅行先の天気
                    </p>
                    <p className="mt-1 text-xs text-emerald-50">
                      {tripWeather
                        ? `${tripWeather.locationName} / ${tripWeather.date.replaceAll('-', '/')}`
                        : weatherLocation || '場所未設定'}
                    </p>
                  </div>
                  {tripWeather && (
                    <a
                      className="text-[10px] font-medium text-emerald-50 underline underline-offset-2"
                      href="https://open-meteo.com/"
                      rel="noreferrer"
                      target="_blank"
                    >
                      Open-Meteo予報
                    </a>
                  )}
                </div>
                {tripWeatherLoading ? (
                  <div className="grid grid-cols-3 gap-2">
                    {['朝', '昼', '晩'].map((label) => (
                      <div
                        className="min-h-24 animate-pulse rounded-md bg-white/10 p-3"
                        key={label}
                      >
                        <p className="text-xs font-semibold text-white">{label}</p>
                        <p className="mt-3 text-xs text-emerald-50">天気を取得中...</p>
                      </div>
                    ))}
                  </div>
                ) : tripWeather ? (
                  <div className="grid grid-cols-3 gap-2 sm:gap-3">
                    {tripWeather.periods.map((period) => (
                      <div
                        className="min-w-0 rounded-md bg-white/95 p-3 text-[#123f36] shadow-sm"
                        key={period.key}
                      >
                        <div className="flex items-center justify-between gap-1">
                          <p className="text-xs font-semibold">
                            {period.label}
                            <span className="ml-1 font-normal text-slate-600">
                              {period.time}
                            </span>
                          </p>
                          <WeatherGlyph kind={period.kind} />
                        </div>
                        <p className="mt-2 text-lg font-semibold leading-none">
                          {period.temperature}°
                        </p>
                        <p className="mt-1 truncate text-xs font-medium">
                          {period.description}
                        </p>
                        <p className="mt-2 flex items-center gap-1 text-[11px] font-medium text-slate-700">
                          <Umbrella className="size-3" />
                          {period.precipitationProbability}%
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="rounded-md bg-white/10 px-3 py-3 text-sm text-emerald-50">
                    {tripWeatherMessage || '天気予報を表示できません'}
                  </p>
                )}
              </section>
            </CardContent>
          </Card>

          <Card className="rounded-lg border-amber-200/70 bg-[#fffaf0] shadow-sm">
            <CardHeader className="pb-1">
              <CardTitle className="flex items-center gap-3 text-amber-950">
                <span className="grid size-9 place-items-center rounded-lg bg-amber-100 text-amber-800">
                  <AlertTriangle className="size-4" />
                </span>
                <span>
                  <span className="block text-[10px] font-semibold text-amber-700">
                    TRAVEL ALERT
                  </span>
                  <span className="block">重要な注意</span>
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm leading-relaxed text-amber-950">
                {topRiskDiagnosis.critical}
              </p>
              <div className="rounded-lg border border-amber-200/60 bg-white/75 p-3 text-sm text-slate-700">
                <p className="text-xs font-semibold text-amber-900">
                  次にやるべきこと
                </p>
                <ul className="mt-2 space-y-2 text-sm">
                  {nextActions.map((action) => (
                    <li className="flex gap-2" key={action}>
                      <Check className="mt-0.5 size-4 shrink-0 text-teal-700" />
                      <span>{action}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </CardContent>
          </Card>
          </>
          ) : (
            <Card className="rounded-lg border-emerald-950/10 bg-white shadow-sm lg:col-span-2">
              <CardContent className="flex flex-col items-start gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-lg font-semibold text-slate-900">次の旅行はまだありません</p>
                  <p className="mt-1 text-sm text-slate-600">
                    旅行を登録すると、宿・旅程・当日リスクの診断が表示されます。
                  </p>
                </div>
                <Button onClick={startNewTrip}>
                  <Plus className="size-4" />
                  旅行を登録
                </Button>
              </CardContent>
            </Card>
          )}
          </section>
        )}

        <nav
          aria-label="メインメニュー"
          className="fixed inset-x-0 bottom-0 z-40 mx-auto grid w-full max-w-6xl grid-cols-4 rounded-t-lg border-x-0 border-b-0 border-t border-emerald-950/10 bg-[#fbfdfc]/98 px-1 pt-1.5 pb-[env(safe-area-inset-bottom)] shadow-[0_-10px_30px_rgb(15_23_42/12%)] backdrop-blur-xl sm:flex sm:gap-1 sm:border-emerald-950/8 sm:px-2 sm:py-2"
        >
          {tabs.map((tab) => {
            const TabIcon = tabIcons[tab];
            return (
              <button
                aria-current={activeTab === tab ? 'page' : undefined}
                aria-label={tab}
                key={tab}
                className={`flex min-w-0 flex-col items-center justify-center gap-0.5 rounded-md px-1 py-1 text-[10px] font-medium transition sm:h-9 sm:flex-row sm:gap-1.5 sm:px-3 sm:py-2 sm:text-sm ${
                  activeTab === tab
                    ? 'text-[#0f5a49]'
                    : 'text-slate-400 hover:bg-emerald-50 hover:text-emerald-900'
                }`}
                onClick={() => {
                  if (tab === '宿診断') setHotelView('list');
                  setActiveTab(tab);
                  setIsHeaderMenuOpen(false);
                }}
                type="button"
              >
                <span
                  className={`grid size-7 place-items-center rounded-md transition sm:size-auto ${
                    activeTab === tab
                      ? 'bg-[#123f36] text-white shadow-sm'
                      : 'bg-transparent'
                  }`}
                >
                  <TabIcon className="size-4" />
                </span>
                <span className="max-w-full truncate sm:hidden">
                  {mobileTabLabels[tab] || tab}
                </span>
                <span className="hidden sm:inline">{tab}</span>
              </button>
            );
          })}
        </nav>

        <section
          className={`grid flex-1 gap-4 pb-28 pt-4 sm:pb-20 ${
            activeTab === 'ホーム'
              ? 'lg:grid-cols-[minmax(0,1fr)_340px]'
              : 'lg:grid-cols-1'
          }`}
        >
          <div className="space-y-4">
            {activeTab === 'ホーム' && (
              <div className="grid gap-4">
                {nearestTrip && (
                <>
                <Card className="rounded-lg border-emerald-950/8 bg-white/90 shadow-sm">
                  <CardHeader className="pb-2">
                    <CardTitle className="flex flex-wrap items-center justify-between gap-3">
                      <span className="flex items-center gap-3">
                        <span className="grid size-9 place-items-center rounded-lg bg-teal-50 text-teal-700">
                          <ListFilter className="size-4" />
                        </span>
                        <span>
                          <span className="block text-[10px] font-semibold text-teal-700">
                            MY TRIPS
                          </span>
                          <span className="block">予定された旅行</span>
                        </span>
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
                        const tripSchedule = tripScheduleLabel(trip);
                        const isSelected = selectedTripId === trip.id;
                        const tone = riskTone(risk.riskPercent);
                        return (
                          <div
                            key={trip.id}
                            className={`group grid gap-3 rounded-lg border p-4 transition sm:grid-cols-[1fr_auto] ${
                              isSelected
                                ? 'border-teal-500 bg-teal-50/70 shadow-sm'
                                : 'border-slate-200/80 bg-[#fcfdfc] hover:border-teal-300 hover:shadow-sm'
                            }`}
                          >
                            <div className="space-y-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="font-semibold text-slate-900">
                                  {trip.travel.name}
                                </p>
                                <Badge className={tone.badge}>
                                  {risk.riskPercent}%
                                </Badge>
                                {missing && (
                                  <Badge variant="outline">未入力あり</Badge>
                                )}
                              </div>
                              <p className="text-xs leading-relaxed text-slate-500">
                                {trip.travel.startDate || '日程未設定'} -{' '}
                                {trip.travel.endDate || '日程未設定'} /{' '}
                                {trip.travel.transport} /{' '}
                                {trip.travel.people === null
                                  ? '人数未設定'
                                  : `${trip.travel.people}名`}
                              </p>
                              <p className="text-xs leading-relaxed text-slate-500">
                                {trip.accommodation.name || '宿未設定'} / 旅程{' '}
                                {trip.itinerary.length}件
                                {tripSchedule && ` / ${tripSchedule}`}
                              </p>
                              <p className="text-xs font-medium text-slate-500">
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
                                className="bg-[#123f36] shadow-sm hover:bg-[#0f5a49]"
                                onClick={() => openRiskDetail(trip)}
                              >
                                <ShieldAlert className="size-4" />
                                リスク診断
                              </Button>
                              <Button
                                aria-label={`${trip.travel.name}を削除`}
                                onClick={() => setPendingDeleteTripId(trip.id)}
                                variant="outline"
                              >
                                <Trash2 className="size-4" />
                                削除
                              </Button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </CardContent>
                </Card>
                <Card className="rounded-lg border-emerald-950/8 bg-white/90 shadow-sm">
                  <CardHeader className="space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <CardTitle>{nearestTrip.travel.name}の旅程診断</CardTitle>
                      <Badge variant="outline">
                        {diagnoses[nearestTrip.id]?.itinerary ? 'AI診断' : '参考診断'}
                      </Badge>
                    </div>
                    <p className="text-sm font-normal leading-relaxed text-slate-600">
                      登録された旅程の時間、移動手段、観光量、宿のチェックイン・食事時間から、移動効率や疲労リスクなどを100点満点で評価しています。
                    </p>
                  </CardHeader>
                  <CardContent className="grid gap-4 sm:grid-cols-2">
                    {Object.entries(topItineraryDiagnosis.categoryScores).map(
                      ([label, value]) => (
                        <MiniBar key={label} label={label} value={value} />
                      ),
                    )}
                  </CardContent>
                </Card>
                <Card className="rounded-lg border-emerald-950/8 bg-white/90 shadow-sm">
                  <CardHeader>
                    <CardTitle>
                      {diagnoses[nearestTrip.id]?.itinerary
                        ? 'AIが見つけた問題点'
                        : '参考診断で見つけた問題点'}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {topItineraryDiagnosis.issues.slice(0, 5).map((issue) => (
                      <div
                        key={issue}
                        className="flex gap-3 rounded-lg border border-slate-200/70 bg-[#fafbf9] p-3 text-sm text-slate-700"
                      >
                        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" />
                        {issue}
                      </div>
                    ))}
                  </CardContent>
                </Card>
                </>
                )}
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
                            戻る
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
                            {detailTrip.travel.people === null
                              ? '人数未設定'
                              : `${detailTrip.travel.people}名`}
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
                            {detailTrip.travel.budget === null
                              ? '未設定'
                              : `¥${currency(detailTrip.travel.budget)}`}
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

            {activeTab === '使い方' && (
              <Card className="rounded-lg border-emerald-950/10 bg-white shadow-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CircleHelp className="size-5 text-teal-700" />
                    TripInsightの使い方
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {[
                    {
                      title: '1. 旅行を登録',
                      description:
                        '旅行名、日程、出発地、同行者、予算を入力し、旅程と宿泊先を登録します。',
                      icon: Plus,
                    },
                    {
                      title: '2. 宿と旅程を確認',
                      description:
                        '宿診断で好みとの相性を確認し、編集時はAIの改善案から必要な項目だけを採用できます。',
                      icon: Bed,
                    },
                    {
                      title: '3. リスクを診断',
                      description:
                        '旅行ごとの注意点と回避プランを確認し、必要に応じて旅行プランを編集します。',
                      icon: ShieldAlert,
                    },
                  ].map(({ title, description, icon: GuideIcon }) => (
                    <div
                      className="flex gap-3 rounded-lg border border-slate-200 bg-slate-50/70 p-4"
                      key={title}
                    >
                      <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-emerald-900 text-white">
                        <GuideIcon className="size-4" />
                      </span>
                      <div>
                        <p className="font-medium text-slate-900">{title}</p>
                        <p className="mt-1 text-sm leading-relaxed text-slate-600">
                          {description}
                        </p>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
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
                          max={travel.endDate || undefined}
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
                          min={travel.startDate || undefined}
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
                          inputMode="numeric"
                          min="1"
                          onKeyDown={(event) => {
                            if (['e', 'E', '+', '-', '.'].includes(event.key)) {
                              event.preventDefault();
                            }
                          }}
                          step="1"
                          type="number"
                          value={travel.people ?? ''}
                          onChange={(event) =>
                            setTravel({
                              ...travel,
                              people:
                                event.target.value === ''
                                  ? null
                                  : Number(event.target.value),
                            })
                          }
                        />
                      </div>
                      <div className="min-w-0 space-y-1">
                        <FieldLabel>旅行予算</FieldLabel>
                        <Input
                          className="px-2"
                          inputMode="numeric"
                          min="0"
                          onKeyDown={(event) => {
                            if (['e', 'E', '+', '-', '.'].includes(event.key)) {
                              event.preventDefault();
                            }
                          }}
                          step="1"
                          type="number"
                          value={travel.budget ?? ''}
                          onChange={(event) =>
                            setTravel({
                              ...travel,
                              budget:
                                event.target.value === ''
                                  ? null
                                  : Number(event.target.value),
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

                    {validationErrors.length > 0 && (
                      <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900">
                        <p className="font-semibold">入力内容を確認してください</p>
                        <ul className="mt-2 space-y-1">
                          {validationErrors.map((error) => (
                            <li key={error}>・{error}</li>
                          ))}
                        </ul>
                      </div>
                    )}
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
                        onClick={openHotelFormFromTravel}
                      >
                        <Bed className="size-4" />
                        宿を入力する
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                {isEditingSavedTrip && (
                  <Card className="rounded-lg border-teal-200 bg-teal-50 shadow-sm">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Sparkles className="size-5 text-teal-700" />
                        AIで改善
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <p className="text-sm text-slate-700">
                        {itinerary.length === 0
                          ? '旅程を入力してください'
                          : '改善案は複数選択できます。AIが提案した時間と内容を確認し、まとめて旅程に反映できます。'}
                      </p>
                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          disabled={
                            diagnosisBusy === 'itinerary' || itinerary.length === 0
                          }
                          onClick={() => runAiDiagnosis('itinerary')}
                          variant="outline"
                        >
                          <Sparkles className="size-4" />
                          {diagnosisBusy === 'itinerary'
                            ? 'AI診断中...'
                            : 'AIで改善案を調査'}
                        </Button>
                        {diagnoses[currentTripId]?.itinerary && (
                          <Badge className="bg-emerald-100 text-emerald-800">
                            AI診断済み
                          </Badge>
                        )}
                      </div>
                      {diagnosisMessage && (
                        <p className="rounded-lg bg-white/80 p-3 text-sm text-slate-700">
                          {diagnosisMessage}
                        </p>
                      )}
                      <div className="grid gap-2 text-sm text-slate-700">
                        {itineraryImprovementOptions.length === 0 ? (
                          <p className="rounded-lg border border-teal-100 bg-white/70 p-3">
                            {itinerary.length === 0
                              ? '旅程を入力してください'
                              : '現在の旅程から自動適用できる改善案は見つかりませんでした。'}
                          </p>
                        ) : itineraryImprovementOptions.map((option) => {
                          const isChecked = selectedImprovementIds.includes(option.id);
                          return (
                            <div
                              className={`rounded-lg border p-3 transition ${
                                isChecked
                                  ? 'border-teal-600 bg-white shadow-sm'
                                  : 'border-teal-100 bg-teal-50/60 hover:bg-white'
                              }`}
                              key={option.id}
                            >
                              <label className="flex cursor-pointer gap-3">
                                <input
                                  aria-label={option.title}
                                  checked={isChecked}
                                  className="mt-1 size-4 accent-teal-700"
                                  onChange={() =>
                                    setSelectedImprovementIds((current) =>
                                      current.includes(option.id)
                                        ? current.filter((id) => id !== option.id)
                                        : [...current, option.id],
                                    )
                                  }
                                  type="checkbox"
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
                            </div>
                          );
                        })}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          className="bg-teal-800 hover:bg-teal-700"
                          disabled={selectedImprovementIds.length === 0}
                          onClick={applyImprovement}
                        >
                          <Check className="size-4" />
                          選択した改善案を採用
                        </Button>
                        <Button
                          disabled={!previousItinerary}
                          onClick={undoImprovement}
                          variant="outline"
                        >
                          <RotateCcw className="size-4" />
                          戻る
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}

                <Card className="rounded-lg border-emerald-950/10 bg-white shadow-sm">
                  <CardHeader>
                    <CardTitle>旅程</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex flex-wrap justify-start gap-2">
                      <Button variant="outline" onClick={addItineraryItem}>
                        <Plus className="size-4" />
                        予定を追加
                      </Button>
                    </div>
                    {itinerary.map((item) => (
                      <div
                        key={item.id}
                        className={`grid gap-3 rounded-lg border border-slate-200 p-3 sm:grid-cols-2 ${
                          item.category === '移動'
                            ? 'lg:grid-cols-[80px_minmax(150px,1fr)_minmax(150px,1fr)_136px_172px]'
                            : 'lg:grid-cols-[80px_minmax(220px,1.7fr)_136px_172px]'
                        }`}
                      >
                        <div className="flex items-center justify-end gap-2 sm:col-span-2 lg:col-span-full">
                          <Button
                            className="bg-teal-800 hover:bg-teal-700"
                            onClick={saveCurrentTrip}
                            size="sm"
                          >
                            <Save className="size-4" />
                            保存
                          </Button>
                          <Button
                            aria-label={`${item.title}を削除`}
                            className="border-rose-200 text-rose-700 hover:bg-rose-50 hover:text-rose-800"
                            onClick={() => removeItineraryItem(item.id)}
                            size="sm"
                            variant="outline"
                          >
                            <Trash2 className="size-4" />
                            削除
                          </Button>
                        </div>
                        <div className="w-20 max-w-full space-y-1.5">
                          <FieldLabel>項目</FieldLabel>
                          <SelectField
                            label={`${item.title}カテゴリ`}
                            options={itineraryCategoryOptions}
                            value={item.category}
                            onChange={(value) => {
                              const category = value as ItineraryItem['category'];
                              updateItinerary(item.id, {
                                category,
                                ...(category === '移動'
                                  ? {
                                      title: '移動',
                                      departurePlace:
                                        item.departurePlace || item.place,
                                      arrivalPlace: item.arrivalPlace || '',
                                    }
                                  : {}),
                              });
                            }}
                          />
                        </div>
                        {item.category === '移動' ? (
                          <>
                            <div className="space-y-1.5">
                              <FieldLabel>出発場所</FieldLabel>
                              <Input
                                aria-label="出発場所"
                                placeholder="例: 東京駅"
                                value={item.departurePlace || ''}
                                onChange={(event) =>
                                  updateMoveRoute(
                                    item.id,
                                    'departurePlace',
                                    event.target.value,
                                  )
                                }
                              />
                            </div>
                            <div className="space-y-1.5">
                              <FieldLabel>到着場所</FieldLabel>
                              <Input
                                aria-label="到着場所"
                                placeholder="例: 箱根湯本駅"
                                value={item.arrivalPlace || ''}
                                onChange={(event) =>
                                  updateMoveRoute(
                                    item.id,
                                    'arrivalPlace',
                                    event.target.value,
                                  )
                                }
                              />
                            </div>
                          </>
                        ) : (
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
                        )}
                        <div className="w-[8.5rem] max-w-full space-y-1.5">
                          <FieldLabel>日付</FieldLabel>
                          <Input
                            aria-label={`${item.title}日付`}
                            max={travel.endDate || undefined}
                            min={travel.startDate || undefined}
                            type="date"
                            value={item.date}
                            onChange={(event) =>
                              updateItinerary(item.id, { date: event.target.value })
                            }
                          />
                        </div>
                        <div className="grid w-[10.75rem] max-w-full grid-cols-2 gap-1.5">
                          <div className="space-y-1.5">
                            <FieldLabel>
                              {item.category === '移動' ? '出発時間' : '開始時間'}
                            </FieldLabel>
                            <TimeSelect
                              label={
                                item.category === '移動'
                                  ? '出発時間'
                                  : `${item.title}開始時間`
                              }
                              value={item.start}
                              onChange={(value) =>
                                updateItinerary(item.id, { start: value })
                              }
                            />
                          </div>
                          <div className="space-y-1.5">
                            <FieldLabel>
                              {item.category === '移動' ? '到着時間' : '終了時間'}
                            </FieldLabel>
                            <TimeSelect
                              label={
                                item.category === '移動'
                                  ? '到着時間'
                                  : `${item.title}終了時間`
                              }
                              value={item.end}
                              onChange={(value) =>
                                updateItinerary(item.id, { end: value })
                              }
                            />
                          </div>
                        </div>
                        {item.category !== '移動' && (
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
                        )}
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
                        {item.category !== '移動' && (
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
                        )}
                      </div>
                    ))}
                  </CardContent>
                </Card>

              </div>
            )}

            {activeTab === '宿診断' && (
              <div className="grid gap-4">
                {hotelView === 'list' && (
                  <Card className="rounded-lg border-emerald-950/10 bg-white shadow-sm">
                    <CardHeader className="space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <CardTitle>登録された宿</CardTitle>
                        <Badge variant="outline">{registeredHotels.length}件</Badge>
                      </div>
                      <div>
                        <Button onClick={() => openNewHotelForm()}>
                          <Plus className="size-4" />
                          新規登録
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {registeredHotels.length === 0 ? (
                        <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-600">
                          登録された宿はまだありません。新規登録から対象の旅行に宿を追加できます。
                        </div>
                      ) : (
                        registeredHotels.map((record) => (
                          <div
                            className="grid gap-3 rounded-lg border border-slate-200 bg-[#fcfdfc] p-4 sm:grid-cols-[1fr_auto]"
                            key={record.id}
                          >
                            <div className="space-y-1">
                              <p className="font-semibold text-slate-900">
                                {record.accommodation.name}
                              </p>
                              <p className="text-sm text-slate-600">
                                {record.accommodation.location || '所在地未設定'}
                              </p>
                              <p className="flex items-center gap-1.5 text-xs font-medium text-emerald-800">
                                <Route className="size-3.5" />
                                対象の旅行: {record.travel.name}
                              </p>
                            </div>
                            <div className="flex flex-wrap gap-2 self-center sm:justify-end">
                              <Button onClick={() => openHotelDetail(record)} variant="outline">
                                <Eye className="size-4" />
                                詳細
                              </Button>
                              <Button onClick={() => editHotel(record)} variant="outline">
                                <Pencil className="size-4" />
                                編集
                              </Button>
                              <Button
                                aria-label={`${record.accommodation.name}を削除`}
                                className="text-rose-700 hover:text-rose-800"
                                onClick={() => setPendingDeleteHotelId(record.id)}
                                variant="outline"
                              >
                                <Trash2 className="size-4" />
                                削除
                              </Button>
                            </div>
                          </div>
                        ))
                      )}
                    </CardContent>
                  </Card>
                )}

                {hotelView === 'detail' && (
                  <>
                    <Card className="rounded-lg border-emerald-950/10 bg-white shadow-sm">
                      <CardHeader>
                        <CardTitle className="flex flex-wrap items-center justify-between gap-3">
                          <span>{accommodation.name}の詳細</span>
                          <div className="flex flex-wrap gap-2">
                            <Button onClick={() => setHotelView('list')} variant="outline">
                              <RotateCcw className="size-4" />
                              戻る
                            </Button>
                            <Button
                              onClick={() => {
                                const record = trips.find((item) => item.id === selectedTripId);
                                if (record) editHotel(record);
                              }}
                              variant="outline"
                            >
                              <Pencil className="size-4" />
                              編集
                            </Button>
                          </div>
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="grid gap-4 text-sm sm:grid-cols-2">
                        <div><p className="text-xs text-slate-500">対象の旅行</p><p className="font-medium">{travel.name}</p></div>
                        <div><p className="text-xs text-slate-500">所在地</p><p className="font-medium">{accommodation.location || '未設定'}</p></div>
                        <div><p className="text-xs text-slate-500">宿泊料金</p><p className="font-medium">¥{currency(accommodation.price)}</p></div>
                        <div><p className="text-xs text-slate-500">宿URL</p><p className="break-all font-medium">{accommodation.url || '未設定'}</p></div>
                        <div><p className="text-xs text-slate-500">チェックイン / アウト</p><p className="font-medium">{accommodation.checkIn || '未設定'} / {accommodation.checkOut || '未設定'}</p></div>
                        <div><p className="text-xs text-slate-500">夕食 / 朝食</p><p className="font-medium">{accommodation.dinner || '未設定'} / {accommodation.breakfast || '未設定'}</p></div>
                        <div className="sm:col-span-2"><p className="text-xs text-slate-500">捕捉情報</p><p className="mt-1 whitespace-pre-wrap font-medium">{accommodation.note || '未設定'}</p></div>
                      </CardContent>
                    </Card>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Card className="rounded-lg border-emerald-950/10 bg-white shadow-sm">
                        <CardHeader><CardTitle>この宿が向いている理由</CardTitle></CardHeader>
                        <CardContent className="space-y-2">
                          {hotelDiagnosis.reasons.map((reason) => <p className="text-sm text-slate-700" key={reason}>{reason}</p>)}
                        </CardContent>
                      </Card>
                      <Card className="rounded-lg border-rose-200 bg-rose-50 shadow-sm">
                        <CardHeader><CardTitle>注意すべきポイント</CardTitle></CardHeader>
                        <CardContent className="space-y-2">
                          {hotelDiagnosis.regretPoints.map((point) => <p className="text-sm text-rose-950" key={point}>{point}</p>)}
                        </CardContent>
                      </Card>
                    </div>
                  </>
                )}

                {hotelView === 'form' && (
                <>
                <Card className="rounded-lg border-emerald-950/10 bg-white shadow-sm">
                  <CardHeader>
                    <CardTitle className="flex flex-wrap items-center justify-between gap-2">
                      <span>{hotelFormMode === 'new' ? '宿を新規登録' : '宿を編集'}</span>
                      <Button onClick={() => setHotelView('list')} variant="outline">
                        <RotateCcw className="size-4" />
                        戻る
                      </Button>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="max-w-sm space-y-1.5">
                      <FieldLabel>対象の旅行</FieldLabel>
                      {selectedTripId ? (
                      <select
                        aria-label="対象の旅行"
                        className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                        disabled={hotelFormMode === 'edit'}
                        value={selectedTripId ?? ''}
                        onChange={(event) => {
                          const record = trips.find((item) => item.id === event.target.value);
                          if (record) loadHotelTrip(record, emptyAccommodation);
                        }}
                      >
                        {(hotelFormMode === 'edit'
                          ? trips.filter((record) => record.id === selectedTripId)
                          : hotelRegistrationTargets
                        ).map((record) => (
                          <option key={record.id} value={record.id}>{record.travel.name}</option>
                        ))}
                      </select>
                      ) : (
                        <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700">
                          {travel.name || '未保存の旅行'}
                        </div>
                      )}
                    </div>
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
                          min="0"
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
                      <div className="flex flex-wrap gap-3 sm:col-span-2">
                        <div className="w-[132px] space-y-1.5">
                          <FieldLabel>チェックイン</FieldLabel>
                          <TimeSelect
                            label="チェックイン時間"
                            placeholder="未設定"
                            value={accommodation.checkIn}
                            onChange={(value) =>
                              setAccommodation({ ...accommodation, checkIn: value })
                            }
                          />
                        </div>
                        <div className="w-[132px] space-y-1.5">
                          <FieldLabel>チェックアウト</FieldLabel>
                          <TimeSelect
                            label="チェックアウト時間"
                            placeholder="未設定"
                            value={accommodation.checkOut}
                            onChange={(value) =>
                              setAccommodation({ ...accommodation, checkOut: value })
                            }
                          />
                        </div>
                        <div className="w-[132px] space-y-1.5">
                          <FieldLabel>夕食時間</FieldLabel>
                          <TimeSelect
                            label="夕食時間"
                            placeholder="未設定"
                            value={accommodation.dinner}
                            onChange={(value) =>
                              setAccommodation({ ...accommodation, dinner: value })
                            }
                          />
                        </div>
                        <div className="w-[132px] space-y-1.5">
                          <FieldLabel>朝食時間</FieldLabel>
                          <TimeSelect
                            label="朝食時間"
                            placeholder="未設定"
                            value={accommodation.breakfast}
                            onChange={(value) =>
                              setAccommodation({ ...accommodation, breakfast: value })
                            }
                          />
                        </div>
                      </div>
                      <div className="space-y-1.5 sm:col-span-2">
                        <FieldLabel>捕捉情報</FieldLabel>
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
                    {validationErrors.length > 0 && (
                      <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900">
                        {validationErrors.map((error) => <p key={error}>・{error}</p>)}
                      </div>
                    )}
                    <div className="flex flex-wrap gap-2">
                      <Button className="bg-teal-800 hover:bg-teal-700" onClick={saveHotel}>
                        <Save className="size-4" />
                        保存
                      </Button>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-teal-100 bg-teal-50/70 p-3">
                      <Button
                        disabled={diagnosisBusy === 'hotel'}
                        onClick={() => void runAiDiagnosis('hotel')}
                      >
                        <Sparkles className="size-4" />
                        {diagnosisBusy === 'hotel' ? 'AI診断中...' : 'AIで宿を診断'}
                      </Button>
                      <Badge
                        className={
                          diagnoses[currentTripId]?.hotel
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-white text-slate-600'
                        }
                      >
                        {diagnoses[currentTripId]?.hotel ? 'AI診断済み' : '参考診断'}
                      </Badge>
                      {diagnosisMessage && (
                        <p className="w-full text-sm text-slate-700">{diagnosisMessage}</p>
                      )}
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
                      <CardTitle>注意すべきポイント</CardTitle>
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
                </>
                )}
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
                        const tripRisk =
                          diagnoses[trip.id]?.risk ?? buildContextualRisk(trip);
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
                                <Badge variant="outline">
                                  {diagnoses[trip.id]?.risk ? 'AI診断済み' : '参考診断'}
                                </Badge>
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
                          <span className="flex flex-wrap items-center gap-2">
                            {riskDetailTrip.travel.name}のリスク詳細
                            <Badge variant="outline">
                              {diagnoses[riskDetailTrip.id]?.risk ? 'AI診断済み' : '参考診断'}
                            </Badge>
                          </span>
                          <span className="flex flex-wrap gap-2">
                            <Button
                              disabled={diagnosisBusy === 'risk'}
                              onClick={() => void runAiDiagnosis('risk', riskDetailTrip)}
                            >
                              <Sparkles className="size-4" />
                              {diagnosisBusy === 'risk' ? 'AI診断中...' : 'AIで診断'}
                            </Button>
                            <Button
                              onClick={() => editTrip(riskDetailTrip)}
                              variant="outline"
                            >
                              <Pencil className="size-4" />
                              この旅行の旅程を編集
                            </Button>
                          </span>
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-5">
                        {diagnosisMessage && (
                          <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-700">
                            {diagnosisMessage}
                          </p>
                        )}
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

            {activeTab === 'プラン' && (
              <div className="grid gap-4 sm:grid-cols-2">
                <Card className="rounded-lg border-emerald-950/10 bg-white shadow-sm">
                  <CardHeader>
                    <CardTitle>Free</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm text-slate-700">
                    <p className="text-3xl font-semibold text-slate-900">¥0</p>
                    <p>旅行診断 月1回</p>
                    <p>基本旅行診断</p>
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
                    <p>旅行履歴と嗜好学習</p>
                    <Button className="mt-2 bg-white text-emerald-950 hover:bg-emerald-50">
                      <CreditCard className="size-4" />
                      Premiumを確認
                    </Button>
                  </CardContent>
                </Card>
              </div>
            )}
          </div>

          {activeTab === 'ホーム' && (
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
                  {topTravel.transport} / 予算{' '}
                  {topTravel.budget === null
                    ? '未設定'
                    : `¥${currency(topTravel.budget)}`}
                </p>
                <p className="rounded-lg bg-slate-50 p-3 text-slate-600">
                  {topTravel.memo || 'メモはまだ登録されていません。'}
                </p>
              </CardContent>
            </Card>

            <Card className="rounded-lg border-emerald-950/10 bg-white shadow-sm">
              <CardHeader>
                <CardTitle>システム連携</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-slate-600">
                <p>AWS: Cognito / API Gateway / Lambda / DynamoDB / S3</p>
                <p>AI: Claude Sonnet 4.5</p>
                <p>外部情報は未連携のため、天気・交通は前日に再確認が必要です</p>
              </CardContent>
            </Card>
          </aside>
          )}
        </section>
      </div>
      <AlertDialog
        onOpenChange={(open) => {
          if (!open && !deletingTripId) setPendingDeleteTripId(null);
        }}
        open={Boolean(pendingDeleteTrip)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>この旅行を削除しますか？</AlertDialogTitle>
            <AlertDialogDescription>
              「{pendingDeleteTrip?.travel.name}」の旅行情報、宿、旅程、診断結果が削除されます。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={Boolean(deletingTripId)}>
              キャンセル
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={!pendingDeleteTrip || Boolean(deletingTripId)}
              onClick={() => {
                if (pendingDeleteTrip) void deleteTripRecord(pendingDeleteTrip);
              }}
              variant="destructive"
            >
              <Trash2 className="size-4" />
              {deletingTripId ? '削除中...' : '削除'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog
        onOpenChange={(open) => {
          if (!open) setPendingDeleteHotelId(null);
        }}
        open={Boolean(pendingDeleteHotel)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>この宿を削除しますか？</AlertDialogTitle>
            <AlertDialogDescription>
              「{pendingDeleteHotel?.accommodation.name}」の宿情報と宿診断結果を削除します。対象の旅行や旅程は残ります。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction
              disabled={!pendingDeleteHotel}
              onClick={() => {
                if (pendingDeleteHotel) void deleteHotel(pendingDeleteHotel);
              }}
              variant="destructive"
            >
              <Trash2 className="size-4" />
              削除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}
