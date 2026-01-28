import React, { memo } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { Picker } from 'react-native-wheel-pick';
import { NativeViewGestureHandler } from 'react-native-gesture-handler';

// ─────────────────────────────────────────────────────────────
// 1. MobileWheel (개별 휠 아이템)
// ─────────────────────────────────────────────────────────────
export const MobileWheel = memo(({
    items = [],
    value,
    onChange,
    width,
    loop = false, // Android Only (1.2.6+)
    style,
    ...props
}) => {
    return (
        <Picker
            style={[
                styles.wheel,
                width ? { width } : { flex: 1 },
                style
            ]}
            selectedValue={value}
            pickerData={items}
            onValueChange={onChange}

            // ── Common Style ──
            backgroundColor='transparent'
            textColor='#000000'           // iOS/Android 기본 텍스트 색상 (Dark Mode 대응: 흰색)

            // ── Android Style (iOS 느낌 내기) ──
            textSize={20}
            selectTextColor='#000000'     // 선택된 텍스트 색상
            isShowSelectLine={false}      // 선택 라인 제거 (iOS 스타일)
            isShowSelectBackground={false} // 선택 배경 제거 (iOS 스타일)
            isCyclic={loop}               // 무한 스크롤 (Android Only)

            {...props}
        />
    );
});

// ─────────────────────────────────────────────────────────────
// 2. MobilePicker (컨테이너)
// ─────────────────────────────────────────────────────────────
export function MobilePicker({ children, style, className }) {
    return (
        // 스크롤 뷰 내부에서 휠이 잘 동작하도록 제스처 핸들러로 감싸기
        <NativeViewGestureHandler disallowInterruption={true}>
            <View
                // Tailwind(NativeWind) className 지원
                className={className}
                style={[styles.container, style]}
                onStartShouldSetResponder={() => true}
            >
                {/* iOS 스타일의 중앙 하이라이트 바 (원한다면 주석 해제하여 사용) */}
                {/* <View style={styles.highlightBar} pointerEvents="none" /> */}

                {children}
            </View>
        </NativeViewGestureHandler>
    );
}

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        width: '100%',
        height: 220,
        borderRadius: 12,
        overflow: 'hidden',
        position: 'relative',
    },
    wheel: {
        height: 215,
        backgroundColor: 'transparent',
    },
    // 필요 시 iOS Picker처럼 중앙에 옅은 회색 바를 깔아주는 스타일
    highlightBar: {
        position: 'absolute',
        top: '50%',
        marginTop: -17, // (34px height / 2)
        width: '100%',
        height: 34,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        borderRadius: 24,
        zIndex: 0,
    }
});