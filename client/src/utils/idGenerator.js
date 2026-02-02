import * as Crypto from 'expo-crypto';

/**
 * UUID v4 생성 (expo-crypto 기반)
 * @returns {string} UUID v4 (36자, 하이픈 포함)
 */
export function generateId() {
    return Crypto.randomUUID();
}

/**
 * Completion ID 생성
 * 형식: todoId_YYYY-MM-DD
 * @param {string} todoId 
 * @param {string} date - YYYY-MM-DD
 * @returns {string}
 */
export function generateCompletionId(todoId, date) {
    return `${todoId}_${date}`;
}

/**
 * 게스트 ID 생성
 * @returns {string} guest_UUID
 */
export function generateGuestId() {
    return `guest_${Crypto.randomUUID()}`;
}

/**
 * 게스트 ID 여부 확인
 * @param {string} id 
 * @returns {boolean}
 */
export function isGuestId(id) {
    return id && id.startsWith('guest_');
}

/**
 * UUID 유효성 검사
 * @param {string} id 
 * @returns {boolean}
 */
export function isValidUUID(id) {
    if (!id || typeof id !== 'string') return false;
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(id);
}
