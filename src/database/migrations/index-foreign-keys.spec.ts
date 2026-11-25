import { QueryRunner } from 'typeorm';
import { IndexForeignKeys1795500000000 } from './pintar-pintar/1795500000000-index-foreign-keys';

// Migrations run at startup, so a rerun or a partly indexed database must not
// fail: every statement is guarded, and down removes exactly what up adds.
describe('IndexForeignKeys1795500000000', () => {
  const run = async (step: 'up' | 'down') => {
    const query = jest.fn();
    await new IndexForeignKeys1795500000000()[step]({
      query,
    } as unknown as QueryRunner);
    return query.mock.calls.map(([sql]) => sql as string);
  };
  const indexName = (sql: string) =>
    /(?:EXISTS) (\w+)/.exec(sql)?.[1] ?? 'missing';

  it('creates each index only when it does not exist', async () => {
    const statements = await run('up');
    expect(statements).toHaveLength(10);
    for (const sql of statements) {
      expect(sql).toMatch(/^CREATE INDEX IF NOT EXISTS idx_\w+ ON \w+ \(/);
    }
    expect(new Set(statements.map(indexName)).size).toBe(statements.length);
  });

  it('covers the foreign keys named by the audit', async () => {
    const statements = (await run('up')).join('\n');
    expect(statements).toContain('ON class_mentors (class_id, mentor_id)');
    expect(statements).toContain('ON class_mentors (mentor_id)');
    expect(statements).toContain('ON submissions (user_id)');
    expect(statements).toContain('ON user_access (product_id)');
  });

  it('drops in reverse order exactly the indexes it creates', async () => {
    const created = (await run('up')).map(indexName);
    const dropped = await run('down');
    for (const sql of dropped) {
      expect(sql).toMatch(/^DROP INDEX IF EXISTS idx_\w+$/);
    }
    expect(dropped.map(indexName)).toEqual([...created].reverse());
  });
});
