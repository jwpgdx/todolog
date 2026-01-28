const Todo = require('../models/Todo');
const Completion = require('../models/Completion');
const googleCalendar = require('../services/googleCalendar');
const User = require('../models/User');
const { getOccurrences, occursOnDate } = require('../utils/recurrenceUtils');

// 전체 할일 조회 (관리 화면용)
exports.getAllTodos = async (req, res) => {
  try {
    const userId = req.userId;
    const todos = await Todo.find({ userId, deletedAt: null }).sort({ 'order.category': 1, createdAt: -1 });
    res.json(todos);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// 날짜별 할일 조회 (완료 여부 포함)
exports.getTodos = async (req, res) => {
  try {
    const { date } = req.query;
    const userId = req.userId;

    const allTodos = await Todo.find({ userId, deletedAt: null });
    const targetDate = new Date(date + 'T00:00:00');

    // 날짜별 필터링 (하루종일 + 시간 지정 할일 모두 처리)
    const filteredTodos = allTodos.filter(todo => {
      // 하루종일 할일인 경우
      if (todo.isAllDay) {
        // 반복 할일인 경우
        if (todo.recurrence) {
          // RRULE 기반 계산 (startDate를 기준으로 가상의 startDateTime 생성)
          const virtualStartDateTime = new Date(todo.startDate + 'T00:00:00.000Z');
          return occursOnDate(
            todo.recurrence,
            virtualStartDateTime,
            targetDate,
            todo.exdates || []
          );
        } else {
          // 단일 날짜 또는 기간 할일
          const startDateStr = todo.startDate;
          const endDateStr = todo.endDate || todo.startDate;
          return date >= startDateStr && date <= endDateStr;
        }
      } else {
        // 시간 지정 할일인 경우 (기존 로직)
        return occursOnDate(
          todo.recurrence,
          todo.startDateTime,
          targetDate,
          todo.exdates || []
        );
      }
    });

    // 해당 날짜의 완료 기록 조회
    const completions = date
      ? await Completion.find({
        userId,
        $or: [
          { date: date },      // 특정 날짜 완료 (일반 할일, 루틴)
          { date: null },      // 기간 할일 완료 (날짜 없음)
        ]
      })
      : [];

    const completionMap = {};
    completions.forEach(comp => {
      completionMap[comp.todoId.toString()] = true;
    });

    // 완료 여부 추가 및 정렬
    const todosWithCompletion = filteredTodos.map(todo => ({
      _id: todo._id,
      title: todo.title,
      startDateTime: todo.startDateTime,
      startDate: todo.startDate,
      endDateTime: todo.endDateTime,
      endDate: todo.endDate,
      isAllDay: todo.isAllDay,
      recurrence: todo.recurrence,
      recurrenceEndDate: todo.recurrenceEndDate,
      memo: todo.memo,
      order: todo.order || { category: 0 },
      completed: !!completionMap[todo._id.toString()],
      categoryId: todo.categoryId,
      googleCalendarEventId: todo.googleCalendarEventId,
      syncStatus: todo.syncStatus,
      lastSyncAttempt: todo.lastSyncAttempt,
    })).sort((a, b) => {
      const orderA = a.order?.category ?? 0;
      const orderB = b.order?.category ?? 0;
      return orderA - orderB;
    });

    res.json(todosWithCompletion);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// 할일 생성
exports.createTodo = async (req, res) => {
  try {
    console.log('🚀 [createTodo] 할일 생성 요청 받음:', req.body);
    const {
      title,
      memo,
      categoryId,
      userTimeZone,
      startDate,
      startTime,
      endDate,
      endTime,
      recurrence,
      recurrenceEndDate,
      isAllDay: isAllDayFlag
    } = req.body;

    const userId = req.userId;
    console.log('👤 [createTodo] 사용자 ID:', userId);

    // 사용자 시간대 정보 업데이트 (클라이언트에서 전송된 경우)
    if (userTimeZone) {
      await User.findByIdAndUpdate(userId, { $set: { 'settings.timeZone': userTimeZone } });
      console.log('🌍 [createTodo] 사용자 시간대 업데이트:', userTimeZone);
    }

    // 하루종일 할일인지 확인
    const isAllDay = (isAllDayFlag !== undefined) ? isAllDayFlag : (!startTime && !endTime);

    // startDateTime 생성
    let startDateTime = null;
    if (!isAllDay && startDate && startTime) {
      startDateTime = new Date(`${startDate}T${startTime}:00`);
    }

    // endDateTime 생성
    let endDateTime = null;
    if (!isAllDay && endDate && endTime) {
      endDateTime = new Date(`${endDate}T${endTime}:00`);
    }

    const todoData = {
      userId,
      title,
      startDateTime,
      startDate, // yyyy-mm-dd string
      endDateTime,
      endDate: endDate || null,
      isAllDay,
      recurrence: recurrence || null,
      recurrenceEndDate: recurrenceEndDate ? new Date(recurrenceEndDate) : null,
      memo,
      categoryId,
    };

    console.log('📝 [createTodo] Todo 데이터 생성:', todoData);
    const todo = new Todo(todoData);

    await todo.save();
    console.log('✅ [createTodo] Todo 저장 완료:', todo._id);

    // 구글 캘린더 동기화 (모든 할일 동기화)
    console.log('📅 [createTodo] 캘린더 동기화 확인 중...');
    const user = await User.findById(userId);
    const calendarSyncEnabled = user?.settings?.calendarSyncEnabled;
    console.log('👤 [createTodo] 사용자 캘린더 설정:', {
      calendarSyncEnabled,
      hasCalendarAccess: user?.hasCalendarAccess
    });

    if (user && calendarSyncEnabled && user.hasCalendarAccess) {
      try {
        console.log('🔄 [createTodo] 캘린더 동기화 시작...');
        todo.syncStatus = 'pending';
        todo.lastSyncAttempt = new Date();
        await todo.save();

        const googleCalendar = require('../services/googleCalendar');
        console.log('📞 [createTodo] googleCalendar.createEvent 호출...');
        const calendarEvent = await googleCalendar.createEvent(user, todo);

        if (calendarEvent) {
          todo.googleCalendarEventId = calendarEvent.id;
          todo.syncStatus = 'synced';
          await todo.save();
          console.log('✅ [createTodo] 캘린더 동기화 성공:', calendarEvent.id);
        } else {
          console.log('⚠️ [createTodo] 캘린더 이벤트가 생성되지 않음');
        }
      } catch (error) {
        console.error('❌ [createTodo] 캘린더 동기화 실패:', error);
        todo.syncStatus = 'failed';
        await todo.save();
        // 캘린더 동기화 실패해도 Todo 생성은 성공으로 처리
      }
    } else {
      console.log('⏭️ [createTodo] 캘린더 동기화 조건 불충족 - 스킵');
    }

    console.log('🎉 [createTodo] 할일 생성 완료 - 응답 전송');
    res.status(201).json(todo);
  } catch (error) {
    console.error('❌ [createTodo] 할일 생성 중 오류 발생:', error);
    res.status(400).json({ message: error.message, details: error.errors });
  }
};

// 할일 수정
exports.updateTodo = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId;

    // 기존 todo 조회
    const existingTodo = await Todo.findOne({ _id: id, userId });
    if (!existingTodo) {
      return res.status(404).json({ message: '할일을 찾을 수 없습니다' });
    }

    // 업데이트 필드 수동 구성 (안전성 확보)
    const updateOps = {};
    const allowedFields = [
      'title', 'memo', 'categoryId',
      'recurrence', 'recurrenceEndDate',
      'isAllDay',
      'startDate', 'startTime', 'endDate', 'endTime'
    ];

    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) {
        updateOps[field] = req.body[field];
      }
    });

    // 날짜/시간 변경 시 startDateTime/endDateTime 재구성 필요
    // 1. 필요한 모든 데이터 확보 (업데이트된 값 우선, 없으면 기존 값 사용)
    const mergedData = { ...existingTodo.toObject(), ...updateOps };

    // 2. isAllDay 판단 (업데이트된 값 기준)
    const isAllDay = (updateOps.isAllDay !== undefined)
      ? updateOps.isAllDay
      : (!mergedData.startTime && !mergedData.endTime);

    // 3. startDateTime 재구성
    if (!isAllDay && mergedData.startDate && mergedData.startTime) {
      updateOps.startDateTime = new Date(`${mergedData.startDate}T${mergedData.startTime}:00`);
    } else if (isAllDay) {
      updateOps.startDateTime = null;
    }

    // 4. endDateTime 재구성
    if (!isAllDay && mergedData.endDate && mergedData.endTime) {
      updateOps.endDateTime = new Date(`${mergedData.endDate}T${mergedData.endTime}:00`);
    } else if (isAllDay) {
      updateOps.endDateTime = null;
    }

    // Order 필드 별도 처리
    if (req.body.order) {
      if (typeof req.body.order === 'object') {
        if (req.body.order.category !== undefined) updateOps['order.category'] = req.body.order.category;
        if (req.body.order.keep !== undefined) updateOps['order.keep'] = req.body.order.keep;
      }
    }

    if (Object.keys(updateOps).length === 0) {
      return res.status(400).json({ message: '변경할 내용이 없습니다' });
    }

    // todo 업데이트
    const todo = await Todo.findOneAndUpdate(
      { _id: id, userId },
      { $set: updateOps },
      { new: true }
    );

    // 구글 캘린더 동기화 처리
    const user = await User.findById(userId);
    const calendarSyncEnabled = user?.settings?.calendarSyncEnabled;

    if (user && calendarSyncEnabled && user.hasCalendarAccess) {
      try {
        if (todo.googleCalendarEventId) {
          // 기존 이벤트 업데이트
          todo.syncStatus = 'pending';
          todo.lastSyncAttempt = new Date();
          await todo.save();

          const googleCalendar = require('../services/googleCalendar');
          await googleCalendar.updateEvent(user, todo);
          todo.syncStatus = 'synced';
        } else {
          // 새 이벤트 생성 (기존에 동기화되지 않았던 경우)
          todo.syncStatus = 'pending';
          todo.lastSyncAttempt = new Date();
          await todo.save();

          const googleCalendar = require('../services/googleCalendar');
          const calendarEvent = await googleCalendar.createEvent(user, todo);

          if (calendarEvent) {
            todo.googleCalendarEventId = calendarEvent.id;
            todo.syncStatus = 'synced';
          }
        }

        await todo.save();
      } catch (error) {
        console.error('Calendar sync failed during todo update:', error);
        todo.syncStatus = 'failed';
        await todo.save();
        // 캘린더 동기화 실패해도 Todo 수정은 성공으로 처리
      }
    }

    res.json(todo);
  } catch (error) {
    console.error('Update Todo Error:', error);
    res.status(400).json({ message: error.message });
  }
};

