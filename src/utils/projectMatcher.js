/**
 * Utility functions để khớp tài liệu với dự án một cách linh hoạt, chính xác và thông minh.
 * Xử lý tất cả các trường hợp:
 * - Tài liệu được tag bằng Tên dự án (cũ hoặc mới)
 * - Tài liệu được tag bằng Mã dự án (CNS1, CNS-01, CNS-1...)
 * - Tài liệu được tag bằng ID dự án
 * - Chuỗi có dấu gạch ngang, khoảng trắng thừa hoặc chữ hoa/thường
 */

export const cleanStr = (s) => {
  if (!s) return '';
  return String(s)
    .trim()
    .toLowerCase()
    .normalize('NFC')
    .replace(/oà/g, 'òa')
    .replace(/oá/g, 'óa')
    .replace(/oả/g, 'ỏa')
    .replace(/oã/g, 'õa')
    .replace(/oạ/g, 'ọa')
    .replace(/uỳ/g, 'ùy')
    .replace(/uý/g, 'úy')
    .replace(/uỷ/g, 'ủy')
    .replace(/uỹ/g, 'ũy')
    .replace(/uỵ/g, 'ụy');
};

export const normalizeCode = (s) => {
  if (!s) return '';
  // Bỏ dấu gạch ngang, gạch dưới, khoảng trắng: "CNS-01" -> "cns01", "CNS 1" -> "cns1"
  return cleanStr(s).replace(/[-\s_]/g, '');
};

/**
 * Kiểm tra xem một item (chuỗi tag, ID, mã, hoặc object) có khớp với dự án hay không.
 */
export const matchProjectWithItem = (item, project, originalProject = null) => {
  if (!item || !project) return false;

  const prjId = cleanStr(project.id || originalProject?.id);
  const prjCode = cleanStr(project.code || originalProject?.code);
  const prjCodeNorm = normalizeCode(project.code || originalProject?.code);
  const prjCodeNN = cleanStr(project.codeNN || originalProject?.codeNN);
  const prjName = cleanStr(project.name);
  const origName = cleanStr(originalProject?.name);

  let itemStr = '';
  let itemId = '';
  let itemCode = '';
  if (typeof item === 'object') {
    itemStr = cleanStr(item.name || item.title || item.code || item.id);
    itemId = cleanStr(item.id);
    itemCode = cleanStr(item.code);
  } else {
    itemStr = cleanStr(item);
  }

  if (!itemStr && !itemId && !itemCode) return false;

  const itemNorm = normalizeCode(itemStr);

  // 1. Khớp ID
  if (prjId && (itemStr === prjId || itemId === prjId)) return true;

  // PHÂN BIỆT RÕ RÀNG GPMB VÀ DỰ ÁN CHÍNH:
  // Nếu 1 bên là GPMB (Giải phóng mặt bằng) và bên kia KHÔNG PHẢI GPMB -> TUYỆT ĐỐI KHÔNG KHỚP
  const prjIsGpmb = prjName.includes('gpmb') || prjName.includes('giải phóng mặt bằng') || prjCode.includes('gpmb') || prjCodeNorm.includes('gpmb');
  const itemIsGpmb = itemStr.includes('gpmb') || itemStr.includes('giải phóng mặt bằng') || itemCode.includes('gpmb') || itemNorm.includes('gpmb');
  if (prjIsGpmb !== itemIsGpmb) {
    return false;
  }

  // 2. Khớp Mã dự án (CNS1 <-> CNS-01 <-> CNS-1)
  if (prjCode && (itemStr === prjCode || itemCode === prjCode || itemNorm === prjCodeNorm)) return true;
  if (prjCodeNorm && (itemNorm === prjCodeNorm || normalizeCode(itemCode) === prjCodeNorm)) return true;
  if (prjCodeNN && (itemStr === prjCodeNN || itemCode === prjCodeNN)) return true;

  // 3. Khớp chính xác Tên dự án (hiện tại hoặc tên gốc)
  if (prjName && (itemStr === prjName || itemNorm === normalizeCode(prjName))) return true;
  if (origName && (itemStr === origName || itemNorm === normalizeCode(origName))) return true;

  // 4. Khớp tên dự án chứa mã ngắn (chỉ áp dụng nếu itemStr là mã ngắn từ 2-8 ký tự, không chứa khoảng trắng, VD: "57a", "cns1")
  if (itemStr.length >= 2 && itemStr.length <= 8 && !itemStr.includes(' ')) {
    const wordBoundaryRegex = new RegExp(`(^|[^a-zA-Z0-9])${itemStr}([^a-zA-Z0-9]|$)`, 'i');
    if (prjName && wordBoundaryRegex.test(prjName)) return true;
    if (origName && wordBoundaryRegex.test(origName)) return true;

    const prjNorm = normalizeCode(prjName);
    if (itemNorm && prjNorm && (prjNorm.endsWith(itemNorm) || prjNorm.startsWith(itemNorm) || prjNorm.includes(itemNorm))) {
      if (itemNorm.length >= 3) return true;
    }
  }

  // 5. Quy tắc riêng cho các dự án CNS (Công nghệ số 01 / CNS1 / CNS-01 / Tòa nhà công nghệ số 01)
  // Chỉ chạy khi cả 2 bên đều KHÔNG PHẢI GPMB (đã bảo đảm bởi kiểm tra prjIsGpmb !== itemIsGpmb ở trên)
  const isCnsDoc = itemNorm === 'cns1' || 
                   itemNorm === 'cns01' || 
                   itemStr === 'công nghệ số 01' || 
                   itemStr === 'công nghệ số 1' || 
                   itemStr === 'cns-01' ||
                   itemStr === 'cns-1' ||
                   itemStr === 'cns1' ||
                   itemStr === 'tòa nhà công nghệ số 01' ||
                   itemStr === 'toà nhà công nghệ số 01';

  const isCnsProject = prjCodeNorm === 'cns1' || 
                       prjCodeNorm === 'cns01' || 
                       prjName.includes('công nghệ số 01') || 
                       prjName.includes('công nghệ số 1') || 
                       prjCode === 'cns-01' ||
                       prjCode === 'cns-1' ||
                       prjCode === 'cns1';

  if (isCnsDoc && isCnsProject) return true;

  // 6. Quy tắc riêng cho GPMB-CNS (khi cả 2 bên ĐỀU LÀ GPMB):
  const isGpmbCnsDoc = (itemStr === 'gpmb-cns' || itemNorm === 'gpmbcns' || (itemStr.includes('gpmb') && (itemStr.includes('công nghệ số') || itemStr.includes('cns'))));
  const isGpmbCnsProject = (prjCode === 'gpmb-cns' || prjCodeNorm === 'gpmbcns' || (prjName.includes('gpmb') && (prjName.includes('công nghệ số') || prjName.includes('cns'))));

  if (isGpmbCnsDoc && isGpmbCnsProject) return true;

  return false;
};

