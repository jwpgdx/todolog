import React, { useState } from 'react';
import { Platform, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';

export default function FormSheetFitToContentsTestScreen() {
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');

  return (
    <SafeAreaView edges={['top', 'bottom']} style={{ backgroundColor: 'white' }}>
      {/* fitToContents는 "flex: 1"을 피하고, 콘텐츠 높이로 시트가 잡히는지 확인용 */}
      <View style={{ padding: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={{ fontSize: 18, fontWeight: '900', color: '#111827' }}>
            FormSheet fitToContents
          </Text>
          <TouchableOpacity
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/test/modals'))}
            style={{
              paddingHorizontal: 12,
              paddingVertical: 8,
              borderRadius: 10,
              backgroundColor: '#111827',
            }}
            activeOpacity={0.85}
          >
            <Text style={{ color: 'white', fontWeight: '800' }}>닫기</Text>
          </TouchableOpacity>
        </View>

        <Text style={{ marginTop: 10, color: '#6b7280', lineHeight: 20 }}>
          Platform: {Platform.OS}
          {'\n'}
          sheetAllowedDetents: "fitToContents" 테스트용 화면입니다.
        </Text>

        <View style={{ marginTop: 16 }}>
          <Text style={{ fontSize: 13, fontWeight: '800', color: '#111827', marginBottom: 8 }}>
            Title
          </Text>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="Enter title"
            style={{
              borderWidth: 1,
              borderColor: '#e5e7eb',
              borderRadius: 12,
              paddingHorizontal: 12,
              paddingVertical: 10,
              fontSize: 16,
            }}
          />
        </View>

        <View style={{ marginTop: 14 }}>
          <Text style={{ fontSize: 13, fontWeight: '800', color: '#111827', marginBottom: 8 }}>
            Notes (multiline)
          </Text>
          <TextInput
            value={notes}
            onChangeText={setNotes}
            placeholder="Type something…"
            multiline
            style={{
              minHeight: 120,
              borderWidth: 1,
              borderColor: '#e5e7eb',
              borderRadius: 12,
              paddingHorizontal: 12,
              paddingVertical: 10,
              fontSize: 16,
              textAlignVertical: 'top',
            }}
          />
        </View>

        <View style={{ height: 18 }} />

        <View style={{ padding: 12, borderRadius: 12, backgroundColor: '#F3F4F6' }}>
          <Text style={{ fontWeight: '900', color: '#111827' }}>메모</Text>
          <Text style={{ marginTop: 6, color: '#374151', lineHeight: 20 }}>
            - fitToContents는 콘텐츠 높이에 맞춰 시트가 잡히는지 확인합니다.{'\n'}- flex: 1
            레이아웃을 쓰면 의도대로 안 나올 수 있어요.
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

