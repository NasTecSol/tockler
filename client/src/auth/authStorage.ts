const EMP_ID_STORAGE_KEY = 'nashr_empId';
const TENANT_STORAGE_KEY = 'nashr_tenant';
const TOKEN_STORAGE_KEY = 'nashr_token';

// Helper to push values to the electron main process config store
function pushToElectronBridge(key: string, value: string | null) {
    try {
        if (typeof window !== 'undefined' && window.electronBridge?.configSet) {
            window.electronBridge.configSet(key, value);
        }
    } catch {
        // ignore if electronBridge is not available (e.g. tests or normal browser context)
    }
}

export function getSavedEmpId(): string | null {
    try {
        const empId = localStorage.getItem(EMP_ID_STORAGE_KEY);
        return empId && empId.trim().length > 0 ? empId : null;
    } catch {
        return null;
    }
}

export function saveEmpId(empId: string): void {
    localStorage.setItem(EMP_ID_STORAGE_KEY, empId);
    pushToElectronBridge('empId', empId);
}

export function clearEmpId(): void {
    localStorage.removeItem(EMP_ID_STORAGE_KEY);
    pushToElectronBridge('empId', null);
}

export function getSavedTenant(): string | null {
    try {
        const tenant = localStorage.getItem(TENANT_STORAGE_KEY);
        return tenant && tenant.trim().length > 0 ? tenant : null;
    } catch {
        return null;
    }
}

export function saveTenant(tenant: string): void {
    localStorage.setItem(TENANT_STORAGE_KEY, tenant);
    pushToElectronBridge('tenantId', tenant);
}

export function clearTenant(): void {
    localStorage.removeItem(TENANT_STORAGE_KEY);
    pushToElectronBridge('tenantId', null);
}

export function getSavedToken(): string | null {
    try {
        const token = localStorage.getItem(TOKEN_STORAGE_KEY);
        return token && token.trim().length > 0 ? token : null;
    } catch {
        return null;
    }
}

export function saveToken(token: string): void {
    localStorage.setItem(TOKEN_STORAGE_KEY, token);
    pushToElectronBridge('token', token);
}

export function clearToken(): void {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    pushToElectronBridge('token', null);
}

