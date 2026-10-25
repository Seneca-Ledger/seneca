'use client';

import { useRouter } from 'next/navigation';
import type React from 'react';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { getApiErrorMessage } from '@/app/lib/api-error';
import { hasSessionCookie } from '@/app/lib/csrf';
import { DEFAULT_APP_ROUTE } from '@/app/lib/default-app-route';
import type { ContractInput } from '@/app/lib/query-fn-schema';
import { checkContract, reportContractDrift } from '@/app/lib/query-fn-schema';
import { api } from '../lib/api';

type WorkspaceSettings = Record<string, unknown>;
type WorkspacePermissions = Record<string, boolean>;

interface WorkspaceStats {
  integrationCount: number;
  recentActivity: boolean;
  memberCount: number;
  lastAccessedAt: string | null;
}

/** An opened past version: which one, of which workspace, taken when. */
export interface WorkspaceVersionRef {
  id: string;
  takenAt: string;
  sourceWorkspaceId: string;
}

interface Workspace {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  color: string | null;
  backgroundImage: string | null;
  /** Credit line for a background found through the photo search. */
  backgroundAttribution?: string | null;
  backgroundSourceUrl?: string | null;
  currency: string;
  isFavorite: boolean;
  settings: WorkspaceSettings | null;
  ownerId: string | null;
  createdAt: string;
  updatedAt: string;
  memberRole?: string;
  memberPermissions?: WorkspacePermissions | null;
  stats?: WorkspaceStats;
  /** `version`: a hidden read-only copy of a past version, never listed in switchers. */
  kind?: 'standard' | 'version';
  version?: WorkspaceVersionRef | null;
}

interface WorkspaceData {
  currentWorkspace: Workspace | null;
  /** The workspaces to pick from: opened versions are left out. */
  workspaces: Workspace[];
  loading: boolean;
  error: string | null;
}

interface WorkspaceActions {
  switchWorkspace: (workspaceId: string) => Promise<void>;
  /** Opens a past version as a read-only workspace and switches the app into it. */
  openVersion: (versionId: string) => Promise<void>;
  clearWorkspace: () => void;
  refreshWorkspaces: () => Promise<void>;
  toggleFavorite: (workspaceId: string) => Promise<void>;
  updateWorkspaceBackground: (params: {
    workspaceId: string;
    backgroundImage: string;
  }) => Promise<void>;
  /** Copies a searched photo into the workspace and makes it the background. */
  setWorkspaceBackgroundPhoto: (params: { workspaceId: string; photoId: string }) => Promise<void>;
  /** Switches plugins on or off for the whole workspace (owners and admins only). */
  setWorkspacePlugins: (params: {
    workspaceId: string;
    plugins: NonNullable<ContractInput<'UpdateWorkspaceBody'>['plugins']>;
  }) => Promise<void>;
}

type WorkspaceContextType = WorkspaceData & WorkspaceActions;

// Data and actions live in separate contexts so consumers that only need the
// (stable) actions do not re-render on every loading/error flip.
const WorkspaceDataContext = createContext<WorkspaceData | undefined>(undefined);
const WorkspaceActionsContext = createContext<WorkspaceActions | undefined>(undefined);

type SetState<T> = React.Dispatch<React.SetStateAction<T>>;

interface WorkspaceSetters {
  setWorkspaces: SetState<Workspace[]>;
  setCurrentWorkspace: SetState<Workspace | null>;
  setLoading: SetState<boolean>;
  setError: SetState<string | null>;
}

async function fetchAndSetWorkspaces({
  setWorkspaces,
  setCurrentWorkspace,
  setLoading,
  setError,
}: WorkspaceSetters): Promise<void> {
  try {
    setLoading(true);
    setError(null);
    const response = await api.get('/workspaces');
    // Drift is reported, not thrown: the catch below would leave the app without a workspace.
    const data: Workspace[] = await reportContractDrift(
      'WorkspaceList',
      response.data,
      '/workspaces',
    );
    setWorkspaces(data);
    const storedId = localStorage.getItem('currentWorkspaceId');
    const found = storedId ? data.find(w => w.id === storedId) : null;
    // A version is only ever entered on purpose: the fallback is a real workspace.
    const workspace = found ?? data.find(w => !isVersion(w)) ?? null;
    if (workspace) {
      setCurrentWorkspace(workspace);
      localStorage.setItem('currentWorkspaceId', workspace.id);
    }
  } catch (err) {
    console.error('Failed to fetch workspaces:', err);
    setError(getApiErrorMessage(err, 'Failed to load workspaces'));
  } finally {
    setLoading(false);
  }
}

