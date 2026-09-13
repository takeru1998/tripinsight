'use client';

import {
  AlertTriangle,
  Bed,
  CalendarDays,
  Check,
  ChevronRight,
  CloudRain,
  CreditCard,
  MapPin,
  Plus,
  RotateCcw,
  Route,
  Save,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  Train,
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
import type {
  Accommodation,
  ItineraryItem,
  PreferenceKey,
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
};

const storageKey = 'tripcheck-mvp-state-v1';

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
  '概要',
  'プロフィール',
  '旅行登録',
  '宿診断',
  '旅程',
  'リスク',
  'カルテ',
  'プラン',
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
  const now = new Date('2026-09-13T00:00:00-07:00');
  const target = new Date(`${date}T00:00:00-07:00`);
  return Math.max(
    0,
    Math.ceil((target.getTime() - now.getTime()) / 86_400_000),
  );
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
      className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none transition focus-visible:ring-3 focus-visible:ring-ring/50"
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

export default function Home() {
  const [activeTab, setActiveTab] = useState('概要');
  const [preference, setPreference] =
    useState<UserTravelPreference>(mockPreference);
  const [travel, setTravel] = useState<Travel>(mockTravel);
  const [accommodation, setAccommodation] =
    useState<Accommodation>(mockAccommodation);
  const [itinerary, setItinerary] = useState<ItineraryItem[]>(mockItinerary);
  const [review, setReview] = useState<TravelReview>(mockReview);
  const [improved, setImproved] = useState(false);
  const [saveState, setSaveState] = useState('端末内に自動保存');

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
      setSaveState('保存済みデータを読み込みました');
    } catch {
      setSaveState('保存データを読み込めませんでした');
    }
  }, []);

  useEffect(() => {
    const state: TripCheckState = {
      preference,
      travel,
      accommodation,
      itinerary,
      review,
    };
    window.localStorage.setItem(storageKey, JSON.stringify(state));
  }, [preference, travel, accommodation, itinerary, review]);

  const hotelDiagnosis = useMemo(
    () => mockAiProvider.diagnoseHotel(preference, accommodation),
    [preference, accommodation],
  );
  const itineraryDiagnosis = useMemo(
    () => mockAiProvider.judgeItinerary(travel, accommodation, itinerary),
    [travel, accommodation, itinerary],
  );
  const riskDiagnosis = useMemo(
    () => mockAiProvider.forecastRisk(travel, itinerary),
    [travel, itinerary],
  );
  const overallScore = Math.round(
    hotelDiagnosis.score * 0.35 +
      itineraryDiagnosis.score * 0.4 +
      (100 - riskDiagnosis.riskPercent) * 0.25,
  );
  const improvedScore = Math.min(96, itineraryDiagnosis.score + 17);

  function updatePreference(key: PreferenceKey, value: number) {
    setPreference((current) => ({ ...current, [key]: value }));
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
        priority: 3,
        memo: '',
      },
    ]);
    setActiveTab('旅程');
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
    setImproved(false);
    setSaveState('モック旅行に戻しました');
  }

  function applyImprovement() {
    setItinerary((items) =>
      items.map((item) => {
        if (item.title === '清津峡') return { ...item, end: '14:50' };
        if (item.title === '温泉街カフェ') {
          return { ...item, start: '15:05', end: '15:45' };
        }
        if (item.title === '旅館チェックイン') {
          return { ...item, start: '16:30', end: '16:50' };
        }
        return item;
      }),
    );
    setImproved(true);
  }

  return (
    <main className="min-h-screen bg-[var(--app-bg)] text-slate-900">
      <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 py-4 sm:px-6 lg:px-8">
        <header className="sticky top-0 z-20 -mx-4 border-b border-emerald-950/10 bg-[var(--app-bg)]/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="grid size-10 place-items-center rounded-lg bg-emerald-900 text-white shadow-sm">
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
              onClick={() => setActiveTab('旅行登録')}
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
          <Card className="rounded-lg border-emerald-950/10 bg-white shadow-sm">
            <CardContent className="space-y-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="space-y-2">
                  <Badge className="w-fit bg-teal-50 text-teal-800 ring-1 ring-teal-700/15">
                    次の旅行まであと{daysUntil(travel.startDate)}日
                  </Badge>
                  <div>
                    <h1 className="text-2xl font-semibold leading-tight sm:text-3xl">
                      {travel.name}
                    </h1>
                    <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-500">
                      <MapPin className="size-4" />
                      {travel.origin}発 / {travel.companion} / {travel.people}名
                    </p>
                  </div>
                </div>
                <div className="rounded-lg bg-emerald-950 px-5 py-4 text-right text-white">
                  <p className="text-xs text-emerald-100">旅行総合スコア</p>
                  <p className="text-4xl font-semibold">{overallScore}</p>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <ScoreCard
                  title="宿相性"
                  value={hotelDiagnosis.score}
                  icon={Bed}
                  caption="口コミ点ではなく、あなたの好みとの一致を評価"
                />
                <ScoreCard
                  title="旅程"
                  value={itineraryDiagnosis.score}
                  icon={Route}
                  caption="時間余裕、疲労、宿到着との整合性を診断"
                />
                <ScoreCard
                  title="耐性"
                  value={100 - riskDiagnosis.riskPercent}
                  icon={CloudRain}
                  caption="天気・遅延・混雑に対する強さ"
                />
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-lg border-amber-300/60 bg-amber-50 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-amber-950">
                <AlertTriangle className="size-5" />
                重要な注意
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm leading-relaxed text-amber-950">
                {riskDiagnosis.critical}
              </p>
              <div className="rounded-lg bg-white/70 p-3 text-sm text-slate-700">
                最も改善すべき3点
                <ul className="mt-2 space-y-2 text-sm">
                  <li>宿到着を16:30へ前倒しして夕食前の余裕を確保</li>
                  <li>清津峡の雨天代替案を用意</li>
                  <li>昼食混雑を見込んで予約か候補店を追加</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </section>

        <nav className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto border-y border-emerald-950/10 bg-white/70 px-4 py-2 sm:mx-0 sm:rounded-lg sm:border">
          {tabs.map((tab) => (
            <button
              key={tab}
              className={`shrink-0 rounded-lg px-3 py-2 text-sm font-medium transition ${
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

        <section className="grid flex-1 gap-4 py-5 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="space-y-4">
            {activeTab === '概要' && (
              <div className="grid gap-4">
                <Card className="rounded-lg border-emerald-950/10 bg-white shadow-sm">
                  <CardHeader>
                    <CardTitle>現在の診断サマリー</CardTitle>
                  </CardHeader>
                  <CardContent className="grid gap-4 sm:grid-cols-2">
                    {Object.entries(itineraryDiagnosis.categoryScores).map(
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
                    {itineraryDiagnosis.issues.slice(0, 5).map((issue) => (
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

            {activeTab === 'プロフィール' && (
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
            )}

            {activeTab === '旅行登録' && (
              <Card className="rounded-lg border-emerald-950/10 bg-white shadow-sm">
                <CardHeader>
                  <CardTitle>新しい旅行を登録</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5 sm:col-span-2">
                    <FieldLabel>旅行名</FieldLabel>
                    <Input
                      value={travel.name}
                      onChange={(event) =>
                        setTravel({ ...travel, name: event.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <FieldLabel>出発日</FieldLabel>
                    <Input
                      type="date"
                      value={travel.startDate}
                      onChange={(event) =>
                        setTravel({ ...travel, startDate: event.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <FieldLabel>帰宅日</FieldLabel>
                    <Input
                      type="date"
                      value={travel.endDate}
                      onChange={(event) =>
                        setTravel({ ...travel, endDate: event.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <FieldLabel>出発地</FieldLabel>
                    <Input
                      value={travel.origin}
                      onChange={(event) =>
                        setTravel({ ...travel, origin: event.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
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
                  <div className="space-y-1.5">
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
                  <div className="space-y-1.5">
                    <FieldLabel>人数</FieldLabel>
                    <Input
                      min="1"
                      type="number"
                      value={travel.people}
                      onChange={(event) =>
                        setTravel({ ...travel, people: Number(event.target.value) })
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <FieldLabel>旅行予算</FieldLabel>
                    <Input
                      type="number"
                      value={travel.budget}
                      onChange={(event) =>
                        setTravel({ ...travel, budget: Number(event.target.value) })
                      }
                    />
                  </div>
                  <div className="space-y-1.5 sm:col-span-2">
                    <FieldLabel>自由入力メモ</FieldLabel>
                    <Textarea
                      value={travel.memo}
                      onChange={(event) =>
                        setTravel({ ...travel, memo: event.target.value })
                      }
                    />
                  </div>
                  <div className="flex flex-wrap gap-2 sm:col-span-2">
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

            {activeTab === '旅程' && (
              <div className="space-y-4">
                <Card className="rounded-lg border-emerald-950/10 bg-white shadow-sm">
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between gap-3">
                      AI旅行ジャッジ
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
                        className="grid gap-3 rounded-lg border border-slate-200 p-3 sm:grid-cols-[88px_1fr_1fr_auto]"
                      >
                        <div className="space-y-1">
                          <Input
                            aria-label={`${item.title}開始時間`}
                            value={item.start}
                            onChange={(event) =>
                              updateItinerary(item.id, { start: event.target.value })
                            }
                          />
                          <Input
                            aria-label={`${item.title}終了時間`}
                            value={item.end}
                            onChange={(event) =>
                              updateItinerary(item.id, { end: event.target.value })
                            }
                          />
                        </div>
                        <div className="space-y-1">
                          <Input
                            value={item.title}
                            onChange={(event) =>
                              updateItinerary(item.id, { title: event.target.value })
                            }
                          />
                          <p className="flex items-center gap-1 text-xs text-slate-500">
                            <MapPin className="size-3" />
                            {item.place || '場所未入力'}
                          </p>
                          <Input
                            aria-label={`${item.title}場所`}
                            placeholder="場所"
                            value={item.place}
                            onChange={(event) =>
                              updateItinerary(item.id, { place: event.target.value })
                            }
                          />
                        </div>
                        <div className="grid gap-2">
                          <SelectField
                            label={`${item.title}カテゴリ`}
                            options={[
                              '移動',
                              '食事',
                              '観光',
                              '温泉',
                              '宿泊',
                              '休憩',
                              'その他',
                            ]}
                            value={item.category}
                            onChange={(value) =>
                              updateItinerary(item.id, {
                                category: value as ItineraryItem['category'],
                              })
                            }
                          />
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-slate-500">優先度</span>
                            <input
                              aria-label={`${item.title}優先度`}
                              className="w-full accent-emerald-800"
                              max="5"
                              min="1"
                              onChange={(event) =>
                                updateItinerary(item.id, {
                                  priority: Number(event.target.value),
                                })
                              }
                              type="range"
                              value={item.priority}
                            />
                            <span className="w-4 text-sm font-medium text-emerald-800">
                              {item.priority}
                            </span>
                          </div>
                          <Input
                            aria-label={`${item.title}メモ`}
                            placeholder="メモ"
                            value={item.memo}
                            onChange={(event) =>
                              updateItinerary(item.id, { memo: event.target.value })
                            }
                          />
                        </div>
                        <Button
                          aria-label={`${item.title}を削除`}
                          className="self-start text-rose-700 hover:text-rose-800"
                          onClick={() => removeItineraryItem(item.id)}
                          size="icon"
                          variant="ghost"
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    ))}
                  </CardContent>
                </Card>
                <Card className="rounded-lg border-teal-200 bg-teal-50 shadow-sm">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Sparkles className="size-5 text-teal-700" />
                      AIで改善
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-sm text-slate-700">
                      改善前：{itineraryDiagnosis.score}点 / 改善後：
                      {improved ? itineraryDiagnosis.score : improvedScore}点
                    </p>
                    <div className="grid gap-2 text-sm text-slate-700">
                      <p>カフェを15:30から15:05へ変更し、滞在を短縮</p>
                      <p>清津峡の滞在を90分から70分へ変更</p>
                      <p>宿到着予定を16:30へ前倒し</p>
                    </div>
                    <Button
                      className="bg-teal-800 hover:bg-teal-700"
                      onClick={applyImprovement}
                    >
                      <Check className="size-4" />
                      改善案を採用
                    </Button>
                  </CardContent>
                </Card>
              </div>
            )}

            {activeTab === 'リスク' && (
              <Card className="rounded-lg border-emerald-950/10 bg-white shadow-sm">
                <CardHeader>
                  <CardTitle>AI旅行トラブル予報</CardTitle>
                </CardHeader>
                <CardContent className="space-y-5">
                  <div className="rounded-lg bg-slate-950 p-4 text-white">
                    <p className="text-sm text-slate-300">
                      明日の旅行 トラブルリスク
                    </p>
                    <p className="text-4xl font-semibold">
                      {riskDiagnosis.riskPercent}%
                    </p>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {Object.entries(riskDiagnosis.categoryRisks).map(
                      ([label, value]) => (
                        <MiniBar key={label} label={label} value={value} />
                      ),
                    )}
                  </div>
                  <div className="space-y-2">
                    {riskDiagnosis.warnings.map((warning) => (
                      <p key={warning} className="text-sm text-slate-700">
                        {warning}
                      </p>
                    ))}
                  </div>
                </CardContent>
              </Card>
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
                  {travel.startDate} - {travel.endDate}
                </p>
                <p className="flex items-center gap-2 text-slate-600">
                  <Train className="size-4 text-teal-700" />
                  {travel.transport} / 予算 ¥{currency(travel.budget)}
                </p>
                <p className="rounded-lg bg-slate-50 p-3 text-slate-600">
                  {travel.memo}
                </p>
              </CardContent>
            </Card>

            <Card className="rounded-lg border-emerald-950/10 bg-white shadow-sm">
              <CardHeader>
                <CardTitle>過去の旅行</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {['箱根温泉リセット旅', '京都ゆっくり紅葉旅', '軽井沢カフェ巡り'].map(
                  (name) => (
                    <button
                      key={name}
                      className="flex w-full items-center justify-between rounded-lg border border-slate-200 p-3 text-left text-sm hover:bg-slate-50"
                      type="button"
                    >
                      {name}
                      <ChevronRight className="size-4 text-slate-400" />
                    </button>
                  ),
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
