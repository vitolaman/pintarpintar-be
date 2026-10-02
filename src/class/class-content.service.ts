import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager, EntityTarget, In, IsNull } from 'typeorm';
import {
  assertOwnedAsset,
  fileExtension,
  fileKindOf,
} from '../api/file-asset/asset-purpose-rules';
import {
  ObjectStorage,
  createObjectStorage,
} from '../common/storage/object-storage';
import { signedDownloadUrl } from '../common/storage/signed-download-url';
import { ClassAccessService } from './class-access.service';
import { LearningProgressService } from './learning-progress.service';
import {
  ChapterResponseDto,
  FileResourceResponseDto,
  VideoResponseDto,
} from './dto/class-response.dto';
import { CreateChapterDto } from './dto/create-chapter.dto';
import { ReorderChapterItemsDto } from './dto/reorder-chapter-items.dto';
import { AddResourcesDto, UpdateResourceDto } from './dto/resource.dto';
import { UpdateChapterDto } from './dto/update-chapter.dto';
import { CreateVideoDto, UpdateVideoDto } from './dto/video.dto';
import { ReorderChaptersDto } from './dto/reorder-chapters.dto';
import { FileAsset } from '../api/profile/entities/file-asset.entity';
import { Chapter } from './entities/chapter.entity';
import { FileResource, ResourceType } from './entities/file-resource.entity';
import { Video, VideoSource } from './entities/video.entity';
import { paginationMeta } from '../common/dto/response-meta.dto';

type ChildEntity = typeof Video | typeof FileResource;

