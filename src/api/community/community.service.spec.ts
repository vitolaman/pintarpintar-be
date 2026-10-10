import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { DataSource } from 'typeorm';
import { CommunityGroupService } from './community-group.service';
import { CommunityThreadService } from './community-thread.service';
import { CreateCommunityGroupDto } from './dto/community-group.dto';
import {
  CreateCommunityReplyDto,
  CreateCommunityThreadDto,
} from './dto/community-thread.dto';
import { CommunityGroupMember } from './entities/community-group-member.entity';
import { CommunityGroup } from './entities/community-group.entity';
import { CommunityThread } from './entities/community-thread.entity';

jest.mock('../file-asset/asset-purpose-rules', () => ({
  ...jest.requireActual('../file-asset/asset-purpose-rules'),
  assertOwnedAsset: jest.fn(async () => ({})),
}));

const OWNER = '10000000-0000-4000-8000-000000000001';
const USER = '10000000-0000-4000-8000-000000000002';
const GROUP = '20000000-0000-4000-8000-000000000001';
const THREAD = '30000000-0000-4000-8000-000000000001';
const IMAGE = '40000000-0000-4000-8000-000000000001';

const errorFields = async (target: new () => object, input: object) =>
  (await validate(plainToInstance(target, input))).map((e) => e.property);

describe('community DTOs', () => {
  const group = { name: ' Revit ', image_asset_id: IMAGE, access: 'public' };

  it.each([
    [group, []],
    [{ ...group, access: 'Request' }, []],
    [{ ...group, access: 'secret' }, ['access']],
    [{ ...group, name: '  ' }, ['name']],
    [{ ...group, name: 'x'.repeat(81) }, ['name']],
    [{ ...group, image_asset_id: undefined }, ['image_asset_id']],
    [{ ...group, description: 'x'.repeat(501) }, ['description']],
  ])('validates a group %j', async (input, fields) => {
    expect(await errorFields(CreateCommunityGroupDto, input)).toEqual(fields);
  });

  it('validates a thread and a reply', async () => {
    expect(
      await errorFields(CreateCommunityThreadDto, {
        group_id: GROUP,
        content: 'x'.repeat(5001),
      }),
    ).toEqual(['content']);
    expect(
      await errorFields(CreateCommunityThreadDto, {
        group_id: GROUP,
        item: { id: 'not-a-uuid' },
      }),
    ).toEqual(['item']);
    expect(
      await errorFields(CreateCommunityReplyDto, { content: ' ' }),
    ).toEqual(['content']);
  });
});

function setup() {
  const state: {
    group: Partial<CommunityGroup> | null;
    member: Partial<CommunityGroupMember> | null;
    thread: Partial<CommunityThread> | null;
    saved: unknown[];
    softDeleted: unknown[];
    updated: unknown[];
    merchant: { id: string } | null;
  } = {
    group: { id: GROUP, ownerUserId: OWNER, access: 'public' },
    member: null,
    thread: null,
    saved: [],
    softDeleted: [],
    updated: [],
    merchant: null,
  };
  const manager = {
    findOneBy: jest.fn(async (entity, where) => {
      if (entity === CommunityGroup) return state.group;
      if (entity === CommunityGroupMember) {
        if (where.status && state.member?.status !== where.status) return null;
        return state.member;
      }
      if (entity === CommunityThread) return state.thread;
      return null;
    }),
    query: jest.fn(async (sql: string) => {
      if (sql.includes('FOR UPDATE')) return state.group ? [{ id: GROUP }] : [];
      if (sql.includes('FROM merchants WHERE user_id')) {
        return state.merchant ? [state.merchant] : [];
      }
      return [];
    }),
    create: jest.fn((_entity, value) => ({ ...value })),
    save: jest.fn(async (_entity, value) => {
      state.saved.push(value);
      return { ...value, id: 'new-id' };
    }),
    softDelete: jest.fn(async (_entity, where) =>
      state.softDeleted.push(where),
    ),
    update: jest.fn(async (_entity, where, value) =>
      state.updated.push({ where, value }),
    ),
  };
  const dataSource = {
    manager,
    query: jest.fn(async () => []),
    transaction: jest.fn((callback) => callback(manager)),
  };
  return { state, manager, dataSource: dataSource as unknown as DataSource };
}

