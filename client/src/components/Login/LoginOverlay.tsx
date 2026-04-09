import {
    Box,
    Button,
    Center,
    FormControl,
    FormLabel,
    Heading,
    Input,
    VStack,
    Text,
    useColorModeValue,
    Alert,
    AlertIcon,
    AlertDescription,
} from '@chakra-ui/react';
import { useState } from 'react';
import { loginToHRBackend } from '../../services/settings.api';

export const LoginOverlay = () => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [isBusy, setIsBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const bgGradient = useColorModeValue(
        'linear(to-br, blue.50, purple.50, pink.50)',
        'linear(to-br, gray.900, blue.900, gray.900)'
    );
    const boxBg = useColorModeValue('white', 'gray.800');
    const borderColor = useColorModeValue('gray.200', 'gray.700');

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsBusy(true);
        setError(null);

        try {
            await loginToHRBackend({ username, password });
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Login failed');
        } finally {
            setIsBusy(false);
        }
    };

    return (
        <Box
            position="fixed"
            top="0"
            left="0"
            right="0"
            bottom="0"
            zIndex="9999"
            bgGradient={bgGradient}
            display="flex"
            alignItems="center"
            justifyContent="center"
        >
            <Box
                position="absolute"
                top="0"
                left="0"
                right="0"
                bottom="0"
                backdropFilter="blur(20px)"
                zIndex="-1"
            />
            <Center h="full" w="full">
                <Box
                    p={10}
                    maxWidth="440px"
                    borderWidth={1}
                    borderColor={borderColor}
                    borderRadius={24}
                    boxShadow="2xl"
                    bg={boxBg}
                    w="90%"
                    position="relative"
                    overflow="hidden"
                >
                    <Box
                        position="absolute"
                        top="-20px"
                        right="-20px"
                        w="100px"
                        h="100px"
                        bg="blue.500"
                        opacity="0.1"
                        borderRadius="full"
                    />
                    
                    <VStack spacing={8} align="stretch" as="form" onSubmit={handleLogin}>
                        <VStack spacing={3} align="center">
                            <Heading size="xl" bgGradient="linear(to-r, blue.400, purple.500)" bgClip="text">
                                Tockler
                            </Heading>
                            <Text color="gray.500" fontWeight="medium">
                                Authentication Required
                            </Text>
                        </VStack>

                        {error && (
                            <Alert status="error" borderRadius={12} variant="subtle">
                                <AlertIcon />
                                <AlertDescription fontSize="sm">{error}</AlertDescription>
                            </Alert>
                        )}

                        <VStack spacing={5}>
                            <FormControl isRequired>
                                <FormLabel fontSize="sm" fontWeight="bold" color="gray.600">Employee ID</FormLabel>
                                <Input
                                    placeholder="e.g. EMP123"
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    borderRadius={12}
                                    size="lg"
                                    focusBorderColor="blue.400"
                                    autoFocus
                                />
                            </FormControl>

                            <FormControl isRequired>
                                <FormLabel fontSize="sm" fontWeight="bold" color="gray.600">Password</FormLabel>
                                <Input
                                    type="password"
                                    placeholder="••••••••"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    borderRadius={12}
                                    size="lg"
                                    focusBorderColor="blue.400"
                                />
                            </FormControl>
                        </VStack>

                        <Button
                            type="submit"
                            colorScheme="blue"
                            size="lg"
                            width="full"
                            isLoading={isBusy}
                            borderRadius={12}
                            height="60px"
                            fontSize="md"
                            fontWeight="bold"
                            boxShadow="0 4px 14px 0 rgba(0, 118, 255, 0.39)"
                            _hover={{
                                transform: 'translateY(-2px)',
                                boxShadow: '0 6px 20px rgba(0, 118, 255, 0.23)',
                            }}
                            _active={{
                                transform: 'translateY(0)',
                            }}
                            transition="all 0.2s"
                        >
                            Sign In
                        </Button>

                        <Text fontSize="xs" color="gray.400" textAlign="center">
                            By signing in, you agree to our terms of service and privacy policy.
                        </Text>
                    </VStack>
                </Box>
            </Center>
        </Box>
    );
};
