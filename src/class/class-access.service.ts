import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import {
  ClassAction,
  ClassArea,
  PermissionMatrix,
  TutorRole,
} from './class-permissions';

export type ClassAccess =
  | { kind: 'owner' }
  | { kind: 'tutor'; role: TutorRole; permissions: PermissionMatrix | null };

// Resolves the caller's relation to a class. The owner of the class's
// merchant has full access; an active assigned mentor is a tutor limited by
// its permission matrix; anyone else is told the class does not exist.
@Injectable()
export class ClassAccessService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async resolve(
    userId: string,
    classId: string,
    manager: EntityManager = this.dataSource.manager,
  ): Promise<ClassAccess> {
    const [row] = await manager.query(
      `SELECT merchant.user_id = $2 AS is_owner, tutor.role, tutor.permissions
       FROM classes class
       INNER JOIN merchants merchant
         ON merchant.id = class.merchant_id AND merchant.deleted_at IS NULL
       LEFT JOIN LATERAL (
         SELECT link.role, link.permissions
         FROM class_mentors link
         INNER JOIN mentors mentor
           ON mentor.id = link.mentor_id AND mentor.deleted_at IS NULL
           AND mentor.status = 'active'
         WHERE link.class_id = class.id AND link.deleted_at IS NULL
           AND mentor.user_id = $2
         LIMIT 1
       ) tutor ON true
       WHERE class.id = $1 AND class.deleted_at IS NULL`,
      [classId, userId],
    );
    if (row?.is_owner) return { kind: 'owner' };
    if (row?.role) {
      return { kind: 'tutor', role: row.role, permissions: row.permissions };
    }
    throw new NotFoundException('Class not found');
  }

  async requireOwner(
    userId: string,
    classId: string,
    manager?: EntityManager,
  ): Promise<void> {
    const access = await this.resolve(userId, classId, manager);
    if (access.kind !== 'owner') {
      throw new ForbiddenException('Only the class owner can do this');
    }
  }

  // Any assigned tutor may see the class itself, its students and tutors.
  async requireAssigned(
    userId: string,
    classId: string,
    manager?: EntityManager,
  ): Promise<ClassAccess> {
    return this.resolve(userId, classId, manager);
  }

  async requireAction(
    userId: string,
    classId: string,
    area: ClassArea,
    action: ClassAction,
    manager?: EntityManager,
  ): Promise<ClassAccess> {
    const access = await this.resolve(userId, classId, manager);
    if (!can(access, area, action)) {
      throw new ForbiddenException(
        `Tutor permission ${area}.${action} is required`,
      );
    }
    return access;
  }
}

export function can(
  access: ClassAccess,
  area: ClassArea,
  action: ClassAction,
): boolean {
  if (access.kind === 'owner') return true;
  return access.permissions?.[area]?.[action] === true;
}
