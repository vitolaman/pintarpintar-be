import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import { ClassAccessService } from './class-access.service';
import {
  ClassFaqResponseDto,
  CreateClassFaqDto,
  MAX_CLASS_FAQS,
  UpdateClassFaqDto,
} from './dto/class-faq.dto';
import { ClassFaq } from './entities/class-faq.entity';

// Class FAQ is class content, so it follows the `materi` permissions.
@Injectable()
export class ClassFaqService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly classAccess: ClassAccessService,
  ) {}

  async findAll(userId: string, classId: string) {
    await this.classAccess.requireAction(userId, classId, 'materi', 'lihat');
    return {
      data: await loadClassFaqs(this.dataSource.manager, classId),
      responseMessage: 'Get class FAQ success',
    };
  }

  async create(userId: string, classId: string, input: CreateClassFaqDto) {
    const faq = await this.dataSource.transaction(async (manager) => {
      await this.classAccess.requireAction(
        userId,
        classId,
        'materi',
        'tambah',
        manager,
      );
      // The class row lock keeps concurrent adds within the limit.
      await manager.query(
        'SELECT id FROM classes WHERE id = $1 AND deleted_at IS NULL FOR UPDATE',
        [classId],
      );
      const count = await manager.count(ClassFaq, {
        where: { class_id: classId },
      });
      if (count >= MAX_CLASS_FAQS) {
        throw new BadRequestException(
          `A class can have at most ${MAX_CLASS_FAQS} FAQ entries`,
        );
      }
      return manager.save(
        manager.create(ClassFaq, {
          class_id: classId,
          question: input.question,
          answer: input.answer,
          created_by: userId,
        }),
      );
    });
    return { data: toFaq(faq), responseMessage: 'Create class FAQ success' };
  }

  async update(
    userId: string,
    classId: string,
    faqId: string,
    input: UpdateClassFaqDto,
  ) {
    const faq = await this.dataSource.transaction(async (manager) => {
      await this.classAccess.requireAction(
        userId,
        classId,
        'materi',
        'edit',
        manager,
      );
      const faq = await this.findFaq(manager, classId, faqId);
      if (input.question !== undefined) faq.question = input.question;
      if (input.answer !== undefined) faq.answer = input.answer;
      faq.updated_by = userId;
      return manager.save(faq);
    });
    return { data: toFaq(faq), responseMessage: 'Update class FAQ success' };
  }

  async remove(userId: string, classId: string, faqId: string) {
    await this.dataSource.transaction(async (manager) => {
      await this.classAccess.requireAction(
        userId,
        classId,
        'materi',
        'delete',
        manager,
      );
      const faq = await this.findFaq(manager, classId, faqId);
      await manager.update(
        ClassFaq,
        { id: faq.id },
        { deleted_at: new Date(), deleted_by: userId },
      );
    });
  }

  private async findFaq(
    manager: EntityManager,
    classId: string,
    faqId: string,
  ): Promise<ClassFaq> {
    const faq = await manager.findOne(ClassFaq, {
      where: { id: faqId, class_id: classId },
    });
    if (!faq) throw new NotFoundException('FAQ entry not found');
    return faq;
  }
}

// Entries in the order they were added; shared with the class pages.
export async function loadClassFaqs(
  runner: Pick<EntityManager, 'query'>,
  classId: string,
): Promise<ClassFaqResponseDto[]> {
  return runner.query(
    `SELECT id, question, answer FROM class_faqs
     WHERE class_id = $1 AND deleted_at IS NULL
     ORDER BY created_at, id`,
    [classId],
  );
}

function toFaq(faq: ClassFaq): ClassFaqResponseDto {
  return { id: faq.id, question: faq.question, answer: faq.answer };
}
