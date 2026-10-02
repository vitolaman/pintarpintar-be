import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { MEETING_END_SQL } from '../../class/meeting-sql';
import { assetUrl } from '../../common/storage/asset-url';
import { classKindSql } from '../../common/catalog/item-kind';
import {
  PortalItemQueryDto,
  PortalItemType,
} from './dto/portal-item-query.dto';
import {
  MeetingPlatform,
  PortalItemResponseDto,
} from './dto/portal-item-response.dto';
import { paginationMeta } from '~/common/dto/response-meta.dto';

// Owned classes (Vito's enrollments) and owned digital products (access grants)
// share one projection so both can be ordered and paginated together.
const OWNED_ITEMS_SQL = `
  SELECT
    class.id AS item_id,
    ${classKindSql('class.type')} AS item_type,
    class.title,
    class_cover.object_key AS image,
    COALESCE(enrollment."joinDate"::timestamp, enrollment.created_at) AS acquired_at,
    class.merchant_id,
    enrollment.progress AS raw_progress
  FROM enrollments enrollment
  INNER JOIN classes class
    ON class.id = enrollment.class_id AND class.deleted_at IS NULL
  LEFT JOIN file_assets class_cover
    ON class_cover.id = class.cover_asset_id AND class_cover.deleted_at IS NULL
  WHERE enrollment.user_id = $1 AND enrollment.deleted_at IS NULL

  UNION ALL

  SELECT
    product.id,
    'digital',
    product.title,
    cover.object_key,
    access.granted_at,
    product.merchant_id,
    NULL
  FROM user_access access
  -- A deleted product stays in its buyers' library.
  INNER JOIN products product
    ON product.id = access.product_id
  LEFT JOIN file_assets cover
    ON cover.id = product.cover_asset_id AND cover.deleted_at IS NULL
  WHERE access.user_id = $1
    AND access.deleted_at IS NULL
    AND (access.expires_at IS NULL OR access.expires_at > now())
`;

const FILTER_SQL = `
  WHERE ($2 = 'all' OR owned.item_type = $2)
    AND ($3::text IS NULL OR owned.title ILIKE '%' || $3 || '%' ESCAPE '\\')
`;

interface PortalItemRow {
  item_id: string;
  item_type: PortalItemType;
  title: string;
  image: string | null;
  acquired_at: Date;
  merchant_id: string;
  raw_progress: string | null;
  merchant_name: string | null;
  merchant_slug: string | null;
  merchant_avatar_object_key: string | null;
  module_count: string | null;
  assignment_count: string | null;
  has_certificate: boolean | null;
  meeting_title: string | null;
  meeting_date: string | null;
  meeting_time: string | null;
  meeting_live_url: string | null;
}

const platformsByHost: [hostSuffix: string, platform: MeetingPlatform][] = [
  ['zoom.us', 'Zoom'],
  ['meet.google.com', 'Google Meet'],
  ['teams.microsoft.com', 'Microsoft Teams'],
];

@Injectable()
export class PortalService {
  constructor(private readonly dataSource: DataSource) {}

