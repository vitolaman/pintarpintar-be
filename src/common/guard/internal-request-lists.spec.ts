import { Reflector } from '@nestjs/core';
import { CertificationRequestController } from '~/api/certification-request/certification-request.controller';
import { HelpTicketController } from '~/api/help-ticket/help-ticket.controller';
import { MerchantProRequestController } from '~/api/merchant-pro-request/merchant-pro-request.controller';
import { MerchantRegistrationRequestController } from '~/api/merchant-registration-request/merchant-registration-request.controller';
import { IS_ADMIN_ENDPOINT } from '../decorator/is-admin.decorator';

const reflector = new Reflector();
const isAdminOnly = (
  controller: { prototype: object },
  handler: 'findAll' | 'create' | 'findOne',
) =>
  reflector.getAllAndOverride<boolean>(IS_ADMIN_ENDPOINT, [
    controller.prototype[handler],
    controller,
  ]) === true;

describe('internal request lists', () => {
  it.each([
    ['merchant Pro requests', MerchantProRequestController],
    ['certification requests', CertificationRequestController],
    ['merchant registration requests', MerchantRegistrationRequestController],
  ])(
    'restricts the %s list to admins and leaves creation open',
    (_, controller) => {
      expect(isAdminOnly(controller, 'findAll')).toBe(true);
      expect(isAdminOnly(controller, 'create')).toBe(false);
    },
  );

  it('keeps help tickets open to signed-in users (scoped in the service)', () => {
    expect(isAdminOnly(HelpTicketController, 'findAll')).toBe(false);
    expect(isAdminOnly(HelpTicketController, 'findOne')).toBe(false);
    expect(isAdminOnly(HelpTicketController, 'create')).toBe(false);
  });
});
