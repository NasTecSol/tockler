import {
    Box,
    Button,
    useToast,
    useColorModeValue,
    Text,
    Icon,
    Flex,
} from '@chakra-ui/react';
import { OnDatesChangeProps } from '@datepicker-react/hooks';
import { DateTime } from 'luxon';
import { memo, useCallback, useEffect, useState, useRef } from 'react';
import { AiOutlineLeft, AiOutlineRight, AiOutlineClockCircle } from 'react-icons/ai';
import { Logger } from '../../logger';
import { getSavedEmpId, getSavedTenant, saveCheckedInStatus, clearEmpId, clearTenant, clearToken, getSavedEmpDbId } from '../../auth/authStorage';
import { useStoreActions, useStoreState } from '../../store/easyPeasy';
import { TIMERANGE_MODE_TODAY } from '../../store/mainStore';
import { fetchCheckInData } from '../../services/attendance.api';
import { ResponseError } from '../../services/response-error';
import { DateRangeInput } from '../Datepicker';
import { getTodayTimerange } from './timeline.utils';

const getDayBefore = (d: DateTime) => d.minus({ days: 1 });
const getDayAfter = (d: DateTime) => d.plus({ days: 1 });

const SYNC_INTERVAL_MS = parseInt(import.meta.env.VITE_SYNC_INTERVAL_MS || '300000', 10);

export const Search = memo(() => {
    const timerange = useStoreState((state) => state.timerange);
    const toast = useToast();

    const timerangeMode = useStoreState((state) => state.timerangeMode);
    const liveView = useStoreState((state) => state.liveView);
    const setLiveView = useStoreActions((actions) => actions.setLiveView);
    const loadTimerange = useStoreActions((actions) => actions.loadTimerange);

    const [currentTime, setCurrentTime] = useState(DateTime.now());

    // Update time every second
    useEffect(() => {
        const interval = setInterval(() => {
            setCurrentTime(DateTime.now());
        }, 1000);
        return () => clearInterval(interval);
    }, []);

    // Poll check-in status from server
    useEffect(() => {
        const empDbId = getSavedEmpDbId();
        const empId = getSavedEmpId();
        const tenant = getSavedTenant();

        console.log('Search component checkStatus mounted. Stored IDs:', { empDbId, empId, tenant });

        const activeId = empDbId || empId;
        if (!activeId || !tenant) {
            console.warn('Skipping checkStatus polling: Missing ID or tenant info.');
            return;
        }

        const checkStatus = async () => {
            try {
                const todayStr = DateTime.now().toFormat('yyyy-LL-dd');
                console.log(`Polling check-in status for ID: ${activeId} on date: ${todayStr}`);
                const records = await fetchCheckInData(activeId, todayStr);
                const isCheckedIn = records.some(entry => entry.checkInTime && !entry.checkOutTime);
                
                setLiveView(isCheckedIn);
                saveCheckedInStatus(isCheckedIn);

                if (window.electronBridge?.sendIpc) {
                    window.electronBridge.sendIpc('check-in-status-changed', isCheckedIn);
                }
            } catch (err) {
                Logger.error('Failed to fetch check-in status:', err);

                if (err instanceof ResponseError && err.response.status === 401) {
                    toast({
                        title: 'Session Expired',
                        description: 'Your session has expired. Please log in again.',
                        status: 'warning',
                        duration: 4000,
                        isClosable: true,
                        position: 'top',
                    });
                    clearEmpId();
                    clearTenant();
                    clearToken();
                    window.location.reload();
                }
            }
        };

        // Check immediately on mount
        checkStatus();

        // Check periodically based on sync interval
        const intervalId = setInterval(checkStatus, SYNC_INTERVAL_MS);

        return () => clearInterval(intervalId);
    }, [setLiveView, toast]);

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

                    <Button
                        cursor="default"
                        _hover={{}}
                        _active={{}}
                        colorScheme={liveView ? 'green' : 'red'}
                        h="40px"
                        borderRadius="lg"
                    >
                        {liveView ? 'Checked-In' : 'Checked-Out'}
                    </Button>
                </Flex>
            )}
        </>
    );
});
