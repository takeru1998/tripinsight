import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyResultV2,
} from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DeleteCommand,
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
} from '@aws-sdk/lib-dynamodb';
import { ZodError } from 'zod';

import { runDiagnosis } from './bedrock.js';
import {
  diagnosisRequestSchema,
  preferenceSchema,
  tripRecordSchema,
} from './schemas.js';

const tableName = requiredEnv('TABLE_NAME');
const db = DynamoDBDocumentClient.from(new DynamoDBClient({}), {
  marshallOptions: { removeUndefinedValues: true },
});

type JwtEvent = APIGatewayProxyEventV2 & {
  requestContext: APIGatewayProxyEventV2['requestContext'] & {
    authorizer?: { jwt?: { claims?: Record<string, string | number | boolean | string[]> } };
  };
};

export const handler = async (event: JwtEvent): Promise<APIGatewayProxyResultV2> => {
  try {
    const method = event.requestContext.http.method;
    const path = event.rawPath;
    if (method === 'GET' && path === '/health') return json(200, { status: 'ok' });

    const userId = event.requestContext.authorizer?.jwt?.claims?.sub;
    if (typeof userId !== 'string' || !userId) return json(401, { message: 'Unauthorized' });

    const tripId = event.pathParameters?.tripId;

    if (method === 'GET' && path === '/profile') return getProfile(userId);
    if (method === 'PUT' && path === '/profile') return putProfile(userId, parseBody(event.body));
    if (method === 'GET' && path === '/trips') return listTrips(userId);
    if (method === 'GET' && tripId) return getTrip(userId, tripId);
    if (method === 'PUT' && tripId) return putTrip(userId, tripId, parseBody(event.body));
    if (method === 'DELETE' && tripId) return deleteTrip(userId, tripId);
    if (method === 'POST' && path === '/diagnoses') return diagnose(userId, parseBody(event.body));

    return json(404, { message: 'Not found' });
  } catch (error) {
    console.error(error);
    if (error instanceof ZodError) return json(400, { message: 'Invalid request', issues: error.issues });
    if (error instanceof SyntaxError) return json(400, { message: 'Invalid JSON' });
    return json(500, { message: 'Internal server error' });
  }
};

async function getProfile(userId: string) {
  const result = await db.send(new GetCommand({ TableName: tableName, Key: { pk: `USER#${userId}`, sk: 'PROFILE' } }));
  return result.Item ? json(200, result.Item.data) : json(404, { message: 'Profile not found' });
}

async function putProfile(userId: string, body: unknown) {
  const data = preferenceSchema.parse(body);
  await db.send(new PutCommand({ TableName: tableName, Item: { pk: `USER#${userId}`, sk: 'PROFILE', entityType: 'PROFILE', data, updatedAt: new Date().toISOString() } }));
  return json(200, data);
}

async function listTrips(userId: string) {
  const result = await db.send(new QueryCommand({
    TableName: tableName,
    KeyConditionExpression: 'pk = :pk AND begins_with(sk, :sk)',
    ExpressionAttributeValues: { ':pk': `USER#${userId}`, ':sk': 'TRIP#' },
  }));
  return json(200, { items: (result.Items ?? []).map((item) => item.data) });
}

async function getTrip(userId: string, tripId: string) {
  const result = await db.send(new GetCommand({ TableName: tableName, Key: { pk: `USER#${userId}`, sk: `TRIP#${tripId}` } }));
  return result.Item ? json(200, result.Item.data) : json(404, { message: 'Trip not found' });
}

async function putTrip(userId: string, tripId: string, body: unknown) {
  const data = tripRecordSchema.parse(body);
  if (data.id !== tripId || data.travel.id !== tripId) return json(400, { message: 'Trip id does not match path' });
  await db.send(new PutCommand({ TableName: tableName, Item: { pk: `USER#${userId}`, sk: `TRIP#${tripId}`, entityType: 'TRIP', startDate: data.travel.startDate, data, updatedAt: new Date().toISOString() } }));
  return json(200, data);
}

async function deleteTrip(userId: string, tripId: string) {
  await db.send(new DeleteCommand({ TableName: tableName, Key: { pk: `USER#${userId}`, sk: `TRIP#${tripId}` } }));
  return { statusCode: 204 };
}

async function diagnose(userId: string, body: unknown) {
  const input = diagnosisRequestSchema.parse(body);
  const result = await runDiagnosis(input);
  const diagnosisId = crypto.randomUUID();
  await db.send(new PutCommand({ TableName: tableName, Item: {
    pk: `USER#${userId}`,
    sk: `DIAGNOSIS#${input.trip.id}#${new Date().toISOString()}#${diagnosisId}`,
    entityType: 'DIAGNOSIS', tripId: input.trip.id, diagnosisKind: input.kind,
    data: result, createdAt: new Date().toISOString(),
  } }));
  return json(200, result);
}

function parseBody(body: string | undefined) {
  if (!body) throw new SyntaxError('Request body is required');
  return JSON.parse(body) as unknown;
}

function json(statusCode: number, body: unknown) {
  return { statusCode, headers: { 'content-type': 'application/json; charset=utf-8' }, body: JSON.stringify(body) };
}

function requiredEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}
