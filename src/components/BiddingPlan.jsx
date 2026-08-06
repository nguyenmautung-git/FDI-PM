import React, { useState, useContext, useRef, useEffect } from 'react';
import { ROLES } from '../constants';
import { createPortal } from 'react-dom';
import { DocumentContext } from '../context/DocumentContext';
import { useToast, useConfirm } from '../context/UIContext';
import { getPastelColor } from '../data';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../firebase';
import { withTimeout, validateFileSize } from '../utils/uploadHelpers';
import { MapPin, Building, Plus, Trash2, Check, ChevronDown, ChevronUp, Briefcase, Save, ArrowUp, ArrowDown, Settings, Upload, X, Maximize2, Users } from 'lucide-react';// ─── Constants ──────────────────────────────────────────────────────────────
const METHOD_OPTIONS = ['Đấu thầu rộng rãi', 'Đấu thầu hạn chế', 'Chỉ định thầu', 'Mua sắm trực tiếp', 'Chào hàng cạnh tranh', 'Tự thực hiện'];
const PROCUREMENT_OPTIONS = ['Một giai đoạn một túi hồ sơ', 'Một giai đoạn hai túi hồ sơ', 'Hai giai đoạn'];
const CONTRACT_OPTIONS = ['Hợp đồng trọn gói', 'Hợp đồng theo đơn giá cố định', 'Hợp đồng theo đơn giá điều chỉnh', 'Hợp đồng theo thời gian', 'Hợp đồng theo chi phí cộng phí'];
const FUND_SOURCE_OPTIONS = [
  'Vốn ngân sách nhà nước', 'Vốn trái phiếu Chính phủ',
  'Vốn ODA và vốn vay ưu đãi của nhà tài trợ nước ngoài',
  'Vốn tín dụng đầu tư phát triển của Nhà nước',
  'Vốn đầu tư từ nguồn thu để lại chưa đưa vào cân đối NSNN',
  'Vốn của doanh nghiệp nhà nước', 'Vốn hỗn hợp (NSNN + vốn doanh nghiệp)',
  'Vốn hợp tác công tư (PPP)', 'Vốn tư nhân', 'Nguồn vốn hợp pháp khác',
];
const STATUS_OPTIONS = ['📝 Đang soạn thảo', '⏳ Đang chờ duyệt', '✅ Đã phê duyệt'];

const formatPrice = (val) => {
  const digits = String(val).replace(/\D/g, '');
  if (!digits) return '';
  return parseInt(digits, 10).toLocaleString('vi-VN');
};
const unformatPrice = (val) => String(val).replace(/\./g, '').replace(/,/g, '');

const EMPTY_ROW = () => ({
  _new: true,
  code: '', name: '', summary: '', nature: '', price: '',
  fundSource: 'Vốn tư nhân',
  selectionMethod: 'Đấu thầu hạn chế',
  procurementMethod: 'Một giai đoạn hai túi hồ sơ',
  startTime: '', closingTime: '', openingTime: '',
  contractType: 'Hợp đồng trọn gói',
  optionToBuy: false,
  status: '📝 Đang soạn thảo',
  attachment: [],
});

// ─── Column definitions ──────────────────────────────────────────────────────
const COLUMNS = [
  { key: 'code',               label: 'Mã gói thầu',           width: 140, type: 'code' },
  { key: 'status',             label: 'Trạng thái',            width: 130, type: 'status', options: STATUS_OPTIONS },
  { key: 'name',               label: 'Tên gói thầu',          width: 180, required: true },
  { key: 'invitedBidders',     label: 'Danh sách mời thầu',    width: 140, type: 'bidders_list' },
  { key: 'nature',             label: 'Tính chất gói thầu',    width: 160, type: 'nature_select' },
  { key: 'summary',            label: 'Tóm tắt CV chính',       width: 180, type: 'textarea' },
  { key: 'price',              label: 'Giá dự toán (VNĐ)',     width: 150, type: 'price' },
  { key: 'fundSource',         label: 'Nguồn vốn',              width: 180, type: 'select', options: FUND_SOURCE_OPTIONS },
  { key: 'selectionMethod',    label: 'Hình thức LCNT',         width: 160, type: 'select', options: METHOD_OPTIONS },
  { key: 'procurementMethod',  label: 'Phương thức LCNT',       width: 160, type: 'select', options: PROCUREMENT_OPTIONS },
  { key: 'startTime',          label: 'Ngày mời thầu',          width: 140, type: 'date' },
  { key: 'closingTime',        label: 'Ngày đóng thầu',         width: 140, type: 'date' },
  { key: 'openingTime',        label: 'Ngày mở thầu',           width: 140, type: 'date' },
  { key: 'contractType',       label: 'Loại hợp đồng',          width: 180, type: 'select', options: CONTRACT_OPTIONS },
  { key: 'optionToBuy',        label: 'Tùy chọn mua thêm',     width: 90,  type: 'checkbox' },
  { key: 'attachment',         label: 'Tệp đính kèm',           width: 180, type: 'file' },
];


// ─── Custom Combobox ─────────────────────────────────────────────────────────
const NameCombobox = ({ value, onChange, isNew }) => {
  const { globalLists, deleteListItem } = useContext(DocumentContext);
  const packageNames = globalLists?.packageNames || [];
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);
  const [dropdownStyle, setDropdownStyle] = useState({});

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        const dropdownElement = document.getElementById('name-combobox-dropdown');
        if (dropdownElement && dropdownElement.contains(e.target)) return;
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (isOpen && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      const maxH = 220; // Maximum desired height

      let style = {
        position: 'fixed',
        left: `${rect.left}px`,
        width: `${rect.width}px`,
        zIndex: 999999,
      };

      if (spaceBelow < maxH && spaceAbove > spaceBelow) {
        // Drop upwards
        style.bottom = `${window.innerHeight - rect.top + 2}px`;
        style.maxHeight = `${Math.min(spaceAbove - 10, maxH)}px`;
        style.boxShadow = '0 -4px 12px rgba(0,0,0,0.15)'; // Shadow upwards
      } else {
        // Drop downwards
        style.top = `${rect.bottom + 2}px`;
        style.maxHeight = `${Math.min(spaceBelow - 10, maxH)}px`;
        style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)'; // Shadow downwards
      }

      setDropdownStyle(style);
    }
  }, [isOpen, value, packageNames.length]);

  const filtered = packageNames.filter(o => o.name.toLowerCase().includes((value || '').toLowerCase()));
  const base = { width: '100%', border: 'none', outline: 'none', padding: '5px 8px', fontSize: '0.78rem', backgroundColor: 'transparent', color: 'var(--color-text-main)', fontFamily: 'inherit' };

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%' }}>
      <input
        type="text"
        value={value}
        onChange={e => { onChange(e.target.value); setIsOpen(true); }}
        onFocus={() => setIsOpen(true)}
        placeholder={isNew ? 'Bắt buộc *' : '...'}
        style={base}
      />
      {isOpen && filtered.length > 0 && createPortal(
        <div id="name-combobox-dropdown" style={{ ...dropdownStyle, background: 'rgba(15, 23, 42, 0.9)', backdropFilter: 'blur(16px)', border: '1px solid var(--color-border)', borderRadius: '4px', overflowY: 'auto' }}>
          {filtered.map(opt => (
            <div key={opt.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid var(--color-border)' }}
              onMouseDown={(e) => {
                e.preventDefault(); // Prevent input blur
                onChange(opt.name);
                setIsOpen(false);
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--color-bg-surface-hover)'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              <span style={{ fontSize: '0.8rem', color: 'var(--color-text-main)', fontWeight: '500' }}>{opt.name}</span>
              <button
                onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); deleteListItem('packageNames', opt.id); }}
                style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center', borderRadius: '4px' }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.2)'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                title="Xóa gợi ý này"
              >
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>,
        document.body
      )}
    </div>
  );
};

