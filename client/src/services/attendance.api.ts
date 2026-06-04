import { getSavedTenant, getSavedToken } from '../auth/authStorage';
import { ResponseError } from './response-error';

export interface CheckInRecord {
    id: number | string;
    employeeId: string;
    checkInTime?: string;
    checkOutTime?: string;
    [key: string]: any;
}

/**
 * Fetches check-in and check-out data for a given employee and date.
 */
export async function fetchCheckInData(empId: string, dateStr: string): Promise<CheckInRecord[]> {
    const tenant = getSavedTenant();
    const token = getSavedToken();

    if (!tenant || !token) {
        console.warn('fetchCheckInData error: Missing authentication details.', { tenant, token });
        throw new Error(`Missing tenant ID or token (tenant: ${tenant}, token: ${token ? 'present' : 'missing'})`);
    }

    const backendUrl = import.meta.env.VITE_HR_BACKEND_URL;
    const url = `${backendUrl}/api/c-emp-check-in-out/filter?employeeId=${encodeURIComponent(empId)}&startDate=${dateStr}&endDate=${dateStr}`;

    const response = await fetch(url, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
            'x-tenant-id': tenant,
            'Authorization': `Bearer ${token}`,
        },
    });

    if (!response.ok) {
        throw new ResponseError(response);
    }

    const json = await response.json();
    return json?.data || [];
}
