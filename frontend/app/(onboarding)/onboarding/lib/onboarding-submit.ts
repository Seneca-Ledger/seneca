import type { OnboardingData } from '../useOnboardingWizard';
import type { OnboardingMode } from './onboarding-flow';

type RequestConfig = { headers?: Record<string, string> };
type ApiResponse = Promise<{ data?: { id?: string; user?: unknown } }>;

/** The slice of the api client this needs; a plain object in tests. */
export interface OnboardingApi {
  post: (url: string, body?: unknown, config?: RequestConfig) => ApiResponse;
  put: (url: string, body?: unknown, config?: RequestConfig) => ApiResponse;
  patch: (url: string, body?: unknown, config?: RequestConfig) => ApiResponse;
}

export interface OnboardingSubmitResult {
  workspaceId: string;
  /** The user as saved by the last call that returns one. */
  user?: unknown;
}

const hasBusinessDetails = (data: OnboardingData): boolean =>
  Object.values(data.business).some(value => value.trim().length > 0);

/** The workspace the answers belong to: the account's own, or one created for them now. */
async function prepareWorkspace(
  api: OnboardingApi,
  data: OnboardingData,
  mode: OnboardingMode,
  currentWorkspaceId: string | null,
): Promise<string> {
  if (mode === 'create-workspace') {
    const created = await api.post('/workspaces', {
      name: data.workspaceName.trim() || 'New Workspace',
      currency: data.workspaceCurrency.trim().toUpperCase() || undefined,
      backgroundImage: data.workspaceBackgroundImage ?? undefined,
      profile: data.profile ?? undefined,
    });
    const workspaceId = created.data?.id;
    if (!workspaceId) {
      throw new Error('Workspace was not created');
    }
    await api.post(`/workspaces/${workspaceId}/switch`);
    return workspaceId;
  }

  if (!currentWorkspaceId) {
    throw new Error('No workspace to set up');
  }
  if (data.profile) {
    await api.patch(`/workspaces/${currentWorkspaceId}`, { profile: data.profile });
  }
  return currentWorkspaceId;
}

async function writeTax(
  api: OnboardingApi,
  data: OnboardingData,
  scoped: RequestConfig,
  taxYear: number,
): Promise<void> {
  if (!data.taxCountry) {
    return;
  }
  await api.put('/tax/settings/jurisdiction', { code: data.taxCountry }, scoped);
  if (data.taxpayerType) {
    await api.put('/income-tax/profile', { taxYear, taxpayerType: data.taxpayerType }, scoped);
  }
}

async function writeBusiness(
  api: OnboardingApi,
  data: OnboardingData,
  scoped: RequestConfig,
): Promise<void> {
  if (data.profile !== 'business' || !hasBusinessDetails(data)) {
    return;
  }
  const trimmed = Object.fromEntries(
    Object.entries(data.business).map(([field, value]) => [field, value.trim() || undefined]),
  );
  // One country for the workspace: the documents' country is the tax one.
  await api.put(
    '/business-profile',
    { ...trimmed, countryCode: data.taxCountry ?? undefined },
    scoped,
  );
}

/**
 * Writes everything the wizard collected, through the endpoints the settings
 * pages use.
 *
 * Order matters: the workspace-scoped writes go first and the call that marks
 * onboarding complete goes last, so a failure part-way leaves the user in the
 * wizard to retry rather than in an app with half the answers saved. Every
 * write is an idempotent PUT/PATCH, so a retry is safe.
 *
 * The workspace is passed as an explicit header rather than left to the api
 * client's localStorage lookup: in create-workspace mode it is the workspace
 * this call just created.
 */
export async function submitOnboarding(
  api: OnboardingApi,
  data: OnboardingData,
  mode: OnboardingMode,
  currentWorkspaceId: string | null,
  taxYear: number = new Date().getFullYear(),
): Promise<OnboardingSubmitResult> {
  const workspaceId = await prepareWorkspace(api, data, mode, currentWorkspaceId);
  const scoped: RequestConfig = { headers: { 'X-Workspace-Id': workspaceId } };

  await writeTax(api, data, scoped, taxYear);
  await writeBusiness(api, data, scoped);

  if (mode === 'create-workspace') {
    // The language is the account's, asked again here because this flow has no language step.
    const preferences = await api.patch('/users/me/preferences', { locale: data.locale });
    return { workspaceId, user: preferences.data?.user };
  }

  await api.patch('/users/me/preferences', {
    dateFormat: data.dateFormat,
    firstDayOfWeek: data.firstDayOfWeek,
  });

  const completed = await api.patch('/users/me/onboarding', {
    locale: data.locale,
    timeZone: data.timeZone || null,
    workspaceName: data.workspaceName.trim() || undefined,
    workspaceCurrency: data.workspaceCurrency.trim().toUpperCase() || undefined,
    workspaceBackgroundImage: data.workspaceBackgroundImage ?? undefined,
  });

  return { workspaceId, user: completed.data?.user };
}
