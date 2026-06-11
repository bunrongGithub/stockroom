import React from 'react';

export default function layout({ children }: { children: React.ReactNode }) {
    return <main className='p-10 shadow-md w-full h-full overflow-hidden' >{children}</main>;
}
