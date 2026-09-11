import React, { useState, useContext, useEffect } from 'react';
import { format } from 'date-fns';
import { X, Upload, Check, ChevronDown, Plus, Trash2, Folder, HardDrive, Info, AlertTriangle } from 'lucide-react';
import { DocumentContext } from '../context/DocumentContext';
import { useToast } from '../context/UIContext';
import { EMPLOYEE_LEVELS } from '../data';
import { v4 as uuidv4 } from 'uuid';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../firebase';
import { validateFileSize } from '../utils/uploadHelpers';
import { 
  isFileSystemAccessSupported, 
  isDirectoryPickerSupported, 
  pickFilesWithHandle, 
  pickDirectoryFilesWithHandle, 
  deleteLocalFile 
} from '../utils/fileSystemHelpers';
import { isProjectSelected } from '../utils/projectMatcher';

const DocumentForm = ({ onClose, initialData, initialFiles = [], previewMode = false }) => {
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
  const [selectedFiles, setSelectedFiles] = useState(initialFiles || []);
  const [isDragging, setIsDragging]     = useState(false);
  const [showAgencyDropdown, setShowAgencyDropdown] = useState(false);
  const [showAddPartnerModal, setShowAddPartnerModal] = useState(false);
  const [deleteLocalAfterUpload, setDeleteLocalAfterUpload] = useState(false);
  const [fsSupported, setFsSupported] = useState(false);
  const [dirSupported, setDirSupported] = useState(false);

  useEffect(() => {
    setFsSupported(isFileSystemAccessSupported());
    setDirSupported(isDirectoryPickerSupported());
  }, []);

  const handlePickFileSystem = async () => {
    try {
      const results = await pickFilesWithHandle({ multiple: true });
      if (results && results.length > 0) {
        const newFiles = results.map(r => r.file);
        setSelectedFiles(prev => [...prev, ...newFiles]);
        setDeleteLocalAfterUpload(true);
        toast.success(`Đã chọn ${newFiles.length} tệp (Đã liên kết quyền xóa tệp gốc trên máy).`);
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        toast.error('Lỗi khi mở tệp: ' + (err.message || ''));
      }
    }
  };

  const handlePickDirectory = async () => {
    try {
      const { files } = await pickDirectoryFilesWithHandle();
      if (!files || files.length === 0) {
        toast.info('Thư mục được chọn không có tệp nào.');
        return;
      }
      const newFiles = files.map(f => f.file);
      setSelectedFiles(prev => [...prev, ...newFiles]);
      setDeleteLocalAfterUpload(true);
      toast.success(`Đã chọn ${newFiles.length} tệp từ thư mục.`);
    } catch (err) {
      if (err.name !== 'AbortError') {
        toast.error('Lỗi khi mở thư mục: ' + (err.message || ''));
      }
    }
  };

  const removeSelectedFile = (indexToRemove) => {
    setSelectedFiles(prev => prev.filter((_, idx) => idx !== indexToRemove));
  };
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
  
  const [formData, setFormData] = useState(() => {
    if (initialData) {
      return {
        documentCode: initialData.documentCode || autoCode,
        documentNumber: initialData.documentNumber || '',
        documentType: initialData.documentType || '',
        issuingAgency: initialData.issuingAgency || '',
        effectiveDate: initialData.effectiveDate || '',
        summary: initialData.summary || '',
        keywords: Array.isArray(initialData.keywords) ? initialData.keywords.join(', ') : (initialData.keywords || ''),
        relatedProjects: Array.isArray(initialData.relatedProjects) ? initialData.relatedProjects : [],
        accessLevels: Array.isArray(initialData.accessLevels) ? initialData.accessLevels : [],
        attachmentLink: initialData.attachmentLink || '',
        quickViewImage: initialData.quickViewImage || 'https://images.unsplash.com/photo-1568225367111-44052445b410?q=80&w=600&auto=format&fit=crop',
        attachments: Array.isArray(initialData.attachments) ? initialData.attachments : [],
        legalStepId: initialData.legalStepId || '',
        ...initialData,
        // Override properties that might be malformed in initialData
        keywords: Array.isArray(initialData.keywords) ? initialData.keywords.join(', ') : (initialData.keywords || ''),
        relatedProjects: Array.isArray(initialData.relatedProjects) ? initialData.relatedProjects : [],
        accessLevels: Array.isArray(initialData.accessLevels) ? initialData.accessLevels : [],
      };
    }
    return {
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
    };
  });
  
  const isEdit = !!(initialData && initialData.id);
  const permissionKey = isEdit ? 'edit_docs' : 'add_docs';
  const visibleProjects = projects.filter(p => 
    previewMode || 
    checkPermission(p.id, permissionKey) || 
    isProjectSelected(formData.relatedProjects, p)
  );

  useEffect(() => {
    if (initialData) {
      setFormData(prev => ({
        ...prev,
        documentNumber: initialData.documentNumber !== undefined ? initialData.documentNumber : prev.documentNumber,
        documentType: initialData.documentType !== undefined ? initialData.documentType : prev.documentType,
        issuingAgency: initialData.issuingAgency !== undefined ? initialData.issuingAgency : prev.issuingAgency,
        effectiveDate: initialData.effectiveDate !== undefined ? initialData.effectiveDate : prev.effectiveDate,
        summary: initialData.summary !== undefined ? initialData.summary : prev.summary,
        keywords: Array.isArray(initialData.keywords) ? initialData.keywords.join(', ') : (initialData.keywords !== undefined ? initialData.keywords : prev.keywords),
        relatedProjects: Array.isArray(initialData.relatedProjects) ? initialData.relatedProjects : (prev.relatedProjects || []),
        accessLevels: Array.isArray(initialData.accessLevels) ? initialData.accessLevels : (prev.accessLevels || []),
        legalStepId: initialData.legalStepId !== undefined ? initialData.legalStepId : prev.legalStepId,
        ...initialData,
        keywords: Array.isArray(initialData.keywords) ? initialData.keywords.join(', ') : (initialData.keywords !== undefined ? initialData.keywords : prev.keywords),
        relatedProjects: Array.isArray(initialData.relatedProjects) ? initialData.relatedProjects : (prev.relatedProjects || []),
        accessLevels: Array.isArray(initialData.accessLevels) ? initialData.accessLevels : (prev.accessLevels || []),
      }));
    }
  }, [initialData]);

  useEffect(() => {
    if (initialFiles && initialFiles.length > 0) {
      setSelectedFiles(initialFiles);
    }
  }, [initialFiles]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleProjectToggle = (projectObj) => {
    setFormData(prev => {
      const currentList = Array.isArray(prev.relatedProjects) ? [...prev.relatedProjects] : [];
      const isSelected = isProjectSelected(currentList, projectObj);
      if (isSelected) {
        const pName = (projectObj.name || '').trim().toLowerCase();
        const pCode = (projectObj.code || '').trim().toLowerCase();
        const pCodeNorm = pCode.replace(/[-\s_]/g, '');
        const pId = String(projectObj.id || '').trim().toLowerCase();

        const filtered = currentList.filter(item => {
          const s = String(typeof item === 'object' ? (item.name || item.code || item.id) : item).trim().toLowerCase();
          const sNorm = s.replace(/[-\s_]/g, '');
          if (pName && (s === pName || sNorm === pName.replace(/[-\s_]/g, ''))) return false;
          if (pCode && (s === pCode || sNorm === pCodeNorm)) return false;
          if (pId && s === pId) return false;
          if ((sNorm.includes('cns1') || sNorm.includes('cns01')) && (pCodeNorm.includes('cns1') || pCodeNorm.includes('cns01'))) return false;
          return true;
        });
        return { ...prev, relatedProjects: filtered };
      } else {
        return { ...prev, relatedProjects: [...currentList, projectObj.name] };
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

      // Upload tất cả các file đã chọn lên Firebase Storage (không giới hạn dung lượng)
      if (selectedFiles.length > 0) {
        const withTimeout = (promise, ms = 300000) =>
          Promise.race([
            promise,
            new Promise((_, reject) =>
              setTimeout(() => reject(new Error('TIMEOUT')), ms)
            ),
          ]);

        const uploadedFiles = await Promise.all(
          selectedFiles.map(async (file) => {
            const storageRef = ref(storage, `documents/${Date.now()}_${file.name}`);
            const snapshot = await withTimeout(uploadBytes(storageRef, file), 300000);
            const url = await getDownloadURL(snapshot.ref);
            return { name: file.name, url };
          })
        );
        
        attachmentsData = [...attachmentsData, ...uploadedFiles];
      }

      const newDoc = {
        ...formData,
        attachments: attachmentsData, // Lưu dưới dạng mảng
        uploader: isEdit ? (initialData.uploader || 'Quản Trị Viên') : 'Quản Trị Viên',
        createdAt: isEdit ? (initialData.createdAt || new Date().toISOString()) : new Date().toISOString(),
        isNew: isEdit ? (initialData.isNew ?? false) : true
      };
      
      // Xóa attachmentLink cũ khỏi db để tránh nhầm lẫn
      delete newDoc.attachmentLink;
      
      // Loại bỏ các trường undefined để tránh lỗi Firestore
      Object.keys(newDoc).forEach(key => {
        if (newDoc[key] === undefined) {
          delete newDoc[key];
        }
      });
      
      if (isEdit) {
        await editDocument(initialData.id, newDoc);
      } else {
        newDoc.id = uuidv4();
        await addDocument(newDoc);
      }

      // ── XỬ LÝ XÓA FILE GỐC TRÊN MÁY TÍNH NẾU ĐƯỢC CHỌN ──
      if (deleteLocalAfterUpload && selectedFiles.length > 0) {
        let deletedCount = 0;
        let failedCount = 0;
        for (const file of selectedFiles) {
          if (file._fileHandle) {
            const res = await deleteLocalFile(file._fileHandle, file._dirHandle);
            if (res.success) {
              deletedCount++;
            } else {
              failedCount++;
              console.warn(`Không thể xóa file ${file.name}:`, res.error);
            }
          }
        }

        if (deletedCount > 0) {
          toast.success(`🗑️ Đã tải lên và xóa thành công ${deletedCount} tệp gốc trên máy tính!`);
        } else if (failedCount > 0) {
          toast.info('Tài liệu đã lưu lên đám mây. Tệp gốc chưa được xóa do trình duyệt chưa được cấp quyền.');
        }
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
            {previewMode ? 'Xem thông tin, tài liệu' : (isEdit ? 'Sửa thông tin tài liệu' : 'Tải lên tài liệu mới')}
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
              {visibleProjects.map(p => {
                const selected = isProjectSelected(formData.relatedProjects, p);
                return (
                  <button
                    disabled={previewMode}
                    key={p.id}
                    type="button"
                    onClick={() => handleProjectToggle(p)}
                    className={`badge ${selected ? 'badge-blue' : ''}`}
                    style={{ 
                      border: selected ? '1px solid var(--color-primary)' : '1px solid var(--color-border)',
                      backgroundColor: selected ? 'rgba(130, 168, 209, 0.15)' : 'white',
                      color: selected ? 'var(--color-primary)' : 'var(--color-text-muted)',
                      cursor: previewMode ? 'default' : 'pointer', padding: '0.375rem 0.75rem'
                    }}
                  >
                    {selected && <Check size={12} style={{ marginRight: '4px' }} />}
                    {p.name}
                  </button>
                );
              })}
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
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                <label className="form-label" style={{ margin: 0 }}>
                  Tài liệu đính kèm {(!formData.attachments || formData.attachments.length === 0) && <span style={{ color: 'var(--color-danger)' }}>*</span>}
                </label>
                
                {/* Các nút chọn qua File System Access API */}
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  {fsSupported && (
                    <button
                      type="button"
                      className="btn"
                      onClick={handlePickFileSystem}
                      style={{
                        padding: '0.3rem 0.65rem',
                        fontSize: '0.78rem',
                        backgroundColor: 'rgba(59, 130, 246, 0.12)',
                        color: '#3b82f6',
                        border: '1px solid rgba(59, 130, 246, 0.3)',
                        borderRadius: 'var(--radius-md)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.35rem',
                        fontWeight: '600',
                        cursor: 'pointer'
                      }}
                      title="Chọn tệp từ máy tính kèm quyền quản lý xóa tệp gốc sau khi tải"
                    >
                      <HardDrive size={14} />
                      <span>Chọn từ ổ đĩa (Hỗ trợ xóa gốc)</span>
                    </button>
                  )}
                  {dirSupported && (
                    <button
                      type="button"
                      className="btn"
                      onClick={handlePickDirectory}
                      style={{
                        padding: '0.3rem 0.65rem',
                        fontSize: '0.78rem',
                        backgroundColor: 'rgba(16, 185, 129, 0.12)',
                        color: '#10b981',
                        border: '1px solid rgba(16, 185, 129, 0.3)',
                        borderRadius: 'var(--radius-md)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.35rem',
                        fontWeight: '600',
                        cursor: 'pointer'
                      }}
                      title="Chọn tất cả tệp trong một thư mục"
                    >
                      <Folder size={14} />
                      <span>Chọn cả thư mục</span>
                    </button>
                  )}
                </div>
              </div>

              {/* ── Drag & Drop Zone ── */}
              <div
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragging(false);
                  const all = Array.from(e.dataTransfer.files);
                  setSelectedFiles(prev => [...prev, ...all]);
                }}
                onClick={() => {
                  if (fsSupported) {
                    handlePickFileSystem();
                  } else {
                    document.getElementById('doc-file-input')?.click();
                  }
                }}
                style={{
                  border: `2px dashed ${isDragging ? '#818cf8' : 'var(--color-border)'}`,
                  borderRadius: 'var(--radius-md)',
                  padding: '1.25rem',
                  textAlign: 'center',
                  cursor: 'pointer',
                  background: isDragging ? 'rgba(129,140,248,0.08)' : 'var(--color-bg-surface-hover)',
                  transition: 'all 0.2s',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.4rem',
                }}
              >
                <Upload size={26} style={{ color: isDragging ? '#818cf8' : 'var(--color-text-muted)', transition: 'color 0.2s' }} />
                {selectedFiles.length > 0 ? (
                  <div>
                    <p style={{ fontWeight: '600', color: 'var(--color-text-main)', margin: 0, fontSize: '0.9rem' }}>
                      Đã chọn {selectedFiles.length} tệp
                    </p>
                    <p style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', margin: '0.2rem 0 0' }}>
                      Nhấn để chọn thêm hoặc kéo thả tệp khác vào đây
                    </p>
                  </div>
                ) : (
                  <div>
                    <p style={{ fontWeight: '600', color: 'var(--color-text-main)', margin: 0, fontSize: '0.9rem' }}>
                      Kéo & thả tệp vào đây hoặc nhấn để chọn
                    </p>
                    <p style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', margin: '0.2rem 0 0' }}>
                      Mọi định dạng (PDF, Word, CAD, Excel, Zip, Ảnh...) · Không giới hạn dung lượng · Hỗ trợ xóa file gốc
                    </p>
                  </div>
                )}
              </div>

              {/* Checkbox tùy chọn xóa file gốc */}
              <div style={{
                marginTop: '0.75rem',
                padding: '0.75rem 1rem',
                backgroundColor: deleteLocalAfterUpload ? 'rgba(239, 68, 68, 0.08)' : 'var(--color-bg-surface)',
                border: `1px solid ${deleteLocalAfterUpload ? '#ef4444' : 'var(--color-border)'}`,
                borderRadius: 'var(--radius-md)',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.35rem',
                transition: 'all 0.2s ease'
              }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontWeight: '600', color: deleteLocalAfterUpload ? '#ef4444' : 'var(--color-text-main)', fontSize: '0.85rem' }}>
                  <input
                    type="checkbox"
                    checked={deleteLocalAfterUpload}
                    onChange={(e) => {
                      setDeleteLocalAfterUpload(e.target.checked);
                      if (e.target.checked && selectedFiles.length > 0 && !selectedFiles.some(f => f._fileHandle)) {
                        toast.info('💡 Các tệp hiện tại được chọn qua kéo-thả thông thường. Vui lòng bấm nút "Chọn từ ổ đĩa" để cấp quyền xóa file gốc trên máy.');
                      }
                    }}
                    style={{ width: '16px', height: '16px', accentColor: '#ef4444', cursor: 'pointer' }}
                  />
                  <Trash2 size={16} />
                  <span>Tự động xóa file gốc trên máy tính sau khi tải lên thành công</span>
                </label>
                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', paddingLeft: '1.6rem' }}>
                  {deleteLocalAfterUpload ? (
                    <span style={{ color: '#ef4444' }}>
                      ⚠️ Sau khi lưu lên Cloud, trình duyệt Chrome/Edge sẽ hiển thị xác nhận quyền xóa tệp từ máy của bạn.
                    </span>
                  ) : (
                    <span>
                      Sử dụng File System Access API trên trình duyệt để tự động dọn dẹp file gốc trên máy sau khi tải lên lưu trữ.
                    </span>
                  )}
                </div>
              </div>

              {/* Input ẩn phục vụ fallback */}
              <input
                id="doc-file-input"
                type="file"
                multiple
                style={{ display: 'none' }}
                onChange={(e) => {
                  const all = Array.from(e.target.files);
                  setSelectedFiles(prev => [...prev, ...all]);
                }}
              />

              {/* Danh sách tệp cũ đã lưu */}
              {formData.attachments && formData.attachments.length > 0 && (
                <div style={{ marginTop: '0.75rem', fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
                  <div style={{ marginBottom: '0.35rem', fontWeight: '600' }}>Tệp đã lưu trước đó:</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                    {formData.attachments.map((f, idx) => (
                      <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.3rem 0.6rem', backgroundColor: 'var(--color-bg-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', fontSize: '0.8rem' }}>
                        <span style={{ wordBreak: 'break-all' }}>📄 {f.name}</span>
                        <button 
                          type="button" 
                          onClick={() => removeOldAttachment(idx)}
                          style={{ background: 'none', border: 'none', color: 'var(--color-danger)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0.125rem' }}
                          title="Xóa tệp này khỏi tài liệu"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Danh sách tệp mới đã chọn */}
              {selectedFiles.length > 0 && (
                <div style={{ marginTop: '0.75rem', fontSize: '0.85rem' }}>
                  <div style={{ marginBottom: '0.35rem', fontWeight: '600', color: 'var(--color-text-main)' }}>
                    Danh sách tệp mới chuẩn bị tải lên ({selectedFiles.length}):
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    {selectedFiles.map((file, i) => (
                      <div 
                        key={i} 
                        style={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          justifyContent: 'space-between', 
                          padding: '0.4rem 0.75rem', 
                          backgroundColor: 'var(--color-bg-surface-hover)', 
                          border: '1px solid var(--color-border)', 
                          borderRadius: 'var(--radius-md)',
                          fontSize: '0.8rem'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          <span style={{ fontWeight: '500', color: 'var(--color-text-main)' }}>📄 {file.name}</span>
                          <span style={{ color: 'var(--color-text-muted)', fontSize: '0.75rem' }}>
                            ({file.size ? (file.size / (1024 * 1024)).toFixed(2) + ' MB' : '0 MB'})
                          </span>
                          {file._fileHandle ? (
                            <span style={{ fontSize: '0.7rem', backgroundColor: 'rgba(16,185,129,0.15)', color: '#10b981', padding: '1px 6px', borderRadius: '4px', fontWeight: '600' }}>
                              🗑️ Hỗ trợ xóa gốc
                            </span>
                          ) : (
                            <span style={{ fontSize: '0.7rem', backgroundColor: 'rgba(148,163,184,0.15)', color: 'var(--color-text-muted)', padding: '1px 6px', borderRadius: '4px' }}>
                              Tải thường
                            </span>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => removeSelectedFile(i)}
                          style={{ background: 'none', border: 'none', color: 'var(--color-danger)', cursor: 'pointer', padding: '2px', display: 'flex', alignItems: 'center' }}
                          title="Bỏ chọn tệp này"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
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
