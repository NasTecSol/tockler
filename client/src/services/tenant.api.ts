import { ResponseError } from './response-error';

export interface TenantDetails {
    tenantId: number | string;
    tenantName: string;
    tenantLogo?: string;
}

export interface TenantResponse {
    data?: TenantDetails;
    message?: string;
    success?: boolean;
}

/**
 * Fetches organization tenancy details by domain name or tenant ID/subdomain.
 */
export async function fetchTenantIdFromDomain(subdomain: string): Promise<TenantDetails> {
    const url = `https://dev.nashrms.com/api/organization/getOrganizationTenancy?domainName=${encodeURIComponent(subdomain.trim())}`;
    
    const response = await fetch(url, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
            'X-Skip-Loader': 'true',
            'X-Skip-Auth': 'true',
        },
    });

    if (!response.ok) {
        throw new ResponseError(response);
    }

    const data = (await response.json()) as TenantResponse;
    const tenantId = data?.data?.tenantId;
    const tenantName = data?.data?.tenantName;
    const tenantLogo = data?.data?.tenantLogo;

    if (tenantId !== undefined && tenantId !== null && tenantName) {
        return {
            tenantId,
            tenantName,
            tenantLogo: tenantLogo || undefined,
        };
    }

    throw new Error(data?.message || `Tenant details not found for query: ${subdomain}`);
}
