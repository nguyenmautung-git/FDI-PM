import React, { useContext, useState, useMemo } from 'react';
import { X, Plus, Download, Trash2, FileDown, Search, AlertCircle } from 'lucide-react';
import { DocumentContext } from '../context/DocumentContext';
import { useToast } from '../context/UIContext';
import { format, parseISO, isValid } from 'date-fns';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';

// ── Helpers ────────────────────────────────────────────────────────────────
const EMPTY = { keyword: '', project: '', agency: '', documentType: '', dateFrom: '', dateTo: '' };

const displayDate = (s) => {
  if (!s) return '';
  const d = parseISO(s);
  return isValid(d) ? format(d, 'dd/MM/yyyy') : '';
};

// Tên folder an toàn cho Windows/Mac (thay / : * ? " < > | bằng _)
const safeName = (s) => (s || 'TaiLieu').replace(/[/\\:*?"<>|]/g, '_').trim();

// ── Mini Filter (dùng riêng trong modal) ──────────────────────────────────
const MiniFilter = ({ filters, setFilters, documentTypes, projects, uniqueAgencies }) => {
  const set = (k, v) => setFilters(p => ({ ...p, [k]: v }));
  const inputSt = {
    padding: '0.5rem 0.75rem', background: 'rgba(15,23,42,0.6)',
    border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px',
    color: '#f8fafc', fontSize: '0.82rem', outline: 'none', width: '100%',
  };
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'flex-end' }}>
      {/* Keyword */}
      <div style={{ flex: '1 1 170px' }}>
        <label style={{ fontSize: '0.7rem', color: '#64748b', display: 'block', marginBottom: '0.3rem' }}>Từ khóa</label>
        <div style={{ position: 'relative' }}>
          <Search size={13} style={{ position: 'absolute', left: '9px', top: '50%', transform: 'translateY(-50%)', color: '#475569', pointerEvents: 'none' }} />
          <input style={{ ...inputSt, paddingLeft: '2rem' }} placeholder="Mã, Số, Trích yếu..."
            value={filters.keyword} onChange={e => set('keyword', e.target.value)} />
        </div>
      </div>
      {/* Project */}
      <div style={{ flex: '1 1 140px' }}>
        <label style={{ fontSize: '0.7rem', color: '#64748b', display: 'block', marginBottom: '0.3rem' }}>Dự án</label>
        <select style={inputSt} value={filters.project} onChange={e => set('project', e.target.value)}>
          <option value="">Tất cả</option>
          {projects.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
        </select>
      </div>
      {/* Agency */}
      <div style={{ flex: '1 1 140px' }}>
        <label style={{ fontSize: '0.7rem', color: '#64748b', display: 'block', marginBottom: '0.3rem' }}>Cơ quan</label>
        <select style={inputSt} value={filters.agency} onChange={e => set('agency', e.target.value)}>
          <option value="">Tất cả</option>
          {uniqueAgencies.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
      </div>
      {/* Type */}
      <div style={{ flex: '1 1 140px' }}>
        <label style={{ fontSize: '0.7rem', color: '#64748b', display: 'block', marginBottom: '0.3rem' }}>Loại tài liệu</label>
        <select style={inputSt} value={filters.documentType} onChange={e => set('documentType', e.target.value)}>
          <option value="">Tất cả</option>
          {documentTypes.map(t => <option key={t.id} value={t.name}>{t.name}</option>)}
        </select>
      </div>
      {/* Dates */}
      <div style={{ flex: '1 1 220px', display: 'flex', gap: '0.5rem' }}>
        <div style={{ flex: 1 }}>
          <label style={{ fontSize: '0.7rem', color: '#64748b', display: 'block', marginBottom: '0.3rem' }}>Từ ngày</label>
          <div style={{ position: 'relative' }}>
            <input type="text" readOnly style={{ ...inputSt, cursor: 'pointer' }}
              value={displayDate(filters.dateFrom)} placeholder="dd/mm/yyyy"
              onClick={e => { const n = e.currentTarget.nextElementSibling; if (n?.showPicker) try { n.showPicker(); } catch (_) {} }} />
            <input type="date" value={filters.dateFrom} onChange={e => set('dateFrom', e.target.value)}
              style={{ position: 'absolute', bottom: 0, right: 0, opacity: 0, pointerEvents: 'none', width: '1px', height: '1px' }} />
          </div>
        </div>
        <div style={{ flex: 1 }}>
          <label style={{ fontSize: '0.7rem', color: '#64748b', display: 'block', marginBottom: '0.3rem' }}>Đến ngày</label>
          <div style={{ position: 'relative' }}>
            <input type="text" readOnly style={{ ...inputSt, cursor: 'pointer' }}
              value={displayDate(filters.dateTo)} placeholder="dd/mm/yyyy"
              onClick={e => { const n = e.currentTarget.nextElementSibling; if (n?.showPicker) try { n.showPicker(); } catch (_) {} }} />
            <input type="date" value={filters.dateTo} onChange={e => set('dateTo', e.target.value)}
              style={{ position: 'absolute', bottom: 0, right: 0, opacity: 0, pointerEvents: 'none', width: '1px', height: '1px' }} />
          </div>
        </div>
      </div>
    </div>
  );
};

// ── Main Modal ─────────────────────────────────────────────────────────────
const DownloadModal = ({ onClose }) => {
  const { allDocuments: documents = [], allProjects: projects = [], documentTypes = [], uniqueAgencies = [] } = useContext(DocumentContext);
  const toast = useToast();
  const [filters, setFilters]     = useState(EMPTY);
  const [list, setList]           = useState([]);      // danh sách tải xuống
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress]   = useState({ done: 0, total: 0 });
  const [errors, setErrors]       = useState([]);

  // Lọc văn bản theo bộ lọc hiện tại
  const filtered = useMemo(() => {
    return documents.filter(doc => {
      if (filters.keyword) {
        const kw = filters.keyword.toLowerCase();
        if (!(doc.documentCode || '').toLowerCase().includes(kw) &&
            !(doc.documentNumber || '').toLowerCase().includes(kw) &&
            !(doc.summary || '').toLowerCase().includes(kw)) return false;
      }
      if (filters.project && !(doc.relatedProjects || []).includes(filters.project)) return false;
      if (filters.agency && doc.issuingAgency !== filters.agency) return false;
      if (filters.documentType && doc.documentType !== filters.documentType) return false;
      if (filters.dateFrom && new Date(doc.effectiveDate) < new Date(filters.dateFrom)) return false;
      if (filters.dateTo   && new Date(doc.effectiveDate) > new Date(filters.dateTo))   return false;
      return true;
    });
  }, [documents, filters]);

  // Thêm văn bản được lọc vào danh sách (tránh trùng)
  const handleAddToList = () => {
    setList(prev => {
      const existIds = new Set(prev.map(d => d.id));
      const toAdd = filtered.filter(d => !existIds.has(d.id));
      return [...prev, ...toAdd];
    });
  };

  // Xóa 1 dòng
  const removeRow = (id) => setList(prev => prev.filter(d => d.id !== id));

  // Xóa tất cả
  const clearList = () => setList([]);

  // ── Tải xuống ZIP ────────────────────────────────────────────────────────
  const handleDownload = async () => {
    const docsWithFiles = list.filter(d => d.attachments?.length > 0);
    if (docsWithFiles.length === 0) {
      toast.warning('Không có tài liệu nào có tệp đính kèm để tải xuống.');
      return;
    }

    setDownloading(true);
    setErrors([]);
    const zip = new JSZip();
    let done = 0;
    const errs = [];

    // Tổng số file cần tải
    const totalFiles = docsWithFiles.reduce((s, d) => s + (d.attachments?.length || 0), 0);
    setProgress({ done: 0, total: totalFiles });

    for (const doc of docsWithFiles) {
      const folderName = safeName(doc.documentNumber || doc.documentCode || doc.id);
      const folder = zip.folder(folderName);

      for (const file of (doc.attachments || [])) {
        try {
          const res = await fetch(file.url);
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const blob = await res.blob();
          folder.file(file.name || 'file', blob);
        } catch (e) {
          errs.push(`${folderName}/${file.name}: ${e.message}`);
        }
        done++;
        setProgress({ done, total: totalFiles });
      }
    }

    try {
      const blob = await zip.generateAsync({ type: 'blob' });
      saveAs(blob, `TaiLieu_${format(new Date(), 'yyyyMMdd_HHmm')}.zip`);
    } catch (e) {
      errs.push('Lỗi tạo file ZIP: ' + e.message);
    }

    setErrors(errs);
    setDownloading(false);
    setProgress({ done: 0, total: 0 });
  };

  // Đếm tổng số file đính kèm trong danh sách
  const totalAttachments = list.reduce((s, d) => s + (d.attachments?.length || 0), 0);

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 300, alignItems: 'flex-start', paddingTop: '2rem' }}>
      <div onClick={e => e.stopPropagation()} style={{
        width: '100%', maxWidth: '1000px', maxHeight: '92vh',
        background: 'var(--color-bg-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: '20px', display: 'flex', flexDirection: 'column',
        boxShadow: '0 32px 80px rgba(0,0,0,0.6)', overflow: 'hidden',
      }}>

        {/* ── Header ── */}
        <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <FileDown size={20} style={{ color: 'var(--color-primary)' }} />
              Tải xuống tài liệu
            </h2>
            <p style={{ margin: '2px 0 0', fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>
              Lọc văn bản, thêm vào danh sách rồi tải xuống dưới dạng ZIP
            </p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer' }}>
            <X size={20} />
          </button>
        </div>

        {/* ── Bộ lọc + nút thêm ── */}
        <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--color-border)', background: 'var(--color-bg-surface-hover)', flexShrink: 0 }}>
          <MiniFilter filters={filters} setFilters={setFilters}
            documentTypes={documentTypes} projects={projects} uniqueAgencies={uniqueAgencies} />

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.875rem' }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>
              Tìm thấy <strong style={{ color: 'var(--color-text-main)' }}>{filtered.length}</strong> văn bản
            </span>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              {/* Xóa bộ lọc */}
              {Object.values(filters).some(v => v) && (
                <button onClick={() => setFilters(EMPTY)} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.45rem 0.875rem', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '8px', color: '#f87171', fontSize: '0.78rem', fontWeight: '600', cursor: 'pointer' }}>
                  <X size={13} /> Xóa bộ lọc
                </button>
              )}
              <button
                onClick={handleAddToList}
                disabled={filtered.length === 0}
                style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.45rem 1rem', background: filtered.length > 0 ? 'var(--color-primary)' : 'rgba(59,130,246,0.3)', border: 'none', borderRadius: '8px', color: 'white', fontSize: '0.82rem', fontWeight: '600', cursor: filtered.length > 0 ? 'pointer' : 'not-allowed', transition: 'all 0.15s' }}>
                <Plus size={15} />
                Thêm {filtered.length > 0 ? `${filtered.length} văn bản` : ''} vào danh sách
              </button>
            </div>
          </div>
        </div>

        {/* ── Danh sách tải xuống (datasheet) ── */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {list.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem 2rem', color: 'var(--color-text-muted)' }}>
              <FileDown size={40} style={{ opacity: 0.3, marginBottom: '0.75rem', display: 'block', margin: '0 auto 0.75rem' }} />
              <p style={{ fontSize: '0.9rem' }}>Chưa có văn bản nào trong danh sách.<br />Dùng bộ lọc bên trên để thêm văn bản.</p>
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
              <thead>
                <tr style={{ background: 'var(--color-bg-surface-hover)', position: 'sticky', top: 0, zIndex: 2 }}>
                  {['STT', 'Số văn bản', 'Nội dung trích yếu', 'Tệp đính kèm', ''].map((h, i) => (
                    <th key={i} style={{
                      padding: '0.7rem 1rem', textAlign: 'left',
                      fontSize: '0.72rem', fontWeight: '700', color: 'var(--color-text-muted)',
                      textTransform: 'uppercase', letterSpacing: '0.04em',
                      borderBottom: '1px solid var(--color-border)',
                      width: i === 0 ? '48px' : i === 4 ? '40px' : 'auto',
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {list.map((doc, idx) => (
                  <tr key={doc.id} style={{ borderBottom: '1px solid var(--color-border)', transition: 'background 0.15s' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--color-bg-surface-hover)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    {/* STT */}
                    <td style={{ padding: '0.7rem 1rem', color: 'var(--color-text-muted)', textAlign: 'center' }}>{idx + 1}</td>
                    {/* Số văn bản */}
                    <td style={{ padding: '0.7rem 1rem', fontWeight: '600', color: 'var(--color-primary)', whiteSpace: 'nowrap' }}>
                      <div>{doc.documentNumber}</div>
                      <div style={{ fontSize: '0.68rem', color: 'var(--color-text-muted)', fontWeight: '400', marginTop: '2px' }}>{doc.documentCode}</div>
                    </td>
                    {/* Trích yếu */}
                    <td style={{ padding: '0.7rem 1rem', color: 'var(--color-text-main)', maxWidth: '320px' }}>
                      <div style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', lineHeight: '1.5' }}>
                        {doc.summary}
                      </div>
                    </td>
                    {/* Tệp đính kèm */}
                    <td style={{ padding: '0.7rem 1rem' }}>
                      {doc.attachments?.length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                          {doc.attachments.map((f, fi) => (
                            <a key={fi} href={f.url} target="_blank" rel="noreferrer"
                              style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--color-primary)', textDecoration: 'none', fontSize: '0.75rem', maxWidth: '200px' }}>
                              <Download size={11} />
                              <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{f.name}</span>
                            </a>
                          ))}
                        </div>
                      ) : (
                        <span style={{ color: 'var(--color-text-muted)', fontSize: '0.75rem' }}>—</span>
                      )}
                    </td>
                    {/* Xóa dòng */}
                    <td style={{ padding: '0.7rem 0.75rem', textAlign: 'center' }}>
                      <button onClick={() => removeRow(doc.id)} style={{ background: 'none', border: 'none', color: 'var(--color-danger)', cursor: 'pointer', padding: '4px' }} title="Xóa khỏi danh sách">
                        <Trash2 size={15} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* ── Footer: tải xuống ── */}
        {list.length > 0 && (
          <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0, background: 'var(--color-bg-surface)' }}>
            <div style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)' }}>
              <strong style={{ color: 'var(--color-text-main)' }}>{list.length}</strong> văn bản ·{' '}
              <strong style={{ color: 'var(--color-text-main)' }}>{totalAttachments}</strong> tệp đính kèm
              {downloading && (
                <span style={{ marginLeft: '0.75rem', color: 'var(--color-primary)' }}>
                  Đang tải: {progress.done}/{progress.total} tệp...
                </span>
              )}
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <button onClick={clearList} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.5rem 0.875rem', background: 'none', border: '1px solid var(--color-border)', borderRadius: '10px', color: 'var(--color-text-muted)', fontSize: '0.82rem', cursor: 'pointer' }}>
                <Trash2 size={14} /> Xóa danh sách
              </button>
              <button
                onClick={handleDownload}
                disabled={downloading || totalAttachments === 0}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.5rem',
                  padding: '0.55rem 1.25rem',
                  background: downloading || totalAttachments === 0 ? 'rgba(59,130,246,0.3)' : 'linear-gradient(135deg,#3b82f6,#8b5cf6)',
                  border: 'none', borderRadius: '10px', color: 'white',
                  fontSize: '0.88rem', fontWeight: '700',
                  cursor: downloading || totalAttachments === 0 ? 'not-allowed' : 'pointer',
                  boxShadow: downloading ? 'none' : '0 4px 16px rgba(59,130,246,0.3)',
                }}>
                {downloading
                  ? <><span style={{ width: '14px', height: '14px', border: '2px solid rgba(255,255,255,0.4)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 0.8s linear infinite', display: 'inline-block' }} />Đang tạo ZIP...</>
                  : <><Download size={16} />Tải xuống ZIP ({totalAttachments} tệp)</>
                }
              </button>
            </div>
          </div>
        )}

        {/* Lỗi khi tải */}
        {errors.length > 0 && (
          <div style={{ padding: '0.75rem 1.5rem', background: 'rgba(239,68,68,0.08)', borderTop: '1px solid rgba(239,68,68,0.2)', flexShrink: 0 }}>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start', color: '#f87171', fontSize: '0.78rem' }}>
              <AlertCircle size={14} style={{ flexShrink: 0, marginTop: '1px' }} />
              <div>
                <strong>Một số tệp không tải được:</strong>
                {errors.slice(0, 3).map((e, i) => <div key={i}>{e}</div>)}
                {errors.length > 3 && <div>...và {errors.length - 3} lỗi khác</div>}
              </div>
            </div>
          </div>
        )}
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};

export default DownloadModal;