// 할일 삭제 (Soft Delete)
exports.deleteTodo = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId;

    // Soft delete: deletedAt 타임스탬프 설정
    const todo = await Todo.findOneAndUpdate(
      { _id: id, userId, deletedAt: null },
      { deletedAt: new Date() },
      { new: true }
    );

    if (!todo) {
      return res.status(404).json({ message: '할일을 찾을 수 없습니다' });
    }

    // 구글 캘린더 이벤트 삭제
    if (todo.googleCalendarEventId) {
      const user = await User.findById(userId);

      if (user && user.hasCalendarAccess) {
        try {
          const googleCalendar = require('../services/googleCalendar');
          await googleCalendar.deleteEvent(user, todo.googleCalendarEventId);
          console.log(`Calendar event deleted for todo: ${todo.title}`);
        } catch (error) {
          console.error('Calendar event deletion failed:', error);
          // 캘린더 이벤트 삭제 실패해도 Todo 삭제는 성공으로 처리
        }
      }
    }

    // 관련 완료 기록도 삭제
    await Completion.deleteMany({ todoId: id });

    res.json({ message: '삭제 완료', deletedTodo: todo });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// 월별 이벤트 조회 (클라이언트 RRule 전개용)
exports.getMonthEvents = async (req, res) => {
  try {
    const { year, month } = req.params;
    const userId = req.userId;

    if (!year || !month) {
      return res.status(400).json({ message: 'year와 month가 필요합니다' });
    }

    const yearNum = parseInt(year);
    const monthNum = parseInt(month);

    // 해당 월의 시작일과 종료일
    const monthStart = new Date(yearNum, monthNum - 1, 1);
    const monthEnd = new Date(yearNum, monthNum, 0);
    const monthStartStr = `${yearNum}-${String(monthNum).padStart(2, '0')}-01`;
    const monthEndStr = `${yearNum}-${String(monthNum).padStart(2, '0')}-${String(monthEnd.getDate()).padStart(2, '0')}`;

    // 이 월에 "터치"하는 모든 Todo 조회
    // 조건: 
    // 1. 반복 일정: 시작일이 월 종료 전이고, 종료일이 없거나 월 시작 후인 경우
    // 2. 단일 일정: 시작일이 월 내에 있거나, 기간 일정이라면 기간이 월과 겹치는 경우
    const todos = await Todo.find({
      userId,
      deletedAt: null,  // Soft delete된 일정 제외
      $or: [
        // 반복 일정 (recurrence가 있는 경우)
        {
          recurrence: { $ne: null },
          startDate: { $lte: monthEndStr },
          $or: [
            { recurrenceEndDate: null },
            { recurrenceEndDate: { $gte: monthStart } }
          ]
        },
        // 단일/기간 일정 (recurrence가 없는 경우)
        {
          recurrence: null,
          $or: [
            // 시작일이 월 내에 있는 경우
            { startDate: { $gte: monthStartStr, $lte: monthEndStr } },
            // 종료일이 월 내에 있는 경우
            { endDate: { $gte: monthStartStr, $lte: monthEndStr } },
            // 기간이 월을 포함하는 경우
            {
              startDate: { $lte: monthStartStr },
              endDate: { $gte: monthEndStr }
            }
          ]
        }
      ]
    }).populate('categoryId', 'color name');

    // 필요한 필드만 추출하여 반환
    const events = todos.map(todo => ({
      _id: todo._id,
      title: todo.title,
      startDate: todo.startDate,
      endDate: todo.endDate,
      startDateTime: todo.startDateTime,
      endDateTime: todo.endDateTime,
      isAllDay: todo.isAllDay,
      recurrence: todo.recurrence,
      recurrenceEndDate: todo.recurrenceEndDate,
      exdates: todo.exdates || [],
      color: todo.categoryId?.color || '#808080',
      categoryName: todo.categoryId?.name || null,
    }));

    res.json(events);
  } catch (error) {
    console.error('Get month events error:', error);
    res.status(500).json({ message: error.message });
  }
};

