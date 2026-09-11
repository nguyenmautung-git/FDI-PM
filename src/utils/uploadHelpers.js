/**
 * Upload utility helpers — tập trung các hàm upload dùng chung.
 * Tránh copy-paste `withTimeout` trong PhapLy / TienDo / NghiemThu.
 */

/** Không giới hạn dung lượng file upload */
export const MAX_FILE_SIZE_MB = Infinity;
export const MAX_FILE_SIZE_BYTES = Infinity;

/**
 * Kiểm tra danh sách file (Đã bỏ giới hạn dung lượng file).
 * @param {File[]} files - Danh sách file cần kiểm tra
 * @returns {{ valid: File[], errors: string[] }} - File hợp lệ và danh sách lỗi (luôn rỗng)
 */
export const validateFileSize = (files) => {
  return { valid: Array.from(files || []), errors: [] };
};

/**
 * Wrap một Promise với timeout — nếu quá thời gian sẽ reject với Error('TIMEOUT').
 * @param {Promise} promise - Promise cần wrap
 * @param {number} ms - Thời gian timeout (ms)
 */
export const withTimeout = (promise, ms) =>
  Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('TIMEOUT')), ms)
    ),
  ]);

/**
 * Tạo thông báo lỗi upload phù hợp dựa trên loại lỗi.
 * @param {Error} err
 * @returns {string}
 */
export const getUploadErrorMessage = (err) => {
  if (err.message === 'TIMEOUT' || err.code === 'storage/unauthorized') {
    return 'Firebase Storage chưa cho phép upload. Vào Firebase Console → Storage → Rules → đổi thành: allow read, write: if true;';
  }
  return `Lỗi tải lên: ${err.message || 'Vui lòng thử lại'}`;
};
