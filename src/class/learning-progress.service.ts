import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import { Enrollment } from './entities/enrollment.entity';
import { VideoCompletion } from './entities/video-completion.entity';
import { ClassCertificateService } from './class-certificate.service';
import { LearnerAccessService } from './learner-access.service';

export interface NextVideo {
  id: string;
  title: string;
  chapter_id: string;
}

export interface LearnerProgress {
  class_id: string;
  progress: number;
  next_video: NextVideo | null;
}

// Whole-percentage progress of an enrollment: completed live videos over live
// videos of its class, 100 when the class has none. Stored as text in
// enrollments.progress (refreshed on completions and video changes), whose
// leading number the list screens parse.
// userRef and classRef are SQL column references of the enclosing query.
export function progressSql(userRef: string, classRef: string): string {
  return `(
    SELECT CASE WHEN count(video.id) = 0 THEN 100
                ELSE floor(count(completion.id) * 100.0 / count(video.id)) END
    FROM videos video
    INNER JOIN chapters chapter
      ON chapter.id = video.chapter_id AND chapter.deleted_at IS NULL
    LEFT JOIN video_completions completion
      ON completion.video_id = video.id AND completion.user_id = ${userRef}
      AND completion.deleted_at IS NULL
    WHERE chapter.class_id = ${classRef} AND video.deleted_at IS NULL
  )::integer`;
}

const PROGRESS_EXPRESSION = `${progressSql('enrollments.user_id', 'enrollments.class_id')}::text`;

@Injectable()
export class LearningProgressService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly learnerAccess: LearnerAccessService,
    private readonly certificates: ClassCertificateService,
  ) {}

  // Completing a video twice is harmless: the completion is unique per
  // learner and video.
  async completeVideo(userId: string, videoId: string) {
    return this.dataSource.transaction(async (manager) => {
      const [video] = await manager.query(
        `SELECT chapter.class_id
         FROM videos video
         INNER JOIN chapters chapter
           ON chapter.id = video.chapter_id AND chapter.deleted_at IS NULL
         WHERE video.id = $1 AND video.deleted_at IS NULL`,
        [videoId],
      );
      if (!video) throw new NotFoundException('Video not found');
      const classId: string = video.class_id;
      await this.learnerAccess.requireEnrollment(userId, classId, manager);

      await manager
        .createQueryBuilder()
        .insert()
        .into(VideoCompletion)
        .values({ user_id: userId, video_id: videoId, class_id: classId })
        .orIgnore()
        .execute();
      await this.recompute(manager, classId, userId);
      await this.certificates.issueEligible(manager, classId, [userId]);

      return {
        data: await this.findProgress(manager, classId, userId),
        responseMessage: 'Complete video success',
      };
    });
  }

  // Keeps stored progress true when videos are added or removed.
  async recomputeClass(manager: EntityManager, classId: string): Promise<void> {
    await this.recompute(manager, classId);
    await this.certificates.issueEligible(manager, classId);
  }

  async findProgress(
    manager: EntityManager,
    classId: string,
    userId: string,
  ): Promise<LearnerProgress> {
    // Computed live, so a class without videos reads 100 even before any
    // event has refreshed the stored value.
    const [enrollment] = await manager.query(
      `SELECT ${PROGRESS_EXPRESSION} AS progress FROM enrollments
       WHERE class_id = $1 AND user_id = $2 AND deleted_at IS NULL`,
      [classId, userId],
    );
    const [next] = await manager.query(
      `SELECT video.id, video.title, video.chapter_id
       FROM videos video
       INNER JOIN chapters chapter
         ON chapter.id = video.chapter_id AND chapter.deleted_at IS NULL
       WHERE chapter.class_id = $1 AND video.deleted_at IS NULL
         AND NOT EXISTS (
           SELECT 1 FROM video_completions completion
           WHERE completion.video_id = video.id AND completion.user_id = $2
             AND completion.deleted_at IS NULL)
       ORDER BY chapter."order", chapter.created_at, chapter.id,
                video."order", video.created_at, video.id
       LIMIT 1`,
      [classId, userId],
    );
    return {
      class_id: classId,
      progress: parseProgress(enrollment?.progress),
      next_video: next ?? null,
    };
  }

  private async recompute(
    manager: EntityManager,
    classId: string,
    userId?: string,
  ): Promise<void> {
    const update = manager
      .createQueryBuilder()
      .update(Enrollment)
      .set({ progress: () => PROGRESS_EXPRESSION })
      .where('class_id = :classId', { classId })
      .andWhere('deleted_at IS NULL');
    if (userId) update.andWhere('user_id = :userId', { userId });
    await update.execute();
  }
}

// Older enrollments may hold free text such as "85%"; its leading number is
// the percentage.
export function parseProgress(value: string | null | undefined): number {
  const match = /^\s*(\d+(?:\.\d+)?)/.exec(value ?? '');
  return match ? Math.min(100, Math.floor(Number(match[1]))) : 0;
}
