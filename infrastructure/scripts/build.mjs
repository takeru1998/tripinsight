import { build } from 'esbuild';

await build({
  entryPoints: ['src/handler.ts'],
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'esm',
  outfile: 'dist/handler.mjs',
  sourcemap: true,
  minify: false,
});
