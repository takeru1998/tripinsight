import { build } from 'esbuild';
import { rm } from 'node:fs/promises';

await rm('dist', { force: true, recursive: true });

await build({
  entryPoints: ['src/handler.ts'],
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'cjs',
  outfile: 'dist/handler.js',
  sourcemap: true,
  minify: false,
});
