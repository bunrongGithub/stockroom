import { TAuthUserRole } from '@/service/apps/base/auth/constant';

/** Decoded JWT payload — embedded in every server request via middleware */
export interface SessionPayload {
    userId: string;
    companyId: string;
    role: TAuthUserRole;
    email: string;
    iat: number;
    exp: number;
}

/** Request context injected by auth middleware into every API handler */
export interface RequestContext {
    userId: string;
    companyId: string;
    role: TAuthUserRole;
    email: string;
}
