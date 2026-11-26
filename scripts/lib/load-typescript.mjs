import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import ts from 'typescript';

// Runs project TypeScript in Node for data migrations and behavioral tests.
export function loadTypeScript(filename, cache = new Map()) {
  filename = path.resolve(filename);
  if (cache.has(filename)) return cache.get(filename).exports;
  const module = { exports: {} };
  cache.set(filename, module);
  const nativeRequire = createRequire(filename);
  const localRequire = name => {
    if (name.startsWith('.')) {
      const resolved = path.resolve(path.dirname(filename), name);
      if (fs.existsSync(resolved + '.ts')) return loadTypeScript(resolved + '.ts', cache);
      if (resolved.endsWith('.json')) return JSON.parse(fs.readFileSync(resolved, 'utf8'));
    }
    return nativeRequire(name);
  };
  const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, esModuleInterop: true },
  }).outputText;
  new Function('require', 'module', 'exports', code)(localRequire, module, module.exports);
  return module.exports;
}
