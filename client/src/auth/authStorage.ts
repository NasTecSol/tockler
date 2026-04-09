const EMP_ID_STORAGE_KEY = 'nashr_empId';

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