// ─── Custom File Upload ──────────────────────────────────────────────────────
const FileUploadCell = ({ value, onChange }) => {
  const fileList = Array.isArray(value) ? value : [];
  const [uploading, setUploading] = useState(false);
  const handleUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;

    const { valid, errors } = validateFileSize(files);
    if (errors.length) {
      const toast = window.__biddingPlanToast;
      if (toast) toast.error(`File quá lớn (tối đa 50MB): ${errors.join('; ')}`);
      if (!valid.length) return;
    }

    setUploading(true);
    try {
      const newFiles = await Promise.all(
        valid.map(async (file) => {
          const storageRef = ref(storage, `biddingPlan/${Date.now()}_${file.name}`);
          const snapshot = await withTimeout(uploadBytes(storageRef, file), 20000);
          const url = await getDownloadURL(snapshot.ref);
          return { name: file.name, url };
        })
      );
      onChange([...fileList, ...newFiles]);
    } catch (err) {
      console.error('Upload error:', err);
      const toast = window.__biddingPlanToast;
      if (toast) toast.error(`Lỗi tải lên: ${err.message || 'Vui lòng thử lại'}`);
    } finally {
      setUploading(false);
    }
  };
  const handleRemove = (idx) => {
    const next = [...fileList];
    next.splice(idx, 1);
    onChange(next);
  };
  return (
    <div style={{ padding: '4px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
      {fileList.map((f, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', backgroundColor: 'var(--color-bg-surface-hover)', padding: '2px 4px', borderRadius: '4px' }}>
          <a href={f.url} target="_blank" rel="noreferrer" style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', maxWidth: '120px', color: 'var(--color-primary)', textDecoration: 'none' }} title={f.name}>{f.name}</a>
          <button onClick={() => handleRemove(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: 0, display: 'flex', alignItems: 'center' }} title="Xóa file"><Trash2 size={12} /></button>
        </div>
      ))}
      <label style={{ cursor: 'pointer', fontSize: '0.75rem', color: 'var(--color-primary)', display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 6px', backgroundColor: 'rgba(59, 130, 246, 0.1)', borderRadius: '4px', alignSelf: 'flex-start', border: '1px dashed var(--color-primary)' }}>
        <Upload size={12} /> Tải file
        <input type="file" multiple style={{ display: 'none' }} onChange={handleUpload} />
      </label>
    </div>
  );
};

// ─── Cell renderer ───────────────────────────────────────────────────────────
const CellInput = ({ col, value, onChange, isNew, projectCode, onOpenInvitedBidders }) => {
  const base = { width: '100%', border: 'none', outline: 'none', padding: '5px 8px', fontSize: '0.78rem', backgroundColor: 'transparent', color: 'var(--color-text-main)', fontFamily: 'inherit' };
  if (col.type === 'bidders_list') return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '4px' }}>
      <button 
        disabled={isNew}
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); if (onOpenInvitedBidders) onOpenInvitedBidders(); }}
        style={{ background: isNew ? 'var(--color-bg-body)' : 'var(--color-bg-surface-hover)', border: '1px solid var(--color-border)', borderRadius: '4px', padding: '2px 8px', cursor: isNew ? 'not-allowed' : 'pointer', fontSize: '0.85rem', color: isNew ? '#94a3b8' : 'var(--color-text-main)' }}>
        ...
      </button>
    </div>
  );
  if (col.type === 'checkbox') return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '4px' }}>
      <input type="checkbox" checked={!!value} onChange={e => onChange(e.target.checked)}
        style={{ width: '15px', height: '15px', accentColor: 'var(--color-primary)', cursor: 'pointer' }} />
    </div>
  );
  if (col.type === 'code') return <input type="text" value={value} disabled
    placeholder={isNew && projectCode ? `${projectCode}.GT.01` : ''}
    style={{ ...base, color: 'var(--color-text-muted)', backgroundColor: 'var(--color-bg-surface-hover)', cursor: 'not-allowed' }} />;
  if (col.type === 'nature_select') {
    const { globalLists } = useContext(DocumentContext);
    const options = globalLists?.packageNatures || [];
    return (
      <select value={value} onChange={e => onChange(e.target.value)} style={{ ...base, cursor: 'pointer' }}>
        <option value="" style={{ backgroundColor: 'var(--color-bg-body)', color: 'var(--color-text-main)' }}>— Chọn tính chất —</option>
        {options.map(o => <option key={o.id} value={o.name} style={{ backgroundColor: 'var(--color-bg-body)', color: 'var(--color-text-main)' }}>{o.name}</option>)}
      </select>
    );
  }
  if (col.type === 'select') return (
    <select value={value} onChange={e => onChange(e.target.value)} style={{ ...base, cursor: 'pointer' }}>
      <option value="" style={{ backgroundColor: 'var(--color-bg-body)', color: 'var(--color-text-main)' }}>—</option>
      {col.options.map(o => <option key={o} value={o} style={{ backgroundColor: 'var(--color-bg-body)', color: 'var(--color-text-main)' }}>{o}</option>)}
    </select>
  );
  if (col.type === 'status') {
    const getBg = (s) => {
      if (s === '✅ Đã phê duyệt') return 'rgba(16, 185, 129, 0.2)'; // green
      if (s === '⏳ Đang chờ duyệt') return 'rgba(245, 158, 11, 0.2)'; // yellow
      return 'rgba(148, 163, 184, 0.2)'; // gray
    };
    const getColor = (s) => {
      if (s === '✅ Đã phê duyệt') return '#6ee7b7';
      if (s === '⏳ Đang chờ duyệt') return '#fcd34d';
      return '#cbd5e1';
    };
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '4px' }}>
        <select value={value} onChange={e => onChange(e.target.value)} 
          style={{ width: '100%', border: 'none', background: getBg(value), color: getColor(value), borderRadius: '12px', padding: '2px 8px', outline: 'none', fontFamily: 'inherit', fontSize: '0.75rem', fontWeight: '600', cursor: 'pointer', appearance: 'none', textAlign: 'center' }}>
          {col.options.map(o => <option key={o} value={o} style={{ backgroundColor: 'var(--color-bg-body)', color: 'var(--color-text-main)' }}>{o}</option>)}
        </select>
      </div>
    );
  }
  if (col.type === 'price') return <input type="text" value={formatPrice(value)} onChange={e => onChange(unformatPrice(e.target.value))} placeholder={isNew ? 'Nhập số tiền' : ''} style={{ ...base, textAlign: 'right' }} />;
  if (col.type === 'number') return <input type="number" min="0" value={value} onChange={e => onChange(e.target.value)} placeholder={isNew ? '0' : ''} style={{ ...base, textAlign: 'center' }} />;
  if (col.type === 'date') return <input type="date" value={value} onChange={e => onChange(e.target.value)} style={{ ...base }} />;
  if (col.type === 'textarea') return <textarea value={value} onChange={e => onChange(e.target.value)} placeholder={isNew ? '...' : ''} style={{ ...base, resize: 'vertical', minHeight: '80px', lineHeight: '1.4' }} />;
  if (col.type === 'file') return <FileUploadCell value={value} onChange={onChange} />;
  if (col.key === 'name') return <NameCombobox value={value} onChange={onChange} isNew={isNew && col.required} />;
  return <input type="text" value={value} onChange={e => onChange(e.target.value)}
    placeholder={isNew && col.required ? 'Bắt buộc *' : (isNew ? '...' : '')} style={{ ...base }} />;
};

const validateDates = (data) => {
  const { startTime, closingTime, openingTime } = data;
  if (startTime && closingTime) {
    if (new Date(closingTime) <= new Date(startTime)) return 'Ngày đóng thầu phải diễn ra sau Ngày mời thầu.';
  }
  if (openingTime) {
    if (startTime && new Date(openingTime) < new Date(startTime)) return 'Ngày mở thầu không được diễn ra trước Ngày mời thầu.';
    if (closingTime && new Date(openingTime) < new Date(closingTime)) return 'Ngày mở thầu không được diễn ra trước Ngày đóng thầu.';
  }
  return null;
};

// ─── Edit Modal ────────────────────────────────────────────────────────────────
const EditPackageModal = ({ pkg, onSave, onClose, projectCode, projectName }) => {
  const [formData, setFormData] = useState({ ...pkg });
  const [error, setError] = useState('');
  const handleChange = (key, value) => {
    setFormData(prev => ({ ...prev, [key]: value }));
    setError('');
  };

  const handleSave = () => {
    const err = validateDates(formData);
    if (err) {
      setError(err);
      return;
    }
    if(formData.name.trim()) onSave(formData);
  };

  return createPortal(
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="card fade-in" style={{ width: '600px', maxWidth: '90vw', maxHeight: '90vh', overflowY: 'auto', backgroundColor: 'var(--color-bg-surface)', padding: 0 }}>
        <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', backgroundColor: 'var(--color-bg-surface-hover)' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--color-text-main)', fontWeight: '700' }}>Chỉnh sửa gói thầu</h3>
            <div style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', marginTop: '4px', fontWeight: '500' }}>Dự án: {projectName}</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer', color: 'var(--color-text-muted)' }}>&times;</button>
        </div>
        {error && (
          <div style={{ padding: '0.75rem 1.5rem', backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', fontSize: '0.85rem', fontWeight: '500', borderBottom: '1px solid rgba(239, 68, 68, 0.2)' }}>
            ⚠️ {error}
          </div>
        )}
        <div style={{ padding: '1.5rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
          {COLUMNS.filter(c => c.key !== 'invitedBidders').map(col => (
            <div key={col.key} style={{ gridColumn: col.key === 'summary' ? '1 / -1' : 'auto' }}>
              <label style={{ display: 'block', marginBottom: '0.35rem', fontSize: '0.8rem', fontWeight: '600', color: 'var(--color-text-main)' }}>{col.label} {col.required && <span style={{color:'red'}}>*</span>}</label>
              <div style={{ border: '1px solid var(--color-border)', borderRadius: '4px', backgroundColor: 'var(--color-bg-body)' }}>
                <CellInput col={col} value={formData[col.key] ?? ''} onChange={v => handleChange(col.key, v)} projectCode={projectCode} />
              </div>
            </div>
          ))}
        </div>
        <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid var(--color-border)', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', backgroundColor: 'var(--color-bg-surface-hover)' }}>
          <button onClick={onClose} style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid var(--color-border)', background: 'var(--color-bg-body)', color: 'var(--color-text-main)', cursor: 'pointer', fontWeight: '600', fontSize: '0.85rem' }}>Hủy</button>
          <button onClick={handleSave} disabled={!formData.name.trim()} style={{ padding: '6px 12px', borderRadius: '6px', border: 'none', background: 'var(--color-primary)', color: '#fff', cursor: formData.name.trim() ? 'pointer' : 'not-allowed', fontWeight: '600', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '4px' }}><Save size={14}/> Lưu thay đổi</button>
        </div>
      </div>
    </div>,
    document.body
  );
};

