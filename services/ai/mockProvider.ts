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

function orderedItinerary(itinerary: ItineraryItem[]) {
  return [...itinerary].sort((a, b) =>
    `${a.date}T${a.start}`.localeCompare(`${b.date}T${b.start}`),
  );
}

export const mockAiProvider: AiProvider = {
  diagnoseHotel(
    preference: UserTravelPreference,
    accommodation: Accommodation,
  ): HotelCompatibilityDiagnosis {
    const quietBonus = preference.quiet * 5;
    const onsenBonus = preference.onsen * 4;
    const latePenalty = accommodation.checkOut <= '10:00' ? 7 : 0;
    const score = clampScore(72 + quietBonus / 3 + onsenBonus / 4 - latePenalty);
    const hotelName = accommodation.name || 'この宿';

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
        `${hotelName}の登録条件と、設定した旅行の好みを照合した参考評価です`,
        preference.onsen >= 4
          ? '温泉を重視する好みを強く反映しています'
          : '食事・景色・移動のバランスを重視しています',
        accommodation.location
          ? `所在地「${accommodation.location}」と旅程の位置関係を確認すると精度が上がります`
          : '所在地を入力すると、移動面の評価を改善できます',
      ],
      regretPoints: [
        accommodation.checkOut
          ? `チェックアウトが${accommodation.checkOut}です。朝食後の準備時間を確保してください`
          : 'チェックアウト時刻が未入力です',
        accommodation.dinner
          ? `夕食開始${accommodation.dinner}に遅れないよう、到着時間に余裕が必要です`
          : '夕食時間と最終チェックイン条件を確認してください',
        '送迎、駐車場、キャンセル条件は宿の公式情報で最終確認が必要です',
        accommodation.price > 60000
          ? '旅行予算に対する宿泊費の割合が高めです'
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
    const ordered = orderedItinerary(itinerary);
    const gaps = ordered
      .slice(1)
      .filter((item, index) => item.date === ordered[index].date)
      .map((item) => {
        const index = ordered.indexOf(item);
        return minutes(item.start) - minutes(ordered[index - 1].end);
      });
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
        tightGaps
          ? `${tightGaps}か所で予定間の余裕が25分未満です`
          : '予定間の大きな時間衝突は検出されませんでした',
        accommodation.dinner
          ? `${accommodation.dinner}の夕食に対し、宿到着の予備時間を確認してください`
          : '宿の夕食時間が未入力のため整合性を確認できません',
        sightseeingMinutes > 150
          ? '観光時間が長く、移動を含めると疲労が蓄積する可能性があります'
          : '観光量は比較的抑えられています',
        '屋外予定には雨天時の代替案を用意すると安心です',
      ],
      recommendations: [
        tightGaps
          ? '移動の前後に30分程度の予備時間を追加する'
          : '現在の余裕を維持し、予定を追加しすぎない',
        checkInItem
          ? `宿の予定「${checkInItem.title}」を夕食の90分以上前に設定する`
          : '旅程に宿への到着予定を追加する',
        '屋外の観光予定ごとに、近くの屋内代替案を1つ決めておく',
      ],
    };
  },

  forecastRisk(travel: Travel, itinerary: ItineraryItem[]): RiskDiagnosis {
    const outdoorPlans = itinerary.filter((item) => item.category === '観光').length;
    const firstSight = itinerary.find((item) => item.category === '観光');
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
        firstSight
          ? `「${firstSight.title}」など屋外予定は、天候と営業情報を前日に再確認してください。`
          : '交通の遅延と営業時間を前日に再確認してください。',
      warnings: [
        '観光地や飲食店の待ち時間で、後続の予定が遅れる可能性があります',
        `${travel.transport}の運行情報または道路情報を当日朝に確認してください`,
        '食事・宿泊・体験のキャンセル条件と連絡先を控えてください',
      ],
    };
  },
};
