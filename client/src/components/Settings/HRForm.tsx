import {
    Alert,
    AlertDescription,
    AlertIcon,
    Badge,
    Box,
    Button,
    FormControl,
    FormLabel,
    HStack,
    Input,
    Text,
    VStack,
} from '@chakra-ui/react';
import { DateTime } from 'luxon';
import { useCallback, useEffect, useState } from 'react';
import {
    getHRAuthStatus,
    getHRBackendConfig,
    loginToHRBackend,
    logoutFromHRBackend,
    syncActivitiesToHR,
} from '../../services/settings.api';
import { ElectronEventEmitter } from '../../services/ElectronEventEmitter';
import { CardBox } from '../CardBox';
import { HRAuthStatus, HRBackendConfig } from './HRForm.util';

const defaultBackendConfig: HRBackendConfig = {
    baseUrl: null,
    configured: false,
};

const defaultStatus: HRAuthStatus = {
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

function formatTimestamp(timestamp: number | null) {
    if (!timestamp) {
        return 'Never';
    }

    return DateTime.fromMillis(timestamp).toFormat('yyyy-MM-dd HH:mm:ss');
}

export const HRForm = () => {
    const [backendConfig, setBackendConfig] = useState(defaultBackendConfig);
    const [status, setStatus] = useState(defaultStatus);
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [isBusy, setIsBusy] = useState(false);
    const [localError, setLocalError] = useState<string | null>(null);

    const refreshStatus = useCallback(async () => {
        const [config, nextStatus] = await Promise.all([getHRBackendConfig(), getHRAuthStatus()]);
        setBackendConfig(config);
        setStatus(nextStatus);
        setUsername(nextStatus.username || '');
    }, []);

    useEffect(() => {
        refreshStatus();
    }, [refreshStatus]);

    useEffect(() => {
        const handleStatusChange = (nextStatus: HRAuthStatus) => {
            setStatus(nextStatus);
            setUsername(nextStatus.username || '');
        };

        ElectronEventEmitter.on('HR_AUTH_STATE_CHANGED', handleStatusChange);
        return () => {
            ElectronEventEmitter.off('HR_AUTH_STATE_CHANGED', handleStatusChange);
        };
    }, []);

    const handleLogin = async () => {
        setIsBusy(true);
        setLocalError(null);

        try {
            const nextStatus = await loginToHRBackend({ username, password });
            setStatus(nextStatus);
            setPassword('');
        } catch (error) {
            setLocalError(error instanceof Error ? error.message : 'Login failed');
        } finally {
            setIsBusy(false);
        }
    };

    const handleLogout = async () => {
        setIsBusy(true);
        setLocalError(null);

        try {
            const nextStatus = await logoutFromHRBackend();
            setStatus(nextStatus);
            setPassword('');
        } catch (error) {
            setLocalError(error instanceof Error ? error.message : 'Logout failed');
        } finally {
            setIsBusy(false);
        }
    };

    const handleSyncNow = async () => {
        setIsBusy(true);
        setLocalError(null);

        try {
            const nextStatus = await syncActivitiesToHR();
            setStatus(nextStatus);
        } catch (error) {
            setLocalError(error instanceof Error ? error.message : 'Sync failed');
        } finally {
            setIsBusy(false);
        }
    };

    return (
        <CardBox title="HR integration" divider w="50%">
            <VStack align="stretch" spacing={4}>
                <Box>
                    <Text fontWeight="bold">Backend</Text>
                    <Text fontSize="sm" color="gray.500">
                        {backendConfig.configured ? backendConfig.baseUrl : 'Not configured'}
                    </Text>
                </Box>

                {!backendConfig.configured && (
                    <Alert status="warning">
                        <AlertIcon />
                        <AlertDescription>HR backend URL is not configured for this build.</AlertDescription>
                    </Alert>
                )}

                <HStack spacing={3} alignItems="center">
                    <Badge colorScheme={status.isAuthenticated ? 'green' : 'gray'}>
                        {status.isAuthenticated ? 'Authenticated' : 'Signed out'}
                    </Badge>
                    <Badge colorScheme={status.hasActiveSession ? 'blue' : 'gray'}>
                        {status.hasActiveSession ? 'Checked in' : 'Checked out'}
                    </Badge>
                    {status.isSyncing && <Badge colorScheme="orange">Syncing</Badge>}
                </HStack>

                <FormControl isDisabled={!backendConfig.configured || status.isAuthenticated}>
                    <FormLabel htmlFor="hr-username">Employee username</FormLabel>
                    <Input
                        id="hr-username"
                        placeholder="Username"
                        value={username}
                        onChange={(event) => setUsername(event.target.value)}
                    />
                </FormControl>

                <FormControl isDisabled={!backendConfig.configured || status.isAuthenticated}>
                    <FormLabel htmlFor="hr-password">Password</FormLabel>
                    <Input
                        id="hr-password"
                        type="password"
                        placeholder="Password"
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                    />
                </FormControl>

                {(localError || status.authError || status.lastSyncError) && (
                    <Alert status="error">
                        <AlertIcon />
                        <AlertDescription>{localError || status.authError || status.lastSyncError}</AlertDescription>
                    </Alert>
                )}

                <HStack spacing={3}>
                    {!status.isAuthenticated ? (
                        <Button
                            onClick={handleLogin}
                            isLoading={isBusy}
                            isDisabled={!backendConfig.configured || !username || !password}
                        >
                            Sign in
                        </Button>
                    ) : (
                        <>
                            <Button onClick={handleLogout} isLoading={isBusy} variant="outline">
                                Sign out
                            </Button>
                            <Button onClick={handleSyncNow} isLoading={isBusy} variant="outline">
                                Sync now
                            </Button>
                        </>
                    )}
                </HStack>

                <Box fontSize="sm" color="gray.500">
                    <Text>Employee: {status.username || 'Not signed in'}</Text>
                    <Text>Last sync: {formatTimestamp(status.lastSyncAt)}</Text>
                    <Text>Session start: {formatTimestamp(status.sessionCheckedInAt)}</Text>
                </Box>
            </VStack>
        </CardBox>
    );
};
