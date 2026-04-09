import os from 'os';
import { getOngoingAppTrackItem } from '../background/watchTrackItems/watchAndSetAppTrackItem';
import { getOngoingLogTrackItem } from '../background/watchTrackItems/watchAndSetLogTrackItem';
import { getOngoingStatusTrackItem } from '../background/watchTrackItems/watchAndSetStatusTrackItem';
import { getCurrentState } from '../background/watchStates/watchAndPropagateState';
import { sendToMainWindow } from '../app/window-manager';
import { dbClient } from '../drizzle/dbClient';
import { TrackItem } from '../drizzle/schema';
import { State } from '../enums/state';
import { logManager } from '../utils/log-manager';
import { buildMinuteBuckets } from './hrSync';
import {
    defaultHRIntegrationState,
    HRAuthStatus,
    HRBackendConfig,
    HRIntegrationState,
    HRLoginPayload,
    MinuteBucketSyncPayload,
} from './types';

const MIN_SYNC_INTERVAL_SECONDS = 60;
const TRANSIENT_STATUS_CODES = new Set([408, 425, 429, 500, 502, 503, 504]);
const logger = logManager.getLogger('HRIntegration');

type FetchLike = typeof fetch;

interface HRServiceDeps {
    fetchImpl: FetchLike;
    getBackendUrl: () => string | null;
    getTenantId: () => string | null;
    getClientAddress: () => string;
    loadState: () => Promise<HRIntegrationState>;
    saveState: (state: HRIntegrationState) => Promise<unknown>;
    findTrackItemsInRange: (from: number, to: number) => Promise<TrackItem[]>;
    findFirstTrackItemForSync: () => Promise<Array<Pick<TrackItem, 'beginDate'>>>;
    getOngoingItems: () => Promise<TrackItem[]>;
    notifyStateChanged: (status: HRAuthStatus) => void;
    getCurrentState: () => State;
}

async function parseResponseBody(response: Response) {
    const text = await response.text();
    if (!text) {
        return null;
    }

    try {
        return JSON.parse(text);
    } catch (_error) {
        return text;
    }
}

function normalizeBackendUrl(rawUrl: string | null) {
    if (!rawUrl) {
        return null;
    }

    const trimmed = rawUrl.trim();
    return trimmed ? trimmed.replace(/\/+$/, '') : null;
}

function buildRequestUrls(backendUrl: string, path: string) {
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    const urls = [`${backendUrl}${normalizedPath}`];

    if (!backendUrl.endsWith('/api')) {
        urls.push(`${backendUrl}/api${normalizedPath}`);
    }

    return urls;
}

function resolveClientAddress() {
    const interfaces = os.networkInterfaces();

    for (const entries of Object.values(interfaces)) {
        for (const entry of entries || []) {
            if (entry.family === 'IPv4' && !entry.internal && entry.address) {
                return entry.address;
            }
        }
    }

    return '127.0.0.1';
}

export function resolveBackendUrlFromEnv() {
    const viteEnv = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env;
    const viteEnvUrl =
        viteEnv ? viteEnv.VITE_HR_BACKEND_URL || viteEnv.HR_BACKEND_URL || null : null;

    const processEnvUrl = process.env.HR_BACKEND_URL || process.env.VITE_HR_BACKEND_URL || null;

    return normalizeBackendUrl(viteEnvUrl || processEnvUrl);
}

export function resolveTenantIdFromEnv() {
    const viteEnv = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env;
    const viteEnvTenantId =
        viteEnv ? viteEnv.VITE_HR_TENANT_ID || viteEnv.HR_TENANT_ID || null : null;

    const processEnvTenantId = process.env.HR_TENANT_ID || process.env.VITE_HR_TENANT_ID || null;

    if (!viteEnvTenantId && !processEnvTenantId) {
        return null;
    }

    return (viteEnvTenantId || processEnvTenantId || '').trim() || null;
}

export function mapToAuthStatus(state: HRIntegrationState, backendUrl: string | null, isSyncing: boolean): HRAuthStatus {
    return {
        backendUrl,
        configured: Boolean(backendUrl),
        username: state.username,
        isAuthenticated: state.isAuthenticated,
        authError: state.authError,
        lastSyncCursor: state.lastSyncCursor,
        lastSyncAt: state.lastSyncAt,
        lastSyncError: state.lastSyncError,
        hasActiveSession: state.hasActiveSession,
        sessionCheckedInAt: state.sessionCheckedInAt,
        isSyncing,
    };
}

export class HRIntegrationService {
    private syncInterval: NodeJS.Timeout | null = null;
    private isSyncing = false;

    constructor(private readonly deps: HRServiceDeps) {}

    getBackendConfig(): HRBackendConfig {
        const rawUrl = this.deps.getBackendUrl();
        const baseUrl = normalizeBackendUrl(rawUrl);
        const tenantId = this.deps.getTenantId();
        logger.info('getBackendConfig', { rawUrl, baseUrl });
        return {
            baseUrl,
            configured: Boolean(baseUrl),
            tenantId,
            buildMarker: 'hr-api-v2-tenant',
        };
    }

