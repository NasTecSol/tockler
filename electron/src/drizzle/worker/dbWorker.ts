import { parentPort } from 'worker_threads';
import { WorkerActionArgs, WorkerActionReturns, WorkerServices } from '../dbTypes';
import { dbService } from './dbService';
import { appSettingService } from './queries/app-setting-service';
import { settingsService } from './queries/settings-service';
import { trackItemService } from './queries/track-item-service';
import { trackItemDb } from './queries/trackItem.db';

const actions: {
    [K in keyof WorkerServices]: (...args: WorkerActionArgs[K]) => Promise<WorkerActionReturns[K]>;
} = Object.assign({}, trackItemService, appSettingService, settingsService, trackItemDb, dbService);

let isDbReady = false;
const messageQueue: Array<{ msg: { id: number; action: any; args: any }; resolve: (val: any) => void }> = [];

async function processQueue() {
    console.warn('...........dbWorker::processQueue', messageQueue.length);
    while (messageQueue.length > 0) {
        const item = messageQueue.shift();
        if (item) {
            const { msg, resolve } = item;
            try {
                const result = await (actions as any)[msg.action](...msg.args);
                resolve({ id: msg.id, result });
            } catch (error: any) {
                resolve({ id: msg.id, error: error.message });
            }
        }
    }
}

parentPort!.on(
    'message',
    async <K extends keyof WorkerActionArgs>(msg: { id: number; action: K; args: WorkerActionArgs[K] }) => {
        console.warn('...........dbWorker::message', msg);
        const { id, action, args } = msg;

        // Special case for initDb - it must be processed immediately to unblock the rest
        if (action === 'initDb') {
            console.warn('...........dbWorker::initDb starting...');
            try {
                const result = await actions[action](...(args as any));
                isDbReady = true;
                console.warn('...........dbWorker::initDb SUCCESS. Database is ready.');
                parentPort!.postMessage({ id, result });
                await processQueue();
            } catch (error: any) {
                console.error('...........dbWorker::initDb FATAL ERROR:', error);
                parentPort!.postMessage({ id, error: error.message });
            }
            return;
        }

        // If DB is not ready, queue the message
        if (!isDbReady) {
            console.warn(`...........dbWorker::queueing message ${action} while DB is initializing`);
            new Promise((resolve) => {
                messageQueue.push({ msg, resolve });
            }).then((response: any) => {
                parentPort!.postMessage(response);
            });
            return;
        }

        try {
            const result = await actions[action](...(args as any));
            console.warn('...........dbWorker::result', result);
            parentPort!.postMessage({ id, result });
        } catch (error: any) {
            console.warn('...........dbWorker::error', error);
            parentPort!.postMessage({ id, error: error.message });
        }
    },
);
