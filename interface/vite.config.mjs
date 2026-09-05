import { readdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { gzip } from 'node:zlib';
import { promisify } from 'node:util';

import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv, transformWithOxc } from 'vite';

const gzipAsync = promisify(gzip);

const normalizeBase = value => {
  if (!value || value === '/') return '/';
  return `/${value.replace(/^\/+|\/+$/g, '')}/`;
};

// The application predates the .jsx convention and rolldown's parser rejects
// JSX in a .js file, so the parse has to be forced ahead of the bundler;
// dropping this plugin fails the build. node_modules is excluded because
// dependencies such as promise-polyfill also publish sources under src/, and
// those are not JSX.
const loadJavaScriptAsJsx = () => ({
  name: 'load-javascript-as-jsx',
  enforce: 'pre',
  async transform(code, id) {
    if (id.includes('/node_modules/') || !/\/src\/.*\.js$/.test(id)) return null;
    return transformWithOxc(code, id, {
      lang: 'jsx',
      jsx: { runtime: 'classic' }
    });
  }
});

// ESPAsyncWebServer answers a request for /js/<name>.js with <name>.js.gz, so
// the device image carries only the compressed copy.
const compressDeviceJavaScript = outputDirectory => ({
  name: 'compress-device-javascript',
  apply: 'build',
  async writeBundle() {
    const jsDirectory = resolve(outputDirectory, 'js');
    for (const name of await readdir(jsDirectory)) {
      if (!name.endsWith('.js')) continue;
      const path = resolve(jsDirectory, name);
      const compressed = await gzipAsync(await readFile(path), { level: 9 });
      await writeFile(`${path}.gz`, compressed);
      await unlink(path);
    }
  }
});

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const deviceBuild = env.SMARTPOD_BUILD_TARGET !== 'demo';
  const outputDirectory = resolve(process.cwd(), 'build');

  return {
    base: normalizeBase(env.PUBLIC_URL),
    // The firmware pins CORS_ORIGIN to this origin at build time, so the dev
    // server cannot drift off port 3000 without breaking device development.
    server: { port: 3000, strictPort: true },
    // Without this the scanner also treats the previous build output as an
    // entry, which is stale and unparseable.
    optimizeDeps: { entries: 'index.html' },
    define: {
      'process.env.PUBLIC_URL': JSON.stringify(normalizeBase(env.PUBLIC_URL).replace(/\/$/, '')),
      'process.env.REACT_APP_DEMO_MODE': JSON.stringify(env.REACT_APP_DEMO_MODE || ''),
      'process.env.REACT_APP_ENDPOINT_ROOT': JSON.stringify(env.REACT_APP_ENDPOINT_ROOT || ''),
      'process.env.REACT_APP_NAME': JSON.stringify(env.REACT_APP_NAME || '')
    },
    plugins: [
      loadJavaScriptAsJsx(),
      react({ include: /\.js$/, jsxRuntime: 'classic' }),
      ...(deviceBuild ? [compressDeviceJavaScript(outputDirectory)] : [])
    ],
    build: {
      outDir: outputDirectory,
      emptyOutDir: true,
      sourcemap: false,
      // Vite's default floor is far newer than the browsers this dashboard is
      // opened from over the device access point. This replaces the browserslist
      // field, which Vite does not read.
      target: 'es2019',
      rollupOptions: {
        output: deviceBuild ? {
          entryFileNames: 'js/[name].[hash:6].js',
          chunkFileNames: 'js/[name].[hash:6].js',
          assetFileNames: 'css/[name].[hash:6][extname]'
        } : undefined
      }
    },
    test: {
      environment: 'jsdom',
      globals: true
    }
  };
});
