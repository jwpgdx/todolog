import React from 'react';
import { View, StyleSheet, Modal, KeyboardAvoidingView } from 'react-native';

/**
 * DetailContainer (iOS)
 * Detail Mode용 컨테이너 - Native Modal (pageSheet)
 * 
 * @param {boolean} visible - 모달 표시 여부
 * @param {function} onClose - 닫기 핸들러
 * @param {ReactNode} children - DetailContent
 */
export default function DetailContainer({ visible, onClose, children }) {
    return (
        <Modal
            visible={visible}
            animationType="slide"
            presentationStyle="pageSheet"
            onRequestClose={onClose}
            onDismiss={onClose}
        >
            <View style={styles.container}>
                <KeyboardAvoidingView
                    behavior="padding"
                    style={{ flex: 1 }}
                >
                    {children}
                </KeyboardAvoidingView>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: 'white',
        paddingTop: 20,
    },
});