    private async loadState() {
        const state = await this.deps.loadState();
        return { ...defaultHRIntegrationState, ...state };
    }

    private async persistState(state: HRIntegrationState) {
        const nextState = { ...defaultHRIntegrationState, ...state };
        await this.deps.saveState(nextState);
        this.deps.notifyStateChanged(mapToAuthStatus(nextState, this.getBackendConfig().baseUrl, this.isSyncing));
        return nextState;
    }

    private async patchState(patch: Partial<HRIntegrationState>) {
        const currentState = await this.loadState();
        return this.persistState({ ...currentState, ...patch });
    }

    async getAuthStatus() {
        const state = await this.loadState();
        return mapToAuthStatus(state, this.getBackendConfig().baseUrl, this.isSyncing);
    }

    private async handleUnauthorized(message = 'HR session expired. Please sign in again.') {
        const currentState = await this.loadState();
        await this.persistState({
            ...currentState,
            authToken: null,
            isAuthenticated: false,
            authError: message,
            hasActiveSession: false,
            sessionCheckedInAt: null,
        });
    }

    private async request(path: string, init: RequestInit = {}, retries = 2) {
        const backendUrl = this.getBackendConfig().baseUrl;
        if (!backendUrl) {
            throw new Error('HR backend URL is not configured.');
        }
        const tenantId = this.deps.getTenantId();
        const requestInit: RequestInit = {
            ...init,
            headers: {
                ...(init.headers || {}),
                ...(tenantId ? { 'x-tenant-id': tenantId } : {}),
            },
        };

        const requestUrls = buildRequestUrls(backendUrl, path);

        let attempt = 0;
        let lastError: unknown = null;

        while (attempt <= retries) {
            try {
                for (const requestUrl of requestUrls) {
                    const response = await this.deps.fetchImpl(requestUrl, requestInit);

                    if (response.status === 401 || response.status === 403) {
                        await this.handleUnauthorized();
                        throw new Error('HR session expired. Please sign in again.');
                    }

                    if (!response.ok) {
                        if ((response.status === 404 || response.status === 405) && requestUrl !== requestUrls[requestUrls.length - 1]) {
                            logger.warn('HR request failed, trying alternate API base path', {
                                path,
                                attemptedUrl: requestUrl,
                                status: response.status,
                            });
                            continue;
                        }

                        const body = await parseResponseBody(response);
                        const message =
                            typeof body === 'string'
                                ? body
                                : (body && typeof body === 'object' && 'message' in body && String(body.message)) ||
                                  `HR request failed with status ${response.status}`;

                        if (TRANSIENT_STATUS_CODES.has(response.status) && attempt < retries) {
                            attempt += 1;
                            continue;
                        }

                        throw new Error(message);
                    }

                    return parseResponseBody(response);
                }
            } catch (error) {
                lastError = error;
                const shouldRetry =
                    !(error instanceof Error) ||
                    error.message === 'fetch failed' ||
                    error.message === 'Failed to fetch' ||
                    error.name === 'TypeError';

                if (!shouldRetry || attempt >= retries) {
                    throw (error instanceof Error ? error : new Error('Unknown HR request error'));
                }

                attempt += 1;
            }
        }

        throw lastError instanceof Error ? lastError : new Error('Unknown HR request error');
    }

