import React, { useMemo, useState } from 'react';
import { Platform, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

export default function FormSheetTestScreen() {
  const router = useRouter();
  const [title, setTitle] = useState('Sample title');
  const [notes, setNotes] = useState('');
  const [email, setEmail] = useState('');

  const rows = useMemo(() => Array.from({ length: 24 }, (_, idx) => idx + 1), []);

  return (
    <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1, backgroundColor: 'white' }}>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={{ fontSize: 20, fontWeight: '700' }}>Form Sheet Test</Text>
          <TouchableOpacity
            onPress={() => router.back()}
            style={{
              paddingHorizontal: 12,
              paddingVertical: 8,
              borderRadius: 10,
              backgroundColor: '#111827',
            }}
          >
            <Text style={{ color: 'white', fontWeight: '600' }}>닫기</Text>
          </TouchableOpacity>
        </View>

        <Text style={{ marginTop: 10, color: '#6b7280' }}>
          Platform: {Platform.OS} (iOS에서는 native-stack form sheet presentation을 확인)
        </Text>

        <View style={{ marginTop: 18 }}>
          <Text style={{ fontSize: 14, fontWeight: '600', color: '#111827', marginBottom: 8 }}>
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
          <Text style={{ fontSize: 14, fontWeight: '600', color: '#111827', marginBottom: 8 }}>
            Email
          </Text>
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="Enter email"
            autoCapitalize="none"
            keyboardType="email-address"
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
          <Text style={{ fontSize: 14, fontWeight: '600', color: '#111827', marginBottom: 8 }}>
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
          <Text style={{ fontSize: 14, fontWeight: '600', color: '#111827', marginBottom: 10 }}>
            Scroll/keyboard stress
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
  );
}
