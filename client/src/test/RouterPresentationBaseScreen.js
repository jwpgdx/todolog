import React, { useMemo, useState } from 'react';
import { Platform, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';

function defaultClose() {
  if (router.canGoBack()) {
    router.back();
    return;
  }
  router.replace('/test/modals');
}

function CloseButton({ onPress }) {
  return (
    <TouchableOpacity
      onPress={onPress || defaultClose}
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
  );
}

export default function RouterPresentationBaseScreen({ title, description, transparent }) {
  const [value, setValue] = useState('');
  const [expanded, setExpanded] = useState(false);
  const close = defaultClose;
  const rows = useMemo(
    () => Array.from({ length: expanded ? 12 : 4 }, (_, idx) => idx + 1),
    [expanded]
  );

  const body = (
    <>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={{ fontSize: 16, fontWeight: '900', color: '#111827' }}>{title}</Text>
        <CloseButton onPress={close} />
      </View>

      {!!description && (
        <Text style={{ marginTop: 10, color: '#6b7280', lineHeight: 20 }}>{description}</Text>
      )}

      <View style={{ marginTop: 14 }}>
        <Text style={{ fontSize: 13, fontWeight: '800', color: '#111827', marginBottom: 8 }}>
          Input
        </Text>
        <TextInput
          value={value}
          onChangeText={setValue}
          placeholder="Type…"
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

      <View style={{ marginTop: 16 }}>
        <Text style={{ fontSize: 13, fontWeight: '800', color: '#111827', marginBottom: 8 }}>
          Platform
        </Text>
        <Text style={{ color: '#374151' }}>{Platform.OS}</Text>
      </View>

      <View style={{ marginTop: 14 }}>
        <TouchableOpacity
          onPress={() => setExpanded((prev) => !prev)}
          style={{
            backgroundColor: expanded ? '#111827' : '#3b82f6',
            paddingVertical: 10,
            borderRadius: 12,
            alignItems: 'center',
          }}
          activeOpacity={0.85}
        >
          <Text style={{ color: 'white', fontWeight: '900' }}>
            {expanded ? '긴 컨텐츠 접기' : '긴 컨텐츠 펼치기'}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={{ marginTop: 16 }}>
        <Text style={{ fontSize: 13, fontWeight: '800', color: '#111827', marginBottom: 8 }}>
          Scroll stress
        </Text>
        {rows.map((n) => (
          <View key={n} style={{ marginBottom: 10 }}>
            <Text style={{ color: '#6b7280', marginBottom: 6 }}>Row {n}</Text>
            <View
              style={{
                height: 14,
                borderRadius: 10,
                backgroundColor: '#F3F4F6',
              }}
            />
          </View>
        ))}
      </View>
    </>
  );

  if (transparent) {
    return (
      <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1, backgroundColor: 'transparent' }}>
        <View style={{ flex: 1 }}>
          <TouchableOpacity
            onPress={close}
            activeOpacity={1}
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              top: 0,
              bottom: 0,
              backgroundColor: 'rgba(0,0,0,0.45)',
            }}
          />
          <View style={{ flex: 1, justifyContent: 'flex-end', padding: 16 }}>
            <View
              style={{
                backgroundColor: 'white',
                borderRadius: 18,
                borderWidth: 1,
                borderColor: '#e5e7eb',
                maxHeight: '75%',
                overflow: 'hidden',
              }}
            >
              <View
                style={{
                  paddingHorizontal: 16,
                  paddingTop: 16,
                  paddingBottom: 12,
                  borderBottomWidth: 1,
                  borderBottomColor: '#e5e7eb',
                }}
              >
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <Text style={{ fontSize: 16, fontWeight: '900', color: '#111827' }}>
                    {title}
                  </Text>
                  <CloseButton onPress={close} />
                </View>
              </View>

              <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 24 }}>
                {!!description && (
                  <Text style={{ color: '#6b7280', lineHeight: 20 }}>{description}</Text>
                )}

                <View style={{ marginTop: 14 }}>
                  <Text style={{ fontSize: 13, fontWeight: '800', color: '#111827', marginBottom: 8 }}>
                    Input
                  </Text>
                  <TextInput
                    value={value}
                    onChangeText={setValue}
                    placeholder="Type…"
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

                <View style={{ marginTop: 16 }}>
                  <Text style={{ fontSize: 13, fontWeight: '800', color: '#111827', marginBottom: 8 }}>
                    Platform
                  </Text>
                  <Text style={{ color: '#374151' }}>{Platform.OS}</Text>
                </View>

                <View style={{ marginTop: 14 }}>
                  <TouchableOpacity
                    onPress={() => setExpanded((prev) => !prev)}
                    style={{
                      backgroundColor: expanded ? '#111827' : '#3b82f6',
                      paddingVertical: 10,
                      borderRadius: 12,
                      alignItems: 'center',
                    }}
                    activeOpacity={0.85}
                  >
                    <Text style={{ color: 'white', fontWeight: '900' }}>
                      {expanded ? '긴 컨텐츠 접기' : '긴 컨텐츠 펼치기'}
                    </Text>
                  </TouchableOpacity>
                </View>

                <View style={{ marginTop: 16 }}>
                  <Text style={{ fontSize: 13, fontWeight: '800', color: '#111827', marginBottom: 8 }}>
                    Scroll stress
                  </Text>
                  {rows.map((n) => (
                    <View key={n} style={{ marginBottom: 10 }}>
                      <Text style={{ color: '#6b7280', marginBottom: 6 }}>Row {n}</Text>
                      <View
                        style={{
                          height: 14,
                          borderRadius: 10,
                          backgroundColor: '#F3F4F6',
                        }}
                      />
                    </View>
                  ))}
                </View>
              </ScrollView>
            </View>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1, backgroundColor: 'white' }}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
        <View
          style={{
            backgroundColor: 'white',
            borderRadius: 18,
            padding: 16,
            borderWidth: 1,
            borderColor: '#e5e7eb',
          }}
        >
          {body}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
