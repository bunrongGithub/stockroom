import React from 'react';

export default function layout({ children }: { children: React.ReactNode }) {
    return <main className='p-5 shadow-md w-full h-full overflow-hidden print:h-auto print:overflow-visible print:p-0 print:shadow-none' >{children}</main>;
}
