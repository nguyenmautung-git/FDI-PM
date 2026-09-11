import React, { useState, useContext, useEffect, useMemo } from 'react';
import { DocumentContext } from '../context/DocumentContext';
import { useConfirm, useToast } from '../context/UIContext';
import { 
  ShieldAlert, HardHat, AlertTriangle, CheckCircle2, Clock, 
  Plus, Search, Edit2, Trash2, X, Calendar, MapPin, Building2, User
} from 'lucide-react';
import { format } from 'date-fns';

const SEVERITY_CONFIG = {
  'Nghiêm trọng': { color: '#ef4444', bg: 'rgba(239, 68, 68, 0.15)', border: 'rgba(239, 68, 68, 0.3)' },
  'Cao': { color: '#f97316', bg: 'rgba(249, 115, 22, 0.15)', border: 'rgba(249, 115, 22, 0.3)' },
  'Trung bình': { color: '#eab308', bg: 'rgba(234, 179, 8, 0.15)', border: 'rgba(234, 179, 8, 0.3)' },
  'Thấp': { color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.15)', border: 'rgba(59, 130, 246, 0.3)' },
};

const STATUS_CONFIG = {
  'open': { label: 'Chưa giải quyết', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.15)', icon: AlertTriangle },
  'in_progress': { label: 'Đang khắc phục', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.15)', icon: Clock },
  'resolved': { label: 'Đã giải quyết', color: '#10b981', bg: 'rgba(16, 185, 129, 0.15)', icon: CheckCircle2 },
};