// ─── Datasheet row (existing package) ────────────────────────────────────────
const DataRow = ({ pkg, idx, total, isAdmin, onEdit, onDelete, onMoveUp, onMoveDown, visibleCols, colWidths, onOpenInvitedBidders, isSelected, onToggleSelect }) => {
  const bg = isSelected ? 'rgba(59, 130, 246, 0.15)' : (idx % 2 === 0 ? 'var(--color-bg-body)' : 'var(--color-bg-surface)');
  const cell = (w) => ({
    padding: 0, width: w,
    borderRight: '1px solid var(--color-border)',
    borderBottom: '1px solid var(--color-border)',
    overflow: 'hidden', backgroundColor: bg, transition: 'background-color 0.15s',
  });
  const btn = { background: 'none', border: 'none', cursor: 'pointer', padding: '3px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '4px' };

  const handleRowClick = (e) => {
    if (['INPUT', 'SELECT', 'BUTTON', 'TEXTAREA'].includes(e.target.tagName)) return;
    if (onToggleSelect) onToggleSelect(pkg.id);
  };

  return (
    <tr onClick={handleRowClick} onDoubleClick={() => isAdmin && onEdit(pkg)}
      style={{ cursor: isAdmin ? 'pointer' : 'default' }}>

      {/* LEFT: Up/Down */}
      {isAdmin && (
        <td style={{ ...cell(72), padding: '3px 4px', textAlign: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '2px' }}>
            <button onClick={e => { e.stopPropagation(); onMoveUp(); }} disabled={idx === 0}
              style={{ ...btn, color: idx === 0 ? '#cbd5e1' : 'var(--color-primary)', cursor: idx === 0 ? 'default' : 'pointer' }}
              title="Di chuyển lên">
              <ArrowUp size={13} />
            </button>
            <button onClick={e => { e.stopPropagation(); onMoveDown(); }} disabled={idx === total - 1}
              style={{ ...btn, color: idx === total - 1 ? '#cbd5e1' : 'var(--color-primary)', cursor: idx === total - 1 ? 'default' : 'pointer' }}
              title="Di chuyển xuống">
              <ArrowDown size={13} />
            </button>
          </div>
        </td>
      )}

      {/* Data cells */}
      {visibleCols.map(col => {
        const w = colWidths[col.key] || col.width;
        const align = col.type === 'price' || col.type === 'date' ? 'right'
                    : col.type === 'number' || col.type === 'checkbox' ? 'center' : 'left';
        return (
          <td key={col.key} style={cell(w)}>
            {col.type === 'checkbox' ? (
              <div style={{ textAlign: 'center', padding: '4px' }}>
                <input type="checkbox" checked={!!pkg[col.key]} readOnly
                  style={{ width: '14px', height: '14px', accentColor: 'var(--color-primary)', cursor: 'default' }} />
              </div>
            ) : col.type === 'bidders_list' ? (
              <div style={{ textAlign: 'center', cursor: 'pointer', color: 'var(--color-primary)' }} onClick={() => onOpenInvitedBidders(pkg)}>
                {Array.isArray(pkg[col.key]) ? pkg[col.key].length : 0}
              </div>
            ) : col.type === 'file' ? (
              <div style={{ padding: '4px 6px', display: 'flex', flexDirection: 'column', gap: '3px', overflow: 'hidden' }}>
                {Array.isArray(pkg[col.key]) && pkg[col.key].length > 0 ? (
                  pkg[col.key].map((f, i) => (
                    <a key={i} href={f.url} target="_blank" rel="noreferrer" style={{ fontSize: '0.72rem', color: 'var(--color-primary)', textDecoration: 'none', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden', display: 'block' }} title={f.name}>📎 {f.name}</a>
                  ))
                ) : pkg[col.key] && typeof pkg[col.key] === 'string' ? (
                  <span style={{ fontSize: '0.75rem', color: 'var(--color-text-main)', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden', display: 'block' }}>{pkg[col.key]}</span>
                ) : (
                  <span style={{ color: 'var(--color-text-muted)', fontSize: '0.78rem', display: 'block', padding: '2px 4px' }}>—</span>
                )}
              </div>
            ) : (
              <div style={{ padding: '6px 8px', fontSize: '0.78rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textAlign: align, color: pkg[col.key] ? 'var(--color-text-main)' : 'var(--color-text-muted)' }}>
                {col.type === 'price' ? formatPrice(pkg[col.key]) || '—' : (pkg[col.key] || '—')}
              </div>
            )}
          </td>
        );
      })}

      {/* RIGHT: Delete */}
      {isAdmin && (
        <td style={{ ...cell(46), textAlign: 'center', padding: '3px' }}>
          <button onClick={e => { e.stopPropagation(); onDelete(pkg.id); }}
            style={{ ...btn, color: 'var(--color-danger)', margin: '0 auto' }} title="Xóa gói thầu này">
            <Trash2 size={14} />
          </button>
        </td>
      )}
    </tr>
  );
};

// ─── New row at the bottom ────────────────────────────────────────────────────
const NewRow = ({ onAdd, isAdmin, visibleCols, colWidths, projectCode, nextIdx }) => {
  const getDefaultCode = (idx) => projectCode ? `${projectCode}.GT.${String(idx).padStart(2, '0')}` : '';
  const [row, setRow] = useState({ ...EMPTY_ROW(), code: getDefaultCode(nextIdx) });
  
  useEffect(() => {
    if (!row.code || row.code === getDefaultCode(nextIdx - 1)) {
      setRow(r => ({ ...r, code: getDefaultCode(nextIdx) }));
    }
  }, [nextIdx, projectCode]);

  const setField = (k, v) => setRow(r => ({ ...r, [k]: v }));
  const handleAdd = () => { 
    if (!row.name.trim()) return; 
    const err = validateDates(row);
    if (err) {
      const toast = window.__biddingPlanToast;
      if (toast) toast.warning(err);
      return;
    }
    onAdd({ ...row }); 
    setRow({ ...EMPTY_ROW(), code: getDefaultCode(nextIdx + 1) }); 
  };
  const cell = (w) => ({ padding: 0, width: w, borderRight: '1px solid var(--color-border)', borderBottom: '1px solid var(--color-border)', backgroundColor: 'var(--color-bg-surface-hover)', overflow: 'hidden' });

  return (
    <tr>
      {isAdmin && (
        <td style={{ ...cell(72), textAlign: 'center', padding: '4px' }}>
          <button onClick={handleAdd} disabled={!row.name.trim()}
            style={{ background: row.name.trim() ? 'var(--color-primary)' : '#e2e8f0', color: row.name.trim() ? '#fff' : '#94a3b8', border: 'none', borderRadius: '4px', padding: '3px 8px', cursor: row.name.trim() ? 'pointer' : 'not-allowed', fontSize: '0.68rem', display: 'flex', alignItems: 'center', gap: '2px', margin: '0 auto' }}>
            <Plus size={10} /> Thêm
          </button>
        </td>
      )}
      {visibleCols.map(col => {
        const w = colWidths[col.key] || col.width;
        return (
          <td key={col.key} style={cell(w)}>
            <CellInput col={col} value={row[col.key] ?? ''} onChange={v => setField(col.key, v)} isNew projectCode={projectCode} />
          </td>
        );
      })}
      {isAdmin && <td style={cell(46)} />}
    </tr>
  );
};

// ─── Local Text Input to prevent cursor jumping ────────────────────────────────
const LocalTextInput = ({ value, onChange, style, placeholder }) => {
  const [localValue, setLocalValue] = useState(value || '');

  useEffect(() => {
    setLocalValue(value || '');
  }, [value]);

  const handleBlur = () => {
    if (localValue !== value) {
      onChange(localValue);
    }
  };

  return (
    <input
      type="text"
      value={localValue}
      onChange={(e) => setLocalValue(e.target.value)}
      onBlur={handleBlur}
      style={style}
      placeholder={placeholder}
    />
  );
};

// ─── Template List Modal ─────────────────────────────────────────────────────
const TemplateListModal = ({ onClose, onConfirm }) => {
  const { globalLists, addListItem, editListItem, deleteListItem } = useContext(DocumentContext);
  const packageNames = globalLists?.packageNames || [];
  const packageNatures = globalLists?.packageNatures || [];
  const [selected, setSelected] = useState(new Set());
  const [newTemplate, setNewTemplate] = useState({ name: '', nature: '', summary: '' });
  const [editingSummary, setEditingSummary] = useState(null);

  const [colWidths, setColWidths] = useState({
    stt: 50,
    select: 35,
    name: 'auto',
    nature: 200,
    summary: 75,
    actions: 50
  });

  const startResize = (key, e) => {
    e.preventDefault(); e.stopPropagation();
    const th = e.currentTarget.parentElement;
    const startX = e.clientX;
    const startW = typeof colWidths[key] === 'number' ? colWidths[key] : th.offsetWidth;
    const onMove = (me) => setColWidths(prev => ({ ...prev, [key]: Math.max(40, startW + me.clientX - startX) }));
    const onUp = () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  const toggleSelect = (id) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelected(next);
  };

  const handleConfirm = () => {
    const selectedTemplates = packageNames.filter(p => selected.has(p.id));
    onConfirm(selectedTemplates);
  };

  const handleAddNew = () => {
    if (newTemplate.name.trim()) {
      addListItem('packageNames', { ...newTemplate });
      setNewTemplate({ name: '', nature: '', summary: '' });
    }
  };

  const updateExisting = (id, field, value) => {
    const tmpl = packageNames.find(p => p.id === id);
    if (tmpl) {
      editListItem('packageNames', id, { ...tmpl, [field]: value });
    }
  };

  const thStyle = { 
    padding: '8px 10px', 
    backgroundColor: 'var(--color-bg-surface-hover)', 
    borderRight: '1px solid var(--color-border)', 
    borderBottom: '2px solid var(--color-border)', 
    fontWeight: '700', 
    fontSize: '0.73rem', 
    color: 'var(--color-text-main)', 
    whiteSpace: 'nowrap', 
    textAlign: 'center', 
    position: 'sticky', 
    top: 0, 
    zIndex: 1, 
    overflow: 'hidden' 
  };
  const tdStyle = { 
    padding: '4px 10px', 
    borderRight: '1px solid var(--color-border)', 
    borderBottom: '1px solid var(--color-border)', 
    overflow: 'hidden' 
  };
  const inputStyle = { 
    width: '100%', 
    border: 'none', 
    background: 'transparent', 
    outline: 'none', 
    color: 'inherit', 
    fontSize: '0.78rem', 
    fontFamily: 'inherit',
    padding: '4px 0' 
  };
  const selectStyle = { ...inputStyle, cursor: 'pointer' };
  const resizerStyle = { position: 'absolute', right: 0, top: 0, bottom: 0, width: '5px', cursor: 'col-resize', backgroundColor: 'transparent', zIndex: 2 };

  return createPortal(
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="card fade-in" style={{ width: '1000px', maxWidth: '95vw', maxHeight: '90vh', display: 'flex', flexDirection: 'column', backgroundColor: 'var(--color-bg-surface)', padding: 0 }}>
        <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--color-bg-surface-hover)' }}>
          <h3 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--color-text-main)', fontWeight: '700' }}>Danh sách gói thầu mẫu</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer', color: 'var(--color-text-muted)' }}>&times;</button>
        </div>
        
        <div style={{ padding: 0, overflowY: 'auto', overflowX: 'auto', flex: 1 }}>
          <table style={{ minWidth: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', tableLayout: 'fixed' }}>
            <thead style={{ position: 'sticky', top: 0, backgroundColor: 'var(--color-bg-surface-hover)', zIndex: 1 }}>
              <tr>
                <th style={{ ...thStyle, width: colWidths.stt, textAlign: 'center', position: 'relative' }}>
                  STT
                  <div onMouseDown={e => startResize('stt', e)} style={resizerStyle} onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--color-primary)'} onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'} />
                </th>
                <th style={{ ...thStyle, width: colWidths.select, textAlign: 'center', position: 'relative' }}>
                  Lựa chọn
                  <div onMouseDown={e => startResize('select', e)} style={resizerStyle} onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--color-primary)'} onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'} />
                </th>
                <th style={{ ...thStyle, width: colWidths.name, position: 'relative' }}>
                  Tên gói thầu
                  <div onMouseDown={e => startResize('name', e)} style={resizerStyle} onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--color-primary)'} onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'} />
                </th>
                <th style={{ ...thStyle, width: colWidths.nature, position: 'relative' }}>
                  Tính chất gói thầu
                  <div onMouseDown={e => startResize('nature', e)} style={resizerStyle} onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--color-primary)'} onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'} />
                </th>
                <th style={{ ...thStyle, width: colWidths.summary, position: 'relative' }}>
                  Tóm tắt công việc chính
                  <div onMouseDown={e => startResize('summary', e)} style={resizerStyle} onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--color-primary)'} onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'} />
                </th>
                <th style={{ ...thStyle, width: colWidths.actions, textAlign: 'center' }}>
                  Xóa
                </th>
              </tr>
            </thead>
            <tbody>
              {packageNames.map((pkg, idx) => (
                <tr key={pkg.id} style={{ backgroundColor: selected.has(pkg.id) ? 'rgba(59, 130, 246, 0.1)' : 'transparent', transition: 'background-color 0.15s' }}>
                  <td style={{ ...tdStyle, textAlign: 'center', color: 'var(--color-text-muted)' }}>{idx + 1}</td>
                  <td style={{ ...tdStyle, textAlign: 'center' }}>
                    <input type="checkbox" checked={selected.has(pkg.id)} onChange={() => toggleSelect(pkg.id)} style={{ width: '16px', height: '16px', accentColor: 'var(--color-primary)', cursor: 'pointer' }} />
                  </td>
                  <td style={tdStyle}>
                    <LocalTextInput value={pkg.name || ''} onChange={(newVal) => updateExisting(pkg.id, 'name', newVal)} style={inputStyle} />
                  </td>
                  <td style={tdStyle}>
                    <select value={pkg.nature || ''} onChange={(e) => updateExisting(pkg.id, 'nature', e.target.value)} style={selectStyle}>
                      <option value="" style={{ backgroundColor: 'var(--color-bg-body)', color: 'var(--color-text-main)' }}>— Chọn tính chất —</option>
                      {packageNatures.map(o => <option key={o.id} value={o.name} style={{ backgroundColor: 'var(--color-bg-body)', color: 'var(--color-text-main)' }}>{o.name}</option>)}
                    </select>
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'center' }}>
                    <button onClick={() => setEditingSummary({ id: pkg.id, value: pkg.summary || '' })} style={{ background: 'var(--color-bg-surface-hover)', border: '1px solid var(--color-border)', borderRadius: '4px', padding: '2px 8px', cursor: 'pointer', fontSize: '0.85rem', color: 'var(--color-text-main)' }}>...</button>
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'center' }}>
                    <button onClick={() => deleteListItem('packageNames', pkg.id)} style={{ background: 'none', border: 'none', color: 'var(--color-danger)', cursor: 'pointer' }}><Trash2 size={14} /></button>
                  </td>
                </tr>
              ))}
              <tr style={{ backgroundColor: 'var(--color-bg-surface-hover)' }}>
                <td style={{ ...tdStyle, textAlign: 'center' }}>
                  <button onClick={handleAddNew} disabled={!newTemplate.name.trim()} style={{ background: newTemplate.name.trim() ? 'var(--color-primary)' : '#e2e8f0', color: newTemplate.name.trim() ? '#fff' : '#94a3b8', border: 'none', borderRadius: '4px', padding: '3px 8px', cursor: newTemplate.name.trim() ? 'pointer' : 'not-allowed', fontSize: '0.7rem' }}>
                    <Plus size={10} />
                  </button>
                </td>
                <td style={tdStyle}></td>
                <td style={tdStyle}>
                  <input type="text" value={newTemplate.name} onChange={e => setNewTemplate({...newTemplate, name: e.target.value})} placeholder="Tên gói thầu mới..." style={inputStyle} />
                </td>
                <td style={tdStyle}>
                  <select value={newTemplate.nature} onChange={e => setNewTemplate({...newTemplate, nature: e.target.value})} style={selectStyle}>
                    <option value="" style={{ backgroundColor: 'var(--color-bg-body)', color: 'var(--color-text-main)' }}>— Chọn tính chất —</option>
                    {packageNatures.map(o => <option key={o.id} value={o.name} style={{ backgroundColor: 'var(--color-bg-body)', color: 'var(--color-text-main)' }}>{o.name}</option>)}
                  </select>
                </td>
                <td style={{ ...tdStyle, textAlign: 'center' }}>
                  <button onClick={() => setEditingSummary({ id: 'new', value: newTemplate.summary || '' })} style={{ background: 'var(--color-bg-surface-hover)', border: '1px solid var(--color-border)', borderRadius: '4px', padding: '2px 8px', cursor: 'pointer', fontSize: '0.85rem', color: 'var(--color-text-main)' }}>...</button>
                </td>
                <td style={tdStyle}></td>
              </tr>
            </tbody>
          </table>
        </div>

        <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid var(--color-border)', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', backgroundColor: 'var(--color-bg-surface-hover)' }}>
          <button onClick={onClose} style={{ padding: '8px 16px', borderRadius: '6px', border: '1px solid var(--color-border)', background: 'var(--color-bg-body)', color: 'var(--color-text-main)', cursor: 'pointer', fontWeight: '600' }}>Hủy</button>
          <button onClick={handleConfirm} disabled={selected.size === 0} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', borderRadius: '6px', border: 'none', background: 'var(--color-primary)', color: '#fff', cursor: selected.size > 0 ? 'pointer' : 'not-allowed', fontWeight: '600' }}>
            <Save size={16} /> Thêm từ mẫu ({selected.size})
          </button>
        </div>
      </div>

      {editingSummary && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1100, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="card fade-in" style={{ width: '500px', maxWidth: '90vw', backgroundColor: 'var(--color-bg-surface)', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem', border: '1px solid var(--color-border)' }}>
            <h3 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--color-text-main)', fontWeight: '600' }}>Tóm tắt công việc chính</h3>
            <textarea 
              value={editingSummary.value}
              onChange={(e) => setEditingSummary({ ...editingSummary, value: e.target.value })}
              placeholder="Nhập nội dung tóm tắt..."
              style={{ width: '100%', minHeight: '150px', padding: '0.75rem', borderRadius: '6px', border: '1px solid var(--color-border)', backgroundColor: 'var(--color-bg-body)', color: 'var(--color-text-main)', resize: 'vertical', fontSize: '0.875rem', outline: 'none', fontFamily: 'inherit' }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button onClick={() => setEditingSummary(null)} style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid var(--color-border)', background: 'var(--color-bg-body)', color: 'var(--color-text-main)', cursor: 'pointer', fontWeight: '500' }}>Hủy</button>
              <button onClick={() => {
                if (editingSummary.id === 'new') {
                  setNewTemplate({ ...newTemplate, summary: editingSummary.value });
                } else {
                  updateExisting(editingSummary.id, 'summary', editingSummary.value);
                }
                setEditingSummary(null);
              }} style={{ padding: '6px 12px', borderRadius: '6px', border: 'none', background: 'var(--color-primary)', color: '#fff', cursor: 'pointer', fontWeight: '500' }}>Lưu thay đổi</button>
            </div>
          </div>
        </div>
      )}
    </div>,
    document.body
  );
};

