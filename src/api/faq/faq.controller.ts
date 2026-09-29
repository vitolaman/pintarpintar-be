import { Controller, Get, HttpStatus } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { DefaultResponse } from '~/common/decorator/response.decorator';
import { Public } from '~/common/decorator/public.decorator';
import { PublicFaqResponseDto } from './dto/public-faq-response.dto';
import { FaqService } from './faq.service';

@Controller('faqs/v1')
@ApiTags('FAQs')
export class FaqController {
  constructor(private readonly faqService: FaqService) {}

  @Get('get-public-faqs')
  @Public()
  @DefaultResponse(
    PublicFaqResponseDto,
    'Get public FAQs success',
    HttpStatus.OK,
    [],
  )
  findPublic() {
    return this.faqService.findPublic();
  }
}
