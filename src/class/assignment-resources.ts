import { applyDecorators, BadRequestException } from '@nestjs/common';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayMaxSize, ArrayUnique, IsArray, IsUUID } from 'class-validator';
import { EntityManager } from 'typeorm';
import {
  allowedTypesText,
  sizeLimitText,
} from '../api/file-asset/asset-purpose-rules';
import { OptionalNotNull } from '../common/decorator/optional-not-null.decorator';
import { AssignmentResource } from './entities/assignment-resource.entity';

export const MAX_ASSIGNMENT_RESOURCES = 10;

export type ResourceInput = {
  resource_asset_id?: string | null;
  resource_asset_ids?: string[];
};

export type ResourceAsset = {
  id: string;
  object_key: string;
  original_filename: string;
  size_bytes: string;
};

/** The ordered resource files of an assignment: up to 10 distinct uploads. */
export const ResourceAssetIds = () =>
  applyDecorators(
    ApiPropertyOptional({
      type: [String],
      format: 'uuid',
      maxItems: MAX_ASSIGNMENT_RESOURCES,
      description: `Ordered asset_ids from POST /api/v1/upload/complete (${allowedTypesText('assignment_resource')}, up to ${sizeLimitText('assignment_resource')} each), at most ${MAX_ASSIGNMENT_RESOURCES}; replaces all resource files, and [] removes them. resource_asset_id may be sent too, empty or equal to the first id.`,
    }),
    OptionalNotNull(),
    IsArray(),
    ArrayMaxSize(MAX_ASSIGNMENT_RESOURCES),
    ArrayUnique(),
    IsUUID('all', { each: true }),
  );

/**
 * The resource list a request asks for, or undefined when it sends neither
 * field. `resource_asset_id` alone is the single-file form (null clears);
 * next to `resource_asset_ids` it may only repeat the first id, as the
 * frontend sends it.
 */
export function requestedResourceIds(
  input: ResourceInput,
): string[] | undefined {
  const { resource_asset_ids: list, resource_asset_id: single } = input;
  if (list !== undefined) {
    if (single && single !== list[0]) {
      throw new BadRequestException(
        'resource_asset_id must be the first of resource_asset_ids',
      );
    }
    return list;
  }
  if (single === undefined) return undefined;
  return single === null ? [] : [single];
}

/** Replaces an assignment's files; returns the first, for resource_asset_id. */
export async function writeAssignmentResources(
  manager: EntityManager,
  assignmentId: string,
  assetIds: string[],
): Promise<string | null> {
  await manager.delete(AssignmentResource, { assignmentId });
  if (assetIds.length > 0) {
    await manager.insert(
      AssignmentResource,
      assetIds.map((assetId, position) => ({
        assignmentId,
        assetId,
        position,
      })),
    );
  }
  return assetIds[0] ?? null;
}

/**
 * The files of several assignments, in order; deleted uploads are left out.
 * An assignment with no rows falls back to its resource_asset_id (written by
 * an older version during a rollback).
 */
export async function loadAssignmentResources(
  manager: EntityManager,
  assignments: Array<{ id: string; resource_asset_id: string | null }>,
): Promise<Map<string, ResourceAsset[]>> {
  const result = new Map<string, ResourceAsset[]>();
  if (assignments.length === 0) return result;
  const rows: Array<ResourceAsset & { assignment_id: string }> =
    await manager.query(
      `SELECT assignment.id AS assignment_id, asset.id, asset.object_key,
              asset.original_filename, asset.size_bytes
       FROM assignments assignment
       INNER JOIN LATERAL (
         SELECT resource.asset_id, resource.position FROM assignment_resources resource
         WHERE resource.assignment_id = assignment.id AND resource.deleted_at IS NULL
         UNION ALL
         SELECT assignment.resource_asset_id, 0
         WHERE assignment.resource_asset_id IS NOT NULL AND NOT EXISTS (
           SELECT 1 FROM assignment_resources resource
           WHERE resource.assignment_id = assignment.id AND resource.deleted_at IS NULL)
       ) file ON true
       INNER JOIN file_assets asset ON asset.id = file.asset_id AND asset.deleted_at IS NULL
       WHERE assignment.id = ANY($1::uuid[])
       ORDER BY assignment.id, file.position`,
      [assignments.map((assignment) => assignment.id)],
    );
  for (const row of rows) {
    const { assignment_id: assignmentId, ...asset } = row;
    result.set(assignmentId, [...(result.get(assignmentId) ?? []), asset]);
  }
  return result;
}

/** Copies the files of duplicated assignments, in order (class duplication). */
export async function copyAssignmentResources(
  manager: EntityManager,
  copies: Map<string, string>,
): Promise<void> {
  if (copies.size === 0) return;
  const rows = await manager.query(
    `SELECT assignment_id, asset_id, position FROM assignment_resources
     WHERE assignment_id = ANY($1::uuid[]) AND deleted_at IS NULL
     ORDER BY assignment_id, position`,
    [[...copies.keys()]],
  );
  if (rows.length === 0) return;
  await manager.insert(
    AssignmentResource,
    rows.map(
      (row: { assignment_id: string; asset_id: string; position: number }) => ({
        assignmentId: copies.get(row.assignment_id),
        assetId: row.asset_id,
        position: row.position,
      }),
    ),
  );
}