  async findItems(userId: string, query: PortalItemQueryDto) {
    const { type, page, limit } = query;
    const search = query.search ? escapeLikePattern(query.search) : null;
    const filterParams = [userId, type, search];

    const [countRow] = await this.dataSource.query(
      `SELECT count(*)::integer AS total
       FROM (${OWNED_ITEMS_SQL}) owned
       ${FILTER_SQL}`,
      filterParams,
    );
    const total: number = countRow.total;

    const rows: PortalItemRow[] =
      total === 0
        ? []
        : await this.dataSource.query(
            `WITH page AS (
               SELECT owned.*
               FROM (${OWNED_ITEMS_SQL}) owned
               ${FILTER_SQL}
               ORDER BY owned.acquired_at DESC, owned.item_id DESC
               LIMIT $4 OFFSET $5
             )
             SELECT
               page.*,
               merchant.store_name AS merchant_name,
               profile.slug AS merchant_slug,
               avatar.object_key AS merchant_avatar_object_key,
               CASE WHEN page.item_type = 'kelas' THEN (
                 SELECT count(*) FROM chapters chapter
                 WHERE chapter.class_id = page.item_id AND chapter.deleted_at IS NULL
               ) END AS module_count,
               CASE WHEN page.item_type = 'kelas' THEN (
                 SELECT count(*) FROM assignments assignment
                 WHERE assignment.class_id = page.item_id AND assignment.deleted_at IS NULL
               ) END AS assignment_count,
               CASE WHEN page.item_type <> 'digital' THEN EXISTS (
                 SELECT 1 FROM certificates certificate
                 WHERE certificate.class_id = page.item_id
                   AND certificate.user_id = $1
                   AND certificate.deleted_at IS NULL
               ) END AS has_certificate,
               next_meeting.title AS meeting_title,
               next_meeting.meeting_date,
               next_meeting.meeting_time,
               next_meeting.live_url AS meeting_live_url
             FROM page
             LEFT JOIN merchants merchant ON merchant.id = page.merchant_id
             LEFT JOIN merchant_profiles profile
               ON profile.merchant_id = merchant.id AND profile.deleted_at IS NULL
             LEFT JOIN file_assets avatar
               ON avatar.id = profile.avatar_asset_id AND avatar.deleted_at IS NULL
             LEFT JOIN LATERAL (
               SELECT
                 meeting.title,
                 meeting."date"::text AS meeting_date,
                 to_char(meeting."time", 'HH24:MI') AS meeting_time,
                 meeting."liveUrl" AS live_url
               FROM meetings meeting
               WHERE page.item_type = 'bootcamp'
                 AND meeting.class_id = page.item_id
                 AND meeting.deleted_at IS NULL
                 AND meeting."date" IS NOT NULL
                 AND CASE
                   WHEN meeting."time" IS NULL
                     THEN meeting."date" >= (now() AT TIME ZONE 'Asia/Jakarta')::date
                   ELSE ${MEETING_END_SQL} >= now()
                 END
               ORDER BY meeting."date", meeting."time" NULLS LAST
               LIMIT 1
             ) next_meeting ON true
             ORDER BY page.acquired_at DESC, page.item_id DESC`,
            [...filterParams, limit, (page - 1) * limit],
          );

    return {
      data: rows.map((row) => this.toItem(row)),
      meta: paginationMeta(page, limit, total),
      responseMessage: 'Get portal items success',
    };
  }

  private toItem(row: PortalItemRow): PortalItemResponseDto {
    const isVideoClass = row.item_type === 'kelas';

    return {
      id: row.item_id,
      type: row.item_type,
      title: row.title,
      image_url: assetUrl(row.image),
      acquired_at: row.acquired_at,
      merchant_id: row.merchant_id,
      merchant_name: row.merchant_name,
      merchant_slug: row.merchant_slug,
      merchant_avatar_url: assetUrl(row.merchant_avatar_object_key),
      progress: isVideoClass ? parseProgress(row.raw_progress) : null,
      module_count: row.module_count === null ? null : Number(row.module_count),
      assignment_count:
        row.assignment_count === null ? null : Number(row.assignment_count),
      has_certificate: row.has_certificate,
      next_meeting: row.meeting_date
        ? {
            title: row.meeting_title,
            date: row.meeting_date,
            time: row.meeting_time,
            live_url: row.meeting_live_url,
            platform: meetingPlatformFor(row.meeting_live_url),
          }
        : null,
    };
  }
}

// Enrollment progress is free text in the class model; accept its leading
// number (e.g. "70", "70%", "70.5") and clamp it to a percentage.
export function parseProgress(rawProgress: string | null): number {
  const leadingNumber = rawProgress?.trim().match(/^\d+(\.\d+)?/);

  if (!leadingNumber) {
    return 0;
  }

  return Math.min(100, Math.round(Number(leadingNumber[0])));
}

export function meetingPlatformFor(
  liveUrl: string | null,
): MeetingPlatform | null {
  if (!liveUrl) {
    return null;
  }

  let host: string;
  try {
    host = new URL(liveUrl).hostname.toLowerCase();
  } catch {
    return null;
  }

  const match = platformsByHost.find(
    ([hostSuffix]) => host === hostSuffix || host.endsWith(`.${hostSuffix}`),
  );

  return match ? match[1] : null;
}

function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, (character) => `\\${character}`);
}