    async login({ username, password }: HRLoginPayload) {
        const clientAddress = this.deps.getClientAddress();
        const payload = await this.request(
            '/employee/login',
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ empId: username, password, macAddress: clientAddress }),
            },
            1,
        );

        const token =
            payload && typeof payload === 'object' && 'token' in payload
                ? String(payload.token)
                : payload && typeof payload === 'object' && 'accessToken' in payload
                  ? String(payload.accessToken)
                  : null;

        if (!token) {
            throw new Error('HR login response did not include a token.');
        }

        await this.patchState({
            username,
            authToken: token,
            isAuthenticated: true,
            authError: null,
            lastSyncError: null,
        });

        if (this.deps.getCurrentState() === State.Online) {
            await this.checkIn();
        }

        const latestState = await this.loadState();
        return mapToAuthStatus(latestState, this.getBackendConfig().baseUrl, this.isSyncing);
    }

    async logout() {
        await this.checkOut();
        const state = await this.loadState();
        const nextState = await this.persistState({
            ...state,
            authToken: null,
            isAuthenticated: false,
            authError: null,
            hasActiveSession: false,
            sessionCheckedInAt: null,
        });

        return mapToAuthStatus(nextState, this.getBackendConfig().baseUrl, this.isSyncing);
    }

    async checkIn() {
        const state = await this.loadState();
        if (!state.isAuthenticated || !state.authToken || state.hasActiveSession) {
            return;
        }

        await this.request('/employee/check-in', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${state.authToken}`,
                'Content-Type': 'application/json',
            },
        });

        await this.persistState({
            ...state,
            authError: null,
            hasActiveSession: true,
            sessionCheckedInAt: Date.now(),
        });
    }

    async checkOut() {
        const state = await this.loadState();
        if (!state.isAuthenticated || !state.authToken || !state.hasActiveSession) {
            return;
        }

        try {
            await this.request('/employee/check-out', {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${state.authToken}`,
                    'Content-Type': 'application/json',
                },
            });
        } finally {
            const latestState = await this.loadState();
            await this.persistState({
                ...latestState,
                hasActiveSession: false,
                sessionCheckedInAt: null,
            });
        }
    }

    async handleStateChange(state: State) {
        if (state === State.Online) {
            await this.checkIn();
            return;
        }

        await this.checkOut();
    }

    private async getSyncRangeEnd() {
        return Date.now();
    }

    private async resolveSyncRangeStart(state: HRIntegrationState, rangeEnd: number) {
        if (state.lastSyncCursor) {
            return state.lastSyncCursor;
        }

        const [firstTrackItem] = await this.deps.findFirstTrackItemForSync();
        return firstTrackItem?.beginDate || rangeEnd;
    }

    private async getItemsForSync(from: number, to: number) {
        const persistedItems = await this.deps.findTrackItemsInRange(from, to);
        const ongoingItems = await this.deps.getOngoingItems();
        const allItems = [...persistedItems, ...ongoingItems].filter((item) => item.endDate > from && item.beginDate < to);

        return {
            appItems: allItems.filter((item) => item.taskName === 'AppTrackItem'),
            statusItems: allItems.filter((item) => item.taskName === 'StatusTrackItem'),
            logItems: allItems.filter((item) => item.taskName === 'LogTrackItem'),
        };
    }

    async syncNow() {
        if (this.isSyncing) {
            return;
        }

        const state = await this.loadState();
        if (!state.isAuthenticated || !state.authToken) {
            return;
        }

        this.isSyncing = true;
        this.deps.notifyStateChanged(mapToAuthStatus(state, this.getBackendConfig().baseUrl, this.isSyncing));

        try {
            const rangeEnd = await this.getSyncRangeEnd();
            const rangeStart = await this.resolveSyncRangeStart(state, rangeEnd);

            if (rangeEnd <= rangeStart) {
                await this.persistState({
                    ...state,
                    lastSyncCursor: rangeEnd,
                    lastSyncAt: Date.now(),
                    lastSyncError: null,
                });
                return;
            }

            const items = await this.getItemsForSync(rangeStart, rangeEnd);
            const payload: MinuteBucketSyncPayload = {
                from: rangeStart,
                to: rangeEnd,
                buckets: buildMinuteBuckets(items, rangeStart, rangeEnd),
            };

            await this.request('/employee/session-sync', {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${state.authToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload),
            });

            await this.persistState({
                ...state,
                lastSyncCursor: rangeEnd,
                lastSyncAt: Date.now(),
                lastSyncError: null,
            });
        } catch (error) {
            logger.error('Failed to sync HR activities:', error);
            const latestState = await this.loadState();
            await this.persistState({
                ...latestState,
                lastSyncError: error instanceof Error ? error.message : 'Unknown HR sync error',
            });
        } finally {
            this.isSyncing = false;
            const latestState = await this.loadState();
            this.deps.notifyStateChanged(mapToAuthStatus(latestState, this.getBackendConfig().baseUrl, this.isSyncing));
        }
    }

    start(syncIntervalSeconds: number) {
        const intervalMs = Math.max(syncIntervalSeconds, MIN_SYNC_INTERVAL_SECONDS) * 1000;
        if (this.syncInterval) {
            clearInterval(this.syncInterval);
        }

        this.syncInterval = setInterval(() => {
            void this.syncNow();
        }, intervalMs);
    }

    async stop() {
        if (this.syncInterval) {
            clearInterval(this.syncInterval);
            this.syncInterval = null;
        }

        await this.checkOut();
    }
}

export function createHRIntegrationService(overrides: Partial<HRServiceDeps> = {}) {
    const deps: HRServiceDeps = {
        fetchImpl: fetch,
        getBackendUrl: () => resolveBackendUrlFromEnv(),
        getTenantId: () => resolveTenantIdFromEnv(),
        getClientAddress: () => resolveClientAddress(),
        loadState: async () => dbClient.fetchHRIntegrationState(),
        saveState: async (state) => dbClient.saveHRIntegrationState(state),
        findTrackItemsInRange: async (from, to) => dbClient.findTrackItemsInRange(from, to),
        findFirstTrackItemForSync: async () => dbClient.findFirstTrackItemForSync(),
        getOngoingItems: async () => {
            const items = await Promise.all([getOngoingAppTrackItem(), getOngoingStatusTrackItem(), getOngoingLogTrackItem()]);
            return items.filter(Boolean) as TrackItem[];
        },
        notifyStateChanged: (status) => {
            sendToMainWindow('HR_AUTH_STATE_CHANGED', status);
        },
        getCurrentState,
        ...overrides,
    };

    return new HRIntegrationService(deps);
}

export const hrIntegrationService = createHRIntegrationService();
