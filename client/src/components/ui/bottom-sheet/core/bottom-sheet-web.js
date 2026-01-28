import React from 'react';
import { Drawer } from 'vaul';
import { View } from 'react-native';

export function BottomSheetWeb({
    isOpen,
    onOpenChange,
    snapPoints,
    children,
    trigger,
    title,
    triggerClassName,
    contentClassName,
    contentContainerStyle
}) {
    // Vaul은 snapPoints를 0-1 사이의 숫자 배열로 기대함
    // @gorhom/bottom-sheet는 '90%' 형식 사용 → vaul용으로 변환 필요
    const parsedSnapPoints = snapPoints?.map(sp => {
        if (typeof sp === 'string' && sp.endsWith('%')) {
            return parseInt(sp) / 100;
        }
        return sp;
    });

    return (
        <Drawer.Root
            open={isOpen}
            onOpenChange={onOpenChange}
            shouldScaleBackground
            snapPoints={parsedSnapPoints}
        >
            {trigger && (
                <Drawer.Trigger asChild>
                    {trigger}
                </Drawer.Trigger>
            )}

            <Drawer.Portal>
                <Drawer.Overlay className="fixed inset-0 bg-black/40 z-40" />
                <Drawer.Content
                    className={`bg-white flex flex-col rounded-t-[10px] mt-24 fixed bottom-0 left-0 right-0 z-40 focus:outline-none ${contentClassName || ''}`}
                    style={{ maxHeight: '96%' }}
                    aria-describedby={undefined}
                >
                    {/* Accessibility: Hidden Title for screen readers (Radix requirement) */}
                    <Drawer.Title className="sr-only">
                        {title || '팝업'}
                    </Drawer.Title>
                    <Drawer.Description className="sr-only">
                        {title || '팝업 내용'}
                    </Drawer.Description>

                    {/* Inner wrapper to handle layout */}
                    <div className="flex-1 flex flex-col w-full max-w-md mx-auto overflow-hidden bg-white rounded-t-[10px]">
                        {/* Handle */}
                        <div className="mx-auto w-12 h-1.5 flex-shrink-0 rounded-full bg-gray-300 my-4" />

                        {/* Visible Title (optional - only if title prop provided) */}
                        {title && (
                            <div className="font-medium mb-4 text-xl text-center flex-shrink-0 px-4">
                                {title}
                            </div>
                        )}

                        {/* Scrollable Content */}
                        <div
                            className="flex-1 overflow-y-auto px-4 pb-8"
                            style={contentContainerStyle}
                        >
                            {children}
                        </div>
                    </div>
                </Drawer.Content>
            </Drawer.Portal>
        </Drawer.Root>
    );
}

// Ensure default export compatibility if needed, but named export is preferred for internal usage
export default BottomSheetWeb;
