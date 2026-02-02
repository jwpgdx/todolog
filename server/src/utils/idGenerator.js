const crypto = require('crypto');

/**
 * UUID v4 생성
 * @returns {string}
 */
function generateId() {
    return crypto.randomUUID();
}

/**
 * 게스트 ID 생성
 * @returns {string}
 */
function generateGuestId() {
    return `guest_${crypto.randomUUID()}`;
}

/**
 * 게스트 ID 여부 확인
 * @param {string} id 
 * @returns {boolean}
 */
function isGuestId(id) {
    return id && id.startsWith('guest_');
}

/**
 * UUID 유효성 검사 (클라이언트에서 온 ID 검증용)
 * @param {string} id 
 * @returns {boolean}
 */
function isValidUUID(id) {
    if (!id || typeof id !== 'string') return false;
    // guest_ 접두사 허용
    const cleanId = id.startsWith('guest_') ? id.slice(6) : id;
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(cleanId);
}

module.exports = {
    generateId,
    generateGuestId,
    isGuestId,
    isValidUUID,
};
