import { dataSourceOptions, poolSize } from './database.data-source';

describe('dataSourceOptions', () => {
  it('never synchronizes the schema and applies recorded migrations at startup', () => {
    expect(dataSourceOptions.synchronize).toBe(false);
    expect(dataSourceOptions.migrationsRun).toBe(true);
  });
});

describe('poolSize', () => {
  it('defaults to 20 connections', () => {
    expect(poolSize(undefined)).toBe(20);
    expect(poolSize(' ')).toBe(20);
  });

  it('takes a whole number from 1 to 90', () => {
    expect(poolSize('30')).toBe(30);
    expect(poolSize('1')).toBe(1);
    expect(poolSize('90')).toBe(90);
  });

  it.each(['0', '91', '12.5', 'twenty', '-5'])('rejects %j', (value) => {
    expect(() => poolSize(value)).toThrow(
      'DB_POOL_MAX must be a whole number from 1 to 90',
    );
  });
});
