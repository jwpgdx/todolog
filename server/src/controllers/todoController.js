const Todo = require('../models/Todo');
const Completion = require('../models/Completion');
const googleCalendar = require('../services/googleCalendar');
const User = require('../models/User');
const { occursOnDate } = require('../utils/recurrenceUtils');

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
const LEGACY_SCHEDULE_FIELDS = ['date', 'startDateTime', 'endDateTime', 'timeZone'];

function getLegacyScheduleFields(payload = {}) {
  return LEGACY_SCHEDULE_FIELDS.filter(field => Object.prototype.hasOwnProperty.call(payload, field));
}

function toNullableString(value) {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== 'string') return value;

  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

function normalizeRecurrence(value) {
  if (value === undefined) return undefined;
  if (value === null) return null;

  if (Array.isArray(value)) {
    const sanitized = value.filter(item => typeof item === 'string' && item.trim().length > 0);
    return sanitized.length > 0 ? sanitized : null;
  }

  if (typeof value === 'string' && value.trim().length > 0) {
    return [value.trim()];
  }

  return null;
}

function getPrimaryRecurrenceRule(recurrence) {
  if (Array.isArray(recurrence)) return recurrence[0] || null;
  if (typeof recurrence === 'string') return recurrence;
  return null;
}

function buildOccurrenceAnchor(todo) {
  if (!todo?.startDate || !DATE_PATTERN.test(todo.startDate)) {
    return null;
  }

  const rawStartTime = typeof todo.startTime === 'string' ? todo.startTime : null;
  const startTime = rawStartTime && TIME_PATTERN.test(rawStartTime) ? rawStartTime : '00:00';

  return new Date(`${todo.startDate}T${startTime}:00.000Z`);
}

function validateDateField(fieldName, value, errors, { required = false } = {}) {
  if (value === undefined) {
    if (required) errors.push(`${fieldName} is required`);
    return;
  }
  if (value === null) {
    if (required) errors.push(`${fieldName} is required`);
    return;
  }
  if (typeof value !== 'string' || !DATE_PATTERN.test(value)) {
    errors.push(`${fieldName} must match YYYY-MM-DD`);
  }
}

function validateTimeField(fieldName, value, errors, { required = false } = {}) {
  if (value === undefined) {
    if (required) errors.push(`${fieldName} is required`);
    return;
  }
  if (value === null) {
    if (required) errors.push(`${fieldName} is required`);
    return;
  }
  if (typeof value !== 'string' || !TIME_PATTERN.test(value)) {
    errors.push(`${fieldName} must match HH:mm`);
  }
}

