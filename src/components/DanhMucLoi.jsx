import React, { useState, useContext, useMemo, useEffect } from 'react';
import { DocumentContext } from '../context/DocumentContext';
import { useConfirm } from '../context/UIContext';
import { ROLES } from '../constants';
import { LayoutGrid, List, Plus, Edit, Trash2, AlertTriangle, Briefcase, Calendar, CheckCircle, X } from 'lucide-react';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';

// ─── Error Form Modal ────────────────────────────────────────────────────────
const ErrorForm = ({ initialData, generatedCode, onSubmit, onCancel, activeTabId }) => {
  const isEdit = !!initialData;
  const [formData, setFormData] = useState(initialData || {
    code: generatedCode, title: '', description: '', prevention: '', severity: 'Trung bình', author: 'Người dùng', tabId: activeTabId
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.code || !formData.title) return alert('Vui lòng nhập Mã lỗi và Tên lỗi!');
    onSubmit(formData);
  };

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="card fade-in" style={{ width: '500px', maxWidth: '95%', backgroundColor: 'var(--color-bg-surface)', borderRadius: '12px', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--color-bg-surface-hover)' }}>
          <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '700', color: 'var(--color-text-main)' }}>{isEdit ? 'Sửa thông tin lỗi' : 'Thêm lỗi mới'}</h3>
          <button onClick={onCancel} style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--color-text-muted)' }}><X size={20} /></button>
        </div>
        <div style={{ padding: '1.5rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label" style={{ color: 'var(--color-text-muted)' }}>Mã lỗi (Tự động)</label>
            <input type="text" name="code" value={formData.code} className="input-field" disabled style={{ backgroundColor: 'var(--color-bg-body)', cursor: 'not-allowed', opacity: 0.8 }} />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label" style={{ color: 'var(--color-text-muted)' }}>Tên lỗi / Vấn đề *</label>
            <input type="text" name="title" value={formData.title} onChange={handleChange} className="input-field" required />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label" style={{ color: 'var(--color-text-muted)' }}>Mức độ nghiêm trọng</label>
            <select name="severity" value={formData.severity} onChange={handleChange} className="input-field">
              <option value="Thấp">Thấp</option>
              <option value="Trung bình">Trung bình</option>
              <option value="Cao">Cao</option>
              <option value="Nghiêm trọng">Nghiêm trọng</option>
            </select>
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label" style={{ color: 'var(--color-text-muted)' }}>Mô tả (Nguyên nhân, hậu quả)</label>
            <textarea name="description" value={formData.description} onChange={handleChange} className="input-field" rows={3} />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label" style={{ color: 'var(--color-text-muted)' }}>Kinh nghiệm / Phòng ngừa</label>
            <textarea name="prevention" value={formData.prevention} onChange={handleChange} className="input-field" rows={3} />
          </div>
        </div>
        <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid var(--color-border)', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', backgroundColor: 'var(--color-bg-surface-hover)' }}>
          <button onClick={onCancel} className="btn" style={{ backgroundColor: 'transparent', color: 'var(--color-text-main)', border: '1px solid var(--color-border)' }}>Hủy</button>
          <button onClick={handleSubmit} className="btn btn-primary">Lưu thông tin</button>
        </div>
      </div>
    </div>
  );
};

