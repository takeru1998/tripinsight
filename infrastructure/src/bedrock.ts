import {
  BedrockRuntimeClient,
  ConverseCommand,
} from '@aws-sdk/client-bedrock-runtime';
import { z } from 'zod';

import type { DiagnosisRequest } from './schemas.js';

const scoreMapSchema = z.record(z.string(), z.number().min(0).max(100));
const hotelResultSchema = z.object({
  score: z.number().min(0).max(100),
  categoryScores: scoreMapSchema,
  reasons: z.array(z.string()).max(10),
  regretPoints: z.array(z.string()).max(10),
});
const itineraryResultSchema = z.object({
  score: z.number().min(0).max(100),
  categoryScores: scoreMapSchema,
  issues: z.array(z.string()).max(5),
  recommendations: z.array(z.string()).max(10),
});
const riskResultSchema = z.object({
  riskPercent: z.number().min(0).max(100),
  categoryRisks: scoreMapSchema,
  critical: z.string(),
  warnings: z.array(z.string()).max(10),
});
const summaryResultSchema = z.object({
  overallScore: z.number().min(0).max(100),
  weakestPoints: z.array(z.string()).max(3),
  nextActions: z.array(z.string()).max(5),
});

const definitions = {
  hotel: {
    instruction: 'ユーザー嗜好と宿泊先の相性を診断してください。口コミの一般評価より個人との一致を優先してください。',
    shape: '{"score":0,"categoryScores":{},"reasons":[],"regretPoints":[]}',
    schema: hotelResultSchema,
  },
  itinerary: {
    instruction: '旅程の移動効率、時間余裕、疲労、食事、観光、天候耐性、詰め込み度、宿との整合性を診断してください。',
    shape: '{"score":0,"categoryScores":{},"issues":[],"recommendations":[]}',
    schema: itineraryResultSchema,
  },
  risk: {
    instruction: '旅行当日の天候、渋滞、食事、駐車場、営業時間、遅延、疲労リスクを診断してください。リアルタイム情報を取得していない場合は断定しないでください。',
    shape: '{"riskPercent":0,"categoryRisks":{},"critical":"","warnings":[]}',
    schema: riskResultSchema,
  },
  summary: {
    instruction: '旅行全体を総合評価し、弱点と次の行動を簡潔にまとめてください。',
    shape: '{"overallScore":0,"weakestPoints":[],"nextActions":[]}',
    schema: summaryResultSchema,
  },
} as const;

const client = new BedrockRuntimeClient({});

export async function runDiagnosis(input: DiagnosisRequest) {
  const definition = definitions[input.kind];
  const command = new ConverseCommand({
    modelId: requiredEnv('BEDROCK_MODEL_ID'),
    system: [{ text: `あなたは旅行リスク診断AIです。日本語で回答し、必ずJSONのみを返してください。形式: ${definition.shape}` }],
    messages: [{
      role: 'user',
      content: [{ text: `${definition.instruction}\n入力JSON:\n${JSON.stringify(input)}` }],
    }],
    inferenceConfig: { maxTokens: 2000, temperature: 0.2 },
  });
  const response = await client.send(command);
  const text = response.output?.message?.content?.find((item) => 'text' in item)?.text;
  if (!text) throw new Error('Bedrock returned no text');

  const jsonText = text.replace(/^```json\s*/i, '').replace(/\s*```$/, '');
  return definition.schema.parse(JSON.parse(jsonText));
}

function requiredEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}
