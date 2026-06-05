import { Box } from '@chakra-ui/react';
import { differenceInMilliseconds } from 'date-fns';
import { sumBy } from 'lodash';
import { ITrackItem } from '../../@types/ITrackItem';
import { useStoreState } from '../../store/easyPeasy';
import { checkIfOneDay } from '../../timeline.util';
import { filterItems } from '../Timeline/timeline.utils';
import { ItemsTable } from './ItemsTable';
import { defaultTableButtonsProps } from './TrackItemTable.utils';
import { TrackItemTableButtons } from './TrackItemTableButtons';

export const TrackItemTable = ({ type, resetButtonsRef }) => {
    const timeItems = useStoreState((state) => state.timeItems);
    const visibleTimerange = useStoreState((state) => state.visibleTimerange);

    // Use the first 10 items for the current page (since we're not doing server-side pagination here)
    const data = filterItems(timeItems[type], visibleTimerange);

    const isOneDay = checkIfOneDay(visibleTimerange);

    // Calculate total duration in milliseconds for all the data
    const totalDuration = sumBy(timeItems[type] as ITrackItem[], (trackItem) => {
        return differenceInMilliseconds(trackItem.endDate, trackItem.beginDate);
    });

    return (
        <Box position="relative">
            <ItemsTable
                data={data}
                resetButtonsRef={resetButtonsRef}
                isOneDay={isOneDay}
                isSearchTable={false}
                sumTotal={totalDuration}
                manualSortBy={false}
                customTableButtons={<TrackItemTableButtons {...defaultTableButtonsProps} />}
            />
        </Box>
    );
};
