import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager, In } from 'typeorm';
import { ClassAccessService } from './class-access.service';
import { ClassService } from './class.service';
import { Assignment } from './entities/assignment.entity';
import { AssignmentQuestion } from './entities/assignment-question.entity';
import { Chapter } from './entities/chapter.entity';
import { Class, ClassStatus, ClassType } from './entities/class.entity';
import { ClassCertificateSettings } from './entities/class-certificate-settings.entity';
import { ClassFaq } from './entities/class-faq.entity';
import { FileResource } from './entities/file-resource.entity';
import { Video } from './entities/video.entity';
import { copyClassCovers } from '../api/item-cover/item-covers';

const COPY_SUFFIX = ' (Salinan)';
const MAX_TITLE_LENGTH = 255;

// Copies a class into a new draft of the merchant: details, syllabus,
// assignments, certificate settings and FAQ. Learners, reviews, discussions,
// submissions, certificates, tutors and meetings stay with the original.
// Copied rows keep their original creation time, because quiz questions and
// FAQ entries are ordered by it.
@Injectable()
export class ClassDuplicationService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly classAccess: ClassAccessService,
    private readonly classService: ClassService,
  ) {}

  async duplicate(userId: string, classId: string, type: ClassType) {
    const copyId = await this.dataSource.transaction(async (manager) => {
      await this.classAccess.requireOwner(userId, classId, manager);
      const source = await manager.findOneOrFail(Class, {
        where: { id: classId },
        lock: { mode: 'pessimistic_read' },
      });

      const copy = await manager.save(
        manager.create(Class, {
          merchant_id: source.merchant_id,
          title: copyTitle(source.title),
          description: source.description,
          status: ClassStatus.DRAFT,
          type,
          originalPrice: source.originalPrice,
          discountedPrice: source.discountedPrice,
          cover_asset_id: source.cover_asset_id,
          post_purchase_instructions: source.post_purchase_instructions,
          category: source.category,
          skill_category: source.skill_category,
          level: source.level,
          duration: source.duration,
          prerequisites: source.prerequisites,
          learning_outcomes: source.learning_outcomes,
          created_by: userId,
        }),
      );
      await this.copySyllabus(manager, classId, copy.id, userId);
      await this.copyAssignments(manager, classId, copy.id, userId);
      await this.copyCertificateSettings(manager, classId, copy.id);
      await this.copyFaq(manager, classId, copy.id, userId);
      await copyClassCovers(manager, classId, copy.id);
      return copy.id;
    });

    const { data } = await this.classService.getClassById(userId, copyId);
    return { data, responseMessage: 'Duplicate class success' };
  }

  private async copySyllabus(
    manager: EntityManager,
    sourceId: string,
    copyId: string,
    userId: string,
  ): Promise<void> {
    const chapters = await manager.find(Chapter, {
      where: { class_id: sourceId },
    });
    if (chapters.length === 0) return;

    const chapterIds = new Map<string, string>();
    const copies = await manager.save(
      chapters.map((chapter) =>
        manager.create(Chapter, {
          class_id: copyId,
          title: chapter.title,
          description: chapter.description,
          order: chapter.order,
          created_at: chapter.created_at,
          created_by: userId,
        }),
      ),
    );
    chapters.forEach((chapter, index) =>
      chapterIds.set(chapter.id, copies[index].id),
    );

    const sourceChapterIds = [...chapterIds.keys()];
    const [videos, resources] = await Promise.all([
      manager.find(Video, { where: { chapter_id: In(sourceChapterIds) } }),
      manager.find(FileResource, {
        where: { chapter_id: In(sourceChapterIds) },
      }),
    ]);
    await manager.save(
      videos.map((video) =>
        manager.create(Video, {
          chapter_id: chapterIds.get(video.chapter_id),
          title: video.title,
          description: video.description,
          youtubeUrl: video.youtubeUrl,
          source: video.source,
          asset_id: video.asset_id,
          duration: video.duration,
          order: video.order,
          created_at: video.created_at,
          created_by: userId,
        }),
      ),
    );
    // Files are shared: class flows never delete a file asset.
    await manager.save(
      resources.map((resource) =>
        manager.create(FileResource, {
          chapter_id: chapterIds.get(resource.chapter_id),
          name: resource.name,
          type: resource.type,
          url: resource.url,
          size: resource.size,
          description: resource.description,
          asset_id: resource.asset_id,
          order: resource.order,
          created_at: resource.created_at,
          created_by: userId,
        }),
      ),
    );
  }

  private async copyAssignments(
    manager: EntityManager,
    sourceId: string,
    copyId: string,
    userId: string,
  ): Promise<void> {
    const assignments = await manager.find(Assignment, {
      where: { class_id: sourceId },
    });
    if (assignments.length === 0) return;

    const copies = await manager.save(
      assignments.map((assignment) =>
        manager.create(Assignment, {
          class_id: copyId,
          title: assignment.title,
          description: assignment.description,
          due: assignment.due,
          type: assignment.type,
          resource_asset_id: assignment.resource_asset_id,
          created_at: assignment.created_at,
          created_by: userId,
        }),
      ),
    );
    const assignmentIds = new Map(
      assignments.map((assignment, index) => [assignment.id, copies[index].id]),
    );
    const questions = await manager.find(AssignmentQuestion, {
      where: { assignment_id: In([...assignmentIds.keys()]) },
    });
    await manager.save(
      questions.map((question) =>
        manager.create(AssignmentQuestion, {
          assignment_id: assignmentIds.get(question.assignment_id),
          question_text: question.question_text,
          type: question.type,
          options: question.options,
          correct_answer: question.correct_answer,
          score_weight: question.score_weight,
          created_at: question.created_at,
          created_by: userId,
        }),
      ),
    );
  }

  private async copyCertificateSettings(
    manager: EntityManager,
    sourceId: string,
    copyId: string,
  ): Promise<void> {
    const settings = await manager.findOne(ClassCertificateSettings, {
      where: { class_id: sourceId },
    });
    if (!settings) return;
    await manager.save(
      manager.create(ClassCertificateSettings, {
        class_id: copyId,
        auto_issue: settings.auto_issue,
        min_attendance_percent: settings.min_attendance_percent,
        min_score: settings.min_score,
      }),
    );
  }

  private async copyFaq(
    manager: EntityManager,
    sourceId: string,
    copyId: string,
    userId: string,
  ): Promise<void> {
    const entries = await manager.find(ClassFaq, {
      where: { class_id: sourceId },
    });
    await manager.save(
      entries.map((entry) =>
        manager.create(ClassFaq, {
          class_id: copyId,
          question: entry.question,
          answer: entry.answer,
          created_at: entry.created_at,
          created_by: userId,
        }),
      ),
    );
  }
}

export function copyTitle(title: string): string {
  return (
    title.slice(0, MAX_TITLE_LENGTH - COPY_SUFFIX.length).trimEnd() +
    COPY_SUFFIX
  );
}
