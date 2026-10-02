import { BadRequestException, Controller, Get, Query } from '@nestjs/common';
import { ExecutionContext } from '@nestjs/common';
import { UndeclaredQueryGuard } from './undeclared-query.guard';

@Controller()
class SampleController {
  @Get('plain')
  plain() {
    return null;
  }

  @Get('filtered')
  filtered(@Query() query: object) {
    return query;
  }
}

const contextFor = (handler: keyof SampleController, query: object) =>
  ({
    getType: () => 'http',
    getClass: () => SampleController,
    getHandler: () => SampleController.prototype[handler],
    switchToHttp: () => ({ getRequest: () => ({ query }) }),
  }) as unknown as ExecutionContext;

describe('UndeclaredQueryGuard', () => {
  const guard = new UndeclaredQueryGuard();

  it('allows a route without query parameters when none are sent', () => {
    expect(guard.canActivate(contextFor('plain', {}))).toBe(true);
  });

  it('rejects a query parameter on a route that declares none, naming it', () => {
    expect(() => guard.canActivate(contextFor('plain', { page: '2' }))).toThrow(
      new BadRequestException(['property page should not exist']),
    );
  });

  it('leaves routes with a query DTO to their validation', () => {
    expect(guard.canActivate(contextFor('filtered', { page: '2' }))).toBe(true);
  });
});
