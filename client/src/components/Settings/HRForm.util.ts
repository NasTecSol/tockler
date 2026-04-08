export interface HRBackendConfig {
    baseUrl: string | null;
    configured: boolean;
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