// ─── Package Card ────────────────────────────────────────────────────────────
const PackageCard = ({ pkg, onEdit }) => {
  const bidders = pkg.invitedBidders || [];
  
  const getStatusColor = (s) => {
    if (s === '✅ Đã phê duyệt') return { bg: 'rgba(16, 185, 129, 0.1)', color: '#10b981', border: '#a7f3d0' };
    if (s === '⏳ Đang chờ duyệt') return { bg: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b', border: '#fde68a' };
    return { bg: 'rgba(148, 163, 184, 0.1)', color: '#64748b', border: '#e2e8f0' };
  };
  const statusStyles = getStatusColor(pkg.status);

  return (
    <div 
      className="card fade-in" 
      onDoubleClick={() => onEdit(pkg)}
      style={{ 
        padding: '1.25rem', 
        display: 'flex', 
        flexDirection: 'column', 
        gap: '0.75rem', 
        cursor: 'pointer',
        border: '1px solid var(--color-border)',
        boxShadow: '0 2px 4px rgba(0,0,0,0.02)',
        transition: 'transform 0.2s, box-shadow 0.2s',
        backgroundColor: 'var(--color-bg-surface)'
      }}
      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 6px 12px rgba(0,0,0,0.05)'; }}
      onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.02)'; }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <span style={{ fontSize: '0.75rem', fontWeight: '700', padding: '3px 8px', backgroundColor: 'var(--color-bg-surface-hover)', color: 'var(--color-text-muted)', borderRadius: '6px' }}>
          {pkg.code || 'Chưa có mã'}
        </span>
        <span style={{ fontSize: '0.75rem', fontWeight: '600', padding: '3px 8px', backgroundColor: statusStyles.bg, color: statusStyles.color, border: `1px solid ${statusStyles.border}`, borderRadius: '12px' }}>
          {pkg.status || '📝 Đang soạn thảo'}
        </span>
      </div>
      
      <h4 style={{ margin: 0, fontSize: '1rem', color: 'var(--color-text-main)', fontWeight: '700', lineHeight: '1.4' }}>
        {pkg.name || 'Gói thầu chưa có tên'}
      </h4>
      
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
        {pkg.nature && (
          <span style={{ backgroundColor: '#eff6ff', color: 'var(--color-primary)', padding: '2px 6px', borderRadius: '4px', border: '1px solid #bfdbfe' }}>
            {pkg.nature}
          </span>
        )}
        {pkg.selectionMethod && (
          <span style={{ backgroundColor: 'var(--color-bg-surface-hover)', padding: '2px 6px', borderRadius: '4px' }}>
            {pkg.selectionMethod}
          </span>
        )}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem', paddingTop: '0.75rem', borderTop: '1px dashed var(--color-border)' }}>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Giá dự toán</span>
          <span style={{ fontSize: '0.9rem', fontWeight: '700', color: 'var(--color-text-main)' }}>
            {pkg.price ? formatPrice(pkg.price) + ' đ' : '—'}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
          <Users size={14} /> {bidders.length} nhà thầu
        </div>
      </div>
    </div>
  );
};

