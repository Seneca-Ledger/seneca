import { SetMetadata } from '@nestjs/common';

export const ALLOW_IN_VERSION_KEY = 'allowInVersion';

/**
 * A POST that only reads (an export, a preview, a search): allowed in a past
 * version, which otherwise refuses every request that is not a GET.
 */
export const AllowInVersion = () => SetMetadata(ALLOW_IN_VERSION_KEY, true);
