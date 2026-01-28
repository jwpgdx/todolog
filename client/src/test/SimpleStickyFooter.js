import React, { useMemo } from 'react';
import { View, TextInput, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { KeyboardStickyView } from 'react-native-keyboard-controller';
import { useStickyTestStore } from '../store/stickyTestStore';

/**
 * SimpleStickFooter
 * 
 * KeyboardStickyView만 테스트하기 위한 최소 컴포넌트
 * App.js 최상위에서 렌더링됨
 */
export default function SimpleStickyFooter() {
    const { isVisible, close } = useStickyTestStore();

    const offset = useMemo(() => ({
        closed: 0,
        opened: 0,
    }), []);

    if (!isVisible) return null;

    return (
        <KeyboardStickyView offset={offset}>
            <View style={styles.stickyFooter}>
                <Text style={styles.stickyLabel}>SimpleStickyFooter (KeyboardStickyView)</Text>
                <View style={styles.inputRow}>
                    <TextInput
                        style={styles.input}
                        placeholder="여기에 입력..."
                        placeholderTextColor="#9CA3AF"
                        autoFocus
                    />
                    <TouchableOpacity style={styles.sendButton} onPress={close}>
                        <Text style={styles.sendText}>닫기</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </KeyboardStickyView>
    );
}

const styles = StyleSheet.create({
    stickyFooter: {
        backgroundColor: '#FEF3C7',
        borderTopWidth: 2,
        borderTopColor: '#F59E0B',
        padding: 12,
    },
    stickyLabel: {
        fontSize: 12,
        color: '#92400E',
        marginBottom: 8,
        fontFamily: 'monospace',
    },
    inputRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    input: {
        flex: 1,
        height: 44,
        backgroundColor: 'white',
        borderRadius: 8,
        paddingHorizontal: 12,
        fontSize: 16,
    },
    sendButton: {
        marginLeft: 8,
        backgroundColor: '#F59E0B',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderRadius: 8,
    },
    sendText: {
        color: 'white',
        fontWeight: '600',
    },
});
