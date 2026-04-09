export interface HRBackendConfig {
    baseUrl: string | null;
    configured: boolean;
    tenantId: string | null;
    buildMarker: string;
}

export interface HRAuthStatus {
    backendUrl: string | null;
    configured: boolean;
    username: string;
    isAuthenticated: boolean;
    authError: string | null;
    lastSyncCursor: number | null;
    lastSyncAt: number | null;
    lastSyncError: string | null;
    hasActiveSession: boolean;
    sessionCheckedInAt: number | null;
    isSyncing: boolean;
}
export const defaultHRAuthStatus: HRAuthStatus = {
    backendUrl: null,
    configured: false,
    username: '',
    isAuthenticated: false,
    authError: null,
    lastSyncCursor: null,
    lastSyncAt: null,
    lastSyncError: null,
    hasActiveSession: false,
    sessionCheckedInAt: null,
    isSyncing: false,
};
