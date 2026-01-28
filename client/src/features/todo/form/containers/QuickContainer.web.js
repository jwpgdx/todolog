import React from 'react';

/**
 * QuickContainer (Web)
 * Quick Mode용 컨테이너 - position: fixed 기반 sticky footer
 * 
 * @param {ReactNode} children - QuickModeContent
 * @param {function} onClose - 닫기 핸들러 (웹에서는 배경 클릭 없음)
 */
export default function QuickContainer({ children, onClose }) {
    return (
        <div
            style={{
                position: 'fixed',
                bottom: 0,
                left: 0,
                right: 0,
                zIndex: 50,
                boxShadow: '0 -2px 10px rgba(0,0,0,0.1)',
            }}
        >
            {children}
        </div>
    );
}
