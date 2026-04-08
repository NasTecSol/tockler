import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createHRIntegrationService } from '../hr/hrService';
import { State } from '../enums/state';
import { defaultHRIntegrationState } from '../hr/types';

function makeResponse(status: number, body?: unknown) {
    return {
        ok: status >= 200 && status < 300,
        status,
        text: vi.fn().mockResolvedValue(body ? JSON.stringify(body) : ''),
    } as unknown as Response;
}

describe('HRIntegrationService', () => {
    let persistedState = { ...defaultHRIntegrationState };
    const fetchImpl = vi.fn();
    const notifyStateChanged = vi.fn();

    const service = () =>
        createHRIntegrationService({
            fetchImpl,
            getBackendUrl: () => 'https://hr.example.com',
            loadState: async () => persistedState,
            saveState: async (state) => {
                persistedState = { ...state };
                return state;
            },
            findTrackItemsInRange: async () => [],
            findFirstTrackItemForSync: async () => [],
            getOngoingItems: async () => [],
            notifyStateChanged,
            getCurrentState: () => State.Online,
        });

    beforeEach(() => {
        persistedState = { ...defaultHRIntegrationState };
        fetchImpl.mockReset();
        notifyStateChanged.mockReset();
    });

    it('checks in only once for repeated ONLINE transitions', async () => {
        persistedState = {
            ...defaultHRIntegrationState,
            username: 'alex',
            authToken: 'token-1',
            isAuthenticated: true,
        };

        fetchImpl.mockResolvedValue(makeResponse(200, { ok: true }));
        const hrService = service();

        await hrService.handleStateChange(State.Online);
        await hrService.handleStateChange(State.Online);

        expect(fetchImpl).toHaveBeenCalledTimes(1);
        expect(fetchImpl).toHaveBeenCalledWith(
            'https://hr.example.com/employee/check-in',
            expect.objectContaining({ method: 'POST' }),
        );
    });

    it('checks out when moving from ONLINE to OFFLINE', async () => {
        persistedState = {
            ...defaultHRIntegrationState,
            username: 'alex',
            authToken: 'token-1',
            isAuthenticated: true,
            hasActiveSession: true,
            sessionCheckedInAt: Date.now(),
        };

        fetchImpl.mockResolvedValue(makeResponse(200, { ok: true }));
        const hrService = service();

        await hrService.handleStateChange(State.Offline);

        expect(fetchImpl).toHaveBeenCalledWith(
            'https://hr.example.com/employee/check-out',
            expect.objectContaining({ method: 'POST' }),
        );
        expect(persistedState.hasActiveSession).toBe(false);
    });

    it('marks auth invalid when sync returns 401', async () => {
        persistedState = {
            ...defaultHRIntegrationState,
            username: 'alex',
            authToken: 'token-1',
            isAuthenticated: true,
            hasActiveSession: true,
            sessionCheckedInAt: Date.now(),
        };

        fetchImpl.mockResolvedValue(makeResponse(401, { message: 'Expired' }));
        const hrService = service();

        await hrService.syncNow();

        expect(persistedState.isAuthenticated).toBe(false);
        expect(persistedState.authToken).toBeNull();
        expect(persistedState.authError).toContain('expired');
    });
});
