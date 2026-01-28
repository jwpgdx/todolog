import React from 'react';
import { View, Modal, Pressable, useWindowDimensions } from 'react-native';
import { BottomSheet } from '../../../../components/ui/bottom-sheet';

/**
 * DetailContainer (Web)
 * Detail Mode용 컨테이너
 * - 모바일 웹 (width <= 768): vaul BottomSheet
 * - 데스크탑 웹 (width > 768): 중앙 Modal
 * 
 * @param {boolean} visible - 모달 표시 여부
 * @param {function} onClose - 닫기 핸들러
 * @param {ReactNode} children - DetailContent
 */
export default function DetailContainer({ visible, onClose, children }) {
    const { width } = useWindowDimensions();
    const isDesktop = width > 768;

    // 모바일 웹: vaul BottomSheet
    if (!isDesktop) {
        return (
            <BottomSheet
                isOpen={visible}
                onOpenChange={(isOpen) => {
                    if (!isOpen) onClose?.();
                }}
            >
                <View style={{ flex: 1 }}>
                    {children}
                </View>
            </BottomSheet>
        );
    }

    // 데스크탑 웹: 중앙 Modal
    if (!visible) return null;

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            onRequestClose={onClose}
        >
            {/* Backdrop */}
            <Pressable
                onPress={onClose}
                style={{
                    flex: 1,
                    backgroundColor: 'rgba(0,0,0,0.5)',
                    justifyContent: 'center',
                    alignItems: 'center',
                }}
            >
                {/* Modal Content */}
                <Pressable
                    onPress={(e) => e.stopPropagation()}
                    style={{
                        width: '90%',
                        maxWidth: 500,
                        maxHeight: '80%',
                        backgroundColor: 'white',
                        borderRadius: 12,
                        overflow: 'hidden',
                    }}
                >
                    {children}
                </Pressable>
            </Pressable>
        </Modal>
    );
}
