import { IsUrl } from 'class-validator';
import {
  ClearableText,
  NumberInput,
  RequiredText,
} from '~/common/decorator/input.decorator';

// Registration arrives as multipart form data, so every value is a string:
// `experience_years` accepts a numeric string, and "" means it was not sent.
export class MentorRegistrationDto {
  @RequiredText({ max: 32, example: '+62 812-3456-7890' })
  phone: string;

  @ClearableText({ max: 160, example: 'Praktisi Data Science' })
  headline?: string | null;

  @ClearableText({ max: 2_000, example: 'Berpengalaman mengajar kelas data.' })
  bio?: string | null;

  @RequiredText({ max: 160, example: 'Data science' })
  expertise: string;

  @NumberInput({ integer: true, min: 0, max: 80, example: 4 })
  experience_years: number;

  @RequiredText({ max: 255, example: 'S1 Teknik Informatika' })
  education: string;

  @ClearableText({ max: 2_048, example: 'https://portfolio.example' })
  @IsUrl({ require_tld: false })
  portfolio_url?: string | null;

  @RequiredText({ max: 2_048, example: 'https://linkedin.com/in/example' })
  @IsUrl({ require_tld: false })
  linkedin_url: string;
}