// Chapters, videos, and resources of a class. Every operation checks the
// caller's `materi` permission and that the chapter belongs to the class in
// the path; writes lock the class or chapter row so appended positions and
// reorders do not collide.
@Injectable()
export class ClassContentService {
  private readonly storage: ObjectStorage;

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly classAccess: ClassAccessService,
    private readonly learningProgress: LearningProgressService,
    configService: ConfigService,
  ) {
    this.storage = createObjectStorage(configService);
  }

  async createChapter(userId: string, classId: string, dto: CreateChapterDto) {
    return this.dataSource.transaction(async (manager) => {
      await this.classAccess.requireAction(
        userId,
        classId,
        'materi',
        'tambah',
        manager,
      );
      await manager.query('SELECT id FROM classes WHERE id = $1 FOR UPDATE', [
        classId,
      ]);
      const order =
        dto.order ??
        (await this.nextPosition(manager, Chapter, { class_id: classId }));
      const chapter = await manager.save(
        Chapter,
        manager.create(Chapter, {
          class_id: classId,
          title: dto.title,
          description: dto.description,
          order,
          created_by: userId,
        }),
      );
      const [data] = await this.toChapterResponses(manager, [chapter]);
      return { data, responseMessage: 'Create chapter success' };
    });
  }

  // Without a limit every chapter is returned as one page, because the bab
  // reorder needs the complete list of ids.
  async getChapters(userId: string, classId: string, page = 1, limit?: number) {
    await this.classAccess.requireAction(userId, classId, 'materi', 'lihat');
    const manager = this.dataSource.manager;
    const paginated = limit !== undefined;
    const [chapters, total] = await manager.findAndCount(Chapter, {
      where: { class_id: classId },
      order: { order: 'ASC', created_at: 'ASC', id: 'ASC' },
      ...(paginated ? { skip: (page - 1) * limit, take: limit } : {}),
    });
    return {
      data: await this.toChapterResponses(manager, chapters),
      meta: paginated
        ? paginationMeta(page, limit, total)
        : paginationMeta(1, Math.max(total, 1), total),
      responseMessage: 'Get class chapters success',
    };
  }

  async updateChapter(
    userId: string,
    classId: string,
    chapterId: string,
    dto: UpdateChapterDto,
  ) {
    return this.dataSource.transaction(async (manager) => {
      await this.classAccess.requireAction(
        userId,
        classId,
        'materi',
        'edit',
        manager,
      );
      const chapter = await this.lockChapter(manager, classId, chapterId);
      if (dto.title !== undefined) chapter.title = dto.title;
      if (dto.description !== undefined) chapter.description = dto.description;
      chapter.updated_by = userId;
      const saved = await manager.save(chapter);
      const [data] = await this.toChapterResponses(manager, [saved]);
      return { data, responseMessage: 'Update chapter success' };
    });
  }

  async deleteChapter(userId: string, classId: string, chapterId: string) {
    await this.dataSource.transaction(async (manager) => {
      await this.classAccess.requireAction(
        userId,
        classId,
        'materi',
        'delete',
        manager,
      );
      await this.lockChapter(manager, classId, chapterId);
      const deletion = { deleted_at: new Date(), deleted_by: userId };
      const liveChildren = { chapter_id: chapterId, deleted_at: IsNull() };
      await manager.update(Video, liveChildren, deletion);
      await manager.update(FileResource, liveChildren, deletion);
      await manager.update(Chapter, { id: chapterId }, deletion);
      await this.learningProgress.recomputeClass(manager, classId);
    });
  }

  async createVideo(
    userId: string,
    classId: string,
    chapterId: string,
    dto: CreateVideoDto,
  ) {
    return this.dataSource.transaction(async (manager) => {
      await this.classAccess.requireAction(
        userId,
        classId,
        'materi',
        'tambah',
        manager,
      );
      await this.lockChapter(manager, classId, chapterId);
      const source = await resolveVideoSource(
        manager,
        userId,
        classId,
        null,
        dto,
      );
      const video = await manager.save(
        Video,
        manager.create(Video, {
          chapter_id: chapterId,
          title: dto.title,
          description: dto.description,
          ...source,
          duration: dto.duration,
          order: await this.nextPosition(manager, Video, {
            chapter_id: chapterId,
          }),
          created_by: userId,
        }),
      );
      await this.learningProgress.recomputeClass(manager, classId);
      return {
        data: toVideoResponse(video),
        responseMessage: 'Create video success',
      };
    });
  }

  async updateVideo(
    userId: string,
    classId: string,
    chapterId: string,
    videoId: string,
    dto: UpdateVideoDto,
  ) {
    return this.dataSource.transaction(async (manager) => {
      await this.classAccess.requireAction(
        userId,
        classId,
        'materi',
        'edit',
        manager,
      );
      await this.lockChapter(manager, classId, chapterId);
      const video = await this.findChild<Video>(
        manager,
        Video,
        chapterId,
        videoId,
      );
      if (dto.title !== undefined) video.title = dto.title;
      if (dto.description !== undefined) video.description = dto.description;
      if (
        dto.source !== undefined ||
        dto.youtubeUrl !== undefined ||
        dto.asset_id !== undefined
      ) {
        Object.assign(
          video,
          await resolveVideoSource(manager, userId, classId, video, dto),
        );
      }
      if (dto.duration !== undefined) video.duration = dto.duration;
      video.updated_by = userId;
      const saved = await manager.save(video);
      return {
        data: toVideoResponse(saved),
        responseMessage: 'Update video success',
      };
    });
  }

  async deleteVideo(
    userId: string,
    classId: string,
    chapterId: string,
    videoId: string,
  ) {
    await this.deleteChild(userId, classId, chapterId, Video, videoId);
  }

  async addResources(
    userId: string,
    classId: string,
    chapterId: string,
    dto: AddResourcesDto,
  ) {
    return this.dataSource.transaction(async (manager) => {
      await this.classAccess.requireAction(
        userId,
        classId,
        'materi',
        'tambah',
        manager,
      );
      await this.lockChapter(manager, classId, chapterId);
      let order = await this.nextPosition(manager, FileResource, {
        chapter_id: chapterId,
      });

      const created: FileResource[] = [];
      for (const input of dto.resources) {
        const isLink = input.asset_id === undefined;
        if (isLink && input.url === undefined) {
          throw new BadRequestException(
            `Material "${input.name}" needs an uploaded file (asset_id) or a link (url)`,
          );
        }
        if (!isLink && input.url !== undefined) {
          throw new BadRequestException(
            `Material "${input.name}" takes either asset_id or url, not both`,
          );
        }
        const asset = isLink
          ? null
          : await assertOwnedAsset(
              manager,
              userId,
              input.asset_id,
              'class_resource',
              { classId },
            );
        created.push(
          manager.create(FileResource, {
            chapter_id: chapterId,
            type: asset ? materialTypeOf(asset) : ResourceType.LINK,
            name: input.name,
            description: input.description ?? null,
            url: isLink ? input.url : null,
            asset_id: asset?.id ?? null,
            size: asset ? asset.sizeBytes : null,
            order: order++,
            created_by: userId,
          }),
        );
      }
      const saved = await manager.save(FileResource, created);
      return {
        data: await this.toResourceResponses(manager, saved),
        responseMessage: 'Add resources success',
      };
    });
  }

  async updateResource(
    userId: string,
    classId: string,
    chapterId: string,
    resourceId: string,
    dto: UpdateResourceDto,
  ) {
    return this.dataSource.transaction(async (manager) => {
      await this.classAccess.requireAction(
        userId,
        classId,
        'materi',
        'edit',
        manager,
      );
      await this.lockChapter(manager, classId, chapterId);
      const resource = await this.findChild<FileResource>(
        manager,
        FileResource,
        chapterId,
        resourceId,
      );
      if (dto.url !== undefined && resource.type !== ResourceType.LINK) {
        throw new BadRequestException(
          'Only link resources have a URL; replace a file by adding a new resource',
        );
      }
      if (dto.name !== undefined) resource.name = dto.name;
      if (dto.description !== undefined) resource.description = dto.description;
      if (dto.url !== undefined) resource.url = dto.url;
      resource.updated_by = userId;
      const saved = await manager.save(resource);
      const [data] = await this.toResourceResponses(manager, [saved]);
      return { data, responseMessage: 'Update resource success' };
    });
  }

  async deleteResource(
    userId: string,
    classId: string,
    chapterId: string,
    resourceId: string,
  ) {
    await this.deleteChild(
      userId,
      classId,
      chapterId,
      FileResource,
      resourceId,
    );
  }

  async reorderChapters(
    userId: string,
    classId: string,
    dto: ReorderChaptersDto,
  ) {
    return this.dataSource.transaction(async (manager) => {
      await this.classAccess.requireAction(
        userId,
        classId,
        'materi',
        'edit',
        manager,
      );
      await manager.query('SELECT id FROM classes WHERE id = $1 FOR UPDATE', [
        classId,
      ]);
      const chapters = await manager.find(Chapter, {
        where: { class_id: classId },
      });
      const byId = new Map(chapters.map((chapter) => [chapter.id, chapter]));
      const complete =
        dto.chapter_ids.length === byId.size &&
        dto.chapter_ids.every((id) => byId.has(id));
      if (!complete) {
        throw new BadRequestException(
          'chapter_ids must list every chapter of the class exactly once',
        );
      }

      const ordered = dto.chapter_ids.map((id) => byId.get(id));
      for (const [position, chapter] of ordered.entries()) {
        chapter.order = position;
        chapter.updated_by = userId;
        await manager.update(
          Chapter,
          { id: chapter.id },
          { order: position, updated_by: userId },
        );
      }
      return {
        data: await this.toChapterResponses(manager, ordered),
        responseMessage: 'Reorder chapters success',
      };
    });
  }

  async reorderChapterItems(
    userId: string,
    classId: string,
    chapterId: string,
    dto: ReorderChapterItemsDto,
  ) {
    return this.dataSource.transaction(async (manager) => {
      await this.classAccess.requireAction(
        userId,
        classId,
        'materi',
        'edit',
        manager,
      );
      const chapter = await this.lockChapter(manager, classId, chapterId);
      await this.applyOrder(manager, 'videos', chapterId, dto.video_ids);
      await this.applyOrder(
        manager,
        'file_resources',
        chapterId,
        dto.resource_ids,
      );
      const [data] = await this.toChapterResponses(manager, [chapter]);
      return { data, responseMessage: 'Reorder chapter success' };
    });
  }

  private async applyOrder(
    manager: EntityManager,
    table: 'videos' | 'file_resources',
    chapterId: string,
    orderedIds: string[],
  ) {
    const current: { id: string }[] = await manager.query(
      `SELECT id FROM ${table} WHERE chapter_id = $1 AND deleted_at IS NULL`,
      [chapterId],
    );
    const currentIds = new Set(current.map((row) => row.id));
    const complete =
      orderedIds.length === currentIds.size &&
      orderedIds.every((id) => currentIds.has(id));
    if (!complete) {
      const field = table === 'videos' ? 'video_ids' : 'resource_ids';
      throw new BadRequestException(
        `${field} must list every item of the chapter exactly once`,
      );
    }
    await manager.query(
      `UPDATE ${table} item SET "order" = position.ordinality - 1
       FROM unnest($1::uuid[]) WITH ORDINALITY AS position(id, ordinality)
       WHERE item.id = position.id`,
      [orderedIds],
    );
  }

  private async deleteChild(
    userId: string,
    classId: string,
    chapterId: string,
    entity: ChildEntity,
    id: string,
  ) {
    await this.dataSource.transaction(async (manager) => {
      await this.classAccess.requireAction(
        userId,
        classId,
        'materi',
        'delete',
        manager,
      );
      await this.lockChapter(manager, classId, chapterId);
      await this.findChild(manager, entity, chapterId, id);
      await manager.update(
        entity,
        { id },
        { deleted_at: new Date(), deleted_by: userId },
      );
      if (entity === Video) {
        await this.learningProgress.recomputeClass(manager, classId);
      }
    });
  }

  private async lockChapter(
    manager: EntityManager,
    classId: string,
    chapterId: string,
  ): Promise<Chapter> {
    const chapter = await manager.findOne(Chapter, {
      where: { id: chapterId, class_id: classId },
      lock: { mode: 'pessimistic_write' },
    });
    if (!chapter) throw new NotFoundException('Chapter not found');
    return chapter;
  }

  private async findChild<T extends Video | FileResource>(
    manager: EntityManager,
    entity: EntityTarget<T>,
    chapterId: string,
    id: string,
  ): Promise<T> {
    const item = await manager.findOne(entity, {
      where: { id, chapter_id: chapterId } as never,
    });
    if (!item) {
      throw new NotFoundException(
        entity === Video ? 'Video not found' : 'Resource not found',
      );
    }
    return item;
  }

  private async nextPosition(
    manager: EntityManager,
    entity: typeof Chapter | ChildEntity,
    parent: Record<string, string>,
  ): Promise<number> {
    const { max } = await manager
      .createQueryBuilder(entity, 'item')
      .select('MAX(item."order")', 'max')
      .where(parent)
      .getRawOne();
    return max === null ? 0 : Number(max) + 1;
  }

  private async toChapterResponses(
    manager: EntityManager,
    chapters: Chapter[],
  ): Promise<ChapterResponseDto[]> {
    if (chapters.length === 0) return [];
    const chapterIds = chapters.map((chapter) => chapter.id);
    const order = { order: 'ASC', created_at: 'ASC', id: 'ASC' } as const;
    const [videos, resources] = await Promise.all([
      manager.find(Video, { where: { chapter_id: In(chapterIds) }, order }),
      manager.find(FileResource, {
        where: { chapter_id: In(chapterIds) },
        order,
      }),
    ]);
    const files = await this.toResourceResponses(manager, resources);

    return chapters.map((chapter) => ({
      id: chapter.id,
      class_id: chapter.class_id,
      title: chapter.title,
      description: chapter.description,
      order: chapter.order,
      videos: videos
        .filter((video) => video.chapter_id === chapter.id)
        .map(toVideoResponse),
      files: files.filter((file) => file.chapter_id === chapter.id),
      created_at: chapter.created_at,
      updated_at: chapter.updated_at,
    }));
  }

  // Uploaded files are private; managers get a download link that expires.
  private async toResourceResponses(
    manager: EntityManager,
    resources: FileResource[],
  ): Promise<FileResourceResponseDto[]> {
    const assetIds = resources
      .map((resource) => resource.asset_id)
      .filter((id): id is string => Boolean(id));
    const assets: {
      id: string;
      object_key: string;
      original_filename: string;
    }[] =
      assetIds.length === 0
        ? []
        : await manager.query(
            `SELECT id, object_key, original_filename FROM file_assets
             WHERE id = ANY($1::uuid[]) AND deleted_at IS NULL`,
            [assetIds],
          );
    const assetsById = new Map(assets.map((asset) => [asset.id, asset]));

    return Promise.all(
      resources.map(async (resource) => {
        const asset = resource.asset_id
          ? assetsById.get(resource.asset_id)
          : undefined;
        return {
          id: resource.id,
          chapter_id: resource.chapter_id,
          name: resource.name,
          type: resource.type,
          description: resource.description,
          url: resource.url,
          asset_id: resource.asset_id,
          size: resource.size,
          download_url: asset
            ? await signedDownloadUrl(
                this.storage,
                asset.object_key,
                asset.original_filename,
              )
            : null,
          order: resource.order,
          created_at: resource.created_at,
          updated_at: resource.updated_at,
        };
      }),
    );
  }
}

