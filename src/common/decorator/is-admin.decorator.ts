import { SetMetadata } from '@nestjs/common';

export const IS_ADMIN_ENDPOINT = 'isAdminEndpoint';

/** Requires an authenticated account listed in ADMIN_USER_IDS. */
export const IsAdmin = () => SetMetadata(IS_ADMIN_ENDPOINT, true);
