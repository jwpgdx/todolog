import React, { useMemo } from 'react';
import { Platform, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

function HubButton({ label, description, onPress }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={{
        paddingVertical: 12,
        paddingHorizontal: 14,
        borderRadius: 14,
        backgroundColor: '#111827',
      }}
      activeOpacity={0.85}
    >
      <Text style={{ color: 'white', fontWeight: '900', fontSize: 14 }}>{label}</Text>
      {!!description && (
        <Text style={{ marginTop: 6, color: '#D1D5DB', lineHeight: 18, fontSize: 12 }}>
          {description}
        </Text>
      )}
    </TouchableOpacity>
  );
}

export default function ModalsTestHubScreen() {
  const router = useRouter();

  const entries = useMemo(
    () => [
      {
        label: "Router presentation: 'modal'",
        description: 'iOS: 모달 / Android: 모달 / Web: 라우트 전환',
        href: '/test/presentation-modal',
      },
      {
        label: "Router presentation: 'pageSheet'",
        description: 'iOS: pageSheet / Android: modal fallback 가능',
        href: '/test/presentation-page-sheet',
      },
      {
        label: "Router presentation: 'transparentModal'",
        description: '배경이 보이도록(투명 컨테이너 + 오버레이 카드)',
        href: '/test/presentation-transparent-modal',
      },
      {
        label: "Router presentation: 'fullScreenModal'",
        description: 'iOS에서 풀스크린 모달로 표시되는지 확인',
        href: '/test/presentation-fullscreen-modal',
      },
      {
        label: "Router presentation: 'containedModal'",
        description: 'iOS: currentContext 스타일 / Android: modal fallback',
        href: '/test/presentation-contained-modal',
      },
      {
        label: "Router presentation: 'containedTransparentModal'",
        description: 'iOS: overCurrentContext 스타일 / Android: transparentModal fallback',
        href: '/test/presentation-contained-transparent-modal',
      },
      {
        label: "Router presentation: 'formSheet' (detents)",
        description: '기존 /test/form-sheet 재사용',
        href: '/test/form-sheet',
      },
      {
        label: "Router presentation: 'formSheet' (fitToContents)",
        description: "sheetAllowedDetents: 'fitToContents' 테스트",
        href: '/test/form-sheet-fit',
      },
      {
        label: 'RN Modal: iOS pageSheet',
        description: 'RN Modal presentationStyle="pageSheet" (Android/Web은 fallback)',
        href: '/test/page-sheet',
      },
    ],
    []
  );

  return (
    <SafeAreaView
      edges={['top', 'bottom']}
      style={{
        flex: 1,
        backgroundColor: '#FFFFFF',
        borderWidth: 10,
        borderColor: '#F97316',
      }}
    >
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={{ fontSize: 20, fontWeight: '900' }}>Modals Test Hub</Text>
          <TouchableOpacity
            onPress={() => router.back()}
            style={{
              paddingHorizontal: 12,
              paddingVertical: 8,
              borderRadius: 10,
              backgroundColor: '#111827',
            }}
            activeOpacity={0.85}
          >
            <Text style={{ color: 'white', fontWeight: '800' }}>뒤로</Text>
          </TouchableOpacity>
        </View>

        <Text style={{ marginTop: 10, color: '#6b7280', lineHeight: 20 }}>
          Platform: {Platform.OS}
          {'\n'}
          - 이 화면의 주황색 프레임이 sheet/modal 뒤에서 “축소/딤” 되는지 보면 차이가 잘 보입니다.
          {'\n'}
          - Web은 “모달”이라도 기본적으로 라우트 전환처럼 보일 수 있어요.
          {'\n'}
          - iOS/Android는 native-stack(rn-screens) presentation 차이를 확인합니다.
        </Text>

        <View style={{ marginTop: 16, gap: 12 }}>
          {entries.map((entry) => (
            <HubButton
              key={entry.href}
              label={entry.label}
              description={entry.description}
              onPress={() => router.push(entry.href)}
            />
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
