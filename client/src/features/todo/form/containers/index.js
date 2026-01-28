/**
 * Form Containers Index
 * 플랫폼별 컨테이너 re-export
 * 
 * Metro bundler가 플랫폼별 파일을 자동으로 선택:
 * - iOS: DetailContainer.ios.js
 * - Android: DetailContainer.android.js
 * - Web: DetailContainer.web.js / QuickContainer.web.js
 */

export { default as QuickContainer } from './QuickContainer';
export { default as DetailContainer } from './DetailContainer';