// ─── Datasheet Modal ─────────────────────────────────────────────────────────
const DatasheetModal = ({ project, projects, packages, isAdmin, onAdd, onAddMultiple, onOpenTemplateModal, onSave, onDelete, onMoveUp, onMoveDown, onEdit, onOpenInvitedBidders, onClose }) => {
  const [hiddenCols, setHiddenCols] = useState(new Set([
    'optionToBuy', 
    'fundSource', 
    'selectionMethod', 
    'procurementMethod', 
    'organizationTime', 
    'startTime', 
    'contractType', 
    'implementationTime'
  ]));
  const [colWidths, setColWidths] = useState(() => Object.fromEntries(COLUMNS.map(c => [c.key, c.width])));
  const [showColPanel, setShowColPanel] = useState(false);
  const [selectedRows, setSelectedRows] = useState(new Set());
  const panelRef = useRef(null);
  const visibleCols = COLUMNS.filter(c => !hiddenCols.has(c.key));

  const toggleRowSelect = (id) => {
    setSelectedRows(prev => {
      if (prev.has(id)) return new Set();
      return new Set([id]);
    });
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (panelRef.current && !panelRef.current.contains(event.target)) {
        setShowColPanel(false);
      }
    };
    if (showColPanel) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showColPanel]);

  const toggleCol = (key) => setHiddenCols(prev => {
    const next = new Set(prev);
    if (next.has(key)) next.delete(key); else next.add(key);
    return next;
  });

  const startResize = (key, e) => {
    e.preventDefault(); e.stopPropagation();
    const startX = e.clientX, startW = colWidths[key];
    const onMove = (me) => setColWidths(prev => ({ ...prev, [key]: Math.max(60, startW + me.clientX - startX) }));
    const onUp = () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  const totalPrice = packages.reduce((s, p) => {
    const n = parseFloat(String(p.price || '').replace(/\D/g, ''));
    return s + (isNaN(n) ? 0 : n);
  }, 0);

  const thStyle = (col) => ({
    padding: '8px 10px',
    width: col.width,
    backgroundColor: 'var(--color-bg-surface-hover)',
    borderRight: '1px solid var(--color-border)',
    borderBottom: '2px solid var(--color-border)',
    fontWeight: '700',
    fontSize: '0.73rem',
    color: 'var(--color-text-main)',
    whiteSpace: 'nowrap',
    textAlign: 'center',
    position: 'sticky',
    top: 0,
    zIndex: 1,
  });

  return createPortal(
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', flexDirection: 'column', padding: '1rem', boxSizing: 'border-box' }}>
      <div className="card fade-in" style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)', borderRadius: '12px' }}>
        {/* Header Modal */}
        <div style={{ padding: '0.75rem 1.25rem', backgroundColor: 'var(--color-bg-surface)', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.25rem', color: 'var(--color-text-main)', fontWeight: '700' }}>Bảng dữ liệu Kế hoạch LCNT</h2>
            <div style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', marginTop: '4px' }}>Dự án: {project.name} • {packages.length} gói thầu</div>
          </div>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            {isAdmin && (
              <button onClick={() => onOpenTemplateModal(project.id)}
                style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#fff', background: 'var(--color-primary)', border: 'none', borderRadius: '8px', padding: '6px 12px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: '600' }}>
                <Plus size={14} /> Thêm từ mẫu
              </button>
            )}
            <div style={{ position: 'relative' }} ref={panelRef}>
              <button onClick={() => setShowColPanel(v => !v)}
                style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--color-text-muted)', background: 'var(--color-bg-surface-hover)', border: '1px solid var(--color-border)', borderRadius: '8px', padding: '6px 12px', cursor: 'pointer', fontSize: '0.8rem' }}>
                <Settings size={14} /> Ẩn/hiện cột
              </button>
              {showColPanel && (
                <div style={{ position: 'absolute', right: 0, top: '110%', zIndex: 100, background: 'var(--color-bg-surface)', border: '1px solid var(--color-border)', borderRadius: '10px', padding: '0.75rem', minWidth: '200px', maxHeight: '300px', overflowY: 'auto', boxShadow: '0 8px 24px rgba(0,0,0,0.12)' }}>
                  <div style={{ fontWeight: '700', fontSize: '0.75rem', marginBottom: '0.5rem', color: 'var(--color-text-muted)' }}>Cột hiển thị</div>
                  {COLUMNS.map(col => (
                    <label key={col.key} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 0', fontSize: '0.8rem', cursor: 'pointer' }}>
                      <input type="checkbox" checked={!hiddenCols.has(col.key)} onChange={() => toggleCol(col.key)}
                        style={{ accentColor: 'var(--color-primary)', width: '14px', height: '14px' }} />
                      {col.label}
                    </label>
                  ))}
                </div>
              )}
            </div>
            <button onClick={onClose} style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: 'none', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }} title="Đóng bảng dữ liệu">
              <X size={18} />
            </button>
          </div>
        </div>
        
        {/* Table Area */}
        <div style={{ flex: 1, overflow: 'auto', backgroundColor: 'var(--color-bg-surface)', padding: '0' }}>
          <table style={{ borderCollapse: 'collapse', fontSize: '0.78rem', tableLayout: 'fixed', minWidth: '100%' }}>
            <thead>
              <tr>
                {isAdmin && <th style={{ ...thStyle({ width: 72 }), minWidth: 72 }}>Di chuyển</th>}
                {visibleCols.map(col => {
                  const w = colWidths[col.key] || col.width;
                  const align = col.type === 'price' || col.type === 'date' ? 'right'
                              : col.type === 'number' ? 'center' : 'left';
                  return (
                    <th key={col.key} style={{ ...thStyle({ width: w }), position: 'relative', userSelect: 'none', textAlign: align }}>
                      {col.label}
                      <div onMouseDown={e => startResize(col.key, e)}
                        style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: '5px', cursor: 'col-resize', backgroundColor: 'transparent' }}
                        onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--color-primary)'}
                        onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                      />
                    </th>
                  );
                })}
                {isAdmin && <th style={{ ...thStyle({ width: 46 }), minWidth: 46 }}>Xóa</th>}
              </tr>
            </thead>
            <tbody>
              {packages.length === 0 && !isAdmin && (
                <tr>
                  <td colSpan={COLUMNS.length + 2} style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-text-muted)', fontStyle: 'italic', fontSize: '0.82rem' }}>
                    Chưa có gói thầu nào.
                  </td>
                </tr>
              )}
              {packages.map((p, idx) => {
                const computedCode = `${project.code}.GT.${String(idx + 1).padStart(2, '0')}`;
                const pkg = { ...p, code: computedCode };
                return (
                  <DataRow key={pkg.id} pkg={pkg} idx={idx} total={packages.length} isAdmin={isAdmin}
                    visibleCols={visibleCols} colWidths={colWidths}
                    onEdit={(pkg) => onEdit(project, pkg)}
                    onDelete={(id) => onDelete(project, id)}
                    onMoveUp={() => onMoveUp(project, packages, idx)}
                    onMoveDown={() => onMoveDown(project, packages, idx)} 
                    onOpenInvitedBidders={onOpenInvitedBidders} 
                    isSelected={selectedRows.has(pkg.id)}
                    onToggleSelect={toggleRowSelect} />
                );
              })}
              {packages.length > 0 && (() => {
                const priceIdx = visibleCols.findIndex(c => c.key === 'price');
                const colsAfterPrice = priceIdx >= 0 ? visibleCols.length - priceIdx - 1 : 0;
                const fixedLeft = (isAdmin ? 1 : 0) + (priceIdx >= 0 ? priceIdx : visibleCols.length);
                const bdr = '1px solid var(--color-border)';
                const bdrTop = '2px solid var(--color-border)';
                const baseTd = { padding: '7px 10px', fontSize: '0.78rem', borderTop: bdrTop, backgroundColor: 'var(--color-bg-surface-hover)', fontWeight: '700' };
                return (
                  <tr>
                    <td colSpan={fixedLeft} style={{ ...baseTd, textAlign: 'right', borderRight: bdr }}>
                      Tổng giá dự toán:
                    </td>
                    {priceIdx >= 0 && (
                      <td style={{ ...baseTd, color: 'var(--color-primary)', textAlign: 'right', borderRight: bdr }}>
                        {totalPrice > 0 ? totalPrice.toLocaleString('vi-VN') + ' đ' : '—'}
                      </td>
                    )}
                    <td colSpan={colsAfterPrice + (isAdmin ? 1 : 0)} style={{ ...baseTd }} />
                  </tr>
                );
              })()}
              {isAdmin && (
                <NewRow onAdd={(row) => onAdd(project.id, row)} isAdmin={isAdmin} visibleCols={visibleCols} colWidths={colWidths} projectCode={project.code} nextIdx={packages.length + 1} />
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>,
    document.body
  );
};