// 월별 일정 유무 조회
exports.getCalendarSummary = async (req, res) => {
  try {
    const { year, month } = req.query;
    const userId = req.userId;

    if (!year || !month) {
      return res.status(400).json({ message: 'year와 month가 필요합니다' });
    }

    const allTodos = await Todo.find({ userId, deletedAt: null });

    // 해당 월의 모든 날짜 생성
    const daysInMonth = new Date(year, month, 0).getDate();
    const summary = {};

    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const targetDate = new Date(dateStr + 'T00:00:00');

      // 해당 날짜에 일정이 있는지 확인 (하루종일 + 시간 지정 할일 모두 처리)
      const hasTodos = allTodos.some(todo => {
        // 하루종일 할일인 경우
        if (todo.isAllDay) {
          // 반복 할일인 경우
          if (todo.recurrence) {
            // RRULE 기반 계산 (startDate를 기준으로 가상의 startDateTime 생성)
            const virtualStartDateTime = new Date(todo.startDate + 'T00:00:00.000Z');
            return occursOnDate(
              todo.recurrence,
              virtualStartDateTime,
              targetDate,
              todo.exdates || []
            );
          } else {
            // 단일 날짜 또는 기간 할일
            const startDateStr = todo.startDate;
            const endDateStr = todo.endDate || todo.startDate;
            return dateStr >= startDateStr && dateStr <= endDateStr;
          }
        } else {
          // 시간 지정 할일인 경우 (기존 로직)
          if (todo.startDateTime) {
            return occursOnDate(
              todo.recurrence,
              todo.startDateTime,
              targetDate,
              todo.exdates || []
            );
          }
          return false;
        }
      });

      if (hasTodos) {
        summary[dateStr] = true;
      }
    }

    res.json(summary);
  } catch (error) {
    console.error('Calendar summary error:', error);
    res.status(500).json({ message: error.message });
  }
};



