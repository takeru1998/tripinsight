import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'TripInsight - 旅行リスクAI分析',
    short_name: 'TripInsight',
    description: '旅行前に宿・旅程・当日のトラブルを診断するAIアプリ',
    start_url: '/',
    display: 'standalone',
    background_color: '#eef4f1',
    theme_color: '#064e3b',
    lang: 'ja',
    orientation: 'portrait-primary',
    icons: [
      {
        src: '/favicon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'any',
      },
    ],
  };
}
