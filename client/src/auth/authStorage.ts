const EMP_ID_STORAGE_KEY = 'nashr_empId';
const EMP_DB_ID_STORAGE_KEY = 'nashr_employeeDbId';
const TENANT_STORAGE_KEY = 'nashr_tenant';
const TENANT_NAME_STORAGE_KEY = 'nashr_tenantName';
const TENANT_LOGO_STORAGE_KEY = 'nashr_tenantLogo';
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

export function getSavedTenantName(): string | null {
    try {
        const tenantName = localStorage.getItem(TENANT_NAME_STORAGE_KEY);
        return tenantName && tenantName.trim().length > 0 ? tenantName : null;
    } catch {
        return null;
    }
}

export function saveTenantName(tenantName: string): void {
    localStorage.setItem(TENANT_NAME_STORAGE_KEY, tenantName);
    pushToElectronBridge('tenantName', tenantName);
}

export function getSavedTenantLogo(): string | null {
    try {
        const tenantLogo = localStorage.getItem(TENANT_LOGO_STORAGE_KEY);
        return tenantLogo && tenantLogo.trim().length > 0 ? tenantLogo : null;
    } catch {
        return null;
    }
}

export function saveTenantLogo(tenantLogo: string): void {
    localStorage.setItem(TENANT_LOGO_STORAGE_KEY, tenantLogo);
    pushToElectronBridge('tenantLogo', tenantLogo);
}

export function clearTenant(): void {
    localStorage.removeItem(TENANT_STORAGE_KEY);
    localStorage.removeItem(TENANT_NAME_STORAGE_KEY);
    localStorage.removeItem(TENANT_LOGO_STORAGE_KEY);
    localStorage.removeItem(EMP_DB_ID_STORAGE_KEY);
    pushToElectronBridge('tenantId', null);
    pushToElectronBridge('tenantName', null);
    pushToElectronBridge('tenantLogo', null);
    pushToElectronBridge('isCheckedIn', null);
    pushToElectronBridge('employeeDbId', null);

    try {
        if (typeof window !== 'undefined' && window.electronBridge?.sendIpc) {
            window.electronBridge.sendIpc('check-in-status-changed', false);
        }
    } catch {
        // ignore
    }
}

export function saveCheckedInStatus(isCheckedIn: boolean): void {
    pushToElectronBridge('isCheckedIn', isCheckedIn ? 'true' : 'false');
}

export function getSavedEmpDbId(): string | null {
    try {
        const empDbId = localStorage.getItem(EMP_DB_ID_STORAGE_KEY);
        return empDbId && empDbId.trim().length > 0 ? empDbId : null;
    } catch {
        return null;
    }
}

export function saveEmpDbId(empDbId: string): void {
    localStorage.setItem(EMP_DB_ID_STORAGE_KEY, empDbId);
    pushToElectronBridge('employeeDbId', empDbId);
}

export function clearEmpDbId(): void {
    localStorage.removeItem(EMP_DB_ID_STORAGE_KEY);
    pushToElectronBridge('employeeDbId', null);
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