// 델타 동기화 조회 (특정 시간 이후 변경된 일정만)
exports.getDeltaSync = async (req, res) => {
  try {
    const { lastSyncTime } = req.query;
    const userId = req.userId;

    if (!lastSyncTime) {
      return res.status(400).json({ message: 'lastSyncTime이 필요합니다' });
    }

    const syncTime = new Date(lastSyncTime);

    // 업데이트된 일정 조회 (삭제 안된 것만)
    const updated = await Todo.find({
      userId,
      updatedAt: { $gt: syncTime },
      deletedAt: null
    }).populate('categoryId', 'color name');

    // 삭제된 일정 조회 (lastSyncTime 이후 삭제된 것)
    const deleted = await Todo.find({
      userId,
      deletedAt: { $gt: syncTime }
    }).select('_id deletedAt');

    // 응답 시간을 서버 기준으로 반환 (다음 동기화 시 사용)
    const serverSyncTime = new Date().toISOString();

    res.json({
      updated: updated.map(todo => ({
        _id: todo._id,
        title: todo.title,
        memo: todo.memo,
        categoryId: todo.categoryId,
        startDate: todo.startDate,
        endDate: todo.endDate,
        startDateTime: todo.startDateTime,
        endDateTime: todo.endDateTime,
        isAllDay: todo.isAllDay,
        recurrence: todo.recurrence,
        recurrenceEndDate: todo.recurrenceEndDate,
        exdates: todo.exdates || [],
        order: todo.order,
        color: todo.categoryId?.color || '#808080',
        categoryName: todo.categoryId?.name || null,
        syncStatus: todo.syncStatus,
        updatedAt: todo.updatedAt,
      })),
      deleted: deleted.map(t => t._id),
      syncTime: serverSyncTime
    });
  } catch (error) {
    console.error('Delta sync error:', error);
    res.status(500).json({ message: error.message });
  }
};

