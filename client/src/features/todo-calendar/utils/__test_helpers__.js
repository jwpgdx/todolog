/**
 * Manual test helper for calendarHelpers
 * Run this in React Native console or test screen
 */

import {
  generateWeeks,
  createMonthMetadata,
  createMonthMetadataFromDayjs,
  generateFutureMonths,
  generatePastMonths,
} from './calendarHelpers';
import dayjs from 'dayjs';

export function testCalendarHelpers() {
  console.log('=== Testing calendarHelpers ===\n');

  // Test 1: generateWeeks
  console.log('Test 1: generateWeeks(2025, 1)');
  const weeks = generateWeeks(2025, 1);
  console.log(`- Weeks count: ${weeks.length} (expected: 6)`);
  console.log(`- Days per week: ${weeks[0].length} (expected: 7)`);
  console.log(`- Total days: ${weeks.flat().length} (expected: 42)`);
  console.log(`- First day: ${JSON.stringify(weeks[0][0])}`);
  console.log(`- Last day: ${JSON.stringify(weeks[5][6])}`);
  console.assert(weeks.length === 6, 'Should have 6 weeks');
  console.assert(weeks[0].length === 7, 'Each week should have 7 days');
  console.assert(weeks.flat().length === 42, 'Total 42 days');
  console.log('✅ Test 1 passed\n');

  // Test 2: createMonthMetadata
  console.log('Test 2: createMonthMetadata(2025, 1)');
  const metadata = createMonthMetadata(2025, 1);
  console.log(`- Metadata: ${JSON.stringify(metadata)}`);
  console.assert(metadata.year === 2025, 'Year should be 2025');
  console.assert(metadata.month === 1, 'Month should be 1');
  console.assert(metadata.id === '2025-01', 'ID should be 2025-01');
  console.log('✅ Test 2 passed\n');

  // Test 3: createMonthMetadataFromDayjs
  console.log('Test 3: createMonthMetadataFromDayjs');
  const dayjsObj = dayjs('2025-01-15');
  const metadataFromDayjs = createMonthMetadataFromDayjs(dayjsObj);
  console.log(`- Metadata: ${JSON.stringify(metadataFromDayjs)}`);
  console.assert(metadataFromDayjs.month === 1, 'Month should be 1 (not 0)');
  console.log('✅ Test 3 passed\n');

  // Test 4: generateFutureMonths
  console.log('Test 4: generateFutureMonths');
  const lastMonth = createMonthMetadata(2025, 1);
  const futureMonths = generateFutureMonths(lastMonth, 6);
  console.log(`- Future months count: ${futureMonths.length} (expected: 6)`);
  console.log(`- First future month: ${JSON.stringify(futureMonths[0])}`);
  console.log(`- Last future month: ${JSON.stringify(futureMonths[5])}`);
  console.assert(futureMonths.length === 6, 'Should have 6 months');
  console.assert(futureMonths[0].month === 2, 'First should be February');
  console.assert(futureMonths[5].month === 7, 'Last should be July');
  console.log('✅ Test 4 passed\n');

  // Test 5: generatePastMonths
  console.log('Test 5: generatePastMonths');
  const firstMonth = createMonthMetadata(2025, 1);
  const pastMonths = generatePastMonths(firstMonth, 6);
  console.log(`- Past months count: ${pastMonths.length} (expected: 6)`);
  console.log(`- First past month: ${JSON.stringify(pastMonths[0])}`);
  console.log(`- Last past month: ${JSON.stringify(pastMonths[5])}`);
  console.assert(pastMonths.length === 6, 'Should have 6 months');
  console.assert(pastMonths[0].year === 2024, 'First should be 2024');
  console.assert(pastMonths[0].month === 7, 'First should be July');
  console.assert(pastMonths[5].month === 12, 'Last should be December');
  console.log('✅ Test 5 passed\n');

  // Test 6: dateString uniqueness
  console.log('Test 6: dateString uniqueness');
  const allDays = weeks.flat();
  const dateStrings = allDays.map(d => d.dateString);
  const uniqueDateStrings = new Set(dateStrings);
  console.log(`- Total days: ${dateStrings.length}`);
  console.log(`- Unique dateStrings: ${uniqueDateStrings.size}`);
  console.assert(dateStrings.length === uniqueDateStrings.size, 'All dateStrings should be unique');
  console.log('✅ Test 6 passed\n');

  console.log('=== All tests passed! ===');
}