/**
 * Kiểm tra xem một tài liệu (doc) có thuộc về dự án (project) hay không.
 * Ưu tiên tuyệt đối theo ID duy nhất và mã dự án (không dùng từ khóa).
 * @param {Object} doc - Document object từ Firestore
 * @param {Object} project - Project object (có id, code, name...) hoặc formData trong Projects.jsx
 * @param {Object} [originalProject] - Dự án gốc trong database (nếu đang ở màn hình sửa)
 * @returns {boolean}
 */
export const isDocRelatedToProject = (doc, project, originalProject = null) => {
  if (!doc || doc.isDeleted || !project) return false;

  const targetId = cleanStr(project.id || originalProject?.id);

  // 1. ƯU TIÊN SỐ 1: Khớp trực tiếp qua projectId vĩnh viễn
  if (doc.projectId && targetId && cleanStr(doc.projectId) === targetId) {
    return true;
  }
  if (doc.projectId && matchProjectWithItem(doc.projectId, project, originalProject)) {
    return true;
  }

  // 2. ƯU TIÊN SỐ 2: Nếu tài liệu có mảng relatedProjects (được gán tag ID hoặc Mã dự án)
  // Chỉ khớp các tag này với ID / Mã / Tên của dự án.
  // TUYỆT ĐỐI không dùng từ khóa (keywords) để suy đoán dự án.
  const rawList = doc.relatedProjects;
  const hasRelatedProjects = Array.isArray(rawList)
    ? rawList.length > 0
    : (typeof rawList === 'string' && rawList.trim().length > 0);

  if (hasRelatedProjects) {
    const relList = Array.isArray(rawList) ? rawList : [rawList];
    return relList.some(item => matchProjectWithItem(item, project, originalProject));
  }

  // 3. Dự phòng cho tài liệu cũ chỉ có projectName (không có relatedProjects và chưa có projectId)
  if (doc.projectName && matchProjectWithItem(doc.projectName, project, originalProject)) {
    return true;
  }

  return false;
};

/**
 * Kiểm tra xem dự án p có đang được chọn trong mảng relatedProjects không.
 * Khớp CHÍNH XÁC theo ID, Tên dự án hoặc Mã dự án (không fuzzy substring, không tự động gán chéo dự án khác).
 */
export const isProjectSelected = (relatedProjects = [], p) => {
  if (!Array.isArray(relatedProjects) || !p) return false;

  const pId = cleanStr(p.id);
  const pName = cleanStr(p.name);
  const pCode = cleanStr(p.code);
  const pCodeNorm = normalizeCode(p.code);

  return relatedProjects.some(item => {
    if (!item) return false;
    let itemStr = '';
    let itemId = '';
    let itemCode = '';
    if (typeof item === 'object') {
      itemStr = cleanStr(item.name || item.title || item.code || item.id);
      itemId = cleanStr(item.id);
      itemCode = cleanStr(item.code);
    } else {
      itemStr = cleanStr(item);
    }
    const itemNorm = normalizeCode(itemStr);

    // 1. Khớp chính xác ID
    if (pId && (itemStr === pId || itemId === pId)) return true;

    // 2. Khớp chính xác Tên dự án
    if (pName && (itemStr === pName || itemNorm === normalizeCode(pName))) return true;

    // 3. Khớp chính xác Mã dự án
    if (pCode && (itemStr === pCode || itemCode === pCode || itemNorm === pCodeNorm)) return true;

    return false;
  });
};
