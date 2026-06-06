import { dbClient } from '../drizzle/dbClient';
import { TrackItem } from '../drizzle/schema';
import { State } from '../enums/state';
import { TrackItemType } from '../enums/track-item-type';
import { config } from '../utils/config';
import { logManager } from '../utils/log-manager';

const logger = logManager.getLogger('HrSyncService');

let syncInterval: NodeJS.Timeout | null = null;
const SYNC_INTERVAL_MS = parseInt(process.env.VITE_SYNC_INTERVAL_MS || '300000', 10);

export function initHrSyncJob() {
    logger.info('Initializing HR sync job...');
    
    // Default to the correct HR backend URL (from vite/electron environment)
    const backendUrl = process.env.VITE_HR_BACKEND_URL || process.env.HR_BACKEND_URL || 'https://www.nashrms.com';
    logger.info(`HR sync job target backend URL resolved to: ${backendUrl}`);

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

function mergeTrackItems(items: TrackItem[]): TrackItem[] {
    if (items.length === 0) return [];

    // Group items by taskName, app, title, url
    const groups: Record<string, TrackItem[]> = {};
    for (const item of items) {
        const key = `${item.taskName || ''}_${item.app || ''}_${item.title || ''}_${item.url || ''}`;
        if (!groups[key]) {
            groups[key] = [];
        }
        groups[key].push(item);
    }

    const mergedItems: TrackItem[] = [];

    for (const key of Object.keys(groups)) {
        const groupItems = groups[key];
        
        // Sort items by beginDate
        groupItems.sort((a, b) => a.beginDate - b.beginDate);

        const mergedGroup: TrackItem[] = [];
        let current = { ...groupItems[0] }; // Clone to avoid unexpected mutations

        for (let i = 1; i < groupItems.length; i++) {
            const next = groupItems[i];
            
            // If they overlap or are contiguous (within a 5-second threshold)
            const THRESHOLD_MS = 5000; 
            if (next.beginDate <= current.endDate + THRESHOLD_MS) {
                // Merge next into current
                current.endDate = Math.max(current.endDate, next.endDate);
            } else {
                mergedGroup.push(current);
                current = { ...next };
            }
        }
        mergedGroup.push(current);
        mergedItems.push(...mergedGroup);
    }

    // Sort back by beginDate to maintain chronological order
    return mergedItems.sort((a, b) => a.beginDate - b.beginDate);
}

function getLocalDateString(timestamp: number): string {
    const date = new Date(timestamp);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function getLocalDayRange(dateStr: string) {
    const parts = dateStr.split('-');
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10);
    const day = parseInt(parts[2], 10);

    const start = new Date(year, month - 1, day, 0, 0, 0, 0);
    const end = new Date(year, month - 1, day, 23, 59, 59, 999);

    return {
        startISO: start.toISOString(),
        endISO: end.toISOString()
    };
}

async function performSync(backendUrl: string) {
    const empId = config.persisted.get('empId');
    const tenantId = config.persisted.get('tenantId');
    const token = config.persisted.get('token');

    if (!empId || !tenantId || !token) {
        logger.debug('HR Sync aborted: Missing authentication (empId, tenantId, or token).');
        return;
    }

    let lastSyncedId = config.persisted.get('lastSyncedId') || 0;
    const fetchLimit = 200; // Increased limit per chunk
    let hasMore = true;
    let totalSynced = 0;
    const syncedDates = new Set<string>();

    while (hasMore) {
        const newItems = await dbClient.findItemsByIdGreaterThan(lastSyncedId, fetchLimit);

        if (!newItems || newItems.length === 0) {
            logger.debug('HR Sync: No new items to sync.');
            break;
        }

        // Group the fetched items by their local date to prevent mismatching dates on the server
        const itemsByDate: Record<string, TrackItem[]> = {};
        for (const item of newItems) {
            const dateStr = getLocalDateString(item.beginDate);
            if (!itemsByDate[dateStr]) {
                itemsByDate[dateStr] = [];
            }
            itemsByDate[dateStr].push(item);
        }

        // Sync each date group separately to the correct date endpoint
        for (const dateStr of Object.keys(itemsByDate)) {
            syncedDates.add(dateStr);
            const dateItems = itemsByDate[dateStr];
            
            // Merge/deduplicate items to optimize data transfer and prevent server database bloat
            const mergedItems = mergeTrackItems(dateItems);

            // Prepare the payload
            const payload = {
                activitySession: mergedItems
            };

            const syncUrl = `${backendUrl}/api/activity-session/sync-session/${dateStr}/${empId}`;
            
            logger.info(`HR Sync: Attempting to sync ${mergedItems.length} merged items (from ${dateItems.length} raw) for date ${dateStr} to ${syncUrl}`);

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
        }

        // Successfully synced this chunk, update lastSyncedId
        const maxSyncedId = newItems[newItems.length - 1].id;
        config.persisted.set('lastSyncedId', maxSyncedId);
        lastSyncedId = maxSyncedId;
        totalSynced += newItems.length;

        logger.info(`HR Sync: Successfully synced up to item ID ${maxSyncedId}`);

        // If we got fewer items than fetchLimit, we hit the end of the new items
        if (newItems.length < fetchLimit) {
            hasMore = false;
        }
    }

    if (totalSynced > 0) {
        // Update the activity summary (body) for each day we synced data for
        for (const dateStr of syncedDates) {
            try {
                await updateActivitySummary(backendUrl, dateStr, empId, tenantId, token);
            } catch (error) {
                logger.error(`HR Sync: Failed to update activity summary for ${dateStr}: ` + (error instanceof Error ? error.message : String(error)));
            }
        }

        // Prune synced items older than recentDaysCount settings to avoid local database bloat
        try {
            const dataSettings = await dbClient.fetchDataSettings();
            const retentionDays = dataSettings.recentDaysCount || 7;
            const pruneBeforeTime = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
            const currentLastSyncedId = config.persisted.get('lastSyncedId') || 0;
            await dbClient.pruneSyncedItems(currentLastSyncedId, pruneBeforeTime);
            logger.info(`HR Sync: Pruned synced items older than ${retentionDays} days.`);
        } catch (error) {
            logger.error('HR Sync: Failed to prune old track items: ' + (error instanceof Error ? error.message : String(error)));
        }
    }
}

async function updateActivitySummary(backendUrl: string, currentDate: string, empId: string, tenantId: string, token: string) {
    const { startISO, endISO } = getLocalDayRange(currentDate);

    const allDayItems = await dbClient.findAllDayItemsForAllTypesDb(
        startISO,
        endISO
    );

    if (!allDayItems || allDayItems.length === 0) {
        return;
    }

    // Deduplicate allDayItems before calculating active hours to prevent duplicate listener accumulation artifacts
    const mergedAllDayItems = mergeTrackItems(allDayItems);
    const body = calculateActivitySummary(mergedAllDayItems);
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
        logger.error(`HR Sync: Failed to update activity summary for ${currentDate}. Server responded with ${response.status}`);
    } else {
        logger.info(`HR Sync: Activity summary updated successfully for ${currentDate}.`);
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
