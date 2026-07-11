/**
 * Form Containers Index
 * 플랫폼별 컨테이너 re-export
 *
 * Metro bundler가 네이티브 플랫폼별 파일을 자동으로 선택:
 * - iOS: DetailContainer.ios.js / QuickContainer.ios.js
 * - Android: DetailContainer.android.js / QuickContainer.js
 */

export { default as QuickContainer } from './QuickContainer';
export { default as DetailContainer } from './DetailContainer';
