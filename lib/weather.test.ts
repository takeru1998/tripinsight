import assert from 'node:assert/strict';
import test from 'node:test';

import { weatherCodeDetails } from '../services/weather/openMeteoWeather.ts';

test('weatherCodeDetails converts WMO codes for the weather tiles', () => {
  assert.deepEqual(weatherCodeDetails(0), {
    description: '快晴',
    kind: 'sunny',
  });
  assert.deepEqual(weatherCodeDetails(61), {
    description: '雨',
    kind: 'rain',
  });
  assert.deepEqual(weatherCodeDetails(95), {
    description: '雷雨',
    kind: 'storm',
  });
});
