const Completion = require('../models/Completion');
const { generateId } = require('../utils/idGenerator');

// 완료 토글 (생성/삭제를 한 번에 처리) - Soft Delete 방식
exports.toggleCompletion = async (req, res) => {
  try {
    const { todoId, date } = req.body;
    const userId = req.userId;

    if (!todoId) {
      return res.status(400).json({ message: 'todoId가 필요합니다' });
    }

    // 기존 완료 기록 확인 (deletedAt=null만)
    const existingCompletion = await Completion.findOne({
      todoId,
      userId,
      date: date || null,
      deletedAt: null,
    });

    if (existingCompletion) {
      // 완료 기록 있음 → Soft Delete (완료 취소)
      existingCompletion.deletedAt = new Date();
      existingCompletion.updatedAt = new Date();
      await existingCompletion.save();
      
      console.log('✅ [toggleCompletion] 완료 취소 (Soft Delete):', existingCompletion._id);
      res.json({ completed: false, message: '완료 취소됨' });
    } else {
      // 완료 기록 없음 → 삭제된 기록 확인
      const deletedCompletion = await Completion.findOne({
        todoId,
        userId,
        date: date || null,
        deletedAt: { $ne: null },
      });

      if (deletedCompletion) {
        // 삭제된 기록 복구
        deletedCompletion.deletedAt = null;
        deletedCompletion.updatedAt = new Date();
        deletedCompletion.completedAt = new Date(); // 완료 시간 갱신
        await deletedCompletion.save();
        
        console.log('✅ [toggleCompletion] 삭제된 기록 복구:', deletedCompletion._id);
        res.json({ completed: true, message: '완료 처리됨 (복구)' });
      } else {
        // 새로 생성 - 클라이언트가 _id를 보냈으면 사용, 없으면 서버에서 생성
        const completionId = req.body._id || generateId();
        const completion = new Completion({
          _id: completionId,
          todoId,
          userId,
          date: date || null,
        });
        await completion.save();
        
        console.log('✅ [toggleCompletion] 새로 생성:', completion._id);
        res.json({ completed: true, message: '완료 처리됨', completion });
      }
    }
  } catch (error) {
    console.error('Toggle completion error:', error);
    if (error.code === 11000) {
      return res.status(400).json({ message: '이미 완료된 할일입니다' });
    }
    res.status(500).json({ message: error.message });
  }
};

// 완료 기록 생성
exports.createCompletion = async (req, res) => {
  try {
    const { todoId, date, type, isRangeTodo } = req.body;
    const userId = req.userId;

    console.log('Creating completion:', { todoId, date, type, isRangeTodo, userId });

    if (!todoId) {
      return res.status(400).json({ message: 'todoId가 필요합니다' });
    }

    // 완료 날짜 결정
    let completionDate;
    if (isRangeTodo) {
      completionDate = null; // 기간 할일은 날짜 없이 저장 (전체 기간에 대한 완료)
    } else {
      completionDate = date; // 일반 할일은 특정 날짜로 저장
    }

    // 클라이언트가 _id를 보냈으면 사용, 없으면 서버에서 생성
    const completionId = req.body._id || generateId();
    const completion = new Completion({
      _id: completionId,
      todoId,
      userId,
      date: completionDate,
    });

    await completion.save();
    console.log('Completion created:', completion);
    res.status(201).json(completion);
  } catch (error) {
    console.error('Completion creation error:', error);
    if (error.code === 11000) {
      return res.status(400).json({ message: '이미 완료된 할일입니다' });
    }
    res.status(400).json({ message: error.message });
  }
};

