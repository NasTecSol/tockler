const EMP_ID_STORAGE_KEY = 'nashr_empId';
const TENANT_STORAGE_KEY = 'nashr_tenant';

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
}

export function clearEmpId(): void {
    localStorage.removeItem(EMP_ID_STORAGE_KEY);
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
}

export function clearTenant(): void {
    localStorage.removeItem(TENANT_STORAGE_KEY);
}

