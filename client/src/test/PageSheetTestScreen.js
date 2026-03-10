import React, { useMemo, useState } from 'react';
import { Modal, Platform, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

export default function PageSheetTestScreen() {
  const router = useRouter();
  const [visible, setVisible] = useState(false);
  const [title, setTitle] = useState('Sample title');
  const [notes, setNotes] = useState('');

  const rows = useMemo(() => Array.from({ length: 16 }, (_, idx) => idx + 1), []);

  return (
    <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1, backgroundColor: 'white' }}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={{ fontSize: 20, fontWeight: '800' }}>Page Sheet Test</Text>
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
            <Text style={{ color: 'white', fontWeight: '700' }}>뒤로</Text>
          </TouchableOpacity>
        </View>

        <Text style={{ marginTop: 10, color: '#6b7280', lineHeight: 20 }}>
          RN Modal의 presentationStyle="pageSheet" 테스트입니다.{'\n'}
          - iOS: pageSheet로 표시{'\n'}
          - Android/Web: pageSheet가 동일하게 동작하지 않을 수 있음
        </Text>

        <View style={{ marginTop: 16 }}>
          <TouchableOpacity
            onPress={() => setVisible(true)}
            style={{
              backgroundColor: '#3b82f6',
              paddingVertical: 12,
              borderRadius: 12,
              alignItems: 'center',
            }}
            activeOpacity={0.85}
          >
            <Text style={{ color: 'white', fontWeight: '900' }}>Page Sheet 열기</Text>
          </TouchableOpacity>
        </View>

        <View style={{ marginTop: 18, padding: 14, borderRadius: 14, backgroundColor: '#F3F4F6' }}>
          <Text style={{ fontWeight: '900', color: '#111827' }}>Platform</Text>
          <Text style={{ marginTop: 6, color: '#374151' }}>{Platform.OS}</Text>
        </View>
      </ScrollView>

      <Modal
        visible={visible}
        animationType="slide"
        presentationStyle={Platform.OS === 'ios' ? 'pageSheet' : 'fullScreen'}
        onRequestClose={() => setVisible(false)}
        onDismiss={() => setVisible(false)}
      >
        <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1, backgroundColor: 'white' }}>
          <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
            <View
              style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
            >
              <Text style={{ fontSize: 18, fontWeight: '900' }}>Modal (pageSheet)</Text>
              <TouchableOpacity
                onPress={() => setVisible(false)}
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  borderRadius: 10,
                  backgroundColor: '#111827',
                }}
                activeOpacity={0.85}
              >
                <Text style={{ color: 'white', fontWeight: '700' }}>닫기</Text>
              </TouchableOpacity>
            </View>

            <Text style={{ marginTop: 10, color: '#6b7280', lineHeight: 20 }}>
              키보드 대응/인셋 조정은 일부러 넣지 않았습니다. (플랫폼별 기본 동작만 확인)
            </Text>

            <View style={{ marginTop: 18 }}>
              <Text style={{ fontSize: 14, fontWeight: '700', color: '#111827', marginBottom: 8 }}>
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
              <Text style={{ fontSize: 14, fontWeight: '700', color: '#111827', marginBottom: 8 }}>
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

            <View style={{ marginTop: 18 }}>
              <Text style={{ fontSize: 14, fontWeight: '800', color: '#111827', marginBottom: 10 }}>
                Scroll stress
              </Text>
              {rows.map((n) => (
                <View key={n} style={{ marginBottom: 10 }}>
                  <Text style={{ color: '#6b7280', marginBottom: 6 }}>Row {n}</Text>
                  <TextInput
                    placeholder={`Input ${n}`}
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
              ))}
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

