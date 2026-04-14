import { dbClient } from '../drizzle/dbClient';
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
}

export function cleanupHrSyncJob() {
    if (syncInterval) {
        clearInterval(syncInterval);
        syncInterval = null;
    }
}
