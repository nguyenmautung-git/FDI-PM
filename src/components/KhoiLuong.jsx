import React, { useState, useContext, useEffect } from 'react';
import { DocumentContext } from '../context/DocumentContext';
import { useToast } from '../context/UIContext';
import { ChevronDown, ChevronUp, Plus, Trash2, Briefcase, X, Save } from 'lucide-react';

// ─── Utility Functions ───────────────────────────────────────────────────────
const parseNumber = (val) => {
  if (!val) return 0;
  const standardStr = String(val).replace(/\./g, '').replace(',', '.');
  return parseFloat(standardStr) || 0;
};

const formatInputNumber = (value) => {
  if (!value) return '';
  let raw = value.toString().replace(/[^0-9,]/g, '');
  const parts = raw.split(',');
  const integerPart = parts[0];
  const decimalPart = parts.length > 1 ? ',' + parts[1] : '';
  
  if (integerPart === '') return decimalPart;
  const formattedInteger = new Intl.NumberFormat('vi-VN').format(parseInt(integerPart, 10));
  return formattedInteger + decimalPart;
};

const formatCurrency = (value) => {
  return new Intl.NumberFormat('vi-VN').format(value);
};

// ─── Package Datasheet Component ─────────────────────────────────────────────
const PackageDatasheet = ({ pkg, project }) => {
  const [expanded, setExpanded] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const toast = useToast();
  
  // Local state cho bảng khối lượng của gói thầu này
  const [rows, setRows] = useState([
    {
      id: 1,
      content: 'Hạng mục mẫu 1',
      unit: 'm3',
      contractQty: '100',
      actualQty: '100',
      acceptanceQty: '100',
      price: '50.000',
      notes: ''
    }
  ]);

  const calculateTotal = (row) => {
    const qty = parseNumber(row.acceptanceQty);
    const price = parseNumber(row.price);
    return qty * price;
  };

  const grandTotal = rows.reduce((sum, row) => sum + calculateTotal(row), 0);

  const handleAddRow = () => {
    const newId = rows.length > 0 ? Math.max(...rows.map(r => r.id)) + 1 : 1;
    setRows([
      ...rows,
      { id: newId, content: '', unit: '', contractQty: '', actualQty: '', acceptanceQty: '', price: '', notes: '' }
    ]);
  };

  const handleRowChange = (id, field, value) => {
    setRows(rows.map(row => row.id === id ? { ...row, [field]: value } : row));
  };

  const handleNumericChange = (id, field, value) => {
    const formatted = formatInputNumber(value);
    setRows(rows.map(row => row.id === id ? { ...row, [field]: formatted } : row));
  };

  const handleDeleteRow = (id) => {
    setRows(rows.filter(row => row.id !== id));
  };

  const handleSave = () => {
    setIsSaving(true);
    setTimeout(() => {
      setIsSaving(false);
      toast.success(`Đã lưu dữ liệu khối lượng cho gói: ${pkg.name}`);
    }, 600);
  };

  return (
    <div className="card fade-in" style={{ padding: 0, overflow: 'hidden', flexShrink: 0 }}>
      {/* Header của Gói thầu */}
      <div style={{ padding: '1.25rem 1.5rem', background: 'var(--color-bg-surface-hover)', borderBottom: expanded ? '1px solid var(--color-border)' : 'none' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', flex: 1 }}>
              <span style={{ fontSize: '0.75rem', fontWeight: '700', padding: '3px 8px', backgroundColor: 'var(--color-bg-surface-hover)', color: 'var(--color-text-muted)', borderRadius: '6px', flexShrink: 0, marginTop: '2px' }}>
                {pkg.code || 'Chưa có mã'}
              </span>
              <h3 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--color-text-main)', fontWeight: '700', lineHeight: '1.3' }}>{pkg.name}</h3>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexShrink: 0 }}>
              <button onClick={() => setExpanded(v => !v)}
                style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--color-primary)', backgroundColor: 'rgba(255,255,255,0.6)', border: '1px solid rgba(0,0,0,0.05)', borderRadius: '8px', padding: '5px 12px', cursor: 'pointer', fontSize: '0.78rem', fontWeight: '600', whiteSpace: 'nowrap' }}>
                {expanded ? <><ChevronUp size={14} /> Thu gọn</> : <><ChevronDown size={14} /> Mở bảng</>}
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', color: 'var(--color-text-muted)', fontSize: '0.8rem', width: '100%' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', overflow: 'hidden' }}>
              <Briefcase size={14} style={{ flexShrink: 0 }} /> 
              <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Dự án: {project.name}</span>
            </div>
            {pkg.nature && (
              <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                <span style={{ color: 'var(--color-primary)', fontWeight: '600', backgroundColor: '#eff6ff', padding: '3px 8px', borderRadius: '4px', fontSize: '0.75rem', border: '1px solid #bfdbfe' }}>{pkg.nature}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Datasheet Table */}
      {expanded && (
        <div style={{ borderTop: '2px solid var(--color-border)', backgroundColor: 'var(--color-bg-body)' }}>
          {/* Action Bar */}
          <div style={{ padding: '0.75rem 1rem', display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--color-border)' }}>
            <button className="btn" onClick={handleAddRow} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', backgroundColor: 'var(--color-bg-surface-hover)', color: 'var(--color-text-main)', fontSize: '0.75rem', padding: '4px 10px' }}>
              <Plus size={14} /> Thêm dòng
            </button>
            <button className="btn btn-primary" onClick={handleSave} disabled={isSaving} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem', padding: '4px 10px' }}>
              <Save size={14} /> {isSaving ? 'Đang lưu...' : 'Lưu dữ liệu'}
            </button>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table className="datasheet-table" style={{ minWidth: '900px' }}>
              <thead>
                <tr>
                  <th style={{ width: '40px', textAlign: 'center' }}>STT</th>
                  <th style={{ minWidth: '200px' }}>Hạng mục / Nội dung công việc</th>
                  <th style={{ width: '80px', textAlign: 'center' }}>Đơn vị</th>
                  <th style={{ width: '100px', textAlign: 'right' }}>KL theo HĐ</th>
                  <th style={{ width: '100px', textAlign: 'right' }}>KL thực tế</th>
                  <th style={{ width: '110px', textAlign: 'right' }}>KL nghiệm thu</th>
                  <th style={{ width: '120px', textAlign: 'right' }}>Đơn giá</th>
                  <th style={{ width: '130px', textAlign: 'right' }}>Thành tiền</th>
                  <th style={{ minWidth: '120px' }}>Ghi chú</th>
                  <th style={{ width: '40px' }}></th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={10} style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-text-muted)', fontStyle: 'italic', fontSize: '0.82rem' }}>
                      Chưa có dữ liệu khối lượng. Vui lòng bấm "Thêm dòng".
                    </td>
                  </tr>
                )}
                {rows.map((row, index) => (
                  <tr key={row.id}>
                    <td className="readonly-cell" style={{ textAlign: 'center' }}>{index + 1}</td>
                    <td>
                      <input type="text" className="datasheet-input" value={row.content} onChange={(e) => handleRowChange(row.id, 'content', e.target.value)} placeholder="Nhập nội dung..." />
                    </td>
                    <td>
                      <input type="text" className="datasheet-input" value={row.unit} onChange={(e) => handleRowChange(row.id, 'unit', e.target.value)} style={{ textAlign: 'center' }} />
                    </td>
                    <td>
                      <input type="text" className="datasheet-input" value={row.contractQty} onChange={(e) => handleNumericChange(row.id, 'contractQty', e.target.value)} style={{ textAlign: 'right' }} />
                    </td>
                    <td>
                      <input type="text" className="datasheet-input" value={row.actualQty} onChange={(e) => handleNumericChange(row.id, 'actualQty', e.target.value)} style={{ textAlign: 'right' }} />
                    </td>
                    <td>
                      <input type="text" className="datasheet-input" value={row.acceptanceQty} onChange={(e) => handleNumericChange(row.id, 'acceptanceQty', e.target.value)} style={{ textAlign: 'right' }} />
                    </td>
                    <td>
                      <input type="text" className="datasheet-input" value={row.price} onChange={(e) => handleNumericChange(row.id, 'price', e.target.value)} style={{ textAlign: 'right' }} />
                    </td>
                    <td className="readonly-cell" style={{ textAlign: 'right', fontWeight: 'bold', color: 'var(--color-primary)' }}>
                      {formatCurrency(calculateTotal(row))}
                    </td>
                    <td>
                      <input type="text" className="datasheet-input" value={row.notes} onChange={(e) => handleRowChange(row.id, 'notes', e.target.value)} />
                    </td>
                    <td style={{ textAlign: 'center', backgroundColor: 'var(--color-bg-surface)' }}>
                      <button onClick={() => handleDeleteRow(row.id)} style={{ background: 'transparent', border: 'none', color: 'var(--color-danger)', cursor: 'pointer', padding: '0.25rem' }} title="Xóa dòng">
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
                
                {/* Tổng cộng */}
                <tr style={{ backgroundColor: 'var(--color-bg-surface-hover)' }}>
                  <td colSpan={7} style={{ padding: '0.5rem 1rem', textAlign: 'right', fontWeight: 'bold', border: '1px solid var(--color-border)', color: 'var(--color-text-main)' }}>
                    TỔNG CỘNG
                  </td>
                  <td style={{ padding: '0.5rem', textAlign: 'right', fontWeight: 'bold', border: '1px solid var(--color-border)', color: 'var(--color-primary)' }}>
                    {formatCurrency(grandTotal)}
                  </td>
                  <td colSpan={2} style={{ border: '1px solid var(--color-border)', backgroundColor: 'var(--color-bg-surface)' }}></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Main Page Component ─────────────────────────────────────────────────────
const KhoiLuong = () => {
  const { projects, biddingPackages = [], globalLists, enableLazy } = useContext(DocumentContext);
  useEffect(() => { enableLazy(); }, [enableLazy]);
  
  const [filters, setFilters] = useState({ keyword: '', project: '', nature: '' });

  // Lấy các package hợp lệ (giống trang ContractorSelection)
  let validPackages = biddingPackages.filter(p =>
    projects.some(proj => String(proj.id) === String(p.projectId)) &&
    (p.status === 'Đã phê duyệt' || p.status === '✅ Đã phê duyệt')
  );

  // Áp dụng bộ lọc
  validPackages = validPackages.filter(pkg => {
    const project = projects.find(proj => String(proj.id) === String(pkg.projectId));
    if (filters.project && project?.name !== filters.project) return false;
    if (filters.nature && pkg.nature !== filters.nature) return false;
    if (filters.keyword) {
      const kw = filters.keyword.toLowerCase();
      const codeMatch = (pkg.code || '').toLowerCase().includes(kw);
      const nameMatch = (pkg.name || '').toLowerCase().includes(kw);
      if (!codeMatch && !nameMatch) return false;
    }
    return true;
  });

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters(prev => ({ ...prev, [name]: value }));
  };

  const handleClearFilters = () => {
    setFilters({ keyword: '', project: '', nature: '' });
  };

  const hasFilter = filters.keyword || filters.project || filters.nature;

  return (
    <div className="fade-in" style={{ padding: '1.5rem', position: 'relative', zIndex: 1, height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxSizing: 'border-box' }}>
      {/* Background blobs for Glassmorphism */}
      <div style={{ position: 'fixed', top: '-10%', left: '-5%', width: '500px', height: '500px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(147,197,253,0.35) 0%, rgba(255,255,255,0) 70%)', zIndex: -1, pointerEvents: 'none' }}></div>
      <div style={{ position: 'fixed', bottom: '10%', right: '-10%', width: '600px', height: '600px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(249,168,212,0.25) 0%, rgba(255,255,255,0) 70%)', zIndex: -1, pointerEvents: 'none' }}></div>
      <div style={{ position: 'fixed', top: '30%', left: '30%', width: '700px', height: '700px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(167,243,208,0.25) 0%, rgba(255,255,255,0) 70%)', zIndex: -1, pointerEvents: 'none' }}></div>

      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: '700', color: 'var(--color-text-main)', marginBottom: '0.25rem' }}>
          📊 Khối lượng & Chất lượng
        </h1>
        <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
          Theo dõi khối lượng hợp đồng, thực tế hoàn thành và nghiệm thu cho từng gói thầu
        </p>
      </div>

      {/* Filter Bar */}
      <div className="card" style={{ padding: '1.25rem', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem' }}>
          <div className="form-group" style={{ marginBottom: 0, flex: '1 1 250px' }}>
            <label className="form-label" style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Từ khóa (Mã, Tên gói thầu)</label>
            <input type="text" name="keyword" value={filters.keyword} onChange={handleFilterChange} className="input-field" placeholder="Nhập mã hoặc tên gói thầu..." />
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
              <button onClick={handleClearFilters} title="Bỏ lọc" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#fef2f2', color: '#ef4444', border: '1px solid #fca5a5', width: '35px', height: '35px', borderRadius: '4px', cursor: 'pointer', flexShrink: 0 }}>
                <X size={18} />
              </button>
            )}
          </div>
        </div>
      </div>

      {validPackages.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--color-text-muted)' }}>
          Chưa có gói thầu nào. Vui lòng tạo gói thầu ở trang "Kế hoạch LCNT".
        </div>
      ) : (
        <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'stretch', overflowX: 'auto', paddingBottom: '1rem', width: '100%', flex: 1, minHeight: 0 }}>
          {projects.map(project => {
            const projectPkgs = validPackages.filter(p => String(p.projectId) === String(project.id));
            if (projectPkgs.length === 0) return null;
            return (
              <div key={project.id} style={{ display: 'flex', flexDirection: 'column', minWidth: '700px', flex: '1 1 0', height: '100%', paddingRight: '4px' }}>
                {/* Project Header Column */}
                <div style={{ marginBottom: '1rem', paddingBottom: '0.75rem', borderBottom: '2px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
                  <h3 style={{ fontSize: '1rem', fontWeight: '700', color: 'var(--color-text-main)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Briefcase size={16} color="var(--color-primary)" />
                    {project.name}
                  </h3>
                  <span style={{ fontSize: '0.75rem', fontWeight: '600', color: 'var(--color-primary)', backgroundColor: 'rgba(59,130,246,0.15)', padding: '2px 8px', borderRadius: '12px' }}>
                    {projectPkgs.length} gói thầu
                  </span>
                </div>
                
                {/* Scrollable Package List */}
                <div className="scroll-container" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', overflowY: 'auto', overflowX: 'hidden', flex: 1, minHeight: 0 }}>
                  {projectPkgs.slice().reverse().map(pkg => (
                    <PackageDatasheet key={pkg.id} pkg={pkg} project={project} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default KhoiLuong;
