import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, QueryFailedError } from 'typeorm';
import { CreateReviewDto, ReviewListQueryDto } from './dto/review.dto';
import { Review } from './entities/review.entity';

const UNIQUE_VIOLATION = '23505';

const REVIEW_ROWS_SQL = `
  SELECT review.id, review.rating, review.comment, review.created_at,
         reviewer.name AS reviewer_name, avatar.object_key AS reviewer_avatar_object_key
  FROM reviews review
  INNER JOIN users reviewer ON reviewer.id = review.user_id
  LEFT JOIN user_profiles profile ON profile.user_id = reviewer.id AND profile.deleted_at IS NULL
  LEFT JOIN file_assets avatar ON avatar.id = profile.avatar_asset_id AND avatar.deleted_at IS NULL
`;

@Injectable()
export class ReviewService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async create(userId: string, input: CreateReviewDto) {
    try {
      const review = await this.dataSource.transaction(async (manager) => {
        const [target] = await manager.query(
          `SELECT class.id,
                  EXISTS (
                    SELECT 1 FROM enrollments enrollment
                    WHERE enrollment.class_id = class.id AND enrollment.user_id = $2
                      AND enrollment.deleted_at IS NULL
                  ) AS enrolled,
                  EXISTS (
                    SELECT 1 FROM reviews review
                    WHERE review.class_id = class.id AND review.user_id = $2
                      AND review.deleted_at IS NULL
                  ) AS reviewed
           FROM classes class WHERE class.id = $1 AND class.deleted_at IS NULL`,
          [input.class_id, userId],
        );
        if (!target) throw new NotFoundException('Class not found');
        if (!target.enrolled) {
          throw new ForbiddenException('Only enrolled learners can review');
        }
        if (target.reviewed) {
          throw new ConflictException('You have already reviewed this class');
        }

        return manager.save(
          Review,
          manager.create(Review, {
            userId,
            classId: input.class_id,
            productId: null,
            orderId: null,
            rating: input.rating,
            comment: input.comment || null,
          }),
        );
      });

      const [row] = await this.dataSource.query(
        `${REVIEW_ROWS_SQL} WHERE review.id = $1`,
        [review.id],
      );
      return { data: toReview(row), responseMessage: 'Create review success' };
    } catch (error) {
      // A concurrent second review of the same class loses on the unique index.
      if (
        error instanceof QueryFailedError &&
        (error as unknown as { code: string }).code === UNIQUE_VIOLATION
      ) {
        throw new ConflictException('You have already reviewed this class');
      }
      throw error;
    }
  }

  async findClassReviews(classId: string, query: ReviewListQueryDto) {
    const [summary] = await this.dataSource.query(
      `SELECT EXISTS (SELECT 1 FROM classes WHERE id = $1 AND deleted_at IS NULL) AS found,
              COALESCE(round(avg(review.rating)::numeric, 1), 0) AS average,
              count(review.id)::integer AS total
       FROM reviews review
       WHERE review.class_id = $1 AND review.deleted_at IS NULL`,
      [classId],
    );
    if (!summary.found) throw new NotFoundException('Class not found');

    const { page, limit } = query;
    const rows = await this.dataSource.query(
      `${REVIEW_ROWS_SQL}
       WHERE review.class_id = $1 AND review.deleted_at IS NULL
       ORDER BY review.created_at DESC, review.id DESC
       LIMIT $2 OFFSET $3`,
      [classId, limit, (page - 1) * limit],
    );

    return {
      data: {
        average_rating: Number(summary.average),
        review_count: summary.total,
        reviews: rows.map(toReview),
      },
      meta: {
        page,
        limit,
        total: summary.total,
        totalPage: Math.ceil(summary.total / limit),
      },
      responseMessage: 'Get class reviews success',
    };
  }
}

function toReview(row) {
  return {
    id: row.id,
    rating: Number(row.rating),
    comment: row.comment,
    created_at: row.created_at,
    reviewer_name: row.reviewer_name,
    reviewer_avatar_object_key: row.reviewer_avatar_object_key,
  };
}
