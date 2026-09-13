import type {
  Accommodation,
  HotelCompatibilityDiagnosis,
  ItineraryItem,
  RiskDiagnosis,
  Travel,
  TravelDiagnosis,
  UserTravelPreference,
} from '@/types/tripcheck';
import { clampScore, validateScoreMap, type AiProvider } from './aiProvider';

function minutes(time: string) {
  const [hour = '0', minute = '0'] = time.split(':');
  return Number(hour) * 60 + Number(minute);
}

function duration(item: ItineraryItem) {
  return Math.max(0, minutes(item.end) - minutes(item.start));
}

export const mockAiProvider: AiProvider = {
  diagnoseHotel(
    preference: UserTravelPreference,
    accommodation: Accommodation,
  ): HotelCompatibilityDiagnosis {
    const quietBonus = preference.quiet * 5;
    const onsenBonus = preference.onsen * 4;
    const latePenalty = accommodation.checkOut <= '10:00' ? 7 : 0;
    const fixedDinnerPenalty = accommodation.dinner ? 3 : 0;
    const score = clampScore(72 + quietBonus / 3 + onsenBonus / 4 - latePenalty);

    return {
      score,
      categoryScores: validateScoreMap({
        温泉: 94,
        食事: 84,
        静けさ: 93,
        景色: 86,
        アクセス: 76,
        コストパフォーマンス: accommodation.price > 60000 ? 72 : 82,
        ユーザー嗜好との一致度: score,
      }),
      reasons: [
        '静かな宿を好む傾向と、客室数が少ない宿の特徴が一致しています',
        '温泉重視の嗜好に対して、露天風呂付きの条件が強く合っています',
        '観光を詰め込みすぎない旅行スタイルと、宿で過ごす時間の相性がよいです',
      ],
      regretPoints: [
        `チェックアウトが${accommodation.checkOut}のため、朝が苦手な人には少し早めです`,
        `夕食開始が${accommodation.dinner}固定なので、到着遅れに弱いです`,
        '駅からの送迎時刻を確認しないと、到着後に待ち時間が発生する可能性があります',
        fixedDinnerPenalty
          ? '貸切風呂や追加料理が別料金の場合、満足度と予算のズレが出ます'
          : '',
      ].filter(Boolean),
    };
  },

  judgeItinerary(
    travel: Travel,
    accommodation: Accommodation,
    itinerary: ItineraryItem[],
  ): TravelDiagnosis {
    const sightseeingMinutes = itinerary
      .filter((item) => item.category === '観光')
      .reduce((sum, item) => sum + duration(item), 0);
    const gaps = itinerary
      .slice(1)
      .map((item, index) => minutes(item.start) - minutes(itinerary[index].end));
    const tightGaps = gaps.filter((gap) => gap < 25).length;
    const checkInItem = itinerary.find((item) => item.category === '宿泊');
    const dinnerBuffer = checkInItem
      ? minutes(accommodation.dinner) - minutes(checkInItem.start)
      : 0;
    const score = clampScore(84 - tightGaps * 5 - (dinnerBuffer < 75 ? 7 : 0));

    return {
      score,
      categoryScores: validateScoreMap({
        移動効率: travel.transport === '電車' ? 82 : 74,
        時間余裕: tightGaps ? 68 : 86,
        疲労リスク: sightseeingMinutes > 150 ? 70 : 84,
        食事バランス: 78,
        観光充実度: sightseeingMinutes > 90 ? 88 : 70,
        天候耐性: 64,
        予定詰め込み度: itinerary.length >= 5 ? 66 : 84,
        宿との整合性: dinnerBuffer >= 75 ? 88 : 69,
      }),
      issues: [
        '清津峡で混雑した場合、次のカフェ予定に間に合わない可能性があります',
        `${accommodation.dinner}夕食に対して、チェックイン後の余裕が少なめです`,
        '昼食後から観光地までの移動時間と待ち時間が十分に見込まれていません',
        '雨天時に屋外移動が続くため、代替案がないと満足度が下がります',
      ],
      recommendations: [
        'カフェを短縮または翌日に移し、宿到着を16:30前後へ前倒しする',
        '清津峡の滞在を70分程度に抑え、混雑時のバッファを確保する',
        '雨天時は駅ナカ散策か宿のラウンジ時間に切り替える',
      ],
    };
  },

  forecastRisk(travel: Travel, itinerary: ItineraryItem[]): RiskDiagnosis {
    const outdoorPlans = itinerary.filter((item) => item.category === '観光').length;
    const riskPercent = clampScore(34 + outdoorPlans * 8);
    return {
      riskPercent,
      categoryRisks: validateScoreMap({
        天候リスク: 62,
        渋滞リスク: travel.transport === '車' ? 58 : 22,
        食事リスク: 35,
        駐車場リスク: travel.transport === '車' ? 54 : 12,
        営業時間リスク: 46,
        遅延リスク: 38,
        疲労リスク: 44,
      }),
      critical:
        '14時以降、清津峡周辺で雨の想定です。展望系の予定は午前寄せが安全です。',
      warnings: [
        '人気観光地の待ち時間で、宿到着が夕食直前になる可能性があります',
        '駅ナカ昼食は混雑時に20分以上ずれる想定が必要です',
        '帰宅日の朝はチェックアウト時刻が早く、朝食後の準備時間が短めです',
      ],
    };
  },
};
