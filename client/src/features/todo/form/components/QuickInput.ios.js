import React, { useMemo } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

/**
 * QuickInput (iOS)
 * - 실제 입력은 QuickModeContent.ios의 host TextInput이 담당
 * - 여기서는 "입력처럼 보이는 UI" + 액션 버튼만 제공
 */
export default function QuickInput({
  title,
  onRequestFocus,
  onSubmit,
  categoryName = '카테고리',
  onCategoryPress,
  dateLabel = '오늘',
  onDatePress,
  repeatLabel = '안 함',
  onRepeatPress,
}) {
  const canSubmit = useMemo(() => (title ?? '').trim().length > 0, [title]);

  return (
    <View style={styles.container}>
      <View style={styles.row1}>
        <Pressable onPress={onRequestFocus} style={styles.inputContainer}>
          {(title ?? '').length > 0 ? (
            <Text style={styles.inputText} numberOfLines={1}>
              {title}
            </Text>
          ) : (
            <Text style={styles.placeholderText} numberOfLines={1}>
              제목
            </Text>
          )}
        </Pressable>

        <TouchableOpacity
          onPress={onSubmit}
          disabled={!canSubmit}
          style={[styles.submitButton, { backgroundColor: canSubmit ? '#3B82F6' : '#D1D5DB' }]}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-up" size={20} color="white" />
        </TouchableOpacity>
      </View>

      <View style={styles.row2}>
        <TouchableOpacity onPress={onCategoryPress} style={styles.optionButton} activeOpacity={0.7}>
          <Ionicons name="folder-outline" size={14} color="#6B7280" />
          <Text style={styles.optionText} numberOfLines={1}>
            {categoryName}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={onDatePress} style={styles.optionButton} activeOpacity={0.7}>
          <Ionicons name="calendar-outline" size={14} color="#6B7280" />
          <Text style={styles.optionText} numberOfLines={1}>
            {dateLabel}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={onRepeatPress} style={styles.optionButton} activeOpacity={0.7}>
          <Ionicons name="repeat-outline" size={14} color="#6B7280" />
          <Text style={styles.optionText} numberOfLines={1}>
            {repeatLabel}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'white',
  },
  row1: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  inputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 44,
  },
  inputText: {
    flex: 1,
    fontSize: 16,
    color: '#111827',
  },
  placeholderText: {
    flex: 1,
    fontSize: 16,
    color: '#9CA3AF',
  },
  submitButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
  },
  row2: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 12,
  },
  optionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 12,
    height: 32,
    borderRadius: 8,
  },
  optionText: {
    fontSize: 14,
    color: '#4B5563',
    marginLeft: 6,
  },
});

