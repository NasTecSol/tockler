import { Flex, Box, Link, Image } from '@chakra-ui/react';
import { useColorModeValue } from '@chakra-ui/react';
import logoNassHR from '../../assets/icons/logoNassHR.png';

export const Header = ({ children, brandLinkProps }) => (
    <Flex
        bg={useColorModeValue('gray.100', 'gray.900')}
        w="100%"
        h={50}
        alignItems="center"
        zIndex={100}
        borderBottomWidth={1}
        borderBottomColor={useColorModeValue('gray.300', 'gray.700')}
        position="sticky"
        top={0}
    >
        <Box pl={4} pr={3}>
            <Link {...brandLinkProps} _hover={{ textDecoration: 'none' }}>
                <Flex align="center">
                    <Image
                        src={logoNassHR}
                        alt="Nass HR Logo"
                        h="28px"
                        objectFit="contain"
                    />
                </Flex>
            </Link>
        </Box>
        {children}
    </Flex>
);
