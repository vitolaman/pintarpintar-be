import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  ArrayResponse,
  DefaultResponse,
  EmptyResponse,
} from '../common/decorator/response.decorator';
import { ClassDuplicationService } from './class-duplication.service';
import { ClassFaqService } from './class-faq.service';
import {
  ClassFaqResponseDto,
  CreateClassFaqDto,
  DuplicateClassDto,
  UpdateClassFaqDto,
} from './dto/class-faq.dto';
import { ClassResponseDto } from './dto/class-response.dto';
import { classTypeOf } from '../common/catalog/item-kind';
import {
  CLASS_NOT_FOUND,
  OWNER_ONLY,
  notFound,
  tutorLacks,
} from './class-route-errors';

const FAQ_NOT_FOUND = notFound('FAQ entry not found');

type AuthenticatedRequest = { user: { id: string } };

// Class FAQ ("Kelola FAQ") and "Duplikat Kelas".
@ApiTags('Classes')
@ApiBearerAuth()
@Controller('api/v1/classes')
export class ClassFaqController {
  constructor(
    private readonly classFaqService: ClassFaqService,
    private readonly classDuplicationService: ClassDuplicationService,
  ) {}

  @Get(':classId/faqs')
  @ArrayResponse(ClassFaqResponseDto, 'Get class FAQ success', [
    tutorLacks('materi', 'lihat'),
    CLASS_NOT_FOUND,
  ])
  findFaqs(
    @Req() req: AuthenticatedRequest,
    @Param('classId', ParseUUIDPipe) classId: string,
  ) {
    return this.classFaqService.findAll(req.user.id, classId);
  }

  @Post(':classId/faqs')
  @DefaultResponse(
    ClassFaqResponseDto,
    'Create class FAQ success',
    HttpStatus.CREATED,
    [tutorLacks('materi', 'tambah'), CLASS_NOT_FOUND],
  )
  createFaq(
    @Req() req: AuthenticatedRequest,
    @Param('classId', ParseUUIDPipe) classId: string,
    @Body() input: CreateClassFaqDto,
  ) {
    return this.classFaqService.create(req.user.id, classId, input);
  }

  @Patch(':classId/faqs/:faqId')
  @DefaultResponse(
    ClassFaqResponseDto,
    'Update class FAQ success',
    HttpStatus.OK,
    [tutorLacks('materi', 'edit'), CLASS_NOT_FOUND, FAQ_NOT_FOUND],
  )
  updateFaq(
    @Req() req: AuthenticatedRequest,
    @Param('classId', ParseUUIDPipe) classId: string,
    @Param('faqId', ParseUUIDPipe) faqId: string,
    @Body() input: UpdateClassFaqDto,
  ) {
    return this.classFaqService.update(req.user.id, classId, faqId, input);
  }

  @Delete(':classId/faqs/:faqId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @EmptyResponse([
    tutorLacks('materi', 'delete'),
    CLASS_NOT_FOUND,
    FAQ_NOT_FOUND,
  ])
  deleteFaq(
    @Req() req: AuthenticatedRequest,
    @Param('classId', ParseUUIDPipe) classId: string,
    @Param('faqId', ParseUUIDPipe) faqId: string,
  ) {
    return this.classFaqService.remove(req.user.id, classId, faqId);
  }

  @Post(':classId/duplicate')
  @DefaultResponse(
    ClassResponseDto,
    'Duplicate class success',
    HttpStatus.CREATED,
    [OWNER_ONLY, CLASS_NOT_FOUND],
  )
  duplicate(
    @Req() req: AuthenticatedRequest,
    @Param('classId', ParseUUIDPipe) classId: string,
    @Body() input: DuplicateClassDto,
  ) {
    return this.classDuplicationService.duplicate(
      req.user.id,
      classId,
      classTypeOf(input.type),
    );
  }
}
