import React, { useContext } from 'react';
import { DocumentContext } from '../context/DocumentContext';
import { X, CheckSquare } from 'lucide-react';
import Select from 'react-select';

const EMPTY_FILTERS = { keyword: '', project: [], agency: '', documentType: '', dateFrom: '', dateTo: '' };


const reactSelectStyles = {
  control: (base) => ({ 
    ...base, 
    minHeight: '38px', 
    borderRadius: 'var(--radius-md)', 
    borderColor: 'var(--color-border)', 
    backgroundColor: 'rgba(15, 23, 42, 0.6)', 
    fontSize: '0.875rem',
    boxShadow: 'none',
    '&:hover': {
      borderColor: 'var(--color-primary)'
    }
  }),
  menu: (base) => ({
    ...base,
    backgroundColor: 'var(--color-bg-body)',
    border: '1px solid var(--color-border)',
    zIndex: 9999
  }),
  menuPortal: (base) => ({
    ...base,
    zIndex: 9999
  }),
  option: (base, state) => ({
    ...base,
    backgroundColor: state.isFocused ? 'var(--color-primary)' : 'transparent',
    color: 'var(--color-text-main)',
    cursor: 'pointer'
  }),
  singleValue: (base) => ({
    ...base,
    color: 'var(--color-text-main)'
  }),
  multiValue: (base) => ({
    ...base,
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
    borderRadius: '4px'
  }),
  multiValueLabel: (base) => ({
    ...base,
    color: '#93c5fd',
    fontSize: '0.75rem'
  }),
  input: (base) => ({
    ...base,
    color: 'var(--color-text-main)'
  })
};

const FilterPanel = ({ filters, setFilters, selectedCount = 0, showSelectedOnly = false, onToggleShowSelected }) => {
  const { documentTypes, allProjects: projects, allDocuments: documents = [], uniqueAgencies = [] } = useContext(DocumentContext);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFilters(prev => ({ ...prev, [name]: value }));
  };

  const activeCount = Object.entries(filters).filter(([k, v]) => {
    if (k === 'project') return Array.isArray(v) && v.length > 0;
    return v !== '';
  }).length;
  const hasFilters  = activeCount > 0;

  return (
    <div className="card" style={{ padding: '1.25rem', position: 'relative', zIndex: 10 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'flex-end' }}>

        {/* Từ khóa */}
        <div className="form-group" style={{ marginBottom: 0, flex: '1 1 180px' }}>
          <label className="form-label" style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Từ khóa (Mã, Số, Trích yếu)</label>
          <input type="text" name="keyword" value={filters.keyword}
            onChange={handleChange} className="input-field" placeholder="Nhập từ khóa..." />
        </div>

        {/* Dự án */}
        <div className="form-group" style={{ marginBottom: 0, flex: '1 1 220px' }}>
          <label className="form-label" style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Dự án liên quan</label>
          <Select
            isMulti
            options={projects.map(p => ({ value: p.name, label: p.name }))}
            placeholder="Tất cả dự án"
            value={(filters.project || []).map(pName => ({ value: pName, label: pName }))}
            onChange={(selected) => setFilters(prev => ({ ...prev, project: selected ? selected.map(s => s.value) : [] }))}
            styles={reactSelectStyles}
            menuPortalTarget={document.body}
          />
        </div>

        {/* Cơ quan */}
        <div className="form-group" style={{ marginBottom: 0, flex: '1 1 160px' }}>
          <label className="form-label" style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Cơ quan ban hành</label>
          <select name="agency" value={filters.agency} onChange={handleChange} className="input-field">
            <option value="">Tất cả cơ quan</option>
            {uniqueAgencies.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>

        {/* Loại tài liệu */}
        <div className="form-group" style={{ marginBottom: 0, flex: '1 1 160px' }}>
          <label className="form-label" style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Loại tài liệu</label>
          <select name="documentType" value={filters.documentType} onChange={handleChange} className="input-field">
            <option value="">Tất cả phân loại</option>
            {documentTypes.map(t => <option key={t.id} value={t.name}>{t.name}</option>)}
          </select>
        </div>

        {/* Khoảng ngày */}
        <div style={{ display: 'flex', gap: '0.5rem', flex: '1 1 260px' }}>
          <div className="form-group" style={{ marginBottom: 0, flex: 1 }}>
            <label className="form-label" style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Từ ngày</label>
            <input type="date" name="dateFrom" value={filters.dateFrom} onChange={handleChange} className="input-field" />
          </div>
          <div className="form-group" style={{ marginBottom: 0, flex: 1 }}>
            <label className="form-label" style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Đến ngày</label>
            <input type="date" name="dateTo" value={filters.dateTo} onChange={handleChange} className="input-field" />
          </div>
        </div>

        {/* Lọc "Tài liệu đã chọn" — chỉ hiện khi có tài liệu được check */}
        {selectedCount > 0 && (
          <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: '1px' }}>
            <button
              onClick={onToggleShowSelected}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.4rem',
                padding: '0.5rem 0.875rem',
                background: showSelectedOnly ? 'rgba(59,130,246,0.2)' : 'rgba(59,130,246,0.08)',
                border: showSelectedOnly ? '1px solid rgba(59,130,246,0.6)' : '1px solid rgba(59,130,246,0.3)',
                borderRadius: 'var(--radius-md)',
                color: '#60a5fa', fontSize: '0.82rem', fontWeight: '600',
                cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all 0.15s',
              }}
              title={showSelectedOnly ? 'Hiển thị tất cả' : 'Chỉ hiển thị tài liệu đã chọn'}
            >
              <CheckSquare size={14} />
              Tài liệu đã chọn
              <span style={{ background: '#3b82f6', color: 'white', borderRadius: '999px', fontSize: '0.68rem', padding: '1px 6px', fontWeight: '700', lineHeight: '1.4' }}>
                {selectedCount}
              </span>
            </button>
          </div>
        )}

        {/* Xóa bộ lọc — chỉ hiện khi có filter đang bật */}
        {hasFilters && (
          <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: '1px' }}>
            <button
              onClick={() => setFilters(EMPTY_FILTERS)}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.4rem',
                padding: '0.5rem 0.875rem',
                background: 'rgba(239,68,68,0.1)',
                border: '1px solid rgba(239,68,68,0.3)',
                borderRadius: 'var(--radius-md)',
                color: '#f87171', fontSize: '0.82rem', fontWeight: '600',
                cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.18)'; e.currentTarget.style.borderColor = 'rgba(239,68,68,0.5)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.1)'; e.currentTarget.style.borderColor = 'rgba(239,68,68,0.3)'; }}
              title="Xóa tất cả bộ lọc"
            >
              <X size={14} />
              Xóa bộ lọc
              <span style={{ background: '#ef4444', color: 'white', borderRadius: '999px', fontSize: '0.68rem', padding: '1px 6px', fontWeight: '700', lineHeight: '1.4' }}>
                {activeCount}
              </span>
            </button>
          </div>
        )}

      </div>
    </div>
  );
};

export default FilterPanel;
