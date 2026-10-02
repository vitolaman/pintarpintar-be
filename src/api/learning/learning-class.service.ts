import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { LearnerAccessService } from '../../class/learner-access.service';
import { LearningProgressService } from '../../class/learning-progress.service';
import { ClassCertificateService } from '../../class/class-certificate.service';
import { loadClassFaqs } from '../../class/class-faq.service';
import {
  BOOTCAMP_MEETING_SQL,
  MEETING_MENTOR_JOIN_SQL,
  MEETING_MENTOR_SQL,
  MEETING_STATUS_SQL,
} from '../../class/meeting-sql';
import { resourceSizeBytes } from '../../class/resource-size';
import { classKindOf } from '../../common/catalog/item-kind';
import { assetUrl } from '../../common/storage/asset-url';
import {
  ObjectStorage,
  createObjectStorage,
} from '../../common/storage/object-storage';
import { signedDownloadUrl } from '../../common/storage/signed-download-url';
import { youtubeVideoId } from '../../common/util/youtube';
import {
  LearningClassResponseDto,
  LearningResourceDto,
} from './dto/learning-response.dto';

interface ResourceRow {
  id: string;
  chapter_id: string;
  name: string;
  type: string;
  size: string | null;
  description: string | null;
  url: string | null;
  created_at: Date;
  object_key: string | null;
  original_filename: string | null;
}

