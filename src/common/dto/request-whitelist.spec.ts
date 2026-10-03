import { getMetadataStorage } from 'class-validator';
import { readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

// With `whitelist: true` the validation pipe strips every property that has no
// class-validator decorator, so a documented request field without one would
// be dropped silently. Request DTOs are the classes that carry validators.
const SWAGGER_PROPERTIES = 'swagger/apiModelPropertiesArray';

function dtoFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) return dtoFiles(path);
    return /\.dto\.ts$/.test(entry) ? [path] : [];
  });
}

describe('request DTO whitelist', () => {
  it('gives every documented field of a request DTO a validator', () => {
    const storage = getMetadataStorage();
    const missing: string[] = [];
    const root = join(__dirname, '..', '..');
    for (const file of dtoFiles(root)) {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const exported = require(file);
      for (const value of Object.values(exported)) {
        if (typeof value !== 'function') continue;
        const target = value as new () => unknown;
        const validated = new Set(
          storage
            .getTargetValidationMetadatas(target, '', true, false)
            .map((meta) => meta.propertyName),
        );
        if (validated.size === 0) continue;
        const documented: string[] = (
          Reflect.getMetadata(SWAGGER_PROPERTIES, target.prototype) ?? []
        ).map((key: string) => key.replace(/^:/, ''));
        for (const property of documented) {
          if (!validated.has(property)) {
            missing.push(`${relative(root, file)} ${target.name}.${property}`);
          }
        }
      }
    }
    expect(missing).toEqual([]);
  });
});
