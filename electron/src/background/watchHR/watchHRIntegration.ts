import { getCurrentState } from '../watchStates/watchAndPropagateState';
import { hrIntegrationService } from '../../hr/hrService';
import { State } from '../../enums/state';
import { appEmitter } from '../../utils/appEmitter';
import { logManager } from '../../utils/log-manager';

const logger = logManager.getLogger('watchHRIntegration');

let stateChangedHandler: ((state: State) => Promise<void>) | null = null;

export async function watchHRIntegration(syncIntervalSeconds: number) {
    logger.debug('Initializing HR integration watcher');

    hrIntegrationService.start(syncIntervalSeconds);

    if (stateChangedHandler) {
        appEmitter.removeListener('state-changed', stateChangedHandler);
    }

    stateChangedHandler = async (state: State) => {
        await hrIntegrationService.handleStateChange(state);
    };

    appEmitter.on('state-changed', stateChangedHandler);

    await hrIntegrationService.handleStateChange(getCurrentState());
    await hrIntegrationService.syncNow();
}

export async function watchHRIntegrationCleanup() {
    logger.debug('Cleaning up HR integration watcher');

    if (stateChangedHandler) {
        appEmitter.removeListener('state-changed', stateChangedHandler);
        stateChangedHandler = null;
    }

    await hrIntegrationService.stop();
}