// 캘린더 동기화 재시도
exports.retryCalendarSync = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId;

    const todo = await Todo.findOne({ _id: id, userId });
    if (!todo) {
      return res.status(404).json({ message: '할일을 찾을 수 없습니다' });
    }

    const user = await User.findById(userId);

    if (!user || !user.settings?.calendarSyncEnabled || !user.hasCalendarAccess) {
      return res.status(400).json({ message: '캘린더 동기화가 비활성화되어 있습니다' });
    }

    try {
      todo.syncStatus = 'pending';
      todo.lastSyncAttempt = new Date();
      await todo.save();

      const googleCalendar = require('../services/googleCalendar');

      if (todo.googleCalendarEventId) {
        // 기존 이벤트 업데이트
        await googleCalendar.updateEvent(user, todo);
      } else {
        // 새 이벤트 생성
        const calendarEvent = await googleCalendar.createEvent(user, todo);
        if (calendarEvent) {
          todo.googleCalendarEventId = calendarEvent.id;
        }
      }

      todo.syncStatus = 'synced';
      await todo.save();

      res.json({ message: '캘린더 동기화 성공', todo });
    } catch (error) {
      console.error('Calendar sync retry failed:', error);
      todo.syncStatus = 'failed';
      await todo.save();

      res.status(500).json({ message: '캘린더 동기화 실패', error: error.message });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// 일괄 캘린더 동기화 재시도
exports.retryAllFailedSync = async (req, res) => {
  try {
    const userId = req.userId;

    const user = await User.findById(userId);

    if (!user || !user.settings?.calendarSyncEnabled || !user.hasCalendarAccess) {
      return res.status(400).json({ message: '캘린더 동기화가 비활성화되어 있습니다' });
    }

    // 동기화 실패한 todo들 조회
    const failedTodos = await Todo.find({
      userId,
      type: 'todo',
      syncStatus: 'failed'
    });

    if (failedTodos.length === 0) {
      return res.json({ message: '재시도할 할일이 없습니다', successCount: 0, failCount: 0 });
    }

    const googleCalendar = require('../services/googleCalendar');
    let successCount = 0;
    let failCount = 0;

    for (const todo of failedTodos) {
      try {
        todo.syncStatus = 'pending';
        todo.lastSyncAttempt = new Date();
        await todo.save();

        if (todo.googleCalendarEventId) {
          // 기존 이벤트 업데이트
          await googleCalendar.updateEvent(user, todo);
        } else {
          // 새 이벤트 생성
          const calendarEvent = await googleCalendar.createEvent(user, todo);
          if (calendarEvent) {
            todo.googleCalendarEventId = calendarEvent.id;
          }
        }

        todo.syncStatus = 'synced';
        await todo.save();
        successCount++;
      } catch (error) {
        console.error(`Calendar sync retry failed for todo ${todo._id}:`, error);
        todo.syncStatus = 'failed';
        await todo.save();
        failCount++;
      }
    }

    res.json({
      message: '일괄 재시도 완료',
      successCount,
      failCount,
      total: failedTodos.length
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
// 일괄 삭제
exports.bulkDeleteTodos = async (req, res) => {
  try {
    const userId = req.userId;
    const { todoIds } = req.body;

    if (!todoIds || !Array.isArray(todoIds) || todoIds.length === 0) {
      return res.status(400).json({ message: '삭제할 할일을 선택해주세요' });
    }

    const user = await User.findById(userId);

    // 삭제할 할일들 조회
    const todos = await Todo.find({
      _id: { $in: todoIds },
      userId
    });

    if (todos.length === 0) {
      return res.status(404).json({ message: '삭제할 할일을 찾을 수 없습니다' });
    }

    // 구글 캘린더 이벤트 삭제 (실패해도 할일은 삭제)
    for (const todo of todos) {
      if (todo.googleCalendarEventId && user?.hasCalendarAccess) {
        try {
          await googleCalendar.deleteEvent(user, todo.googleCalendarEventId);
        } catch (error) {
          console.error(`Failed to delete calendar event for todo ${todo._id}:`, error);
          // 캘린더 삭제 실패해도 계속 진행
        }
      }
    }

    // 완료 기록 삭제
    await Completion.deleteMany({
      todoId: { $in: todoIds },
      userId
    });

    // 할일 Soft Delete
    await Todo.updateMany(
      { _id: { $in: todoIds }, userId },
      { deletedAt: new Date() }
    );

    res.json({
      message: `${todos.length}개의 할일이 삭제되었습니다`,
      deletedCount: todos.length
    });
  } catch (error) {
    console.error('Bulk delete error:', error);
    res.status(500).json({ message: error.message });
  }
};