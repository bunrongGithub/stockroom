type DeleteModalProps = {
    open: boolean;
    loading?: boolean;
    onClose: () => void;
    onConfirm: () => void;
};

function PopUpDeleteTransactionModal({
    open,
    loading,
    onClose,
    onConfirm,
}: DeleteModalProps) {
    return (
        <div
            className={`
                fixed inset-0 z-50 flex items-center justify-center p-4
                transition-all duration-300
                ${
                    open
                        ? 'bg-black/50 opacity-100 visible'
                        : 'bg-black/0 opacity-0 invisible'
                }
            `}
        >
            {/* Backdrop */}
            <div className="absolute inset-0" onClick={onClose} />

            {/* Modal */}
            <div
                className={`
                    relative w-full max-w-md overflow-hidden rounded-2xl
                    bg-gray-800 shadow-2xl
                    transform transition-all duration-300 ease-out
                    ${
                        open
                            ? 'translate-y-0 scale-100 opacity-100'
                            : 'translate-y-4 scale-95 opacity-0'
                    }
                `}
            >
                {/* Body */}
                <div className="px-6 pt-6 pb-4">
                    <div className="flex items-start gap-4">
                        {/* Icon */}
                        <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-red-500/10">
                            <svg
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="1.5"
                                className="size-6 text-red-400"
                            >
                                <path
                                    d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                />
                            </svg>
                        </div>

                        {/* Content */}
                        <div>
                            <h3 className="text-base font-semibold text-white">
                                Delete category
                            </h3>

                            <p className="mt-2 text-sm text-gray-400">
                                Are you sure you want to delete this category?
                                This action cannot be undone.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="flex flex-col-reverse gap-2 bg-gray-700/20 px-6 py-4 sm:flex-row sm:justify-end">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={loading}
                        className="inline-flex justify-center rounded-lg bg-white/10 px-4 py-2 text-sm font-medium text-white hover:bg-white/20 disabled:opacity-50"
                    >
                        Cancel
                    </button>

                    <button
                        type="button"
                        onClick={onConfirm}
                        disabled={loading}
                        className="inline-flex items-center justify-center gap-2 rounded-lg bg-red-500 px-4 py-2 text-sm font-medium text-white hover:bg-red-400 disabled:opacity-50"
                    >
                        {loading ? 'Deleting...' : 'Delete'}
                    </button>
                </div>
            </div>
        </div>
    );
}
export default PopUpDeleteTransactionModal;
