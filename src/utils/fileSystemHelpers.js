/**
 * fileSystemHelpers.js
 * Tiện ích hỗ trợ tương tác với File System Access API của trình duyệt (Chrome, Edge...)
 * Cho phép chọn tệp và xóa tệp gốc trên máy sau khi tải lên thành công.
 */

/**
 * Kiểm tra xem trình duyệt có hỗ trợ File System Access API (showOpenFilePicker) hay không.
 */
export const isFileSystemAccessSupported = () => {
  return typeof window !== 'undefined' && typeof window.showOpenFilePicker === 'function';
};

/**
 * Kiểm tra hỗ trợ chọn thư mục
 */
export const isDirectoryPickerSupported = () => {
  return typeof window !== 'undefined' && typeof window.showDirectoryPicker === 'function';
};

/**
 * Mở hộp thoại chọn tệp với File System Access API
 * @param {Object} options
 * @returns {Promise<Array<{ file: File, handle: FileSystemFileHandle, canDelete: boolean }>>}
 */
export const pickFilesWithHandle = async (options = { multiple: true }) => {
  if (!isFileSystemAccessSupported()) {
    throw new Error('Trình duyệt không hỗ trợ File System Access API. Vui lòng sử dụng Google Chrome hoặc Microsoft Edge trên máy tính.');
  }

  const handles = await window.showOpenFilePicker({
    multiple: options.multiple !== false,
    types: options.types || undefined,
  });

  const results = [];
  for (const handle of handles) {
    const file = await handle.getFile();
    // Đính kèm handle trực tiếp vào đối tượng File để tiện truy xuất
    file._fileHandle = handle;
    file._canDeleteLocal = true;
    results.push({
      file,
      handle,
      canDelete: true,
      name: file.name,
      size: file.size,
    });
  }

  return results;
};

/**
 * Mở hộp thoại chọn thư mục và lấy danh sách tệp bên trong kèm quyền ghi/xóa
 * @returns {Promise<{ dirHandle: FileSystemDirectoryHandle, files: Array<{ file: File, handle: FileSystemFileHandle, dirHandle: FileSystemDirectoryHandle }> }>}
 */
export const pickDirectoryFilesWithHandle = async () => {
  if (!isDirectoryPickerSupported()) {
    throw new Error('Trình duyệt không hỗ trợ chọn thư mục.');
  }

  const dirHandle = await window.showDirectoryPicker({ mode: 'readwrite' });
  const files = [];

  for await (const entry of dirHandle.values()) {
    if (entry.kind === 'file') {
      const file = await entry.getFile();
      file._fileHandle = entry;
      file._dirHandle = dirHandle;
      file._canDeleteLocal = true;
      files.push({
        file,
        handle: entry,
        dirHandle,
        name: file.name,
        size: file.size,
      });
    }
  }

  return { dirHandle, files };
};

/**
 * Thực hiện xóa tệp gốc trên máy tính của người dùng thông qua FileHandle hoặc DirHandle
 * @param {FileSystemFileHandle} handle 
 * @param {FileSystemDirectoryHandle} [dirHandle] 
 * @returns {Promise<{ success: boolean, name: string, error?: string }>}
 */
export const deleteLocalFile = async (handle, dirHandle = null) => {
  if (!handle) {
    return { success: false, name: '', error: 'Không tìm thấy FileHandle của tệp.' };
  }

  const fileName = handle.name || 'tệp';

  try {
    // Phương án 1: Gọi handle.remove() trực tiếp (hỗ trợ trên Chromium 110+)
    if (typeof handle.remove === 'function') {
      await handle.remove();
      return { success: true, name: fileName };
    }

    // Phương án 2: Nếu có dirHandle cha, xóa thông qua removeEntry
    if (dirHandle && typeof dirHandle.removeEntry === 'function') {
      await dirHandle.removeEntry(fileName);
      return { success: true, name: fileName };
    }

    return {
      success: false,
      name: fileName,
      error: 'Phiên bản trình duyệt hiện tại không hỗ trợ trực tiếp lệnh xóa tệp này.'
    };
  } catch (err) {
    // Lỗi có thể do người dùng bấm "Hủy / Từ chối" khi trình duyệt hỏi, hoặc tệp đang bị khóa bởi chương trình khác
    if (err.name === 'AbortError' || err.name === 'NotAllowedError') {
      return {
        success: false,
        name: fileName,
        error: 'Người dùng từ chối cấp quyền xóa tệp trên máy tính.'
      };
    }
    return {
      success: false,
      name: fileName,
      error: err.message || 'Lỗi không xác định khi xóa tệp gốc.'
    };
  }
};
