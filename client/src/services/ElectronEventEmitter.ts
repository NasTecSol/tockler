import { Logger } from '../logger';

// Define more specific types for the event data
type EventData = unknown;
type EventListener = (event: EventData, ...args: unknown[]) => void;

interface ElectronBridge {
    invokeIpc: <T = unknown>(channel: string, ...args: unknown[]) => Promise<T>;
    sendIpc: (channel: string, ...args: unknown[]) => void;
    onIpc: (channel: string, listener: EventListener) => void;
    removeListenerIpc: (channel: string, listener: EventListener) => void;
}

function isErrorPayload(value: unknown): value is { error: string } {
    return Boolean(
        value &&
            typeof value === 'object' &&
            'error' in value &&
            typeof (value as { error?: unknown }).error === 'string',
    );
}

// Get the electronBridge at call time, not at module load time
const getElectronBridge = (): ElectronBridge => {
    return (
        (window as unknown as { electronBridge: ElectronBridge }).electronBridge || {
            invokeIpc: async () => ({} as any),
            sendIpc: () => {},
            onIpc: () => {},
            removeListenerIpc: () => {},
        }
    );
};

function send(name: string, ...args: unknown[]): void {
    Logger.debug(`Send event: ${name}`);
    getElectronBridge().sendIpc(name, ...args);
}

function on(name: string, listener: EventListener): void {
    getElectronBridge().onIpc(name, listener);
}

function off(name: string, listener: EventListener): void {
    getElectronBridge().removeListenerIpc(name, listener);
}

async function emit<T = unknown>(name: string, ...args: unknown[]): Promise<T> {
    try {
        Logger.debug(`Emit event: ${name}`);
        const result = await getElectronBridge().invokeIpc<T>(name, ...args);
        if (isErrorPayload(result)) {
            throw new Error(result.error);
        }
        return result;
    } catch (error) {
        console.error('[EventEmitter] emit failed for', name, 'with error:', error);
        throw error;
    }
}

export const ElectronEventEmitter = {
    send,
    on,
    off,
    emit,
};