function validateTodoDateTimePayload({
  startDate,
  endDate,
  startTime,
  endTime,
  recurrenceEndDate,
  isAllDay,
}, { requireStartDate = false } = {}) {
  const errors = [];

  validateDateField('startDate', startDate, errors, { required: requireStartDate });
  validateDateField('endDate', endDate, errors);
  validateDateField('recurrenceEndDate', recurrenceEndDate, errors);
  validateTimeField('startTime', startTime, errors);
  validateTimeField('endTime', endTime, errors);

  if (isAllDay === false && (startTime === null || startTime === undefined)) {
    errors.push('startTime is required when isAllDay is false');
  }

  return errors;
}

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
    const targetDate = new Date(`${date}T00:00:00.000Z`);

    // 날짜별 필터링 (문자열 기반 + 반복 RRULE 평가)
    const filteredTodos = allTodos.filter(todo => {
      const recurrenceRule = getPrimaryRecurrenceRule(todo.recurrence);

      // 비반복 일정은 기간 문자열 비교로 판정
      if (!recurrenceRule) {
        const startDateStr = todo.startDate;
        const endDateStr = todo.endDate || todo.startDate;
        return date >= startDateStr && date <= endDateStr;
      }

      // 반복 일정은 startDate/startTime을 앵커로 RRULE 평가
      const anchorDate = buildOccurrenceAnchor(todo);
      if (!anchorDate) return false;

      return occursOnDate(
        recurrenceRule,
        anchorDate,
        targetDate,
        todo.exdates || []
      );
    });

    // 해당 날짜의 완료 기록 조회
    const completions = date
      ? await Completion.find({
        userId,
        deletedAt: null,
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
      startDate: todo.startDate,
      startTime: todo.startTime ?? null,
      endDate: todo.endDate,
      endTime: todo.endTime ?? null,
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
    const legacyScheduleFields = getLegacyScheduleFields(req.body);
    if (legacyScheduleFields.length > 0) {
      return res.status(400).json({
        message: '지원하지 않는 구버전 일정 필드가 포함되어 있습니다',
        errors: [`legacy fields are not allowed: ${legacyScheduleFields.join(', ')}`],
      });
    }

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

    const normalizedStartDate = toNullableString(startDate);
    const normalizedEndDate = toNullableString(endDate);
    let normalizedStartTime = toNullableString(startTime);
    let normalizedEndTime = toNullableString(endTime);
    const normalizedRecurrenceEndDate = toNullableString(recurrenceEndDate);
    const normalizedRecurrence = normalizeRecurrence(recurrence);

    // 사용자 시간대 정보 업데이트 (클라이언트에서 전송된 경우)
    if (userTimeZone) {
      await User.findByIdAndUpdate(userId, { $set: { 'settings.timeZone': userTimeZone } });
      console.log('🌍 [createTodo] 사용자 시간대 업데이트:', userTimeZone);
    }

    // 하루종일 할일인지 확인
    const isAllDay = (isAllDayFlag !== undefined) ? isAllDayFlag : (!normalizedStartTime && !normalizedEndTime);
    if (isAllDay) {
      normalizedStartTime = null;
      normalizedEndTime = null;
    }

    const validationErrors = validateTodoDateTimePayload({
      startDate: normalizedStartDate,
      endDate: normalizedEndDate,
      startTime: normalizedStartTime,
      endTime: normalizedEndTime,
      recurrenceEndDate: normalizedRecurrenceEndDate,
      isAllDay,
    }, { requireStartDate: true });

    if (validationErrors.length > 0) {
      return res.status(400).json({
        message: '날짜/시간 형식이 올바르지 않습니다',
        errors: validationErrors,
      });
    }

    const todoData = {
      _id: req.body._id || require('../utils/idGenerator').generateId(),
      userId,
      title,
      startDate: normalizedStartDate, // yyyy-mm-dd string
      startTime: normalizedStartTime,
      endDate: normalizedEndDate,
      endTime: normalizedEndTime,
      isAllDay,
      recurrence: normalizedRecurrence,
      recurrenceEndDate: normalizedRecurrenceEndDate,
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
    const legacyScheduleFields = getLegacyScheduleFields(req.body);
    if (legacyScheduleFields.length > 0) {
      return res.status(400).json({
        message: '지원하지 않는 구버전 일정 필드가 포함되어 있습니다',
        errors: [`legacy fields are not allowed: ${legacyScheduleFields.join(', ')}`],
      });
    }

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

    if ('startDate' in updateOps) updateOps.startDate = toNullableString(updateOps.startDate);
    if ('endDate' in updateOps) updateOps.endDate = toNullableString(updateOps.endDate);
    if ('startTime' in updateOps) updateOps.startTime = toNullableString(updateOps.startTime);
    if ('endTime' in updateOps) updateOps.endTime = toNullableString(updateOps.endTime);
    if ('recurrenceEndDate' in updateOps) updateOps.recurrenceEndDate = toNullableString(updateOps.recurrenceEndDate);
    if ('recurrence' in updateOps) updateOps.recurrence = normalizeRecurrence(updateOps.recurrence);

    // 업데이트된 값 우선으로 최종 상태를 구성해 검증
    const mergedData = { ...existingTodo.toObject(), ...updateOps };
    const isAllDay = (updateOps.isAllDay !== undefined)
      ? updateOps.isAllDay
      : mergedData.isAllDay;

    if (isAllDay) {
      updateOps.startTime = null;
      updateOps.endTime = null;
      mergedData.startTime = null;
      mergedData.endTime = null;
    }

    const validationErrors = validateTodoDateTimePayload({
      startDate: mergedData.startDate,
      endDate: mergedData.endDate,
      startTime: mergedData.startTime,
      endTime: mergedData.endTime,
      recurrenceEndDate: mergedData.recurrenceEndDate,
      isAllDay,
    }, { requireStartDate: true });

    if (validationErrors.length > 0) {
      return res.status(400).json({
        message: '날짜/시간 형식이 올바르지 않습니다',
        errors: validationErrors,
      });
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
    const now = new Date();

    const todo = await Todo.findOne({ _id: id, userId });

    if (!todo) {
      return res.status(404).json({ message: '할일을 찾을 수 없습니다' });
    }

    // Idempotent delete: 이미 soft-delete된 항목은 성공등가 처리
    if (todo.deletedAt) {
      // 과거 데이터 정합성 보정: 이미 삭제된 todo라도 active completion이 남아 있으면 tombstone 처리
      const completionTombstoneResult = await Completion.updateMany(
        {
          userId,
          todoId: id,
          deletedAt: null,
        },
        {
          deletedAt: now,
          updatedAt: now,
        }
      );

      return res.status(200).json({
        message: '이미 삭제된 할일입니다',
        idempotent: true,
        alreadyDeleted: true,
        tombstonedCompletionCount: completionTombstoneResult.modifiedCount || 0,
      });
    }

    todo.deletedAt = now;
    todo.updatedAt = now;
    await todo.save();

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

    // 관련 완료 기록 tombstone cascade
    const completionTombstoneResult = await Completion.updateMany(
      {
        userId,
        todoId: id,
        deletedAt: null,
      },
      {
        deletedAt: now,
        updatedAt: now,
      }
    );

    res.json({
      message: '삭제 완료',
      deletedTodo: todo,
      tombstonedCompletionCount: completionTombstoneResult.modifiedCount || 0,
    });
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
            { recurrenceEndDate: { $gte: monthStartStr } }
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
      startTime: todo.startTime ?? null,
      endDate: todo.endDate,
      endTime: todo.endTime ?? null,
      isAllDay: todo.isAllDay,
      recurrence: todo.recurrence,
      recurrenceEndDate: todo.recurrenceEndDate,
      exdates: todo.exdates || [],
      categoryId: todo.categoryId?._id || todo.categoryId,
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
      const targetDate = new Date(`${dateStr}T00:00:00.000Z`);

      // 해당 날짜에 일정이 있는지 확인 (하루종일 + 시간 지정 할일 모두 처리)
      const hasTodos = allTodos.some(todo => {
        const recurrenceRule = getPrimaryRecurrenceRule(todo.recurrence);

        if (!recurrenceRule) {
          const startDateStr = todo.startDate;
          const endDateStr = todo.endDate || todo.startDate;
          return dateStr >= startDateStr && dateStr <= endDateStr;
        }

        const anchorDate = buildOccurrenceAnchor(todo);
        if (!anchorDate) return false;

        return occursOnDate(
          recurrenceRule,
          anchorDate,
          targetDate,
          todo.exdates || []
        );
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
        categoryId: todo.categoryId?._id || todo.categoryId,
        startDate: todo.startDate,
        startTime: todo.startTime ?? null,
        endDate: todo.endDate,
        endTime: todo.endTime ?? null,
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

    const now = new Date();

    // 완료 기록 tombstone cascade
    const completionTombstoneResult = await Completion.updateMany(
      {
        todoId: { $in: todoIds },
        userId,
        deletedAt: null,
      },
      {
        deletedAt: now,
        updatedAt: now,
      }
    );

    // 할일 Soft Delete
    await Todo.updateMany(
      { _id: { $in: todoIds }, userId },
      { deletedAt: now, updatedAt: now }
    );

    res.json({
      message: `${todos.length}개의 할일이 삭제되었습니다`,
      deletedCount: todos.length,
      tombstonedCompletionCount: completionTombstoneResult.modifiedCount || 0,
    });
  } catch (error) {
    console.error('Bulk delete error:', error);
    res.status(500).json({ message: error.message });
  }
};
