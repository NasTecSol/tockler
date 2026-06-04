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
    Image,
} from '@chakra-ui/react';
import { ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import { NovaLogo } from '../components/Header/NovaLogo';
import { NovaLogoText } from '../components/Header/NovaLogoText';
import { employeeLogin } from '../services/employee-login.api';
import { ResponseError } from '../services/response-error';
import { fetchTenantIdFromDomain, TenantDetails } from '../services/tenant.api';
import {
    getSavedEmpId,
    getSavedTenant,
    getSavedTenantName,
    getSavedTenantLogo,
    saveEmpId,
    saveTenant,
    saveTenantName,
    saveTenantLogo,
    saveToken,
    saveEmpDbId,
} from './authStorage';

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

function decodeJwt(token: string): any {
    try {
        const parts = token.split('.');
        if (parts.length !== 3) return null;
        
        const base64Url = parts[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        
        const jsonPayload = decodeURIComponent(
            window.atob(base64)
                .split('')
                .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
                .join('')
        );

        return JSON.parse(jsonPayload);
    } catch (e) {
        console.error('Failed to decode JWT token:', e);
        return null;
    }
}

export function AuthGate({ children }: { children: ReactNode }) {
    const toast = useToast();

    const [isChecking, setIsChecking] = useState(true);
    const [isAuthed, setIsAuthed] = useState(false);
    const [tenant, setTenant] = useState('');
    const [tenantName, setTenantName] = useState('');
    const [tenantLogo, setTenantLogo] = useState('');
    const [empId, setEmpId] = useState('');
    const [password, setPassword] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<TenantDetails[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [history, setHistory] = useState<TenantDetails[]>([]);
    const [isSearchOpen, setIsSearchOpen] = useState(false);

    useEffect(() => {
        const savedEmpId = getSavedEmpId();
        const savedTenant = getSavedTenant();
        const savedTenantName = getSavedTenantName();
        const savedTenantLogo = getSavedTenantLogo();

        if (savedTenant) {
            setTenant(savedTenant);
            setTenantName(savedTenantName || savedTenant);
            setTenantLogo(savedTenantLogo || '');
            setIsSearchOpen(false);
        } else {
            setIsSearchOpen(true);
        }

        // Load search history
        try {
            const storedHistory = localStorage.getItem('nashr_tenant_search_history');
            if (storedHistory) {
                const parsed = JSON.parse(storedHistory);
                setHistory(Array.isArray(parsed) ? parsed.slice(0, 2) : []);
            }
        } catch {
            // ignore
        }

        if (savedEmpId && savedTenant) {
            setIsAuthed(true);
        }
        setIsChecking(false);
    }, []);

    const selectTenantItem = useCallback((item: TenantDetails) => {
        const idStr = String(item.tenantId);
        setTenant(idStr);
        setTenantName(item.tenantName);
        setTenantLogo(item.tenantLogo || '');
        setIsSearchOpen(false);

        // Save to history
        setHistory((prev) => {
            const filtered = prev.filter((t) => String(t.tenantId) !== idStr);
            const updated = [item, ...filtered].slice(0, 2); // limit to 2
            localStorage.setItem('nashr_tenant_search_history', JSON.stringify(updated));
            return updated;
        });

        // Save to active storage
        saveTenant(idStr);
        saveTenantName(item.tenantName);
        saveTenantLogo(item.tenantLogo || '');
    }, []);

    const handleSearch = useCallback(async (queryStr: string) => {
        const trimmed = queryStr.trim();
        if (trimmed.length === 0) return;

        setIsSearching(true);
        try {
            const details = await fetchTenantIdFromDomain(trimmed);
            setSearchResults([details]);
        } catch (err) {
            toast({
                title: 'Search failed',
                description: err instanceof Error ? err.message : 'Tenant not found',
                status: 'error',
                duration: 4000,
                isClosable: true,
            });
            setSearchResults([]);
        } finally {
            setIsSearching(false);
        }
    }, [toast]);

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

            console.log('Login successful response:', responseData);

            saveTenant(tenant.trim());
            saveTenantName(tenantName);
            saveTenantLogo(tenantLogo);
            saveEmpId(empId.trim());

            const tokenValue = responseData?.data?.token || responseData?.token;
            if (tokenValue) {
                saveToken(tokenValue);

                // Decode token to extract MongoDB employee _id
                const decoded = decodeJwt(tokenValue);
                console.log('Decoded JWT payload:', decoded);
                
                const employeeDbId = decoded?._id || decoded?.id || decoded?.employeeId || decoded?.user?._id || decoded?.employee?._id || decoded?.sub;
                if (employeeDbId) {
                    saveEmpDbId(employeeDbId);
                } else {
                    console.warn('Employee DB ID (_id) not found in decoded JWT token claims:', decoded);
                }
            } else {
                console.warn('Authentication token not found in login response:', responseData);
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
    }, [canSubmit, empId, password, tenant, tenantName, tenantLogo, toast]);

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
                    <FormControl isRequired={!tenant}>
                        <FormLabel fontSize="sm" fontWeight="bold">Tenant</FormLabel>
                        {tenant && !isSearchOpen ? (
                            <Flex
                                align="center"
                                justify="space-between"
                                p={3}
                                bg={useColorModeValue('white', 'gray.800')}
                                border="1px solid"
                                borderColor={useColorModeValue('gray.200', 'gray.700')}
                                borderRadius="lg"
                                shadow="sm"
                                w="full"
                            >
                                <Flex align="center" gap={3}>
                                    {tenantLogo ? (
                                        <Image
                                            src={tenantLogo}
                                            alt={tenantName}
                                            h="32px"
                                            w="32px"
                                            objectFit="contain"
                                            fallbackSrc="https://placehold.co/32x32?text=T"
                                        />
                                    ) : (
                                        <Flex
                                            h="32px"
                                            w="32px"
                                            align="center"
                                            justify="center"
                                            bg="cyan.500"
                                            color="white"
                                            borderRadius="md"
                                            fontWeight="bold"
                                            fontSize="sm"
                                        >
                                            {tenantName.charAt(0).toUpperCase()}
                                        </Flex>
                                    )}
                                    <Box>
                                        <Text fontWeight="semibold" fontSize="sm" color={useColorModeValue('gray.800', 'white')}>
                                            {tenantName}
                                        </Text>
                                        <Text fontSize="xs" color="gray.500">
                                            ID: {tenant}
                                        </Text>
                                    </Box>
                                </Flex>
                                <Button
                                    size="xs"
                                    colorScheme="cyan"
                                    variant="ghost"
                                    onClick={() => setIsSearchOpen(true)}
                                >
                                    Change
                                </Button>
                            </Flex>
                        ) : (
                            <VStack align="stretch" spacing={3} w="full">
                                <Flex gap={2}>
                                    <Input
                                        placeholder="Search Organization.."
                                        variant="filled"
                                        bg={useColorModeValue('white', 'gray.800')}
                                        _focus={{ bg: useColorModeValue('white', 'gray.700'), borderColor: 'cyan.500' }}
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                e.preventDefault();
                                                handleSearch(searchQuery);
                                            }
                                        }}
                                        autoFocus
                                    />
                                    <Button
                                        colorScheme="cyan"
                                        isLoading={isSearching}
                                        onClick={() => handleSearch(searchQuery)}
                                    >
                                        Search
                                    </Button>
                                </Flex>

                                {(searchResults.length > 0 || history.length > 0) && (
                                    <Box
                                        maxH="200px"
                                        overflowY="auto"
                                        border="1px solid"
                                        borderColor={useColorModeValue('gray.200', 'gray.700')}
                                        borderRadius="lg"
                                        bg={useColorModeValue('white', 'gray.800')}
                                        p={1}
                                        shadow="md"
                                        zIndex={10}
                                    >
                                        {searchResults.length > 0 && (
                                            <Box mb={2}>
                                                <Text px={3} py={1} fontSize="xs" fontWeight="bold" color="cyan.500">
                                                    Search Result
                                                </Text>
                                                {searchResults.map((item) => (
                                                    <Flex
                                                        key={item.tenantId}
                                                        align="center"
                                                        justify="space-between"
                                                        p={2}
                                                        mx={1}
                                                        my={0.5}
                                                        borderRadius="md"
                                                        _hover={{ bg: useColorModeValue('gray.100', 'gray.700'), cursor: 'pointer' }}
                                                        onClick={() => selectTenantItem(item)}
                                                    >
                                                        <Flex align="center" gap={3}>
                                                            {item.tenantLogo ? (
                                                                <Image
                                                                    src={item.tenantLogo}
                                                                    alt={item.tenantName}
                                                                    h="24px"
                                                                    w="24px"
                                                                    objectFit="contain"
                                                                />
                                                            ) : (
                                                                <Flex
                                                                    h="24px"
                                                                    w="24px"
                                                                    align="center"
                                                                    justify="center"
                                                                    bg="gray.500"
                                                                    color="white"
                                                                    borderRadius="sm"
                                                                    fontSize="xs"
                                                                    fontWeight="bold"
                                                                >
                                                                    {item.tenantName.charAt(0).toUpperCase()}
                                                                </Flex>
                                                            )}
                                                            <Box>
                                                                <Text fontSize="sm" fontWeight="medium">
                                                                    {item.tenantName}
                                                                </Text>
                                                                <Text fontSize="xs" color="gray.500">
                                                                    ID: {item.tenantId}
                                                                </Text>
                                                            </Box>
                                                        </Flex>
                                                    </Flex>
                                                ))}
                                            </Box>
                                        )}

                                        {history.length > 0 && (
                                            <Box>
                                                <Text px={3} py={1} fontSize="xs" fontWeight="bold" color="gray.500">
                                                    Recent Tenants
                                                </Text>
                                                {history.map((item) => (
                                                    <Flex
                                                        key={item.tenantId}
                                                        align="center"
                                                        justify="space-between"
                                                        p={2}
                                                        mx={1}
                                                        my={0.5}
                                                        borderRadius="md"
                                                        _hover={{ bg: useColorModeValue('gray.100', 'gray.700'), cursor: 'pointer' }}
                                                        onClick={() => selectTenantItem(item)}
                                                    >
                                                        <Flex align="center" gap={3}>
                                                            {item.tenantLogo ? (
                                                                <Image
                                                                    src={item.tenantLogo}
                                                                    alt={item.tenantName}
                                                                    h="24px"
                                                                    w="24px"
                                                                    objectFit="contain"
                                                                />
                                                            ) : (
                                                                <Flex
                                                                    h="24px"
                                                                    w="24px"
                                                                    align="center"
                                                                    justify="center"
                                                                    bg="gray.500"
                                                                    color="white"
                                                                    borderRadius="sm"
                                                                    fontSize="xs"
                                                                    fontWeight="bold"
                                                                >
                                                                    {item.tenantName.charAt(0).toUpperCase()}
                                                                </Flex>
                                                            )}
                                                            <Box>
                                                                <Text fontSize="sm" fontWeight="medium">
                                                                    {item.tenantName}
                                                                </Text>
                                                                <Text fontSize="xs" color="gray.500">
                                                                    ID: {item.tenantId}
                                                                </Text>
                                                            </Box>
                                                        </Flex>
                                                        {tenant === String(item.tenantId) && (
                                                            <Box color="cyan.500" pr={2}>
                                                                ✓
                                                            </Box>
                                                        )}
                                                    </Flex>
                                                ))}
                                            </Box>
                                        )}
                                    </Box>
                                )}
                                {tenant && (
                                    <Button
                                        size="xs"
                                        variant="link"
                                        colorScheme="gray"
                                        onClick={() => setIsSearchOpen(false)}
                                        alignSelf="flex-end"
                                    >
                                        Cancel
                                    </Button>
                                )}
                            </VStack>
                        )}
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
