import React, { useState, useContext, useEffect, useMemo, useRef, useCallback, useDeferredValue } from 'react';
import { ROLES } from '../constants';
import Select from 'react-select';
import { 
  Building2, Mail, Phone, Globe, MapPin, Briefcase, CreditCard, Star, Paperclip, X, Share2, ShieldOff,
  LayoutGrid, List, FileSpreadsheet, Download, ChevronLeft, ChevronRight, ArrowUpDown, Eye, Edit, Trash2,
  Lock, Unlock, Plus, Search, CheckSquare, RefreshCw, Calendar, ExternalLink, User
} from 'lucide-react';
import { DocumentContext } from '../context/DocumentContext';
import { useToast, useConfirm } from '../context/UIContext';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../firebase';
import { withTimeout, validateFileSize } from '../utils/uploadHelpers';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import { format } from 'date-fns';

const PAGE_SIZE = 20;

// ── Options sắp xếp ──────────────────────────────────────────────────────────
const SORT_OPTIONS = [
  { value: 'name_asc',       label: 'Tên đối tác A → Z' },
  { value: 'name_desc',      label: 'Tên đối tác Z → A' },
  { value: 'rating_desc',    label: 'Đánh giá ↓ (cao nhất)' },
  { value: 'createdAt_desc', label: 'Ngày tạo ↓ (mới nhất)' },
  { value: 'createdAt_asc',  label: 'Ngày tạo ↑ (cũ nhất)' },
  { value: 'taxCode_asc',    label: 'Mã số thuế A → Z' },
];

const EMPTY_FILTERS = { keyword: '', type: '', rating: '', status: '', dateFrom: '', dateTo: '' };

const AccessDenied = () => (
  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', textAlign: 'center', padding: '2rem' }}>
    <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.5rem' }}>
      <ShieldOff size={36} style={{ color: '#ef4444' }} />
    </div>
    <h2 style={{ fontSize: '1.4rem', fontWeight: '700', color: 'var(--color-text-main)', marginBottom: '0.5rem' }}>Không có quyền truy cập</h2>
    <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem', maxWidth: '360px', lineHeight: '1.7' }}>
      Trang <strong>Đối tác</strong> chỉ dành cho Quản trị viên.
    </p>
  </div>
);

const RatingStars = ({ rating, setRating, readOnly = false, size = 16 }) => {
  return (
    <div style={{ display: 'flex', gap: '2px', alignItems: 'center' }}>
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          size={size}
          fill={star <= (rating || 0) ? '#f59e0b' : 'transparent'}
          color={star <= (rating || 0) ? '#f59e0b' : '#475569'}
          style={{ cursor: readOnly ? 'default' : 'pointer', transition: 'transform 0.1s' }}
          onClick={() => !readOnly && setRating(star)}
        />
      ))}
    </div>
  );
};

// Checkbox chọn nhiều
const PartnerCheckbox = ({ checked, onChange }) => (
  <div
    onClick={e => { e.stopPropagation(); onChange(); }}
    style={{
      width: '20px', height: '20px', borderRadius: '5px', flexShrink: 0,
      border: checked ? '2px solid #3b82f6' : '2px solid rgba(255,255,255,0.25)',
      background: checked ? '#3b82f6' : 'rgba(255,255,255,0.06)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      cursor: 'pointer', transition: 'all 0.15s',
    }}
    title={checked ? 'Bỏ chọn' : 'Chọn đối tác này'}
  >
    {checked && (
      <svg width="11" height="8" viewBox="0 0 11 8" fill="none">
        <path d="M1 3.5L4 6.5L10 1" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    )}
  </div>
);

