import { getSavedTenant, getSavedToken } from '../auth/authStorage';
import { ResponseError } from './response-error';

export interface AttendanceRecord {
    id?: number | string;
    employeeId: string;
    empId: string;
    date: string;
    clockInTime?: string;
    clockOutTime?: string;
    status: 'Present' | 'Pending' | 'Absent';
    secondaryStatus?: string;
    [key: string]: any;
}

/**
 * Fetches attendance data for a given employee and date range.
 */
export async function fetchAttendanceData(empDbId: string, dateStr: string): Promise<AttendanceRecord[]> {
    const tenant = getSavedTenant();
    const token = getSavedToken();

    if (!tenant || !token) {
        console.warn('fetchAttendanceData error: Missing authentication details.', { tenant, token });
        throw new Error(`Missing tenant ID or token (tenant: ${tenant}, token: ${token ? 'present' : 'missing'})`);
    }

    const backendUrl = import.meta.env.VITE_HR_BACKEND_URL || 'https://www.nashrms.com';
    const url = `${backendUrl}/api/c-emp-attendance/getDataByEmployeeId/${encodeURIComponent(empDbId)}/${dateStr}/${dateStr}?page=0&limit=50`;

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
    return json?.data?.data || json?.data || [];
}
