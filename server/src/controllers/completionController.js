const Completion = require('../models/Completion');

// 완료 토글 (생성/삭제를 한 번에 처리)
exports.toggleCompletion = async (req, res) => {
  try {
    const { todoId, date } = req.body;
    const userId = req.userId;

    if (!todoId) {
      return res.status(400).json({ message: 'todoId가 필요합니다' });
    }

    // 기존 완료 기록 확인
    const existingCompletion = await Completion.findOne({
      todoId,
      userId,
      date: date || null, // date가 없으면 null로 검색 (기간 할일)
    });

    if (existingCompletion) {
      // 완료 기록이 있으면 삭제 (완료 취소)
      await Completion.findByIdAndDelete(existingCompletion._id);
      res.json({ completed: false, message: '완료 취소됨' });
    } else {
      // 완료 기록이 없으면 생성 (완료 처리)
      const completion = new Completion({
        todoId,
        userId,
        date: date || null,
      });
      await completion.save();
      res.json({ completed: true, message: '완료 처리됨' });
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

    const completion = new Completion({
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
