import { useState, useRef, useCallback, useEffect } from 'react';
import { View, TouchableOpacity, Text, ScrollView, Platform, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

/**
 * Generic Dropdown Component
 * 
 * z-index 기반 해결 - Portal 없이 inline으로 렌더링
 * 부모에 overflow: visible 설정 필요
 * 
 * @param {React.ReactNode} trigger - Component to render as the trigger button (receives isOpen)
 * @param {React.ReactNode} children - Component to render inside the dropdown list
 * @param {string} align - 'left' | 'right' (default: 'left')
 * @param {string} direction - 'up' | 'down' | 'auto' (default: 'auto')
 * @param {number} width - Specific width for the dropdown content (default: 238)
 * @param {number} maxHeight - Max height of the dropdown content (default: 250)
 */
export default function Dropdown({
    trigger,
    children,
    align = 'left',
    direction = 'auto',
    width = 238,
    maxHeight = 250,
    defaultOpen = false,  // 외부에서 초기 열림 상태 제어
}) {
    const [isOpen, setIsOpen] = useState(defaultOpen);
    const [computedDirection, setComputedDirection] = useState('down');
    const triggerRef = useRef(null);

    // defaultOpen이 true로 변경되면 자동으로 열기
    useEffect(() => {
        if (defaultOpen && !isOpen) {
            detectDirection().then(() => setIsOpen(true));
        }
    }, [defaultOpen]);

    const close = () => setIsOpen(false);

    // 자동 방향 감지
    const detectDirection = useCallback(() => {
        if (direction !== 'auto') {
            setComputedDirection(direction);
            return Promise.resolve();
        }

        return new Promise((resolve) => {
            if (Platform.OS === 'web') {
                // 웹: getBoundingClientRect 사용
                if (triggerRef.current) {
                    const rect = triggerRef.current.getBoundingClientRect();
                    const screenHeight = window.innerHeight;
                    const spaceBelow = screenHeight - rect.bottom;
                    const spaceAbove = rect.top;

                    // 아래 공간이 드롭다운 높이보다 작고, 위가 더 넓으면 up
                    const newDirection = spaceBelow < maxHeight && spaceAbove > spaceBelow ? 'up' : 'down';
                    setComputedDirection(newDirection);
                }
                resolve();
            } else {
                // 모바일: measure() 사용
                if (triggerRef.current) {
                    triggerRef.current.measure((x, y, w, h, pageX, pageY) => {
                        const screenHeight = Dimensions.get('window').height;
                        const spaceBelow = screenHeight - (pageY + h);
                        const spaceAbove = pageY;

                        const newDirection = spaceBelow < maxHeight && spaceAbove > spaceBelow ? 'up' : 'down';
                        setComputedDirection(newDirection);
                        resolve();
                    });
                } else {
                    resolve();
                }
            }
        });
    }, [direction, maxHeight]);

    // 드롭다운 열기
    const handleOpen = async () => {
        if (!isOpen) {
            await detectDirection();
        }
        setIsOpen(!isOpen);
    };

    // 실제 적용할 방향
    const actualDirection = direction === 'auto' ? computedDirection : direction;

    // 웹용 스타일 (인라인 - Portal 없이)
    const getWebContentStyle = () => ({
        position: 'absolute',
        [actualDirection === 'up' ? 'bottom' : 'top']: '100%',
        [align === 'right' ? 'right' : 'left']: 0,
        marginTop: actualDirection === 'down' ? 8 : 0,
        marginBottom: actualDirection === 'up' ? 8 : 0,
        width: width,
        maxHeight: maxHeight,
        backgroundColor: 'white',
        borderRadius: 16,
        paddingTop: 6,
        paddingBottom: 6,
        boxShadow: '0px 8px 32px rgba(0, 0, 0, 0.15)',
        zIndex: 9999,
        overflowY: 'auto',
        overscrollBehavior: 'contain',
    });

    return (
        <View
            ref={Platform.OS !== 'web' ? triggerRef : undefined}
            style={{ position: 'relative', zIndex: isOpen ? 9999 : 1 }}
        >
            {/* Trigger Button */}
            <TouchableOpacity
                activeOpacity={0.8}
                onPress={handleOpen}
            >
                {Platform.OS === 'web' ? (
                    <div ref={triggerRef}>
                        {trigger instanceof Function ? trigger(isOpen) : trigger}
                    </div>
                ) : (
                    <View ref={triggerRef}>
                        {trigger instanceof Function ? trigger(isOpen) : trigger}
                    </View>
                )}
            </TouchableOpacity>

            {/* Dropdown Content */}
            {isOpen && (
                <>
                    {/* Backdrop */}
                    {Platform.OS === 'web' ? (
                        <div
                            onClick={close}
                            style={{
                                position: 'fixed',
                                top: 0,
                                left: 0,
                                right: 0,
                                bottom: 0,
                                zIndex: 9998,
                                backgroundColor: 'transparent',
                            }}
                        />
                    ) : (
                        <TouchableOpacity
                            activeOpacity={1}
                            onPress={close}
                            style={{
                                position: 'absolute',
                                top: -1000,
                                backgroundColor: 'transparent',
                                width: 10000,
                                height: 10000,
                                left: -500,
                                zIndex: 40,
                            }}
                        />
                    )}

                    {/* Content */}
                    {Platform.OS === 'web' ? (
                        <div
                            style={getWebContentStyle()}
                            onTouchMove={(e) => e.stopPropagation()}
                            onWheel={(e) => e.stopPropagation()}
                            onTouchStart={(e) => e.stopPropagation()}
                        >
                            <div style={{ paddingLeft: 4, paddingRight: 4 }}>
                                {children(close)}
                            </div>
                        </div>
                    ) : (
                        <View
                            className={`absolute bg-surface rounded-[16px] py-[6px] overflow-hidden z-50 
                                ${align === 'right' ? 'right-0' : 'left-0'}
                                ${actualDirection === 'up' ? 'bottom-full mb-2' : 'top-full mt-2'} 
                            `}
                            style={{
                                width: width,
                                maxHeight,
                                ...Platform.select({
                                    ios: { boxShadow: '0px 8px 32px rgba(0, 0, 0, 0.1)' },
                                    android: { elevation: 8 },
                                    default: { boxShadow: '0px 8px 32px rgba(0, 0, 0, 0.1)' }
                                }),
                            }}
                        >
                            <ScrollView
                                className="px-1"
                                showsVerticalScrollIndicator={true}
                                nestedScrollEnabled={true}
                            >
                                {children(close)}
                            </ScrollView>
                        </View>
                    )}
                </>
            )}
        </View>
    );
}

/**
 * Standard Dropdown Item (iOS Style: Check -> Text -> Icon)
 */
function DropdownItem({
    children,
    label,
    icon,
    iconColor,
    onPress,
    className = '',
    isSelected
}) {
    return (
        <TouchableOpacity
            onPress={onPress}
            className={`flex-row items-center h-11 px-3 rounded-lg gap-3 w-full active:bg-gray-100 dark:active:bg-gray-700 ${className}`}
        >
            {/* 1. Checkmark Area (Left) */}
            {typeof isSelected === 'boolean' && (
                <View className="w-5 items-center justify-center">
                    <Ionicons
                        name="checkmark"
                        size={18}
                        className="text-primary"
                        style={{ opacity: isSelected ? 1 : 0 }}
                    />
                </View>
            )}

            {/* 2. Content Area (Middle) */}
            <View className="flex-1 justify-center">
                {label && (
                    <Text className="text-[17px] text-text leading-tight" numberOfLines={1}>
                        {label}
                    </Text>
                )}
                {children}
            </View>

            {/* 3. Icon Area (Right) */}
            {icon && (
                <View className="items-center justify-center pl-1">
                    <Ionicons name={icon} size={20} color={iconColor} className={!iconColor ? "text-text-secondary" : ""} />
                </View>
            )}
        </TouchableOpacity>
    );
}

/**
 * Standard Dropdown Separator
 */
function DropdownSeparator({ className = '' }) {
    return <View className={`h-[1px] bg-border mx-4 my-1 opacity-50 ${className}`} />;
}

// Attach sub-components
Dropdown.Item = DropdownItem;
Dropdown.Separator = DropdownSeparator;