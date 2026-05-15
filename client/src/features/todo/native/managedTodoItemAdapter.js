import { getRecurrenceDescription } from '../../../utils/recurrenceUtils';
import { hasRecurrenceRule } from '../../../utils/recurrenceEngine';

function formatDateLabel(date) {
  if (!date) {
    return null;
  }

  const [year, month, day] = String(date).split('-');
  if (!year || !month || !day) {
    return date;
  }

  return `${year}.${month}.${day}`;
}

function formatDateRangeLabel(todo) {
  const startDate = todo?.occurrenceDate || todo?.startDate || todo?.date;
  const endDate = todo?.endDate || startDate;

  if (!startDate) {
    return null;
  }

  if (!endDate || endDate === startDate) {
    return formatDateLabel(startDate);
  }

  return `${formatDateLabel(startDate)} - ${formatDateLabel(endDate)}`;
}

function formatTimeLabel(todo) {
  if (todo?.isAllDay) {
    return '하루 종일';
  }

  if (todo?.startTime && todo?.endTime) {
    return `${todo.startTime} - ${todo.endTime}`;
  }

  return todo?.startTime || todo?.endTime || null;
}

function buildBaseSubLabels(todo, options = {}) {
  const subLabels = [];
  const showFavoriteBadge =
    options.showFavoriteBadge === true && todo?.isFavorite === true;
  const showNextOccurrenceLabel = Boolean(options.nextOccurrenceLabel);
  const recurrenceDescription =
    hasRecurrenceRule(todo?.recurrence) && !showNextOccurrenceLabel
      ? getRecurrenceDescription(todo.recurrence)
      : null;
  const dateLabel = formatDateRangeLabel(todo);
  const timeLabel = formatTimeLabel(todo);

  if (showFavoriteBadge) {
    subLabels.push({
      id: 'favorite',
      icon: '★',
      text: '즐겨찾기',
      tone: 'accent',
    });
  }

  if (dateLabel) {
    subLabels.push({
      id: 'date',
      icon: '📅',
      text: dateLabel,
      tone: 'default',
    });
  }

  if (timeLabel) {
    subLabels.push({
      id: 'time',
      icon: '⏰',
      text: timeLabel,
      tone: 'default',
    });
  }

  if (recurrenceDescription) {
    subLabels.push({
      id: 'recurrence',
      icon: '🔁',
      text: recurrenceDescription,
      tone: 'muted',
    });
  }

  if (showNextOccurrenceLabel) {
    subLabels.push({
      id: 'next-occurrence',
      icon: '🔁',
      text: options.nextOccurrenceLabel,
      tone: 'accent',
    });
  }

  return subLabels;
}

export function buildManagedTodoItem(todo, options = {}) {
  const isCompleted = todo?.completed === true;

  return {
    id: todo._id,
    kind: 'todo',
    title: todo.title || '',
    subtitle: options.subtitle,
    metaText: options.metaText,
    subLabels: buildBaseSubLabels(todo, {
      showFavoriteBadge: options.showFavoriteBadge,
      nextOccurrenceLabel: options.nextOccurrenceLabel,
    }),
    enabled: options.enabled !== false,
    loading: options.loading === true,
    reorderable: options.reorderable !== false,
    dropTargetable: options.dropTargetable !== false,
    completed: isCompleted,
    favorite: todo?.isFavorite === true,
    accentColor: options.accentColor ?? todo?.accentColor,
    leadingControl: options.includeCompleteToggle
      ? {
          id: 'complete',
          kind: 'toggle',
          value: isCompleted,
          disabled: options.completeDisabled === true,
        }
      : undefined,
    trailingControl: options.includeFavoriteToggle
      ? {
          id: 'favorite',
          kind: 'toggle',
          value: todo?.isFavorite === true,
          disabled: options.favoriteDisabled === true,
        }
      : undefined,
    menuActions: options.menuActions ?? [],
    leadingSwipeActions: options.leadingSwipeActions ?? [],
    trailingSwipeActions: options.trailingSwipeActions ?? [],
  };
}
