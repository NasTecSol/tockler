import { ResponseError } from './response-error';

export interface EmployeeLoginRequest {
    tenant: string;
    empId: string;
    password: string;
    macAddress: string;
}

export async function employeeLogin(payload: EmployeeLoginRequest): Promise<unknown> {
    const { tenant, ...bodyPayload } = payload;
    const response = await fetch('https://dev.nashrms.com/api/employee/login', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-tenant-id': tenant,
        },
        body: JSON.stringify(bodyPayload),
    });

    if (!response.ok) {
        throw new ResponseError(response);
    }

    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
        return response.json();
    }

    return response.text();
}

