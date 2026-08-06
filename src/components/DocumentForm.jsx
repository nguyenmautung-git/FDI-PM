import React, { useState, useContext, useEffect } from 'react';
import { format } from 'date-fns';
import { X, Upload, Check, ChevronDown, Plus } from 'lucide-react';
import { DocumentContext } from '../context/DocumentContext';
import { useToast } from '../context/UIContext';
import { EMPLOYEE_LEVELS } from '../data';
import { v4 as uuidv4 } from 'uuid';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../firebase';
import { validateFileSize } from '../utils/uploadHelpers';

const DocumentForm = ({ onClose, initialData, previewMode = false }) => {
  const { addDocument, editDocument, allDocuments: documents, documentTypes, allProjects: projects, legalSteps = [], checkPermission, enableLazy, uniqueAgencies = [], addPartner } = useContext(DocumentContext);
  const toast = useToast();

  useEffect(() => {
    if (enableLazy) enableLazy();
  }, [enableLazy]);

  // Tự động tạo mã tài liệu theo ngày mới nhất và reset số thứ tự
  const today = new Date();
  const dateStr = format(today, 'dd.MM.yyyy');
  
  const todaysDocs = documents.filter(doc => doc.documentCode && doc.documentCode.startsWith(dateStr));
  let maxSeq = 0;
  todaysDocs.forEach(doc => {
    const parts = doc.documentCode.split('_');
    if (parts.length > 1) {
      const seq = parseInt(parts[1], 10);
      if (!isNaN(seq) && seq > maxSeq) {
        maxSeq = seq;
      }
    }
  });
  
  const seqNumber = String(maxSeq + 1).padStart(3, '0');
  const autoCode = `${dateStr}_${seqNumber}`;

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [isDragging, setIsDragging]     = useState(false);
  const [showAgencyDropdown, setShowAgencyDropdown] = useState(false);
  const [showAddPartnerModal, setShowAddPartnerModal] = useState(false);
  const [newPartnerData, setNewPartnerData] = useState({
    name: '',
    shortName: '',
    taxCode: '',
    type: 'Cơ quan ban hành',
    representative: '',
    phone: '',
    email: '',
    website: '',
    address: '',
    bankAccount: '',
    bankName: '',
    rating: 5,
    logo: 'https://images.unsplash.com/photo-1560179707-f14e90ef3623?w=150&h=150&fit=crop',
    attachments: [],
    locked: false
  });
  
  const [formData, setFormData] = useState(initialData || {
    documentCode: autoCode,
    documentNumber: '',
    documentType: '',
    issuingAgency: '',
    effectiveDate: '',
    summary: '',
    keywords: '',
    relatedProjects: [],
    accessLevels: [],
    attachmentLink: '',
    quickViewImage: 'https://images.unsplash.com/photo-1568225367111-44052445b410?q=80&w=600&auto=format&fit=crop',
    attachments: [],
    legalStepId: ''
  });
  
  const isEdit = !!(initialData && initialData.id);
  const permissionKey = isEdit ? 'edit_docs' : 'add_docs';
  const visibleProjects = projects.filter(p => 
    previewMode || 
    checkPermission(p.id, permissionKey) || 
    formData.relatedProjects.includes(p.name)
  );

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleProjectToggle = (project) => {
    setFormData(prev => {
      const projects = [...prev.relatedProjects];
      if (projects.includes(project)) {
        return { ...prev, relatedProjects: projects.filter(p => p !== project) };
      } else {
        projects.push(project);
        return { ...prev, relatedProjects: projects };
      }
    });
  };

  const handleAccessLevelToggle = (levelId) => {
    setFormData(prev => {
      let levels = [...prev.accessLevels];
      if (levels.includes(levelId)) {
        levels = levels.filter(l => l !== levelId);
      } else {
        levels.push(levelId);
        EMPLOYEE_LEVELS.forEach(lvl => {
          if (lvl.id > levelId && !levels.includes(lvl.id)) {
            levels.push(lvl.id);
          }
        });
      }
      return { ...prev, accessLevels: levels };
    });
  };

  const removeOldAttachment = (indexToRemove) => {
    setFormData(prev => ({
      ...prev,
      attachments: (prev.attachments || []).filter((_, index) => index !== indexToRemove)
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    const hasOldAttachments = formData.attachments && formData.attachments.length > 0;
    if (selectedFiles.length === 0 && !formData.attachmentLink && !hasOldAttachments) {
      toast.warning('Vui lòng chọn file đính kèm!');
      return;
    }

    setIsSubmitting(true);
    
    try {
      let attachmentsData = formData.attachments || [];
      
      // Hỗ trợ lưu link đơn cho tương thích ngược nếu nhập tay (mặc dù hiện tại đã đổi sang form file)
      if (formData.attachmentLink && !initialData) {
        attachmentsData.push({ name: 'Link liên kết', url: formData.attachmentLink });
      }

      // Upload tất cả các file đã chọn lên Firebase Storage
      if (selectedFiles.length > 0) {
        const { valid, errors } = validateFileSize(selectedFiles);
        if (errors.length) {
          toast.error(`File quá lớn (tối đa 50MB): ${errors.join('; ')}`);
          if (!valid.length) { setIsSubmitting(false); return; }
        }

        const withTimeout = (promise, ms) =>
          Promise.race([
            promise,
            new Promise((_, reject) =>
              setTimeout(() => reject(new Error('TIMEOUT')), ms)
            ),
          ]);

        const uploadedFiles = await Promise.all(
          valid.map(async (file) => {
            const storageRef = ref(storage, `documents/${Date.now()}_${file.name}`);
            const snapshot = await withTimeout(uploadBytes(storageRef, file), 20000);
            const url = await getDownloadURL(snapshot.ref);
            return { name: file.name, url };
          })
        );
        
        attachmentsData = [...attachmentsData, ...uploadedFiles];
      }

      const newDoc = {
        ...formData,
        attachments: attachmentsData, // Lưu dưới dạng mảng
        uploader: initialData ? initialData.uploader : 'Quản Trị Viên',
        createdAt: initialData ? initialData.createdAt : new Date().toISOString(),
        isNew: initialData ? initialData.isNew : true
      };
      
      // Xóa attachmentLink cũ khỏi db để tránh nhầm lẫn
      delete newDoc.attachmentLink;
      
      if (initialData) {
        await editDocument(initialData.id, newDoc);
      } else {
        newDoc.id = uuidv4();
        await addDocument(newDoc);
      }
      onClose();
    } catch (error) {
      toast.error('Lỗi khi lưu tài liệu: ' + (error.message || 'Vui lòng thử lại!'));
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--color-bg-surface-hover)', borderTopLeftRadius: 'var(--radius-lg)', borderTopRightRadius: 'var(--radius-lg)' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: '700', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Upload size={20} color="var(--color-primary)" />
            {previewMode ? 'Xem thông tin tài liệu' : (initialData ? 'Sửa thông tin tài liệu' : 'Tải lên tài liệu mới')}
          </h2>
          <button className="btn-icon" onClick={onClose}><X size={20} /></button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: '1.5rem', overflowY: 'auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="form-group">
              <label className="form-label">Mã lưu tài liệu (Tự động)</label>
              <input readOnly type="text" name="documentCode" value={formData.documentCode} className="input-field" style={{ backgroundColor: 'var(--color-bg-surface-hover)', color: 'var(--color-text-muted)' }} />
            </div>
            <div className="form-group">
              <label className="form-label">Số tài liệu, văn bản {(!previewMode) && <span style={{ color: 'var(--color-danger)' }}>*</span>}</label>
              <input disabled={previewMode} required type="text" name="documentNumber" value={formData.documentNumber} onChange={handleChange} className="input-field" placeholder="VD: 125/QĐ-BXD" />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="form-group">
              <label className="form-label">Phân loại tài liệu {(!previewMode) && <span style={{ color: 'var(--color-danger)' }}>*</span>}</label>
              <select disabled={previewMode} required name="documentType" value={formData.documentType} onChange={handleChange} className="input-field">
                <option value="">-- Chọn phân loại --</option>
                {documentTypes.map(t => <option key={t.id} value={t.name}>{t.name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Cơ quan ban hành {(!previewMode) && <span style={{ color: 'var(--color-danger)' }}>*</span>}</label>
              <div style={{ position: 'relative' }}>
                <input 
                  disabled={previewMode} 
                  required 
                  name="issuingAgency" 
                  value={formData.issuingAgency} 
                  onChange={handleChange} 
                  onFocus={() => setShowAgencyDropdown(true)}
                  onBlur={() => setShowAgencyDropdown(false)}
                  className="input-field" 
                  placeholder="Chọn hoặc nhập mới" 
                  style={{ paddingRight: !previewMode ? '2rem' : undefined }}
                  autoComplete="off"
                />
                {!previewMode && (
                  <button 
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      setShowAgencyDropdown(!showAgencyDropdown);
                    }}
                    style={{ position: 'absolute', right: '0.5rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', padding: '4px' }}
                  >
                    <ChevronDown size={18} />
                  </button>
                )}
                {showAgencyDropdown && !previewMode && (
                  <div 
                    className="custom-scrollbar"
                    style={{ 
                      position: 'absolute', 
                      top: '100%', 
                      left: 0, 
                      right: 0, 
                      backgroundColor: '#1e293b', 
                      border: '1px solid var(--color-border)', 
                      borderRadius: 'var(--radius-md)', 
                      marginTop: '4px', 
                      maxHeight: '220px', 
                      overflowY: 'auto', 
                      zIndex: 9999, 
                      boxShadow: '0 10px 25px rgba(0, 0, 0, 0.6)' 
                    }}
                  >
                    {/* ── 1. LUÔN CÓ DÒNG TẠO ĐỐI TÁC MỚI Ở ĐẦU DANH SÁCH ─────────────────── */}
                    <div 
                      onMouseDown={(e) => {
                        e.preventDefault();
                        const agencyVal = (formData.issuingAgency || '').trim();
                        setNewPartnerData({
                          name: agencyVal,
                          shortName: '',
                          taxCode: '',
                          type: 'Cơ quan ban hành',
                          representative: '',
                          phone: '',
                          email: '',
                          website: '',
                          address: '',
                          bankAccount: '',
                          bankName: '',
                          rating: 5,
                          logo: 'https://images.unsplash.com/photo-1560179707-f14e90ef3623?w=150&h=150&fit=crop',
                          attachments: [],
                          locked: false
                        });
                        setShowAddPartnerModal(true);
                        setShowAgencyDropdown(false);
                      }}
                      style={{ 
                        padding: '0.65rem 1rem', 
                        cursor: 'pointer', 
                        borderBottom: '1px solid rgba(255,255,255,0.15)', 
                        backgroundColor: 'rgba(59, 130, 246, 0.15)', 
                        color: '#60a5fa',
                        fontWeight: '600',
                        fontSize: '0.875rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem'
                      }}
                      onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'rgba(59, 130, 246, 0.28)'}
                      onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'rgba(59, 130, 246, 0.15)'}
                    >
                      <Plus size={16} style={{ color: '#60a5fa', flexShrink: 0 }} />
                      <span>
                        {formData.issuingAgency && formData.issuingAgency.trim()
                          ? `➕ Tạo đối tác mới: "${formData.issuingAgency.trim()}"`
                          : '➕ Tạo đối tác mới...'}
                      </span>
                    </div>

                    {/* ── 2. DANH SÁCH ĐỐI TÁC LỌC THEO TỪ KHÓA TỪ Ô NHẬP ─────────────────── */}
                    {uniqueAgencies
                      .filter(agency => {
                        const kw = (formData.issuingAgency || '').trim().toLowerCase();
                        if (!kw) return true;
                        return (agency || '').toLowerCase().includes(kw);
                      })
                      .map((agency, idx, arr) => (
                        <div 
                          key={idx}
                          onMouseDown={(e) => {
                            e.preventDefault();
                            setFormData(prev => ({ ...prev, issuingAgency: agency }));
                            setShowAgencyDropdown(false);
                          }}
                          style={{ 
                            padding: '0.6rem 1rem', 
                            cursor: 'pointer', 
                            borderBottom: idx < arr.length - 1 ? '1px solid rgba(255, 255, 255, 0.05)' : 'none', 
                            color: 'var(--color-text-main)',
                            fontSize: '0.875rem'
                          }}
                          onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'rgba(59, 130, 246, 0.15)'}
                          onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                        >
                          {agency}
                        </div>
                      ))
                    }
                  </div>
                )}
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', alignItems: 'start' }}>
            <div className="form-group" style={{ position: 'relative', marginBottom: 0 }}>
              <label className="form-label">Ngày hiệu lực {(!previewMode) && <span style={{ color: 'var(--color-danger)' }}>*</span>}</label>
              <input
                disabled={previewMode}
                required
                type="date"
                name="effectiveDate"
                className="input-field"
                value={formData.effectiveDate}
                onChange={handleChange}
              />
            </div>

            {/* Bước pháp lý */}
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Bước pháp lý liên quan</label>
              <select
                disabled={previewMode}
                name="legalStepId"
                value={formData.legalStepId || ''}
                onChange={(e) => {
                  const stepId = e.target.value;
                  setFormData(prev => {
                    const next = { ...prev, legalStepId: stepId };
                    if (stepId) {
                      const step = legalSteps.find(s => s.id === stepId);
                      if (step) {
                        const proj = projects.find(p => p.id === step.projectId || p.id?.toString() === step.projectId);
                        if (proj && !prev.relatedProjects.includes(proj.name)) {
                          next.relatedProjects = [...prev.relatedProjects, proj.name];
                        }
                      }
                    }
                    return next;
                  });
                }}
                className="input-field"
              >
                <option value="">-- Chọn bước pháp lý --</option>
                {/* 1. Nếu đã chọn dự án liên quan -> hiển thị các bước thuộc dự án đó */}
                {(formData.relatedProjects || []).length > 0 ? (
                  projects
                    .filter(p => (formData.relatedProjects || []).includes(p.name))
                    .map(p => {
                      const stepsOfProject = legalSteps
                        .filter(s => s.projectId === p.id || s.projectId === p.id?.toString())
                        .sort((a, b) => (a.order || 0) - (b.order || 0));
                      if (!stepsOfProject.length) return null;
                      return (
                        <optgroup key={p.id} label={`📁 ${p.name}`}>
                          {stepsOfProject.map(s => (
                            <option key={s.id} value={s.id}>
                              {s.order != null ? `${s.order + 1}. ` : ''}{s.name}
                              {s.status === 'done' ? ' ✅' : s.status === 'inprogress' ? ' 🟡' : ' ⚪'}
                            </option>
                          ))}
                        </optgroup>
                      );
                    })
                ) : (
                  /* 2. Nếu chưa chọn dự án -> hiển thị toàn bộ bước pháp lý nhóm theo từng dự án */
                  projects.map(p => {
                    const stepsOfProject = legalSteps
                      .filter(s => s.projectId === p.id || s.projectId === p.id?.toString())
                      .sort((a, b) => (a.order || 0) - (b.order || 0));
                    if (!stepsOfProject.length) return null;
                    return (
                      <optgroup key={p.id} label={`📁 ${p.name}`}>
                        {stepsOfProject.map(s => (
                          <option key={s.id} value={s.id}>
                            {s.order != null ? `${s.order + 1}. ` : ''}{s.name}
                            {s.status === 'done' ? ' ✅' : s.status === 'inprogress' ? ' 🟡' : ' ⚪'}
                          </option>
                        ))}
                      </optgroup>
                    );
                  })
                )}
              </select>
              {formData.legalStepId && (() => {
                const step = legalSteps.find(s => s.id === formData.legalStepId);
                if (!step) return null;
                const statusLabel = step.status === 'done' ? '✅ Hoàn thành' : step.status === 'inprogress' ? '🟡 Đang thực hiện' : '⚪ Chưa thực hiện';
                return (
                  <div style={{ marginTop: '0.4rem', padding: '4px 8px', backgroundColor: '#eff6ff', borderRadius: '6px', fontSize: '0.72rem', color: '#2563eb' }}>
                    📌 {step.name} · {statusLabel}
                  </div>
                );
              })()}
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Trích yếu / Tóm tắt nội dung {(!previewMode) && <span style={{ color: 'var(--color-danger)' }}>*</span>}</label>
            {previewMode ? (
              <div style={{ padding: '0.75rem', backgroundColor: 'var(--color-bg-surface-hover)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', color: 'var(--color-text-main)', lineHeight: '1.5' }}>
                {formData.summary}
              </div>
            ) : (
              <textarea required name="summary" value={formData.summary} onChange={handleChange} className="input-field" rows="3" placeholder="Nhập tóm tắt nội dung tài liệu..."></textarea>
            )}
          </div>

          {/* Keywords — dùng để tìm kiếm toàn văn */}
          <div className="form-group">
            <label className="form-label">Từ khóa tìm kiếm <span style={{ color: 'var(--color-text-muted)', fontWeight: '400', fontSize: '0.8rem' }}>(phân cách bởi dấu phẩy)</span></label>
            {previewMode ? (
              <div style={{ padding: '0.75rem', backgroundColor: 'var(--color-bg-surface-hover)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>
                {formData.keywords || <em>Không có từ khóa</em>}
              </div>
            ) : (
              <input
                type="text"
                name="keywords"
                value={formData.keywords || ''}
                onChange={handleChange}
                className="input-field"
                placeholder="VD: quyết định, phê duyệt, kế hoạch, 2024..."
              />
            )}
          </div>

          <div className="form-group">
            <label className="form-label">Dự án liên quan (Có thể chọn nhiều)</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', padding: '0.5rem', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--color-bg-surface-hover)' }}>
              {visibleProjects.map(p => (
                <button
                  disabled={previewMode}
                  key={p.id}
                  type="button"
                  onClick={() => handleProjectToggle(p.name)}
                  className={`badge ${formData.relatedProjects.includes(p.name) ? 'badge-blue' : ''}`}
                  style={{ 
                    border: formData.relatedProjects.includes(p.name) ? '1px solid var(--color-primary)' : '1px solid var(--color-border)',
                    backgroundColor: formData.relatedProjects.includes(p.name) ? 'rgba(130, 168, 209, 0.15)' : 'white',
                    color: formData.relatedProjects.includes(p.name) ? 'var(--color-primary)' : 'var(--color-text-muted)',
                    cursor: previewMode ? 'default' : 'pointer', padding: '0.375rem 0.75rem'
                  }}
                >
                  {formData.relatedProjects.includes(p.name) && <Check size={12} style={{ marginRight: '4px' }} />}
                  {p.name}
                </button>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Quyền truy cập tài liệu (Tùy chọn: Chọn cấp bậc để giới hạn)</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', padding: '0.5rem', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--color-bg-surface-hover)' }}>
              {EMPLOYEE_LEVELS.map(lvl => (
                <button
                  disabled={previewMode}
                  key={lvl.id}
                  type="button"
                  onClick={() => handleAccessLevelToggle(lvl.id)}
                  title={lvl.fullName}
                  className={`badge ${formData.accessLevels.includes(lvl.id) ? 'badge-yellow' : ''}`}
                  style={{ 
                    border: formData.accessLevels.includes(lvl.id) ? '1px solid #d97706' : '1px solid var(--color-border)',
                    backgroundColor: formData.accessLevels.includes(lvl.id) ? 'rgba(240, 173, 78, 0.15)' : 'white',
                    color: formData.accessLevels.includes(lvl.id) ? '#d97706' : 'var(--color-text-muted)',
                    cursor: previewMode ? 'default' : 'pointer', padding: '0.375rem 0.75rem'
                  }}
                >
                  {formData.accessLevels.includes(lvl.id) && <Check size={12} style={{ marginRight: '4px' }} />}
                  {lvl.shortName}
                </button>
              ))}
            </div>
            {formData.accessLevels.length === 0 && <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '0.25rem', display: 'block' }}>* Để trống: Tất cả mọi người đều có thể xem.</span>}
          </div>

          {!previewMode && (
            <div className="form-group">
              <label className="form-label">Tài liệu đính kèm mới (Tuỳ chọn nếu đã có) <span style={{ color: 'var(--color-danger)' }}>*</span></label>

              {/* ── Drag & Drop Zone ── */}
              <div
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragging(false);
                  const MAX = 20 * 1024 * 1024;
                  const all = Array.from(e.dataTransfer.files);
                  const oversized = all.filter(f => f.size > MAX);
                  if (oversized.length > 0) {
                    toast.warning(`${oversized.length} tệp vượt giới hạn 20MB: ${oversized.map(f => f.name).join(', ')}`);
                  }
                  setSelectedFiles(all.filter(f => f.size <= MAX));
                }}
                onClick={() => document.getElementById('doc-file-input').click()}
                style={{
                  border: `2px dashed ${isDragging ? '#818cf8' : 'var(--color-border)'}`,
                  borderRadius: 'var(--radius-md)',
                  padding: '1.5rem',
                  textAlign: 'center',
                  cursor: 'pointer',
                  background: isDragging ? 'rgba(129,140,248,0.08)' : 'var(--color-bg-surface-hover)',
                  transition: 'all 0.2s',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem',
                }}
              >
                <Upload size={28} style={{ color: isDragging ? '#818cf8' : 'var(--color-text-muted)', transition: 'color 0.2s' }} />
                {selectedFiles.length > 0 ? (
                  <div>
                    <p style={{ fontWeight: '600', color: 'var(--color-text-main)', margin: 0 }}>
                      Đã chọn {selectedFiles.length} tệp
                    </p>
                    <p style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', margin: '0.2rem 0 0' }}>
                      {selectedFiles.map(f => f.name).join(', ')}
                    </p>
                  </div>
                ) : (
                  <div>
                    <p style={{ fontWeight: '600', color: 'var(--color-text-main)', margin: 0 }}>
                      Kéo & thả tệp vào đây
                    </p>
                    <p style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', margin: '0.2rem 0 0' }}>
                      hoặc nhấn để chọn · PDF, Word, Excel, Ảnh · Tối đa 20MB/tệp
                    </p>
                  </div>
                )}
              </div>

              {/* Input ẩn */}
              <input
                id="doc-file-input"
                required={(!formData.attachments || formData.attachments.length === 0) && selectedFiles.length === 0}
                type="file"
                multiple
                style={{ display: 'none' }}
                accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
                onChange={(e) => {
                  const MAX = 20 * 1024 * 1024;
                  const all = Array.from(e.target.files);
                  const oversized = all.filter(f => f.size > MAX);
                  if (oversized.length > 0) {
                    toast.warning(`${oversized.length} tệp vượt giới hạn 20MB: ${oversized.map(f => f.name).join(', ')}`);
                  }
                  setSelectedFiles(all.filter(f => f.size <= MAX));
                }}
              />
              {formData.attachments && formData.attachments.length > 0 && (
                <div style={{ marginTop: '0.5rem', fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
                  <div style={{ marginBottom: '0.25rem' }}>Tệp cũ đã lưu:</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                    {formData.attachments.map((f, idx) => (
                      <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', padding: '0.25rem 0.5rem', backgroundColor: 'var(--color-bg-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)' }}>
                        <span style={{ wordBreak: 'break-all' }}>{f.name}</span>
                        <button 
                          type="button" 
                          onClick={() => removeOldAttachment(idx)}
                          style={{ background: 'none', border: 'none', color: 'var(--color-danger)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0.125rem' }}
                          title="Xóa tệp này"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {selectedFiles.length > 0 && (
                <div style={{ marginTop: '0.5rem', fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
                  Đã chọn {selectedFiles.length} tệp mới:
                  <ul style={{ paddingLeft: '1.5rem', marginTop: '0.25rem' }}>
                    {selectedFiles.map((file, i) => (
                      <li key={i}>{file.name}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {previewMode && formData.attachments && formData.attachments.length > 0 && (
            <div className="form-group">
              <label className="form-label">Tài liệu đính kèm</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {formData.attachments.map((file, idx) => (
                  <a key={idx} href={file.url} target="_blank" rel="noreferrer" className="badge" style={{ backgroundColor: 'var(--color-bg-surface)', border: '1px solid var(--color-border)', color: 'var(--color-primary)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '8px', padding: '0.5rem', width: 'fit-content' }} title={file.name}>
                    {file.name}
                  </a>
                ))}
              </div>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '2rem', paddingTop: '1.5rem', borderTop: '1px solid var(--color-border)' }}>
            {previewMode ? (
              <button type="button" className="btn btn-primary" onClick={onClose}>Đóng</button>
            ) : (
              <>
                <button type="button" className="btn btn-outline" onClick={onClose} disabled={isSubmitting}>Hủy bỏ</button>
                <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                  <Check size={18} /> {isSubmitting ? 'Đang lưu...' : 'Lưu tài liệu'}
                </button>
              </>
            )}
          </div>
        </form>
      </div>
      {/* ── MODAL THÊM THÔNG TIN ĐỐI TÁC MỚI (KÍCH HOẠT TỪ TRANG TÀI LIỆU) ────── */}
      {showAddPartnerModal && (
        <div className="modal-overlay" style={{ zIndex: 10000 }} onClick={() => setShowAddPartnerModal(false)}>
          <div 
            className="modal-content" 
            onClick={e => e.stopPropagation()} 
            style={{ padding: '2rem', maxWidth: '850px', width: '95%', maxHeight: '90vh', overflowY: 'auto', backgroundColor: '#1e293b', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)' }}
          >
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid var(--color-border)', paddingBottom: '1rem' }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: '700', color: '#60a5fa', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                🏢 Thêm thông tin đối tác mới
              </h3>
              <button onClick={() => setShowAddPartnerModal(false)} style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer' }}>
                <X size={22} />
              </button>
            </div>

            {/* Form Fields */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
              
              {/* Row 1 */}
              <div className="form-group" style={{ gridColumn: 'span 2', marginBottom: 0 }}>
                <label className="form-label" style={{ fontWeight: '600', color: 'var(--color-text-main)' }}>Tên công ty (*)</label>
                <input 
                  type="text" 
                  className="input-field" 
                  placeholder="Công ty CP..." 
                  value={newPartnerData.name} 
                  onChange={(e) => setNewPartnerData({ ...newPartnerData, name: e.target.value })} 
                  required
                />
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Tên viết tắt</label>
                <input 
                  type="text" 
                  className="input-field" 
                  placeholder="FPT, Coteccons..." 
                  value={newPartnerData.shortName} 
                  onChange={(e) => setNewPartnerData({ ...newPartnerData, shortName: e.target.value })} 
                />
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Mã số thuế</label>
                <input 
                  type="text" 
                  className="input-field" 
                  placeholder="0123456789" 
                  value={newPartnerData.taxCode} 
                  onChange={(e) => setNewPartnerData({ ...newPartnerData, taxCode: e.target.value })} 
                />
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Loại hình đối tác</label>
                <select 
                  className="input-field" 
                  value={newPartnerData.type} 
                  onChange={(e) => setNewPartnerData({ ...newPartnerData, type: e.target.value })}
                >
                  <option value="Cơ quan ban hành">Cơ quan ban hành</option>
                  <option value="Nhà thầu thi công">Nhà thầu thi công</option>
                  <option value="Nhà thầu tư vấn">Nhà thầu tư vấn</option>
                  <option value="Chủ đầu tư">Chủ đầu tư</option>
                  <option value="Đơn vị kiểm định">Đơn vị kiểm định</option>
                  <option value="Nhà cung cấp">Nhà cung cấp</option>
                </select>
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Người đại diện</label>
                <input 
                  type="text" 
                  className="input-field" 
                  placeholder="Nguyễn Văn A" 
                  value={newPartnerData.representative} 
                  onChange={(e) => setNewPartnerData({ ...newPartnerData, representative: e.target.value })} 
                />
              </div>

              {/* Row 2 */}
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Số điện thoại</label>
                <input 
                  type="text" 
                  className="input-field" 
                  placeholder="09..." 
                  value={newPartnerData.phone} 
                  onChange={(e) => setNewPartnerData({ ...newPartnerData, phone: e.target.value })} 
                />
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Email</label>
                <input 
                  type="email" 
                  className="input-field" 
                  placeholder="contact@company.com" 
                  value={newPartnerData.email} 
                  onChange={(e) => setNewPartnerData({ ...newPartnerData, email: e.target.value })} 
                />
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Website</label>
                <input 
                  type="text" 
                  className="input-field" 
                  placeholder="https://..." 
                  value={newPartnerData.website} 
                  onChange={(e) => setNewPartnerData({ ...newPartnerData, website: e.target.value })} 
                />
              </div>

              {/* Row 3 */}
              <div className="form-group" style={{ gridColumn: '1 / -1', marginBottom: 0 }}>
                <label className="form-label">Địa chỉ trụ sở</label>
                <input 
                  type="text" 
                  className="input-field" 
                  placeholder="Số nhà, đường, phường, quận..." 
                  value={newPartnerData.address} 
                  onChange={(e) => setNewPartnerData({ ...newPartnerData, address: e.target.value })} 
                />
              </div>

              {/* Row 4 */}
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Số tài khoản</label>
                <input 
                  type="text" 
                  className="input-field" 
                  placeholder="123456789" 
                  value={newPartnerData.bankAccount} 
                  onChange={(e) => setNewPartnerData({ ...newPartnerData, bankAccount: e.target.value })} 
                />
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Ngân hàng</label>
                <input 
                  type="text" 
                  className="input-field" 
                  placeholder="Vietcombank, MB Bank..." 
                  value={newPartnerData.bankName} 
                  onChange={(e) => setNewPartnerData({ ...newPartnerData, bankName: e.target.value })} 
                />
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Đánh giá tín nhiệm</label>
                <div style={{ display: 'flex', gap: '4px', marginTop: '6px', cursor: 'pointer' }}>
                  {[1, 2, 3, 4, 5].map(star => (
                    <span
                      key={star}
                      onClick={() => setNewPartnerData({ ...newPartnerData, rating: star })}
                      style={{ fontSize: '1.25rem', color: star <= (newPartnerData.rating || 5) ? '#f59e0b' : 'var(--color-text-muted)', transition: 'color 0.15s' }}
                    >
                      ★
                    </span>
                  ))}
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Ảnh đại diện (Ctrl+V dán ảnh)</label>
                <input 
                  type="file" 
                  accept="image/*" 
                  className="input-field" 
                  style={{ padding: '0.35rem' }}
                  onChange={(e) => {
                    const file = e.target.files[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onload = (ev) => setNewPartnerData({ ...newPartnerData, logo: ev.target.result });
                      reader.readAsDataURL(file);
                    }
                  }}
                />
              </div>

              {/* Row 5 */}
              <div className="form-group" style={{ gridColumn: '1 / -1', marginBottom: 0 }}>
                <label className="form-label">Tệp đính kèm (Profile, Portfolio, Giấy phép...)</label>
                <input 
                  type="file" 
                  multiple 
                  className="input-field" 
                  style={{ padding: '0.35rem' }}
                  onChange={(e) => {
                    const files = Array.from(e.target.files);
                    const fileObjs = files.map(f => ({ name: f.name, size: f.size, url: '#' }));
                    setNewPartnerData(prev => ({ ...prev, attachments: [...(prev.attachments || []), ...fileObjs] }));
                  }}
                />
              </div>

            </div>

            {/* Footer Buttons */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '2rem', paddingTop: '1rem', borderTop: '1px solid var(--color-border)' }}>
              <button 
                type="button" 
                className="btn btn-outline" 
                onClick={() => setShowAddPartnerModal(false)}
                style={{ padding: '0.5rem 1.25rem' }}
              >
                Hủy bỏ
              </button>

              <button 
                type="button" 
                className="btn btn-primary" 
                style={{ padding: '0.5rem 1.5rem', backgroundColor: '#3b82f6', color: 'white', borderRadius: '8px', fontWeight: '600' }}
                onClick={async () => {
                  if (!newPartnerData.name || !newPartnerData.name.trim()) {
                    toast.error("Vui lòng nhập tên công ty / đối tác!");
                    return;
                  }
                  try {
                    const partnerName = newPartnerData.name.trim();
                    if (addPartner) {
                      await addPartner({
                        ...newPartnerData,
                        name: partnerName,
                        createdAt: new Date().toISOString()
                      });
                    }
                    setFormData(prev => ({ ...prev, issuingAgency: partnerName }));
                    setShowAddPartnerModal(false);
                    toast.success(`Đã lưu đối tác "${partnerName}" và điền vào Cơ quan ban hành!`);
                  } catch (err) {
                    console.error("Lỗi khi thêm đối tác mới: ", err);
                    toast.error("Có lỗi xảy ra khi lưu đối tác mới!");
                  }
                }}
              >
                Lưu đối tác mới
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
};

export default DocumentForm;