// ─── Project Column ──────────────────────────────────────────────────────────
const ProjectDatasheet = ({ project, projects, packages, isAdmin, onAdd, onAddMultiple, onOpenTemplateModal, onSave, onDelete, onMoveUp, onMoveDown, onEdit, onOpenInvitedBidders }) => {
  const [showDatasheet, setShowDatasheet] = useState(false);

  const totalPrice = packages.reduce((s, p) => {
    const n = parseFloat(String(p.price || '').replace(/\D/g, ''));
    return s + (isNaN(n) ? 0 : n);
  }, 0);

  return (
    <>
      <div className="card fade-in" style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', border: '1px solid var(--color-border)' }}>
        {/* Card Header */}
        {project.image && (
          <div style={{ height: '100px', flexShrink: 0, backgroundImage: `url(${project.image})`, backgroundSize: 'cover', backgroundPosition: 'center' }} />
        )}
        <div style={{ padding: '1.25rem 1.5rem', flexShrink: 0, backgroundColor: 'var(--color-bg-surface-hover)', borderBottom: '2px solid var(--color-border)', cursor: 'pointer' }} 
             onDoubleClick={() => setShowDatasheet(true)}
             title="Click đúp để mở bảng dữ liệu">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="badge badge-blue">{project.code || 'N/A'}</span>
                <span style={{ fontSize: '0.75rem', fontWeight: '600', color: 'var(--color-primary)', backgroundColor: 'rgba(59,130,246,0.15)', padding: '2px 8px', borderRadius: '12px' }}>
                  {packages.length} gói thầu
                </span>
              </div>
              {totalPrice > 0 && <div style={{ fontWeight: '700', color: 'var(--color-primary)', fontSize: '0.85rem' }}>{totalPrice.toLocaleString('vi-VN')} đ</div>}
            </div>
            
            <h3 style={{ fontSize: '1rem', fontWeight: '700', margin: 0, color: 'var(--color-text-main)', lineHeight: '1.4', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
              {project.name}
            </h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
              <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={project.location}><MapPin size={12} style={{ verticalAlign: 'middle', marginRight: '3px' }} />{project.location || '—'}</span>
              <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={project.investor}><Building size={12} style={{ verticalAlign: 'middle', marginRight: '3px' }} />CĐT: {project.investor}</span>
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.25rem', paddingTop: '0.5rem', borderTop: '1px dashed var(--color-border)' }}>
              <button onClick={(e) => { e.stopPropagation(); setShowDatasheet(true); }}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--color-text-main)', background: 'var(--color-bg-surface)', border: '1px solid var(--color-border)', borderRadius: '6px', padding: '5px 10px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: '600', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}
                title="Mở bảng dữ liệu toàn màn hình">
                <Maximize2 size={12} /> Datasheet
              </button>
            </div>
          </div>
        </div>
      </div>

      {showDatasheet && (
        <DatasheetModal
          project={project}
          projects={projects}
          packages={packages}
          isAdmin={isAdmin}
          onAdd={onAdd}
          onAddMultiple={onAddMultiple}
          onOpenTemplateModal={onOpenTemplateModal}
          onSave={onSave}
          onDelete={onDelete}
          onMoveUp={onMoveUp}
          onMoveDown={onMoveDown}
          onEdit={(p) => onEdit(project, p)}
          onOpenInvitedBidders={onOpenInvitedBidders}
          onClose={() => setShowDatasheet(false)}
        />
      )}
    </>
  );
};

