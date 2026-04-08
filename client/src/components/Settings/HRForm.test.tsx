import { ChakraProvider } from '@chakra-ui/react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HRForm } from './HRForm';

const invokeIpc = vi.fn();

const mockElectronBridge = {
    configGet: vi.fn(),
    configSet: vi.fn(),
    logger: {
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn(),
    },
    platform: 'win32',
    isMas: false,
    appVersion: vi.fn(),
    openUrlInExternalWindow: vi.fn(),
    invokeIpc,
    sendIpc: vi.fn(),
    onIpc: vi.fn(),
    removeListenerIpc: vi.fn(),
};

const unauthenticatedStatus = {
    backendUrl: 'https://hr.example.com',
    configured: true,
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

const authenticatedStatus = {
    ...unauthenticatedStatus,
    username: 'alex',
    isAuthenticated: true,
    hasActiveSession: true,
    sessionCheckedInAt: 1710000000000,
};

function renderForm() {
    return render(
        <ChakraProvider>
            <HRForm />
        </ChakraProvider>,
    );
}

describe('HRForm', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.stubGlobal('electronBridge', mockElectronBridge);
    });

    it('updates auth state after successful login', async () => {
        invokeIpc.mockImplementation((channel: string, payload?: unknown) => {
            if (channel === 'getHRBackendConfig') {
                return Promise.resolve({ configured: true, baseUrl: 'https://hr.example.com' });
            }

            if (channel === 'getHRAuthStatus') {
                return Promise.resolve(unauthenticatedStatus);
            }

            if (channel === 'loginToHRBackend') {
                expect(payload).toStrictEqual({ username: 'alex', password: 'secret' });
                return Promise.resolve(authenticatedStatus);
            }

            return Promise.resolve({});
        });

        renderForm();

        fireEvent.change(await screen.findByLabelText('Employee username'), { target: { value: 'alex' } });
        fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'secret' } });
        fireEvent.click(screen.getByText('Sign in'));

        await waitFor(() => expect(screen.getByText('Authenticated')).toBeInTheDocument());
        expect(screen.getByText('Checked in')).toBeInTheDocument();
        expect(screen.getByText('Employee: alex')).toBeInTheDocument();
    });

    it('shows an error when login fails', async () => {
        invokeIpc.mockImplementation((channel: string) => {
            if (channel === 'getHRBackendConfig') {
                return Promise.resolve({ configured: true, baseUrl: 'https://hr.example.com' });
            }

            if (channel === 'getHRAuthStatus') {
                return Promise.resolve(unauthenticatedStatus);
            }

            if (channel === 'loginToHRBackend') {
                return Promise.reject(new Error('Invalid credentials'));
            }

            return Promise.resolve({});
        });

        renderForm();

        fireEvent.change(await screen.findByLabelText('Employee username'), { target: { value: 'alex' } });
        fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'secret' } });
        fireEvent.click(screen.getByText('Sign in'));

        await waitFor(() => expect(screen.getByText('Invalid credentials')).toBeInTheDocument());
        expect(screen.getByText('Signed out')).toBeInTheDocument();
    });

    it('clears auth state after logout', async () => {
        invokeIpc.mockImplementation((channel: string) => {
            if (channel === 'getHRBackendConfig') {
                return Promise.resolve({ configured: true, baseUrl: 'https://hr.example.com' });
            }

            if (channel === 'getHRAuthStatus') {
                return Promise.resolve(authenticatedStatus);
            }

            if (channel === 'logoutFromHRBackend') {
                return Promise.resolve(unauthenticatedStatus);
            }

            return Promise.resolve({});
        });

        renderForm();

        fireEvent.click(await screen.findByText('Sign out'));

        await waitFor(() => expect(screen.getByText('Signed out')).toBeInTheDocument());
        expect(screen.getByText('Checked out')).toBeInTheDocument();
    });
});
