/**
 * StepBadge — shared badge component dùng chung cho PhapLy, TienDo, NghiemThu.
 * Trước đây được định nghĩa lại (copy-paste 100%) trong cả 3 file.
 */
import React from 'react';
import { Check, Clock, Circle } from 'lucide-react';
import { STEP_STATUS } from '../../constants';

/** Map trạng thái bước → màu sắc, label, icon */
export const STATUS_CONFIG = {
  [STEP_STATUS.DONE]: {
    label: 'Hoàn thành',
    color: '#34d399',
    bg: 'rgba(16, 185, 129, 0.15)',
    icon: Check,
  },
  [STEP_STATUS.IN_PROGRESS]: {
    label: 'Đang thực hiện',
    color: '#fbbf24',
    bg: 'rgba(245, 158, 11, 0.15)',
    icon: Clock,
  },
  [STEP_STATUS.PENDING]: {
    label: 'Chưa thực hiện',
    color: '#94a3b8',
    bg: 'rgba(148, 163, 184, 0.15)',
    icon: Circle,
  },
};

/**
 * Badge hiển thị trạng thái của một bước công việc.
 * @param {{ status: 'done'|'inprogress'|'pending' }} props
 */
const StepBadge = ({ status }) => {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG[STEP_STATUS.PENDING];
  const Icon = cfg.icon;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '4px',
      padding: '2px 8px', borderRadius: '20px',
      backgroundColor: cfg.bg, color: cfg.color,
      fontSize: '0.7rem', fontWeight: '600', whiteSpace: 'nowrap',
    }}>
      <Icon size={11} /> {cfg.label}
    </span>
  );
};

export default StepBadge;
