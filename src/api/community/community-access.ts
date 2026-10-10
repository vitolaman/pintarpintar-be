import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { CommunityGroupMember } from './entities/community-group-member.entity';
import { CommunityGroup } from './entities/community-group.entity';

export const GROUP_NOT_FOUND = 'Community group not found';
export const THREAD_NOT_FOUND = 'Community thread not found';
export const REPLY_NOT_FOUND = 'Community reply not found';
export const JOIN_TO_READ = 'Join this group to read its threads';
export const JOIN_TO_POST = 'Join this group to post or reply';

// Author identity for responses: name, avatar and badge, never contact data.
// `$alias` is the users row of the author.
export const authorColumns = (alias: string, prefix: string) => `
  ${alias}.id AS ${prefix}_id, ${alias}.name AS ${prefix}_name,
  ${prefix}_avatar.object_key AS ${prefix}_avatar_key,
  CASE WHEN ${alias}.is_merchant THEN 'Merchant'
       WHEN ${alias}.is_mentor THEN 'Mentor'
       ELSE 'Siswa' END AS ${prefix}_badge`;

export const authorJoins = (alias: string, prefix: string) => `
  LEFT JOIN user_profiles ${prefix}_profile
    ON ${prefix}_profile.user_id = ${alias}.id AND ${prefix}_profile.deleted_at IS NULL
  LEFT JOIN file_assets ${prefix}_avatar
    ON ${prefix}_avatar.id = ${prefix}_profile.avatar_asset_id AND ${prefix}_avatar.deleted_at IS NULL`;

// Groups whose threads the caller (`userParam`, a placeholder) can read:
// public ones and those they own or belong to.
export const readableGroupCondition = (group: string, userParam: string) => `
  (${group}.access = 'public' OR EXISTS (
    SELECT 1 FROM community_group_members readable
    WHERE readable.group_id = ${group}.id AND readable.user_id = ${userParam}::uuid
      AND readable.status = 'active' AND readable.deleted_at IS NULL))`;

export async function findGroup(
  manager: EntityManager,
  groupId: string,
): Promise<CommunityGroup> {
  const group = await manager.findOneBy(CommunityGroup, { id: groupId });
  if (!group) throw new NotFoundException(GROUP_NOT_FOUND);
  return group;
}

export function findMembership(
  manager: EntityManager,
  groupId: string,
  userId: string | null,
): Promise<CommunityGroupMember | null> {
  if (!userId) return Promise.resolve(null);
  return manager.findOneBy(CommunityGroupMember, { groupId, userId });
}

export function isActiveMember(member: CommunityGroupMember | null): boolean {
  return member?.status === 'active';
}

/** Public groups are readable by anyone; request-only ones by members. */
export async function assertCanRead(
  manager: EntityManager,
  group: CommunityGroup,
  userId: string | null,
): Promise<CommunityGroupMember | null> {
  const member = await findMembership(manager, group.id, userId);
  if (group.access !== 'public' && !isActiveMember(member)) {
    throw new ForbiddenException(JOIN_TO_READ);
  }
  return member;
}

/** Only the owner and active members post, reply in a group. */
export async function assertMember(
  manager: EntityManager,
  groupId: string,
  userId: string,
): Promise<CommunityGroupMember> {
  const member = await findMembership(manager, groupId, userId);
  if (!isActiveMember(member)) throw new ForbiddenException(JOIN_TO_POST);
  return member;
}
