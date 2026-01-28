import React, { useEffect } from 'react';
import { Pressable, View } from 'react-native';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withTiming,
    withSpring
} from 'react-native-reanimated';

// Props로 크기 조절 등을 받고 싶다면 추가 가능
const ThemeSwitch = ({ value, onValueChange }) => {
    // 애니메이션 값 (0: Off, 1: On)
    const progress = useSharedValue(value ? 1 : 0);

    // value가 외부에서 변하면 애니메이션 실행
    useEffect(() => {
        progress.value = withSpring(value ? 1 : 0, {
            mass: 1,
            damping: 15,
            stiffness: 120,
        });
    }, [value]);

    // 원(Thumb) 이동 스타일
    const thumbStyle = useAnimatedStyle(() => ({
        transform: [{ translateX: progress.value * 20 }], // 20px 이동 (트랙 너비 - 원 크기 - 패딩)
    }));

    return (
        <Pressable
            onPress={() => onValueChange(!value)}
            className="active:opacity-80" // 터치 시 살짝 투명해지는 효과
        >
            {/* ✅ 핵심: Tailwind 클래스로 배경색 지정 
        - value가 true면: bg-primary (설정 파일의 파란색)
        - value가 false면: bg-muted (설정 파일의 회색)
        - transition 효과는 Reanimated가 없어도 NativeWind가 어느정도 처리해주지만, 
          색상 부드럽게 변하는 건 NativeWind v4에서 지원하는 transition 클래스를 써도 됨.
      */}
            <View
                className={`w-12 h-7 rounded-full justify-center px-1 border border-transparent ${value ? 'bg-primary' : 'bg-muted'
                    }`}
            >
                {/* 흰색 원 (Thumb) */}
                <Animated.View
                    style={thumbStyle}
                    className="w-5 h-5 bg-white rounded-full shadow-sm shadow-black/20"
                />
            </View>
        </Pressable>
    );
};

export default ThemeSwitch;
