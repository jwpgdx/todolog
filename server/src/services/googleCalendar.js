const { google } = require('googleapis');

/**
 * 구글 캘린더 서비스
 * Todo 할일을 구글 캘린더 이벤트로 동기화
 */
class GoogleCalendarService {
  constructor() {
    this.oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET
    );
  }

  /**
   * TODOLOG 전용 캘린더 생성 또는 조회
   */
  async ensureTodoLogCalendar(user) {
    console.log('🔍 [ensureTodoLogCalendar] 시작 - 사용자:', user.email);
    console.log('📋 [ensureTodoLogCalendar] 기존 캘린더 ID:', user.todoLogCalendarId);

    const calendar = this.setCredentials(user);

    // 이미 캘린더 ID가 저장되어 있으면 존재 여부 확인
    if (user.todoLogCalendarId) {
      console.log('🔍 [ensureTodoLogCalendar] 기존 캘린더 존재 여부 확인 중...');
      try {
        await calendar.calendars.get({
          calendarId: user.todoLogCalendarId,
        });
        console.log('✅ [ensureTodoLogCalendar] TODOLOG 캘린더 존재 확인:', user.todoLogCalendarId);
        return user.todoLogCalendarId;
      } catch (error) {
        if (error.code === 404) {
          console.log('⚠️ [ensureTodoLogCalendar] TODOLOG 캘린더가 삭제됨 - 새로 생성 필요');
          // 캘린더가 삭제되었으므로 새로 생성
          user.todoLogCalendarId = null;
        } else {
          console.error('❌ [ensureTodoLogCalendar] 캘린더 확인 중 오류:', error);
          throw error;
        }
      }
    }

    // TODOLOG 캘린더 생성
    console.log('🆕 [ensureTodoLogCalendar] 새 TODOLOG 캘린더 생성 중...');
    try {
      const calendarData = {
        summary: 'TODOLOG',
        description: 'TODOLOG 앱에서 자동으로 생성된 할일 캘린더',
        timeZone: user?.settings?.timeZone || 'Asia/Seoul',
      };
      console.log('📋 [ensureTodoLogCalendar] 캘린더 데이터:', calendarData);

      const response = await calendar.calendars.insert({
        resource: calendarData,
      });

      const calendarId = response.data.id;
      console.log('✅ [ensureTodoLogCalendar] 캘린더 생성 성공:', calendarId);

      user.todoLogCalendarId = calendarId;
      await user.save();
      console.log('💾 [ensureTodoLogCalendar] 사용자 정보에 캘린더 ID 저장 완료');

      return calendarId;
    } catch (error) {
      console.error('❌ [ensureTodoLogCalendar] TODOLOG 캘린더 생성 실패:', error);
      throw error;
    }
  }

  /**
   * OAuth2 클라이언트 설정
   */
  setCredentials(user) {
    this.oauth2Client.setCredentials({
      access_token: user.googleAccessToken,
      refresh_token: user.googleRefreshToken,
    });

    // Access Token 갱신 시 자동으로 사용자 정보 업데이트
    this.oauth2Client.on('tokens', async (tokens) => {
      try {
        if (tokens.refresh_token) {
          user.googleRefreshToken = tokens.refresh_token;
        }
        user.googleAccessToken = tokens.access_token;
        await user.save();
        console.log('Google tokens refreshed for user:', user.email);
      } catch (error) {
        console.error('Failed to save refreshed tokens:', error);
      }
    });

    return google.calendar({ version: 'v3', auth: this.oauth2Client });
  }

  /**
   * 날짜 문자열에 일수를 더하는 헬퍼 함수
   * @param {string} dateStr - YYYY-MM-DD 형식
   * @param {number} days - 더할 일수
   * @returns {string} - YYYY-MM-DD 형식
   */
  addDays(dateStr, days) {
    const normalized = this.normalizeDateString(dateStr);
    if (!normalized) return null;
    const date = new Date(`${normalized}T00:00:00.000Z`);
    if (Number.isNaN(date.getTime())) return null;
    date.setUTCDate(date.getUTCDate() + days);
    return date.toISOString().split('T')[0];
  }

  /**
   * YYYY-MM-DD 문자열 정규화
   */
  normalizeDateString(value) {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    return /^\d{4}-\d{2}-\d{2}$/.test(trimmed) ? trimmed : null;
  }

  /**
   * HH:mm 문자열 정규화
   */
  normalizeTimeString(value) {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    return /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(trimmed) ? trimmed : null;
  }

  /**
   * HH:mm 값에 시간을 더함 (일 경계는 무시)
   */
  addHoursToTime(timeStr, hours) {
    const normalized = this.normalizeTimeString(timeStr);
    if (!normalized) return null;

    const [hour, minute] = normalized.split(':').map(Number);
    const totalMinutes = (hour * 60 + minute + (hours * 60)) % (24 * 60);
    const safeMinutes = totalMinutes < 0 ? totalMinutes + (24 * 60) : totalMinutes;
    const nextHour = String(Math.floor(safeMinutes / 60)).padStart(2, '0');
    const nextMinute = String(safeMinutes % 60).padStart(2, '0');
    return `${nextHour}:${nextMinute}`;
  }

  buildDateTimeString(dateStr, timeStr) {
    const normalizedDate = this.normalizeDateString(dateStr);
    const normalizedTime = this.normalizeTimeString(timeStr);
    if (!normalizedDate || !normalizedTime) return null;
    return `${normalizedDate}T${normalizedTime}:00`;
  }

  /**
   * date-only 문자열을 RRULE UNTIL 형식(YYYYMMDDT235959Z)으로 변환
   */
  formatDateForRRule(value) {
    const normalizedDate = this.normalizeDateString(value);
    if (!normalizedDate) return null;
    return `${normalizedDate.replace(/-/g, '')}T235959Z`;
  }

  /**
   * Todo를 구글 캘린더 이벤트로 변환 (문자열 호환 어댑터)
   */
  todoToCalendarEvent(todo, user) {
    const event = {
      summary: todo.title,
      description: todo.memo || '',
    };

    const timeZone = user?.settings?.timeZone || 'Asia/Seoul';
    const startDate = this.normalizeDateString(todo.startDate);
    const endDate = this.normalizeDateString(todo.endDate) || startDate;
    const startTime = this.normalizeTimeString(todo.startTime);
    const endTime = this.normalizeTimeString(todo.endTime);
    const isAllDay = todo.isAllDay !== undefined ? !!todo.isAllDay : !startTime;

    if (!startDate) {
      throw new Error(`Invalid startDate for Google payload: ${todo._id}`);
    }

    if (isAllDay) {
      const endDatePlusOne = this.addDays(endDate || startDate, 1);
      event.start = { date: startDate };
      event.end = { date: endDatePlusOne || startDate };
    } else {
      if (!startTime) {
        throw new Error(`Invalid startTime for Google payload: ${todo._id}`);
      }

      const eventEndDate = endDate || startDate;
      const eventEndTime = endTime || this.addHoursToTime(startTime, 1) || startTime;
      const eventStartDateTime = this.buildDateTimeString(startDate, startTime);
      const eventEndDateTime = this.buildDateTimeString(eventEndDate, eventEndTime);

      if (!eventStartDateTime || !eventEndDateTime) {
        throw new Error(`Invalid date/time fields for Google payload: ${todo._id}`);
      }

      event.start = {
        dateTime: eventStartDateTime,
        timeZone,
      };
      event.end = {
        dateTime: eventEndDateTime,
        timeZone,
      };
    }

    const recurrence = Array.isArray(todo.recurrence)
      ? todo.recurrence.filter(rule => typeof rule === 'string' && rule.trim().length > 0)
      : (typeof todo.recurrence === 'string' && todo.recurrence.trim().length > 0 ? [todo.recurrence] : []);

    if (recurrence.length > 0) {
      event.recurrence = [...recurrence];

      if (todo.recurrenceEndDate !== undefined && todo.recurrenceEndDate !== null && todo.recurrenceEndDate !== '') {
        const recurrenceEndDate = this.normalizeDateString(todo.recurrenceEndDate);
        if (!recurrenceEndDate) {
          throw new Error(`Invalid recurrenceEndDate for Google payload: ${todo._id}`);
        }

        const rruleString = event.recurrence[0] || '';
        if (rruleString && !rruleString.includes('UNTIL')) {
          const untilDate = this.formatDateForRRule(recurrenceEndDate);
          if (untilDate) {
            event.recurrence[0] = `${rruleString};UNTIL=${untilDate}`;
          }
        }
      }
    }

    return event;
  }

  /**
   * 캘린더 이벤트 생성
   */
  async createEvent(user, todo) {
    const calendarSyncEnabled = user?.settings?.calendarSyncEnabled;
    console.log('🚀 [GoogleCalendar] createEvent 호출됨:', {
      userId: user._id,
      todoId: todo._id,
      todoTitle: todo.title,
      hasRecurrence: !!todo.recurrence,
      calendarSyncEnabled,
      hasCalendarAccess: user.hasCalendarAccess
    });

    // 캘린더 동기화가 비활성화되어 있는 경우 스킵
    if (!calendarSyncEnabled || !user.hasCalendarAccess) {
      console.log('⏭️ [GoogleCalendar] 캘린더 동기화 조건 불충족 - 스킵');
      return null;
    }

    try {
      // TODOLOG 전용 캘린더 확인/생성
      console.log('📅 [GoogleCalendar] TODOLOG 캘린더 확인/생성 중...');
      const calendarId = await this.ensureTodoLogCalendar(user);
      console.log('✅ [GoogleCalendar] 캘린더 ID:', calendarId);

      console.log('🔑 [GoogleCalendar] OAuth2 클라이언트 설정 중...');
      const calendar = this.setCredentials(user);

      console.log('📝 [GoogleCalendar] Todo를 캘린더 이벤트로 변환 중...');
      const event = this.todoToCalendarEvent(todo, user);
      console.log('📋 [GoogleCalendar] 생성할 이벤트:', event);

      console.log('📤 [GoogleCalendar] 구글 캘린더 API 호출 중...');
      const response = await calendar.events.insert({
        calendarId: calendarId,
        resource: event,
      });

      console.log('✅ [GoogleCalendar] 캘린더 이벤트 생성 성공:', response.data.id);
      return response.data;
    } catch (error) {
      console.error('❌ [GoogleCalendar] 캘린더 이벤트 생성 실패:', {
        error: error.message,
        code: error.code,
        status: error.status,
        todoId: todo._id,
        userId: user._id
      });

      // Access Token 만료 등의 인증 오류 시 캘린더 접근 권한 해제
      if (error.code === 401 || error.code === 403) {
        console.log('🔒 [GoogleCalendar] 인증 오류 - 캘린더 접근 권한 해제');
        user.hasCalendarAccess = false;
        if (!user.settings) user.settings = {};
        user.settings.calendarSyncEnabled = false;
        user.googleAccessToken = null;
        user.googleRefreshToken = null;
        await user.save();
        console.log(`✅ [GoogleCalendar] 사용자 캘린더 접근 권한 해제 완료: ${user.email}`);
      }

      throw error;
    }
  }

  /**
   * 캘린더 이벤트 수정
   */
  async updateEvent(user, todo) {
    const calendarSyncEnabled = user?.settings?.calendarSyncEnabled;
    if (!calendarSyncEnabled || !user.hasCalendarAccess || !todo.googleCalendarEventId) {
      return null;
    }

    try {
      // TODOLOG 전용 캘린더 확인/생성
      const calendarId = await this.ensureTodoLogCalendar(user);

      const calendar = this.setCredentials(user);
      const event = this.todoToCalendarEvent(todo, user);

      const response = await calendar.events.update({
        calendarId: calendarId,
        eventId: todo.googleCalendarEventId,
        resource: event,
      });

      console.log(`Calendar event updated: ${response.data.id} for todo: ${todo.title}`);
      return response.data;
    } catch (error) {
      console.error('Failed to update calendar event:', error);

      if (error.code === 401 || error.code === 403) {
        user.hasCalendarAccess = false;
        if (!user.settings) user.settings = {};
        user.settings.calendarSyncEnabled = false;
        user.googleAccessToken = null;
        user.googleRefreshToken = null;
        await user.save();
      }

      throw error;
    }
  }

  /**
   * 캘린더 이벤트 삭제
   */
  async deleteEvent(user, eventId) {
    if (!user.hasCalendarAccess || !eventId) {
      return null;
    }

    try {
      // TODOLOG 캘린더 ID가 있는 경우에만 삭제 시도
      if (!user.todoLogCalendarId) {
        console.log('No TODOLOG calendar ID found, skipping deletion');
        return true;
      }

      const calendar = this.setCredentials(user);

      await calendar.events.delete({
        calendarId: user.todoLogCalendarId,
        eventId: eventId,
      });

      console.log(`Calendar event deleted: ${eventId}`);
      return true;
    } catch (error) {
      console.error('Failed to delete calendar event:', error);

      if (error.code === 401 || error.code === 403) {
        user.hasCalendarAccess = false;
        if (!user.settings) user.settings = {};
        user.settings.calendarSyncEnabled = false;
        user.googleAccessToken = null;
        user.googleRefreshToken = null;
        await user.save();
      }

      // 404 에러는 이미 삭제된 것으로 간주하고 성공 처리
      if (error.code === 404) {
        console.log(`Calendar event already deleted: ${eventId}`);
        return true;
      }

      throw error;
    }
  }
}

module.exports = new GoogleCalendarService();
