import React, { useState, useContext, useRef, useEffect, useDeferredValue } from 'react';
import ReactDOM from 'react-dom';
import { ROLES } from '../constants';
import { Plus, Edit, Trash2, MapPin, Building, Activity, FileText, Briefcase, Eye, Download, Users, X, Link, ChevronDown, ChevronUp, Search, Filter, Check, GripVertical, ChevronLeft, ChevronRight } from 'lucide-react';
import { DocumentContext } from '../context/DocumentContext';
import { useToast, useConfirm } from '../context/UIContext';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../firebase';
import PdfViewerModal from './PdfViewerModal';
import { PROJECT_DETAILS_TEMPLATE, PROJECT_ROLES, getPastelColor } from '../data';


const PROJECT_STATUSES = ['Chưa bắt đầu', 'Đang thực hiện', 'Đã hoàn thành', 'Đã bị hủy'];
const getProjectStatusColor = (s) => {
  if (s === 'Đang thực hiện') return { bg: 'rgba(59, 130, 246, 0.2)', text: '#93c5fd' };
  if (s === 'Đã hoàn thành') return { bg: 'rgba(16, 185, 129, 0.2)', text: '#6ee7b7' };
  if (s === 'Đã bị hủy') return { bg: 'rgba(239, 68, 68, 0.2)', text: '#fca5a5' };
  return { bg: 'rgba(148, 163, 184, 0.2)', text: '#cbd5e1' };
};

