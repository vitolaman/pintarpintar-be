import { Controller, Get } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ApiBearerAuth, DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Public } from '../decorator/public.decorator';
import { documentErrorResponses } from './error-responses';

@ApiBearerAuth()
@Controller('samples')
class SampleController {
  @Public()
  @Get('open')
  open() {
    return {};
  }

  @Get('closed')
  closed() {
    return {};
  }
}

describe('documentErrorResponses', () => {
  it('documents public routes without security or 401, protected routes with both', async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [SampleController],
    }).compile();
    const app = moduleRef.createNestApplication();
    await app.init();
    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder().addBearerAuth().build(),
    );

    documentErrorResponses(app, document);

    const open = document.paths['/samples/open'].get;
    const closed = document.paths['/samples/closed'].get;
    expect(open.security).toBeUndefined();
    expect(open.responses['401']).toBeUndefined();
    expect(closed.security).toEqual([{ bearer: [] }]);
    expect(closed.responses['401']).toBeDefined();
    await app.close();
  });
});
