// Builds the API as a single Vercel function via the Build Output API
// (https://vercel.com/docs/build-output-api). Bundling avoids per-file
// transpilation on Vercel, which breaks extensionless ESM imports and
// TypeScript workspace packages.
import { build } from 'esbuild';
import { mkdir, rm, writeFile } from 'node:fs/promises';

const out = '.vercel/output';
const fn = `${out}/functions/index.func`;

await rm(out, { recursive: true, force: true });
await mkdir(fn, { recursive: true });

await build({
  entryPoints: ['src/vercel.ts'],
  outfile: `${fn}/index.mjs`,
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node24',
  sourcemap: true,
  // Lets bundled CommonJS dependencies call require().
  banner: { js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);" },
});

await writeFile(
  `${fn}/.vc-config.json`,
  JSON.stringify({ runtime: 'nodejs24.x', handler: 'index.mjs', launcherType: 'Nodejs' }, null, 2),
);
await writeFile(
  `${out}/config.json`,
  JSON.stringify({ version: 3, routes: [{ src: '/(.*)', dest: '/index' }] }, null, 2),
);

console.log(`Built ${fn}/index.mjs`);
