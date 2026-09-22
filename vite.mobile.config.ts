import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/postcss';
import path from 'node:path';
import { defineConfig } from 'vite';

export default defineConfig({
  root: 'mobile',
  base: './',
  publicDir: path.resolve(__dirname, 'public'),
  css: {
    postcss: {
      plugins: [tailwindcss()],
    },
  },
  define: {
    'process.env.NEXT_PUBLIC_TRIPCHECK_API_URL': JSON.stringify(
      'https://mnyheiadjf.execute-api.ap-northeast-1.amazonaws.com',
    ),
    'process.env.NEXT_PUBLIC_AWS_REGION': JSON.stringify('ap-northeast-1'),
    'process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID': JSON.stringify(
      'ap-northeast-1_y0S4oRa5x',
    ),
    'process.env.NEXT_PUBLIC_COGNITO_USER_POOL_CLIENT_ID': JSON.stringify(
      '6bjh91hmqbsu7bcjfjk44b8v21',
    ),
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname),
    },
  },
  plugins: [react()],
  build: {
    outDir: path.resolve(__dirname, 'dist-mobile'),
    emptyOutDir: true,
  },
});
