import {
    Box,
    Button,
    Tooltip,
    useToast,
    AlertDialog,
    AlertDialogBody,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogContent,
    AlertDialogOverlay,
    useDisclosure,
    useColorModeValue,
    Text,
    VStack,
    Icon,
    Flex,
    Divider,
} from '@chakra-ui/react';
import { OnDatesChangeProps } from '@datepicker-react/hooks';
import { DateTime } from 'luxon';
import { memo, useCallback, useEffect, useMemo, useState, useRef } from 'react';
import { AiOutlineLeft, AiOutlineRight, AiOutlineCheckCircle, AiOutlineLogout, AiOutlineClockCircle } from 'react-icons/ai';
import { Logger } from '../../logger';
import { getSavedEmpId, getSavedTenant } from '../../auth/authStorage';
import { useStoreActions, useStoreState } from '../../store/easyPeasy';
import { TIMERANGE_MODE_TODAY } from '../../store/mainStore';
import { sendZkTecoClientEvent } from '../../services/zktecoClient.api';
import { ResponseError } from '../../services/response-error';
import { DateRangeInput } from '../Datepicker';
import { getTodayTimerange } from './timeline.utils';

const getDayBefore = (d: DateTime) => d.minus({ days: 1 });
const getDayAfter = (d: DateTime) => d.plus({ days: 1 });

