import { existsSync, readdirSync, readFileSync, statSync } from 'fs';
import { dirname, join, resolve } from 'path';

// Swagger keys schemas by class name, so two DTO classes with one name publish
// a single schema and the frontend's generated types go wrong for the other.
// This walks every file reachable from a controller and requires unique names.

const SRC = resolve(__dirname, '..', '..');

function sourceFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return path.endsWith('.ts') && !path.endsWith('.spec.ts') ? [path] : [];
  });
}

function resolveImport(from: string, specifier: string): string | null {
  let base: string;
  if (specifier.startsWith('~/')) base = join(SRC, specifier.slice(2));
  else if (specifier.startsWith('.')) base = resolve(dirname(from), specifier);
  else return null;
  for (const candidate of [`${base}.ts`, join(base, 'index.ts')]) {
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

function reachableFromControllers(): Set<string> {
  const pending = sourceFiles(SRC).filter((file) =>
    file.endsWith('.controller.ts'),
  );
  const seen = new Set<string>(pending);
  while (pending.length > 0) {
    const file = pending.pop() as string;
    const imports = readFileSync(file, 'utf8').matchAll(/from\s+'([^']+)'/g);
    for (const [, specifier] of imports) {
      const target = resolveImport(file, specifier);
      if (target && !seen.has(target)) {
        seen.add(target);
        pending.push(target);
      }
    }
  }
  return seen;
}

describe('Swagger schema names', () => {
  it('gives every DTO class reachable from a controller a unique name', () => {
    const owners = new Map<string, string[]>();
    for (const file of reachableFromControllers()) {
      for (const [, name] of readFileSync(file, 'utf8').matchAll(
        /^export class (\w+Dto)\b/gm,
      )) {
        owners.set(name, [...(owners.get(name) ?? []), file]);
      }
    }
    const duplicates = [...owners.entries()]
      .filter(([, files]) => files.length > 1)
      .map(
        ([name, files]) =>
          `${name}: ${files.map((file) => file.slice(SRC.length + 1)).join(', ')}`,
      );
    expect(duplicates).toEqual([]);
  });
});