async function apiSwitchWorkspace(
  {
    workspaceId,
    refreshWorkspaces,
  }: { workspaceId: string; refreshWorkspaces: () => Promise<void> },
  workspaces: Workspace[],
  setters: WorkspaceSetters,
): Promise<void> {
  try {
    setters.setLoading(true);
    setters.setError(null);
    await api.post(`/workspaces/${workspaceId}/switch`);
    // Stored first: a workspace the list does not know yet (a version just
    // opened) is picked up by the refresh through this id.
    localStorage.setItem('currentWorkspaceId', workspaceId);
    const workspace = workspaces.find(w => w.id === workspaceId);
    if (workspace) {
      setters.setCurrentWorkspace(workspace);
    } else {
      await refreshWorkspaces();
    }
  } catch (err) {
    setters.setError(getApiErrorMessage(err, 'Failed to switch workspace'));
    throw err;
  } finally {
    setters.setLoading(false);
  }
}

async function apiOpenVersion(versionId: string): Promise<string> {
  // Restoring the copy happens in this request, so it may take a few seconds.
  const response = await api.post(`/versions/${versionId}/open`);
  const { workspaceId } = await checkContract(
    'OpenedWorkspaceVersion',
    response.data,
    '/versions/:id/open',
  );
  return workspaceId;
}

function isVersion(workspace: Workspace | null | undefined): boolean {
  return workspace?.kind === 'version';
}

async function apiToggleFavorite(
  { workspaceId }: { workspaceId: string },
  setters: Pick<WorkspaceSetters, 'setWorkspaces' | 'setCurrentWorkspace'>,
): Promise<void> {
  try {
    const response = await api.patch(`/workspaces/${workspaceId}/favorite`);
    const { isFavorite } = await checkContract(
      'WorkspaceFavorite',
      response.data,
      '/workspaces/:id/favorite',
    );
    setters.setWorkspaces(prev => prev.map(w => (w.id === workspaceId ? { ...w, isFavorite } : w)));
    setters.setCurrentWorkspace(prev =>
      prev?.id === workspaceId ? { ...prev, isFavorite } : prev,
    );
  } catch (err) {
    console.error('Failed to toggle favorite:', err);
    throw err;
  }
}

async function apiUpdateBackground(
  { workspaceId, backgroundImage }: { workspaceId: string; backgroundImage: string },
  setters: Pick<WorkspaceSetters, 'setWorkspaces' | 'setCurrentWorkspace'>,
): Promise<void> {
  try {
    await api.patch(`/workspaces/${workspaceId}`, {
      backgroundImage,
    } satisfies ContractInput<'UpdateWorkspaceBody'>);
    // A bundled background carries no credit; the server clears it too.
    applyBackground(
      workspaceId,
      { backgroundImage, backgroundAttribution: null, backgroundSourceUrl: null },
      setters,
    );
  } catch (err) {
    console.error('Failed to update background:', err);
    throw err;
  }
}

type BackgroundFields = Pick<
  Workspace,
  'backgroundImage' | 'backgroundAttribution' | 'backgroundSourceUrl'
>;

function applyBackground(
  workspaceId: string,
  fields: BackgroundFields,
  setters: Pick<WorkspaceSetters, 'setWorkspaces' | 'setCurrentWorkspace'>,
): void {
  setters.setWorkspaces(prev => prev.map(w => (w.id === workspaceId ? { ...w, ...fields } : w)));
  setters.setCurrentWorkspace(prev => (prev?.id === workspaceId ? { ...prev, ...fields } : prev));
}

async function apiSetBackgroundPhoto(
  { workspaceId, photoId }: { workspaceId: string; photoId: string },
  setters: Pick<WorkspaceSetters, 'setWorkspaces' | 'setCurrentWorkspace'>,
): Promise<void> {
  const response = await api.put(`/workspaces/${workspaceId}/background`, {
    photoId,
  } satisfies ContractInput<'SetWorkspaceBackgroundBody'>);
  applyBackground(
    workspaceId,
    await checkContract('WorkspaceBackground', response.data, '/workspaces/:id/background'),
    setters,
  );
}

