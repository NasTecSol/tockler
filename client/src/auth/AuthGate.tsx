import {
    Box,
    Button,
    Flex,
    FormControl,
    FormLabel,
    Heading,
    Input,
    Text,
    useColorModeValue,
    useToast,
} from '@chakra-ui/react';
import { ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import { employeeLogin } from '../services/employee-login.api';
import { ResponseError } from '../services/response-error';
import { getSavedEmpId, getSavedTenant, saveEmpId, saveTenant, saveToken } from './authStorage';

function getMacAddressCandidate(): string {
    try {
        const maybeFromConfig = window?.electronBridge?.configGet?.('macAddress');
        if (typeof maybeFromConfig === 'string' && maybeFromConfig.trim().length > 0) {
            return maybeFromConfig.trim();
        }
    } catch {
        // ignore
    }

    return window.location.hostname || '0.0.0.0';
}

async function getResponseErrorMessage(error: ResponseError): Promise<string> {
    try {
        const contentType = error.response.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
            const data = (await error.response.json()) as unknown;
            if (typeof data === 'string') return data;
            if (data && typeof data === 'object') {
                const message = (data as Record<string, unknown>).message;
                if (typeof message === 'string') return message;
            }
            return 'Login failed';
        }
        const text = await error.response.text();
        return text || 'Login failed';
    } catch {
        return 'Login failed';
    }
}

export function AuthGate({ children }: { children: ReactNode }) {
    const toast = useToast();
    const panelBg = useColorModeValue('white', 'gray.800');
    const pageBg = useColorModeValue('gray.50', 'gray.900');
    const borderColor = useColorModeValue('gray.200', 'gray.700');

    const [isChecking, setIsChecking] = useState(true);
    const [isAuthed, setIsAuthed] = useState(false);
    const [tenant, setTenant] = useState('');
    const [empId, setEmpId] = useState('');
    const [password, setPassword] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        const savedEmpId = getSavedEmpId();
        const savedTenant = getSavedTenant();
        if (savedEmpId && savedTenant) {
            setIsAuthed(true);
        }
        setIsChecking(false);
    }, []);

    const canSubmit = useMemo(() => {
        return tenant.trim().length > 0 && empId.trim().length > 0 && password.length > 0 && !isSubmitting;
    }, [tenant, empId, password, isSubmitting]);

    const onSubmit = useCallback(async () => {
        if (!canSubmit) return;

        setIsSubmitting(true);
        try {
            const responseData: any = await employeeLogin({
                tenant: tenant.trim(),
                empId: empId.trim(),
                password,
                macAddress: getMacAddressCandidate(),
            });

            saveTenant(tenant.trim());
            saveEmpId(empId.trim());

            if (responseData?.data?.token) {
                saveToken(responseData.data.token);
            }

            setIsAuthed(true);
            toast({
                title: 'Logged in',
                status: 'success',
                duration: 2000,
                isClosable: true,
            });
        } catch (err) {
            if (err instanceof ResponseError) {
                const message = await getResponseErrorMessage(err);
                toast({
                    title: 'Login failed',
                    description: message,
                    status: 'error',
                    duration: 6000,
                    isClosable: true,
                });
            } else {
                toast({
                    title: 'Login failed',
                    description: err instanceof Error ? err.message : 'Unknown error',
                    status: 'error',
                    duration: 6000,
                    isClosable: true,
                });
            }
        } finally {
            setIsSubmitting(false);
        }
    }, [canSubmit, empId, password, tenant, toast]);

    if (isChecking) return null;
    if (isAuthed) return <>{children}</>;

    return (
        <Flex minH="100vh" align="center" justify="center" bg={pageBg} px={4}>
            <Box
                w="full"
                maxW="md"
                bg={panelBg}
                borderWidth="1px"
                borderColor={borderColor}
                borderRadius="lg"
                p={6}
                boxShadow="lg"
            >
                <Heading size="md" mb={1}>
                    Sign in
                </Heading>
                <Text fontSize="sm" color="gray.500" mb={6}>
                    Enter your tenant and employee credentials to continue.
                </Text>

                <FormControl mb={4} isRequired>
                    <FormLabel>Tenant</FormLabel>
                    <Input value={tenant} onChange={(e) => setTenant(e.target.value)} autoFocus />
                </FormControl>

                <FormControl mb={4} isRequired>
                    <FormLabel>Emp ID</FormLabel>
                    <Input value={empId} onChange={(e) => setEmpId(e.target.value)} />
                </FormControl>

                <FormControl mb={6} isRequired>
                    <FormLabel>Password</FormLabel>
                    <Input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                onSubmit();
                            }
                        }}
                    />
                </FormControl>

                <Button w="full" colorScheme="blue" isLoading={isSubmitting} isDisabled={!canSubmit} onClick={onSubmit}>
                    Login
                </Button>
            </Box>
        </Flex>
    );
}

