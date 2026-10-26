import { type ContractInput, checkContract } from '@/app/lib/query-fn-schema';
import type { OnboardingData } from '../useOnboardingWizard';
import type { OnboardingMode } from './onboarding-flow';

type RequestConfig = { headers?: Record<string, string> };
type ApiResponse = Promise<{ data: unknown }>;

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
    } satisfies ContractInput<'CreateWorkspaceBody'>);
    const { id: workspaceId } = await checkContract(
      'WorkspaceSummary',
      created.data,
      '/workspaces',
    );
    await api.post(`/workspaces/${workspaceId}/switch`);
    return workspaceId;
  }

  if (!currentWorkspaceId) {
    throw new Error('No workspace to set up');
  }
  if (data.profile) {
    await api.patch(`/workspaces/${currentWorkspaceId}`, {
      profile: data.profile,
    } satisfies ContractInput<'UpdateWorkspaceBody'>);
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
  await api.put(
    '/tax/settings/jurisdiction',
    { code: data.taxCountry } satisfies ContractInput<'SetJurisdictionBody'>,
    scoped,
  );
  if (data.taxpayerType) {
    await api.put(
      '/income-tax/profile',
      {
        taxYear,
        taxpayerType: data.taxpayerType,
      } satisfies ContractInput<'UpdateIncomeTaxProfileBody'>,
      scoped,
    );
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
    {
      ...trimmed,
      countryCode: data.taxCountry ?? undefined,
    } satisfies ContractInput<'UpdateBusinessProfileBody'>,
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
    const preferences = await api.patch('/users/me/preferences', {
      locale: data.locale,
    } satisfies ContractInput<'UpdateMyPreferencesBody'>);
    const { user: updatedUser } = await checkContract(
      'UserUpdateResponse',
      preferences.data,
      '/users/me/preferences',
    );
    return { workspaceId, user: updatedUser };
  }

  await api.patch('/users/me/preferences', {
    dateFormat: data.dateFormat,
    firstDayOfWeek: data.firstDayOfWeek,
  } satisfies ContractInput<'UpdateMyPreferencesBody'>);

  const completed = await api.patch('/users/me/onboarding', {
    locale: data.locale,
    timeZone: data.timeZone || null,
    workspaceName: data.workspaceName.trim() || undefined,
    workspaceCurrency: data.workspaceCurrency.trim().toUpperCase() || undefined,
    workspaceBackgroundImage: data.workspaceBackgroundImage ?? undefined,
  } satisfies ContractInput<'CompleteOnboardingBody'>);
  const { user: completedUser } = await checkContract(
    'UserUpdateResponse',
    completed.data,
    '/users/me/onboarding',
  );

  return { workspaceId, user: completedUser };
}
