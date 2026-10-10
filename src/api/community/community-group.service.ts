import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import { assertOwnedAsset } from '../file-asset/asset-purpose-rules';
import { paginationMeta } from '~/common/dto/response-meta.dto';
import { assetUrl } from '~/common/storage/asset-url';
import { escapeLike } from '~/common/util/escape-like';
import { findGroup, findMembership, GROUP_NOT_FOUND } from './community-access';
import { Membership } from './community.constants';
import {
  CommunityGroupListQueryDto,
  CommunityGroupResponseDto,
  CommunityJoinRequestDto,
  CommunityMembershipDto,
  CreateCommunityGroupDto,
} from './dto/community-group.dto';
import { CommunityGroupMember } from './entities/community-group-member.entity';
import { CommunityGroup } from './entities/community-group.entity';

export const OWNER_ONLY = 'Only the group owner can do this';
export const OWNER_CANNOT_LEAVE = 'The owner cannot leave their own group';
export const REQUEST_NOT_FOUND = 'Join request not found';

interface GroupRow {
  id: string;
  name: string;
  description: string | null;
  image_key: string | null;
  access: CommunityGroupResponseDto['access'];
  member_count: number;
  owner_id: string;
  owner_name: string;
  owner_avatar_key: string | null;
  created_at: Date;
  caller_role: string | null;
  caller_status: string | null;
}

// $1 = caller id or null. Member counts come from active rows, so they never drift.
const GROUP_SELECT = `
  SELECT g.id, g.name, g.description, image.object_key AS image_key, g.access, g.created_at,
         (SELECT count(*)::integer FROM community_group_members m
          WHERE m.group_id = g.id AND m.status = 'active' AND m.deleted_at IS NULL) AS member_count,
         owner.id AS owner_id, owner.name AS owner_name, owner_avatar.object_key AS owner_avatar_key,
         caller.role AS caller_role, caller.status AS caller_status
  FROM community_groups g
  INNER JOIN users owner ON owner.id = g.owner_user_id
  LEFT JOIN user_profiles owner_profile
    ON owner_profile.user_id = owner.id AND owner_profile.deleted_at IS NULL
  LEFT JOIN file_assets owner_avatar
    ON owner_avatar.id = owner_profile.avatar_asset_id AND owner_avatar.deleted_at IS NULL
  LEFT JOIN file_assets image ON image.id = g.image_asset_id AND image.deleted_at IS NULL
  LEFT JOIN community_group_members caller
    ON caller.group_id = g.id AND caller.user_id = $1::uuid AND caller.deleted_at IS NULL`;