const Projects = ({ focusProjectId = null, onFocusCleared }) => {
  const { userRole, projects, addProject, editProject, deleteProject, members, documents, globalLists } = useContext(DocumentContext);
  const projectRoles = React.useMemo(() => {
    if (globalLists?.projectRoles && globalLists.projectRoles.length > 0) {
      return globalLists.projectRoles.map(item => item.name);
    }
    return PROJECT_ROLES;
  }, [globalLists]);
  const toast = useToast();
  const confirm = useConfirm();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingProject, setEditingProject] = useState(null);
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const handledFocusRef = useRef(null); // theo dõi focusProjectId đã xử lý
  
  const defaultFormData = {
    code: '',
    codeNN: '',
    name: '',
    location: '',
    investor: 'Công ty TNHH Hạ tầng công nghệ số FPT',
    parentId: '',
    image: '',
    status: 'Chưa bắt đầu',
    details: [...PROJECT_DETAILS_TEMPLATE],
    projectMembers: [],
    tasks: []
  };
  
  const [formData, setFormData] = useState(defaultFormData);
  const [showMembersSection, setShowMembersSection] = useState(false);
  const [showDocsSection, setShowDocsSection] = useState(false);
  const [isPlanningSectionCollapsed, setIsPlanningSectionCollapsed] = useState(true);
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [isExporting, setIsExporting] = useState(false);        // loading state cho PDF export
  const [pdfViewerFile, setPdfViewerFile] = useState(null);     // file đang xem trong PdfViewerModal
  const [isUploadingImage, setIsUploadingImage] = useState(false); // loading khi upload ảnh
  const [isDraggingImage, setIsDraggingImage]   = useState(false);  // drag-over ảnh
  const [imageInfo, setImageInfo]               = useState(null);    // { original, compressed } KB
  const statusMenuRef = useRef(null);

  const [searchTerm, setSearchTerm] = useState(() => localStorage.getItem('projectSearchTerm') || '');
  const [selectedStatuses, setSelectedStatuses] = useState(() => {
    const saved = localStorage.getItem('projectStatuses');
    return saved ? JSON.parse(saved) : ['Đang thực hiện'];
  });
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const filterMenuRef = useRef(null);
  const dragRowRef    = useRef(null);     // index đang kéo
  const [dragOverIndex, setDragOverIndex] = useState(null); // index đang hover
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 3;

  useEffect(() => {
    localStorage.setItem('projectSearchTerm', searchTerm);
  }, [searchTerm]);

  useEffect(() => {
    localStorage.setItem('projectStatuses', JSON.stringify(selectedStatuses));
  }, [selectedStatuses]);


  useEffect(() => {
    const handleClickOutside = (event) => {
      if (statusMenuRef.current && !statusMenuRef.current.contains(event.target)) {
        setShowStatusDropdown(false);
      }
      if (filterMenuRef.current && !filterMenuRef.current.contains(event.target)) {
        setShowFilterMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleOpenForm = (project = null, preview = false) => {
    if (project) {
      setEditingProject(project);
      setIsPreviewMode(preview);
      setFormData({
        ...project,
        details: project.details && project.details.length > 0
          ? project.details
          : [...PROJECT_DETAILS_TEMPLATE],
        projectMembers: project.projectMembers || [],
        tasks: project.tasks || []
      });
      setShowMembersSection(false);
      setShowDocsSection(false);
      setIsPlanningSectionCollapsed(false); // Tự động mở rộng khi xem dự án
    } else {
      setEditingProject(null);
      setIsPreviewMode(false);
      setFormData(defaultFormData);
      setShowMembersSection(false);
      setShowDocsSection(false);
      setIsPlanningSectionCollapsed(false); // Tự động mở rộng khi tạo mới
    }
    setIsFormOpen(true);
  };

  // Khi tìm kiếm toàn cục chọn dự án → mở preview
  useEffect(() => {
    if (
      focusProjectId &&
      focusProjectId !== handledFocusRef.current &&
      projects?.length > 0
    ) {
      const p = projects.find(x => x.id === focusProjectId);
      if (p) {
        handledFocusRef.current = focusProjectId;
        handleOpenForm(p, true);
        setTimeout(() => onFocusCleared?.(), 0);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusProjectId, projects]);

  const handleCloseForm = () => {
    setIsFormOpen(false);
    setEditingProject(null);
    setIsPreviewMode(false);
    setFormData(defaultFormData);
    setShowMembersSection(false);
    setShowDocsSection(false);
    setIsPlanningSectionCollapsed(true);
  };

  const handleExportPDF = async () => {
    const element = document.getElementById('project-printable-area');
    if (!element || isExporting) return;
    setIsExporting(true);
    try {
      const opt = {
        margin:       [5, 5, 5, 5],
        filename:     `ThongTinDuAn_${formData.code || 'KhongCoMa'}.pdf`,
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  {
          scale: 2,
          useCORS: true,
          logging: false,
          onclone: (doc) => {
            const el = doc.getElementById('project-printable-area');
            if (el) {
              el.style.fontSize = '12px';
              el.querySelectorAll('.form-group').forEach(fg => { fg.style.marginBottom = '0'; });
              el.querySelectorAll('div[style*="grid"]').forEach(g => { g.style.gap = '0.5rem'; });
              el.querySelectorAll('div[style*="flex"]').forEach(f => { if (f.style.gap === '1.5rem') f.style.gap = '0.75rem'; });
              el.querySelectorAll('.input-field').forEach(input => { input.style.padding = '0.25rem 0.5rem'; input.style.minHeight = '1.5rem'; input.style.fontSize = '11px'; });
              el.querySelectorAll('td, th').forEach(td => { td.style.padding = '0.25rem 0.5rem'; td.style.fontSize = '11px'; });
              const header = el.querySelector('#modal-header-banner');
              if (header) {
                header.style.padding = formData.image ? '4rem 1.5rem 1rem' : '1rem 1.5rem';
                const title = header.querySelector('h2');
                if (title) title.style.fontSize = '1.25rem';
              }
            }
          }
        },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
      };
      const html2pdf = (await import('html2pdf.js')).default;
      await html2pdf().set(opt).from(element).save();
    } catch (err) {
      toast.error('Lỗi khi xuất PDF: ' + (err.message || 'Vui lòng thử lại'));
    } finally {
      setIsExporting(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    
    // Validate trùng Mã dự án nội bộ
    if (formData.code) {
      const isDuplicateCode = projects.some(p => p.code === formData.code && (!editingProject || p.id !== editingProject.id));
      if (isDuplicateCode) {
        toast.warning('Mã dự án nội bộ đã tồn tại! Vui lòng nhập mã khác.');
        return;
      }
    }

    // Validate trùng Mã dự án NN
    if (formData.codeNN) {
      const isDuplicateCodeNN = projects.some(p => p.codeNN && p.codeNN === formData.codeNN && (!editingProject || p.id !== editingProject.id));
      if (isDuplicateCodeNN) {
        toast.warning('Mã dự án NN đã tồn tại! Vui lòng nhập mã khác.');
        return;
      }
    }

    if (editingProject) {
      await editProject(editingProject.id, { ...formData, id: editingProject.id });
    } else {
      await addProject({ ...formData });
    }
    handleCloseForm();
  };

  const handleDelete = async (id) => {
    const proj = projects.find(p => p.id === id);
    const linkedDocs = (documents || []).filter(d =>
      !d.isDeleted && Array.isArray(d.relatedProjects) && d.relatedProjects.includes(proj?.name)
    );
    const warningText = linkedDocs.length > 0
      ? `Dự án này đang liên kết với ${linkedDocs.length} tài liệu. Xoá dự án không xóa tài liệu nhưng sẽ gạch tên dự án khỏi danh sách. Bạn có muốn tiếp tục?`
      : 'Bạn có chắc chắn muốn xoá dự án này?';
    const ok = await confirm(warningText);
    if (ok) await deleteProject(id);
  };

  const handleDetailChange = (index, field, val) => {
    const newDetails = [...formData.details];
    newDetails[index] = { ...newDetails[index], [field]: val };
    setFormData({ ...formData, details: newDetails });
  };

  const handleAddDetailRow = () => {
    const newRow = {
      id: `detail_${Date.now()}`,
      name: '',
      value: ''
    };
    setFormData(prev => ({ ...prev, details: [...prev.details, newRow] }));
  };

  const handleDeleteDetailRow = (index) => {
    const newDetails = formData.details.filter((_, i) => i !== index);
    setFormData({ ...formData, details: newDetails });
  };

  // Drag & Drop để sắp xếp lại hàng datasheet
  const handleRowDragStart = (index) => {
    dragRowRef.current = index;
  };
  const handleRowDragOver = (e, index) => {
    e.preventDefault();
    if (dragRowRef.current !== index) setDragOverIndex(index);
  };
  const handleRowDrop = (index) => {
    const from = dragRowRef.current;
    if (from === null || from === undefined || from === index) {
      setDragOverIndex(null);
      return;
    }
    const newDetails = [...formData.details];
    const [moved] = newDetails.splice(from, 1);
    newDetails.splice(index, 0, moved);
    setFormData(prev => ({ ...prev, details: newDetails }));
    dragRowRef.current = null;
    setDragOverIndex(null);
  };
  const handleRowDragEnd = () => {
    dragRowRef.current = null;
    setDragOverIndex(null);
  };

  // Hàm nhận File (dùng chung cho drag-drop và input change)
  const handleFileSelected = (file) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Vui lòng chọn file ảnh (jpg, png, webp...)');
      return;
    }
    const originalKB = Math.round(file.size / 1024);
    setIsUploadingImage(true);
    setImageInfo(null);

    const reader = new FileReader();
    reader.onloadend = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let { width, height } = img;
        const MAX = 1200; // tối đa 1200px để giữ nét cho banner
        if (width > height && width > MAX) { height = Math.round(height * MAX / width); width = MAX; }
        else if (height > MAX) { width = Math.round(width * MAX / height); height = MAX; }
        canvas.width = width;
        canvas.height = height;
        canvas.getContext('2d').drawImage(img, 0, 0, width, height);

        // Chất lượng 0.82 — cân bằng giữa nét và dung lượng
        canvas.toBlob(async (blob) => {
          const compressedKB = Math.round(blob.size / 1024);
          try {
            const safeName = file.name.replace(/[^a-zA-Z0-9.]/g, '_');
            const path = `projects/images/${Date.now()}_${safeName}`;
            const imgRef = storageRef(storage, path);
            await uploadBytes(imgRef, blob, { contentType: 'image/jpeg' });
            const url = await getDownloadURL(imgRef);
            setFormData(prev => ({ ...prev, image: url }));
            setImageInfo({ original: originalKB, compressed: compressedKB });
            toast.success(`Ảnh đã được tải lên! (${originalKB} KB → ${compressedKB} KB)`);
          } catch (err) {
            toast.error('Lỗi khi tải ảnh: ' + err.message);
          } finally {
            setIsUploadingImage(false);
          }
        }, 'image/jpeg', 0.82);
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  };

  const handleImageUpload = (e) => handleFileSelected(e.target.files[0]);

  const deferredSearch = useDeferredValue(searchTerm);

  const filteredProjects = projects.filter(p => {
    const q = deferredSearch.toLowerCase();
    const matchesSearch = !q ||
      p.name.toLowerCase().includes(q) ||
      (p.code && p.code.toLowerCase().includes(q)) ||
      (p.location && p.location.toLowerCase().includes(q)) ||
      (p.investor && p.investor.toLowerCase().includes(q));
    const pStatus = p.status || 'Chưa bắt đầu';
    const matchesStatus = selectedStatuses.length === 0 || selectedStatuses.includes(pStatus);
    return matchesSearch && matchesStatus;
  });

  const totalPages = Math.max(1, Math.ceil(filteredProjects.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const pagedProjects = filteredProjects.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const toggleStatusFilter = (status) => {
    if (selectedStatuses.includes(status)) {
      setSelectedStatuses(selectedStatuses.filter(s => s !== status));
    } else {
      setSelectedStatuses([...selectedStatuses, status]);
    }
    setCurrentPage(1);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', height: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: '700', color: 'var(--color-text-main)', marginBottom: '0.25rem' }}>
            Dự án
          </h1>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem', margin: 0 }}>
            Quản lý {filteredProjects.length} dự án trong hệ thống
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flex: 1, maxWidth: '600px', backgroundColor: 'var(--color-bg-surface-hover)', borderRadius: 'var(--radius-md)', padding: '4px', border: '1px solid var(--color-border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1, padding: '0 0.5rem' }}>
            <Search size={18} color="var(--color-text-muted)" />
            <input 
              type="text" 
              placeholder="Tìm kiếm dự án..." 
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              style={{ flex: 1, background: 'none', border: 'none', color: 'var(--color-text-main)', outline: 'none', fontSize: '0.875rem', padding: '0.5rem 0' }}
            />
          </div>
          
          <div style={{ width: '1px', height: '24px', backgroundColor: 'var(--color-border)' }}></div>

          <div style={{ position: 'relative' }} ref={filterMenuRef}>
             <button 
                type="button"
                onClick={() => setShowFilterMenu(!showFilterMenu)} 
                style={{ background: 'none', border: 'none', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--color-text-main)', cursor: 'pointer', padding: '0.5rem 1rem', fontSize: '0.875rem' }}
             >
                <Filter size={16} color="var(--color-text-muted)" />
                <span>Tình trạng {selectedStatuses.length < PROJECT_STATUSES.length ? `(${selectedStatuses.length})` : ''}</span>
                <ChevronDown size={14} color="var(--color-text-muted)" />
             </button>
             {showFilterMenu && (
               <div style={{ 
                 position: 'absolute', top: '100%', right: 0, marginTop: '8px', zIndex: 10,
                 backgroundColor: 'rgba(15, 23, 42, 0.85)', backdropFilter: 'blur(16px)', border: '1px solid var(--color-border)',
                 borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-lg)', width: '220px', overflow: 'hidden'
               }}>
                 <div style={{ padding: '8px', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: '600', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Lọc theo tình trạng</span>
                    <button 
                      type="button" 
                      onClick={() => setSelectedStatuses(selectedStatuses.length === PROJECT_STATUSES.length ? [] : PROJECT_STATUSES)}
                      style={{ background: 'none', border: 'none', color: 'var(--color-primary)', fontSize: '0.75rem', cursor: 'pointer' }}
                    >
                      {selectedStatuses.length === PROJECT_STATUSES.length ? 'Bỏ chọn' : 'Chọn tất cả'}
                    </button>
                 </div>
                 <div style={{ display: 'flex', flexDirection: 'column', padding: '4px 0' }}>
                   {PROJECT_STATUSES.map(status => (
                     <label key={status} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', cursor: 'pointer', fontSize: '0.875rem', color: 'var(--color-text-main)' }} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--color-bg-surface-hover)'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}>
                       <div style={{ 
                         width: '16px', height: '16px', borderRadius: '4px', border: `1px solid ${selectedStatuses.includes(status) ? 'var(--color-primary)' : 'var(--color-text-muted)'}`,
                         backgroundColor: selectedStatuses.includes(status) ? 'var(--color-primary)' : 'transparent',
                         display: 'flex', alignItems: 'center', justifyContent: 'center'
                       }}>
                         {selectedStatuses.includes(status) && <Check size={12} color="white" />}
                       </div>
                       <input 
                         type="checkbox" 
                         checked={selectedStatuses.includes(status)} 
                         onChange={() => toggleStatusFilter(status)}
                         style={{ display: 'none' }}
                       />
                       {status}
                     </label>
                   ))}
                 </div>
               </div>
             )}
          </div>
        </div>
        
        {userRole === ROLES.ADMIN && (
          <button className="btn btn-primary" onClick={() => handleOpenForm()} style={{ whiteSpace: 'nowrap' }}>
            <Plus size={18} /> Thêm dự án mới
          </button>
        )}
      </div>

      {/* ── Khu cards — chỉ phần này cuộn ── */}
      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0, paddingRight: '4px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '1.5rem', alignItems: 'start', paddingBottom: '2rem' }}>
          {pagedProjects.map(project => (
            <div 
              key={project.id} 
              className="card" 
              style={{ 
                padding: '0', 
                display: 'flex', 
                flexDirection: 'column', 
                overflow: 'hidden', 
                cursor: 'pointer', 
                transition: 'transform 0.2s ease, box-shadow 0.2s ease'
              }}
              onClick={() => handleOpenForm(project, true)}
              onMouseOver={(e) => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = '0 12px 24px rgba(0,0,0,0.1)'; }}
              onMouseOut={(e) => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06)'; }}
            >
              {project.image && (
                <div style={{ height: '120px', width: '100%', backgroundImage: `url(${project.image})`, backgroundSize: 'cover', backgroundPosition: 'center' }} />
              )}
              <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
                    {project.code && (
                      <span className="badge badge-blue" title="Mã nội bộ">
                        NB: {project.code}
                      </span>
                    )}
                    {project.codeNN && (
                      <span className="badge" style={{ backgroundColor: 'rgba(168,85,247,0.2)', color: '#c084fc', border: '1px solid rgba(168,85,247,0.4)' }} title="Mã NN">
                        NN: {project.codeNN}
                      </span>
                    )}
                    {!project.code && !project.codeNN && (
                      <span className="badge badge-blue">Chưa có mã</span>
                    )}
                    <span className="badge" style={{ backgroundColor: getProjectStatusColor(project.status).bg, color: getProjectStatusColor(project.status).text, border: `1px solid ${getProjectStatusColor(project.status).text}` }}>
                      {project.status || 'Chưa bắt đầu'}
                    </span>
                  </div>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: '600', margin: 0 }}>{project.name}</h3>
                </div>
                <div style={{ display: 'flex', gap: '0.25rem' }}>
                  {userRole === ROLES.ADMIN && (
                    <>
                      <button className="btn-icon" onClick={(e) => { e.stopPropagation(); handleOpenForm(project); }} title="Sửa">
                        <Edit size={16} />
                      </button>
                      <button className="btn-icon" style={{ color: 'var(--color-danger)' }} onClick={(e) => { e.stopPropagation(); handleDelete(project.id); }} title="Xoá">
                        <Trash2 size={16} />
                      </button>
                    </>
                  )}
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
                  <MapPin size={16} style={{ marginTop: '2px', flexShrink: 0 }} />
                  <span>{project.location || 'Chưa cập nhật địa điểm'}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Building size={16} style={{ flexShrink: 0 }} />
                  <span>CĐT: {project.investor}</span>
                </div>
                {project.parentId && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Briefcase size={16} style={{ flexShrink: 0 }} />
                    <span>Dự án cha: {projects.find(p => p.id.toString() === project.parentId)?.name || 'Không xác định'}</span>
                  </div>
                )}
              </div>

              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Phân trang */}
      {filteredProjects.length > 0 && (
        <div style={{
          flexShrink: 0,
          display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem',
          padding: '0.75rem 1rem',
          borderTop: '1px solid var(--color-border)',
          background: 'rgba(15, 23, 42, 0.97)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          boxShadow: '0 -4px 20px rgba(0,0,0,0.35)',
          borderRadius: 'var(--radius-md)',
          flexWrap: 'wrap', rowGap: '0.4rem',
          marginTop: 'auto',
        }}>
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

          <span style={{ marginLeft: '0.5rem', color: 'var(--color-text-muted)', fontSize: '0.8rem' }}>
            Trang <strong style={{ color: 'var(--color-text-main)' }}>{safePage}</strong> / {totalPages}
            &nbsp;·&nbsp;
            {(safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, filteredProjects.length)} / {filteredProjects.length} dự án
          </span>
        </div>
      )}

      {/* Modal dự án — render qua portal để hiện trên cùng app */}
      {isFormOpen && ReactDOM.createPortal(
        <div className="modal-overlay" onClick={handleCloseForm}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ display: 'flex', flexDirection: 'column', maxWidth: '800px', height: '90vh', overflow: 'hidden' }}>
            <form onSubmit={handleSave} style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
              
              <div id="project-printable-area" style={{ display: 'flex', flexDirection: 'column', backgroundColor: 'var(--color-bg-surface)' }}>
                <div id="modal-header-banner" style={{ 
                  padding: formData.image ? '8rem 1.5rem 1.5rem' : '1.5rem 1.5rem', 
                  borderBottom: '1px solid var(--color-border)', 
                  display: 'flex', 
                  justifyContent: 'flex-start', 
                  alignItems: 'flex-end', 
                  backgroundColor: 'var(--color-bg-surface-hover)',
                  backgroundImage: formData.image ? `linear-gradient(to bottom, rgba(0,0,0,0.1) 0%, rgba(0,0,0,0.8) 100%), url(${formData.image})` : 'none',
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                  color: formData.image ? 'white' : 'inherit',
                  position: 'relative'
                }}>
                  <div style={{ position: 'absolute', top: '1.5rem', right: '1.5rem' }}>
                    {isPreviewMode ? (
                      <span className="badge" style={{ 
                        backgroundColor: getProjectStatusColor(formData.status).bg, 
                        color: getProjectStatusColor(formData.status).text, 
                        border: `1px solid ${getProjectStatusColor(formData.status).text}`,
                        backdropFilter: 'blur(4px)'
                      }}>
                        {formData.status || 'Chưa bắt đầu'}
                      </span>
                    ) : (
                      <div style={{ position: 'relative' }} ref={statusMenuRef}>
                        <div 
                          onClick={() => setShowStatusDropdown(!showStatusDropdown)}
                          style={{
                            backgroundColor: getProjectStatusColor(formData.status).bg, 
                            color: getProjectStatusColor(formData.status).text, 
                            padding: '0.25rem 0.75rem', 
                            borderRadius: '100px', 
                            fontSize: '0.75rem', 
                            fontWeight: '600',
                            border: `1px solid ${getProjectStatusColor(formData.status).text}`,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.25rem',
                            backdropFilter: 'blur(4px)'
                          }}
                        >
                          {formData.status || 'Chưa bắt đầu'}
                          <ChevronDown size={14} />
                        </div>
                        {showStatusDropdown && (
                          <div style={{
                            position: 'absolute', top: '100%', right: '0', marginTop: '4px',
                            backgroundColor: 'rgba(15, 23, 42, 0.85)', backdropFilter: 'blur(16px)', 
                            borderRadius: '8px', boxShadow: 'var(--shadow-md)',
                            border: '1px solid var(--color-border)', zIndex: 100,
                            overflow: 'hidden', minWidth: '140px'
                          }}>
                            {PROJECT_STATUSES.map(s => (
                              <div 
                                key={s} 
                                onClick={() => { setFormData({...formData, status: s}); setShowStatusDropdown(false); }}
                                style={{ 
                                  padding: '8px 12px', fontSize: '0.8rem', cursor: 'pointer',
                                  color: formData.status === s ? getProjectStatusColor(s).text : 'var(--color-text-main)',
                                  backgroundColor: formData.status === s ? 'var(--color-bg-surface-hover)' : 'transparent',
                                  display: 'flex', alignItems: 'center', gap: '8px'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--color-bg-surface-hover)'}
                                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = formData.status === s ? 'var(--color-bg-surface-hover)' : 'transparent'}
                              >
                                <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: getProjectStatusColor(s).text }}></span>
                                {s}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  <h2 style={{ fontSize: formData.image ? '2rem' : '1.5rem', fontWeight: '700', margin: 0, display: 'flex', alignItems: 'center', gap: '0.75rem', textShadow: formData.image ? '0 2px 4px rgba(0,0,0,0.6)' : 'none', maxWidth: '80%' }}>
                    <Briefcase size={formData.image ? 28 : 24} color={formData.image ? "white" : "var(--color-primary)"} />
                    {formData.name || (editingProject ? 'Dự án chưa có tên' : 'Thêm dự án mới')}
                  </h2>
                </div>

                <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                  {!isPreviewMode && (
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">
                        Ảnh đại diện dự án
                        <span style={{ color: 'var(--color-text-muted)', fontWeight: '400', fontSize: '0.78rem', marginLeft: '0.5rem' }}>
                          (Tự động nén • Hiển thị ở Header)
                        </span>
                      </label>

                      {/* ── Drag & Drop Zone ── */}
                      <div
                        onDragOver={(e) => { e.preventDefault(); setIsDraggingImage(true); }}
                        onDragLeave={() => setIsDraggingImage(false)}
                        onDrop={(e) => {
                          e.preventDefault();
                          setIsDraggingImage(false);
                          handleFileSelected(e.dataTransfer.files[0]);
                        }}
                        onClick={() => !isUploadingImage && document.getElementById('project-img-input').click()}
                        style={{
                          border: `2px dashed ${isDraggingImage ? '#818cf8' : 'var(--color-border)'}`,
                          borderRadius: 'var(--radius-md)',
                          background: isDraggingImage ? 'rgba(129,140,248,0.08)' : 'var(--color-bg-surface-hover)',
                          cursor: isUploadingImage ? 'wait' : 'pointer',
                          transition: 'all 0.2s',
                          overflow: 'hidden',
                          position: 'relative',
                          minHeight: formData.image ? 'auto' : '110px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        {formData.image ? (
                          <>
                            <img
                              src={formData.image}
                              alt="preview"
                              style={{ width: '100%', height: '160px', objectFit: 'cover', display: 'block' }}
                            />
                            {/* Badge nén + nút xóa */}
                            <div style={{ position: 'absolute', top: '0.5rem', right: '0.5rem', display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                              {imageInfo && (
                                <span style={{
                                  background: 'rgba(0,0,0,0.65)', color: '#6ee7b7',
                                  fontSize: '0.68rem', fontWeight: '700',
                                  padding: '3px 8px', borderRadius: '20px',
                                  backdropFilter: 'blur(4px)', letterSpacing: '0.02em'
                                }}>
                                  ↓ {imageInfo.original} KB → {imageInfo.compressed} KB
                                </span>
                              )}
                              <button
                                type="button"
                                title="Xóa ảnh"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setFormData(prev => ({ ...prev, image: '' }));
                                  setImageInfo(null);
                                }}
                                style={{
                                  background: 'rgba(239,68,68,0.85)', border: 'none',
                                  borderRadius: '50%', width: '26px', height: '26px',
                                  cursor: 'pointer', color: 'white',
                                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  boxShadow: '0 2px 6px rgba(0,0,0,0.4)'
                                }}
                              >
                                <X size={14} />
                              </button>
                            </div>
                            {/* Overlay khi đang upload */}
                            {isUploadingImage && (
                              <div style={{
                                position: 'absolute', inset: 0,
                                background: 'rgba(0,0,0,0.55)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                flexDirection: 'column', gap: '0.5rem'
                              }}>
                                <div style={{ width: '30px', height: '30px', border: '3px solid rgba(255,255,255,0.2)', borderTop: '3px solid white', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                                <span style={{ color: 'white', fontSize: '0.8rem', fontWeight: '600' }}>Nén & tải lên...</span>
                              </div>
                            )}
                          </>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', padding: '1.25rem', textAlign: 'center' }}>
                            {isUploadingImage ? (
                              <>
                                <div style={{ width: '30px', height: '30px', border: '3px solid rgba(255,255,255,0.1)', borderTop: '3px solid var(--color-primary)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                                <span style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>Nén & tải lên...</span>
                              </>
                            ) : (
                              <>
                                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: isDraggingImage ? '#818cf8' : 'var(--color-text-muted)' }}>
                                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                                  <circle cx="12" cy="13" r="4"/>
                                </svg>
                                <p style={{ fontWeight: '600', color: 'var(--color-text-main)', margin: 0, fontSize: '0.9rem' }}>Kéo &amp; thả ảnh vào đây</p>
                                <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', margin: 0 }}>
                                  hoặc nhấn để chọn • JPG, PNG, WEBP • Tự động nén
                                </p>
                              </>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Input file ẩn */}
                      <input
                        id="project-img-input"
                        type="file"
                        accept="image/*"
                        style={{ display: 'none' }}
                        onChange={handleImageUpload}
                      />
                    </div>
                  )}
                  {/* Lưới 3 cột: Mã NB | Mã NN | Tên dự án */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 2fr', gap: '1rem' }}>

                  {/* Mã dự án nội bộ */}
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Mã dự án nội bộ</label>
                    <input
                      type="text"
                      className="input-field"
                      disabled={isPreviewMode}
                      value={formData.code}
                      onChange={e => setFormData({...formData, code: e.target.value})}
                      placeholder="VD: CNS-1..."
                      style={{ borderColor: formData.code && projects.some(p => p.code === formData.code && (!editingProject || p.id !== editingProject.id)) ? 'var(--color-danger)' : undefined }}
                    />
                    {formData.code && projects.some(p => p.code === formData.code && (!editingProject || p.id !== editingProject.id)) && (
                      <span style={{ color: 'var(--color-danger)', fontSize: '0.73rem', marginTop: '0.25rem', display: 'block' }}>
                        ⚠️ Mã nội bộ đã tồn tại.
                      </span>
                    )}
                  </div>

                  {/* Mã dự án NN */}
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Mã dự án NN</label>
                    <input
                      type="text"
                      className="input-field"
                      disabled={isPreviewMode}
                      value={formData.codeNN || ''}
                      onChange={e => setFormData({...formData, codeNN: e.target.value})}
                      placeholder="Nhập thủ công..."
                      style={{ borderColor: formData.codeNN && projects.some(p => p.codeNN && p.codeNN === formData.codeNN && (!editingProject || p.id !== editingProject.id)) ? 'var(--color-danger)' : undefined }}
                    />
                    {formData.codeNN && projects.some(p => p.codeNN && p.codeNN === formData.codeNN && (!editingProject || p.id !== editingProject.id)) && (
                      <span style={{ color: 'var(--color-danger)', fontSize: '0.73rem', marginTop: '0.25rem', display: 'block' }}>
                        ⚠️ Mã NN đã tồn tại.
                      </span>
                    )}
                  </div>

                  {/* Tên dự án */}
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Tên dự án <span style={{ color: 'var(--color-danger)' }}>*</span></label>
                    <input required type="text" className="input-field" disabled={isPreviewMode} value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="Nhập tên dự án..." />
                  </div>

                  </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Địa điểm dự án</label>
                {isPreviewMode ? (
                  <div style={{ padding: '0.5rem 0.75rem', backgroundColor: 'var(--color-bg-surface-hover)', borderRadius: 'var(--radius-sm)', minHeight: '2.5rem', display: 'flex', alignItems: 'center', border: '1px solid var(--color-border)' }}>
                    <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(formData.location)}`} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-primary)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: '500' }}>
                      <MapPin size={16} /> {formData.location || 'Chưa cập nhật địa điểm'}
                    </a>
                  </div>
                ) : (
                  <input type="text" className="input-field" value={formData.location} onChange={e => setFormData({...formData, location: e.target.value})} placeholder="Nhập địa chỉ dự án (VD: Quận 1, TP.HCM)..." />
                )}
                
                {formData.location && (
                  <div data-html2canvas-ignore="true" style={{ width: '100%', height: '200px', borderRadius: 'var(--radius-md)', overflow: 'hidden', border: '1px solid var(--color-border)', marginTop: '0.75rem' }}>
                    <iframe
                      width="100%"
                      height="100%"
                      style={{ border: 0 }}
                      loading="lazy"
                      allowFullScreen
                      src={`https://www.google.com/maps?q=${encodeURIComponent(formData.location)}&output=embed`}
                    ></iframe>
                  </div>
                )}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Chủ đầu tư</label>
                  <input type="text" className="input-field" disabled={isPreviewMode} value={formData.investor} onChange={e => setFormData({...formData, investor: e.target.value})} />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Dự án cha</label>
                  <select className="input-field" disabled={isPreviewMode} value={formData.parentId} onChange={e => setFormData({...formData, parentId: e.target.value})}>
                    <option value="">-- Không có --</option>
                    {projects.filter(p => !editingProject || p.id !== editingProject.id).map(p => (
                      <option key={p.id} value={p.id.toString()}>{p.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                <button type="button" className="btn btn-outline" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--color-primary)', borderColor: 'var(--color-primary)' }} onClick={() => setShowMembersSection(!showMembersSection)}>
                  <Users size={16} /> {showMembersSection ? 'Ẩn danh sách thành viên' : 'Thành viên CĐT'}
                </button>
                <button type="button" className="btn btn-outline" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--color-primary)', borderColor: 'var(--color-primary)' }} onClick={() => setShowDocsSection(!showDocsSection)}>
                  <FileText size={16} /> {showDocsSection ? 'Ẩn tài liệu đính kèm' : 'Xem tài liệu đính kèm'}
                </button>
              </div>



              {showMembersSection && (
                <div style={{ marginTop: '1rem', padding: '1.5rem', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--color-bg-surface)' }}>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: '600', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Users size={18} color="var(--color-primary)" />
                    Thành viên dự án
                  </h3>
                  <div style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                      <thead style={{ backgroundColor: 'var(--color-bg-surface-hover)' }}>
                        <tr>
                          <th style={{ padding: '0.75rem', textAlign: 'center', borderBottom: '1px solid var(--color-border)', width: '60px' }}>STT</th>
                          <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid var(--color-border)' }}>Tên thành viên</th>
                          <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid var(--color-border)' }}>Email</th>
                          <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid var(--color-border)' }}>Vai trò</th>
                          {!isPreviewMode && <th style={{ padding: '0.75rem', textAlign: 'center', borderBottom: '1px solid var(--color-border)', width: '80px' }}>Xóa</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {formData.projectMembers.length === 0 ? (
                          <tr>
                            <td colSpan={isPreviewMode ? 4 : 5} style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                              Chưa có thành viên nào được thêm vào dự án này.
                            </td>
                          </tr>
                        ) : (
                          formData.projectMembers.map((member, index) => {
                            const memberInfo = members.find(m => m.id.toString() === member.memberId?.toString());
                            return (
                              <tr key={index} style={{ borderBottom: index < formData.projectMembers.length - 1 ? '1px solid var(--color-border)' : 'none' }}>
                                <td style={{ padding: '0.75rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>{index + 1}</td>
                                <td style={{ padding: '0.75rem' }}>
                                  {isPreviewMode ? (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: '500' }}>
                                      {memberInfo?.avatar && <img src={memberInfo.avatar} alt={memberInfo.name} style={{ width: '24px', height: '24px', borderRadius: '50%', objectFit: 'cover' }} />}
                                      {memberInfo ? memberInfo.name : 'Không xác định'}
                                    </div>
                                  ) : (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                      {memberInfo?.avatar && <img src={memberInfo.avatar} alt={memberInfo.name} style={{ width: '24px', height: '24px', borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />}
                                      <select 
                                        className="input-field" 
                                        style={{ padding: '0.4rem 0.75rem', margin: 0, flex: 1 }}
                                        value={member.memberId}
                                        onChange={(e) => {
                                          const newMembers = [...formData.projectMembers];
                                          newMembers[index].memberId = e.target.value;
                                          setFormData({...formData, projectMembers: newMembers});
                                        }}
                                      >
                                        <option value="">-- Chọn thành viên --</option>
                                        {members
                                          .filter(m => !formData.projectMembers.some((pm, pmIdx) =>
                                            pmIdx !== index && String(pm.memberId) === String(m.id)
                                          ))
                                          .map(m => (
                                            <option key={m.id} value={m.id}>{m.name}</option>
                                          ))}
                                      </select>
                                    </div>
                                  )}
                                </td>
                                <td style={{ padding: '0.75rem', color: 'var(--color-text-muted)' }}>
                                  {memberInfo?.email || ''}
                                </td>
                                <td style={{ padding: '0.75rem' }}>
                                  {isPreviewMode ? (
                                    <span style={{ backgroundColor: 'rgba(130, 168, 209, 0.15)', color: 'var(--color-primary)', padding: '0.25rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: '500' }}>
                                      {member.role || 'Chưa phân quyền'}
                                    </span>
                                  ) : (
                                    <select 
                                      className="input-field" 
                                      style={{ padding: '0.4rem 0.75rem', margin: 0 }}
                                      value={member.role}
                                      onChange={(e) => {
                                        const newMembers = [...formData.projectMembers];
                                        newMembers[index].role = e.target.value;
                                        setFormData({...formData, projectMembers: newMembers});
                                      }}
                                    >
                                      <option value="">-- Chọn vai trò --</option>
                                      {projectRoles.map(role => (
                                        <option key={role} value={role}>{role}</option>
                                      ))}
                                    </select>
                                  )}
                                </td>
                                {!isPreviewMode && (
                                  <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                                    <button 
                                      type="button" 
                                      className="btn-icon" 
                                      style={{ color: 'var(--color-danger)' }} 
                                      onClick={() => {
                                        const newMembers = formData.projectMembers.filter((_, i) => i !== index);
                                        setFormData({...formData, projectMembers: newMembers});
                                      }}
                                    >
                                      <X size={16} />
                                    </button>
                                  </td>
                                )}
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                  {!isPreviewMode && (
                    <button 
                      type="button" 
                      className="btn btn-outline" 
                      style={{ marginTop: '1rem', width: '100%', borderStyle: 'dashed' }}
                      onClick={() => setFormData({
                        ...formData, 
                        projectMembers: [...formData.projectMembers, { memberId: '', role: '' }]
                      })}
                    >
                      <Plus size={16} style={{ marginRight: '4px' }} /> Thêm thành viên
                    </button>
                  )}
                </div>
              )}

              {showDocsSection && (
                <div style={{ marginTop: '1rem', padding: '1.5rem', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--color-bg-surface)' }}>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: '600', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <FileText size={18} color="var(--color-primary)" />
                    Tài liệu đính kèm
                  </h3>
                  <div style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                      <thead style={{ backgroundColor: 'var(--color-bg-surface-hover)' }}>
                        <tr>
                          <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid var(--color-border)' }}>Số hiệu</th>
                          <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid var(--color-border)', width: '60%' }}>Trích yếu</th>
                          <th style={{ padding: '0.75rem', textAlign: 'center', borderBottom: '1px solid var(--color-border)' }}>Đính kèm</th>
                        </tr>
                      </thead>
                      <tbody>
                {(() => {
                  const projectDocs = documents.filter(d =>
                    !d.isDeleted &&
                    Array.isArray(d.relatedProjects) &&
                    d.relatedProjects.includes(formData.name)
                  ).sort((a, b) => {
                    const dA = a.effectiveDate ? new Date(a.effectiveDate) : new Date(0);
                    const dB = b.effectiveDate ? new Date(b.effectiveDate) : new Date(0);
                    return dB - dA;
                  });

                  if (projectDocs.length === 0) return (
                    <tr>
                      <td colSpan={3} style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                        Chưa có tài liệu nào đính kèm cho dự án này.
                      </td>
                    </tr>
                  );

                  return projectDocs.map((doc) => (
                    <tr key={doc.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                      <td style={{ padding: '0.75rem', fontWeight: '500' }}>{doc.documentNumber}</td>
                      <td style={{ padding: '0.75rem' }}>{doc.summary}</td>
                      <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                        {doc.attachments && doc.attachments.length > 0 ? (
                          <div style={{ display: 'flex', gap: '0.35rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                            {doc.attachments.map((att, i) => (
                              <button
                                key={i}
                                type="button"
                                title={att.name || 'Xem tệp'}
                                onClick={() => setPdfViewerFile(att)}
                                style={{ background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.3)', borderRadius: '6px', color: '#60a5fa', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '28px', height: '28px' }}
                              >
                                <Eye size={14} />
                              </button>
                            ))}
                          </div>
                        ) : (
                          <span style={{ color: 'var(--color-text-muted)' }}>-</span>
                        )}
                      </td>
                    </tr>
                  ));
                })()}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <hr style={{ border: 'none', borderTop: '1px solid var(--color-border)', margin: '0.5rem 0' }} />
              
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: '600', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }} onClick={() => setIsPlanningSectionCollapsed(!isPlanningSectionCollapsed)}>
                    <Activity size={18} color="var(--color-primary)" />
                    Thông tin quy hoạch
                    <button 
                      type="button" 
                      style={{ background: 'none', border: 'none', color: 'var(--color-danger)', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '0 4px', transition: 'color 0.2s', marginLeft: '2px' }}
                      title={isPlanningSectionCollapsed ? "Hiện thông tin" : "Ẩn thông tin"}
                      onMouseEnter={(e) => e.currentTarget.style.color = '#ef4444'}
                      onMouseLeave={(e) => e.currentTarget.style.color = 'var(--color-danger)'}
                    >
                      {isPlanningSectionCollapsed ? <ChevronDown size={20} /> : <ChevronUp size={20} />}
                    </button>
                  </h3>
                </div>
                
              {!isPlanningSectionCollapsed && (
                <div style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                  <table className="datasheet-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                    <thead style={{ backgroundColor: 'var(--color-bg-surface-hover)' }}>
                      <tr>
                        {!isPreviewMode && (
                          <th style={{ padding: '0.6rem 0.4rem', borderBottom: '1px solid var(--color-border)', width: '28px' }}></th>
                        )}
                        <th style={{ padding: '0.6rem 0.75rem', textAlign: 'center', borderBottom: '1px solid var(--color-border)', width: '48px', color: 'var(--color-text-muted)', fontWeight: '600' }}>STT</th>
                        <th style={{ padding: '0.6rem 0.75rem', textAlign: 'left', borderBottom: '1px solid var(--color-border)', fontWeight: '600' }}>Nội dung</th>
                        <th style={{ padding: '0.6rem 0.75rem', textAlign: 'left', borderBottom: '1px solid var(--color-border)', width: '38%', fontWeight: '600' }}>Giá trị</th>
                        {!isPreviewMode && (
                          <th style={{ padding: '0.6rem 0.5rem', borderBottom: '1px solid var(--color-border)', width: '36px' }}></th>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {formData.details.map((detail, index) => (
                        <tr
                          key={detail.id}
                          draggable={!isPreviewMode}
                          onDragStart={() => handleRowDragStart(index)}
                          onDragOver={e => handleRowDragOver(e, index)}
                          onDrop={() => handleRowDrop(index)}
                          onDragEnd={handleRowDragEnd}
                          style={{
                            borderBottom: index < formData.details.length - 1 ? '1px solid var(--color-border)' : 'none',
                            opacity: dragRowRef.current === index ? 0.4 : 1,
                            backgroundColor: dragOverIndex === index ? 'rgba(99,102,241,0.08)' : 'transparent',
                            transition: 'background 0.15s',
                            outline: dragOverIndex === index ? '2px solid rgba(99,102,241,0.4)' : 'none',
                          }}
                        >
                          {/* Tay nắm kéo */}
                          {!isPreviewMode && (
                            <td style={{ padding: '0.25rem 0.4rem', textAlign: 'center', cursor: 'grab', color: 'var(--color-text-muted)' }}>
                              <GripVertical size={14} />
                            </td>
                          )}
                          {/* STT */}
                          <td style={{ padding: '0.5rem', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '0.8rem', userSelect: 'none' }}>
                            {index + 1}
                          </td>

                          {/* Đơn vị */}
                          <td style={{ padding: isPreviewMode ? '0.5rem 0.75rem' : '0.25rem 0.35rem' }}>
                            {isPreviewMode ? (
                              <span style={{ fontWeight: '500' }}>{detail.name}</span>
                            ) : (
                              <input
                                type="text"
                                className="datasheet-input"
                                value={detail.name}
                                onChange={e => handleDetailChange(index, 'name', e.target.value)}
                                placeholder="Nhập nội dung..."
                                style={{ width: '100%', fontWeight: '500' }}
                              />
                            )}
                          </td>

                          {/* Giá trị */}
                          <td style={{ padding: isPreviewMode ? '0.5rem 0.75rem' : '0.25rem 0.35rem' }}>
                            {isPreviewMode ? (
                              <span>{detail.value || <span style={{ color: 'var(--color-text-muted)', fontStyle: 'italic' }}>Chưa cập nhật</span>}</span>
                            ) : (
                              <input
                                type="text"
                                className="datasheet-input"
                                value={detail.value}
                                onChange={e => handleDetailChange(index, 'value', e.target.value)}
                                placeholder="Nhập giá trị..."
                                style={{ width: '100%' }}
                              />
                            )}
                          </td>

                          {/* Nút xóa hàng */}
                          {!isPreviewMode && (
                            <td style={{ padding: '0.25rem', textAlign: 'center' }}>
                              <button
                                type="button"
                                title="Xóa hàng"
                                onClick={() => handleDeleteDetailRow(index)}
                                style={{
                                  background: 'none', border: 'none',
                                  color: 'var(--color-text-muted)', cursor: 'pointer',
                                  width: '26px', height: '26px', borderRadius: '4px',
                                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  transition: 'color 0.15s, background 0.15s'
                                }}
                                onMouseEnter={e => { e.currentTarget.style.color = 'var(--color-danger)'; e.currentTarget.style.background = 'rgba(239,68,68,0.1)'; }}
                                onMouseLeave={e => { e.currentTarget.style.color = 'var(--color-text-muted)'; e.currentTarget.style.background = 'none'; }}
                              >
                                <X size={14} />
                              </button>
                            </td>
                          )}
                        </tr>
                      ))}

                      {/* Hàng thêm mới */}
                      {!isPreviewMode && (
                        <tr>
                          <td colSpan={4} style={{ padding: '0.4rem 0.5rem' }}>
                            <button
                              type="button"
                              onClick={handleAddDetailRow}
                              style={{
                                display: 'flex', alignItems: 'center', gap: '0.4rem',
                                background: 'none', border: '1px dashed var(--color-border)',
                                borderRadius: '6px', color: 'var(--color-text-muted)',
                                cursor: 'pointer', fontSize: '0.8rem', padding: '0.35rem 0.75rem',
                                width: '100%', justifyContent: 'center',
                                transition: 'color 0.15s, border-color 0.15s'
                              }}
                              onMouseEnter={e => { e.currentTarget.style.color = 'var(--color-primary)'; e.currentTarget.style.borderColor = 'var(--color-primary)'; }}
                              onMouseLeave={e => { e.currentTarget.style.color = 'var(--color-text-muted)'; e.currentTarget.style.borderColor = 'var(--color-border)'; }}
                            >
                              <Plus size={14} /> Thêm hàng
                            </button>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
              </div>
              </div>

              <div data-html2canvas-ignore="true" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto', padding: '1rem 1.5rem', borderTop: '1px solid var(--color-border)', position: 'sticky', bottom: 0, backgroundColor: 'var(--color-bg-surface)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', zIndex: 10 }}>
                <button
                  type="button"
                  className="btn btn-outline"
                  disabled={isExporting}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--color-success)', borderColor: 'var(--color-success)', opacity: isExporting ? 0.6 : 1 }}
                  onClick={handleExportPDF}
                >
                  <Download size={18} /> {isExporting ? 'Đang xuất PDF...' : 'Xuất dữ liệu PDF'}
                </button>
                <div style={{ display: 'flex', gap: '1rem' }}>
                  {isPreviewMode ? (
                    <>
                      {userRole === ROLES.ADMIN && (
                        <button type="button" className="btn btn-outline" onClick={() => setIsPreviewMode(false)} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <Edit size={16} /> Sửa dự án
                        </button>
                      )}
                      <button type="button" className="btn btn-primary" onClick={handleCloseForm}>Đóng</button>
                    </>
                  ) : (
                    <>
                      <button type="button" className="btn btn-outline" onClick={handleCloseForm}>Hủy bỏ</button>
                      <button type="submit" className="btn btn-primary">Lưu dự án</button>
                    </>
                  )}
                </div>
              </div>
            </form>
          </div>
        </div>
      , document.body)}

      {/* PDF Viewer Modal cho tài liệu trong dự án — cũng qua portal */}
      {pdfViewerFile && ReactDOM.createPortal(
        <PdfViewerModal file={pdfViewerFile} onClose={() => setPdfViewerFile(null)} />,
        document.body
      )}
    </div>
  );
};

export default Projects;
