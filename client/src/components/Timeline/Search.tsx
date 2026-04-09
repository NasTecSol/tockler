import { Box, Button, Tooltip, useToast } from '@chakra-ui/react';
import { OnDatesChangeProps } from '@datepicker-react/hooks';
import { DateTime } from 'luxon';
import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { AiOutlineLeft, AiOutlineRight } from 'react-icons/ai';
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

    const showCheckToast = (isCheckedIn: boolean) => {
        toast({
            title: isCheckedIn ? 'Checked in' : 'Checked out',
            status: isCheckedIn ? 'success' : 'info',
            duration: 2000,
            isClosable: true,
            position: 'top',
        });
    };

    useEffect(() => {
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
    }, [getDeviceIpCandidate, getErrorDescription, isSubmittingCheck, liveView, setLiveView, toast]);

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
                <Box p={1}>
                    <Tooltip placement="bottom" label={liveView ? 'Check-Out' : 'Check-In'}>
                        <Button
                            onClick={toggleCheckInOut}
                            colorScheme={liveView ? 'green' : 'red'}
                            isLoading={isSubmittingCheck}
                        >
                            {checkButtonLabel}
                        </Button>
                    </Tooltip>
                </Box>
            )}
        </>
    );
});