// ─── Main Page ───────────────────────────────────────────────────────────────
const BiddingPlan = () => {
  const { projects, userRole, biddingPackages = [], addBiddingPackage, editBiddingPackage, deleteBiddingPackage, reorderBiddingPackages, addListItem, globalLists, partners = [], enableLazy, checkPermission } = useContext(DocumentContext);
  useEffect(() => { enableLazy(); }, [enableLazy]);
  const toast = useToast();
  const confirm = useConfirm();
  window.__biddingPlanToast = toast;
  const isAdmin = userRole === ROLES.ADMIN;
  const didFixCodes = useRef(false);
  const [editingData, setEditingData] = useState(null);
  const [templateModalProjectId, setTemplateModalProjectId] = useState(null);
  const [editingInvitedBidders, setEditingInvitedBidders] = useState(null);

  // Filters state
  const [filters, setFilters] = useState({ keyword: '', project: '', nature: '' });

  const getPackages = (projectId) =>
    [...biddingPackages.filter(p => String(p.projectId) === String(projectId))]
      .sort((a, b) => (a.order ?? 999) - (b.order ?? 999) || (a.createdAt || '').localeCompare(b.createdAt || ''))
      .map(p => {
        let st = p.status || '📝 Đang soạn thảo';
        if (st === 'Đang soạn thảo') st = '📝 Đang soạn thảo';
        if (st === 'Đang chờ duyệt') st = '⏳ Đang chờ duyệt';
        if (st === 'Đã phê duyệt') st = '✅ Đã phê duyệt';
        return { ...p, status: st };
      });

  // Filter packages logic
  const filterPackages = (pkgs) => {
    return pkgs.filter(pkg => {
      if (filters.nature && pkg.nature !== filters.nature) return false;
      if (filters.keyword) {
        const kw = filters.keyword.toLowerCase();
        const codeMatch = (pkg.code || '').toLowerCase().includes(kw);
        const nameMatch = (pkg.name || '').toLowerCase().includes(kw);
        if (!codeMatch && !nameMatch) return false;
      }
      return true;
    });
  };

  // Migration script to populate packageNames from existing packages if empty
  useEffect(() => {
    if (biddingPackages.length > 0 && globalLists && globalLists.packageNames?.length === 0 && isAdmin) {
      const uniqueNames = [...new Set(biddingPackages.map(p => p.name).filter(Boolean))];
      uniqueNames.forEach(name => {
        addListItem('packageNames', name).catch(e => console.error(e));
      });
    }
  }, [biddingPackages, globalLists, isAdmin, addListItem]);

  // Migration script to fix missing/wrong codes
  useEffect(() => {
    if (!didFixCodes.current && projects.length > 0 && biddingPackages.length > 0) {
      didFixCodes.current = true;
      projects.forEach(p => {
        const pkgs = getPackages(p.id);
        const needsUpdate = pkgs.some((pkg, idx) => pkg.code !== `${p.code}.GT.${String(idx + 1).padStart(2, '0')}`);
        if (needsUpdate && pkgs.length > 0 && isAdmin) {
          reorderBiddingPackages(pkgs, p.code).catch(e => console.error(e));
        }
      });
    }
  }, [projects, biddingPackages, isAdmin, reorderBiddingPackages]);

  const handleAdd = async (projectId, row) => {
    const { _new, ...data } = row;
    const pkgs = getPackages(projectId);
    await addBiddingPackage(projectId, { ...data, order: pkgs.length });
    if (data.name) await addListItem('packageNames', data.name);
  };

  const handleAddMultiple = async (projectId, templates) => {
    const pkgs = getPackages(projectId);
    let startOrder = pkgs.length;
    for (const tmpl of templates) {
      const { _new, ...data } = { 
        ...EMPTY_ROW(), 
        name: tmpl.name || '', 
        nature: tmpl.nature || '', 
        summary: tmpl.summary || '' 
      };
      await addBiddingPackage(projectId, { ...data, order: startOrder++ });
    }
  };

  const handleSave = async (projectId, pkgId, updated) => {
    await editBiddingPackage(projectId, pkgId, updated);
    if (updated.name) await addListItem('packageNames', updated.name);
  };

  const handleDelete = async (project, pkgId) => {
    const ok = await confirm('Xóa gói thầu này?');
    if (ok) {
      await deleteBiddingPackage(project.id, pkgId);
      const remaining = getPackages(project.id).filter(p => p.id !== pkgId);
      if (remaining.length > 0) await reorderBiddingPackages(remaining, project.code);
    }
  };

  const handleMoveUp = async (project, pkgs, idx) => {
    if (idx === 0) return;
    const reordered = [...pkgs];
    [reordered[idx - 1], reordered[idx]] = [reordered[idx], reordered[idx - 1]];
    await reorderBiddingPackages(reordered, project.code);
  };

  const handleMoveDown = async (project, pkgs, idx) => {
    if (idx >= pkgs.length - 1) return;
    const reordered = [...pkgs];
    [reordered[idx], reordered[idx + 1]] = [reordered[idx + 1], reordered[idx]];
    await reorderBiddingPackages(reordered, project.code);
  };

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters(prev => ({ ...prev, [name]: value }));
  };

  const handleClearFilters = () => {
    setFilters({ keyword: '', project: '', nature: '' });
  };

  const hasFilter = filters.keyword || filters.project || filters.nature;

  const displayProjects = projects.filter(p => {
    if (filters.project && p.name !== filters.project) return false;
    return true;
  });

  return (
    <div className="fade-in" style={{ padding: '1.5rem', position: 'relative', zIndex: 1, height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxSizing: 'border-box' }}>
      {/* Background blobs for Glassmorphism */}
      <div style={{ position: 'fixed', top: '-10%', left: '-5%', width: '500px', height: '500px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(147,197,253,0.35) 0%, rgba(255,255,255,0) 70%)', zIndex: -1, pointerEvents: 'none' }}></div>
      <div style={{ position: 'fixed', bottom: '10%', right: '-10%', width: '600px', height: '600px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(249,168,212,0.25) 0%, rgba(255,255,255,0) 70%)', zIndex: -1, pointerEvents: 'none' }}></div>
      <div style={{ position: 'fixed', top: '30%', left: '30%', width: '700px', height: '700px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(167,243,208,0.25) 0%, rgba(255,255,255,0) 70%)', zIndex: -1, pointerEvents: 'none' }}></div>

      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: '700', color: 'var(--color-text-main)', marginBottom: '0.25rem' }}>
          📋 Kế hoạch lựa chọn nhà thầu
        </h1>
        <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
          {displayProjects.length} dự án • {biddingPackages.length} gói thầu
          {isAdmin && ' — Nhấp vào hàng để chỉnh sửa, hàng cuối để thêm mới'}
        </p>
      </div>

      <div className="card" style={{ padding: '1.25rem', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem' }}>
          <div className="form-group" style={{ marginBottom: 0, flex: '1 1 250px' }}>
            <label className="form-label" style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Từ khóa (Mã, Tên gói thầu)</label>
            <input
              type="text"
              name="keyword"
              value={filters.keyword}
              onChange={handleFilterChange}
              className="input-field"
              placeholder="Nhập mã hoặc tên gói thầu..."
            />
          </div>
          <div className="form-group" style={{ marginBottom: 0, flex: '1 1 200px' }}>
            <label className="form-label" style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Dự án liên quan</label>
            <select name="project" value={filters.project} onChange={handleFilterChange} className="input-field">
              <option value="">Tất cả dự án</option>
              {projects.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
            </select>
          </div>
          <div className="form-group" style={{ marginBottom: 0, flex: '1 1 200px', display: 'flex', alignItems: 'flex-end', gap: '8px' }}>
            <div style={{ flex: 1 }}>
              <label className="form-label" style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Tính chất gói thầu</label>
              <select name="nature" value={filters.nature} onChange={handleFilterChange} className="input-field">
                <option value="">Tất cả tính chất</option>
                {(globalLists?.packageNatures || []).map(n => <option key={n.id} value={n.name}>{n.name}</option>)}
              </select>
            </div>
            {hasFilter && (
              <button
                onClick={handleClearFilters}
                title="Bỏ lọc"
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  backgroundColor: '#fef2f2', color: '#ef4444', border: '1px solid #fca5a5',
                  width: '35px', height: '35px', borderRadius: '4px', cursor: 'pointer',
                  flexShrink: 0
                }}>
                <X size={18} />
              </button>
            )}
          </div>
        </div>
      </div>

      {displayProjects.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--color-text-muted)' }}>
          Chưa có dự án nào khớp với điều kiện lọc.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))', gap: '1.5rem', overflowY: 'auto', paddingBottom: '1rem', width: '100%', flex: 1, minHeight: 0, alignContent: 'start' }}>
          {displayProjects.map(project => {
            const projectPackages = getPackages(project.id);
            const filteredPackages = filterPackages(projectPackages);
            
            return (
              <div key={project.id} style={{ display: 'flex', flexDirection: 'column' }}>
                <ProjectDatasheet
                  project={project}
                  projects={projects}
                  packages={filteredPackages}
                  isAdmin={checkPermission(project.id, 'edit_bidding')}
                  onAdd={handleAdd}
                  onAddMultiple={handleAddMultiple}
                  onOpenTemplateModal={setTemplateModalProjectId}
                  onSave={handleSave}
                  onDelete={handleDelete}
                  onMoveUp={handleMoveUp}
                  onMoveDown={handleMoveDown}
                  onEdit={(project, pkg) => setEditingData({ project, pkg })}
                  onOpenInvitedBidders={setEditingInvitedBidders}
                />
              </div>
            );
          })}
        </div>
      )}

      {templateModalProjectId && (
        <TemplateListModal 
          onClose={() => setTemplateModalProjectId(null)} 
          onConfirm={(templates) => {
            handleAddMultiple(templateModalProjectId, templates);
            setTemplateModalProjectId(null);
          }}
        />
      )}

      {editingData && (
        <EditPackageModal
          pkg={editingData.pkg}
          projectCode={editingData.project.code}
          projectName={editingData.project.name}
          onSave={(updated) => {
            handleSave(editingData.project.id, updated.id, updated);
            setEditingData(null);
          }}
          onClose={() => setEditingData(null)}
        />
      )}

      {editingInvitedBidders && (
        <InvitedBiddersModal 
          pkg={editingInvitedBidders} 
          partners={partners}
          onSave={(updatedPkg) => {
            editBiddingPackage(updatedPkg.projectId, updatedPkg.id, updatedPkg);
            setEditingInvitedBidders(null);
          }} 
          onClose={() => setEditingInvitedBidders(null)} 
        />
      )}
    </div>
  );
};