// ── Export CSV ──────────────────────────────────────────────────────────────
const exportPartnersToCsv = (partners) => {
  const BOM = '\uFEFF';
  const headers = ['Mã số thuế', 'Tên công ty', 'Tên viết tắt', 'Loại hình', 'Người đại diện', 'Số điện thoại', 'Email', 'Địa chỉ', 'Website', 'Tài khoản NH', 'Ngân hàng', 'Đánh giá (Sao)', 'Trạng thái'];
  const escape = (v) => { if (v == null) return ''; const s = String(v).replace(/"/g, '""'); return `"${s}"`; };
  const rows = partners.map(p => [
    escape(p.taxCode),
    escape(p.name),
    escape(p.shortName),
    escape(Array.isArray(p.type) ? p.type.join('; ') : p.type),
    escape(p.representative),
    escape(p.phone),
    escape(p.email),
    escape(p.address),
    escape(p.website),
    escape(p.bankAccount),
    escape(p.bankName),
    escape(p.rating || 0),
    escape(p.locked ? 'Đã khóa' : 'Hoạt động'),
  ].join(','));
  const csv = BOM + [headers.join(','), ...rows].join('\r\n');
  saveAs(new Blob([csv], { type: 'text/csv;charset=utf-8;' }), `DanhSachDoiTac_${format(new Date(), 'yyyyMMdd_HHmm')}.csv`);
};

// ── Export Excel (.xlsx) ────────────────────────────────────────────────────
const exportPartnersToExcel = (partners) => {
  const rows = partners.map(p => ({
    'Mã số thuế': p.taxCode || '',
    'Tên công ty': p.name || '',
    'Tên viết tắt': p.shortName || '',
    'Loại hình': Array.isArray(p.type) ? p.type.join('; ') : (p.type || ''),
    'Người đại diện': p.representative || '',
    'Số điện thoại': p.phone || '',
    'Email': p.email || '',
    'Địa chỉ': p.address || '',
    'Website': p.website || '',
    'Số tài khoản': p.bankAccount || '',
    'Ngân hàng': p.bankName || '',
    'Đánh giá': (p.rating || 0) + ' sao',
    'Trạng thái': p.locked ? 'Đã khóa' : 'Hoạt động',
    'Số tệp đính kèm': p.attachments?.length || 0,
  }));
  const ws = XLSX.utils.json_to_sheet(rows);
  ws['!cols'] = [16, 32, 16, 24, 20, 16, 24, 35, 22, 18, 18, 12, 14, 16].map(w => ({ wch: w }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Danh sách đối tác');
  XLSX.writeFile(wb, `DanhSachDoiTac_${format(new Date(), 'yyyyMMdd_HHmm')}.xlsx`);
};

// ── Helper LocalStorage ─────────────────────────────────────────────────────
const useLS = (key, initial) => {
  const [val, setVal] = useState(() => {
    try { const s = localStorage.getItem(key); return s !== null ? JSON.parse(s) : initial; }
    catch { return initial; }
  });
  const setAndSave = useCallback((v) => {
    const next = typeof v === 'function' ? v(val) : v;
    setVal(next);
    try { localStorage.setItem(key, JSON.stringify(next)); } catch {}
  }, [key, val]);
  return [val, setAndSave];
};

const Partners = () => {
  const { partners = [], addPartner, editPartner, deletePartner, userRole, globalLists, enableLazy } = useContext(DocumentContext);
  const toast = useToast();
  const confirm = useConfirm();
  useEffect(() => { enableLazy(); }, [enableLazy]);

  const partnerTypes = globalLists.partnerTypes || [];

  // State quản lý giao diện giống trang Tài liệu
  const [viewMode, setViewMode]               = useLS('partner_viewMode', 'grid');
  const [filters, setFiltersRaw]             = useLS('partner_filters', EMPTY_FILTERS);
  const [sortValue, setSortValueRaw]         = useLS('partner_sort', 'name_asc');
  const [selectedIds, setSelectedIds]         = useState(new Set());
  const [showSelectedOnly, setShowSelectedOnly] = useState(false);
  const [currentPage, setCurrentPage]         = useState(1);
  const [showSortMenu, setShowSortMenu]       = useState(false);
  const sortMenuRef                           = useRef(null);

  // Form & Modals
  const [isAdding, setIsAdding] = useState(false);
  const [newPartner, setNewPartner] = useState({ 
    name: '', shortName: '', taxCode: '', type: [], representative: '', 
    phone: '', email: '', address: '', website: '', logo: '',
    bankAccount: '', bankName: '', rating: 0, attachments: []
  });
  const [editingId, setEditingId] = useState(null);
  const [editFormData, setEditFormData] = useState({});
  const [viewingPartner, setViewingPartner] = useState(null);

  // Wrap filter setter
  const setFilters = useCallback((v) => {
    setFiltersRaw(v);
    setCurrentPage(1);
  }, [setFiltersRaw]);

  const deferredKeyword = useDeferredValue(filters.keyword);

  // Click outside to close sort dropdown
  useEffect(() => {
    if (!showSortMenu) return;
    const handler = (e) => {
      if (sortMenuRef.current && !sortMenuRef.current.contains(e.target)) {
        setShowSortMenu(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showSortMenu]);

  const reactSelectStyles = {
    control: (base) => ({ 
      ...base, 
      minHeight: '38px', 
      borderRadius: 'var(--radius-md)', 
      borderColor: 'var(--color-border)', 
      backgroundColor: 'rgba(15, 23, 42, 0.6)', 
      fontSize: '0.875rem',
      boxShadow: 'none',
      '&:hover': { borderColor: 'var(--color-primary)' }
    }),
    menu: (base) => ({
      ...base,
      backgroundColor: 'var(--color-bg-body)',
      border: '1px solid var(--color-border)',
      zIndex: 9999
    }),
    menuPortal: (base) => ({ ...base, zIndex: 9999 }),
    option: (base, state) => ({
      ...base,
      backgroundColor: state.isFocused ? 'var(--color-primary)' : 'transparent',
      color: 'var(--color-text-main)',
      cursor: 'pointer'
    }),
    singleValue: (base) => ({ ...base, color: 'var(--color-text-main)' }),
    multiValue: (base) => ({
      ...base,
      backgroundColor: 'rgba(59, 130, 246, 0.2)',
      borderRadius: '4px'
    }),
    multiValueLabel: (base) => ({ ...base, color: '#93c5fd', fontSize: '0.75rem' }),
    input: (base) => ({ ...base, color: 'var(--color-text-main)' })
  };

  const handleAdd = async () => {
    if (newPartner.name) {
      await addPartner({ 
        ...newPartner, 
        logo: newPartner.logo || `https://ui-avatars.com/api/?name=${encodeURIComponent(newPartner.name)}&background=random&color=fff`,
        locked: false,
        createdAt: new Date().toISOString()
      });
      setIsAdding(false);
      setNewPartner({ 
        name: '', shortName: '', taxCode: '', type: [], representative: '', 
        phone: '', email: '', address: '', website: '', logo: '',
        bankAccount: '', bankName: '', rating: 0, attachments: []
      });
      toast.success('Đã thêm đối tác mới thành công!');
    } else {
      toast.warning('Vui lòng nhập Tên công ty.');
    }
  };

  const handleDelete = async (id, e) => {
    if (e) e.stopPropagation();
    const ok = await confirm('Bạn có chắc chắn muốn xóa đối tác này?');
    if (ok) {
      await deletePartner(id);
      setSelectedIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      toast.success('Đã xóa đối tác.');
    }
  };

  const handleToggleLock = async (id, e) => {
    if (e) e.stopPropagation();
    const partner = partners.find(p => p.id === id);
    if (partner) {
      await editPartner(id, { ...partner, locked: !partner.locked });
      toast.info(partner.locked ? 'Đã mở khóa đối tác.' : 'Đã khóa đối tác.');
    }
  };

  const resizeImage = (dataUrl, callback) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;
      const MAX_DIMENSION = 800;
      
      if (width > height && width > MAX_DIMENSION) {
        height *= MAX_DIMENSION / width;
        width = MAX_DIMENSION;
      } else if (height > MAX_DIMENSION) {
        width *= MAX_DIMENSION / height;
        height = MAX_DIMENSION;
      }
      
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);
      callback(canvas.toDataURL('image/jpeg', 0.7));
    };
    img.src = dataUrl;
  };

  const handleLogoUpload = (e, isEdit = false) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        resizeImage(reader.result, (resizedDataUrl) => {
          if (isEdit) {
            setEditFormData(prev => ({ ...prev, logo: resizedDataUrl }));
          } else {
            setNewPartner(prev => ({ ...prev, logo: resizedDataUrl }));
          }
        });
      };
      reader.readAsDataURL(file);
    }
  };

  const handlePaste = (e, isEdit = false) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const file = items[i].getAsFile();
        if (file) {
          const reader = new FileReader();
          reader.onloadend = () => {
            resizeImage(reader.result, (resizedDataUrl) => {
              if (isEdit) setEditFormData(prev => ({ ...prev, logo: resizedDataUrl }));
              else setNewPartner(prev => ({ ...prev, logo: resizedDataUrl }));
            });
          };
          reader.readAsDataURL(file);
        }
        break;
      }
    }
  };

  const handleFileUpload = async (e, isEdit = false) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    const { valid, errors } = validateFileSize(files);
    if (errors.length) {
      toast.error(`File quá lớn (tối đa 50MB): ${errors.join('; ')}`);
      if (!valid.length) return;
    }
    try {
      const newAttachments = await Promise.all(
        valid.map(async (file) => {
          const storageRef = ref(storage, `partners/${Date.now()}_${file.name}`);
          const snapshot = await withTimeout(uploadBytes(storageRef, file), 20000);
          const url = await getDownloadURL(snapshot.ref);
          return { name: file.name, url };
        })
      );
      if (isEdit) {
        setEditFormData(prev => ({ ...prev, attachments: [...(prev.attachments || []), ...newAttachments] }));
      } else {
        setNewPartner(prev => ({ ...prev, attachments: [...(prev.attachments || []), ...newAttachments] }));
      }
    } catch (err) {
      console.error('Upload error:', err);
      toast.error(`Lỗi tải lên: ${err.message || 'Vui lòng thử lại'}`);
    }
  };

  const removeAttachment = (index, isEdit = false) => {
    if (isEdit) {
      setEditFormData(prev => ({ ...prev, attachments: (prev.attachments || []).filter((_, i) => i !== index) }));
    } else {
      setNewPartner(prev => ({ ...prev, attachments: (prev.attachments || []).filter((_, i) => i !== index) }));
    }
  };

  const handleEditClick = (partner, e) => {
    if (e) e.stopPropagation();
    setEditingId(partner.id);
    setEditFormData(partner);
  };

  const handleUpdate = async () => {
    await editPartner(editingId, editFormData);
    setEditingId(null);
    toast.success('Đã cập nhật đối tác thành công!');
  };

  const handleExportPDF = async (partner) => {
    const element = document.getElementById('partner-printable-area');
    if (!element) return;
    const opt = {
      margin:       10,
      filename:     `info_${partner.name}.pdf`,
      image:        { type: 'jpeg', quality: 0.98 },
      html2canvas:  { scale: 2, useCORS: true, logging: false },
      jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };
    const html2pdf = (await import('html2pdf.js')).default;
    html2pdf().set(opt).from(element).save();
  };

  // ── Lọc đối tác ────────────────────────────────────────────────────────────
  const filteredPartners = useMemo(() => {
    return partners.filter(p => {
      // 1. Lọc theo danh sách chọn
      if (showSelectedOnly && !selectedIds.has(p.id)) return false;

      // 2. Từ khóa (Tên, Mã, MST, Người ĐD, Phone, Email)
      if (deferredKeyword.trim()) {
        const kw = deferredKeyword.toLowerCase().trim();
        const matchName = p.name?.toLowerCase().includes(kw);
        const matchShort = p.shortName?.toLowerCase().includes(kw);
        const matchTax = p.taxCode?.toLowerCase().includes(kw);
        const matchRep = p.representative?.toLowerCase().includes(kw);
        const matchPhone = p.phone?.toLowerCase().includes(kw);
        const matchEmail = p.email?.toLowerCase().includes(kw);
        const matchAddress = p.address?.toLowerCase().includes(kw);
        if (!matchName && !matchShort && !matchTax && !matchRep && !matchPhone && !matchEmail && !matchAddress) {
          return false;
        }
      }

      // 3. Loại hình đối tác
      if (filters.type) {
        const types = Array.isArray(p.type) ? p.type : [p.type];
        if (!types.includes(filters.type)) return false;
      }

      // 4. Đánh giá (Rating)
      if (filters.rating) {
        const minRating = Number(filters.rating);
        if ((p.rating || 0) < minRating) return false;
      }

      // 5. Trạng thái (locked / active)
      if (filters.status === 'locked' && !p.locked) return false;
      if (filters.status === 'active' && p.locked) return false;

      // 6. Khoảng ngày tạo
      if (filters.dateFrom && p.createdAt) {
        if (new Date(p.createdAt) < new Date(filters.dateFrom)) return false;
      }
      if (filters.dateTo && p.createdAt) {
        const dTo = new Date(filters.dateTo);
        dTo.setHours(23, 59, 59, 999);
        if (new Date(p.createdAt) > dTo) return false;
      }

      return true;
    });
  }, [partners, showSelectedOnly, selectedIds, deferredKeyword, filters]);

  // ── Sắp xếp đối tác ────────────────────────────────────────────────────────
  const sortedPartners = useMemo(() => {
    const list = [...filteredPartners];
    list.sort((a, b) => {
      switch (sortValue) {
        case 'name_asc': return (a.name || '').localeCompare(b.name || '', 'vi');
        case 'name_desc': return (b.name || '').localeCompare(a.name || '', 'vi');
        case 'rating_desc': return (b.rating || 0) - (a.rating || 0);
        case 'createdAt_desc': return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
        case 'createdAt_asc': return new Date(a.createdAt || 0) - new Date(b.createdAt || 0);
        case 'taxCode_asc': return (a.taxCode || '').localeCompare(b.taxCode || '');
        default: return 0;
      }
    });
    return list;
  }, [filteredPartners, sortValue]);

  // ── Phân trang ─────────────────────────────────────────────────────────────
  const totalPages = Math.ceil(sortedPartners.length / PAGE_SIZE) || 1;
  const safePage   = Math.min(currentPage, totalPages);
  const pagedPartners = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE;
    return sortedPartners.slice(start, start + PAGE_SIZE);
  }, [sortedPartners, safePage]);

  // Quản lý chọn checkbox
  const toggleSelectPartner = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleSelectAllPage = () => {
    const pageIds = pagedPartners.map(p => p.id);
    const allSelected = pageIds.every(id => selectedIds.has(id));
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (allSelected) {
        pageIds.forEach(id => next.delete(id));
      } else {
        pageIds.forEach(id => next.add(id));
      }
      return next;
    });
  };

  const selectedPartnersList = useMemo(() => {
    return partners.filter(p => selectedIds.has(p.id));
  }, [partners, selectedIds]);

  const activeFilterCount = Object.entries(filters).filter(([k, v]) => v !== '').length;

  if (userRole !== ROLES.ADMIN) return <AccessDenied />;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, gap: '1rem', overflow: 'hidden' }}>
      
      {/* ── HEADER GIỐNG TRANG TÀI LIỆU ──────────────────────────────────── */}
      <div className="card" style={{ padding: '1.25rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', position: 'relative', zIndex: 100 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '1rem', flexWrap: 'wrap' }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: '700', color: 'var(--color-text-main)', margin: 0 }}>Đối tác</h2>
          <span style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
            Hiển thị <strong style={{ color: 'var(--color-primary)' }}>{sortedPartners.length}</strong> / {partners.length} đối tác trong hệ thống
          </span>
        </div>

        {/* Nút tác vụ góc phải */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>

          {/* Menu Sắp xếp */}
          <div style={{ position: 'relative' }} ref={sortMenuRef}>
            <button
              onClick={() => setShowSortMenu(prev => !prev)}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.4rem',
                padding: '0.5rem 0.875rem',
                backgroundColor: 'rgba(255,255,255,0.05)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--color-text-main)', fontSize: '0.85rem', fontWeight: '500',
                cursor: 'pointer'
              }}
            >
              <ArrowUpDown size={15} style={{ color: 'var(--color-primary)' }} />
              <span>{SORT_OPTIONS.find(o => o.value === sortValue)?.label}</span>
            </button>

            {showSortMenu && (
              <div style={{
                position: 'absolute', right: 0, top: 'calc(100% + 6px)', zIndex: 9999,
                backgroundColor: '#1e293b',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-md)',
                boxShadow: '0 12px 28px rgba(0,0,0,0.6)', minWidth: '220px', overflow: 'hidden'
              }}>
                {SORT_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => { setSortValueRaw(opt.value); setShowSortMenu(false); }}
                    style={{
                      width: '100%', textAlign: 'left', padding: '0.65rem 1rem',
                      background: sortValue === opt.value ? 'rgba(59,130,246,0.2)' : 'transparent',
                      color: sortValue === opt.value ? '#60a5fa' : 'var(--color-text-main)',
                      border: 'none', fontSize: '0.85rem', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between'
                    }}
                  >
                    {opt.label}
                    {sortValue === opt.value && <span style={{ fontSize: '0.75rem', fontWeight: 'bold' }}>✓</span>}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Chế độ xem Grid / List */}
          <div style={{ display: 'flex', backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: '2px' }}>
            <button
              onClick={() => setViewMode('grid')}
              style={{
                background: viewMode === 'grid' ? 'var(--color-primary)' : 'transparent',
                color: viewMode === 'grid' ? 'white' : 'var(--color-text-muted)',
                border: 'none', borderRadius: 'var(--radius-sm)', padding: '0.35rem 0.6rem',
                cursor: 'pointer', display: 'flex', alignItems: 'center'
              }}
              title="Chế độ xem lưới"
            >
              <LayoutGrid size={16} />
            </button>
            <button
              onClick={() => setViewMode('list')}
              style={{
                background: viewMode === 'list' ? 'var(--color-primary)' : 'transparent',
                color: viewMode === 'list' ? 'white' : 'var(--color-text-muted)',
                border: 'none', borderRadius: 'var(--radius-sm)', padding: '0.35rem 0.6rem',
                cursor: 'pointer', display: 'flex', alignItems: 'center'
              }}
              title="Chế độ xem danh sách"
            >
              <List size={16} />
            </button>
          </div>

          {/* Nút Thêm đối tác */}
          {userRole === ROLES.ADMIN && (
            <button 
              className="btn btn-primary" 
              onClick={() => setIsAdding(!isAdding)} 
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: '600' }}
            >
              <Plus size={18} /> {isAdding ? 'Hủy form' : 'Thêm đối tác'}
            </button>
          )}
        </div>
      </div>

      {/* ── THÊM ĐỐI TÁC MỚI FORM (MODAL INLINE) ─────────────────────────── */}
      {isAdding && (
        <div 
          onPaste={(e) => handlePaste(e, false)}
          className="card"
          style={{ padding: '1.5rem', border: '1px solid var(--color-primary)', backgroundColor: 'var(--color-bg-surface-hover)' }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', borderBottom: '1px solid var(--color-border)', paddingBottom: '0.75rem' }}>
            <h3 style={{ fontSize: '1.15rem', fontWeight: '700', color: 'var(--color-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Building2 size={20} /> Thêm thông tin đối tác mới
            </h3>
            <button onClick={() => setIsAdding(false)} style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer' }}>
              <X size={20} />
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Tên công ty (*)</label>
              <input type="text" className="input-field" value={newPartner.name} onChange={(e) => setNewPartner({...newPartner, name: e.target.value})} placeholder="Công ty CP..." />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Tên viết tắt</label>
              <input type="text" className="input-field" value={newPartner.shortName} onChange={(e) => setNewPartner({...newPartner, shortName: e.target.value})} placeholder="FPT, Coteccons..." />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Mã số thuế</label>
              <input type="text" className="input-field" value={newPartner.taxCode} onChange={(e) => setNewPartner({...newPartner, taxCode: e.target.value})} placeholder="0123456789" />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Loại hình đối tác</label>
              <Select
                isMulti
                options={partnerTypes.map(t => ({ value: t.name, label: t.name }))}
                placeholder="-- Chọn loại hình --"
                value={(Array.isArray(newPartner.type) ? newPartner.type : (newPartner.type ? [newPartner.type] : [])).map(t => ({ value: t, label: t }))}
                onChange={(selected) => setNewPartner({...newPartner, type: selected ? selected.map(s => s.value) : []})}
                styles={reactSelectStyles}
                menuPortalTarget={document.body}
              />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Người đại diện</label>
              <input type="text" className="input-field" value={newPartner.representative} onChange={(e) => setNewPartner({...newPartner, representative: e.target.value})} placeholder="Nguyễn Văn A" />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Số điện thoại</label>
              <input type="text" className="input-field" value={newPartner.phone} onChange={(e) => setNewPartner({...newPartner, phone: e.target.value})} placeholder="09..." />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Email</label>
              <input type="email" className="input-field" value={newPartner.email} onChange={(e) => setNewPartner({...newPartner, email: e.target.value})} placeholder="contact@company.com" />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Website</label>
              <input type="text" className="input-field" value={newPartner.website} onChange={(e) => setNewPartner({...newPartner, website: e.target.value})} placeholder="https://..." />
            </div>
            <div className="form-group" style={{ marginBottom: 0, gridColumn: '1 / -1' }}>
              <label className="form-label">Địa chỉ trụ sở</label>
              <input type="text" className="input-field" value={newPartner.address} onChange={(e) => setNewPartner({...newPartner, address: e.target.value})} placeholder="Số nhà, đường, phường, quận..." />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Số tài khoản</label>
              <input type="text" className="input-field" value={newPartner.bankAccount} onChange={(e) => setNewPartner({...newPartner, bankAccount: e.target.value})} placeholder="123456789" />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Ngân hàng</label>
              <input type="text" className="input-field" value={newPartner.bankName} onChange={(e) => setNewPartner({...newPartner, bankName: e.target.value})} placeholder="Vietcombank, MB Bank..." />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Đánh giá tín nhiệm</label>
              <div style={{ height: '38px', display: 'flex', alignItems: 'center' }}>
                <RatingStars rating={newPartner.rating} setRating={(r) => setNewPartner({...newPartner, rating: r})} size={20} />
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Ảnh đại diện <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>(Ctrl+V dán ảnh)</span></label>
              <input type="file" accept="image/*" className="input-field" onChange={(e) => handleLogoUpload(e, false)} style={{ padding: '0.4rem' }} />
            </div>

            <div className="form-group" style={{ marginBottom: 0, gridColumn: '1 / -1' }}>
              <label className="form-label">Tệp đính kèm (Profile, Portfolio, Giấy phép...)</label>
              <input type="file" multiple className="input-field" onChange={(e) => handleFileUpload(e, false)} style={{ padding: '0.4rem' }} />
              {newPartner.attachments && newPartner.attachments.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.5rem' }}>
                  {newPartner.attachments.map((file, idx) => (
                    <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', padding: '0.25rem 0.5rem', backgroundColor: 'var(--color-bg-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)' }}>
                      <span style={{ fontSize: '0.75rem' }}>{file.name}</span>
                      <button type="button" onClick={() => removeAttachment(idx, false)} style={{ background: 'none', border: 'none', color: 'var(--color-danger)', cursor: 'pointer', padding: '2px' }}><X size={14} /></button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid var(--color-border)' }}>
            <button className="btn btn-outline" onClick={() => setIsAdding(false)}>Hủy bỏ</button>
            <button className="btn btn-primary" onClick={handleAdd}>Lưu đối tác mới</button>
          </div>
        </div>
      )}

      {/* ── THANH LỌC FILTER PANEL GIỐNG TRANG TÀI LIỆU ──────────────────── */}
      <div className="card" style={{ padding: '1.25rem', position: 'relative', zIndex: 10 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'flex-end' }}>

          {/* 1. Từ khóa */}
          <div className="form-group" style={{ marginBottom: 0, flex: '1 1 200px' }}>
            <label className="form-label" style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
              Từ khóa (Mã, Số, Trích yếu)
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                value={filters.keyword}
                onChange={(e) => setFilters(prev => ({ ...prev, keyword: e.target.value }))}
                className="input-field"
                placeholder="Nhập từ khóa..."
                style={{ paddingRight: filters.keyword ? '2rem' : '0.75rem' }}
              />
              {filters.keyword && (
                <button
                  onClick={() => setFilters(prev => ({ ...prev, keyword: '' }))}
                  style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer' }}
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </div>

          {/* 2. Loại hình đối tác */}
          <div className="form-group" style={{ marginBottom: 0, flex: '1 1 180px' }}>
            <label className="form-label" style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Loại hình đối tác</label>
            <select
              value={filters.type}
              onChange={(e) => setFilters(prev => ({ ...prev, type: e.target.value }))}
              className="input-field"
            >
              <option value="">Tất cả loại hình</option>
              {partnerTypes.map(t => (
                <option key={t.id || t.name} value={t.name}>{t.name}</option>
              ))}
            </select>
          </div>

          {/* 3. Đánh giá sao */}
          <div className="form-group" style={{ marginBottom: 0, flex: '1 1 150px' }}>
            <label className="form-label" style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Đánh giá tín nhiệm</label>
            <select
              value={filters.rating}
              onChange={(e) => setFilters(prev => ({ ...prev, rating: e.target.value }))}
              className="input-field"
            >
              <option value="">Tất cả đánh giá</option>
              <option value="5">⭐⭐⭐⭐⭐ (5 sao)</option>
              <option value="4">⭐⭐⭐⭐ (từ 4 sao)</option>
              <option value="3">⭐⭐⭐ (từ 3 sao)</option>
            </select>
          </div>

          {/* 4. Trạng thái */}
          <div className="form-group" style={{ marginBottom: 0, flex: '1 1 140px' }}>
            <label className="form-label" style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Trạng thái</label>
            <select
              value={filters.status}
              onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
              className="input-field"
            >
              <option value="">Tất cả trạng thái</option>
              <option value="active">Đang hoạt động</option>
              <option value="locked">Đã khóa</option>
            </select>
          </div>

          {/* 5. Khoảng ngày */}
          <div style={{ display: 'flex', gap: '0.5rem', flex: '1 1 240px' }}>
            <div className="form-group" style={{ marginBottom: 0, flex: 1 }}>
              <label className="form-label" style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Từ ngày</label>
              <input type="date" value={filters.dateFrom} onChange={(e) => setFilters(prev => ({ ...prev, dateFrom: e.target.value }))} className="input-field" />
            </div>
            <div className="form-group" style={{ marginBottom: 0, flex: 1 }}>
              <label className="form-label" style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Đến ngày</label>
              <input type="date" value={filters.dateTo} onChange={(e) => setFilters(prev => ({ ...prev, dateTo: e.target.value }))} className="input-field" />
            </div>
          </div>

          {/* Filter Reset Button */}
          {activeFilterCount > 0 && (
            <button
              onClick={() => setFilters(EMPTY_FILTERS)}
              className="btn btn-outline"
              style={{ padding: '0.5rem 0.875rem', fontSize: '0.82rem', color: 'var(--color-danger)', borderColor: 'rgba(239,68,68,0.3)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
            >
              <RefreshCw size={14} /> Xóa bộ lọc
            </button>
          )}

          {/* Lọc "Đối tác đã chọn" */}
          {selectedIds.size > 0 && (
            <div style={{ display: 'flex', alignItems: 'flex-end' }}>
              <button
                onClick={() => setShowSelectedOnly(prev => !prev)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.4rem',
                  padding: '0.5rem 0.875rem',
                  background: showSelectedOnly ? 'rgba(59,130,246,0.2)' : 'rgba(59,130,246,0.08)',
                  border: showSelectedOnly ? '1px solid rgba(59,130,246,0.6)' : '1px solid rgba(59,130,246,0.3)',
                  borderRadius: 'var(--radius-md)',
                  color: '#60a5fa', fontSize: '0.82rem', fontWeight: '600',
                  cursor: 'pointer', transition: 'all 0.15s',
                }}
              >
                <CheckSquare size={14} />
                Đối tác đã chọn
                <span style={{ background: '#3b82f6', color: 'white', borderRadius: '999px', fontSize: '0.68rem', padding: '1px 6px', fontWeight: '700' }}>
                  {selectedIds.size}
                </span>
              </button>
            </div>
          )}

        </div>
      </div>

      {/* ── KHU VỰC THẺ CÓ SLIDE BAR BÊN PHẢI TRƯỢT XEM CÁC THẺ ────────────────── */}
      <div 
        className="custom-scrollbar"
        style={{ 
          flex: 1, 
          overflowY: 'auto', 
          paddingRight: '6px', 
          minHeight: 0,
          marginRight: '-2px'
        }}
      >
        {pagedPartners.length === 0 ? (
          <div className="card" style={{ padding: '3rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>
            <Building2 size={48} style={{ opacity: 0.3, marginBottom: '1rem' }} />
            <h3 style={{ fontSize: '1.1rem', fontWeight: '600', color: 'var(--color-text-main)', marginBottom: '0.5rem' }}>Không tìm thấy đối tác phù hợp</h3>
            <p style={{ fontSize: '0.875rem' }}>Hãy thử điều chỉnh lại từ khóa hoặc xóa bớt bộ lọc tìm kiếm.</p>
          </div>
        ) : viewMode === 'grid' ? (
          /* GRID VIEW (4 CỘT DẠNG THẺ NHƯ TRANG TÀI LIỆU) */
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.25rem', paddingBottom: '0.5rem' }}>
            {pagedPartners.map(partner => {
              const isSelected = selectedIds.has(partner.id);
              const types = Array.isArray(partner.type) ? partner.type : (partner.type ? [partner.type] : []);

              return (
                <div
                  key={partner.id}
                  className="card"
                  style={{
                    display: 'flex', flexDirection: 'column', height: '100%',
                    padding: 0, overflow: 'hidden', cursor: 'pointer',
                    outline: isSelected ? '2px solid rgba(59,130,246,0.6)' : 'none',
                    backgroundColor: partner.locked ? 'rgba(30, 41, 59, 0.4)' : 'var(--color-bg-surface)',
                    opacity: partner.locked ? 0.75 : 1,
                    transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                  }}
                  onClick={() => setViewingPartner(partner)}
                  onMouseOver={e => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = '0 12px 24px rgba(0,0,0,0.2)'; }}
                  onMouseOut={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'var(--shadow-sm)'; }}
                >
                  <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', flex: 1 }}>
                    
                    {/* Hang 1: Badges */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.6rem' }}>
                      <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap' }}>
                        <span className="badge badge-pink" style={{ fontSize: '0.65rem', padding: '0.15rem 0.4rem' }}>MỚI</span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--color-primary)', fontWeight: '600' }}>
                          {partner.taxCode ? `MST: ${partner.taxCode}` : `DT_${partner.id.slice(0, 5)}`}
                        </span>
                        {types.length > 0 && (
                          <span className="badge badge-yellow" style={{ fontSize: '0.65rem', padding: '0.15rem 0.4rem' }}>
                            {types[0]}
                          </span>
                        )}
                      </div>
                      {partner.locked ? (
                        <span className="badge" style={{ backgroundColor: 'rgba(239,68,68,0.15)', color: '#ef4444', fontSize: '0.65rem', padding: '0.15rem 0.4rem', display: 'flex', alignItems: 'center', gap: '3px' }}>
                          <Lock size={10} /> ĐÃ KHÓA
                        </span>
                      ) : (
                        <RatingStars rating={partner.rating} readOnly={true} size={13} />
                      )}
                    </div>

                    {/* Representative pill */}
                    {partner.representative && (
                      <div style={{ marginBottom: '0.4rem' }}>
                        <span className="badge" style={{ backgroundColor: 'rgba(99, 102, 241, 0.15)', color: '#a5b4fc', border: '1px solid rgba(99, 102, 241, 0.3)', fontSize: '0.65rem', padding: '0.15rem 0.4rem' }}>
                          📌 ĐẠI DIỆN: {partner.representative}
                        </span>
                      </div>
                    )}

                    {/* Header title */}
                    <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                      <div style={{ width: '42px', height: '42px', borderRadius: '8px', backgroundColor: '#ffffff', border: '1px solid var(--color-border)', backgroundImage: `url(${partner.logo})`, backgroundSize: 'contain', backgroundPosition: 'center', backgroundRepeat: 'no-repeat', flexShrink: 0, marginTop: '2px' }} />
                      <div>
                        <h3 style={{ fontSize: '1.05rem', fontWeight: '700', margin: 0, color: 'var(--color-text-main)', lineHeight: 1.35, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                          {partner.name}
                        </h3>
                        {partner.shortName && (
                          <div style={{ fontSize: '0.8rem', color: '#60a5fa', fontWeight: '600', marginTop: '2px' }}>
                            ({partner.shortName})
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Summary / Contact details */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: '0.8125rem', color: 'var(--color-text-muted)', marginBottom: '1rem', flex: 1 }}>
                      {partner.phone && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Phone size={14} style={{ color: 'var(--color-success)', flexShrink: 0 }} />
                          <span style={{ color: 'var(--color-text-main)' }}>{partner.phone}</span>
                        </div>
                      )}
                      {partner.email && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          <Mail size={14} style={{ color: '#f59e0b', flexShrink: 0 }} />
                          <span>{partner.email}</span>
                        </div>
                      )}
                      {partner.address && (
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '6px', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                          <MapPin size={14} style={{ color: '#ef4444', flexShrink: 0, marginTop: '2px' }} />
                          <span>{partner.address}</span>
                        </div>
                      )}
                    </div>

                    {/* Bottom bar inside card */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', marginTop: 'auto', paddingTop: '0.75rem', borderTop: '1px solid var(--color-border)' }}>
                      
                      {/* Attachment Link / File on left */}
                      <div style={{ display: 'flex', gap: '0.3rem', overflow: 'hidden', flex: 1 }}>
                        {partner.attachments && partner.attachments.length > 0 ? (
                          <a
                            href={partner.attachments[0].url}
                            target="_blank"
                            rel="noreferrer"
                            onClick={e => e.stopPropagation()}
                            className="badge"
                            style={{ backgroundColor: 'var(--color-bg-body)', border: '1px solid var(--color-border)', color: 'var(--color-primary)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px', padding: '0.2rem 0.4rem', fontSize: '0.72rem' }}
                            title={partner.attachments[0].name}
                          >
                            <Paperclip size={12} />
                            <span style={{ maxWidth: '90px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {partner.attachments[0].name}
                            </span>
                          </a>
                        ) : partner.website ? (
                          <a
                            href={partner.website}
                            target="_blank"
                            rel="noreferrer"
                            onClick={e => e.stopPropagation()}
                            className="badge"
                            style={{ backgroundColor: 'var(--color-bg-body)', border: '1px solid var(--color-border)', color: '#8b5cf6', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px', padding: '0.2rem 0.4rem', fontSize: '0.72rem' }}
                          >
                            <Globe size={12} /> Website
                          </a>
                        ) : (
                          <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>Chưa có tệp</span>
                        )}
                      </div>

                      {/* Quick action buttons on right */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                        <button
                          className="btn-icon"
                          style={{ backgroundColor: 'var(--color-bg-surface-hover)', border: '1px solid var(--color-border)', color: '#60a5fa', width: '28px', height: '28px' }}
                          onClick={e => { e.stopPropagation(); setViewingPartner(partner); }}
                          title="Xem chi tiết"
                        >
                          <Eye size={14} />
                        </button>
                        
                        {userRole === ROLES.ADMIN && (
                          <>
                            <button
                              className="btn-icon"
                              style={{ backgroundColor: 'var(--color-bg-surface-hover)', border: '1px solid var(--color-border)', color: 'var(--color-primary)', width: '28px', height: '28px' }}
                              onClick={e => handleEditClick(partner, e)}
                              title="Sửa thông tin"
                            >
                              <Edit size={14} />
                            </button>
                            <button
                              className="btn-icon"
                              style={{ backgroundColor: 'var(--color-bg-surface-hover)', border: '1px solid var(--color-border)', color: partner.locked ? 'var(--color-success)' : 'var(--color-warning)', width: '28px', height: '28px' }}
                              onClick={e => handleToggleLock(partner.id, e)}
                              title={partner.locked ? 'Mở khóa' : 'Khóa'}
                            >
                              {partner.locked ? <Unlock size={14} /> : <Lock size={14} />}
                            </button>
                            <button
                              className="btn-icon"
                              style={{ backgroundColor: 'var(--color-bg-surface-hover)', border: '1px solid var(--color-border)', color: 'var(--color-danger)', width: '28px', height: '28px' }}
                              onClick={e => handleDelete(partner.id, e)}
                              title="Xóa đối tác"
                            >
                              <Trash2 size={14} />
                            </button>
                          </>
                        )}

                        <PartnerCheckbox checked={isSelected} onChange={() => toggleSelectPartner(partner.id)} />
                      </div>

                    </div>

                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* LIST VIEW (DANH SÁCH DẠNG BẢNG/HÀNG) */
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', paddingBottom: '0.5rem' }}>
            {pagedPartners.map(partner => {
              const isSelected = selectedIds.has(partner.id);
              const types = Array.isArray(partner.type) ? partner.type : (partner.type ? [partner.type] : []);

              return (
                <div
                  key={partner.id}
                  className="card"
                  style={{
                    display: 'flex', padding: '1rem', gap: '1.25rem', alignItems: 'center',
                    outline: isSelected ? '2px solid rgba(59,130,246,0.5)' : 'none',
                    background: isSelected ? 'rgba(59,130,246,0.05)' : undefined,
                    opacity: partner.locked ? 0.75 : 1,
                    transition: 'outline 0.15s, background 0.15s',
                    cursor: 'pointer'
                  }}
                  onClick={() => setViewingPartner(partner)}
                >
                  {/* Logo */}
                  <div style={{ width: '60px', height: '60px', borderRadius: 'var(--radius-md)', overflow: 'hidden', flexShrink: 0, backgroundColor: '#fff', border: '1px solid var(--color-border)', backgroundImage: `url(${partner.logo})`, backgroundSize: 'contain', backgroundPosition: 'center', backgroundRepeat: 'no-repeat' }} />

                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem', flexWrap: 'wrap' }}>
                      <span className="badge badge-blue">MST: {partner.taxCode || 'N/A'}</span>
                      {types.map(t => <span key={t} className="badge badge-yellow">{t}</span>)}
                      {partner.locked && <span className="badge" style={{ background: 'rgba(239,68,68,0.2)', color: '#ef4444' }}>Đã khóa</span>}
                      {partner.representative && <span className="badge" style={{ background: 'rgba(99,102,241,0.15)', color: '#a5b4fc' }}>📌 {partner.representative}</span>}
                    </div>

                    <h3 style={{ fontSize: '1.05rem', fontWeight: '700', margin: 0, color: 'var(--color-text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      {partner.name}
                      {partner.shortName && <span style={{ color: '#60a5fa', fontWeight: '600', fontSize: '0.875rem' }}>({partner.shortName})</span>}
                    </h3>

                    <div style={{ display: 'flex', gap: '1.5rem', color: 'var(--color-text-muted)', fontSize: '0.8rem', marginTop: '0.35rem', flexWrap: 'wrap' }}>
                      {partner.phone && <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Phone size={13} style={{ color: 'var(--color-success)' }} /> {partner.phone}</span>}
                      {partner.email && <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Mail size={13} style={{ color: '#f59e0b' }} /> {partner.email}</span>}
                      {partner.address && <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><MapPin size={13} style={{ color: '#ef4444' }} /> {partner.address}</span>}
                    </div>
                  </div>

                  {/* Rating */}
                  <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                    <RatingStars rating={partner.rating} readOnly={true} size={14} />
                    <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>Tín nhiệm</span>
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexShrink: 0 }}>
                    <button className="btn-icon" style={{ backgroundColor: 'rgba(255,255,255,0.1)', border: '1px solid var(--color-border)', color: '#60a5fa', width: '32px', height: '32px' }} onClick={e => { e.stopPropagation(); setViewingPartner(partner); }} title="Xem chi tiết">
                      <Eye size={16} />
                    </button>
                    {userRole === ROLES.ADMIN && (
                      <>
                        <button className="btn-icon" style={{ backgroundColor: 'rgba(255,255,255,0.1)', border: '1px solid var(--color-border)', color: 'var(--color-primary)', width: '32px', height: '32px' }} onClick={e => handleEditClick(partner, e)} title="Sửa thông tin">
                          <Edit size={16} />
                        </button>
                        <button className="btn-icon" style={{ backgroundColor: 'rgba(255,255,255,0.1)', border: '1px solid var(--color-border)', color: 'var(--color-danger)', width: '32px', height: '32px' }} onClick={e => handleDelete(partner.id, e)} title="Xóa đối tác">
                          <Trash2 size={16} />
                        </button>
                      </>
                    )}
                    <PartnerCheckbox checked={isSelected} onChange={() => toggleSelectPartner(partner.id)} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── THANH PHÂN TRANG VỊ TRÍ THẤP NHẤT (KHÔNG CHE THẺ CARD) ──────────── */}
      <div 
        className="card" 
        style={{ 
          padding: '0.75rem 1.25rem', 
          display: 'flex', 
          justify: 'space-between', 
          alignItems: 'center', 
          flexWrap: 'wrap', 
          gap: '1rem', 
          flexShrink: 0,
          marginTop: 0,
          backgroundColor: 'var(--color-bg-surface)',
          border: '1px solid var(--color-border)',
          boxShadow: 'var(--shadow-md)',
          borderRadius: 'var(--radius-lg)'
        }}
      >
        
        {/* Nut chon tat ca trang */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <PartnerCheckbox 
            checked={pagedPartners.length > 0 && pagedPartners.every(p => selectedIds.has(p.id))} 
            onChange={handleSelectAllPage} 
          />
          <span style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
            Chọn tất cả trang này ({pagedPartners.length})
          </span>
        </div>

        {/* Cum Nut Phan Trang Khung Do */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' }}>
          
          {/* Nut Trang dau */}
          <button
            onClick={() => setCurrentPage(1)}
            disabled={safePage <= 1}
            style={{
              minWidth: '34px', height: '34px', padding: '0 0.5rem', borderRadius: '8px',
              background: 'none', border: '1px solid var(--color-border)',
              color: safePage <= 1 ? 'var(--color-text-muted)' : 'var(--color-text-main)',
              cursor: safePage <= 1 ? 'not-allowed' : 'pointer', fontSize: '0.8rem',
              opacity: safePage <= 1 ? 0.4 : 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center'
            }}
            title="Trang đầu"
          >
            «
          </button>

          {/* Nut Trang truoc */}
          <button
            onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
            disabled={safePage <= 1}
            style={{
              minWidth: '34px', height: '34px', padding: '0 0.5rem', borderRadius: '8px',
              background: 'none', border: '1px solid var(--color-border)',
              color: safePage <= 1 ? 'var(--color-text-muted)' : 'var(--color-text-main)',
              cursor: safePage <= 1 ? 'not-allowed' : 'pointer',
              opacity: safePage <= 1 ? 0.4 : 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center'
            }}
            title="Trang trước"
          >
            <ChevronLeft size={16} />
          </button>

          {/* Danh sach Trang (Page Numbers) */}
          {
            (() => {
              const pages = [];
              if (totalPages <= 7) {
                for (let i = 1; i <= totalPages; i++) pages.push(i);
              } else {
                pages.push(1);
                if (safePage > 3) pages.push('...');
                const start = Math.max(2, safePage - 1);
                const end   = Math.min(totalPages - 1, safePage + 1);
                for (let i = start; i <= end; i++) pages.push(i);
                if (safePage < totalPages - 2) pages.push('...');
                pages.push(totalPages);
              }
              return pages;
            })().map((item, idx) =>
              item === '...' ? (
                <span key={`dots-${idx}`} style={{ color: 'var(--color-text-muted)', padding: '0 0.25rem', fontSize: '0.85rem' }}>...</span>
              ) : (
                <button
                  key={item}
                  onClick={() => setCurrentPage(item)}
                  style={{
                    minWidth: '34px', height: '34px', padding: '0 0.5rem', borderRadius: '8px',
                    background: safePage === item ? 'var(--color-primary)' : 'none',
                    border: safePage === item ? 'none' : '1px solid var(--color-border)',
                    color: safePage === item ? 'white' : 'var(--color-text-main)',
                    fontWeight: safePage === item ? '700' : '400',
                    cursor: 'pointer', fontSize: '0.85rem',
                    boxShadow: safePage === item ? '0 2px 8px rgba(59,130,246,0.4)' : 'none',
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center'
                  }}
                >
                  {item}
                </button>
              )
            )
          }

          {/* Nut Trang sau */}
          <button
            onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
            disabled={safePage >= totalPages}
            style={{
              minWidth: '34px', height: '34px', padding: '0 0.5rem', borderRadius: '8px',
              background: 'none', border: '1px solid var(--color-border)',
              color: safePage >= totalPages ? 'var(--color-text-muted)' : 'var(--color-text-main)',
              cursor: safePage >= totalPages ? 'not-allowed' : 'pointer',
              opacity: safePage >= totalPages ? 0.4 : 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center'
            }}
            title="Trang sau"
          >
            <ChevronRight size={16} />
          </button>

          {/* Nut Trang cuoi */}
          <button
            onClick={() => setCurrentPage(totalPages)}
            disabled={safePage >= totalPages}
            style={{
              minWidth: '34px', height: '34px', padding: '0 0.5rem', borderRadius: '8px',
              background: 'none', border: '1px solid var(--color-border)',
              color: safePage >= totalPages ? 'var(--color-text-muted)' : 'var(--color-text-main)',
              cursor: safePage >= totalPages ? 'not-allowed' : 'pointer', fontSize: '0.8rem',
              opacity: safePage >= totalPages ? 0.4 : 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center'
            }}
            title="Trang cuối"
          >
            »
          </button>

          {/* Thong tin phan trang */}
          <span style={{ marginLeft: '0.5rem', color: 'var(--color-text-muted)', fontSize: '0.825rem' }}>
            Trang <strong style={{ color: 'var(--color-text-main)' }}>{safePage}</strong> / {totalPages}
            &nbsp;·&nbsp;
            {(safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, sortedPartners.length)} / {sortedPartners.length} đối tác
          </span>

        </div>
      </div>

      {/* ── MODAL EDIT ĐỐI TÁC ───────────────────────────────────────────── */}
      {editingId && (
        <div className="modal-overlay" onClick={() => setEditingId(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ padding: '2rem', maxWidth: '650px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: '700', color: 'var(--color-text-main)', margin: 0 }}>Cập nhật thông tin đối tác</h3>
              <button onClick={() => setEditingId(null)} style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer' }}><X size={20} /></button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }} onPaste={(e) => handlePaste(e, true)}>
              <div className="form-group" style={{ gridColumn: '1 / -1', marginBottom: 0 }}>
                <label className="form-label">Tên công ty (*)</label>
                <input type="text" className="input-field" value={editFormData.name || ''} onChange={(e) => setEditFormData({...editFormData, name: e.target.value})} />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Tên viết tắt</label>
                <input type="text" className="input-field" value={editFormData.shortName || ''} onChange={(e) => setEditFormData({...editFormData, shortName: e.target.value})} />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Mã số thuế</label>
                <input type="text" className="input-field" value={editFormData.taxCode || ''} onChange={(e) => setEditFormData({...editFormData, taxCode: e.target.value})} />
              </div>
              <div className="form-group" style={{ gridColumn: '1 / -1', marginBottom: 0 }}>
                <label className="form-label">Loại hình đối tác</label>
                <Select
                  isMulti
                  options={partnerTypes.map(t => ({ value: t.name, label: t.name }))}
                  value={(Array.isArray(editFormData.type) ? editFormData.type : (editFormData.type ? [editFormData.type] : [])).map(t => ({ value: t, label: t }))}
                  onChange={(selected) => setEditFormData({...editFormData, type: selected ? selected.map(s => s.value) : []})}
                  styles={reactSelectStyles}
                  menuPortalTarget={document.body}
                />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Người đại diện</label>
                <input type="text" className="input-field" value={editFormData.representative || ''} onChange={(e) => setEditFormData({...editFormData, representative: e.target.value})} />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Số điện thoại</label>
                <input type="text" className="input-field" value={editFormData.phone || ''} onChange={(e) => setEditFormData({...editFormData, phone: e.target.value})} />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Email</label>
                <input type="email" className="input-field" value={editFormData.email || ''} onChange={(e) => setEditFormData({...editFormData, email: e.target.value})} />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Website</label>
                <input type="text" className="input-field" value={editFormData.website || ''} onChange={(e) => setEditFormData({...editFormData, website: e.target.value})} />
              </div>
              <div className="form-group" style={{ gridColumn: '1 / -1', marginBottom: 0 }}>
                <label className="form-label">Địa chỉ</label>
                <input type="text" className="input-field" value={editFormData.address || ''} onChange={(e) => setEditFormData({...editFormData, address: e.target.value})} />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Số tài khoản</label>
                <input type="text" className="input-field" value={editFormData.bankAccount || ''} onChange={(e) => setEditFormData({...editFormData, bankAccount: e.target.value})} />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Ngân hàng</label>
                <input type="text" className="input-field" value={editFormData.bankName || ''} onChange={(e) => setEditFormData({...editFormData, bankName: e.target.value})} />
              </div>
              <div className="form-group" style={{ gridColumn: '1 / -1', marginBottom: 0 }}>
                <label className="form-label">Đánh giá tín nhiệm</label>
                <RatingStars rating={editFormData.rating} setRating={(r) => setEditFormData({...editFormData, rating: r})} size={20} />
              </div>

              <div className="form-group" style={{ gridColumn: '1 / -1', marginBottom: 0 }}>
                <label className="form-label">Thay đổi logo đại diện</label>
                <input type="file" accept="image/*" className="input-field" onChange={(e) => handleLogoUpload(e, true)} style={{ padding: '0.4rem' }} />
              </div>

              <div className="form-group" style={{ gridColumn: '1 / -1', marginBottom: 0 }}>
                <label className="form-label">Tệp đính kèm bổ sung</label>
                <input type="file" multiple className="input-field" onChange={(e) => handleFileUpload(e, true)} style={{ padding: '0.4rem' }} />
                {editFormData.attachments && editFormData.attachments.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.5rem' }}>
                    {editFormData.attachments.map((file, idx) => (
                      <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', padding: '0.25rem 0.5rem', backgroundColor: 'var(--color-bg-body)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)' }}>
                        <span style={{ fontSize: '0.75rem' }}>{file.name}</span>
                        <button type="button" onClick={() => removeAttachment(idx, true)} style={{ background: 'none', border: 'none', color: 'var(--color-danger)', cursor: 'pointer' }}><X size={14} /></button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid var(--color-border)' }}>
              <button className="btn btn-outline" onClick={() => setEditingId(null)}>Hủy bỏ</button>
              <button className="btn btn-primary" onClick={handleUpdate}>Cập nhật đối tác</button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL XEM CHI TIẾT ĐỐI TÁC ───────────────────────────────────── */}
      {viewingPartner && (
        <div className="modal-overlay" onClick={() => setViewingPartner(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ padding: '2rem', maxWidth: '650px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div id="partner-printable-area" style={{ padding: '2rem', margin: '-2rem', backgroundColor: '#1e293b', color: '#f8fafc', borderRadius: 'var(--radius-lg)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', gap: '1.25rem', alignItems: 'center' }}>
                  <div style={{ width: '80px', height: '80px', borderRadius: '12px', backgroundColor: 'white', border: '1px solid #334155', backgroundImage: `url(${viewingPartner.logo})`, backgroundSize: 'contain', backgroundPosition: 'center', backgroundRepeat: 'no-repeat', flexShrink: 0 }} />
                  <div>
                    <h2 style={{ fontSize: '1.4rem', fontWeight: '700', margin: 0, color: '#f8fafc' }}>{viewingPartner.name}</h2>
                    {viewingPartner.shortName && <p style={{ margin: '0.25rem 0 0', color: '#60a5fa', fontWeight: '600', fontSize: '1rem' }}>({viewingPartner.shortName})</p>}
                    <div style={{ marginTop: '0.5rem' }}>
                      <RatingStars rating={viewingPartner.rating} readOnly={true} size={18} />
                    </div>
                  </div>
                </div>
                <button data-html2canvas-ignore="true" onClick={() => setViewingPartner(null)} style={{ background: 'var(--color-bg-surface-hover)', border: 'none', color: 'var(--color-text-main)', cursor: 'pointer', padding: '0.5rem', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <X size={20} />
                </button>
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', backgroundColor: '#0f172a', padding: '1.5rem', borderRadius: 'var(--radius-lg)', border: '1px solid #334155' }}>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <span style={{ backgroundColor: 'rgba(16, 185, 129, 0.15)', color: '#10b981', padding: '0.25rem 0.75rem', borderRadius: '4px', fontSize: '0.875rem', fontWeight: '600' }}>
                    MST: {viewingPartner.taxCode || 'Chưa có'}
                  </span>
                  {viewingPartner.type && (viewingPartner.type.length > 0) && (
                    <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
                      {(Array.isArray(viewingPartner.type) ? viewingPartner.type : [viewingPartner.type]).map(t => (
                        <span key={t} style={{ backgroundColor: 'rgba(59, 130, 246, 0.15)', color: '#3b82f6', padding: '0.25rem 0.75rem', borderRadius: '4px', fontSize: '0.875rem', fontWeight: '600' }}>
                          {t}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '0.5rem' }}>
                  {viewingPartner.representative && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                      <span style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: '600' }}>Người đại diện</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem', color: '#f8fafc' }}><Briefcase size={16} style={{ color: '#3b82f6' }}/> {viewingPartner.representative}</div>
                    </div>
                  )}
                  {viewingPartner.phone && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                      <span style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: '600' }}>Số điện thoại</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem', color: '#f8fafc' }}><Phone size={16} style={{ color: '#10b981' }}/> {viewingPartner.phone}</div>
                    </div>
                  )}
                  {viewingPartner.email && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                      <span style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: '600' }}>Email</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem', color: '#f8fafc' }}><Mail size={16} style={{ color: '#f59e0b' }}/> {viewingPartner.email}</div>
                    </div>
                  )}
                  {viewingPartner.website && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                      <span style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: '600' }}>Website</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem', color: '#f8fafc' }}>
                        <Globe size={16} style={{ color: '#8b5cf6' }}/> 
                        <a href={viewingPartner.website} target="_blank" rel="noreferrer" style={{ color: '#8b5cf6', textDecoration: 'none' }}>
                          {viewingPartner.website.replace('https://', '').replace('http://', '')}
                        </a>
                      </div>
                    </div>
                  )}
                </div>

                {(viewingPartner.bankAccount || viewingPartner.bankName) && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', marginTop: '0.5rem' }}>
                    <span style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: '600' }}>Thông tin thanh toán</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem', color: '#f8fafc' }}>
                      <CreditCard size={16} style={{ color: '#0ea5e9' }}/> 
                      <span>{viewingPartner.bankAccount} {viewingPartner.bankName ? `- ${viewingPartner.bankName}` : ''}</span>
                    </div>
                  </div>
                )}

                {viewingPartner.address && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', marginTop: '0.5rem' }}>
                    <span style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: '600' }}>Địa chỉ</span>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', fontSize: '0.9rem', color: '#f8fafc' }}>
                      <MapPin size={16} style={{ color: '#ef4444', flexShrink: 0, marginTop: '2px' }}/> 
                      <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(viewingPartner.address)}`} target="_blank" rel="noreferrer" style={{ lineHeight: 1.5, color: 'inherit', textDecoration: 'none' }}>
                        <span style={{ borderBottom: '1px dashed #334155' }}>{viewingPartner.address}</span>
                      </a>
                    </div>
                  </div>
                )}

                {viewingPartner.attachments && viewingPartner.attachments.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid #334155' }}>
                    <span style={{ fontSize: '0.875rem', color: '#f8fafc', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Paperclip size={16} /> Tệp đính kèm ({viewingPartner.attachments.length})</span>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                      {viewingPartner.attachments.map((file, idx) => (
                        <a key={idx} href={file.url} target="_blank" rel="noreferrer" style={{ backgroundColor: '#1e293b', padding: '0.5rem 1rem', borderRadius: 'var(--radius-md)', border: '1px solid #334155', color: '#3b82f6', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', transition: 'background-color 0.2s' }} onMouseOver={e => e.currentTarget.style.backgroundColor = '#334155'} onMouseOut={e => e.currentTarget.style.backgroundColor = '#1e293b'}>
                          <Paperclip size={14} /> {file.name}
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div data-html2canvas-ignore="true" style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'center' }}>
              <button className="btn btn-primary" onClick={() => handleExportPDF(viewingPartner)} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Share2 size={16} /> Xuất Hồ Sơ PDF
              </button>

              {userRole === ROLES.ADMIN ? (
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button className="btn btn-outline" onClick={() => { setEditingId(viewingPartner.id); setEditFormData(viewingPartner); setViewingPartner(null); }}>
                    Sửa
                  </button>
                  <button className="btn btn-outline" style={{ color: 'var(--color-danger)', borderColor: 'rgba(239,68,68,0.4)' }} onClick={() => { 
                    handleDelete(viewingPartner.id);
                    setViewingPartner(null);
                  }}>
                    Xóa
                  </button>
                </div>
              ) : <div></div>}
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default Partners;
