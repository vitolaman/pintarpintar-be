import { dataSourceOptions } from './database.data-source';

describe('dataSourceOptions', () => {
  it('never synchronizes the schema and applies recorded migrations at startup', () => {
    expect(dataSourceOptions.synchronize).toBe(false);
    expect(dataSourceOptions.migrationsRun).toBe(true);
  });
});