function toVideoResponse(video: Video): VideoResponseDto {
  return {
    id: video.id,
    chapter_id: video.chapter_id,
    title: video.title,
    description: video.description,
    source: video.source,
    youtubeUrl: video.youtubeUrl,
    asset_id: video.asset_id,
    duration: video.duration,
    order: video.order,
    created_at: video.created_at,
    updated_at: video.updated_at,
  };
}

type VideoSourceInput = Pick<
  CreateVideoDto,
  'source' | 'youtubeUrl' | 'asset_id'
>;

/**
 * The video's source fields after a create or update: a link video has
 * youtubeUrl and no asset, a file video has an owned class_video upload
 * (within the class merchant's per-file limit) and no URL. Fields not sent
 * keep the current video's values for the same source.
 */
// A material's type follows its file, whatever type the client sent.
function materialTypeOf(asset: FileAsset): ResourceType {
  const kind = fileKindOf({
    filename: asset.originalFilename,
    mimeType: asset.mimeType,
  });
  if (kind === 'archive') return ResourceType.ARCHIVE;
  if (kind === 'image') return ResourceType.IMAGE;
  if (fileExtension(asset.originalFilename) === 'pdf') return ResourceType.PDF;
  return ResourceType.FILE;
}

// Without an explicit source, the field sent decides: an upload makes a file
// video and a link makes a link video; otherwise the video keeps its source.
function inferredVideoSource(
  input: VideoSourceInput,
  current: Video | null,
): VideoSource {
  const sentFile = input.asset_id !== undefined;
  const sentLink = input.youtubeUrl !== undefined;
  if (sentFile && sentLink) {
    throw new BadRequestException(
      'Send either youtubeUrl or asset_id, not both',
    );
  }
  if (sentFile) return 'file';
  if (sentLink) return 'link';
  return current?.source ?? 'link';
}