describe('CommunityGroupService', () => {
  it('makes the creator the owner and first active member', async () => {
    const { state, dataSource } = setup();
    const service = new CommunityGroupService(dataSource);
    await service
      .create(OWNER, {
        name: 'Revit',
        image_asset_id: IMAGE,
        access: 'request',
      })
      .catch(() => undefined);
    expect(state.saved).toEqual([
      expect.objectContaining({ ownerUserId: OWNER, access: 'request' }),
      expect.objectContaining({
        userId: OWNER,
        role: 'owner',
        status: 'active',
      }),
    ]);
  });

  it.each([
    ['public', 'active'],
    ['request', 'pending'],
  ])('joining a %s group records an %s member', async (access, status) => {
    const { state, dataSource } = setup();
    state.group = { ...state.group, access: access as 'public' | 'request' };
    await new CommunityGroupService(dataSource)
      .join(USER, GROUP)
      .catch(() => undefined);
    expect(state.saved).toEqual([
      expect.objectContaining({ userId: USER, role: 'member', status }),
    ]);
  });

  it('joining again changes nothing', async () => {
    const { state, dataSource } = setup();
    state.member = { id: 'm1', userId: USER, status: 'active', role: 'member' };
    await new CommunityGroupService(dataSource)
      .join(USER, GROUP)
      .catch(() => undefined);
    expect(state.saved).toEqual([]);
  });

  it('refuses to let the owner leave', async () => {
    const { state, dataSource } = setup();
    state.member = { id: 'm1', userId: OWNER, status: 'active', role: 'owner' };
    await expect(
      new CommunityGroupService(dataSource).leave(OWNER, GROUP),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(state.softDeleted).toEqual([]);
  });

  it('lets only the owner decide a request', async () => {
    const { state, dataSource } = setup();
    state.member = {
      id: 'm1',
      userId: USER,
      status: 'pending',
      role: 'member',
    };
    await expect(
      new CommunityGroupService(dataSource).decideRequest(
        USER,
        GROUP,
        USER,
        'accept',
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(state.updated).toEqual([]);
  });

  it('accepts a pending request and rejects a missing one', async () => {
    const { state, dataSource } = setup();
    const service = new CommunityGroupService(dataSource);
    state.member = {
      id: 'm1',
      userId: USER,
      status: 'pending',
      role: 'member',
    };
    await service
      .decideRequest(OWNER, GROUP, USER, 'accept')
      .catch(() => undefined);
    expect(state.updated).toEqual([
      { where: { id: 'm1' }, value: { status: 'active' } },
    ]);
    state.member = null;
    await expect(
      service.decideRequest(OWNER, GROUP, USER, 'reject'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('CommunityThreadService', () => {
  const service = (dataSource: DataSource) =>
    new CommunityThreadService(
      dataSource,
      new ConfigService({
        AWS_S3_BUCKET_NAME: 'bucket',
        AWS_REGION: 'us-east-1',
        AWS_ACCESS_KEY_ID: 'test',
        AWS_SECRET_ACCESS_KEY: 'test',
      }),
    );

  it('refuses a post from a non-member or a pending requester', async () => {
    const { state, dataSource } = setup();
    await expect(
      service(dataSource).create(USER, { group_id: GROUP, content: 'Halo' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    state.member = {
      id: 'm1',
      userId: USER,
      status: 'pending',
      role: 'member',
    };
    await expect(
      service(dataSource).create(USER, { group_id: GROUP, content: 'Halo' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(state.saved).toEqual([]);
  });

  it('refuses an empty thread', async () => {
    const { state, dataSource } = setup();
    state.member = { id: 'm1', userId: USER, status: 'active', role: 'member' };
    await expect(
      service(dataSource).create(USER, { group_id: GROUP, content: null }),
    ).rejects.toThrow('A thread needs text, an attachment or an item');
  });

  it('lets only merchants promote an item', async () => {
    const { state, dataSource } = setup();
    state.member = { id: 'm1', userId: USER, status: 'active', role: 'member' };
    await expect(
      service(dataSource).create(USER, {
        group_id: GROUP,
        item: { id: '50000000-0000-4000-8000-000000000001' },
      }),
    ).rejects.toThrow('Only merchants can promote an item');
    expect(state.saved).toEqual([]);
  });

  it('lets only the author or the group owner delete a thread', async () => {
    const { state, dataSource } = setup();
    state.thread = { id: THREAD, groupId: GROUP, authorUserId: OWNER };
    const stranger = '10000000-0000-4000-8000-000000000003';
    await expect(
      service(dataSource).removeThread(stranger, THREAD),
    ).rejects.toBeInstanceOf(ForbiddenException);
    state.thread = { id: THREAD, groupId: GROUP, authorUserId: USER };
    await service(dataSource).removeThread(OWNER, THREAD);
    expect(state.softDeleted).toEqual([{ id: THREAD }]);
  });

  it('hides a request-only group from non-members', async () => {
    const { state, dataSource } = setup();
    state.group = { ...state.group, access: 'request' };
    state.thread = { id: THREAD, groupId: GROUP, authorUserId: OWNER };
    await expect(
      service(dataSource).findOne(USER, THREAD),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      service(dataSource).findOne(null, THREAD),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
