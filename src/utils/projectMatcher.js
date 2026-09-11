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
  return String(s).trim().toLowerCase();
};

export const normalizeCode = (s) => {
  if (!s) return '';
  // Bỏ dấu gạch ngang, gạch dưới, khoảng trắng: "CNS-01" -> "cns01", "CNS 1" -> "cns1"
  return String(s).toLowerCase().replace(/[-\s_]/g, '');
};

/**
 * Kiểm tra xem một tài liệu (doc) có thuộc về dự án (project) hay không.
 * @param {Object} doc - Document object từ Firestore
 * @param {Object} project - Project object (có name, code, id...) hoặc formData trong Projects.jsx
 * @param {Object} [originalProject] - Dự án gốc trong database (nếu đang ở màn hình sửa)
 * @returns {boolean}
 */
export const isDocRelatedToProject = (doc, project, originalProject = null) => {
  if (!doc || doc.isDeleted || !project) return false;

  const prjId = cleanStr(project.id || originalProject?.id);
  const prjCode = cleanStr(project.code || originalProject?.code);
  const prjCodeNorm = normalizeCode(project.code || originalProject?.code);
  const prjCodeNN = cleanStr(project.codeNN || originalProject?.codeNN);
  const prjName = cleanStr(project.name);
  const origName = cleanStr(originalProject?.name);

  // 1. Khớp qua các trường trực tiếp trên document: projectId, projectName
  const docPrjId = cleanStr(doc.projectId);
  const docPrjName = cleanStr(doc.projectName);

  if (docPrjId) {
    if (prjId && docPrjId === prjId) return true;
    if (prjCode && docPrjId === prjCode) return true;
    if (prjCodeNorm && normalizeCode(docPrjId) === prjCodeNorm) return true;
  }

  if (docPrjName) {
    if (prjName && (docPrjName === prjName || prjName.includes(docPrjName) || docPrjName.includes(prjName))) return true;
    if (origName && (docPrjName === origName || origName.includes(docPrjName) || docPrjName.includes(origName))) return true;
    if (prjCode && docPrjName === prjCode) return true;
    if (prjCodeNorm && normalizeCode(docPrjName) === prjCodeNorm) return true;
  }

  // 2. Khớp qua mảng relatedProjects của document
  const rawList = doc.relatedProjects;
  const relList = Array.isArray(rawList)
    ? rawList
    : (typeof rawList === 'string' && rawList.trim() ? [rawList] : []);

  for (const item of relList) {
    if (!item) continue;
    
    // Nếu item là object { id, code, name }
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

    if (!itemStr && !itemId && !itemCode) continue;

    const itemNorm = normalizeCode(itemStr);

    // Khớp ID
    if (prjId && (itemStr === prjId || itemId === prjId)) return true;

    // Khớp Mã dự án (CNS1 <-> CNS-01 <-> CNS-1)
    if (prjCode && (itemStr === prjCode || itemCode === prjCode || itemNorm === prjCodeNorm)) return true;
    if (prjCodeNorm && (itemNorm === prjCodeNorm || normalizeCode(itemCode) === prjCodeNorm)) return true;
    if (prjCodeNN && (itemStr === prjCodeNN || itemCode === prjCodeNN)) return true;

    // Khớp chính xác Tên dự án (hiện tại hoặc tên gốc)
    if (prjName && (itemStr === prjName || itemNorm === normalizeCode(prjName))) return true;
    if (origName && (itemStr === origName || itemNorm === normalizeCode(origName))) return true;

    // Khớp tương đối nếu tên có độ dài có nghĩa (> 5 ký tự)
    if (prjName.length > 5 && (itemStr.includes(prjName) || prjName.includes(itemStr))) return true;
    if (origName && origName.length > 5 && (itemStr.includes(origName) || origName.includes(itemStr))) return true;

    // Quy tắc riêng cho các dự án CNS (Công nghệ số 01 / CNS1 / CNS-01)
    const isCnsDoc = itemNorm.includes('cns1') || 
                     itemNorm.includes('cns01') || 
                     itemStr.includes('công nghệ số 01') || 
                     itemStr.includes('công nghệ số 1') || 
                     (itemStr.includes('tòa nhà công nghệ số') && !itemStr.includes('02') && !itemStr.includes('03'));

    const isCnsProject = prjCodeNorm.includes('cns1') || 
                         prjCodeNorm.includes('cns01') || 
                         prjName.includes('công nghệ số 01') || 
                         prjName.includes('công nghệ số 1') || 
                         (prjName.includes('tòa nhà công nghệ số') && !prjName.includes('02') && !prjName.includes('03'));

    if (isCnsDoc && isCnsProject) return true;

    // Quy tắc FPT Park: "Khu công viên công nghệ số và hỗn hợp" <-> "Khu đô thị Công viên công nghệ số FPT"
    if (
      (itemStr.includes('công nghệ số và hỗn hợp') || itemStr === 'gpmb-cns') &&
      (prjCode === 'gpmb-cns' || prjName.includes('công viên công nghệ số fpt') || prjName.includes('công nghệ số và hỗn hợp'))
    ) {
      return true;
    }
  }

  return false;
};

/**
 * Kiểm tra xem dự án p có đang được chọn trong mảng relatedProjects không
 */
export const isProjectSelected = (relatedProjects = [], p) => {
  if (!Array.isArray(relatedProjects) || !p) return false;
  const pName = cleanStr(p.name);
  const pCode = cleanStr(p.code);
  const pCodeNorm = normalizeCode(p.code);
  const pId = cleanStr(p.id);

  return relatedProjects.some(item => {
    if (!item) return false;
    const str = cleanStr(typeof item === 'object' ? (item.name || item.code || item.id) : item);
    const strNorm = normalizeCode(str);

    if (pName && (str === pName || strNorm === normalizeCode(pName))) return true;
    if (pCode && (str === pCode || strNorm === pCodeNorm)) return true;
    if (pId && str === pId) return true;
    
    // Check CNS variants
    if ((strNorm.includes('cns1') || strNorm.includes('cns01')) && (pCodeNorm.includes('cns1') || pCodeNorm.includes('cns01'))) return true;

    return false;
  });
};
