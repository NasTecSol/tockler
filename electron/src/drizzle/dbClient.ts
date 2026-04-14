import fs from 'fs';
import path from 'path';
import { Worker } from 'worker_threads';

import { config } from '../utils/config';
import { WorkerActionArgs, WorkerActionReturns } from './dbTypes';

const workerFilePath = path.resolve(__dirname, './dbWorker.js');

const outputPath = config.databaseConfig.outputPath;

let migrationsPath = path.resolve(__dirname, 'drizzle', 'migrations');

// Robust path resolution for development and production
if (!fs.existsSync(migrationsPath)) {
    // Try structured path if __dirname is dist-electron
    const distPath = path.resolve(__dirname, 'drizzle', 'migrations');
    // Try source path if running in dev
    const srcPath = path.resolve(__dirname, '..', 'src', 'drizzle', 'migrations');

    console.warn(`...........dbClient::migrationsPath default not found: ${migrationsPath}`);

    if (fs.existsSync(distPath)) {
        migrationsPath = distPath;
        console.warn(`...........dbClient::using dist migrations path: ${migrationsPath}`);
    } else if (fs.existsSync(srcPath)) {
        migrationsPath = srcPath;
        console.warn(`...........dbClient::using src migrations path: ${migrationsPath}`);
    } else {
        console.error('...........dbClient::migrationsPath NOT FOUND ANYWHERE');
    }
} else {
    console.warn(`...........dbClient::found migrations path: ${migrationsPath}`);
}

const worker = new Worker(workerFilePath, {
    workerData: {
        outputPath,
        migrationsPath,
    },
});

let messageId = 0;
const pending = new Map<number, { resolve: Function; reject: Function }>();

worker.on('message', ({ id, result, error }) => {
    console.warn('...........worker.on', id, result, error);
    const cb = pending.get(id);
    if (!cb) return;
    pending.delete(id);
    error ? cb.reject(new Error(error)) : cb.resolve(result);
});

worker.on('error', (err) => {
    console.error('...........worker error', err);
});

worker.on('exit', (code) => {
    if (code !== 0) {
        console.error(`...........worker stopped with exit code ${code}`);
    }
});

function callWorker<K extends keyof WorkerActionArgs>(
    action: K,
    args: WorkerActionArgs[K],
): Promise<WorkerActionReturns[K]> {
    console.warn('...........callWorker', action, args);

    const id = ++messageId;
    return new Promise((resolve, reject) => {
        pending.set(id, { resolve, reject });
        worker.postMessage({ id, action, args });
    });
}

// Proxy client API
export const dbClient: {
    [K in keyof WorkerActionArgs]: (...args: WorkerActionArgs[K]) => Promise<WorkerActionReturns[K]>;
} = new Proxy({} as any, {
    get:
        (_, action: string) =>
        (...args: any[]) =>
            callWorker(action as any, args),
});