// 완료 기록 삭제 (완료 취소)
exports.deleteCompletion = async (req, res) => {
  try {
    const { todoId } = req.params;
    const { date, type, isRangeTodo } = req.query;
    const userId = req.userId;

    // 삭제할 완료 기록의 날짜 결정
    let completionDate;
    if (isRangeTodo === 'true') {
      completionDate = null; // 기간 할일은 날짜 없이 삭제
    } else {
      completionDate = date; // 일반 할일은 특정 날짜로 삭제
    }

    const completion = await Completion.findOneAndDelete({
      todoId,
      userId,
      date: completionDate,
    });

    if (!completion) {
      return res.status(404).json({ message: '완료 기록을 찾을 수 없습니다' });
    }

    res.json({ message: '완료 취소됨' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// 완료 기록 조회 (통계용)
exports.getCompletions = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const userId = req.userId;

    const query = { userId };
    if (startDate && endDate) {
      query.date = { $gte: startDate, $lte: endDate };
    }

    const completions = await Completion.find(query)
      .populate('todoId', 'title')
      .sort({ date: -1 });

    res.json(completions);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// 모든 완료 기록 조회 (Full Sync용)
exports.getAllCompletions = async (req, res) => {
  try {
    const userId = req.userId;

    console.log('🔄 [getAllCompletions] Full Sync 시작:', { userId });

    // deletedAt이 null인 모든 완료 기록 조회
    const completions = await Completion.find({
      userId,
      deletedAt: null,
    }).select('_id todoId date completedAt updatedAt isRange startDate endDate');

    console.log('✅ [getAllCompletions] Full Sync 완료:', {
      count: completions.length,
    });

    res.json(completions.map(c => ({
      _id: c._id,
      todoId: c.todoId,
      date: c.date,
      completedAt: c.completedAt,
      updatedAt: c.updatedAt,
      isRange: c.isRange,
      startDate: c.startDate,
      endDate: c.endDate,
    })));
  } catch (error) {
    console.error('❌ [getAllCompletions] Full Sync 실패:', error);
    res.status(500).json({ message: error.message });
  }
};

// 델타 동기화 API (Phase 2)
exports.getDeltaSync = async (req, res) => {
  try {
    const { lastSyncTime } = req.query;
    const userId = req.userId;

    if (!lastSyncTime) {
      return res.status(400).json({ message: 'lastSyncTime이 필요합니다' });
    }

    const syncTime = new Date(lastSyncTime);
    
    // 유효성 검사
    if (isNaN(syncTime.getTime())) {
      return res.status(400).json({ message: '유효하지 않은 lastSyncTime 형식입니다' });
    }

    console.log('🔄 [getDeltaSync] 델타 동기화 시작:', {
      userId,
      lastSyncTime: syncTime.toISOString(),
    });

    // 업데이트된 완료 기록 (삭제 안된 것만)
    const updated = await Completion.find({
      userId,
      updatedAt: { $gt: syncTime },
      deletedAt: null,
    }).select('_id todoId date completedAt updatedAt');

    // 삭제된 완료 기록
    const deleted = await Completion.find({
      userId,
      deletedAt: { $gt: syncTime },
    }).select('_id todoId date deletedAt');

    const serverSyncTime = new Date().toISOString();

    console.log('✅ [getDeltaSync] 델타 동기화 완료:', {
      updated: updated.length,
      deleted: deleted.length,
      syncTime: serverSyncTime,
    });

    res.json({
      updated: updated.map(c => ({
        _id: c._id,
        todoId: c.todoId,
        date: c.date,
        completedAt: c.completedAt,
        updatedAt: c.updatedAt,
      })),
      deleted: deleted.map(c => ({
        _id: c._id,
        todoId: c.todoId,
        date: c.date,
      })),
      syncTime: serverSyncTime,
    });
  } catch (error) {
    console.error('❌ [getDeltaSync] 델타 동기화 실패:', error);
    res.status(500).json({ message: error.message });
  }
};


// Range-Based Completion 생성 (Phase 3)
exports.createRange = async (req, res) => {
  try {
    const { todoId, startDate, endDate } = req.body;
    const userId = req.userId;

    if (!todoId || !startDate || !endDate) {
      return res.status(400).json({ 
        message: 'todoId, startDate, endDate가 필요합니다' 
      });
    }

    // 날짜 유효성 검사
    if (startDate > endDate) {
      return res.status(400).json({ 
        message: 'startDate는 endDate보다 이전이어야 합니다' 
      });
    }

    console.log('🔄 [createRange] Range 생성 시작:', { todoId, startDate, endDate });

    // 기존 Range와 겹치는지 확인
    const overlapping = await Completion.findOne({
      todoId,
      userId,
      deletedAt: null,
      isRange: true,
      $or: [
        // 새 Range가 기존 Range를 완전히 포함
        {
          startDate: { $gte: startDate },
          endDate: { $lte: endDate },
        },
        // 새 Range가 기존 Range와 겹침
        {
          startDate: { $lte: endDate },
          endDate: { $gte: startDate },
        },
      ],
    });

    if (overlapping) {
      return res.status(400).json({ 
        message: '이미 완료된 날짜 범위와 겹칩니다',
        existing: {
          startDate: overlapping.startDate,
          endDate: overlapping.endDate,
        },
      });
    }

    // Range 생성 - 클라이언트가 _id를 보냈으면 사용, 없으면 서버에서 생성
    const completionId = req.body._id || generateId();
    const completion = new Completion({
      _id: completionId,
      todoId,
      userId,
      isRange: true,
      startDate,
      endDate,
      date: null, // Range는 date 필드 사용 안 함
    });

    await completion.save();
    console.log('✅ [createRange] Range 생성 완료:', completion._id);

    res.status(201).json({
      message: 'Range 생성 완료',
      completion: {
        _id: completion._id,
        todoId: completion.todoId,
        startDate: completion.startDate,
        endDate: completion.endDate,
        isRange: completion.isRange,
      },
    });
  } catch (error) {
    console.error('❌ [createRange] Range 생성 실패:', error);
    res.status(500).json({ message: error.message });
  }
};

// 특정 날짜의 완료 여부 확인 (Range 포함) (Phase 3)
exports.checkCompletion = async (req, res) => {
  try {
    const { todoId, date } = req.query;
    const userId = req.userId;

    if (!todoId || !date) {
      return res.status(400).json({ 
        message: 'todoId와 date가 필요합니다' 
      });
    }

    const isCompleted = await Completion.isCompletedOnDate(todoId, userId, date);

    res.json({
      todoId,
      date,
      completed: isCompleted,
    });
  } catch (error) {
    console.error('❌ [checkCompletion] 조회 실패:', error);
    res.status(500).json({ message: error.message });
  }
};
