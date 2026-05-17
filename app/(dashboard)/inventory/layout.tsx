import React from 'react';

function layout({ children }: { children: React.ReactNode }) {
    return (
        <div
            style={{
                fontFamily: "'DM Sans', sans-serif",
            }}
        >
            {children}
        </div>
    );
}

export default layout;
