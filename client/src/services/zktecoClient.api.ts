import { ResponseError } from './response-error';

export interface ZkTecoClientPayload {
    tenant: string;
    timestamp: string;
    deviceUserId: string;
    sn: string;
    status: string;
    verify_type: string;
    deviceIp: string;
    deviceName: string;
    timeZone: string;
}

export async function sendZkTecoClientEvent(payload: ZkTecoClientPayload): Promise<unknown> {
    const { tenant, ...bodyPayload } = payload;
    const response = await fetch('https://www.nashrms.com/api/zk-teco/zktecoClient', {
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

