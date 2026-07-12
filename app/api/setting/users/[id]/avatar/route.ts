import { getRequestContext } from '@/lib/request-context';
import { assertRole } from '@/lib/auth';
import { getServerClient } from '@/lib/supabase/server';
import {
    ApiError,
    BadRequesstExceptionError,
} from '@/service/core/api-response';
import { companyUserService } from '@/service/apps/base/user';
import { userIdSchema } from '@/service/schema/user.schema';
import { NextRequest, NextResponse } from 'next/server';

const MAX_SIZE = 2 * 1024 * 1024; // 2 MB
const ALLOWED: Record<string, string> = {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/webp': 'webp',
};

type Params = { params: Promise<{ id: string }> };

// POST /api/setting/users/[id]/avatar — multipart upload to the public
// `company-assets` bucket (mirrors the company-logo route).
export async function POST(request: NextRequest, { params }: Params) {
    const ctx = getRequestContext(request);
    try {
        assertRole(ctx, 'admin');
        const { id } = await params;
        const idParsed = userIdSchema.safeParse({ id });
        if (!idParsed.success) {
            throw new BadRequesstExceptionError('Invalid user id');
        }
        // Confirm the target user belongs to the caller's company before upload.
        await companyUserService.get(ctx, idParsed.data.id);

        const formData = await request.formData();
        const file = formData.get('file');
        if (!(file instanceof File)) {
            throw new BadRequesstExceptionError('No file provided');
        }
        const ext = ALLOWED[file.type];
        if (!ext) {
            throw new BadRequesstExceptionError(
                'Only PNG, JPEG, or WebP images are allowed',
            );
        }
        if (file.size > MAX_SIZE) {
            throw new BadRequesstExceptionError('Avatar must be 2 MB or smaller');
        }

        const companyId = Number(ctx.companyId);
        const path = `company-${companyId}/avatars/user-${idParsed.data.id}-${Date.now()}.${ext}`;
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

        const user = await companyUserService.setAvatar(
            ctx,
            idParsed.data.id,
            publicUrl.publicUrl,
        );
        return NextResponse.json({ data: user }, { status: 200 });
    } catch (error) {
        if (error instanceof ApiError) return error.toResponse();
        const message = error instanceof Error ? error.message : 'Unexpected error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
