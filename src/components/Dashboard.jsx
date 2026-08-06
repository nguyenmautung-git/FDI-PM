import React, { useContext, useState, useMemo, useCallback, useEffect, useRef, useDeferredValue } from 'react';
import { DocumentContext } from '../context/DocumentContext';
import { useToast } from '../context/UIContext';
import FilterPanel from './FilterPanel';
import DocumentCard from './DocumentCard';
import {
  LayoutGrid, List, Download, X, CheckSquare,
  ChevronLeft, ChevronRight, ArrowUpDown, FileSpreadsheet, Plus,
} from 'lucide-react';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { format } from 'date-fns';
import { ref as storageRef, getBlob } from 'firebase/storage';
import { storage } from '../firebase';
import * as XLSX from 'xlsx';
import { ROLES } from '../constants';


const EMPTY_FILTERS = { keyword: '', project: [], agency: '', documentType: '', dateFrom: '', dateTo: '' };
const safeName = (s) => (s || 'TaiLieu').replace(/[/\\:*?"<>|]/g, '_').trim();
const PAGE_SIZE = 20;

// ── Sort options ──────────────────────────────────────────────────────────
const SORT_OPTIONS = [
  { value: 'effectiveDate_desc', label: 'Ngày hiệu lực ↓ (mới nhất)' },
  { value: 'effectiveDate_asc',  label: 'Ngày hiệu lực ↑ (cũ nhất)'  },
  { value: 'createdAt_desc',     label: 'Ngày tạo ↓ (mới nhất)'       },
  { value: 'createdAt_asc',      label: 'Ngày tạo ↑ (cũ nhất)'        },
  { value: 'documentNumber_asc', label: 'Số văn bản A → Z'            },
  { value: 'documentNumber_desc',label: 'Số văn bản Z → A'            },
];

// ── localStorage helper ──────────────────────────────────────────────────────────────
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

// ── Xuất CSV ──────────────────────────────────────────────────────────────
const exportToCsv = (docs) => {
  const BOM = '\uFEFF';
  const headers = ['Mã tài liệu', 'Số văn bản', 'Loại tài liệu', 'Cơ quan ban hành', 'Ngày hiệu lực', 'Trích yếu', 'Dự án liên quan', 'Số file đính kèm'];
  const escape = (v) => { if (v == null) return ''; const s = String(v).replace(/"/g, '""'); return `"${s}"`; };
  const rows = docs.map(doc => [
    escape(doc.documentCode), escape(doc.documentNumber), escape(doc.documentType),
    escape(doc.issuingAgency),
    escape(doc.effectiveDate ? format(new Date(doc.effectiveDate), 'dd/MM/yyyy') : ''),
    escape(doc.summary), escape((doc.relatedProjects || []).join('; ')),
    escape(doc.attachments?.length ?? 0),
  ].join(','));
  const csv = BOM + [headers.join(','), ...rows].join('\r\n');
  saveAs(new Blob([csv], { type: 'text/csv;charset=utf-8;' }), `DanhSachTaiLieu_${format(new Date(), 'yyyyMMdd_HHmm')}.csv`);
};

// ── Xuất Excel (.xlsx) ────────────────────────────────────────────────────────
const exportToExcel = (docs) => {
  const rows = docs.map(doc => ({
    'Mã tài liệu':     doc.documentCode || '',
    'Số văn bản':    doc.documentNumber || '',
    'Loại tài liệu':   doc.documentType || '',
    'Cơ quan ban hành': doc.issuingAgency || '',
    'Ngày hiệu lực':  doc.effectiveDate ? format(new Date(doc.effectiveDate), 'dd/MM/yyyy') : '',
    'Trích yếu':      doc.summary || '',
    'Dự án liên quan': (doc.relatedProjects || []).join('; '),
    'Cấp độ truy cập':  (doc.accessLevels || []).join('; '),
    'Số file đính kèm': doc.attachments?.length ?? 0,
    'Ngày tạo':        doc.createdAt ? format(new Date(doc.createdAt), 'dd/MM/yyyy HH:mm') : '',
    'Người tải lên':  doc.uploader || '',
  }));
  const ws = XLSX.utils.json_to_sheet(rows);
  // Điều chỉnh độ rộng cột
  ws['!cols'] = [10, 22, 18, 24, 16, 50, 30, 20, 12, 18, 18].map(w => ({ wch: w }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Danh sách tài liệu');
  XLSX.writeFile(wb, `DanhSachTaiLieu_${format(new Date(), 'yyyyMMdd_HHmm')}.xlsx`);
};

const Dashboard = ({ onOpenForm }) => {
  const { allDocuments: documents, isDocNew, logDownload, userRole, canAddDocument } = useContext(DocumentContext);
  const toast = useToast();

  const [viewMode, setViewModeRaw]               = useLS('doc_viewMode', 'grid');
  const [filters, setFiltersRaw]                 = useLS('doc_filters', EMPTY_FILTERS);
  const [sortValue, setSortValueRaw]             = useLS('doc_sort', 'effectiveDate_desc');
  const [selectedIds, setSelectedIds]         = useState(new Set());
  const [showSelectedOnly, setShowSelectedOnly] = useState(false);
  const [downloading, setDownloading]         = useState(false);
  const [currentPage, setCurrentPage]         = useState(1);
  const [showSortMenu, setShowSortMenu]       = useState(false);
  const sortMenuRef                           = useRef(null);

  // Wrap setters to also reset page
  const setViewMode  = (v) => setViewModeRaw(v);
  const setFilters   = useCallback((v) => { setFiltersRaw(v); setCurrentPage(1); }, [setFiltersRaw]);

  // Debounce keyword search — chỉ tính toán filter sau khi user ngừng gõ
  const deferredKeyword = useDeferredValue(filters.keyword);

  // Đóng sort menu khi click bên ngoài
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

  // ── Lọc tài liệu ────────────────────────────────────────────────────────
  const filteredDocs = useMemo(() => {
    return documents.filter(doc => {
      if (doc.isDeleted) return false; // Ẩn tài liệu đã xóa mềm
      if (showSelectedOnly && !selectedIds.has(doc.id)) return false;
      if (deferredKeyword) {
        const kw = deferredKeyword.toLowerCase();
        const match =
          (doc.documentCode    || '').toLowerCase().includes(kw) ||
          (doc.documentNumber  || '').toLowerCase().includes(kw) ||
          (doc.summary         || '').toLowerCase().includes(kw) ||
          (doc.keywords        || '').toLowerCase().includes(kw) ||
          (doc.issuingAgency   || '').toLowerCase().includes(kw) ||
          (doc.documentType    || '').toLowerCase().includes(kw) ||
          (Array.isArray(doc.relatedProjects) ? doc.relatedProjects.join(' ') : '').toLowerCase().includes(kw);
        if (!match) return false;
      }
      if (filters.project && filters.project.length > 0) {
        const docProjects = doc.relatedProjects || [];
        if (!filters.project.some(pName => docProjects.includes(pName))) return false;
      }
      if (filters.agency && doc.issuingAgency !== filters.agency) return false;
      if (filters.documentType && doc.documentType !== filters.documentType) return false;
      if (filters.dateFrom && new Date(doc.effectiveDate) < new Date(filters.dateFrom)) return false;
      if (filters.dateTo   && new Date(doc.effectiveDate) > new Date(filters.dateTo))   return false;
      return true;
    });
  }, [documents, filters, deferredKeyword, showSelectedOnly, selectedIds]);

  // ── Sắp xếp ─────────────────────────────────────────────────────────────
  const sortedDocs = useMemo(() => {
    const [key, dir] = sortValue.split('_');
    return [...filteredDocs].sort((a, b) => {
      let va = a[key] ?? '';
      let vb = b[key] ?? '';
      if (key === 'effectiveDate' || key === 'createdAt') {
        va = va ? new Date(va).getTime() : 0;
        vb = vb ? new Date(vb).getTime() : 0;
      } else {
        va = String(va).toLowerCase();
        vb = String(vb).toLowerCase();
      }
      if (va < vb) return dir === 'asc' ? -1 : 1;
      if (va > vb) return dir === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filteredDocs, sortValue]);

  // ── Phân trang ───────────────────────────────────────────────────────────
  const totalPages  = Math.max(1, Math.ceil(sortedDocs.length / PAGE_SIZE));
  const safePage    = Math.min(currentPage, totalPages);
  const pagedDocs   = sortedDocs.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  // Reset về trang 1 khi filter / sort thay đổi
  const handleSetFilters = useCallback((val) => { setFilters(val); }, [setFilters]);
  const handleSetSort = (val) => { setSortValueRaw(val); setCurrentPage(1); setShowSortMenu(false); };

  // ── Toggle chọn / bỏ chọn ──────────────────────────────────────────────
  const toggleSelect = useCallback((id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);
  const clearSelection = () => { setSelectedIds(new Set()); setShowSelectedOnly(false); };

  // ── Lấy blob từ Firebase Storage SDK ────────────────────────────────────
  const fetchBlobFromFirebase = async (url) => {
    const match = url.match(/\/o\/(.+?)(\?|$)/);
    if (!match) {
      const res = await fetch(url);
      if (!res.ok) throw new Error('Không thể tải tệp trực tiếp.');
      return await res.blob();
    }
    const path = decodeURIComponent(match[1]);
    const fileRef = storageRef(storage, path);
    return await getBlob(fileRef);
  };

  // ── Tải xuống ZIP ────────────────────────────────────────────────────────
  const handleDownload = async () => {
    const selected  = documents.filter(d => selectedIds.has(d.id));
    const withFiles = selected.filter(d => d.attachments?.length > 0);
    if (withFiles.length === 0) {
      toast.warning('Các tài liệu đã chọn không có tệp đính kèm nào để tải xuống.');
      return;
    }
    setDownloading(true);
    const zip  = new JSZip();
    const errs = [];
    const tasks = [];
    for (const doc of withFiles) {
      // ── Cấu trúc: [Dự án] / [Số văn bản] / file
      const projectName = safeName((doc.relatedProjects || [])[0] || 'Chung');
      const docFolder   = safeName(doc.documentNumber || doc.documentCode || doc.id);
      const folder = zip.folder(projectName).folder(docFolder);
      for (const file of (doc.attachments || [])) {
        tasks.push((async () => {
          try {
            const blob = await fetchBlobFromFirebase(file.url);
            folder.file(file.name || 'file', blob);
          } catch (e) {
            errs.push(`${doc.documentNumber} / ${file.name}: ${e.message}`);
            const txt = `Không thể tải tệp này tự động.\nLink trực tiếp: ${file.url}\n\nLỗi: ${e.message}`;
            folder.file(`${file.name || 'file'}_link.txt`, txt);
          }
        })());
      }
    }
    await Promise.all(tasks);
    try {
      const blob = await zip.generateAsync({ type: 'blob' });
      saveAs(blob, `TaiLieu_${format(new Date(), 'yyyyMMdd_HHmm')}.zip`);
      errs.length > 0
        ? toast.warning(`Đã tải ZIP. ${errs.length} tệp lỗi được chuyển thành link.`)
        : toast.success(`Đã tải xuống ${withFiles.length} tài liệu thành công!`);
    } catch (e) { toast.error('Lỗi tạo file ZIP: ' + e.message); }
    setDownloading(false);
  };

  const selectedCount = selectedIds.size;
  const currentSortLabel = SORT_OPTIONS.find(o => o.value === sortValue)?.label ?? '';

  return (
    <>
    {/* ── Dashboard: 3 vùng: [controls] [cards - cuộn] [pagination - đáy] ── */}
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 0 }}>

      {/* ── Khu controls cố định (không cuộn) ── */}
      <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '1.5rem', paddingBottom: '1rem' }}>

      {/* ── Tiêu đề + toolbar ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '1rem', flexWrap: 'wrap' }}>
          <h1 style={{ fontSize: '1.5rem', fontWeight: '700', color: 'var(--color-text-main)', margin: 0 }}>
            Tài liệu
          </h1>
          <span style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
            Hiển thị <strong style={{ color: 'var(--color-text-main)' }}>{sortedDocs.length}</strong> / {documents.length} tài liệu trong hệ thống
          </span>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>

          {/* ── Nút Tải lên tài liệu ── */}
          {(userRole === ROLES.ADMIN || (canAddDocument && canAddDocument()) || onOpenForm) && (
            <button
              className="btn btn-primary"
              onClick={onOpenForm}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.4rem',
                padding: '0.45rem 0.95rem', borderRadius: 'var(--radius-md)',
                backgroundColor: '#3b82f6', color: 'white', fontWeight: '600',
                fontSize: '0.85rem', cursor: 'pointer', boxShadow: '0 2px 8px rgba(59,130,246,0.35)',
                whiteSpace: 'nowrap'
              }}
            >
              <Plus size={16} />
              <span>Tải lên tài liệu</span>
            </button>
          )}

          {/* ── Sắp xếp dropdown ── */}
          <div style={{ position: 'relative' }} ref={sortMenuRef}>
            <button
              onClick={() => setShowSortMenu(p => !p)}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.4rem',
                padding: '0.45rem 0.9rem',
                background: showSortMenu ? 'var(--color-bg-surface-hover)' : 'var(--color-bg-surface)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-md)', color: 'var(--color-text-main)',
                fontSize: '0.82rem', fontWeight: '500', cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              <ArrowUpDown size={14} style={{ color: 'var(--color-primary)' }} />
              {currentSortLabel}
            </button>

            {showSortMenu && (
              <div style={{
                position: 'absolute', top: 'calc(100% + 6px)', right: 0, zIndex: 9999,
                background: '#1e293b',
                border: '1px solid var(--color-border)',
                borderRadius: '12px', overflow: 'hidden',
                boxShadow: '0 12px 32px rgba(0,0,0,0.6)',
                minWidth: '220px',
              }}>
                {SORT_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => handleSetSort(opt.value)}
                    style={{
                      display: 'block', width: '100%', textAlign: 'left',
                      padding: '0.6rem 1rem',
                      background: sortValue === opt.value ? 'rgba(59,130,246,0.12)' : 'transparent',
                      border: 'none',
                      color: sortValue === opt.value ? 'var(--color-primary)' : 'var(--color-text-main)',
                      fontSize: '0.83rem', fontWeight: sortValue === opt.value ? '600' : '400',
                      cursor: 'pointer',
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* ── Grid / List toggle ── */}
          <div style={{ display: 'flex', gap: '0.25rem', backgroundColor: 'var(--color-bg-surface)', padding: '0.25rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}>
            <button onClick={() => setViewMode('grid')}
              style={{ padding: '0.375rem', borderRadius: 'var(--radius-sm)', backgroundColor: viewMode === 'grid' ? 'var(--color-bg-surface-hover)' : 'transparent', color: viewMode === 'grid' ? 'var(--color-primary)' : 'var(--color-text-muted)', border: 'none', cursor: 'pointer' }}>
              <LayoutGrid size={18} />
            </button>
            <button onClick={() => setViewMode('list')}
              style={{ padding: '0.375rem', borderRadius: 'var(--radius-sm)', backgroundColor: viewMode === 'list' ? 'var(--color-bg-surface-hover)' : 'transparent', color: viewMode === 'list' ? 'var(--color-primary)' : 'var(--color-text-muted)', border: 'none', cursor: 'pointer' }}>
              <List size={18} />
            </button>
          </div>
        </div>
      </div>

      {/* ── Bộ lọc ── */}
      <FilterPanel
        filters={filters}
        setFilters={handleSetFilters}
        selectedCount={selectedCount}
        showSelectedOnly={showSelectedOnly}
        onToggleShowSelected={() => setShowSelectedOnly(p => !p)}
      />

      {/* ── Thanh hành động khi chọn ── */}
      {selectedCount > 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0.75rem 1.25rem',
          background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.25)',
          borderRadius: 'var(--radius-md)', animation: 'fadeIn 0.2s ease',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '0.875rem', color: 'var(--color-primary)', fontWeight: '600' }}>
            <CheckSquare size={18} />
            Đã chọn <strong>{selectedCount}</strong> tài liệu
          </div>
          <div style={{ display: 'flex', gap: '0.6rem' }}>
            <button onClick={clearSelection}
              style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.45rem 0.875rem', background: 'none', border: '1px solid rgba(59,130,246,0.3)', borderRadius: '8px', color: 'var(--color-primary)', fontSize: '0.8rem', cursor: 'pointer' }}>
              <X size={14} /> Bỏ chọn tất cả
            </button>
            <button
              onClick={handleDownload}
              disabled={downloading}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.45rem',
                padding: '0.45rem 1rem',
                background: downloading ? 'rgba(59,130,246,0.4)' : 'linear-gradient(135deg,#3b82f6,#8b5cf6)',
                border: 'none', borderRadius: '8px', color: 'white',
                fontSize: '0.82rem', fontWeight: '700',
                cursor: downloading ? 'not-allowed' : 'pointer',
                boxShadow: '0 4px 12px rgba(59,130,246,0.3)',
              }}>
              {downloading
                ? <><span style={{ width: '13px', height: '13px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 0.8s linear infinite', display: 'inline-block' }} />Đang tạo ZIP...</>
                : <><Download size={15} />Tải xuống tài liệu đã chọn</>
              }
            </button>
          </div>
        </div>
      )}

      </div>{/* /controls */}

      {/* ── Khu cards — chỉ phần này cuộn ── */}
      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
        {sortedDocs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '4rem 2rem', backgroundColor: 'var(--color-bg-surface)', borderRadius: 'var(--radius-lg)', border: '1px dashed var(--color-border)' }}>
            <p style={{ color: 'var(--color-text-muted)', fontSize: '1rem' }}>
              {showSelectedOnly ? 'Chưa có tài liệu nào được chọn.' : 'Không tìm thấy tài liệu nào phù hợp với bộ lọc.'}
            </p>
            <button className="btn btn-outline" style={{ marginTop: '1rem' }}
              onClick={() => { handleSetFilters(EMPTY_FILTERS); setShowSelectedOnly(false); }}>
              Xóa bộ lọc
            </button>
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: viewMode === 'grid' ? 'repeat(auto-fill, minmax(320px, 1fr))' : '1fr',
            gap: '1.5rem', paddingBottom: '1rem',
          }}>
            {pagedDocs.map(doc => (
              <DocumentCard
                key={doc.id}
                document={doc}
                viewMode={viewMode}
                isSelected={selectedIds.has(doc.id)}
                onToggleSelect={() => toggleSelect(doc.id)}
                isNew={isDocNew ? isDocNew(doc.id) : doc.isNew}
                onDownload={logDownload}
              />
            ))}
          </div>
        )}
      </div>{/* /cards */}

      {/* ── Phân trang — luôn nằm ở đáy, không cuộn ── */}
      {totalPages > 1 && (
        <div style={{
          flexShrink: 0,
          display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem',
          padding: '0.75rem 1rem',
          borderTop: '1px solid var(--color-border)',
          background: 'rgba(15, 23, 42, 0.97)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          boxShadow: '0 -4px 20px rgba(0,0,0,0.35)',
          flexWrap: 'wrap', rowGap: '0.4rem',
          marginTop: 'auto',
        }}>
          {/* Nút Trang đầu */}
          <button
            onClick={() => setCurrentPage(1)}
            disabled={safePage === 1}
            style={{
              padding: '0.35rem 0.65rem', borderRadius: '8px',
              background: 'none', border: '1px solid var(--color-border)',
              color: safePage === 1 ? 'var(--color-text-muted)' : 'var(--color-text-main)',
              cursor: safePage === 1 ? 'not-allowed' : 'pointer', fontSize: '0.78rem',
              opacity: safePage === 1 ? 0.4 : 1,
            }}
            title="Trang đầu"
          >«</button>

          {/* Nút Trang trước */}
          <button
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={safePage === 1}
            style={{
              display: 'flex', alignItems: 'center', padding: '0.35rem 0.65rem',
              borderRadius: '8px', background: 'none', border: '1px solid var(--color-border)',
              color: safePage === 1 ? 'var(--color-text-muted)' : 'var(--color-text-main)',
              cursor: safePage === 1 ? 'not-allowed' : 'pointer',
              opacity: safePage === 1 ? 0.4 : 1,
            }}
          >
            <ChevronLeft size={16} />
          </button>

          {/* Các số trang */}
          {Array.from({ length: totalPages }, (_, i) => i + 1)
            .filter(p => p === 1 || p === totalPages || Math.abs(p - safePage) <= 2)
            .reduce((acc, p, idx, arr) => {
              if (idx > 0 && p - arr[idx - 1] > 1) acc.push('...');
              acc.push(p);
              return acc;
            }, [])
            .map((item, idx) =>
              item === '...' ? (
                <span key={`ellipsis-${idx}`} style={{ color: 'var(--color-text-muted)', padding: '0 0.25rem', fontSize: '0.85rem' }}>…</span>
              ) : (
                <button
                  key={item}
                  onClick={() => setCurrentPage(item)}
                  style={{
                    padding: '0.35rem 0.7rem', borderRadius: '8px',
                    background: safePage === item ? 'var(--color-primary)' : 'none',
                    border: safePage === item ? 'none' : '1px solid var(--color-border)',
                    color: safePage === item ? 'white' : 'var(--color-text-main)',
                    fontWeight: safePage === item ? '700' : '400',
                    cursor: 'pointer', fontSize: '0.85rem',
                    boxShadow: safePage === item ? '0 2px 8px rgba(59,130,246,0.4)' : 'none',
                    minWidth: '34px',
                  }}
                >
                  {item}
                </button>
              )
            )
          }

          {/* Nút Trang sau */}
          <button
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={safePage === totalPages}
            style={{
              display: 'flex', alignItems: 'center', padding: '0.35rem 0.65rem',
              borderRadius: '8px', background: 'none', border: '1px solid var(--color-border)',
              color: safePage === totalPages ? 'var(--color-text-muted)' : 'var(--color-text-main)',
              cursor: safePage === totalPages ? 'not-allowed' : 'pointer',
              opacity: safePage === totalPages ? 0.4 : 1,
            }}
          >
            <ChevronRight size={16} />
          </button>

          {/* Nút Trang cuối */}
          <button
            onClick={() => setCurrentPage(totalPages)}
            disabled={safePage === totalPages}
            style={{
              padding: '0.35rem 0.65rem', borderRadius: '8px',
              background: 'none', border: '1px solid var(--color-border)',
              color: safePage === totalPages ? 'var(--color-text-muted)' : 'var(--color-text-main)',
              cursor: safePage === totalPages ? 'not-allowed' : 'pointer', fontSize: '0.78rem',
              opacity: safePage === totalPages ? 0.4 : 1,
            }}
            title="Trang cuối"
          >»</button>

          {/* Thông tin */}
          <span style={{ marginLeft: '0.5rem', color: 'var(--color-text-muted)', fontSize: '0.8rem' }}>
            Trang <strong style={{ color: 'var(--color-text-main)' }}>{safePage}</strong> / {totalPages}
            &nbsp;·&nbsp;
            {(safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, sortedDocs.length)} / {sortedDocs.length} tài liệu
          </span>
        </div>
      )}

    </div>

    <style>{`
      @keyframes spin    { to { transform: rotate(360deg); } }
      @keyframes fadeIn  { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: translateY(0); } }
    `}</style>
    </>
  );
};

export default Dashboard;