const Atld = () => {
  const { atldIssues = [], addAtldIssue, updateAtldIssue, deleteAtldIssue, projects = [], enableLazy } = useContext(DocumentContext);
  const confirm = useConfirm();
  const toast = useToast();

  useEffect(() => {
    if (enableLazy) enableLazy();
  }, [enableLazy]);

  const [selectedProject, setSelectedProject] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingIssue, setEditingIssue] = useState(null);

  const [formData, setFormData] = useState({
    title: '',
    project: '',
    projectId: '',
    category: 'ATLĐ',
    severity: 'Cao',
    status: 'open',
    location: '',
    deadline: '',
    reportedDate: format(new Date(), 'yyyy-MM-dd'),
    assignedTo: '',
    description: ''
  });

  const handleOpenAdd = () => {
    setEditingIssue(null);
    setFormData({
      title: '',
      project: projects[0]?.name || 'Dự án Toà nhà CNS-1',
      projectId: projects[0]?.id || 1,
      category: 'ATLĐ',
      severity: 'Cao',
      status: 'open',
      location: '',
      deadline: '',
      reportedDate: format(new Date(), 'yyyy-MM-dd'),
      assignedTo: '',
      description: ''
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (issue) => {
    setEditingIssue(issue);
    setFormData({
      title: issue.title || '',
      project: issue.project || '',
      projectId: issue.projectId || '',
      category: issue.category || 'ATLĐ',
      severity: issue.severity || 'Trung bình',
      status: issue.status || 'open',
      location: issue.location || '',
      deadline: issue.deadline || '',
      reportedDate: issue.reportedDate || format(new Date(), 'yyyy-MM-dd'),
      assignedTo: issue.assignedTo || '',
      description: issue.description || ''
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.title.trim()) {
      alert('Vui lòng nhập tiêu đề vấn đề');
      return;
    }
    try {
      if (editingIssue) {
        await updateAtldIssue(editingIssue.id, formData);
        if (toast?.success) toast.success('Đã cập nhật thành công!');
      } else {
        await addAtldIssue(formData);
        if (toast?.success) toast.success('Đã thêm mới thành công!');
      }
      setIsModalOpen(false);
    } catch (err) {
      console.error(err);
      alert('Có lỗi xảy ra: ' + err.message);
    }
  };

  const handleDelete = async (id) => {
    const ok = await confirm('Bạn có chắc chắn muốn xóa bản ghi này?');
    if (!ok) return;
    try {
      await deleteAtldIssue(id);
      if (toast?.success) toast.success('Đã xóa thành công!');
    } catch (err) {
      console.error(err);
      alert('Lỗi khi xóa: ' + err.message);
    }
  };

  const handleQuickResolve = async (issue) => {
    const newStatus = issue.status === 'resolved' ? 'open' : 'resolved';
    try {
      await updateAtldIssue(issue.id, { status: newStatus });
      if (toast?.success) {
        toast.success(newStatus === 'resolved' ? 'Đã đánh dấu giải quyết!' : 'Đã mở lại vấn đề');
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Filtered issues
  const filteredIssues = useMemo(() => {
    return atldIssues.filter(item => {
      const matchProject = selectedProject === 'all' || item.project === selectedProject || item.projectId?.toString() === selectedProject;
      const matchStatus = selectedStatus === 'all' || item.status === selectedStatus;
      const matchCategory = selectedCategory === 'all' || item.category === selectedCategory;
      const matchSearch = !searchTerm || 
        (item.title && item.title.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (item.description && item.description.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (item.location && item.location.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (item.assignedTo && item.assignedTo.toLowerCase().includes(searchTerm.toLowerCase()));
      return matchProject && matchStatus && matchCategory && matchSearch;
    });
  }, [atldIssues, selectedProject, selectedStatus, selectedCategory, searchTerm]);

  // Metrics
  const metrics = useMemo(() => {
    const total = atldIssues.length;
    const open = atldIssues.filter(i => i.status === 'open').length;
    const inProgress = atldIssues.filter(i => i.status === 'in_progress').length;
    const resolved = atldIssues.filter(i => i.status === 'resolved').length;
    const severeOpen = atldIssues.filter(i => (i.severity === 'Nghiêm trọng' || i.severity === 'Cao') && i.status !== 'resolved').length;
    return { total, open, inProgress, resolved, severeOpen };
  }, [atldIssues]);

  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', height: '100%', overflowY: 'auto', paddingRight: '0.5rem', paddingBottom: '2rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: '800', color: 'var(--color-text-main)', marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <HardHat size={28} color="#f59e0b" />
            An toàn Lao động & Vệ sinh Môi trường (ATLĐ & VSMT)
          </h1>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem', margin: 0 }}>
            Quản lý, giám sát các vi phạm an toàn, vệ sinh môi trường công trường và theo dõi tiến độ khắc phục.
          </p>
        </div>
        <button className="btn btn-primary" onClick={handleOpenAdd} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.6rem 1.25rem' }}>
          <Plus size={18} /> Ghi nhận vi phạm / Tồn tại
        </button>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
        <div className="card" style={{ padding: '1.25rem', borderLeft: '4px solid #ef4444' }}>
          <div style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem', fontWeight: '600' }}>CHƯA GIẢI QUYẾT</div>
          <div style={{ fontSize: '1.75rem', fontWeight: '800', color: '#ef4444', marginTop: '4px' }}>{metrics.open}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '4px' }}>{metrics.severeOpen} vấn đề mức độ cao/nghiêm trọng</div>
        </div>
        <div className="card" style={{ padding: '1.25rem', borderLeft: '4px solid #f59e0b' }}>
          <div style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem', fontWeight: '600' }}>ĐANG KHẮC PHỤC</div>
          <div style={{ fontSize: '1.75rem', fontWeight: '800', color: '#f59e0b', marginTop: '4px' }}>{metrics.inProgress}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '4px' }}>Đang triển khai xử lý tại hiện trường</div>
        </div>
        <div className="card" style={{ padding: '1.25rem', borderLeft: '4px solid #10b981' }}>
          <div style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem', fontWeight: '600' }}>ĐÃ GIẢI QUYẾT</div>
          <div style={{ fontSize: '1.75rem', fontWeight: '800', color: '#10b981', marginTop: '4px' }}>{metrics.resolved}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '4px' }}>Đã hoàn tất nghiệm thu khắc phục</div>
        </div>
        <div className="card" style={{ padding: '1.25rem', borderLeft: '4px solid #3b82f6' }}>
          <div style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem', fontWeight: '600' }}>TỔNG VẤN ĐỀ</div>
          <div style={{ fontSize: '1.75rem', fontWeight: '800', color: 'var(--color-text-main)', marginTop: '4px' }}>{metrics.total}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '4px' }}>Tất cả các đợt kiểm tra ATLĐ & VSMT</div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="card" style={{ padding: '1rem', display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', backgroundColor: 'var(--color-bg-surface-hover)', borderRadius: '8px', padding: '0.4rem 0.8rem', flex: '1 1 250px' }}>
          <Search size={16} color="var(--color-text-muted)" />
          <input 
            type="text" 
            placeholder="Tìm kiếm theo tiêu đề, vị trí, người phụ trách..." 
            value={searchTerm} 
            onChange={e => setSearchTerm(e.target.value)}
            style={{ background: 'none', border: 'none', color: 'var(--color-text-main)', width: '100%', outline: 'none', fontSize: '0.85rem' }}
          />
          {searchTerm && <X size={14} style={{ cursor: 'pointer', color: 'var(--color-text-muted)' }} onClick={() => setSearchTerm('')} />}
        </div>

        <select 
          value={selectedProject} 
          onChange={e => setSelectedProject(e.target.value)}
          className="input-field" 
          style={{ width: 'auto', minWidth: '180px', margin: 0, padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}
        >
          <option value="all">Tất cả dự án</option>
          {projects.map(p => (
            <option key={p.id} value={p.name}>{p.name}</option>
          ))}
        </select>

        <select 
          value={selectedCategory} 
          onChange={e => setSelectedCategory(e.target.value)}
          className="input-field" 
          style={{ width: 'auto', margin: 0, padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}
        >
          <option value="all">Tất cả danh mục</option>
          <option value="ATLĐ">An toàn lao động (ATLĐ)</option>
          <option value="VSMT">Vệ sinh môi trường (VSMT)</option>
          <option value="PCCC">PCCC công trường</option>
        </select>

        <select 
          value={selectedStatus} 
          onChange={e => setSelectedStatus(e.target.value)}
          className="input-field" 
          style={{ width: 'auto', margin: 0, padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}
        >
          <option value="all">Tất cả trạng thái</option>
          <option value="open">Chưa giải quyết</option>
          <option value="in_progress">Đang khắc phục</option>
          <option value="resolved">Đã giải quyết</option>
        </select>
      </div>

      {/* Issues List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
        {filteredIssues.length === 0 ? (
          <div className="card" style={{ padding: '3rem 1rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>
            <ShieldAlert size={48} style={{ opacity: 0.3, margin: '0 auto 1rem' }} />
            <p style={{ fontSize: '1rem', margin: 0 }}>Không có vấn đề vi phạm nào phù hợp với bộ lọc.</p>
          </div>
        ) : (
          filteredIssues.map(issue => {
            const sev = SEVERITY_CONFIG[issue.severity] || SEVERITY_CONFIG['Trung bình'];
            const st = STATUS_CONFIG[issue.status] || STATUS_CONFIG['open'];
            const StatusIcon = st.icon;

            return (
              <div 
                key={issue.id} 
                className="card" 
                style={{ 
                  padding: '1.25rem', 
                  display: 'flex', 
                  flexDirection: 'column', 
                  gap: '0.75rem',
                  borderLeft: `4px solid ${st.color}`,
                  transition: 'all 0.2s',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', flexWrap: 'wrap' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.35rem' }}>
                      <span style={{ 
                        fontSize: '0.75rem', fontWeight: '700', padding: '2px 8px', borderRadius: '4px',
                        backgroundColor: issue.category === 'ATLĐ' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                        color: issue.category === 'ATLĐ' ? '#f87171' : '#34d399',
                        border: `1px solid ${issue.category === 'ATLĐ' ? 'rgba(239, 68, 68, 0.3)' : 'rgba(16, 185, 129, 0.3)'}`
                      }}>
                        {issue.category || 'ATLĐ'}
                      </span>
                      <span style={{ fontSize: '0.75rem', fontWeight: '600', padding: '2px 8px', borderRadius: '4px', backgroundColor: sev.bg, color: sev.color, border: `1px solid ${sev.border}` }}>
                        Mức độ: {issue.severity || 'Trung bình'}
                      </span>
                      <span style={{ fontSize: '0.75rem', fontWeight: '600', padding: '2px 8px', borderRadius: '4px', backgroundColor: st.bg, color: st.color, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <StatusIcon size={12} /> {st.label}
                      </span>
                      {issue.project && (
                        <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          <Building2 size={13} /> {issue.project}
                        </span>
                      )}
                    </div>
                    <h3 style={{ fontSize: '1.05rem', fontWeight: '700', color: 'var(--color-text-main)', margin: '0 0 0.35rem 0', lineHeight: '1.4' }}>
                      {issue.title}
                    </h3>
                    {issue.description && (
                      <p style={{ margin: 0, color: 'var(--color-text-muted)', fontSize: '0.85rem', lineHeight: '1.5' }}>
                        {issue.description}
                      </p>
                    )}
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
                    <button 
                      onClick={() => handleQuickResolve(issue)} 
                      className="btn" 
                      style={{ 
                        padding: '5px 12px', fontSize: '0.78rem', display: 'inline-flex', alignItems: 'center', gap: '4px',
                        backgroundColor: issue.status === 'resolved' ? 'rgba(255,255,255,0.06)' : 'rgba(16, 185, 129, 0.15)',
                        color: issue.status === 'resolved' ? 'var(--color-text-muted)' : '#10b981',
                        border: '1px solid currentColor'
                      }}
                    >
                      <CheckCircle2 size={13} />
                      {issue.status === 'resolved' ? 'Mở lại' : 'Đã xử lý xong'}
                    </button>
                    <button onClick={() => handleOpenEdit(issue)} className="btn-icon" title="Chỉnh sửa" style={{ color: 'var(--color-primary)' }}>
                      <Edit2 size={15} />
                    </button>
                    <button onClick={() => handleDelete(issue.id)} className="btn-icon" title="Xóa" style={{ color: 'var(--color-danger)' }}>
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>

                {/* Sub details */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.25rem', paddingTop: '0.5rem', borderTop: '1px solid rgba(255,255,255,0.05)', fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                  {issue.location && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <MapPin size={13} color="var(--color-primary)" />
                      <span>Vị trí: <strong style={{ color: 'var(--color-text-main)' }}>{issue.location}</strong></span>
                    </div>
                  )}
                  {issue.deadline && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Calendar size={13} color="#f59e0b" />
                      <span>Hạn xử lý: <strong style={{ color: '#f59e0b' }}>{issue.deadline}</strong></span>
                    </div>
                  )}
                  {issue.assignedTo && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <User size={13} color="#8b5cf6" />
                      <span>Phụ trách: <strong style={{ color: 'var(--color-text-main)' }}>{issue.assignedTo}</strong></span>
                    </div>
                  )}
                  {issue.reportedDate && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginLeft: 'auto' }}>
                      <span>Ghi nhận: {issue.reportedDate}</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Add / Edit Modal */}
      {isModalOpen && (
        <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '560px', padding: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', paddingBottom: '0.75rem', borderBottom: '1px solid var(--color-border)' }}>
              <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <HardHat size={20} color="#f59e0b" />
                {editingIssue ? 'Chỉnh sửa vấn đề ATLĐ & VSMT' : 'Ghi nhận vấn đề ATLĐ & VSMT mới'}
              </h3>
              <button className="btn-icon" onClick={() => setIsModalOpen(false)}><X size={18} /></button>
            </div>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Tiêu đề vấn đề / Vi phạm <span style={{ color: 'var(--color-danger)' }}>*</span></label>
                <input 
                  type="text" 
                  className="input-field" 
                  required 
                  placeholder="VD: Chưa che chắn hố móng tầng hầm B1..."
                  value={formData.title} 
                  onChange={e => setFormData({ ...formData, title: e.target.value })} 
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Dự án</label>
                  <select 
                    className="input-field"
                    value={formData.project}
                    onChange={e => {
                      const p = projects.find(pr => pr.name === e.target.value);
                      setFormData({ ...formData, project: e.target.value, projectId: p?.id || '' });
                    }}
                  >
                    {projects.map(p => (
                      <option key={p.id} value={p.name}>{p.name}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Phân loại</label>
                  <select 
                    className="input-field"
                    value={formData.category}
                    onChange={e => setFormData({ ...formData, category: e.target.value })}
                  >
                    <option value="ATLĐ">An toàn lao động (ATLĐ)</option>
                    <option value="VSMT">Vệ sinh môi trường (VSMT)</option>
                    <option value="PCCC">PCCC</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Mức độ nghiêm trọng</label>
                  <select 
                    className="input-field"
                    value={formData.severity}
                    onChange={e => setFormData({ ...formData, severity: e.target.value })}
                  >
                    <option value="Nghiêm trọng">🔴 Nghiêm trọng</option>
                    <option value="Cao">🟠 Cao</option>
                    <option value="Trung bình">🟡 Trung bình</option>
                    <option value="Thấp">🔵 Thấp</option>
                  </select>
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Trạng thái xử lý</label>
                  <select 
                    className="input-field"
                    value={formData.status}
                    onChange={e => setFormData({ ...formData, status: e.target.value })}
                  >
                    <option value="open">Chưa giải quyết</option>
                    <option value="in_progress">Đang khắc phục</option>
                    <option value="resolved">Đã giải quyết</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Vị trí phát sinh</label>
                  <input 
                    type="text" 
                    className="input-field" 
                    placeholder="VD: Tầng hầm B1, Trục 1-3..."
                    value={formData.location} 
                    onChange={e => setFormData({ ...formData, location: e.target.value })} 
                  />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Hạn khắc phục</label>
                  <input 
                    type="date" 
                    className="input-field" 
                    value={formData.deadline} 
                    onChange={e => setFormData({ ...formData, deadline: e.target.value })} 
                  />
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Đơn vị / Người chịu trách nhiệm</label>
                <input 
                  type="text" 
                  className="input-field" 
                  placeholder="VD: Coteccons - Ban An toàn..."
                  value={formData.assignedTo} 
                  onChange={e => setFormData({ ...formData, assignedTo: e.target.value })} 
                />
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Mô tả chi tiết vi phạm & Yêu cầu khắc phục</label>
                <textarea 
                  rows={3} 
                  className="input-field" 
                  placeholder="Ghi chú cụ thể hiện trạng, nguy cơ tiềm ẩn và biện pháp xử lý..."
                  value={formData.description} 
                  onChange={e => setFormData({ ...formData, description: e.target.value })} 
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem', paddingTop: '1rem', borderTop: '1px solid var(--color-border)' }}>
                <button type="button" className="btn" onClick={() => setIsModalOpen(false)}>Hủy</button>
                <button type="submit" className="btn btn-primary">Lưu thông tin</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Atld;
