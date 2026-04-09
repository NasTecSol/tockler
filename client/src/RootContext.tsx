import { ReactNode, createContext, useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DataSettingsI } from './components/Settings/DataForm.util';
import { WorkSettingsI } from './components/Settings/WorkForm.util';
import { HRAuthStatus, defaultHRAuthStatus } from './components/Settings/HRForm.util';
import { Logger } from './logger';
import { ElectronEventEmitter } from './services/ElectronEventEmitter';
import { fetchDataSettings, fetchWorkSettings, getHRAuthStatus, saveDataSettings, saveWorkSettings } from './services/settings.api';

const defaultWorkSettings: WorkSettingsI = {
    workDayStartTime: '08:30', // not used
    workDayEndTime: '17:00', // not used
    splitTaskAfterIdlingForMinutes: 3, // not used in client, put used in backend
    hoursToWork: 8, // not used
    sessionLength: 50,
    minBreakTime: 5,
    notificationDuration: 10,
    reNotifyInterval: 5,
    smallNotificationsEnabled: true,
};
const defaultDataSettings: DataSettingsI = {
    idleAfterSeconds: 60,
    backgroundJobInterval: 3,
    recentDaysCount: 7,
};

interface RootContextType {
    workSettings: WorkSettingsI;
    updateWorkSettings: (settings: WorkSettingsI) => void;
    dataSettings: DataSettingsI;
    updateDataSettings: (settings: DataSettingsI) => void;
    hrAuthStatus: HRAuthStatus;
}

export const RootContext = createContext<RootContextType>({
    workSettings: defaultWorkSettings,
    updateWorkSettings: () => {},
    dataSettings: defaultDataSettings,
    updateDataSettings: () => {},
    hrAuthStatus: defaultHRAuthStatus,
});

interface RootProviderProps {
    children: ReactNode;
}

export const RootProvider = ({ children }: RootProviderProps) => {
    const navigate = useNavigate();

    const gotoSettingsPage = useCallback(() => {
        Logger.debug('Navigating to settings page');
        navigate('/app/settings');
    }, [navigate]);

    const [workSettings, setWorkSettings] = useState<WorkSettingsI>(defaultWorkSettings);
    const [dataSettings, setDataSettings] = useState<DataSettingsI>(defaultDataSettings);
    const [hrAuthStatus, setHrAuthStatus] = useState<HRAuthStatus>(defaultHRAuthStatus);

    const updateWorkSettings = useCallback((newWorkSettings: WorkSettingsI) => {
        setWorkSettings(newWorkSettings);
        saveWorkSettings(newWorkSettings);
    }, []);

    const updateDataSettings = useCallback((newDataSettings: DataSettingsI) => {
        setDataSettings(newDataSettings);
        saveDataSettings(newDataSettings);
    }, []);

    const loadSettings = useCallback(async () => {
        const newWorkSettings = await fetchWorkSettings();

        if (newWorkSettings) {
            setWorkSettings(newWorkSettings);
        }
        const newDataSettings = await fetchDataSettings();

        if (newDataSettings) {
            setDataSettings(newDataSettings);
        }

        const authStatus = await getHRAuthStatus();
        console.log('[RootContext] Loaded HR Auth Status:', authStatus);
        if (authStatus) {
            setHrAuthStatus(authStatus);
        }
    }, []);

    useEffect(() => {
        loadSettings();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        ElectronEventEmitter.on('WORK_SETTINGS_UPDATED', loadSettings);

        const handleHRStatusChange = (status: any) => {
            setHrAuthStatus(status);
        };
        ElectronEventEmitter.on('HR_AUTH_STATE_CHANGED', handleHRStatusChange);

        return () => {
            ElectronEventEmitter.off('WORK_SETTINGS_UPDATED', loadSettings);
            ElectronEventEmitter.off('HR_AUTH_STATE_CHANGED', handleHRStatusChange);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        ElectronEventEmitter.on('side:preferences', gotoSettingsPage);
        return () => {
            Logger.debug('Clearing eventEmitter');
            ElectronEventEmitter.off('side:preferences', gotoSettingsPage);
        };
    }, [gotoSettingsPage]);

    const defaultContext: RootContextType = {
        workSettings,
        updateWorkSettings,
        dataSettings,
        updateDataSettings,
        hrAuthStatus,
    };

    return <RootContext.Provider value={defaultContext}>{children}</RootContext.Provider>;
};