@Injectable()
export class CommunityGroupService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async create(userId: string, input: CreateCommunityGroupDto) {
    const groupId = await this.dataSource.transaction(async (manager) => {
      await assertOwnedAsset(
        manager,
        userId,
        input.image_asset_id,
        'community_group_image',
      );
      const group = await manager.save(
        CommunityGroup,
        manager.create(CommunityGroup, {
          ownerUserId: userId,
          name: input.name,
          description: input.description ?? null,
          imageAssetId: input.image_asset_id,
          access: input.access,
        }),
      );
      await manager.save(
        CommunityGroupMember,
        manager.create(CommunityGroupMember, {
          groupId: group.id,
          userId,
          role: 'owner',
          status: 'active',
        }),
      );
      return group.id;
    });
    return {
      data: await this.findResponse(groupId, userId),
      responseMessage: 'Create community group success',
    };
  }

  async findAll(userId: string | null, query: CommunityGroupListQueryDto) {
    const { page, limit } = query;
    const conditions = ['g.deleted_at IS NULL'];
    const params: unknown[] = [userId];
    if (query.search) {
      params.push(`%${escapeLike(query.search)}%`);
      conditions.push(`g.name ILIKE $${params.length}`);
    }
    if (query.joined) {
      // Without a token nobody has joined anything.
      conditions.push(userId ? `caller.status = 'active'` : 'false');
    }
    const where = `WHERE ${conditions.join(' AND ')}`;
    const [{ total }] = await this.dataSource.query(
      `SELECT count(*)::integer AS total
       FROM community_groups g
       LEFT JOIN community_group_members caller
         ON caller.group_id = g.id AND caller.user_id = $1::uuid AND caller.deleted_at IS NULL
       ${where}`,
      params,
    );
    const rows: GroupRow[] = await this.dataSource.query(
      `${GROUP_SELECT} ${where}
       ORDER BY g.created_at DESC, g.id
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, (page - 1) * limit],
    );
    return {
      data: rows.map((row) => this.toResponse(row)),
      meta: paginationMeta(page, limit, total),
      responseMessage: 'Get community groups success',
    };
  }

  async findOne(userId: string | null, groupId: string) {
    return {
      data: await this.findResponse(groupId, userId),
      responseMessage: 'Get community group success',
    };
  }

  /** Public groups admit at once; request-only groups record a request. */
  async join(userId: string, groupId: string) {
    await this.dataSource.transaction(async (manager) => {
      const group = await this.lockGroup(manager, groupId);
      if (await findMembership(manager, group.id, userId)) return;
      await manager.save(
        CommunityGroupMember,
        manager.create(CommunityGroupMember, {
          groupId: group.id,
          userId,
          role: 'member',
          status: group.access === 'public' ? 'active' : 'pending',
        }),
      );
    });
    return {
      data: await this.membershipOf(groupId, userId),
      responseMessage: 'Join community group success',
    };
  }

  /** Leaves the group or cancels a pending request. */
  async leave(userId: string, groupId: string) {
    await this.dataSource.transaction(async (manager) => {
      const group = await this.lockGroup(manager, groupId);
      const member = await findMembership(manager, group.id, userId);
      if (!member) return;
      if (member.role === 'owner') {
        throw new BadRequestException(OWNER_CANNOT_LEAVE);
      }
      await manager.softDelete(CommunityGroupMember, { id: member.id });
    });
    return {
      data: await this.membershipOf(groupId, userId),
      responseMessage: 'Leave community group success',
    };
  }

  async findRequests(userId: string, groupId: string) {
    const group = await findGroup(this.dataSource.manager, groupId);
    this.assertOwner(group, userId);
    const rows: Array<{
      id: string;
      name: string;
      avatar_key: string | null;
      requested_at: Date;
    }> = await this.dataSource.query(
      `SELECT requester.id, requester.name, avatar.object_key AS avatar_key,
              request.created_at AS requested_at
       FROM community_group_members request
       INNER JOIN users requester ON requester.id = request.user_id AND requester.deleted_at IS NULL
       LEFT JOIN user_profiles profile ON profile.user_id = requester.id AND profile.deleted_at IS NULL
       LEFT JOIN file_assets avatar ON avatar.id = profile.avatar_asset_id AND avatar.deleted_at IS NULL
       WHERE request.group_id = $1 AND request.status = 'pending' AND request.deleted_at IS NULL
       ORDER BY request.created_at, request.id`,
      [group.id],
    );
    const data: CommunityJoinRequestDto[] = rows.map((row) => ({
      user: {
        id: row.id,
        name: row.name,
        avatar_url: assetUrl(row.avatar_key),
      },
      requested_at: row.requested_at,
    }));
    return { data, responseMessage: 'Get join requests success' };
  }

  async decideRequest(
    userId: string,
    groupId: string,
    requesterId: string,
    decision: 'accept' | 'reject',
  ) {
    await this.dataSource.transaction(async (manager) => {
      const group = await this.lockGroup(manager, groupId);
      this.assertOwner(group, userId);
      const request = await manager.findOneBy(CommunityGroupMember, {
        groupId: group.id,
        userId: requesterId,
        status: 'pending',
      });
      if (!request) throw new NotFoundException(REQUEST_NOT_FOUND);
      if (decision === 'accept') {
        await manager.update(
          CommunityGroupMember,
          { id: request.id },
          { status: 'active' },
        );
      } else {
        await manager.softDelete(CommunityGroupMember, { id: request.id });
      }
    });
    return {
      data: await this.membershipOf(groupId, requesterId),
      responseMessage:
        decision === 'accept'
          ? 'Accept join request success'
          : 'Reject join request success',
    };
  }

  // Locks the group row, so concurrent joins and decisions are ordered.
  private async lockGroup(
    manager: EntityManager,
    groupId: string,
  ): Promise<CommunityGroup> {
    const [locked] = await manager.query(
      'SELECT id FROM community_groups WHERE id = $1 AND deleted_at IS NULL FOR UPDATE',
      [groupId],
    );
    if (!locked) throw new NotFoundException(GROUP_NOT_FOUND);
    return findGroup(manager, groupId);
  }

  private assertOwner(group: CommunityGroup, userId: string): void {
    if (group.ownerUserId !== userId) throw new ForbiddenException(OWNER_ONLY);
  }

  private async membershipOf(
    groupId: string,
    userId: string,
  ): Promise<CommunityMembershipDto> {
    const group = await this.findResponse(groupId, userId);
    return { membership: group.membership, member_count: group.member_count };
  }

  private async findResponse(
    groupId: string,
    userId: string | null,
  ): Promise<CommunityGroupResponseDto> {
    const [row]: GroupRow[] = await this.dataSource.query(
      `${GROUP_SELECT} WHERE g.id = $2 AND g.deleted_at IS NULL`,
      [userId, groupId],
    );
    if (!row) throw new NotFoundException(GROUP_NOT_FOUND);
    return this.toResponse(row);
  }

  private toResponse(row: GroupRow): CommunityGroupResponseDto {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      image_url: assetUrl(row.image_key),
      access: row.access,
      member_count: row.member_count,
      owner: {
        id: row.owner_id,
        name: row.owner_name,
        avatar_url: assetUrl(row.owner_avatar_key),
      },
      membership: membershipFrom(row.caller_role, row.caller_status),
      created_at: row.created_at,
    };
  }
}

function membershipFrom(
  role: string | null,
  status: string | null,
): Membership {
  if (status === 'pending') return 'pending';
  if (status === 'active') return role === 'owner' ? 'owner' : 'member';
  return 'none';
}
