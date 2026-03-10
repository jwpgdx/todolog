import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  Keyboard,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  InputAccessoryView,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

const DEMO = {
  IOS_ACCESSORY: 'IOS_ACCESSORY',
  ANDROID_RESIZE: 'ANDROID_RESIZE',
};

function SegmentButton({ selected, label, onPress }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={{
        flex: 1,
        paddingVertical: 10,
        borderRadius: 12,
        backgroundColor: selected ? '#111827' : '#F3F4F6',
        alignItems: 'center',
      }}
      activeOpacity={0.85}
    >
      <Text style={{ color: selected ? 'white' : '#111827', fontWeight: '800', fontSize: 12 }}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

function IOSInputAccessoryToolbarDemo() {
  const insets = useSafeAreaInsets();
  const accessoryId = useMemo(() => 'quick-bar-native-accessory-toolbar', []);
  const hostInputRef = useRef(null);
  const [text, setText] = useState('');
  const [log, setLog] = useState('대기중…');

  const open = useCallback(() => {
    hostInputRef.current?.focus?.();
  }, []);

  const close = useCallback(() => {
    Keyboard.dismiss();
    hostInputRef.current?.blur?.();
  }, []);

  const submit = useCallback(() => {
    const value = text.trim();
    if (!value) {
      setLog('빈 값은 등록 불가');
      return;
    }
    setLog(`등록됨: "${value}"`);
    setText('');
  }, [text]);

  if (Platform.OS !== 'ios') {
    return (
      <View style={{ padding: 16 }}>
        <Text style={{ fontSize: 14, fontWeight: '800', color: '#111827' }}>
          iOS InputAccessoryView 데모
        </Text>
        <Text style={{ marginTop: 8, color: '#6b7280', lineHeight: 20 }}>
          현재 플랫폼에서는 InputAccessoryView를 지원하지 않습니다. iOS에서 확인하세요.
        </Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
      >
        <Text style={{ fontSize: 16, fontWeight: '900', color: '#111827' }}>
          iOS: InputAccessoryView (Quick Bar 테스트)
        </Text>
        <Text style={{ marginTop: 8, color: '#6b7280', lineHeight: 20 }}>
          - 화면에 입력창이 항상 떠있는 구조가 아니라{'\n'}
          - 버튼을 누르면 키보드가 올라오고, 키보드 위에 Quick Bar(입력처럼 보이는 영역)가 같이 붙어서 뜨는지 확인합니다{'\n'}
          - 실제 포커스는 숨겨진 host TextInput에 있고, 바의 입력 UI는 그 값을 표시합니다(안정성 우선)
        </Text>

        <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
          <TouchableOpacity
            onPress={open}
            style={{
              flex: 1,
              backgroundColor: '#3b82f6',
              paddingVertical: 12,
              borderRadius: 12,
              alignItems: 'center',
            }}
            activeOpacity={0.85}
          >
            <Text style={{ color: 'white', fontWeight: '900' }}>포커스</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={close}
            style={{
              flex: 1,
              backgroundColor: '#111827',
              paddingVertical: 12,
              borderRadius: 12,
              alignItems: 'center',
            }}
            activeOpacity={0.85}
          >
            <Text style={{ color: 'white', fontWeight: '900' }}>키보드 닫기</Text>
          </TouchableOpacity>
        </View>

        <View style={{ marginTop: 16, padding: 14, borderRadius: 14, backgroundColor: '#F3F4F6' }}>
          <Text style={{ fontWeight: '900', color: '#111827' }}>상태</Text>
          <Text style={{ marginTop: 6, color: '#374151' }}>log: {log}</Text>
          <Text style={{ marginTop: 6, color: '#374151' }}>value: {text ? `"${text}"` : '(empty)'}</Text>
        </View>
      </ScrollView>

      {/* Host TextInput: 키보드 + 액세서리 바 표시 트리거용 (화면 밖) */}
      <TextInput
        ref={hostInputRef}
        inputAccessoryViewID={accessoryId}
        value={text}
        onChangeText={setText}
        onSubmitEditing={submit}
        returnKeyType="done"
        style={{
          position: 'absolute',
          left: -9999,
          top: -9999,
          width: 1,
          height: 1,
          opacity: 0,
        }}
      />

      <InputAccessoryView nativeID={accessoryId}>
        <View
          style={{
            borderTopWidth: 1,
            borderTopColor: '#E5E7EB',
            backgroundColor: 'white',
            paddingTop: 10,
            paddingHorizontal: 12,
            paddingBottom: Math.max(insets.bottom, 10),
          }}
        >
          <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
            <View
              style={{
                flex: 1,
                backgroundColor: '#F3F4F6',
                borderRadius: 12,
                paddingHorizontal: 12,
                height: 44,
                justifyContent: 'center',
              }}
            >
              <TextInput
                editable={false}
                pointerEvents="none"
                placeholder="Quick Bar 입력 (표시용)"
                placeholderTextColor="#9CA3AF"
                value={text}
                style={{ fontSize: 16, color: '#111827' }}
              />
            </View>

            <TouchableOpacity
              onPress={submit}
              style={{
                height: 44,
                paddingHorizontal: 14,
                borderRadius: 12,
                backgroundColor: '#10B981',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              activeOpacity={0.85}
            >
              <Text style={{ color: 'white', fontWeight: '900' }}>등록</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={close}
              style={{
                height: 44,
                paddingHorizontal: 14,
                borderRadius: 12,
                backgroundColor: '#111827',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              activeOpacity={0.85}
            >
              <Text style={{ color: 'white', fontWeight: '900' }}>닫기</Text>
            </TouchableOpacity>
          </View>
        </View>
      </InputAccessoryView>
    </View>
  );
}

function AndroidResizeBottomBarDemo() {
  const insets = useSafeAreaInsets();
  const inputRef = useRef(null);
  const [text, setText] = useState('');
  const [log, setLog] = useState('대기중…');
  const [isOpen, setIsOpen] = useState(false);

  const open = useCallback(() => {
    setIsOpen(true);
    setTimeout(() => {
      inputRef.current?.focus?.();
    }, 0);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
    Keyboard.dismiss();
  }, []);

  const submit = useCallback(() => {
    const value = text.trim();
    if (!value) {
      setLog('빈 값은 등록 불가');
      return;
    }
    setLog(`등록됨: "${value}"`);
    setText('');
  }, [text]);

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: 16, paddingBottom: 180 }}
      >
        <Text style={{ fontSize: 16, fontWeight: '900', color: '#111827' }}>
          Android: resize + Quick Bar (open 시 포커스)
        </Text>
        <Text style={{ marginTop: 8, color: '#6b7280', lineHeight: 20 }}>
          - Android에서 `adjustResize/resize`가 켜져 있으면 화면 높이가 줄어들며{'\n'}
          - 아래 Bar(`bottom: 0`)가 키보드 위로 밀려 올라옵니다{'\n'}
          - iOS에서는 기본이 overlay라 같은 방식이 잘 안 먹는 게 정상입니다
        </Text>

        <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
          <TouchableOpacity
            onPress={open}
            style={{
              flex: 1,
              backgroundColor: '#3b82f6',
              paddingVertical: 12,
              borderRadius: 12,
              alignItems: 'center',
            }}
            activeOpacity={0.85}
          >
            <Text style={{ color: 'white', fontWeight: '900' }}>열기 (키보드+Bar)</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={close}
            style={{
              flex: 1,
              backgroundColor: '#111827',
              paddingVertical: 12,
              borderRadius: 12,
              alignItems: 'center',
            }}
            activeOpacity={0.85}
          >
            <Text style={{ color: 'white', fontWeight: '900' }}>닫기</Text>
          </TouchableOpacity>
        </View>

        <View style={{ marginTop: 16, padding: 14, borderRadius: 14, backgroundColor: '#F3F4F6' }}>
          <Text style={{ fontWeight: '900', color: '#111827' }}>상태</Text>
          <Text style={{ marginTop: 6, color: '#374151' }}>platform: {Platform.OS}</Text>
          <Text style={{ marginTop: 6, color: '#374151' }}>log: {log}</Text>
          <Text style={{ marginTop: 6, color: '#374151' }}>isOpen: {String(isOpen)}</Text>
        </View>

        <View style={{ marginTop: 18 }}>
          {Array.from({ length: 16 }).map((_, idx) => (
            <View key={idx} style={{ marginBottom: 12 }}>
              <Text style={{ marginBottom: 6, color: '#6b7280' }}>Dummy Row {idx + 1}</Text>
              <TextInput
                placeholder={`Input ${idx + 1} (키보드 띄우기)`}
                style={{
                  borderWidth: 1,
                  borderColor: '#E5E7EB',
                  borderRadius: 12,
                  paddingHorizontal: 12,
                  paddingVertical: 10,
                  fontSize: 16,
                }}
              />
            </View>
          ))}
        </View>
      </ScrollView>

      {isOpen ? (
        <View
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            borderTopWidth: 1,
            borderTopColor: '#E5E7EB',
            backgroundColor: 'white',
            paddingTop: 10,
            paddingHorizontal: 12,
            paddingBottom: Math.max(insets.bottom, 10),
          }}
        >
          <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
            <View
              style={{
                flex: 1,
                backgroundColor: '#F3F4F6',
                borderRadius: 12,
                paddingHorizontal: 12,
                height: 44,
                justifyContent: 'center',
              }}
            >
              <TextInput
                ref={inputRef}
                placeholder="Quick Bar 입력"
                placeholderTextColor="#9CA3AF"
                value={text}
                onChangeText={setText}
                onSubmitEditing={submit}
                returnKeyType="done"
                style={{ fontSize: 16, color: '#111827' }}
              />
            </View>

            <TouchableOpacity
              onPress={submit}
              style={{
                height: 44,
                paddingHorizontal: 14,
                borderRadius: 12,
                backgroundColor: '#3b82f6',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              activeOpacity={0.85}
            >
              <Text style={{ color: 'white', fontWeight: '900' }}>등록</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : null}
    </View>
  );
}

export default function QuickBarNativeTestScreen() {
  const router = useRouter();
  const [demo, setDemo] = useState(Platform.OS === 'ios' ? DEMO.IOS_ACCESSORY : DEMO.ANDROID_RESIZE);

  return (
    <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1, backgroundColor: 'white' }}>
      <View
        style={{
          paddingHorizontal: 16,
          paddingVertical: 12,
          borderBottomWidth: 1,
          borderBottomColor: '#E5E7EB',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Text style={{ fontSize: 20, fontWeight: '900', color: '#111827' }}>
          Quick Bar Native Test
        </Text>
        <TouchableOpacity
          onPress={() => router.back()}
          style={{
            paddingHorizontal: 12,
            paddingVertical: 8,
            borderRadius: 12,
            backgroundColor: '#111827',
          }}
          activeOpacity={0.85}
        >
          <Text style={{ color: 'white', fontWeight: '800' }}>닫기</Text>
        </TouchableOpacity>
      </View>

      <View style={{ flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingVertical: 12 }}>
        <SegmentButton
          selected={demo === DEMO.IOS_ACCESSORY}
          label="iOS InputAccessoryView"
          onPress={() => setDemo(DEMO.IOS_ACCESSORY)}
        />
        <SegmentButton
          selected={demo === DEMO.ANDROID_RESIZE}
          label="Android resize Bar"
          onPress={() => setDemo(DEMO.ANDROID_RESIZE)}
        />
      </View>

      <View style={{ flex: 1 }}>
        {demo === DEMO.IOS_ACCESSORY ? <IOSInputAccessoryToolbarDemo /> : <AndroidResizeBottomBarDemo />}
      </View>
    </SafeAreaView>
  );
}
