import { Button, Flex, Text } from '@chakra-ui/react';
import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { clearEmpId, clearTenant, getSavedEmpId } from '../../auth/authStorage';
import { CardBox } from '../CardBox';

export function AccountSection() {
    const navigate = useNavigate();
    const empId = useMemo(() => getSavedEmpId(), []);

    return (
        <CardBox title="Account" divider w="50%">
            <Flex align="center" justify="space-between" gap={4} py={2}>
                <Text>
                    Logged in employee ID: <b>{empId || '—'}</b>
                </Text>
                <Button
                    colorScheme="red"
                    variant="outline"
                    onClick={() => {
                        clearEmpId();
                        clearTenant();
                        navigate('/app', { replace: true });
                        window.location.reload();
                    }}
                    isDisabled={!empId}
                >
                    Logout
                </Button>
            </Flex>
        </CardBox>
    );
}

