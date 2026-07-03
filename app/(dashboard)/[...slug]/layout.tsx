import React from 'react';

export default function layout({ children }: { children: React.ReactNode }) {
    // min-h-full (not h-full + overflow-hidden): pages taller than the viewport
    // must grow so the dashboard shell's scroll container can actually scroll.
    return <main className='p-5 shadow-md w-full min-h-full print:h-auto print:p-0 print:shadow-none' >{children}</main>;
}
