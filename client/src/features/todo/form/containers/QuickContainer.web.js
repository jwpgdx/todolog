import React from 'react';

/**
 * QuickContainer (Web)
 * Quick Mode용 컨테이너 - backdrop + sticky footer
 * 
 * @param {ReactNode} children - QuickModeContent
 * @param {function} onClose - 배경 클릭 시 닫기
 */
export default function QuickContainer({ children, onClose }) {
    return (
        <div
            style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                zIndex: 100,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'flex-end',
            }}
            onClick={() => onClose?.()}
        >
            {/* Backdrop */}
            <div
                style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: 'rgba(0, 0, 0, 0.3)',
                }}
            />

            {/* Bar */}
            <div
                style={{
                    position: 'relative',
                    boxShadow: '0 -2px 10px rgba(0,0,0,0.1)',
                }}
                onClick={(e) => e.stopPropagation()}
            >
                {children}
            </div>
        </div>
    );
}