// ─── Invited Bidders Modal ───────────────────────────────────────────────────
const InvitedBiddersModal = ({ pkg, partners, onSave, onClose }) => {
  const [bidders, setBidders] = useState(pkg.invitedBidders || []);
  const [newPartnerId, setNewPartnerId] = useState('');

  const thStyle = { padding: '8px 10px', backgroundColor: 'var(--color-bg-surface-hover)', borderRight: '1px solid var(--color-border)', borderBottom: '2px solid var(--color-border)', fontWeight: '700', fontSize: '0.73rem', color: 'var(--color-text-main)', textAlign: 'center' };
  const tdStyle = { padding: '4px 10px', borderRight: '1px solid var(--color-border)', borderBottom: '1px solid var(--color-border)' };

  const handleAdd = () => {
    if (!newPartnerId) return;
    const partner = partners.find(p => String(p.id) === String(newPartnerId));
    if (!partner) return;
    setBidders([...bidders, { id: crypto.randomUUID(), partnerId: newPartnerId, order: bidders.length }]);
    setNewPartnerId('');
  };

  const handleRemove = (id) => {
    setBidders(bidders.filter(b => b.id !== id));
  };

  const handleMoveUp = (idx) => {
    if (idx === 0) return;
    const next = [...bidders];
    [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
    next.forEach((b, i) => b.order = i);
    setBidders(next);
  };

  const handleMoveDown = (idx) => {
    if (idx === bidders.length - 1) return;
    const next = [...bidders];
    [next[idx + 1], next[idx]] = [next[idx], next[idx + 1]];
    next.forEach((b, i) => b.order = i);
    setBidders(next);
  };

  const btn = { background: 'none', border: 'none', cursor: 'pointer', padding: '3px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '4px' };

  return createPortal(
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="card fade-in" style={{ width: '600px', maxWidth: '95vw', maxHeight: '90vh', display: 'flex', flexDirection: 'column', backgroundColor: 'var(--color-bg-surface)', padding: 0 }}>
        <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--color-bg-surface-hover)' }}>
          <h3 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--color-text-main)', fontWeight: '700' }}>Danh sách nhà thầu được mời</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer', color: 'var(--color-text-muted)' }}>&times;</button>
        </div>
        
        <div style={{ padding: '1.5rem', overflowY: 'auto', flex: 1 }}>
          <div style={{ marginBottom: '1rem', fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
            Gói thầu: <strong style={{ color: 'var(--color-text-main)' }}>{pkg.code} - {pkg.name}</strong>
          </div>
          
          <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid var(--color-border)', fontSize: '0.85rem' }}>
            <thead>
              <tr>
                <th style={{ ...thStyle, width: '70px' }}>Di chuyển</th>
                <th style={{ ...thStyle, width: '50px' }}>STT</th>
                <th style={{ ...thStyle, textAlign: 'left' }}>Tên nhà thầu được mời</th>
                <th style={{ ...thStyle, width: '50px', borderRight: 'none' }}>Xóa</th>
              </tr>
            </thead>
            <tbody>
              {bidders.length === 0 && (
                <tr>
                  <td colSpan={4} style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--color-text-muted)', fontStyle: 'italic', fontSize: '0.8rem' }}>
                    Chưa có nhà thầu nào được mời.
                  </td>
                </tr>
              )}
              {bidders.sort((a, b) => a.order - b.order).map((bidder, idx) => {
                const partnerName = partners.find(p => String(p.id) === String(bidder.partnerId))?.name || 'Nhà thầu không tồn tại';
                return (
                  <tr key={bidder.id}>
                    <td style={{ ...tdStyle, textAlign: 'center' }}>
                      <div style={{ display: 'flex', justifyContent: 'center', gap: '2px' }}>
                        <button onClick={() => handleMoveUp(idx)} disabled={idx === 0} style={{ ...btn, color: idx === 0 ? '#cbd5e1' : 'var(--color-primary)', cursor: idx === 0 ? 'default' : 'pointer' }}><ArrowUp size={13} /></button>
                        <button onClick={() => handleMoveDown(idx)} disabled={idx === bidders.length - 1} style={{ ...btn, color: idx === bidders.length - 1 ? '#cbd5e1' : 'var(--color-primary)', cursor: idx === bidders.length - 1 ? 'default' : 'pointer' }}><ArrowDown size={13} /></button>
                      </div>
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '0.8rem' }}>{idx + 1}</td>
                    <td style={{ ...tdStyle, fontSize: '0.85rem', fontWeight: '500' }}>{partnerName}</td>
                    <td style={{ ...tdStyle, textAlign: 'center', borderRight: 'none' }}>
                      <button onClick={() => handleRemove(bidder.id)} style={{ ...btn, color: 'var(--color-danger)', margin: '0 auto' }}><Trash2 size={14} /></button>
                    </td>
                  </tr>
                );
              })}
              {/* Thêm mới */}
              <tr style={{ backgroundColor: 'var(--color-bg-surface-hover)' }}>
                <td style={{ ...tdStyle }}></td>
                <td style={{ ...tdStyle, textAlign: 'center', color: '#94a3b8', fontSize: '0.8rem' }}>+</td>
                <td style={{ ...tdStyle }}>
                  <select 
                    value={newPartnerId} 
                    onChange={e => setNewPartnerId(e.target.value)}
                    style={{ width: '100%', padding: '6px', border: '1px solid var(--color-border)', borderRadius: '4px', fontSize: '0.8rem', backgroundColor: 'var(--color-bg-body)', color: 'var(--color-text-main)' }}
                  >
                    <option value="">— Chọn nhà thầu —</option>
                    {partners.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </td>
                <td style={{ ...tdStyle, textAlign: 'center', borderRight: 'none' }}>
                  <button onClick={handleAdd} disabled={!newPartnerId} style={{ ...btn, color: '#fff', background: newPartnerId ? 'var(--color-primary)' : '#cbd5e1', cursor: newPartnerId ? 'pointer' : 'not-allowed', padding: '4px 8px', margin: '0 auto', fontSize: '0.7rem' }}>
                    <Plus size={12} />
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        
        <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid var(--color-border)', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', backgroundColor: 'var(--color-bg-surface-hover)' }}>
          <button onClick={onClose} style={{ padding: '8px 16px', borderRadius: '6px', border: '1px solid var(--color-border)', background: 'var(--color-bg-body)', color: 'var(--color-text-main)', cursor: 'pointer', fontWeight: '600' }}>Hủy</button>
          <button onClick={() => onSave({ ...pkg, invitedBidders: bidders })} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', borderRadius: '6px', border: 'none', background: 'var(--color-primary)', color: '#fff', cursor: 'pointer', fontWeight: '600' }}>
            <Save size={16} /> Lưu thay đổi
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default BiddingPlan;