async function apiSetPlugins(
  { workspaceId, plugins }: Parameters<WorkspaceActions['setWorkspacePlugins']>[0],
  setters: Pick<WorkspaceSetters, 'setWorkspaces' | 'setCurrentWorkspace'>,
): Promise<void> {
  const response = await api.patch(`/workspaces/${workspaceId}`, {
    plugins,
  } satisfies ContractInput<'UpdateWorkspaceBody'>);
  const { settings } = await checkContract('WorkspaceSummary', response.data, '/workspaces/:id');
  setters.setWorkspaces(prev => prev.map(w => (w.id === workspaceId ? { ...w, settings } : w)));
  setters.setCurrentWorkspace(prev => (prev?.id === workspaceId ? { ...prev, settings } : prev));
}

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const [currentWorkspace, setCurrentWorkspace] = useState<Workspace | null>(null);
  // Every workspace the API lists, opened versions included, so the current
  // one resolves while the app is inside a version.
  const [allWorkspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // switchWorkspace reads the latest list through a ref so its identity does
  // not change every time the list is refreshed.
  const workspacesRef = useRef(allWorkspaces);
  useEffect(() => {
    workspacesRef.current = allWorkspaces;
  }, [allWorkspaces]);
  const workspaces = useMemo(() => allWorkspaces.filter(w => !isVersion(w)), [allWorkspaces]);
  const router = useRouter();

  const setters = useMemo<WorkspaceSetters>(
    () => ({ setWorkspaces, setCurrentWorkspace, setLoading, setError }),
    [],
  );

  const refreshWorkspaces = useCallback(async () => fetchAndSetWorkspaces(setters), [setters]);

  const switchWorkspace = useCallback(
    async (workspaceId: string) =>
      apiSwitchWorkspace({ workspaceId, refreshWorkspaces }, workspacesRef.current, setters),
    [refreshWorkspaces, setters],
  );

  const openVersion = useCallback(
    async (versionId: string) => {
      const workspaceId = await apiOpenVersion(versionId);
      await switchWorkspace(workspaceId);
      router.push(DEFAULT_APP_ROUTE);
    },
    [switchWorkspace, router],
  );

  const clearWorkspace = useCallback(() => {
    setCurrentWorkspace(null);
    localStorage.removeItem('currentWorkspaceId');
  }, []);

  const toggleFavorite = useCallback(
    async (workspaceId: string) => apiToggleFavorite({ workspaceId }, setters),
    [setters],
  );

  const updateWorkspaceBackground = useCallback(
    async (params: { workspaceId: string; backgroundImage: string }) =>
      apiUpdateBackground(params, setters),
    [setters],
  );

  const setWorkspaceBackgroundPhoto = useCallback(
    async (params: { workspaceId: string; photoId: string }) =>
      apiSetBackgroundPhoto(params, setters),
    [setters],
  );

  const setWorkspacePlugins = useCallback<WorkspaceActions['setWorkspacePlugins']>(
    async params => apiSetPlugins(params, setters),
    [setters],
  );

  useEffect(() => {
    if (hasSessionCookie()) {
      void refreshWorkspaces();
    } else {
      setCurrentWorkspace(null);
      setWorkspaces([]);
      setError(null);
      setLoading(false);
    }
  }, [refreshWorkspaces]);

  const data = useMemo<WorkspaceData>(
    () => ({ currentWorkspace, workspaces, loading, error }),
    [currentWorkspace, workspaces, loading, error],
  );

  const actions = useMemo<WorkspaceActions>(
    () => ({
      switchWorkspace,
      openVersion,
      clearWorkspace,
      refreshWorkspaces,
      toggleFavorite,
      updateWorkspaceBackground,
      setWorkspaceBackgroundPhoto,
      setWorkspacePlugins,
    }),
    [
      switchWorkspace,
      openVersion,
      clearWorkspace,
      refreshWorkspaces,
      toggleFavorite,
      updateWorkspaceBackground,
      setWorkspaceBackgroundPhoto,
      setWorkspacePlugins,
    ],
  );

  return (
    <WorkspaceActionsContext.Provider value={actions}>
      <WorkspaceDataContext.Provider value={data}>{children}</WorkspaceDataContext.Provider>
    </WorkspaceActionsContext.Provider>
  );
}

/** Stable workspace actions only; never re-renders on workspace data changes. */
export function useWorkspaceActions(): WorkspaceActions {
  const actions = useContext(WorkspaceActionsContext);
  if (actions === undefined) {
    throw new Error('useWorkspaceActions must be used within a WorkspaceProvider');
  }
  return actions;
}

export function useWorkspace(): WorkspaceContextType {
  const data = useContext(WorkspaceDataContext);
  const actions = useContext(WorkspaceActionsContext);
  if (data === undefined || actions === undefined) {
    throw new Error('useWorkspace must be used within a WorkspaceProvider');
  }
  return useMemo(() => ({ ...data, ...actions }), [data, actions]);
}

/**
 * Whether the app is inside an opened past version, where nothing can be
 * changed. Outside a WorkspaceProvider (isolated component tests) it is not.
 */
export function useReadOnlyWorkspace(): {
  isReadOnly: boolean;
  version: WorkspaceVersionRef | null;
} {
  const current = useContext(WorkspaceDataContext)?.currentWorkspace ?? null;
  const isReadOnly = isVersion(current);
  return { isReadOnly, version: isReadOnly ? (current?.version ?? null) : null };
}
