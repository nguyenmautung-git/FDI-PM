/**
 * App-wide constants — tập trung tất cả magic strings để dễ bảo trì.
 * Import từ bất kỳ component nào thay vì hard-code strings trực tiếp.
 */

// ── Vai trò người dùng ────────────────────────────────────────────────────
export const ROLES = {
  ADMIN: 'Admin',
  USER: 'User',
};

// ── Trạng thái bước công việc (pháp lý / tiến độ / nghiệm thu) ───────────
export const STEP_STATUS = {
  DONE: 'done',
  IN_PROGRESS: 'inprogress',
  PENDING: 'pending',
};

// ── Trạng thái lời mời thành viên ─────────────────────────────────────────
export const INVITE_STATUS = {
  PENDING: 'pending',
  ACTIVE: 'active',
  REVOKED: 'revoked',
  EXPIRED: 'expired',
};

// ── Tên collection Firestore ──────────────────────────────────────────────
export const COLLECTIONS = {
  DOCUMENTS: 'documents',
  PROJECTS: 'projects',
  MEMBERS: 'members',
  PARTNERS: 'partners',
  BIDDING_PACKAGES: 'biddingPackages',
  LEGAL_STEPS: 'legalSteps',
  SCHEDULE_STEPS: 'scheduleSteps',
  ACCEPTANCE_STEPS: 'acceptanceSteps',
  INVITATIONS: 'invitations',
};

// ── Danh sách bước mặc định (dùng chung PhapLy & TienDo) ─────────────────
export const WORKFLOW_DEFAULT_STEPS = [
  'Phê duyệt chủ trương đầu tư',
  'Phê duyệt dự án đầu tư (Quyết định đầu tư)',
  'Chấp thuận địa điểm xây dựng',
  'Phê duyệt quy hoạch chi tiết 1/500',
  'Cấp phép xây dựng',
  'Thẩm duyệt thiết kế PCCC',
  'Phê duyệt thiết kế bản vẽ thi công',
  'Nghiệm thu hoàn thành công trình',
  'Bàn giao đưa vào sử dụng',
];

// ── Phân nhóm Giai đoạn Pháp lý ──────────────────────────────────────────
export const LEGAL_PHASES = {
  PHASE_1: 'Giai đoạn 1: Chuẩn bị đầu tư xây dựng',
  PHASE_2: 'Giai đoạn 2: Thực hiện đầu tư xây dựng',
  PHASE_3: 'Giai đoạn 3: Kết thúc đầu tư xây dựng',
};

// ── Mẫu quy trình pháp lý dự án có sẵn ────────────────────────────────────
export const LEGAL_TEMPLATES = {
  civil: {
    name: 'Quy trình chuẩn Xây dựng dân dụng',
    steps: [
      { name: 'Phê duyệt chủ trương đầu tư', phase: 'PHASE_1', order: 0 },
      { name: 'Chấp thuận địa điểm xây dựng', phase: 'PHASE_1', order: 1 },
      { name: 'Phê duyệt quy hoạch chi tiết 1/500', phase: 'PHASE_1', order: 2 },
      { name: 'Phê duyệt dự án đầu tư (Quyết định đầu tư)', phase: 'PHASE_1', order: 3 },
      { name: 'Thẩm duyệt thiết kế PCCC', phase: 'PHASE_2', order: 4 },
      { name: 'Phê duyệt thiết kế bản vẽ thi công', phase: 'PHASE_2', order: 5 },
      { name: 'Cấp phép xây dựng', phase: 'PHASE_2', order: 6 },
      { name: 'Báo cáo đánh giá tác động môi trường (ĐTM)', phase: 'PHASE_2', order: 7 },
      { name: 'Nghiệm thu hoàn thành công trình', phase: 'PHASE_3', order: 8 },
      { name: 'Bàn giao đưa vào sử dụng', phase: 'PHASE_3', order: 9 },
    ]
  },
  infrastructure: {
    name: 'Quy trình chuẩn Công trình Hạ tầng kỹ thuật',
    steps: [
      { name: 'Báo cáo nghiên cứu khả thi', phase: 'PHASE_1', order: 0 },
      { name: 'Báo cáo đánh giá tác động môi trường', phase: 'PHASE_1', order: 1 },
      { name: 'Cấp phép quy hoạch', phase: 'PHASE_1', order: 2 },
      { name: 'Thu hồi đất & Giải phóng mặt bằng', phase: 'PHASE_2', order: 3 },
      { name: 'Giao đất & Cấp sổ đỏ dự án', phase: 'PHASE_2', order: 4 },
      { name: 'Thẩm định thiết kế kỹ thuật', phase: 'PHASE_2', order: 5 },
      { name: 'Cấp phép xây dựng hạ tầng', phase: 'PHASE_2', order: 6 },
      { name: 'Nghiệm thu kỹ thuật công trình', phase: 'PHASE_3', order: 7 },
      { name: 'Bàn giao đưa vào sử dụng', phase: 'PHASE_3', order: 8 },
    ]
  }
};

