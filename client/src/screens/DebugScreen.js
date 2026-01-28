import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { todoAPI } from '../api/todos';
import { loadTodos, saveTodos, upsertTodo, removeTodo } from '../storage/todoStorage';
import { getPendingChanges, addPendingChange, clearPendingChanges } from '../storage/pendingChangesStorage';
import NetInfo from '@react-native-community/netinfo';

export default function DebugScreen() {
  const [logs, setLogs] = useState([]);
  const queryClient = useQueryClient();

  const addLog = (message) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [`[${timestamp}] ${message}`, ...prev].slice(0, 50));
  };

  // 1. 네트워크 상태 확인
  const checkNetwork = async () => {
    const netInfo = await NetInfo.fetch();
    addLog(`🌐 네트워크: ${netInfo.isConnected ? '온라인' : '오프라인'} (${netInfo.type})`);
  };

  // 2. 로컬 저장소 확인
  const checkLocalStorage = async () => {
    const todos = await loadTodos();
    const pending = await getPendingChanges();
    addLog(`📦 로컬 저장소: ${todos.length}개 할일, ${pending.length}개 대기 중`);
  };

  // 3. 캐시 확인
  const checkCache = () => {
    const date = '2026-01-27';
    const cachedTodos = queryClient.getQueryData(['todos', date]);
    const allTodos = queryClient.getQueryData(['todos', 'all']);
    addLog(`💾 캐시: 날짜별 ${cachedTodos?.length || 0}개, 전체 ${allTodos?.length || 0}개`);
  };

  // 4. 오프라인 일정 생성
  const createOfflineTodo = async () => {
    try {
      const tempId = `temp_${Date.now()}_test`;
      const newTodo = {
        _id: tempId,
        title: `오프라인 테스트 ${new Date().toLocaleTimeString()}`,
        categoryId: '6974f9574a71170933652243',
        isAllDay: true,
        startDate: '2026-01-27',
        endDate: '2026-01-27',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        syncStatus: 'pending',
      };

      await upsertTodo(newTodo);
      await addPendingChange({
        type: 'create',
        tempId,
        data: {
          title: newTodo.title,
          categoryId: newTodo.categoryId,
          isAllDay: newTodo.isAllDay,
          startDate: newTodo.startDate,
          endDate: newTodo.endDate,
        },
      });

      // 캐시 업데이트
      const allTodos = await loadTodos();
      queryClient.setQueryData(['todos', 'all'], allTodos);
      
      const todosForDate = allTodos.filter(todo => {
        if (todo.isAllDay) {
          const todoStart = todo.startDate;
          const todoEnd = todo.endDate || todo.startDate;
          return '2026-01-27' >= todoStart && '2026-01-27' <= todoEnd;
        }
        return false;
      });
      queryClient.setQueryData(['todos', '2026-01-27'], todosForDate);

      addLog(`✅ 오프라인 생성: ${newTodo.title} (${todosForDate.length}개)`);
    } catch (error) {
      addLog(`❌ 오프라인 생성 실패: ${error.message}`);
    }
  };

  // 5. 온라인 일정 생성
  const createOnlineTodo = async () => {
    try {
      const netInfo = await NetInfo.fetch();
      if (!netInfo.isConnected) {
        addLog(`⚠️ 오프라인 상태 - 서버 연결 필요`);
        return;
      }

      const newTodo = {
        title: `온라인 테스트 ${new Date().toLocaleTimeString()}`,
        categoryId: '6974f9574a71170933652243',
        isAllDay: true,
        startDate: '2026-01-27',
        endDate: '2026-01-27',
      };

      const res = await todoAPI.createTodo(newTodo);
      await upsertTodo(res.data);
      
      queryClient.invalidateQueries({ queryKey: ['todos'] });
      addLog(`✅ 온라인 생성: ${res.data.title}`);
    } catch (error) {
      addLog(`❌ 온라인 생성 실패: ${error.message}`);
    }
  };

  // 6. 오프라인 일정 삭제
  const deleteOfflineTodo = async () => {
    try {
      const allTodos = await loadTodos();
      const todosForDate = allTodos.filter(todo => {
        if (todo.isAllDay) {
          const todoStart = todo.startDate;
          const todoEnd = todo.endDate || todo.startDate;
          return '2026-01-27' >= todoStart && '2026-01-27' <= todoEnd;
        } else if (todo.startDateTime) {
          const todoDateStr = todo.startDateTime.split('T')[0];
          return todoDateStr === '2026-01-27';
        }
        return false;
      });

      if (todosForDate.length === 0) {
        addLog(`⚠️ 삭제할 일정 없음`);
        return;
      }

      const todoToDelete = todosForDate[0];
      
      // 로컬에서 삭제
      await removeTodo(todoToDelete._id);
      
      // Pending Changes에 추가
      await addPendingChange({
        type: 'delete',
        todoId: todoToDelete._id,
      });

      // 캐시 업데이트
      const updatedTodos = await loadTodos();
      queryClient.setQueryData(['todos', 'all'], updatedTodos);
      
      const updatedTodosForDate = updatedTodos.filter(todo => {
        if (todo.isAllDay) {
          const todoStart = todo.startDate;
          const todoEnd = todo.endDate || todo.startDate;
          return '2026-01-27' >= todoStart && '2026-01-27' <= todoEnd;
        } else if (todo.startDateTime) {
          const todoDateStr = todo.startDateTime.split('T')[0];
          return todoDateStr === '2026-01-27';
        }
        return false;
      });
      queryClient.setQueryData(['todos', '2026-01-27'], updatedTodosForDate);

      addLog(`✅ 오프라인 삭제: ${todoToDelete.title} (${updatedTodosForDate.length}개)`);
    } catch (error) {
      addLog(`❌ 오프라인 삭제 실패: ${error.message}`);
    }
  };

  // 7. 온라인 일정 삭제
  const deleteOnlineTodo = async () => {
    try {
      const netInfo = await NetInfo.fetch();
      if (!netInfo.isConnected) {
        addLog(`⚠️ 오프라인 상태 - 서버 연결 필요`);
        return;
      }

      const allTodos = await loadTodos();
      const todosForDate = allTodos.filter(todo => {
        if (todo.isAllDay) {
          const todoStart = todo.startDate;
          const todoEnd = todo.endDate || todo.startDate;
          return '2026-01-27' >= todoStart && '2026-01-27' <= todoEnd;
        } else if (todo.startDateTime) {
          const todoDateStr = todo.startDateTime.split('T')[0];
          return todoDateStr === '2026-01-27';
        }
        return false;
      });

      if (todosForDate.length === 0) {
        addLog(`⚠️ 삭제할 일정 없음`);
        return;
      }

      const todoToDelete = todosForDate[0];
      
      // 서버에서 삭제
      await todoAPI.deleteTodo(todoToDelete._id);
      
      // 로컬에서도 삭제
      await removeTodo(todoToDelete._id);

      // 캐시 업데이트
      queryClient.invalidateQueries({ queryKey: ['todos'] });
      
      addLog(`✅ 온라인 삭제: ${todoToDelete.title}`);
    } catch (error) {
      addLog(`❌ 온라인 삭제 실패: ${error.message}`);
    }
  };

  // 8. 오프라인 일정 수정
  const updateOfflineTodo = async () => {
    try {
      const allTodos = await loadTodos();
      const todosForDate = allTodos.filter(todo => {
        if (todo.isAllDay) {
          const todoStart = todo.startDate;
          const todoEnd = todo.endDate || todo.startDate;
          return '2026-01-27' >= todoStart && '2026-01-27' <= todoEnd;
        } else if (todo.startDateTime) {
          const todoDateStr = todo.startDateTime.split('T')[0];
          return todoDateStr === '2026-01-27';
        }
        return false;
      });

      if (todosForDate.length === 0) {
        addLog(`⚠️ 수정할 일정 없음`);
        return;
      }

      const todoToUpdate = todosForDate[0];
      const updatedData = {
        title: `${todoToUpdate.title} (수정됨)`,
      };

      // 로컬에서 수정
      const todos = await loadTodos();
      const index = todos.findIndex(t => t._id === todoToUpdate._id);
      if (index !== -1) {
        todos[index] = {
          ...todos[index],
          ...updatedData,
          updatedAt: new Date().toISOString(),
          syncStatus: 'pending',
        };
        await upsertTodo(todos[index]);
      }

      // Pending Changes에 추가
      await addPendingChange({
        type: 'update',
        todoId: todoToUpdate._id,
        data: updatedData,
      });

      // 캐시 업데이트
      const updatedTodos = await loadTodos();
      queryClient.setQueryData(['todos', 'all'], updatedTodos);
      
      const updatedTodosForDate = updatedTodos.filter(todo => {
        if (todo.isAllDay) {
          const todoStart = todo.startDate;
          const todoEnd = todo.endDate || todo.startDate;
          return '2026-01-27' >= todoStart && '2026-01-27' <= todoEnd;
        } else if (todo.startDateTime) {
          const todoDateStr = todo.startDateTime.split('T')[0];
          return todoDateStr === '2026-01-27';
        }
        return false;
      });
      queryClient.setQueryData(['todos', '2026-01-27'], updatedTodosForDate);

      addLog(`✅ 오프라인 수정: ${todos[index].title}`);
    } catch (error) {
      addLog(`❌ 오프라인 수정 실패: ${error.message}`);
    }
  };

  // 9. 온라인 일정 수정
  const updateOnlineTodo = async () => {
    try {
      const netInfo = await NetInfo.fetch();
      if (!netInfo.isConnected) {
        addLog(`⚠️ 오프라인 상태 - 서버 연결 필요`);
        return;
      }

      const allTodos = await loadTodos();
      const todosForDate = allTodos.filter(todo => {
        if (todo.isAllDay) {
          const todoStart = todo.startDate;
          const todoEnd = todo.endDate || todo.startDate;
          return '2026-01-27' >= todoStart && '2026-01-27' <= todoEnd;
        } else if (todo.startDateTime) {
          const todoDateStr = todo.startDateTime.split('T')[0];
          return todoDateStr === '2026-01-27';
        }
        return false;
      });

      if (todosForDate.length === 0) {
        addLog(`⚠️ 수정할 일정 없음`);
        return;
      }

      const todoToUpdate = todosForDate[0];
      const updatedData = {
        title: `${todoToUpdate.title} (온라인수정)`,
      };

      // 서버에서 수정
      const res = await todoAPI.updateTodo(todoToUpdate._id, updatedData);
      
      // 로컬에도 저장
      await upsertTodo(res.data);

      // 캐시 업데이트
      queryClient.invalidateQueries({ queryKey: ['todos'] });
      
      addLog(`✅ 온라인 수정: ${res.data.title}`);
    } catch (error) {
      addLog(`❌ 온라인 수정 실패: ${error.message}`);
    }
  };

  // 10. Pending Changes 처리
  const processPending = async () => {
    try {
      const pending = await getPendingChanges();
      addLog(`🔄 Pending 처리 시작: ${pending.length}개`);

      let success = 0;
      for (const change of pending) {
        try {
          if (change.type === 'create') {
            await todoAPI.createTodo(change.data);
            await removeTodo(change.tempId);
            success++;
          } else if (change.type === 'delete') {
            await todoAPI.deleteTodo(change.todoId);
            success++;
          } else if (change.type === 'update') {
            await todoAPI.updateTodo(change.todoId, change.data);
            success++;
          }
        } catch (err) {
          addLog(`❌ Pending 처리 실패: ${err.message}`);
        }
      }

      await clearPendingChanges();
      addLog(`✅ Pending 처리 완료: ${success}/${pending.length}`);
      
      // 로컬 데이터 재로드 및 캐시 업데이트
      const allTodos = await loadTodos();
      queryClient.setQueryData(['todos', 'all'], allTodos);
      
      // 날짜별 캐시도 업데이트
      const todosForDate = allTodos.filter(todo => {
        if (todo.isAllDay) {
          const todoStart = todo.startDate;
          const todoEnd = todo.endDate || todo.startDate;
          return '2026-01-27' >= todoStart && '2026-01-27' <= todoEnd;
        } else if (todo.startDateTime) {
          const todoDateStr = todo.startDateTime.split('T')[0];
          return todoDateStr === '2026-01-27';
        }
        return false;
      });
      queryClient.setQueryData(['todos', '2026-01-27'], todosForDate);
      addLog(`✅ 캐시 업데이트: 날짜별 ${todosForDate.length}개`);
    } catch (error) {
      addLog(`❌ Pending 처리 실패: ${error.message}`);
    }
  };

  // 11. 델타 동기화
  const deltaSync = async () => {
    try {
      const netInfo = await NetInfo.fetch();
      if (!netInfo.isConnected) {
        addLog(`⚠️ 오프라인 상태 - 서버 연결 필요`);
        return;
      }

      const lastSyncTime = new Date(Date.now() - 60000).toISOString(); // 1분 전
      const res = await todoAPI.getDeltaSync(lastSyncTime);
      addLog(`✅ 델타 동기화: ${res.data.updated.length}개 업데이트, ${res.data.deleted.length}개 삭제`);
    } catch (error) {
      addLog(`❌ 델타 동기화 실패: ${error.message}`);
    }
  };

  // 12. 반복 일정 생성 - 매일
  const createDailyRecurrence = async () => {
    try {
      const netInfo = await NetInfo.fetch();
      if (!netInfo.isConnected) {
        addLog(`⚠️ 오프라인 상태 - 서버 연결 필요`);
        return;
      }

      const newTodo = {
        title: `매일 반복 ${new Date().toLocaleTimeString()}`,
        categoryId: '6974f9574a71170933652243',
        isAllDay: true,
        startDate: '2026-01-27',
        endDate: '2026-01-27',
        frequency: 'daily',
        recurrenceEndDate: '2026-02-10', // 2주간
        userTimeZone: 'Asia/Seoul',
      };

      const response = await todoAPI.createTodo(newTodo);
      await upsertTodo(response.data);
      queryClient.invalidateQueries({ queryKey: ['todos'] });
      
      addLog(`✅ 매일 반복 생성: ${response.data.title}`);
    } catch (error) {
      addLog(`❌ 매일 반복 생성 실패: ${error.message}`);
    }
  };

  // 13. 반복 일정 생성 - 매주
  const createWeeklyRecurrence = async () => {
    try {
      const netInfo = await NetInfo.fetch();
      if (!netInfo.isConnected) {
        addLog(`⚠️ 오프라인 상태 - 서버 연결 필요`);
        return;
      }

      const newTodo = {
        title: `매주 월수금 ${new Date().toLocaleTimeString()}`,
        categoryId: '6974f9574a71170933652243',
        isAllDay: true,
        startDate: '2026-01-27',
        endDate: '2026-01-27',
        frequency: 'weekly',
        weekdays: [1, 3, 5], // 월, 수, 금
        recurrenceEndDate: '2026-03-01', // 1개월간
        userTimeZone: 'Asia/Seoul',
      };

      const response = await todoAPI.createTodo(newTodo);
      await upsertTodo(response.data);
      queryClient.invalidateQueries({ queryKey: ['todos'] });
      
      addLog(`✅ 매주 반복 생성: ${response.data.title} (월수금)`);
    } catch (error) {
      addLog(`❌ 매주 반복 생성 실패: ${error.message}`);
    }
  };

  // 14. 반복 일정 생성 - 매월
  const createMonthlyRecurrence = async () => {
    try {
      const netInfo = await NetInfo.fetch();
      if (!netInfo.isConnected) {
        addLog(`⚠️ 오프라인 상태 - 서버 연결 필요`);
        return;
      }

      const newTodo = {
        title: `매월 1일, 15일 ${new Date().toLocaleTimeString()}`,
        categoryId: '6974f9574a71170933652243',
        isAllDay: true,
        startDate: '2026-01-27',
        endDate: '2026-01-27',
        frequency: 'monthly',
        dayOfMonth: [1, 15], // 매월 1일, 15일
        recurrenceEndDate: '2026-06-30', // 6개월간
        userTimeZone: 'Asia/Seoul',
      };

      const response = await todoAPI.createTodo(newTodo);
      await upsertTodo(response.data);
      queryClient.invalidateQueries({ queryKey: ['todos'] });
      
      addLog(`✅ 매월 반복 생성: ${response.data.title} (1일, 15일)`);
    } catch (error) {
      addLog(`❌ 매월 반복 생성 실패: ${error.message}`);
    }
  };

  // 15. 반복 일정 생성 - 매년
  const createYearlyRecurrence = async () => {
    try {
      const netInfo = await NetInfo.fetch();
      if (!netInfo.isConnected) {
        addLog(`⚠️ 오프라인 상태 - 서버 연결 필요`);
        return;
      }

      const newTodo = {
        title: `매년 생일 ${new Date().toLocaleTimeString()}`,
        categoryId: '6974f9574a71170933652243',
        isAllDay: true,
        startDate: '2026-01-27',
        endDate: '2026-01-27',
        frequency: 'yearly',
        yearlyDate: '01-27', // MM-DD
        userTimeZone: 'Asia/Seoul',
      };

      const response = await todoAPI.createTodo(newTodo);
      await upsertTodo(response.data);
      queryClient.invalidateQueries({ queryKey: ['todos'] });
      
      addLog(`✅ 매년 반복 생성: ${response.data.title} (1월 27일)`);
    } catch (error) {
      addLog(`❌ 매년 반복 생성 실패: ${error.message}`);
    }
  };

  // 16. 반복 일정 수정 - 이 일정만
  const updateSingleOccurrence = async () => {
    try {
      const netInfo = await NetInfo.fetch();
      if (!netInfo.isConnected) {
        addLog(`⚠️ 오프라인 상태 - 서버 연결 필요`);
        return;
      }

      const allTodos = await loadTodos();
      const recurringTodo = allTodos.find(todo => todo.frequency && todo.frequency !== 'none');
      
      if (!recurringTodo) {
        addLog(`⚠️ 반복 일정 없음`);
        return;
      }

      const updatedData = {
        title: `${recurringTodo.title} (단일 수정)`,
        updateType: 'single',
        occurrenceDate: '2026-01-27',
      };

      const response = await todoAPI.updateTodo(recurringTodo._id, updatedData);
      queryClient.invalidateQueries({ queryKey: ['todos'] });
      
      addLog(`✅ 단일 일정 수정: ${response.data.title}`);
    } catch (error) {
      addLog(`❌ 단일 일정 수정 실패: ${error.message}`);
    }
  };

  // 17. 반복 일정 수정 - 모든 일정
  const updateAllOccurrences = async () => {
    try {
      const netInfo = await NetInfo.fetch();
      if (!netInfo.isConnected) {
        addLog(`⚠️ 오프라인 상태 - 서버 연결 필요`);
        return;
      }

      const allTodos = await loadTodos();
      const recurringTodo = allTodos.find(todo => todo.frequency && todo.frequency !== 'none');
      
      if (!recurringTodo) {
        addLog(`⚠️ 반복 일정 없음`);
        return;
      }

      const updatedData = {
        title: `${recurringTodo.title} (전체 수정)`,
        updateType: 'all',
      };

      const response = await todoAPI.updateTodo(recurringTodo._id, updatedData);
      queryClient.invalidateQueries({ queryKey: ['todos'] });
      
      addLog(`✅ 전체 일정 수정: ${response.data.title}`);
    } catch (error) {
      addLog(`❌ 전체 일정 수정 실패: ${error.message}`);
    }
  };

  // 18. 반복 일정 삭제 - 이 일정만
  const deleteSingleOccurrence = async () => {
    try {
      const netInfo = await NetInfo.fetch();
      if (!netInfo.isConnected) {
        addLog(`⚠️ 오프라인 상태 - 서버 연결 필요`);
        return;
      }

      const allTodos = await loadTodos();
      const recurringTodo = allTodos.find(todo => todo.frequency && todo.frequency !== 'none');
      
      if (!recurringTodo) {
        addLog(`⚠️ 반복 일정 없음`);
        return;
      }

      await todoAPI.deleteTodo(recurringTodo._id, {
        deleteType: 'single',
        occurrenceDate: '2026-01-27',
      });
      
      queryClient.invalidateQueries({ queryKey: ['todos'] });
      
      addLog(`✅ 단일 일정 삭제: ${recurringTodo.title} (2026-01-27)`);
    } catch (error) {
      addLog(`❌ 단일 일정 삭제 실패: ${error.message}`);
    }
  };

  // 19. 반복 일정 삭제 - 모든 일정
  const deleteAllOccurrences = async () => {
    try {
      const netInfo = await NetInfo.fetch();
      if (!netInfo.isConnected) {
        addLog(`⚠️ 오프라인 상태 - 서버 연결 필요`);
        return;
      }

      const allTodos = await loadTodos();
      const recurringTodo = allTodos.find(todo => todo.frequency && todo.frequency !== 'none');
      
      if (!recurringTodo) {
        addLog(`⚠️ 반복 일정 없음`);
        return;
      }

      await todoAPI.deleteTodo(recurringTodo._id, {
        deleteType: 'all',
      });
      
      await removeTodo(recurringTodo._id);
      queryClient.invalidateQueries({ queryKey: ['todos'] });
      
      addLog(`✅ 전체 일정 삭제: ${recurringTodo.title}`);
    } catch (error) {
      addLog(`❌ 전체 일정 삭제 실패: ${error.message}`);
    }
  };

  // 20. 전체 초기화
  const resetAll = async () => {
    Alert.alert(
      '전체 초기화',
      '로컬 저장소와 Pending Changes를 모두 삭제하시겠습니까?',
      [
        { text: '취소', style: 'cancel' },
        {
          text: '초기화',
          style: 'destructive',
          onPress: async () => {
            await saveTodos([]);
            await clearPendingChanges();
            queryClient.clear();
            addLog(`🗑️ 전체 초기화 완료`);
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>🔧 델타 동기화 디버그</Text>

      <ScrollView style={styles.buttonContainer}>
        <TouchableOpacity style={styles.button} onPress={checkNetwork}>
          <Text style={styles.buttonText}>🌐 네트워크 상태</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.button} onPress={checkLocalStorage}>
          <Text style={styles.buttonText}>📦 로컬 저장소</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.button} onPress={checkCache}>
          <Text style={styles.buttonText}>💾 캐시 확인</Text>
        </TouchableOpacity>

        <View style={styles.divider} />

        <TouchableOpacity style={[styles.button, styles.createButton]} onPress={createOfflineTodo}>
          <Text style={styles.buttonText}>➕ 오프라인 생성</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.button, styles.createButton]} onPress={createOnlineTodo}>
          <Text style={styles.buttonText}>➕ 온라인 생성</Text>
        </TouchableOpacity>

        <View style={styles.divider} />

        <TouchableOpacity style={[styles.button, styles.deleteButton]} onPress={deleteOfflineTodo}>
          <Text style={styles.buttonText}>🗑️ 오프라인 삭제</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.button, styles.deleteButton]} onPress={deleteOnlineTodo}>
          <Text style={styles.buttonText}>🗑️ 온라인 삭제</Text>
        </TouchableOpacity>

        <View style={styles.divider} />

        <TouchableOpacity style={[styles.button, styles.updateButton]} onPress={updateOfflineTodo}>
          <Text style={styles.buttonText}>📝 오프라인 수정</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.button, styles.updateButton]} onPress={updateOnlineTodo}>
          <Text style={styles.buttonText}>📝 온라인 수정</Text>
        </TouchableOpacity>

        <View style={styles.divider} />

        <TouchableOpacity style={[styles.button, styles.syncButton]} onPress={processPending}>
          <Text style={styles.buttonText}>🔄 Pending 처리</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.button, styles.syncButton]} onPress={deltaSync}>
          <Text style={styles.buttonText}>🔄 델타 동기화</Text>
        </TouchableOpacity>

        <View style={styles.divider} />

        <TouchableOpacity style={[styles.button, styles.dangerButton]} onPress={resetAll}>
          <Text style={styles.buttonText}>🗑️ 전체 초기화</Text>
        </TouchableOpacity>

        <View style={styles.divider} />
        <Text style={styles.sectionTitle}>🔁 반복 일정 테스트</Text>

        <TouchableOpacity style={[styles.button, styles.recurrenceButton]} onPress={createDailyRecurrence}>
          <Text style={styles.buttonText}>📅 매일 반복 생성</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.button, styles.recurrenceButton]} onPress={createWeeklyRecurrence}>
          <Text style={styles.buttonText}>📅 매주 반복 생성 (월수금)</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.button, styles.recurrenceButton]} onPress={createMonthlyRecurrence}>
          <Text style={styles.buttonText}>📅 매월 반복 생성 (1일, 15일)</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.button, styles.recurrenceButton]} onPress={createYearlyRecurrence}>
          <Text style={styles.buttonText}>📅 매년 반복 생성 (생일)</Text>
        </TouchableOpacity>

        <View style={styles.divider} />

        <TouchableOpacity style={[styles.button, styles.updateButton]} onPress={updateSingleOccurrence}>
          <Text style={styles.buttonText}>📝 이 일정만 수정</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.button, styles.updateButton]} onPress={updateAllOccurrences}>
          <Text style={styles.buttonText}>📝 모든 일정 수정</Text>
        </TouchableOpacity>

        <View style={styles.divider} />

        <TouchableOpacity style={[styles.button, styles.deleteButton]} onPress={deleteSingleOccurrence}>
          <Text style={styles.buttonText}>🗑️ 이 일정만 삭제</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.button, styles.deleteButton]} onPress={deleteAllOccurrences}>
          <Text style={styles.buttonText}>🗑️ 모든 일정 삭제</Text>
        </TouchableOpacity>
      </ScrollView>

      <View style={styles.logContainer}>
        <Text style={styles.logTitle}>📋 로그</Text>
        <ScrollView style={styles.logScroll}>
          {logs.map((log, index) => (
            <Text key={index} style={styles.logText}>{log}</Text>
          ))}
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    padding: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  buttonContainer: {
    flex: 1,
    marginBottom: 16,
  },
  button: {
    backgroundColor: '#007AFF',
    padding: 16,
    borderRadius: 8,
    marginBottom: 8,
  },
  createButton: {
    backgroundColor: '#34C759',
  },
  deleteButton: {
    backgroundColor: '#FF9500',
  },
  updateButton: {
    backgroundColor: '#007AFF',
  },
  syncButton: {
    backgroundColor: '#5856D6',
  },
  dangerButton: {
    backgroundColor: '#FF3B30',
  },
  recurrenceButton: {
    backgroundColor: '#AF52DE',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginVertical: 12,
    color: '#333',
  },
  divider: {
    height: 16,
  },
  logContainer: {
    flex: 1,
    backgroundColor: '#1C1C1E',
    borderRadius: 8,
    padding: 12,
  },
  logTitle: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  logScroll: {
    flex: 1,
  },
  logText: {
    color: '#00FF00',
    fontSize: 12,
    fontFamily: 'monospace',
    marginBottom: 4,
  },
});
