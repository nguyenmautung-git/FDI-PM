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

  // 2. Khớp Mã dự án (CNS1 <-> CNS-01 <-> CNS-1)
  if (prjCode && (itemStr === prjCode || itemCode === prjCode || itemNorm === prjCodeNorm)) return true;
  if (prjCodeNorm && (itemNorm === prjCodeNorm || normalizeCode(itemCode) === prjCodeNorm)) return true;
  if (prjCodeNN && (itemStr === prjCodeNN || itemCode === prjCodeNN)) return true;

  // 3. Khớp chính xác Tên dự án (hiện tại hoặc tên gốc)
  if (prjName && (itemStr === prjName || itemNorm === normalizeCode(prjName))) return true;
  if (origName && (itemStr === origName || itemNorm === normalizeCode(origName))) return true;

  // 4. Khớp tương đối nếu cả hai chuỗi có độ dài có nghĩa (> 5 ký tự)
  if (prjName.length > 5 && itemStr.length > 5) {
    if (itemStr.includes(prjName) || prjName.includes(itemStr)) return true;
  }
  if (origName && origName.length > 5 && itemStr.length > 5) {
    if (itemStr.includes(origName) || origName.includes(itemStr)) return true;
  }

  // 5. Quy tắc riêng cho các dự án CNS (Công nghệ số 01 / CNS1 / CNS-01 / Tòa nhà công nghệ số 01)
  const isCnsDoc = itemNorm.includes('cns1') || 
                   itemNorm.includes('cns01') || 
                   itemStr.includes('công nghệ số 01') || 
                   itemStr.includes('công nghệ số 1') || 
                   itemStr.includes('cns-01') ||
                   itemStr.includes('cns-1') ||
                   itemStr.includes('cns1') ||
                   ((itemStr.includes('tòa nhà công nghệ số') || itemStr.includes('toà nhà công nghệ số')) && !itemStr.includes('02') && !itemStr.includes('03'));

  const isCnsProject = prjCodeNorm.includes('cns1') || 
                       prjCodeNorm.includes('cns01') || 
                       prjName.includes('công nghệ số 01') || 
                       prjName.includes('công nghệ số 1') || 
                       prjCode.includes('cns-01') ||
                       prjCode.includes('cns-1') ||
                       prjCode.includes('cns1') ||
                       prjName.includes('cns-1') ||
                       prjName.includes('cns-01') ||
                       prjName.includes('cns1') ||
                       ((prjName.includes('tòa nhà công nghệ số') || prjName.includes('toà nhà công nghệ số')) && !prjName.includes('02') && !prjName.includes('03'));

  if (isCnsDoc && isCnsProject) return true;

  // 6. Quy tắc riêng cho GPMB: "Khu công viên công nghệ số và hỗn hợp" <-> "Khu đô thị Công viên công nghệ số FPT" <-> "GPMB-CNS"
  const isGpmbDoc = itemStr.includes('công nghệ số và hỗn hợp') || 
                    itemStr.includes('gpmb') ||
                    itemStr === 'gpmb-cns' ||
                    itemNorm === 'gpmbcns';

  const isGpmbProject = prjCode === 'gpmb-cns' || 
                        prjCodeNorm === 'gpmbcns' || 
                        prjCode.includes('gpmb') ||
                        prjName.includes('gpmb') ||
                        prjName.includes('công viên công nghệ số fpt') || 
                        prjName.includes('công nghệ số và hỗn hợp');

  if (isGpmbDoc && isGpmbProject) return true;

  return false;
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

  const rawList = doc.relatedProjects;
  const rawKw = doc.keywords;
  const kwList = Array.isArray(rawKw)
    ? rawKw
    : (typeof rawKw === 'string' && rawKw.trim() ? rawKw.split(',').map(s => s.trim()) : []);

  const hasRelatedProjects = Array.isArray(rawList)
    ? rawList.length > 0
    : (typeof rawList === 'string' && rawList.trim().length > 0);

  // 1. ƯU TIÊN SỐ 1: Nếu tài liệu có mảng relatedProjects (được gán tag rõ ràng)
  // Chỉ khớp nếu dự án nằm trong relatedProjects (hoặc keywords).
  // Tuyệt đối không để projectId / projectName cũ gây khớp sai sang dự án khác.
  if (hasRelatedProjects) {
    const relList = Array.isArray(rawList) ? rawList : [rawList];
    if (relList.some(item => matchProjectWithItem(item, project, originalProject))) {
      return true;
    }
    if (kwList.some(item => matchProjectWithItem(item, project, originalProject))) {
      return true;
    }
    return false;
  }

  // 2. Dự phòng cho các tài liệu cũ chưa có relatedProjects:
  // Khớp qua doc.projectId hoặc doc.projectName hoặc keywords
  if (doc.projectId && matchProjectWithItem(doc.projectId, project, originalProject)) return true;
  if (doc.projectName && matchProjectWithItem(doc.projectName, project, originalProject)) return true;
  if (kwList.some(item => matchProjectWithItem(item, project, originalProject))) return true;

  return false;
};

/**
 * Kiểm tra xem dự án p có đang được chọn trong mảng relatedProjects không
 */
export const isProjectSelected = (relatedProjects = [], p) => {
  if (!Array.isArray(relatedProjects) || !p) return false;
  return relatedProjects.some(item => matchProjectWithItem(item, p));
};
