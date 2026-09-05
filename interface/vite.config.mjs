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

const loadJavaScriptAsJsx = () => ({
  name: 'load-javascript-as-jsx',
  enforce: 'pre',
  async transform(code, id) {
    if (!/\/src\/.*\.js$/.test(id)) return null;
    return transformWithOxc(code, id, {
      lang: 'jsx',
      jsx: { runtime: 'classic' }
    });
  }
});

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
