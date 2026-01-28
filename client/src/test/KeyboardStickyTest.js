import React, { useMemo } from 'react';
import { View, TextInput, Text, StyleSheet, TouchableOpacity, Keyboard } from 'react-native';
import { KeyboardStickyView } from 'react-native-keyboard-controller';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * KeyboardStickyView 격리 테스트
 * 
 * 키보드와 Sticky Footer 사이의 공백 문제를 진단하기 위한 테스트
 */
export default function KeyboardStickyTest({ onBack }) {
    const insets = useSafeAreaInsets();

    // 다양한 offset 설정 테스트
    const offset = useMemo(() => ({
        closed: 0,  // 키보드 닫히면 Quick Mode도 사라지므로 SafeArea 불필요
        opened: 0,  // 키보드 열릴 때 바로 위에 붙기
    }), []);

    return (
        <>
            {/* 메인 콘텐츠: SafeAreaView edges={['top']} 안에 */}
            <SafeAreaView edges={['top']} style={styles.container}>
                {/* 헤더 */}
                <View style={styles.header}>
                    <TouchableOpacity onPress={onBack}>
                        <Text style={styles.backButton}>← 뒤로</Text>
                    </TouchableOpacity>
                    <Text style={styles.title}>KeyboardStickyView 테스트</Text>
                </View>

                {/* 정보 표시 */}
                <View style={styles.infoBox}>
                    <Text style={styles.infoText}>insets.bottom: {insets.bottom}</Text>
                    <Text style={styles.infoText}>offset.closed: {offset.closed}</Text>
                    <Text style={styles.infoText}>offset.opened: {offset.opened}</Text>
                </View>

                <Text style={styles.description}>
                    KeyboardExtender 패턴 적용:{'\n'}
                    - SafeAreaView edges=['top'] 안에 메인 콘텐츠{'\n'}
                    - KeyboardStickyView는 SafeAreaView 밖에!
                </Text>

                {/* 빈 공간 (터치해서 키보드 닫기) */}
                <TouchableOpacity
                    style={styles.dismissArea}
                    onPress={() => Keyboard.dismiss()}
                    activeOpacity={1}
                >
                    <Text style={styles.dismissText}>여기 터치 → 키보드 닫기</Text>
                </TouchableOpacity>
            </SafeAreaView>

            {/* Sticky Footer: SafeAreaView 밖에! */}
            <KeyboardStickyView offset={offset}>
                <View style={styles.stickyFooter}>
                    <Text style={styles.stickyLabel}>Sticky Footer (SafeAreaView 밖)</Text>
                    <View style={styles.inputRow}>
                        <TextInput
                            style={styles.input}
                            placeholder="여기에 입력..."
                            placeholderTextColor="#9CA3AF"
                        />
                        <TouchableOpacity style={styles.sendButton}>
                            <Text style={styles.sendText}>전송</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </KeyboardStickyView>
        </>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F3F4F6',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        backgroundColor: 'white',
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    backButton: {
        fontSize: 16,
        color: '#007AFF',
        marginRight: 16,
    },
    title: {
        fontSize: 18,
        fontWeight: '600',
    },
    infoBox: {
        margin: 16,
        padding: 12,
        backgroundColor: '#E0F2FE',
        borderRadius: 8,
    },
    infoText: {
        fontSize: 14,
        fontFamily: 'monospace',
        color: '#0369A1',
    },
    description: {
        margin: 16,
        fontSize: 14,
        color: '#6B7280',
        lineHeight: 20,
    },
    dismissArea: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    dismissText: {
        color: '#9CA3AF',
        fontSize: 16,
    },
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