@Injectable()
export class LearningClassService {
  private readonly storage: ObjectStorage;

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly learnerAccess: LearnerAccessService,
    private readonly learningProgress: LearningProgressService,
    private readonly certificates: ClassCertificateService,
    configService: ConfigService,
  ) {
    this.storage = createObjectStorage(configService);
  }

  async findClass(userId: string, classId: string) {
    await this.learnerAccess.requireEnrollment(userId, classId);
    const manager = this.dataSource.manager;

    const [
      [header],
      mentors,
      chapters,
      videos,
      resources,
      meetings,
      progress,
      certificate,
      faqs,
    ] = await Promise.all([
      manager.query(
        `SELECT class.id, class.title, class.type, class.status, class.description,
                  class.post_purchase_instructions,
                  cover.object_key AS cover_object_key,
                  merchant.id AS merchant_id, merchant.store_name AS merchant_name,
                  profile.slug AS merchant_slug,
                  (SELECT count(DISTINCT enrollment.user_id)::integer FROM enrollments enrollment
                   WHERE enrollment.class_id = class.id AND enrollment.deleted_at IS NULL) AS students_count
           FROM classes class
           INNER JOIN merchants merchant ON merchant.id = class.merchant_id
           LEFT JOIN merchant_profiles profile
             ON profile.merchant_id = merchant.id AND profile.deleted_at IS NULL
           LEFT JOIN file_assets cover
             ON cover.id = class.cover_asset_id AND cover.deleted_at IS NULL
           WHERE class.id = $1`,
        [classId],
      ),
      manager.query(
        `SELECT mentor.id, tutor.name, avatar.object_key AS avatar_object_key
           FROM class_mentors link
           INNER JOIN mentors mentor ON mentor.id = link.mentor_id AND mentor.deleted_at IS NULL
           INNER JOIN users tutor ON tutor.id = mentor.user_id AND tutor.deleted_at IS NULL
           LEFT JOIN user_profiles profile ON profile.user_id = tutor.id AND profile.deleted_at IS NULL
           LEFT JOIN file_assets avatar ON avatar.id = profile.avatar_asset_id AND avatar.deleted_at IS NULL
           WHERE link.class_id = $1 AND link.deleted_at IS NULL
           ORDER BY link.created_at, link.id`,
        [classId],
      ),
      manager.query(
        `SELECT id, title, description, "order" FROM chapters
           WHERE class_id = $1 AND deleted_at IS NULL
           ORDER BY "order", created_at, id`,
        [classId],
      ),
      manager.query(
        `SELECT video.id, video.chapter_id, video.title, video.description, video.duration,
                  video.source, video."youtubeUrl" AS youtube_url, video."order", video.created_at,
                  video_file.object_key AS file_object_key, video_file.original_filename AS file_name,
                  EXISTS (SELECT 1 FROM video_completions completion
                          WHERE completion.video_id = video.id AND completion.user_id = $2
                            AND completion.deleted_at IS NULL) AS is_completed
           FROM videos video
           INNER JOIN chapters chapter ON chapter.id = video.chapter_id AND chapter.deleted_at IS NULL
           LEFT JOIN file_assets video_file
             ON video_file.id = video.asset_id AND video_file.deleted_at IS NULL
           WHERE chapter.class_id = $1 AND video.deleted_at IS NULL
           ORDER BY video."order", video.created_at, video.id`,
        [classId, userId],
      ),
      manager.query(
        `SELECT resource.id, resource.chapter_id, resource.name, resource.type, resource.size,
                  resource.description, resource.url, resource.created_at,
                  asset.object_key, asset.original_filename
           FROM file_resources resource
           INNER JOIN chapters chapter ON chapter.id = resource.chapter_id AND chapter.deleted_at IS NULL
           LEFT JOIN file_assets asset ON asset.id = resource.asset_id AND asset.deleted_at IS NULL
           WHERE chapter.class_id = $1 AND resource.deleted_at IS NULL
           ORDER BY resource."order", resource.created_at, resource.id`,
        [classId],
      ) as Promise<ResourceRow[]>,
      manager.query(
        `SELECT meeting.id, meeting.title, meeting.content, meeting."date"::text AS date,
                  to_char(meeting."time", 'HH24:MI') AS time, meeting."liveUrl" AS live_url,
                  ${MEETING_STATUS_SQL} AS status, meeting.duration_minutes,
                  ${MEETING_MENTOR_SQL} AS mentor,
                  my_attendance.status AS my_attendance_status
           FROM meetings meeting
           ${BOOTCAMP_MEETING_SQL}
           ${MEETING_MENTOR_JOIN_SQL}
           LEFT JOIN LATERAL (
             SELECT attendance.status FROM attendances attendance
             WHERE attendance.meeting_id = meeting.id AND attendance.user_id = $2
               AND attendance.deleted_at IS NULL
             ORDER BY attendance.created_at DESC, attendance.id DESC
             LIMIT 1
           ) my_attendance ON true
           WHERE meeting.class_id = $1 AND meeting.deleted_at IS NULL
           ORDER BY meeting."date" NULLS LAST, meeting."time" NULLS LAST, meeting.id`,
        [classId, userId],
      ),
      this.learningProgress.findProgress(manager, classId, userId),
      this.certificates.findLearnerView(manager, classId, userId),
      loadClassFaqs(manager, classId),
    ]);

    const files = await Promise.all(
      resources.map((resource) => this.toResource(resource)),
    );
    // File videos play through a short-lived signed link, like resources.
    const videoUrls = new Map<string, string>(
      await Promise.all(
        videos
          .filter((video) => video.source === 'file' && video.file_object_key)
          .map(
            async (video): Promise<[string, string]> => [
              video.id,
              await signedDownloadUrl(
                this.storage,
                video.file_object_key,
                video.file_name ?? video.title,
              ),
            ],
          ),
      ),
    );
    const data: LearningClassResponseDto = {
      id: header.id,
      title: header.title,
      type: classKindOf(header.type),
      status: header.status,
      description: header.description,
      post_purchase_instructions: header.post_purchase_instructions,
      cover_url: assetUrl(header.cover_object_key),
      merchant: {
        id: header.merchant_id,
        name: header.merchant_name,
        slug: header.merchant_slug,
      },
      students_count: header.students_count,
      mentors: mentors.map((mentor) => ({
        id: mentor.id,
        name: mentor.name,
        avatar_url: assetUrl(mentor.avatar_object_key),
      })),
      chapters: chapters.map((chapter) => ({
        id: chapter.id,
        title: chapter.title,
        description: chapter.description,
        order: chapter.order,
        videos: videos
          .filter((video) => video.chapter_id === chapter.id)
          .map((video) => ({
            id: video.id,
            title: video.title,
            description: video.description,
            duration: video.duration,
            source: video.source,
            youtube_url: video.youtube_url,
            youtube_id: youtubeVideoId(video.youtube_url),
            video_url: videoUrls.get(video.id) ?? null,
            order: video.order,
            is_completed: video.is_completed,
            created_at: video.created_at,
          })),
        files: files.filter((file) => file.chapter_id === chapter.id),
      })),
      meetings,
      faqs,
      progress: progress.progress,
      next_video: progress.next_video,
      certificate,
    };
    return { data, responseMessage: 'Get learning class success' };
  }

  // Uploaded files get a short-lived link; links and older URL-only rows keep
  // their stored URL.
  private async toResource(row: ResourceRow): Promise<LearningResourceDto> {
    return {
      id: row.id,
      chapter_id: row.chapter_id,
      name: row.name,
      type: row.type,
      size: resourceSizeBytes(row.size),
      description: row.description,
      url: row.object_key ? null : row.url,
      download_url: row.object_key
        ? await signedDownloadUrl(
            this.storage,
            row.object_key,
            row.original_filename ?? row.name,
          )
        : null,
      created_at: row.created_at,
    };
  }
}
