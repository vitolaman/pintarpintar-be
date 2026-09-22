import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Class } from './entities/class.entity';
import { Chapter } from './entities/chapter.entity';
import { FileResource } from './entities/file-resource.entity';
import { Video } from './entities/video.entity';
import { Meeting } from './entities/meeting.entity';
import { Assignment } from './entities/assignment.entity';
import { AssignmentQuestion } from './entities/assignment-question.entity';
import { ClassMentor } from './entities/class-mentor.entity';
import { Enrollment } from './entities/enrollment.entity';

import { CreateClassDto } from './dto/create-class.dto';
import { CreateChapterDto } from './dto/create-chapter.dto';
import { CreateMeetingDto } from './dto/create-meeting.dto';
import { CreateAssignmentDto } from './dto/create-assignment.dto';
import { InviteMentorDto } from './dto/invite-mentor.dto';

@Injectable()
export class ClassService {
  constructor(
    @InjectRepository(Class) private readonly classRepo: Repository<Class>,
    @InjectRepository(Chapter) private readonly chapterRepo: Repository<Chapter>,
    @InjectRepository(FileResource) private readonly fileResourceRepo: Repository<FileResource>,
    @InjectRepository(Video) private readonly videoRepo: Repository<Video>,
    @InjectRepository(Meeting) private readonly meetingRepo: Repository<Meeting>,
    @InjectRepository(Assignment) private readonly assignmentRepo: Repository<Assignment>,
    @InjectRepository(AssignmentQuestion) private readonly assignmentQuestionRepo: Repository<AssignmentQuestion>,
    @InjectRepository(ClassMentor) private readonly classMentorRepo: Repository<ClassMentor>,
    @InjectRepository(Enrollment) private readonly enrollmentRepo: Repository<Enrollment>,
  ) {}

  async createClass(merchantId: string, dto: CreateClassDto) {
    const newClass = this.classRepo.create({
      ...dto,
      merchant_id: merchantId,
    });
    return this.classRepo.save(newClass);
  }

  async getClassesByMerchant(merchantId: string, page: any = 1, limit: any = 10, status?: string) {
    const pageNum = Number(page) || 1;
    const limitNum = Number(limit) || 10;
    const query = this.classRepo.createQueryBuilder('class')
      .where('class.merchant_id = :merchantId', { merchantId });

    if (status) {
      query.andWhere('class.status = :status', { status });
    }
    console.log('test');
    const [data, total] = await query
      .skip((pageNum - 1) * limitNum)
      .take(limitNum)
      .getManyAndCount();
    console.log(data)
    return {
      data,
      meta: { total, page: pageNum, limit: limitNum },
    };
  }

  async getClassById(classId: string) {
    const cls = await this.classRepo.findOne({ where: { id: classId } });
    if (!cls) throw new NotFoundException('Class not found');
    return cls;
  }

  async createChapter(classId: string, dto: CreateChapterDto) {
    const chapter = this.chapterRepo.create({ ...dto, class_id: classId });
    return this.chapterRepo.save(chapter);
  }

  async getClassChapters(classId: string, page = 1, limit = 10) {
    const [data, total] = await this.chapterRepo.findAndCount({
      where: { class_id: classId },
      relations: ['videos', 'resources'],
      order: { order: 'ASC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    // Transform resources to files for the response
    const transformedData = data.map((chapter) => ({
      ...chapter,
      files: chapter.resources || [],
      resources: undefined, // Remove the original resources field
    }));

    return { data: transformedData, meta: { total, page, limit } };
  }

  async addResources(chapterId: string, resourcesData: { type: string; name: string; url: string }[]) {
    const resources = resourcesData.map((res) => {
      return this.fileResourceRepo.create({
        chapter_id: chapterId,
        type: res.type as any,
        name: res.name,
        url: res.url,
      });
    });

    await this.fileResourceRepo.save(resources);
    return resources;
  }

  async createMeeting(classId: string, dto: CreateMeetingDto) {
    const meeting = this.meetingRepo.create({ ...dto, class_id: classId });
    return this.meetingRepo.save(meeting);
  }

  async getClassMeetings(classId: string, page = 1, limit = 10) {
    const [data, total] = await this.meetingRepo.findAndCount({ 
      where: { class_id: classId },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { data, meta: { total, page, limit } };
  }

  async createAssignment(classId: string, dto: CreateAssignmentDto) {
    const { questions, ...assignmentData } = dto;
    const assignment = this.assignmentRepo.create({
      ...assignmentData,
      class_id: classId,
      due: new Date(dto.due),
    });

    const savedAssignment = await this.assignmentRepo.save(assignment);

    if (questions && questions.length > 0) {
      const qs = questions.map((q) =>
        this.assignmentQuestionRepo.create({
          ...q,
          assignment_id: savedAssignment.id,
        }),
      );
      await this.assignmentQuestionRepo.save(qs);
    }

    return savedAssignment;
  }

  async getClassAssignments(classId: string, page = 1, limit = 10) {
    const [data, total] = await this.assignmentRepo.findAndCount({
      where: { class_id: classId },
      relations: ['questions'],
      skip: (page - 1) * limit,
      take: limit,
    });
    return { data, meta: { total, page, limit } };
  }

  async inviteMentor(classId: string, dto: InviteMentorDto) {
    // We ideally look up mentor_id by email here.
    // Stub mentor_id to 'some-mentor-id' for now.
    const mentor_id = 'some-mentor-id'; 
    const mentor = this.classMentorRepo.create({
      ...dto,
      class_id: classId,
      mentor_id,
    });
    return this.classMentorRepo.save(mentor);
  }

  async getClassMentors(classId: string, page = 1, limit = 10) {
    const [data, total] = await this.classMentorRepo.findAndCount({
      where: { class_id: classId },
      relations: ['mentor'],
      skip: (page - 1) * limit,
      take: limit,
    });
    return { data, meta: { total, page, limit } };
  }

  async getClassStudents(classId: string, page = 1, limit = 10) {
    const [data, total] = await this.enrollmentRepo.findAndCount({
      where: { class_id: classId },
      relations: ['user'],
      skip: (page - 1) * limit,
      take: limit,
    });
    return { data, meta: { total, page, limit } };
  }
}
