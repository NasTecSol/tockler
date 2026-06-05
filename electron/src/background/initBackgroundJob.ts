import { dbClient } from '../drizzle/dbClient';
import { logManager } from '../utils/log-manager';
import { watchForBreakNotification, watchForBreakNotificationCleanup } from './watchBreak/watchForBreakNotification';
import { watchAndPropagateState, watchAndPropagateStateCleanup } from './watchStates/watchAndPropagateState';
import { watchForIdleState, watchForIdleStateCleanup } from './watchStates/watchForIdleState';
import { watchForPowerState, watchForPowerStateCleanup } from './watchStates/watchForPowerState';
import { watchAndSetAppTrackItem, watchAndSetAppTrackItemCleanup } from './watchTrackItems/watchAndSetAppTrackItem';
import { watchAndSetLogTrackItem, watchAndSetLogTrackItemCleanup } from './watchTrackItems/watchAndSetLogTrackItem';
import {
    watchAndSetStatusTrackItem,
    watchAndSetStatusTrackItemCleanup,
} from './watchTrackItems/watchAndSetStatusTrackItem';
import { cleanupHrSyncJob, initHrSyncJob } from './hrSyncService';

let logger = logManager.getLogger('BackgroundJob');
let isRunning = false;

export async function initBackgroundJob() {
    if (isRunning) {
        logger.info('Background job is already running. Skipping initialization.');
        return;
    }
    logger.debug('Init background service.');
    isRunning = true;

    const dataSettings = await dbClient.fetchDataSettings();
    logger.debug('With settings:', dataSettings);

    const { idleAfterSeconds, backgroundJobInterval } = dataSettings;

    watchForIdleState(idleAfterSeconds);
    watchForPowerState();
    watchAndPropagateState();

    watchAndSetStatusTrackItem();
    watchAndSetAppTrackItem(backgroundJobInterval);
    watchAndSetLogTrackItem();

    watchForBreakNotification();

    initHrSyncJob();
}

export async function cleanupBackgroundJob() {
    if (!isRunning) {
        logger.info('Background job is not running. Skipping cleanup.');
        return;
    }
    logger.debug('Cleaning up background job');
    isRunning = false;

    watchForIdleStateCleanup();
    watchForPowerStateCleanup();
    watchAndPropagateStateCleanup();

    await watchAndSetStatusTrackItemCleanup();
    await watchAndSetAppTrackItemCleanup();
    await watchAndSetLogTrackItemCleanup();

    watchForBreakNotificationCleanup();

    cleanupHrSyncJob();
}
