import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { createStackNavigator } from '@react-navigation/stack';
import { PageSheet, PageSheetInput } from '../components/ui/page-sheet';

const SheetStack = createStackNavigator();

function BasicFormContent({ onClose }) {
  const [form, setForm] = useState({
    title: '',
    note: '',
    place: '',
    assignee: '',
    tag: '',
    memo: '',
  });

  const updateField = (key) => (value) => {
    setForm((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  return (
    <View style={styles.sheetBody}>
      <Text style={styles.sheetTitle}>기본 폼</Text>
      <Text style={styles.sheetDescription}>
        긴 입력 폼/스크롤/키보드 대응을 확인하는 샘플입니다.
      </Text>

      <ScrollView
        style={styles.formScroll}
        contentContainerStyle={styles.formScrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <PageSheetInput
          label="제목"
          placeholder="제목 입력"
          value={form.title}
          onChangeText={updateField('title')}
        />
        <PageSheetInput
          label="메모"
          placeholder="메모 입력"
          value={form.note}
          onChangeText={updateField('note')}
          multiline
          numberOfLines={5}
        />
        <PageSheetInput
          label="장소"
          placeholder="장소 입력"
          value={form.place}
          onChangeText={updateField('place')}
        />
        <PageSheetInput
          label="담당자"
          placeholder="담당자 입력"
          value={form.assignee}
          onChangeText={updateField('assignee')}
        />
        <PageSheetInput
          label="태그"
          placeholder="태그 입력"
          value={form.tag}
          onChangeText={updateField('tag')}
        />
        <PageSheetInput
          label="추가 메모"
          placeholder="긴 내용 확인용"
          value={form.memo}
          onChangeText={updateField('memo')}
          multiline
          numberOfLines={6}
        />
      </ScrollView>

      <TouchableOpacity style={styles.primaryButton} onPress={onClose}>
        <Text style={styles.primaryButtonText}>닫기</Text>
      </TouchableOpacity>
    </View>
  );
}

function FlowStepOne({ navigation }) {
  const [value, setValue] = useState('');

  return (
    <View style={styles.stackScreen}>
      <Text style={styles.stackTitle}>1단계</Text>
      <Text style={styles.stackDescription}>
        기본 Stack header와 다음 단계 이동을 확인합니다.
      </Text>
      <PageSheetInput
        label="테스트 값"
        placeholder="다음 화면으로 전달"
        value={value}
        onChangeText={setValue}
      />
      <TouchableOpacity
        style={styles.primaryButton}
        onPress={() => navigation.navigate('PageSheetFlowStepTwo', { value })}
      >
        <Text style={styles.primaryButtonText}>다음 단계</Text>
      </TouchableOpacity>
    </View>
  );
}

function FlowStepTwo({ route }) {
  return (
    <View style={styles.stackScreen}>
      <Text style={styles.stackTitle}>2단계</Text>
      <Text style={styles.stackDescription}>
        전달값: {route.params?.value || '(없음)'}
      </Text>
      <Text style={styles.stackFootnote}>
        iOS에서는 기본 Stack header의 back label, Android에서는 hardware back 동작을 확인합니다.
      </Text>
    </View>
  );
}

function InSheetStackFlow() {
  return (
    <View style={styles.stackContainer}>
      <SheetStack.Navigator
        initialRouteName="PageSheetFlowStepOne"
        screenOptions={{
          headerShown: true,
          headerBackTitleVisible: true,
          cardStyle: { backgroundColor: 'white' },
        }}
      >
        <SheetStack.Screen
          name="PageSheetFlowStepOne"
          component={FlowStepOne}
          options={{
            title: '설정',
          }}
        />
        <SheetStack.Screen
          name="PageSheetFlowStepTwo"
          component={FlowStepTwo}
          options={{
            title: '세부 설정',
          }}
        />
      </SheetStack.Navigator>
    </View>
  );
}

export default function PageSheetTestScreen() {
  const [sheetMode, setSheetMode] = useState(null);

  const sheetTitle = useMemo(() => {
    if (sheetMode === 'form') return '기본 폼';
    if (sheetMode === 'stack') return 'Stack 플로우';
    return 'Page Sheet';
  }, [sheetMode]);

  const closeSheet = () => {
    setSheetMode(null);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.screenContent}>
        <Text style={styles.screenTitle}>PageSheet 테스트</Text>
        <Text style={styles.screenDescription}>
          플랫폼별 오버레이와 입력/스크롤/Stack 동작을 빠르게 확인하는 임시 화면입니다.
        </Text>

        <TouchableOpacity style={styles.primaryButton} onPress={() => setSheetMode('form')}>
          <Text style={styles.primaryButtonText}>기본 폼 열기</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.secondaryButton} onPress={() => setSheetMode('stack')}>
          <Text style={styles.secondaryButtonText}>Stack 플로우 열기</Text>
        </TouchableOpacity>
      </ScrollView>

      <PageSheet
        open={sheetMode !== null}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            closeSheet();
          }
        }}
        title={sheetTitle}
        testID="page-sheet-test"
      >
        {sheetMode === 'stack' ? (
          <InSheetStackFlow />
        ) : (
          <BasicFormContent onClose={closeSheet} />
        )}
      </PageSheet>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  screenContent: {
    padding: 20,
    gap: 12,
  },
  screenTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
  },
  screenDescription: {
    fontSize: 14,
    lineHeight: 20,
    color: '#6B7280',
    marginBottom: 12,
  },
  sheetBody: {
    flex: 1,
    paddingHorizontal: 20,
    paddingBottom: 20,
    paddingTop: 12,
    backgroundColor: 'white',
  },
  sheetTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
  },
  sheetDescription: {
    fontSize: 14,
    lineHeight: 20,
    color: '#6B7280',
    marginBottom: 16,
  },
  formScroll: {
    flex: 1,
  },
  formScrollContent: {
    paddingBottom: 24,
  },
  primaryButton: {
    backgroundColor: '#2563EB',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    backgroundColor: 'white',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },
  secondaryButtonText: {
    color: '#111827',
    fontSize: 16,
    fontWeight: '600',
  },
  stackContainer: {
    flex: 1,
    minHeight: 520,
    backgroundColor: 'white',
  },
  stackScreen: {
    flex: 1,
    padding: 20,
    backgroundColor: 'white',
  },
  stackTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
  },
  stackDescription: {
    fontSize: 14,
    lineHeight: 20,
    color: '#6B7280',
    marginBottom: 16,
  },
  stackFootnote: {
    fontSize: 13,
    lineHeight: 18,
    color: '#4B5563',
  },
});
