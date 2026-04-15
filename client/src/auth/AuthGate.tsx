import {
    Box,
    Button,
    Flex,
    FormControl,
    FormLabel,
    Input,
    Text,
    useColorModeValue,
    useToast,
    VStack,
} from '@chakra-ui/react';
import { ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import { NovaLogo } from '../components/Header/NovaLogo';
import { NovaLogoText } from '../components/Header/NovaLogoText';
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
        <Flex
            minH="100vh"
            align="center"
            justify="center"
            bgGradient={useColorModeValue(
                'linear(to-br, cyan.50, blue.100, purple.50)',
                'linear(to-br, #0f172a, #1e293b, #0f172a)'
            )}
            px={4}
        >
            <Box
                w="full"
                maxW="md"
                p={8}
                backdropFilter="blur(16px)"
                bg={useColorModeValue('rgba(255, 255, 255, 0.7)', 'rgba(23, 25, 35, 0.7)')}
                border="1px solid"
                borderColor={useColorModeValue('rgba(255, 255, 255, 0.4)', 'rgba(255, 255, 255, 0.1)')}
                borderRadius="2xl"
                boxShadow="2xl"
            >
                <VStack spacing={2} mb={8} align="center">
                    <NovaLogo boxSize="60px" />
                    <NovaLogoText fontSize="2xl" />
                    <Text fontSize="sm" color={useColorModeValue('gray.600', 'gray.400')} fontWeight="medium">
                        Focus on what matters.
                    </Text>
                </VStack>

                <VStack spacing={5}>
                    <FormControl isRequired>
                        <FormLabel fontSize="sm" fontWeight="bold">Tenant Code</FormLabel>
                        <Input
                            placeholder="Enter tenant code"
                            variant="filled"
                            bg={useColorModeValue('white', 'gray.800')}
                            _focus={{ bg: useColorModeValue('white', 'gray.700'), borderColor: 'cyan.500' }}
                            value={tenant}
                            onChange={(e) => setTenant(e.target.value)}
                            autoFocus
                        />
                    </FormControl>

                    <FormControl isRequired>
                        <FormLabel fontSize="sm" fontWeight="bold">Emp ID</FormLabel>
                        <Input
                            placeholder="Enter employee ID"
                            variant="filled"
                            bg={useColorModeValue('white', 'gray.800')}
                            _focus={{ bg: useColorModeValue('white', 'gray.700'), borderColor: 'cyan.500' }}
                            value={empId}
                            onChange={(e) => setEmpId(e.target.value)}
                        />
                    </FormControl>

                    <FormControl isRequired>
                        <FormLabel fontSize="sm" fontWeight="bold">Password</FormLabel>
                        <Input
                            placeholder="Enter password"
                            type="password"
                            variant="filled"
                            bg={useColorModeValue('white', 'gray.800')}
                            _focus={{ bg: useColorModeValue('white', 'gray.700'), borderColor: 'cyan.500' }}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    onSubmit();
                                }
                            }}
                        />
                    </FormControl>

                    <Button
                        w="full"
                        size="lg"
                        bgGradient="linear(to-r, cyan.400, blue.500)"
                        color="white"
                        _hover={{
                            bgGradient: "linear(to-r, cyan.500, blue.600)",
                            boxShadow: 'xl',
                            transform: 'translateY(-1px)'
                        }}
                        _active={{
                            transform: 'translateY(0)',
                        }}
                        isLoading={isSubmitting}
                        isDisabled={!canSubmit}
                        onClick={onSubmit}
                        mt={4}
                    >
                        Sign In
                    </Button>

                    <Text fontSize="xs" color="gray.500" mt={4} textAlign="center">
                        Powered by Nas HR
                    </Text>
                </VStack>
            </Box>
        </Flex>
    );
}

