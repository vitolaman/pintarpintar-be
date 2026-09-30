import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import { ClassStatus, ClassType } from './entities/class.entity';

export interface LearnerEnrollment {
  enrollmentId: string;
  classId: string;
  merchantId: string;
  classType: ClassType;
  classStatus: ClassStatus;
}

// A learner reaches a class only through an active enrollment. The class may
// since have been unlisted or unpublished; bought access stays. Everyone
// else is told the class does not exist.
@Injectable()
export class LearnerAccessService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async requireEnrollment(
    userId: string,
    classId: string,
    manager: EntityManager = this.dataSource.manager,
  ): Promise<LearnerEnrollment> {
    const [row] = await manager.query(
      `SELECT enrollment.id AS enrollment_id, class.id AS class_id,
              class.merchant_id, class.type, class.status
       FROM enrollments enrollment
       INNER JOIN classes class
         ON class.id = enrollment.class_id AND class.deleted_at IS NULL
       WHERE enrollment.user_id = $1 AND enrollment.class_id = $2
         AND enrollment.deleted_at IS NULL`,
      [userId, classId],
    );
    if (!row) throw new NotFoundException('Class not found');
    return {
      enrollmentId: row.enrollment_id,
      classId: row.class_id,
      merchantId: row.merchant_id,
      classType: row.type,
      classStatus: row.status,
    };
  }
}