export const Search = memo(() => {
    const timerange = useStoreState((state) => state.timerange);
    const toast = useToast();

    const timerangeMode = useStoreState((state) => state.timerangeMode);
    const liveView = useStoreState((state) => state.liveView);
    const setLiveView = useStoreActions((actions) => actions.setLiveView);
    const loadTimerange = useStoreActions((actions) => actions.loadTimerange);

    const { isOpen, onOpen, onClose } = useDisclosure();
    const cancelRef = useRef<HTMLButtonElement>(null);
    const [currentTime, setCurrentTime] = useState(DateTime.now());

    // Update time every second
    useEffect(() => {
        const interval = setInterval(() => {
            setCurrentTime(DateTime.now());
        }, 1000);
        return () => clearInterval(interval);
    }, []);

    const getErrorDescription = useCallback(async (err: unknown): Promise<string> => {
        if (err instanceof ResponseError) {
            try {
                const contentType = err.response.headers.get('content-type') || '';
                if (contentType.includes('application/json')) {
                    const data = (await err.response.json()) as unknown;
                    if (typeof data === 'string') return `${err.response.status}: ${data}`;
                    if (data && typeof data === 'object') {
                        const message = (data as Record<string, unknown>).message;
                        if (typeof message === 'string') return `${err.response.status}: ${message}`;
                    }
                    return `${err.response.status}: Request failed`;
                }
                const text = await err.response.text();
                return text ? `${err.response.status}: ${text}` : `${err.response.status}: Request failed`;
            } catch {
                return `${err.response.status}: Request failed`;
            }
        }

        if (err instanceof Error) return err.message;
        return 'Unknown error';
    }, []);

    const showCheckToast = useCallback((isCheckedIn: boolean) => {
        toast({
            title: isCheckedIn ? 'Checked in' : 'Checked out',
            status: isCheckedIn ? 'success' : 'info',
            duration: 2000,
            isClosable: true,
            position: 'top',
        });
    }, [toast]);

    const isFirstRender = useRef(true);
    useEffect(() => {
        if (isFirstRender.current) {
            isFirstRender.current = false;
            return;
        }
        if (timerangeMode === TIMERANGE_MODE_TODAY) {
            showCheckToast(liveView);
        }
    }, [liveView, showCheckToast, timerangeMode]);

    const showLiveViewButton = timerangeMode === TIMERANGE_MODE_TODAY;

    const [isSubmittingCheck, setIsSubmittingCheck] = useState(false);

    const checkButtonLabel = useMemo(() => {
        return liveView ? 'Check-Out' : 'Check-In';
    }, [liveView]);

    const getDeviceIpCandidate = useCallback((): string => {
        try {
            const maybeFromConfig = window?.electronBridge?.configGet?.('deviceIp');
            if (typeof maybeFromConfig === 'string' && maybeFromConfig.trim().length > 0) {
                return maybeFromConfig.trim();
            }
        } catch {
            // ignore
        }
        return window.location.hostname || '0.0.0.0';
    }, []);

    const toggleCheckInOut = useCallback(async () => {
        if (isSubmittingCheck) return;

        const empId = getSavedEmpId();
        if (!empId) {
            toast({
                title: 'Not logged in',
                description: 'Please login first.',
                status: 'error',
                duration: 3000,
                isClosable: true,
                position: 'top',
            });
            return;
        }
        const tenant = getSavedTenant();
        if (!tenant) {
            toast({
                title: 'Tenant missing',
                description: 'Please login again.',
                status: 'error',
                duration: 3000,
                isClosable: true,
                position: 'top',
            });
            return;
        }

        const nextLiveView = !liveView;
        setIsSubmittingCheck(true);
        try {
            await sendZkTecoClientEvent({
                tenant,
                timestamp: DateTime.now().toFormat('yyyy-LL-dd HH:mm:ss'),
                deviceUserId: empId,
                sn: '111',
                status: '1',
                verify_type: '0',
                deviceIp: getDeviceIpCandidate(),
                deviceName: 'Remote',
                timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
            });

            setLiveView(nextLiveView);
            onClose();

            Logger.debug(`User toggled check state to: ${nextLiveView ? 'checked-in' : 'checked-out'}`);
        } catch (err) {
            const description = await getErrorDescription(err);
            toast({
                title: 'Check-In/Out failed',
                description,
                status: 'error',
                duration: 6000,
                isClosable: true,
                position: 'top',
            });
        } finally {
            setIsSubmittingCheck(false);
        }
    }, [getDeviceIpCandidate, getErrorDescription, isSubmittingCheck, liveView, setLiveView, toast, onClose]);

    const handleOnDatesChange = (data: OnDatesChangeProps) => {
        Logger.debug('TIMERANGE:', data);

        const { startDate, endDate } = data;

        if (!startDate || !endDate) {
            console.error('NO startDate or endDate');
            return;
        }
        const newTimerange = [DateTime.fromJSDate(startDate).startOf('day'), DateTime.fromJSDate(endDate).endOf('day')];
        loadTimerange(newTimerange);
    };

    const selectToday = () => {
        loadTimerange(getTodayTimerange());
    };

    const selectYesterday = () => {
        const beginDate = getDayBefore(DateTime.now().startOf('day'));
        const endDate = getDayBefore(DateTime.now().endOf('day'));
        loadTimerange([beginDate, endDate]);
    };

    const goBackOneDay = () => {
        const beginDate = getDayBefore(timerange[0]);
        const endDate = getDayBefore(timerange[1]);
        loadTimerange([beginDate, endDate]);
    };

    const goForwardOneDay = () => {
        const beginDate = getDayAfter(timerange[0]);
        const endDate = getDayAfter(timerange[1]);
        loadTimerange([beginDate, endDate]);
    };

    const isYesterday = DateTime.now().minus({ days: 1 }).hasSame(timerange[1], 'day');

    return (
        <>
            <Box p={1}>
                <Button onClick={selectYesterday} variant={isYesterday ? 'solid' : 'outline'}>
                    Yesterday
                </Button>
            </Box>
            <Box p={1}>
                <Button onClick={goBackOneDay} variant="outline">
                    <AiOutlineLeft />
                </Button>
            </Box>
            <Box p={1}>
                <DateRangeInput
                    startDate={timerange[0].toJSDate()}
                    endDate={timerange[1].toJSDate()}
                    onDatesChange={handleOnDatesChange}
                />
            </Box>
            <Box p={1}>
                <Button onClick={goForwardOneDay} variant="outline">
                    <AiOutlineRight />
                </Button>
            </Box>
            <Box p={1}>
                <Button onClick={selectToday} variant={showLiveViewButton ? 'solid' : 'outline'}>
                    Today
                </Button>
            </Box>
            {showLiveViewButton && (
                <Flex p={1} align="center">
                    <Flex
                        align="center"
                        bg={useColorModeValue('gray.50', 'gray.800')}
                        px={3}
                        h="40px"
                        borderRadius="lg"
                        borderWidth="1px"
                        borderColor={useColorModeValue('gray.200', 'gray.700')}
                        mr={2}
                        boxShadow="sm"
                    >
                        <Icon as={AiOutlineClockCircle} mr={2} color={liveView ? 'green.500' : 'red.500'} />
                        <Text fontSize="md" fontWeight="bold" fontFamily="mono" letterSpacing="wider">
                            {currentTime.toFormat('HH:mm:ss')}
                        </Text>
                    </Flex>

                    <Tooltip placement="bottom" label={liveView ? 'Check-Out' : 'Check-In'}>
                        <Button
                            onClick={onOpen}
                            colorScheme={liveView ? 'green' : 'red'}
                            isLoading={isSubmittingCheck}
                            h="40px"
                            borderRadius="lg"
                        >
                            {checkButtonLabel}
                        </Button>
                    </Tooltip>
                </Flex>
            )}

            <AlertDialog
                isOpen={isOpen}
                leastDestructiveRef={cancelRef}
                onClose={onClose}
                isCentered
                motionPreset="slideInBottom"
            >
                <AlertDialogOverlay backdropFilter="blur(4px)" />
                <AlertDialogContent borderRadius="2xl" overflow="hidden" boxShadow="2xl">
                    <AlertDialogHeader
                        fontSize="lg"
                        fontWeight="bold"
                        bg={liveView ? 'green.500' : 'red.500'}
                        color="white"
                        display="flex"
                        alignItems="center"
                    >
                        <Icon as={liveView ? AiOutlineLogout : AiOutlineCheckCircle} mr={2} />
                        Confirm Attendance {liveView ? 'Check-Out' : 'Check-In'}
                    </AlertDialogHeader>

                    <AlertDialogBody py={6}>
                        <VStack spacing={4} align="center">
                            <Box textAlign="center">
                                <Text fontSize="md" color="gray.500" mb={1}>
                                    Are you sure you want to {liveView ? 'check-out' : 'check-in'}?
                                </Text>
                                <Text fontSize="lg" fontWeight="semibold">
                                    Current Location Instance: Remote
                                </Text>
                            </Box>

                            <Divider />

                            <Flex align="center" direction="column" py={2}>
                                <Flex align="center" mb={1} color={liveView ? 'green.600' : 'red.600'}>
                                    <Icon as={AiOutlineClockCircle} mr={2} />
                                    <Text fontWeight="bold" fontSize="sm" textTransform="uppercase" letterSpacing="wider">
                                        Current Time
                                    </Text>
                                </Flex>
                                <Text fontSize="4xl" fontWeight="black" fontFamily="mono" letterSpacing="tight">
                                    {currentTime.toFormat('HH:mm:ss')}
                                </Text>
                                <Text fontSize="sm" color="gray.500">
                                    {currentTime.toFormat('cccc, d MMMM yyyy')}
                                </Text>
                            </Flex>
                        </VStack>
                    </AlertDialogBody>

                    <AlertDialogFooter bg="gray.50" borderTopWidth="1px">
                        <Button ref={cancelRef} onClick={onClose} variant="ghost" mr={3}>
                            Cancel
                        </Button>
                        <Button
                            colorScheme={liveView ? 'green' : 'red'}
                            onClick={toggleCheckInOut}
                            isLoading={isSubmittingCheck}
                            loadingText="Submitting..."
                            px={8}
                            borderRadius="lg"
                        >
                            Confirm {liveView ? 'Check-Out' : 'Check-In'}
                        </Button>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
});
