import { TrackItem } from '../drizzle/schema';
import { State } from '../enums/state';

export interface HRBackendConfig {
    baseUrl: string | null;
    configured: boolean;
}

export interface HRIntegrationState {
    username: string;
    authToken: string | null;
    isAuthenticated: boolean;
    authError: string | null;
    lastSyncCursor: number | null;
    lastSyncAt: number | null;
    lastSyncError: string | null;
    hasActiveSession: boolean;
    sessionCheckedInAt: number | null;
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

export interface HRLoginPayload {
    username: string;
    password: string;
}

export interface MinuteBucketPayloadRow {
    minuteStart: number;
    minuteEnd: number;
    trackedDurationMs: number;
    status: State | null;
    statusDurationMs: number;
    appName: string | null;
    appTitle: string | null;
    appDurationMs: number;
    logAppName: string | null;
    logTitle: string | null;
    logDurationMs: number;
}

export interface MinuteBucketSyncPayload {
    from: number;
    to: number;
    buckets: MinuteBucketPayloadRow[];
}

export interface HRSyncTrackItems {
    appItems: TrackItem[];
    statusItems: TrackItem[];
    logItems: TrackItem[];
}

export const defaultHRIntegrationState: HRIntegrationState = {
    username: '',
    authToken: null,
    isAuthenticated: false,
    authError: null,
    lastSyncCursor: null,
    lastSyncAt: null,
    lastSyncError: null,
    hasActiveSession: false,
    sessionCheckedInAt: null,
};
