/**
 * Upload utility helpers — tập trung các hàm upload dùng chung.
 * Tránh copy-paste `withTimeout` trong PhapLy / TienDo / NghiemThu.
 */

/** Giới hạn dung lượng tối đa cho mỗi file upload (50 MB). */
export const MAX_FILE_SIZE_MB = 50;
export const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

/**
 * Kiểm tra danh sách file có file nào vượt quá giới hạn dung lượng không.
 * @param {File[]} files - Danh sách file cần kiểm tra
 * @param {number} [maxBytes] - Giới hạn dung lượng (bytes), mặc định 50 MB
 * @returns {{ valid: File[], errors: string[] }} - File hợp lệ và danh sách lỗi
 */
export const validateFileSize = (files, maxBytes = MAX_FILE_SIZE_BYTES) => {
  const valid = [];
  const errors = [];
  for (const file of files) {
    if (file.size > maxBytes) {
      errors.push(
        `"${file.name}" vượt quá ${MAX_FILE_SIZE_MB}MB (${(file.size / 1024 / 1024).toFixed(1)}MB)`
      );
    } else {
      valid.push(file);
    }
  }
  return { valid, errors };
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
