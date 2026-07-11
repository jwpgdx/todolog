import React from 'react';
import { ScrollView, Text, View } from 'react-native';
import { Stack, usePathname } from 'expo-router';

const VARIANT_COPY = {
  push: {
    title: 'Push 테스트',
    badge: 'card / push',
    description: '일반 화면 전환입니다. 뒤로가기로 이전 화면으로 돌아갑니다.',
  },
  modal: {
    title: 'Modal 테스트',
    badge: 'modal',
    description: 'Expo Router modal screen입니다. 화면 단위 폼이나 플로우에 쓰는 후보입니다.',
  },
  formsheet: {
    title: 'FormSheet 테스트',
    badge: 'formSheet',
    description: '아래에서 올라오는 sheet 비교용입니다. 짧은 선택/액션 UI 후보입니다.',
  },
};

function resolveVariant(pathname) {
  if (pathname.includes('formsheet')) return 'formsheet';
  if (pathname.includes('modal')) return 'modal';
  return 'push';
}

export default function PresentationSandboxScreen() {
  const pathname = usePathname();
  const variant = resolveVariant(pathname);
  const copy = VARIANT_COPY[variant];

  return (
    <>
      <Stack.Screen
        options={{
          title: copy.title,
        }}
      />
      <ScrollView
        className="flex-1 bg-white"
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{ padding: 24, paddingBottom: 96 }}
      >
        <View className="rounded-3xl border border-gray-200 bg-gray-50 p-5">
          <Text className="text-sm font-semibold uppercase tracking-wide text-blue-600">
            {copy.badge}
          </Text>
          <Text className="mt-3 text-3xl font-bold text-gray-950">{copy.title}</Text>
          <Text className="mt-3 text-base leading-6 text-gray-600">{copy.description}</Text>
        </View>

        <View className="mt-6 rounded-2xl border border-gray-200 bg-white p-4">
          <Text className="text-lg font-semibold text-gray-950">확인 포인트</Text>
          <Text className="mt-3 text-base leading-7 text-gray-700">
            1. 어떤 방향에서 열리는지{'\n'}
            2. 뒤 화면이 밀리는지/어두워지는지{'\n'}
            3. 뒤로가기 또는 스와이프 닫기가 자연스러운지{'\n'}
            4. 하단 탭바와 겹치는지
          </Text>
        </View>

        <View className="mt-6 h-40 rounded-2xl bg-gray-100" />
      </ScrollView>
    </>
  );
}
