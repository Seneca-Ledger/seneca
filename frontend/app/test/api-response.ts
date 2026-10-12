import { AxiosHeaders } from 'axios';
import type { UncheckedResponse } from '@/app/lib/api';

/** A 200 from the api client carrying `data`, for mocking `apiClient.get`/`post`/…. */
export function apiResponse(data: unknown): UncheckedResponse {
  return {
    data,
    status: 200,
    statusText: 'OK',
    headers: {},
    config: { headers: new AxiosHeaders() },
  };
}
