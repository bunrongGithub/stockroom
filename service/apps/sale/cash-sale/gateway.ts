import { ApiError } from '@/service/core/api-response';
import type { CashSalePaymentMethod } from '@/service/schema/cash-sale.schema';
import type { RequestContext } from '@/types/request-context';

/**
 * Payment gateway seam.
 *
 * At the counter every method we support today settles instantly: the cashier
 * takes the cash, swipes the card, or confirms the transfer, and the sale is
 * recorded as paid. A wallet like ABA KHQR is different — it needs a charge to
 * be created and then confirmed out-of-band — so the orchestrator talks to this
 * interface instead of to a payment provider directly.
 *
 * When merchant credentials exist, an AbaKhqrGateway implements this same
 * interface (createCharge returns a QR + a PENDING status, confirmed by a
 * webhook) and only the registry below changes. Nothing in CashSaleService
 * moves.
 */

export type ChargeStatus = 'SETTLED' | 'PENDING' | 'FAILED';

export type ChargeRequest = {
    amount: number;
    currency: string;
    reference_no?: string | null;
    description?: string | null;
};

export type ChargeResult = {
    status: ChargeStatus;
    /** Provider-side id, if any — stored on the payment's reference_no. */
    reference_no: string | null;
    /** Data the client needs to complete the charge (e.g. a KHQR string). */
    payload?: Record<string, unknown>;
};

export interface PaymentGateway {
    readonly method: CashSalePaymentMethod;
    createCharge(
        ctx: RequestContext,
        request: ChargeRequest,
    ): Promise<ChargeResult>;
}

/**
 * Cash, card, bank transfer and cheque are captured by the cashier out-of-band;
 * recording them is the whole integration.
 */
class ManualGateway implements PaymentGateway {
    constructor(readonly method: CashSalePaymentMethod) {}

    async createCharge(
        _ctx: RequestContext,
        request: ChargeRequest,
    ): Promise<ChargeResult> {
        return {
            status: 'SETTLED',
            reference_no: request.reference_no ?? null,
        };
    }
}

const GATEWAYS: Partial<Record<CashSalePaymentMethod, PaymentGateway>> = {
    CASH: new ManualGateway('CASH'),
    CARD: new ManualGateway('CARD'),
    BANK_TRANSFER: new ManualGateway('BANK_TRANSFER'),
    CHEQUE: new ManualGateway('CHEQUE'),
    // KHQR: new AbaKhqrGateway(),  ← drops in here; needs merchant credentials.
};

export function getPaymentGateway(
    method: CashSalePaymentMethod,
): PaymentGateway {
    const gateway = GATEWAYS[method];
    if (!gateway) {
        throw new ApiError(
            `${method} is not available yet. Choose another payment method.`,
            400,
            'PAYMENT_METHOD_UNAVAILABLE',
        );
    }
    return gateway;
}
