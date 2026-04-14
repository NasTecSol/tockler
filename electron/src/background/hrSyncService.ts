import { dbClient } from '../drizzle/dbClient';
import { TrackItem } from '../drizzle/schema';
import { State } from '../enums/state';
import { TrackItemType } from '../enums/track-item-type';
import { config } from '../utils/config';
import { logManager } from '../utils/log-manager';

const logger = logManager.getLogger('HrSyncService');

let syncInterval: NodeJS.Timeout | null = null;
const SYNC_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

export function initHrSyncJob() {
    logger.info('Initializing HR sync job...');
    
    // Default to the correct HR backend URL (from vite/electron environment)
    const backendUrl = process.env.VITE_HR_BACKEND_URL || process.env.HR_BACKEND_URL || 'https://dev.nashrms.com';

    syncInterval = setInterval(async () => {
        try {
            await performSync(backendUrl);
        } catch (error) {
            logger.error('HR sync job failed: ' + (error instanceof Error ? error.message : String(error)));
        }
    }, SYNC_INTERVAL_MS);
    
    // Also run an initial sync shortly after startup
    setTimeout(async () => {
        try {
            await performSync(backendUrl);
        } catch (error) {
            logger.error('Initial HR sync job failed: ' + (error instanceof Error ? error.message : String(error)));
        }
    }, 10000);
}

async function performSync(backendUrl: string) {
    const empId = config.persisted.get('empId');
    const tenantId = config.persisted.get('tenantId');
    const token = config.persisted.get('token');

    if (!empId || !tenantId || !token) {
        logger.debug('HR Sync aborted: Missing authentication (empId, tenantId, or token).');
        return;
    }

    const lastSyncedId = config.persisted.get('lastSyncedId') || 0;
    const fetchLimit = 100; // Process in batches of 100

    const newItems = await dbClient.findItemsByIdGreaterThan(lastSyncedId, fetchLimit);

    if (!newItems || newItems.length === 0) {
        logger.debug('HR Sync: No new items to sync.');
        return;
    }

    // Format current-date as YYYY-MM-DD
    const currentDate = new Date().toISOString().split('T')[0];

    // Prepare the payload
    const payload = {
        activitySession: newItems
    };

    const syncUrl = `${backendUrl}/api/activity-session/sync-session/${currentDate}/${empId}`;
    
    logger.info(`HR Sync: Attempting to sync ${newItems.length} items to ${syncUrl}`);

    const response = await fetch(syncUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-tenant-id': tenantId,
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
    });

    if (!response.ok) {
        let errText = '';
        try {
            errText = await response.text();
        } catch {
            // Error reading body
        }
        throw new Error(`Server responded with ${response.status}: ${errText}`);
    }

    // Successfully synced, update lastSyncedId to the highest ID processed so it doesn't get synced again
    const maxSyncedId = newItems[newItems.length - 1].id;
    config.persisted.set('lastSyncedId', maxSyncedId);
    
    logger.info(`HR Sync: Successfully synced up to item ID ${maxSyncedId}`);

    // Update the activity summary (body) for the current day
    try {
        await updateActivitySummary(backendUrl, currentDate, empId, tenantId, token);
    } catch (error) {
        logger.error('HR Sync: Failed to update activity summary: ' + (error instanceof Error ? error.message : String(error)));
    }
}

async function updateActivitySummary(backendUrl: string, currentDate: string, empId: string, tenantId: string, token: string) {
    const startOfDay = new Date(currentDate).getTime();
    const endOfDay = startOfDay + 24 * 60 * 60 * 1000 - 1;

    const allDayItems = await dbClient.findAllDayItemsForAllTypesDb(
        new Date(startOfDay).toISOString(),
        new Date(endOfDay).toISOString()
    );

    if (!allDayItems || allDayItems.length === 0) {
        return;
    }

    const body = calculateActivitySummary(allDayItems);
    const updateUrl = `${backendUrl}/api/activity-session/update-body/${currentDate}/${empId}`;

    logger.info(`HR Sync: Updating activity summary via PATCH ${updateUrl}`);

    const response = await fetch(updateUrl, {
        method: 'PATCH',
        headers: {
            'Content-Type': 'application/json',
            'x-tenant-id': tenantId,
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ body })
    });

    if (!response.ok) {
        logger.error(`HR Sync: Failed to update activity summary. Server responded with ${response.status}`);
    } else {
        logger.info('HR Sync: Activity summary updated successfully.');
    }
}

function calculateActivitySummary(items: TrackItem[]) {
    let idleTime = 0;
    let activeTime = 0;
    const appDurations: Record<string, number> = {};
    const taskDurations: Record<string, number> = {};

    items.forEach(item => {
        const duration = item.endDate - item.beginDate;
        if (duration <= 0) return;

        // Status tracking for idle/active time
        if (item.taskName === TrackItemType.StatusTrackItem) {
            if (item.app === State.Online) {
                activeTime += duration;
            } else if (item.app === State.Idle) {
                idleTime += duration;
            }
        }

        // App usage tracking
        if (item.taskName === TrackItemType.AppTrackItem && item.app) {
            appDurations[item.app] = (appDurations[item.app] || 0) + duration;
        }

        // Task tracking
        if (item.taskName === TrackItemType.LogTrackItem && item.title) {
            taskDurations[item.title] = (taskDurations[item.title] || 0) + duration;
        }
    });

    const sortedApps = Object.entries(appDurations).sort((a, b) => b[1] - a[1]);
    const mostUsedApps = sortedApps.slice(0, 5).map(([name]) => name);
    const leastUsedApps = sortedApps.slice(-5).reverse().map(([name]) => name);

    return {
        idleTimeMs: idleTime,
        activeTimeMs: activeTime,
        totalTimeMs: idleTime + activeTime,
        mostUsedApps,
        leastUsedApps,
        taskNameWiseTime: taskDurations,
        listOfAllAppsUsed: Object.keys(appDurations),
        listOfAllTaskNamesUsed: Object.keys(taskDurations)
    };
}

export function cleanupHrSyncJob() {
    if (syncInterval) {
        clearInterval(syncInterval);
        syncInterval = null;
    }
}