async function resolveVideoSource(
  manager: EntityManager,
  userId: string,
  classId: string,
  current: Video | null,
  input: VideoSourceInput,
): Promise<Pick<Video, 'source' | 'youtubeUrl' | 'asset_id'>> {
  const source = input.source ?? inferredVideoSource(input, current);
  if (source === 'link') {
    if (input.asset_id !== undefined) {
      throw new BadRequestException(
        'A link video takes youtubeUrl, not asset_id',
      );
    }
    const youtubeUrl =
      input.youtubeUrl ??
      (current?.source === 'link' ? current.youtubeUrl : undefined);
    if (!youtubeUrl) {
      throw new BadRequestException('A link video needs youtubeUrl');
    }
    return { source, youtubeUrl, asset_id: null };
  }

  if (input.youtubeUrl !== undefined) {
    throw new BadRequestException(
      'A file video takes asset_id, not youtubeUrl',
    );
  }
  const assetId =
    input.asset_id ?? (current?.source === 'file' ? current.asset_id : null);
  if (!assetId) throw new BadRequestException('A file video needs asset_id');
  if (input.asset_id !== undefined) {
    await assertOwnedAsset(manager, userId, assetId, 'class_video', {
      classId,
    });
  }
  return { source, youtubeUrl: null, asset_id: assetId };
}
