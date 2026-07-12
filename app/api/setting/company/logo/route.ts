import { getRequestContext } from '@/lib/request-context';
import { assertRole } from '@/lib/auth';
import { getServerClient } from '@/lib/supabase/server';
import {
    ApiError,
    ApiResponseSuccess,
    BadRequesstExceptionError,
} from '@/service/core/api-response';
import { setCompanyLogo } from '@/service/apps/base/company';
import { NextRequest } from 'next/server';

const MAX_SIZE = 2 * 1024 * 1024; // 2 MB
const ALLOWED: Record<string, string> = {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/webp': 'webp',
    'image/svg+xml': 'svg',
};

// POST /api/setting/company/logo — multipart upload to the public
// `company-assets` bucket (service-role client; bucket is public-read).
export async function POST(request: NextRequest) {
    const context = getRequestContext(request);
    try {
        assertRole(context, 'admin');

        const formData = await request.formData();
        const file = formData.get('file');
        if (!(file instanceof File)) {
            throw new BadRequesstExceptionError('No file provided');
        }

        const ext = ALLOWED[file.type];
        if (!ext) {
            throw new BadRequesstExceptionError(
                'Only PNG, JPEG, WebP, or SVG images are allowed',
            );
        }
        if (file.size > MAX_SIZE) {
            throw new BadRequesstExceptionError('Logo must be 2 MB or smaller');
        }

        // `?id=` targets another company (super admin only — setCompanyLogo
        // rejects the override for everyone else).
        const overrideId =
            Number(request.nextUrl.searchParams.get('id')) || undefined;
        const companyId = overrideId ?? Number(context.companyId);
        const path = `company-${companyId}/logo-${Date.now()}.${ext}`;
        const buffer = Buffer.from(await file.arrayBuffer());

        const supabase = getServerClient();
        const { error: uploadError } = await supabase.storage
            .from('company-assets')
            .upload(path, buffer, { contentType: file.type, upsert: true });

        if (uploadError) {
            throw new ApiError(uploadError.message, 500, 'UPLOAD_FAILED');
        }

        const { data: publicUrl } = supabase.storage
            .from('company-assets')
            .getPublicUrl(path);

        await setCompanyLogo(context, publicUrl.publicUrl, overrideId);

        return new ApiResponseSuccess(
            { data: { logo_url: publicUrl.publicUrl } },
            'Success',
            200,
        ).toResponse();
    } catch (exception) {
        if (exception instanceof ApiError) return exception.toResponse();
        return new ApiResponseSuccess(null, 'Unexpected Error', 500).toResponse();
    }
}
