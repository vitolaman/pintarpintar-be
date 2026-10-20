import { BadRequestException } from '@nestjs/common';
import {
  copyAssignmentResources,
  loadAssignmentResources,
  requestedResourceIds,
} from './assignment-resources';
import { AssignmentResource } from './entities/assignment-resource.entity';

describe('requestedResourceIds', () => {
  it.each([
    [{}, undefined],
    [{ resource_asset_id: 'a' }, ['a']],
    [{ resource_asset_id: null }, []],
    [{ resource_asset_ids: ['a', 'b'] }, ['a', 'b']],
    [{ resource_asset_ids: ['a', 'b'], resource_asset_id: 'a' }, ['a', 'b']],
    [{ resource_asset_ids: [], resource_asset_id: null }, []],
    [{ resource_asset_ids: ['a'], resource_asset_id: undefined }, ['a']],
  ])('reads %j as %j', (input, expected) => {
    expect(requestedResourceIds(input)).toEqual(expected);
  });

  it.each([
    [{ resource_asset_ids: ['a', 'b'], resource_asset_id: 'b' }],
    [{ resource_asset_ids: [], resource_asset_id: 'a' }],
  ])('rejects %j', (input) => {
    expect(() => requestedResourceIds(input)).toThrow(BadRequestException);
  });
});

describe('loadAssignmentResources', () => {
  it('groups the files per assignment in query order', async () => {
    const query = jest.fn<Promise<unknown[]>, [string, unknown[]]>(async () => [
      {
        assignment_id: 'x',
        id: 'a1',
        object_key: 'k1',
        original_filename: 'a.pdf',
        size_bytes: '1',
      },
      {
        assignment_id: 'x',
        id: 'a2',
        object_key: 'k2',
        original_filename: 'b.pdf',
        size_bytes: '2',
      },
      {
        assignment_id: 'y',
        id: 'a3',
        object_key: 'k3',
        original_filename: 'c.pdf',
        size_bytes: '3',
      },
    ]);

    const files = await loadAssignmentResources({ query } as never, [
      { id: 'x', resource_asset_id: 'a1' },
      { id: 'y', resource_asset_id: null },
    ]);

    expect(files.get('x')?.map((file) => file.id)).toEqual(['a1', 'a2']);
    expect(files.get('y')?.map((file) => file.id)).toEqual(['a3']);
    expect(query.mock.calls[0][1]).toEqual([['x', 'y']]);
  });

  it('queries nothing without assignments', async () => {
    const query = jest.fn();

    expect((await loadAssignmentResources({ query } as never, [])).size).toBe(
      0,
    );
    expect(query).not.toHaveBeenCalled();
  });
});

describe('copyAssignmentResources', () => {
  it('copies the files of each source assignment to its copy, in order', async () => {
    const query = jest.fn(async () => [
      { assignment_id: 'source-1', asset_id: 'a1', position: 0 },
      { assignment_id: 'source-1', asset_id: 'a2', position: 1 },
    ]);
    const insert = jest.fn();

    await copyAssignmentResources(
      { query, insert } as never,
      new Map([['source-1', 'copy-1']]),
    );

    expect(insert).toHaveBeenCalledWith(AssignmentResource, [
      { assignmentId: 'copy-1', assetId: 'a1', position: 0 },
      { assignmentId: 'copy-1', assetId: 'a2', position: 1 },
    ]);
  });
});