// ─── Error Card Component ────────────────────────────────────────────────────
const ErrorCard = ({ error, viewMode, onEdit, onDelete, isAdmin }) => {
  const { id, code, title, description, prevention, severity, author } = error;
  
  const getSeverityColor = (sev) => {
    switch (sev) {
      case 'Nghiêm trọng': return 'var(--color-danger)';
      case 'Cao': return '#f97316';
      case 'Trung bình': return '#eab308';
      default: return '#3b82f6';
    }
  };

  if (viewMode === 'list') {
    return (
      <div className="card" style={{ display: 'flex', padding: '1rem', gap: '1.5rem', alignItems: 'center' }}>
        <div style={{ width: '80px', height: '80px', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--color-bg-surface-hover)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <AlertTriangle size={32} color={getSeverityColor(severity)} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
            <span className="badge" style={{ backgroundColor: 'var(--color-bg-surface)', border: `1px solid ${getSeverityColor(severity)}`, color: getSeverityColor(severity) }}>{code}</span>
            <h3 style={{ fontSize: '1rem', fontWeight: '600', margin: 0, color: 'var(--color-text-main)' }}>{title}</h3>
          </div>
          <p style={{ color: 'var(--color-text-main)', fontSize: '0.875rem', marginBottom: '0.25rem', display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
            <strong>Mô tả:</strong> {description}
          </p>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem', marginBottom: '0.5rem', display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
            <strong>Phòng ngừa:</strong> {prevention}
          </p>
        </div>
        {isAdmin && (
          <div style={{ display: 'flex', gap: '0.5rem', flexDirection: 'column' }}>
            <button onClick={() => onEdit(error)} className="btn-icon" style={{ backgroundColor: 'rgba(255, 255, 255, 0.1)', border: '1px solid var(--color-border)', color: 'var(--color-primary)', width: '32px', height: '32px' }} title="Sửa lỗi">
              <Edit size={16} />
            </button>
            <button onClick={() => onDelete(error.id)} className="btn-icon" style={{ backgroundColor: 'rgba(255, 255, 255, 0.1)', border: '1px solid var(--color-border)', color: 'var(--color-danger)', width: '32px', height: '32px' }} title="Xóa lỗi">
              <Trash2 size={16} />
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', height: '100%', cursor: 'pointer', transition: 'transform 0.2s ease, box-shadow 0.2s ease', padding: '1.25rem' }}
      onMouseOver={(e) => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = '0 12px 24px rgba(0,0,0,0.1)'; }}
      onMouseOut={(e) => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06)'; }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
        <div>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: '600', color: getSeverityColor(severity), padding: '2px 6px', border: `1px solid ${getSeverityColor(severity)}`, borderRadius: '4px' }}>
              {code}
            </span>
          </div>
          <h3 style={{ fontSize: '1.125rem', fontWeight: '700', marginTop: '0.5rem', marginBottom: '0', color: 'var(--color-text-main)' }}>{title}</h3>
        </div>
        {isAdmin && (
          <div style={{ display: 'flex', gap: '4px', opacity: 0.8 }}>
            <button onClick={(e) => { e.stopPropagation(); onEdit(error); }} className="btn-icon" style={{ backgroundColor: 'transparent', border: 'none', color: 'var(--color-primary)', width: '28px', height: '28px' }} title="Sửa lỗi">
              <Edit size={16} />
            </button>
            <button onClick={(e) => { e.stopPropagation(); onDelete(error.id); }} className="btn-icon" style={{ backgroundColor: 'transparent', border: 'none', color: 'var(--color-danger)', width: '28px', height: '28px' }} title="Xóa lỗi">
              <Trash2 size={16} />
            </button>
          </div>
        )}
      </div>

      <div style={{ color: 'var(--color-text-main)', fontSize: '0.875rem', marginBottom: '0.5rem', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
        <strong>Mô tả:</strong> {description}
      </div>
      <div style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem', marginBottom: '1rem', flex: 1, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
        <strong>Phòng ngừa:</strong> {prevention}
      </div>
    </div>
  );
};

// ─── Main Page Component ─────────────────────────────────────────────────────
const DanhMucLoi = () => {
  const {
    defectTabs: tabs,
    defectLibrary: errors,
    addDefectTab,
    editDefectTab,
    deleteDefectTab,
    addDefectError,
    editDefectError,
    deleteDefectError,
    userRole,
    enableLazy
  } = useContext(DocumentContext);

  const confirm = useConfirm();
  const [viewMode, setViewMode] = useState('grid');
  
  // Tab Management
  const [activeTabId, setActiveTabId] = useState(null);

  // Filters
  const [filters, setFilters] = useState({ keyword: '', severity: '' });
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingError, setEditingError] = useState(null);

  useEffect(() => {
    enableLazy();
  }, [enableLazy]);

  useEffect(() => {
    if (tabs.length > 0 && !activeTabId) {
      setActiveTabId(tabs[0].id);
    }
  }, [tabs, activeTabId]);

  const isAdmin = userRole === ROLES.ADMIN;

  const getPrefix = (tabName) => {
    if (!tabName) return 'ERR';
    const words = tabName.split(' ');
    if (words.length === 1) return words[0].substring(0, 2).toUpperCase();
    return words.map(w => w[0]).join('').toUpperCase();
  };

  const generateNewCode = (tabId) => {
    const tab = tabs.find(t => t.id === tabId);
    const prefix = tab ? getPrefix(tab.name) : 'ERR';
    const tabErrors = errors.filter(e => e.tabId === tabId);
    
    let maxNum = 0;
    tabErrors.forEach(e => {
      const parts = e.code.split('-');
      if (parts.length > 0) {
        const numPart = parts[parts.length - 1];
        const num = parseInt(numPart, 10);
        if (!isNaN(num) && num > maxNum) {
          maxNum = num;
        }
      }
    });
    return `L-${prefix}-${String(maxNum + 1).padStart(2, '0')}`;
  };

  const handleAddTab = async () => {
    if (!isAdmin) return;
    const name = window.prompt("Nhập tên thẻ lỗi mới:");
    if (name && name.trim() !== "") {
      const newId = await addDefectTab(name);
      setActiveTabId(newId);
    }
  };

  const handleEditTab = async (id, oldName) => {
    if (!isAdmin) return;
    const newName = window.prompt("Sửa tên thẻ:", oldName);
    if (newName && newName.trim() !== "") {
      await editDefectTab(id, newName);
    }
  };

  const handleDeleteTab = async (id) => {
    if (!isAdmin) return;
    const ok = await confirm('Bạn có chắc muốn xóa thẻ này? Mọi lỗi trong thẻ sẽ không hiển thị nữa.');
    if (ok) {
      await deleteDefectTab(id);
      const remainingTabs = tabs.filter(t => t.id !== id);
      if (remainingTabs.length > 0) {
        setActiveTabId(remainingTabs[0].id);
      } else {
        setActiveTabId(null);
      }
    }
  };

  const handleSaveError = async (data) => {
    if (!isAdmin) return;
    if (data.id) {
      await editDefectError(data.id, data);
    } else {
      await addDefectError(data);
    }
    setIsFormOpen(false);
    setEditingError(null);
  };

  const handleDeleteError = async (id) => {
    if (!isAdmin) return;
    const ok = await confirm('Bạn có chắc muốn xóa lỗi này?');
    if (ok) {
      await deleteDefectError(id);
    }
  };

  const handleChangeFilter = (e) => {
    const { name, value } = e.target;
    setFilters(prev => ({ ...prev, [name]: value }));
  };

  const filteredErrors = useMemo(() => {
    return errors.filter(err => {
      if (err.tabId !== activeTabId) return false;
      
      if (filters.keyword) {
        const kw = filters.keyword.toLowerCase();
        if (!err.code.toLowerCase().includes(kw) && !err.title.toLowerCase().includes(kw)) return false;
      }
      if (filters.severity && err.severity !== filters.severity) return false;
      
      return true;
    });
  }, [errors, filters, activeTabId]);

  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: '700', color: 'var(--color-text-main)', marginBottom: '0.25rem' }}>
            📖 Thư viện Danh mục lỗi
          </h1>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
            Từ điển lưu trữ và tra cứu các lỗi phổ biến được đúc rút từ kinh nghiệm thực tế
          </p>
        </div>
        
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          {isAdmin && (
            <button 
              onClick={() => { setEditingError(null); setIsFormOpen(true); }}
              className="btn btn-primary" 
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.45rem 1rem' }}
            >
              <Plus size={16} /> Thêm lỗi mới
            </button>
          )}
          
          <div style={{ display: 'flex', gap: '0.25rem', backgroundColor: 'var(--color-bg-surface)', padding: '0.25rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', marginLeft: '0.5rem' }}>
            <button onClick={() => setViewMode('grid')} style={{ padding: '0.375rem', borderRadius: 'var(--radius-sm)', backgroundColor: viewMode === 'grid' ? 'var(--color-bg-surface-hover)' : 'transparent', color: viewMode === 'grid' ? 'var(--color-primary)' : 'var(--color-text-muted)' }}>
              <LayoutGrid size={18} />
            </button>
            <button onClick={() => setViewMode('list')} style={{ padding: '0.375rem', borderRadius: 'var(--radius-sm)', backgroundColor: viewMode === 'list' ? 'var(--color-bg-surface-hover)' : 'transparent', color: viewMode === 'list' ? 'var(--color-primary)' : 'var(--color-text-muted)' }}>
              <List size={18} />
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', borderBottom: '2px solid var(--color-border)', marginBottom: '1.5rem', overflowX: 'auto' }}>
        {tabs.map(tab => (
          <div key={tab.id} style={{ display: 'flex', alignItems: 'center', padding: '0.75rem 1.25rem', cursor: 'pointer', borderBottom: activeTabId === tab.id ? '2px solid var(--color-primary)' : '2px solid transparent', color: activeTabId === tab.id ? 'var(--color-primary)' : 'var(--color-text-muted)', fontWeight: activeTabId === tab.id ? '600' : '500', transition: 'all 0.2s', marginBottom: '-2px', backgroundColor: activeTabId === tab.id ? 'rgba(59, 130, 246, 0.05)' : 'transparent', borderTopLeftRadius: '6px', borderTopRightRadius: '6px' }}>
            <span onClick={() => setActiveTabId(tab.id)}>{tab.name}</span>
            {isAdmin && activeTabId === tab.id && (
              <div style={{ display: 'flex', alignItems: 'center', marginLeft: '8px', gap: '4px' }}>
                <button onClick={(e) => { e.stopPropagation(); handleEditTab(tab.id, tab.name); }} style={{ background: 'none', border: 'none', padding: '2px', cursor: 'pointer', color: 'var(--color-primary)', display: 'flex' }} title="Sửa tên thẻ"><Edit size={12} /></button>
                <button onClick={(e) => { e.stopPropagation(); handleDeleteTab(tab.id); }} style={{ background: 'none', border: 'none', padding: '2px', cursor: 'pointer', color: 'var(--color-danger)', display: 'flex' }} title="Xóa thẻ"><Trash2 size={12} /></button>
              </div>
            )}
          </div>
        ))}
        {isAdmin && (
          <button onClick={handleAddTab} style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '0.5rem 1rem', background: 'none', border: '1px dashed var(--color-border)', borderRadius: '6px', color: 'var(--color-text-muted)', cursor: 'pointer', marginLeft: '8px', fontSize: '0.85rem' }}>
            <Plus size={16} /> Thêm thẻ
          </button>
        )}
      </div>

      {/* Filter Panel (Customized for Errors) */}
      <div className="card" style={{ padding: '1.25rem', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem' }}>
          <div className="form-group" style={{ marginBottom: 0, flex: '1 1 300px' }}>
            <label className="form-label" style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Từ khóa (Mã, Tên lỗi)</label>
            <input type="text" name="keyword" value={filters.keyword} onChange={handleChangeFilter} className="input-field" placeholder="Nhập từ khóa..." />
          </div>
          <div className="form-group" style={{ marginBottom: 0, flex: '1 1 200px' }}>
            <label className="form-label" style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Mức độ nghiêm trọng</label>
            <select name="severity" value={filters.severity} onChange={handleChangeFilter} className="input-field">
              <option value="">Tất cả mức độ</option>
              <option value="Thấp">Thấp</option>
              <option value="Trung bình">Trung bình</option>
              <option value="Cao">Cao</option>
              <option value="Nghiêm trọng">Nghiêm trọng</option>
            </select>
          </div>
        </div>
      </div>

      {/* Error List */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {filteredErrors.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '4rem 2rem', backgroundColor: 'var(--color-bg-surface)', borderRadius: 'var(--radius-lg)', border: '1px dashed var(--color-border)' }}>
            <AlertTriangle size={48} color="var(--color-text-muted)" style={{ opacity: 0.5, marginBottom: '1rem' }} />
            <p style={{ color: 'var(--color-text-muted)', fontSize: '1rem' }}>Không có lỗi nào trong thẻ này thỏa mãn bộ lọc.</p>
          </div>
        ) : (
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: viewMode === 'grid' ? 'repeat(auto-fill, minmax(320px, 1fr))' : '1fr', 
            gap: '1.5rem',
            paddingBottom: '2rem'
          }}>
            {filteredErrors.map(err => (
              <ErrorCard 
                key={err.id} 
                error={err} 
                viewMode={viewMode} 
                isAdmin={isAdmin}
                onEdit={(e) => { setEditingError(e); setIsFormOpen(true); }}
                onDelete={handleDeleteError}
              />
            ))}
          </div>
        )}
      </div>

      {isFormOpen && (
        <ErrorForm 
          initialData={editingError}
          generatedCode={generateNewCode(activeTabId)}
          activeTabId={activeTabId}
          onSubmit={handleSaveError} 
          onCancel={() => { setIsFormOpen(false); setEditingError(null); }} 
        />
      )}
    </div>
  );
};

export default DanhMucLoi;
