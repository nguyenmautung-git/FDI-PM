import React, { useState, useContext, useRef, useEffect, useDeferredValue } from 'react';
import ReactDOM from 'react-dom';
import { ROLES } from '../constants';
import { Plus, Edit, Trash2, MapPin, Building, Activity, FileText, Briefcase, Eye, Download, Users, X, Link, ChevronDown, ChevronUp, Search, Filter, Check, GripVertical, ChevronLeft, ChevronRight, CornerDownRight, FolderPlus, ArrowRight, ArrowLeft, AlignLeft, AlignCenter, AlignRight } from 'lucide-react';
import { DocumentContext } from '../context/DocumentContext';
import { useToast, useConfirm } from '../context/UIContext';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../firebase';
import PdfViewerModal from './PdfViewerModal';
import { PROJECT_DETAILS_TEMPLATE, PROJECT_ROLES, getPastelColor } from '../data';
import { isDocRelatedToProject } from '../utils/projectMatcher';

const PROJECT_STATUSES = ['Chưa bắt đầu', 'Đang thực hiện', 'Đã hoàn thành', 'Đã bị hủy'];
const getProjectStatusColor = (s) => {
  if (s === 'Đang thực hiện') return { bg: 'rgba(59, 130, 246, 0.2)', text: '#93c5fd' };
  if (s === 'Đã hoàn thành') return { bg: 'rgba(16, 185, 129, 0.2)', text: '#6ee7b7' };
  if (s === 'Đã bị hủy') return { bg: 'rgba(239, 68, 68, 0.2)', text: '#fca5a5' };
  return { bg: 'rgba(148, 163, 184, 0.2)', text: '#cbd5e1' };
};

const Projects = ({ focusProjectId = null, onFocusCleared }) => {
  const { userRole, projects, addProject, editProject, deleteProject, members, documents, allDocuments, globalLists } = useContext(DocumentContext);
  const docsList = (allDocuments && allDocuments.length > 0) ? allDocuments : (documents || []);
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
    coordinates: '',
    investor: 'Công ty TNHH Hạ tầng công nghệ số FPT',
    parentId: '',
    image: '',
    status: 'Chưa bắt đầu',
    detailColumns: [
      { key: 'name', label: 'Nội dung' },
      { key: 'value', label: 'Giá trị' }
    ],
    details: PROJECT_DETAILS_TEMPLATE.map((d, i) => ({ ...d, id: d.id ? String(d.id) : `row_${i}` })),
    projectMembers: [],
    tasks: []
  };
  
  const [formData, setFormData] = useState(defaultFormData);
  const [showCoordInput, setShowCoordInput] = useState(false);
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

  // Advanced Table State (Word/Excel features)
  const [selectedRowIds, setSelectedRowIds] = useState([]);         // Multi-selection (Ctrl / Shift)
  const [lastSelectedRowIndex, setLastSelectedRowIndex] = useState(null);
  const [collapsedGroupIds, setCollapsedGroupIds] = useState(new Set()); // Thu gọn/bung rộng group
  const [columnWidths, setColumnWidths] = useState({});             // Kéo chỉnh độ rộng cột
  const resizingColRef = useRef(null);                              // Resizer handle ref
  const [hoverInsertRowIndex, setHoverInsertRowIndex] = useState(null);
  const [hoverInsertColIndex, setHoverInsertColIndex] = useState(null);

  const [searchTerm, setSearchTerm] = useState(() => localStorage.getItem('projectSearchTerm') || '');
  const [selectedStatuses, setSelectedStatuses] = useState(() => {
    const saved = localStorage.getItem('projectStatuses');
    return saved ? JSON.parse(saved) : ['Đang thực hiện'];
  });
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const filterMenuRef = useRef(null);
  const dragRowRef    = useRef(null);     // Multi-drag ref
  const [dragOverIndex, setDragOverIndex] = useState(null); // index đang hover
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 3;

  const projectDocs = React.useMemo(() => {
    return docsList.filter(d => isDocRelatedToProject(d, formData, editingProject)).sort((a, b) => {
      const dA = a.effectiveDate ? new Date(a.effectiveDate) : new Date(0);
      const dB = b.effectiveDate ? new Date(b.effectiveDate) : new Date(0);
      return dB - dA;
    });
  }, [docsList, formData, editingProject]);

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
        coordinates: project.coordinates || '',
        detailColumns: project.detailColumns && project.detailColumns.length > 0
          ? project.detailColumns
          : [
              { key: 'name', label: 'Nội dung' },
              { key: 'value', label: 'Giá trị' }
            ],
        details: (project.details && project.details.length > 0
          ? project.details
          : [...PROJECT_DETAILS_TEMPLATE]).map((d, i) => ({
            ...d,
            id: d.id ? String(d.id) : (d.key ? String(d.key) : `row_${i}_${Date.now()}`)
          })),
        projectMembers: project.projectMembers || [],
        tasks: project.tasks || []
      });
      setShowCoordInput(!!project.coordinates);
      setShowMembersSection(false);
      setShowDocsSection(false);
      setIsPlanningSectionCollapsed(false); // Tự động mở rộng khi xem dự án
    } else {
      setEditingProject(null);
      setIsPreviewMode(false);
      setFormData(defaultFormData);
      setShowCoordInput(false);
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
    const linkedDocs = docsList.filter(d => isDocRelatedToProject(d, proj));
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

  const handleColumnLabelChange = (colKey, newLabel) => {
    const cols = formData.detailColumns || [
      { key: 'name', label: 'Nội dung' },
      { key: 'value', label: 'Giá trị' }
    ];
    const newCols = cols.map(c => c.key === colKey ? { ...c, label: newLabel } : c);
    setFormData(prev => ({
      ...prev,
      detailColumns: newCols
    }));
  };

  const handleDeleteColumn = (colKey) => {
    const cols = formData.detailColumns || [
      { key: 'name', label: 'Nội dung' },
      { key: 'value', label: 'Giá trị' }
    ];
    if (cols.length <= 1) {
      toast.warning('Bảng cần có ít nhất 1 cột');
      return;
    }
    const newCols = cols.filter(c => c.key !== colKey);
    setFormData(prev => ({
      ...prev,
      detailColumns: newCols
    }));
  };

  // Chèn thêm cột ở bất kỳ vị trí nào (Word table style)
  const handleInsertColumnAt = (colIndex) => {
    const cols = formData.detailColumns || [
      { key: 'name', label: 'Nội dung' },
      { key: 'value', label: 'Giá trị' }
    ];
    const newKey = `col_${Date.now()}`;
    const newCol = { key: newKey, label: `Cột ${cols.length + 1}` };
    const newCols = [...cols];
    newCols.splice(colIndex, 0, newCol);
    setFormData(prev => ({
      ...prev,
      detailColumns: newCols
    }));
    setHoverInsertColIndex(null);
  };

  // Chèn thêm hàng / nhóm ở bất kỳ vị trí nào (Word table style)
  const handleInsertRowAt = (rowIndex, isGroup = false, targetLevel = 0) => {
    const newId = isGroup ? `group_${Date.now()}_${Math.random().toString(36).substr(2, 4)}` : `detail_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
    const newRow = isGroup
      ? { id: newId, isGroup: true, name: 'NHÓM THÔNG TIN MỚI', level: targetLevel }
      : { id: newId, name: '', value: '', level: targetLevel };

    const newDetails = [...formData.details];
    newDetails.splice(rowIndex, 0, newRow);
    setFormData(prev => ({
      ...prev,
      details: newDetails
    }));
    setHoverInsertRowIndex(null);
  };

  // Tăng/giảm cấp độ phân nhóm (Cha / Con / Cháu...)
  const handleChangeRowLevel = (index, delta) => {
    const newDetails = [...formData.details];
    const currentLevel = newDetails[index].level || 0;
    const newLevel = Math.max(0, Math.min(4, currentLevel + delta));
    newDetails[index] = { ...newDetails[index], level: newLevel };
    setFormData(prev => ({
      ...prev,
      details: newDetails
    }));
  };

  const getRowId = (detail, index) => detail.id ? String(detail.id) : (detail.key ? String(detail.key) : `row_${index}`);

  const handleDeleteDetailRow = (index) => {
    const deletedItem = formData.details[index];
    const deletedId = deletedItem ? getRowId(deletedItem, index) : null;
    const newDetails = formData.details.filter((_, i) => i !== index);
    setFormData({ ...formData, details: newDetails });
    if (deletedId) {
      setSelectedRowIds(prev => prev.filter(id => id !== deletedId));
    }
  };

  // Xóa các hàng đang được chọn (Multi-select delete)
  const handleDeleteSelectedRows = () => {
    if (selectedRowIds.length === 0) return;
    const count = selectedRowIds.length;
    const newDetails = formData.details.filter((d, i) => !selectedRowIds.includes(getRowId(d, i)));
    setFormData({ ...formData, details: newDetails });
    setSelectedRowIds([]);
    toast.success(`Đã xóa ${count} hàng`);
  };

  // Tăng/giảm thụt lề cho tất cả hàng đang chọn
  const handleIndentSelectedRows = (delta) => {
    if (selectedRowIds.length === 0) return;
    const newDetails = formData.details.map((d, i) => {
      const rowId = getRowId(d, i);
      if (selectedRowIds.includes(rowId)) {
        const curLvl = d.level || 0;
        return { ...d, level: Math.max(0, Math.min(4, curLvl + delta)) };
      }
      return d;
    });
    setFormData({ ...formData, details: newDetails });
  };

  // Thu gọn / bung rộng group (Nested Collapse)
  const toggleGroupCollapse = (groupId) => {
    const sGroupId = String(groupId);
    setCollapsedGroupIds(prev => {
      const next = new Set(prev);
      if (next.has(sGroupId)) next.delete(sGroupId);
      else next.add(sGroupId);
      return next;
    });
  };

  // Canh lề cột (Căn trái / Căn giữa / Căn phải)
  const handleToggleColumnAlign = (colKey) => {
    const cols = formData.detailColumns || [
      { key: 'name', label: 'Nội dung', align: 'left' },
      { key: 'value', label: 'Giá trị', align: 'left' }
    ];
    const newCols = cols.map(c => {
      if (c.key === colKey) {
        const curAlign = c.align || 'left';
        const nextAlign = curAlign === 'left' ? 'center' : (curAlign === 'center' ? 'right' : 'left');
        return { ...c, align: nextAlign };
      }
      return c;
    });
    setFormData(prev => ({
      ...prev,
      detailColumns: newCols
    }));
  };

  // Chọn / bỏ chọn dòng theo dấu tick đầu hàng
  const handleToggleRowSelect = (rowId, e) => {
    if (isPreviewMode) return;
    if (e && e.stopPropagation) e.stopPropagation();
    if (!rowId) return;

    const sRowId = String(rowId);
    setSelectedRowIds(prev => {
      if (prev.includes(sRowId)) return prev.filter(id => id !== sRowId);
      return [...prev, sRowId];
    });
  };

  // Drag & Drop cho multi-row
  const handleRowDragStart = (e, index) => {
    const item = formData.details[index];
    const rowId = getRowId(item, index);
    let toDragIds = selectedRowIds;
    if (!toDragIds.includes(rowId)) {
      toDragIds = [rowId];
      setSelectedRowIds([rowId]);
    }
    dragRowRef.current = {
      draggedIndex: index,
      draggedIds: toDragIds
    };
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleRowDragOver = (e, index) => {
    e.preventDefault();
    if (dragRowRef.current && dragOverIndex !== index) {
      setDragOverIndex(index);
    }
  };

  const handleRowDrop = (targetIndex) => {
    if (!dragRowRef.current) return;
    const { draggedIds } = dragRowRef.current;
    if (!draggedIds || draggedIds.length === 0) {
      setDragOverIndex(null);
      return;
    }

    const currentDetails = [...formData.details];
    const draggedItems = [];
    const remainingItems = [];

    currentDetails.forEach((item, i) => {
      const rowId = getRowId(item, i);
      if (draggedIds.includes(rowId)) {
        draggedItems.push(item);
      } else {
        remainingItems.push(item);
      }
    });

    const targetItem = currentDetails[targetIndex];
    const targetRowId = targetItem ? getRowId(targetItem, targetIndex) : null;
    let newInsertIndex = remainingItems.findIndex((item, i) => getRowId(item, i) === targetRowId);
    if (newInsertIndex === -1) {
      newInsertIndex = remainingItems.length;
    }

    // Chèn danh sách kéo vào vị trí đích
    remainingItems.splice(newInsertIndex, 0, ...draggedItems);

    setFormData(prev => ({ ...prev, details: remainingItems }));
    dragRowRef.current = null;
    setDragOverIndex(null);
  };

  const handleRowDragEnd = () => {
    dragRowRef.current = null;
    setDragOverIndex(null);
  };

  // Điều chỉnh chiều rộng cột kéo thả (Column resizing)
  const handleResizerMouseDown = (colKey, e) => {
    e.preventDefault();
    e.stopPropagation();
    const thElement = e.currentTarget.parentElement;
    const currentWidth = thElement ? thElement.offsetWidth : 150;
    resizingColRef.current = {
      key: colKey,
      startX: e.clientX,
      startWidth: currentWidth
    };

    const handleMouseMove = (moveEvent) => {
      if (!resizingColRef.current) return;
      const diff = moveEvent.clientX - resizingColRef.current.startX;
      const newWidth = Math.max(75, resizingColRef.current.startWidth + diff);
      setColumnWidths(prev => ({
        ...prev,
        [resizingColRef.current.key]: newWidth
      }));
    };

    const handleMouseUp = () => {
      resizingColRef.current = null;
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  // Double click vào resizer -> Autofit độ rộng vừa vặn nội dung
  const handleResizerDoubleClick = (colKey) => {
    let maxCharLen = 10;
    const col = (formData.detailColumns || []).find(c => c.key === colKey);
    if (col && col.label) maxCharLen = Math.max(maxCharLen, col.label.length);

    formData.details.forEach(d => {
      const val = d[colKey];
      if (val && typeof val === 'string') {
        maxCharLen = Math.max(maxCharLen, val.length);
      }
    });

    const autoFitWidth = Math.min(500, Math.max(90, maxCharLen * 9 + 45));
    setColumnWidths(prev => ({
      ...prev,
      [colKey]: autoFitWidth
    }));
    toast.success(`Đã tự động căn chỉnh (Autofit) cột "${col?.label || colKey}"!`);
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
              name="project-search-query"
              id="project-search-query"
              autoComplete="off"
              placeholder="Tìm kiếm dự án..." 
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              style={{ flex: 1, background: 'none', border: 'none', color: 'var(--color-text-main)', outline: 'none', fontSize: '0.875rem', padding: '0.5rem 0' }}
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer', padding: '2px 4px', display: 'flex', alignItems: 'center', borderRadius: '4px' }}
                title="Xóa tìm kiếm"
              >
                <X size={14} />
              </button>
            )}
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
        {filteredProjects.length === 0 ? (
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            padding: '4rem 1rem', gap: '1rem', color: 'var(--color-text-muted)', textAlign: 'center'
          }}>
            <Building2 size={48} strokeWidth={1.5} opacity={0.4} />
            <div>
              <div style={{ fontSize: '1.05rem', fontWeight: '600', color: 'var(--color-text-main)', marginBottom: '0.35rem' }}>
                Không tìm thấy dự án nào
              </div>
              <div style={{ fontSize: '0.85rem' }}>
                {searchTerm || selectedStatuses.length < PROJECT_STATUSES.length ? 'Không có dự án phù hợp với từ khóa tìm kiếm hoặc bộ lọc hiện tại.' : 'Chưa có dự án nào trong hệ thống.'}
              </div>
            </div>
            {(searchTerm || selectedStatuses.length < PROJECT_STATUSES.length) && (
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => {
                  setSearchTerm('');
                  setSelectedStatuses(PROJECT_STATUSES);
                }}
                style={{ fontSize: '0.82rem', padding: '0.4rem 0.9rem' }}
              >
                Đặt lại tìm kiếm & bộ lọc
              </button>
            )}
          </div>
        ) : (
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
      )}
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
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                  <label className="form-label" style={{ marginBottom: 0, display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <MapPin size={16} color="var(--color-primary)" /> Địa điểm dự án
                  </label>
                  {!isPreviewMode && (
                    <button
                      type="button"
                      onClick={() => setShowCoordInput(prev => !prev)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.35rem',
                        padding: '0.2rem 0.6rem',
                        borderRadius: '6px',
                        fontSize: '0.78rem',
                        color: (formData.coordinates || showCoordInput) ? 'var(--color-primary)' : 'var(--color-text-muted)',
                        backgroundColor: (formData.coordinates || showCoordInput) ? 'rgba(59, 130, 246, 0.12)' : 'transparent',
                        border: '1px solid',
                        borderColor: (formData.coordinates || showCoordInput) ? 'rgba(59, 130, 246, 0.4)' : 'var(--color-border)',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease'
                      }}
                      title="Dán tọa độ vị trí dự án (Google Maps)"
                    >
                      <MapPin size={14} />
                      <span>{formData.coordinates ? 'Tọa độ: ' + formData.coordinates : 'Dán tọa độ ghim'}</span>
                    </button>
                  )}
                </div>

                {!isPreviewMode && showCoordInput && (
                  <div style={{ marginBottom: '0.6rem', padding: '0.65rem 0.75rem', backgroundColor: 'rgba(59, 130, 246, 0.05)', borderRadius: 'var(--radius-sm)', border: '1px dashed rgba(59, 130, 246, 0.35)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.3rem' }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: '600', color: 'var(--color-primary)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                        <MapPin size={13} /> Tọa độ vị trí (Lat, Lng hoặc từ Google Maps):
                      </span>
                      {formData.coordinates && (
                        <a
                          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(formData.coordinates.trim())}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ fontSize: '0.75rem', color: 'var(--color-primary)', textDecoration: 'underline' }}
                        >
                          Xem ghim trên Google Maps ↗
                        </a>
                      )}
                    </div>
                    <input
                      type="text"
                      className="input-field"
                      value={formData.coordinates || ''}
                      onChange={e => setFormData({ ...formData, coordinates: e.target.value })}
                      placeholder="VD: 21.038234, 105.782712..."
                      style={{ fontSize: '0.85rem' }}
                    />
                    <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', marginTop: '0.25rem' }}>
                      💡 Bản đồ bên dưới sẽ luôn tự động focus và ghim chính xác điểm theo tọa độ này.
                    </div>
                  </div>
                )}

                {isPreviewMode ? (
                  <div style={{ padding: '0.6rem 0.85rem', backgroundColor: 'var(--color-bg-surface-hover)', borderRadius: 'var(--radius-sm)', minHeight: '2.5rem', display: 'flex', alignItems: 'center', border: '1px solid var(--color-border)' }}>
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(formData.coordinates?.trim() || formData.location)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Mở trên Google Maps (có ghim vị trí)"
                      style={{ color: 'var(--color-primary)', textDecoration: 'none', fontWeight: '500', cursor: 'pointer' }}
                    >
                      {formData.location || 'Chưa cập nhật địa điểm'}
                    </a>
                  </div>
                ) : (
                  <input
                    type="text"
                    className="input-field"
                    value={formData.location}
                    onChange={e => setFormData({...formData, location: e.target.value})}
                    placeholder="Nhập địa chỉ dự án (VD: Lô CNS1, đường Văn Tiến Dũng, phường Tây Tựu, TP. Hà Nội)..."
                  />
                )}
                
                {(formData.coordinates?.trim() || formData.location) && (
                  <div data-html2canvas-ignore="true" style={{ width: '100%', height: '200px', borderRadius: 'var(--radius-md)', overflow: 'hidden', border: '1px solid var(--color-border)', marginTop: '0.75rem' }}>
                    <iframe
                      width="100%"
                      height="100%"
                      style={{ border: 0 }}
                      loading="lazy"
                      allowFullScreen
                      src={`https://www.google.com/maps?q=${encodeURIComponent(formData.coordinates?.trim() || formData.location)}&z=16&output=embed`}
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
                  <FileText size={16} /> {showDocsSection ? 'Ẩn tài liệu đính kèm' : `Xem tài liệu đính kèm (${projectDocs.length})`}
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
                {/* Tiêu đề & thanh công cụ */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: '600', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }} onClick={() => setIsPlanningSectionCollapsed(!isPlanningSectionCollapsed)}>
                    <Activity size={18} color="var(--color-primary)" />
                    Thông tin dự án
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

                {/* Thanh công cụ khi chọn nhiều dòng (Multi-select bar) */}
                {!isPlanningSectionCollapsed && !isPreviewMode && selectedRowIds.length > 0 && (
                  <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '0.45rem 0.85rem', marginBottom: '0.6rem',
                    backgroundColor: 'rgba(59, 130, 246, 0.15)', border: '1px solid rgba(59, 130, 246, 0.4)',
                    borderRadius: '8px', fontSize: '0.82rem', flexWrap: 'wrap', gap: '0.5rem',
                    animation: 'fadeIn 0.2s ease-in-out'
                  }}>
                    <span style={{ fontWeight: '600', color: 'var(--color-primary)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <Check size={16} /> Đã chọn {selectedRowIds.length} hàng (Kéo thả để di chuyển)
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <button
                        type="button"
                        onClick={() => handleIndentSelectedRows(-1)}
                        className="btn btn-outline"
                        style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                        title="Giảm cấp (Thụt lề sang trái)"
                      >
                        <ArrowLeft size={12} /> Giảm cấp
                      </button>
                      <button
                        type="button"
                        onClick={() => handleIndentSelectedRows(1)}
                        className="btn btn-outline"
                        style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                        title="Tăng cấp (Thụt lề sang phải)"
                      >
                        <ArrowRight size={12} /> Tăng cấp
                      </button>
                      <button
                        type="button"
                        onClick={handleDeleteSelectedRows}
                        className="btn btn-outline"
                        style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem', color: 'var(--color-danger)', borderColor: 'var(--color-danger)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                      >
                        <Trash2 size={12} /> Xóa đã chọn
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedRowIds([])}
                        className="btn btn-outline"
                        style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}
                      >
                        Bỏ chọn
                      </button>
                    </div>
                  </div>
                )}
                
              {!isPlanningSectionCollapsed && (
                <div style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', overflowX: 'auto', position: 'relative' }}>
                  <table className="datasheet-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                    <thead style={{ backgroundColor: 'var(--color-bg-surface-hover)' }}>
                      <tr>
                        {!isPreviewMode && (() => {
                          const allRowIds = formData.details.map((d, i) => getRowId(d, i));
                          const isAllSelected = allRowIds.length > 0 && allRowIds.every(id => selectedRowIds.includes(id));

                          return (
                            <th style={{ padding: '0.5rem 0.35rem', borderBottom: '1px solid var(--color-border)', width: '38px', textAlign: 'center' }}>
                              <div
                                onClick={() => {
                                  if (isAllSelected) setSelectedRowIds([]);
                                  else setSelectedRowIds(allRowIds);
                                }}
                                style={{
                                  width: '18px',
                                  height: '18px',
                                  borderRadius: '4px',
                                  border: isAllSelected ? '2px solid var(--color-primary)' : '2px solid rgba(255,255,255,0.4)',
                                  backgroundColor: isAllSelected ? 'var(--color-primary)' : 'rgba(255,255,255,0.06)',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  cursor: 'pointer',
                                  margin: '0 auto',
                                  transition: 'all 0.15s ease'
                                }}
                                title={isAllSelected ? "Bỏ chọn tất cả" : "Chọn tất cả các hàng"}
                              >
                                {isAllSelected && <Check size={13} color="#ffffff" strokeWidth={3} />}
                              </div>
                            </th>
                          );
                        })()}
                        <th style={{ padding: '0.5rem 0.4rem', textAlign: 'center', borderBottom: '1px solid var(--color-border)', width: '48px', color: 'var(--color-text-muted)', fontWeight: '600', fontSize: '0.78rem' }}>STT</th>
                        
                        {(formData.detailColumns || [
                          { key: 'name', label: 'Nội dung', align: 'left' },
                          { key: 'value', label: 'Giá trị', align: 'left' }
                        ]).map((col, cIdx) => {
                          const colW = columnWidths[col.key] || (cIdx === 0 ? 240 : 160);
                          const colAlign = col.align || 'left';

                          return (
                            <th
                              key={col.key}
                              style={{
                                padding: isPreviewMode ? '0.55rem 1rem' : '0.35rem 0.5rem',
                                textAlign: colAlign,
                                borderBottom: '1px solid var(--color-border)',
                                fontWeight: '600',
                                width: colW ? `${colW}px` : 'auto',
                                minWidth: '90px',
                                position: 'relative',
                                userSelect: 'none',
                                fontSize: '0.8rem'
                              }}
                            >
                              {isPreviewMode ? (
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: colAlign === 'center' ? 'center' : (colAlign === 'right' ? 'flex-end' : 'flex-start'), width: '100%' }}>
                                  <span style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: '1.35' }}>{col.label}</span>
                                </div>
                              ) : (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', paddingRight: '12px' }}>
                                  {/* Nút đổi căn lề (Trái / Giữa / Phải) */}
                                  <button
                                    type="button"
                                    onClick={() => handleToggleColumnAlign(col.key)}
                                    title={`Đổi căn lề: ${colAlign === 'center' ? 'Giữa' : (colAlign === 'right' ? 'Phải' : 'Trái')} (Nhấp để chuyển)`}
                                    style={{
                                      background: 'rgba(255,255,255,0.06)',
                                      border: '1px solid var(--color-border)',
                                      borderRadius: '4px',
                                      color: 'var(--color-primary)',
                                      cursor: 'pointer',
                                      padding: '2px 3px',
                                      display: 'flex',
                                      alignItems: 'center',
                                      flexShrink: 0
                                    }}
                                  >
                                    {colAlign === 'center' ? <AlignCenter size={12} /> : (colAlign === 'right' ? <AlignRight size={12} /> : <AlignLeft size={12} />)}
                                  </button>

                                  <input
                                    type="text"
                                    className="datasheet-input"
                                    value={col.label}
                                    onChange={e => handleColumnLabelChange(col.key, e.target.value)}
                                    placeholder="Tên cột..."
                                    style={{
                                      fontWeight: '600',
                                      padding: '0.15rem 0.35rem',
                                      border: '1px solid transparent',
                                      borderRadius: '4px',
                                      background: 'rgba(255,255,255,0.04)',
                                      color: 'inherit',
                                      fontSize: '0.8rem',
                                      width: '100%',
                                      textAlign: colAlign
                                    }}
                                    onFocus={e => e.target.style.borderColor = 'var(--color-primary)'}
                                    onBlur={e => e.target.style.borderColor = 'transparent'}
                                    title="Nhấp để đổi tên cột"
                                  />
                                  {(formData.detailColumns?.length > 1) && (
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteColumn(col.key)}
                                      title="Xoá cột này"
                                      style={{
                                        background: 'none',
                                        border: 'none',
                                        color: 'var(--color-text-muted)',
                                        cursor: 'pointer',
                                        padding: '2px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        borderRadius: '3px',
                                        flexShrink: 0
                                      }}
                                      onMouseEnter={e => e.currentTarget.style.color = 'var(--color-danger)'}
                                      onMouseLeave={e => e.currentTarget.style.color = 'var(--color-text-muted)'}
                                    >
                                      <X size={12} />
                                    </button>
                                  )}
                                </div>
                              )}

                              {/* Resizer handle (Kéo chỉnh độ rộng & double click Autofit) - Khả dụng cả ở Chế độ Chỉ đọc và Chỉnh sửa */}
                              <div
                                onMouseDown={(e) => handleResizerMouseDown(col.key, e)}
                                onDoubleClick={() => handleResizerDoubleClick(col.key)}
                                title="Kéo để chỉnh độ rộng cột | Nhấp đúp để tự động căn chỉnh (Autofit)"
                                style={{
                                  position: 'absolute',
                                  right: 0,
                                  top: 0,
                                  bottom: 0,
                                  width: '8px',
                                  cursor: 'col-resize',
                                  backgroundColor: 'transparent',
                                  transition: 'background-color 0.15s',
                                  zIndex: 10
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--color-primary)'}
                                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                              />

                              {/* Nút chèn cột ở ranh giới giữa 2 cột (Vị trí phân cách các cột) */}
                              {!isPreviewMode && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleInsertColumnAt(cIdx + 1);
                                  }}
                                  title="Chèn cột vào vị trí này"
                                  style={{
                                    position: 'absolute',
                                    right: '-9px',
                                    top: '50%',
                                    transform: 'translateY(-50%)',
                                    width: '18px',
                                    height: '18px',
                                    borderRadius: '50%',
                                    backgroundColor: 'var(--color-primary)',
                                    color: '#ffffff',
                                    border: '2px solid var(--color-bg-surface)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    cursor: 'pointer',
                                    zIndex: 20,
                                    boxShadow: '0 2px 6px rgba(0,0,0,0.35)',
                                    padding: 0,
                                    transition: 'transform 0.15s ease'
                                  }}
                                  onMouseEnter={(e) => {
                                    e.currentTarget.style.transform = 'translateY(-50%) scale(1.2)';
                                  }}
                                  onMouseLeave={(e) => {
                                    e.currentTarget.style.transform = 'translateY(-50%) scale(1)';
                                  }}
                                >
                                  <Plus size={12} strokeWidth={2.5} />
                                </button>
                              )}
                            </th>
                          );
                        })}

                        {!isPreviewMode && (
                          <th style={{ padding: '0.5rem 0.4rem', borderBottom: '1px solid var(--color-border)', width: '100px', textAlign: 'center', fontSize: '0.78rem' }}>Thao tác</th>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {(() => {
                        // Tính toán danh sách các dòng hiển thị dựa trên trạng thái đóng/mở của group
                        const collapsedStack = [];
                        const visibleRows = [];
                        let sttCounter = 0;

                        formData.details.forEach((detail, index) => {
                          const level = detail.level || 0;
                          const rId = getRowId(detail, index);
                          while (collapsedStack.length > 0 && collapsedStack[collapsedStack.length - 1] >= level) {
                            collapsedStack.pop();
                          }
                          const isHidden = collapsedStack.length > 0;

                          if (!isHidden) {
                            if (!detail.isGroup) sttCounter++;
                            visibleRows.push({
                              detail,
                              index,
                              stt: detail.isGroup ? null : sttCounter
                            });
                          }

                          if (detail.isGroup && (collapsedGroupIds.has(rId) || (detail.id && collapsedGroupIds.has(String(detail.id))))) {
                            if (!isHidden) {
                              collapsedStack.push(level);
                            }
                          }
                        });

                        const totalCols = (formData.detailColumns?.length || 2) + (!isPreviewMode ? 3 : 1);

                        if (formData.details.length === 0) {
                          return (
                            <tr>
                              <td colSpan={totalCols} style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                                <p style={{ marginBottom: '1rem' }}>Bảng chưa có thông tin nào.</p>
                                {!isPreviewMode && (
                                  <div style={{ display: 'flex', justifyContent: 'center', gap: '0.75rem' }}>
                                    <button type="button" className="btn btn-outline" onClick={() => handleInsertRowAt(0, false, 0)}>
                                      <Plus size={14} /> Thêm hàng đầu tiên
                                    </button>
                                    <button type="button" className="btn btn-primary" onClick={() => handleInsertRowAt(0, true, 0)}>
                                      <FolderPlus size={14} /> Thêm nhóm đầu tiên
                                    </button>
                                  </div>
                                )}
                              </td>
                            </tr>
                          );
                        }

                        return visibleRows.map(({ detail, index, stt }) => {
                          const rowId = getRowId(detail, index);
                          const isSelected = selectedRowIds.includes(rowId);
                          const level = detail.level || 0;
                          const isCollapsed = detail.isGroup && (collapsedGroupIds.has(rowId) || (detail.id && collapsedGroupIds.has(String(detail.id))));

                          if (detail.isGroup) {
                            // Màu sắc và viền phân cấp theo Level (Cha / Con / Cháu...)
                            const groupBg = level === 0 
                              ? 'rgba(59, 130, 246, 0.14)' 
                              : level === 1 
                                ? 'rgba(59, 130, 246, 0.08)' 
                                : 'rgba(59, 130, 246, 0.04)';
                            const borderLeftColor = level === 0 
                              ? 'var(--color-primary)' 
                              : level === 1 
                                ? '#60a5fa' 
                                : '#93c5fd';
                            const indentPadding = level * 20;

                            return (
                              <React.Fragment key={detail.id || `group_${index}`}>
                                {/* Hover Insert Divider phía trên dòng (Word table style) */}
                                {!isPreviewMode && (
                                  <tr style={{ height: '0px', padding: 0 }}>
                                    <td colSpan={totalCols} style={{ padding: 0, position: 'relative', height: '0px', border: 'none' }}>
                                      <div
                                        style={{
                                          position: 'absolute', top: '-6px', left: 0, right: 0, height: '12px',
                                          zIndex: 5, display: 'flex', alignItems: 'center', justifyContent: 'center',
                                          opacity: hoverInsertRowIndex === index ? 1 : 0,
                                          transition: 'opacity 0.15s ease',
                                          pointerEvents: hoverInsertRowIndex === index ? 'auto' : 'none'
                                        }}
                                        onMouseEnter={() => setHoverInsertRowIndex(index)}
                                        onMouseLeave={() => setHoverInsertRowIndex(null)}
                                      >
                                        <div style={{ position: 'absolute', left: 0, right: 0, height: '2px', backgroundColor: 'var(--color-primary)' }} />
                                        <div style={{ position: 'relative', zIndex: 6, display: 'flex', gap: '0.35rem', background: 'var(--color-bg-surface)', padding: '2px 8px', borderRadius: '12px', border: '1px solid var(--color-primary)', boxShadow: '0 2px 8px rgba(0,0,0,0.2)' }}>
                                          <button
                                            type="button"
                                            onClick={() => handleInsertRowAt(index, false, level)}
                                            style={{ background: 'none', border: 'none', color: 'var(--color-text-main)', fontSize: '0.72rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '2px', fontWeight: '600' }}
                                          >
                                            <Plus size={11} color="var(--color-primary)" /> Chèn hàng
                                          </button>
                                          <span style={{ color: 'var(--color-border)' }}>|</span>
                                          <button
                                            type="button"
                                            onClick={() => handleInsertRowAt(index, true, level)}
                                            style={{ background: 'none', border: 'none', color: 'var(--color-primary)', fontSize: '0.72rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '2px', fontWeight: '600' }}
                                          >
                                            <FolderPlus size={11} /> Chèn nhóm
                                          </button>
                                        </div>
                                      </div>
                                    </td>
                                  </tr>
                                )}

                                <tr
                                  draggable={!isPreviewMode}
                                  onDragStart={(e) => handleRowDragStart(e, index)}
                                  onDragOver={e => handleRowDragOver(e, index)}
                                  onDrop={() => handleRowDrop(index)}
                                  onDragEnd={handleRowDragEnd}
                                  style={{
                                    borderBottom: '1px solid var(--color-border)',
                                    backgroundColor: isSelected ? 'rgba(59, 130, 246, 0.22)' : groupBg,
                                    opacity: dragRowRef.current?.draggedIds?.includes(rowId) ? 0.4 : 1,
                                    outline: dragOverIndex === index ? '2px solid var(--color-primary)' : (isSelected ? '1px solid var(--color-primary)' : 'none'),
                                    cursor: isPreviewMode ? 'default' : 'default'
                                  }}
                                  onMouseEnter={() => setHoverInsertRowIndex(index)}
                                >
                                  {/* Checkbox chọn dòng theo dấu tick */}
                                  {!isPreviewMode && (
                                    <td
                                      style={{ padding: '0.4rem', textAlign: 'center', cursor: 'pointer' }}
                                      onClick={(e) => handleToggleRowSelect(rowId, e)}
                                    >
                                      <div
                                        style={{
                                          width: '18px',
                                          height: '18px',
                                          borderRadius: '4px',
                                          border: isSelected ? '2px solid var(--color-primary)' : '2px solid rgba(255,255,255,0.4)',
                                          backgroundColor: isSelected ? 'var(--color-primary)' : 'rgba(255,255,255,0.06)',
                                          display: 'flex',
                                          alignItems: 'center',
                                          justifyContent: 'center',
                                          cursor: 'pointer',
                                          margin: '0 auto',
                                          transition: 'all 0.15s ease'
                                        }}
                                        title={isSelected ? "Bỏ chọn nhóm này" : "Chọn nhóm này"}
                                      >
                                        {isSelected && <Check size={13} color="#ffffff" strokeWidth={3} />}
                                      </div>
                                    </td>
                                  )}

                                  {/* Tay nắm kéo & Icon Đóng/Mở group */}
                                  <td style={{ padding: '0.4rem 0.35rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '2px' }}>
                                      {!isPreviewMode && (
                                        <div style={{ cursor: 'grab' }} title="Kéo thả nhóm">
                                          <GripVertical size={13} />
                                        </div>
                                      )}
                                      <button
                                        type="button"
                                        onClick={(e) => { e.stopPropagation(); toggleGroupCollapse(rowId); }}
                                        style={{ background: 'none', border: 'none', color: 'var(--color-primary)', cursor: 'pointer', padding: '2px', display: 'flex', alignItems: 'center' }}
                                        title={isCollapsed ? "Bung rộng nhóm" : "Thu gọn nhóm"}
                                      >
                                        {isCollapsed ? <ChevronRight size={15} /> : <ChevronDown size={15} />}
                                      </button>
                                    </div>
                                  </td>

                                  {/* Tiêu đề nhóm với thụt lề đa cấp (Cha / Con / Cháu...) */}
                                  <td
                                    colSpan={formData.detailColumns?.length || 2}
                                    style={{
                                      padding: isPreviewMode ? '0.65rem 1.15rem' : '0.35rem 0.6rem',
                                      paddingLeft: `${indentPadding + (isPreviewMode ? 14 : 8)}px`,
                                      borderLeft: `4px solid ${borderLeftColor}`,
                                      lineHeight: '1.45'
                                    }}
                                  >
                                    {isPreviewMode ? (
                                      <div style={{
                                        fontWeight: level === 0 ? '700' : '600',
                                        color: 'var(--color-primary)',
                                        fontSize: level === 0 ? '0.86rem' : '0.8rem',
                                        letterSpacing: '0.01em',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.35rem',
                                        whiteSpace: 'pre-wrap',
                                        wordBreak: 'break-word',
                                        lineHeight: '1.4'
                                      }}>
                                        {level > 0 && <CornerDownRight size={13} style={{ color: borderLeftColor, flexShrink: 0 }} />}
                                        <span>{detail.name}</span>
                                        {isCollapsed && <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', fontWeight: 'normal' }}>(Đang thu gọn)</span>}
                                      </div>
                                    ) : (
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                        {level > 0 && <CornerDownRight size={13} style={{ color: borderLeftColor, flexShrink: 0 }} />}
                                        <textarea
                                          rows={1}
                                          className="datasheet-input"
                                          value={detail.name}
                                          onChange={e => {
                                            handleDetailChange(index, 'name', e.target.value);
                                            e.target.style.height = 'auto';
                                            e.target.style.height = `${e.target.scrollHeight}px`;
                                          }}
                                          onInput={e => {
                                            e.target.style.height = 'auto';
                                            e.target.style.height = `${e.target.scrollHeight}px`;
                                          }}
                                          ref={el => {
                                            if (el) {
                                              el.style.height = 'auto';
                                              el.style.height = `${el.scrollHeight}px`;
                                            }
                                          }}
                                          placeholder={`Nhập tên nhóm cấp ${level + 1} (VD: ${level === 0 ? 'I. THÔNG SỐ CHUNG' : '1.1 Chi tiết'})`}
                                          style={{
                                            width: '100%',
                                            minHeight: '26px',
                                            fontWeight: level === 0 ? '700' : '600',
                                            color: 'var(--color-primary)',
                                            backgroundColor: 'rgba(255, 255, 255, 0.05)',
                                            border: '1px solid rgba(59, 130, 246, 0.3)',
                                            borderRadius: '4px',
                                            padding: '0.25rem 0.45rem',
                                            fontSize: level === 0 ? '0.84rem' : '0.8rem',
                                            resize: 'none',
                                            overflow: 'hidden',
                                            lineHeight: '1.4',
                                            display: 'block',
                                            whiteSpace: 'pre-wrap',
                                            wordBreak: 'break-word',
                                            fontFamily: 'inherit'
                                          }}
                                          onClick={e => e.stopPropagation()}
                                        />
                                        <span style={{ fontSize: '0.68rem', color: 'var(--color-text-muted)', whiteSpace: 'nowrap', flexShrink: 0 }}>
                                          Cấp {level + 1}
                                        </span>
                                      </div>
                                    )}
                                  </td>

                                  {/* Thao tác trên hàng nhóm */}
                                  {!isPreviewMode && (
                                    <td style={{ padding: '0.2rem 0.35rem', textAlign: 'center' }}>
                                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '2px' }} onClick={e => e.stopPropagation()}>
                                        <button
                                          type="button"
                                          title="Giảm cấp nhóm (Sang trái)"
                                          onClick={() => handleChangeRowLevel(index, -1)}
                                          disabled={level === 0}
                                          style={{ background: 'none', border: 'none', color: level === 0 ? 'var(--color-border)' : 'var(--color-text-muted)', cursor: level === 0 ? 'default' : 'pointer', padding: '2px' }}
                                        >
                                          <ArrowLeft size={12} />
                                        </button>
                                        <button
                                          type="button"
                                          title="Tăng cấp nhóm (Sang phải - Nhóm con)"
                                          onClick={() => handleChangeRowLevel(index, 1)}
                                          disabled={level >= 3}
                                          style={{ background: 'none', border: 'none', color: level >= 3 ? 'var(--color-border)' : 'var(--color-text-muted)', cursor: level >= 3 ? 'default' : 'pointer', padding: '2px' }}
                                        >
                                          <ArrowRight size={12} />
                                        </button>
                                        <button
                                          type="button"
                                          title="Chèn nhóm con bên dưới"
                                          onClick={() => handleInsertRowAt(index + 1, true, level + 1)}
                                          style={{ background: 'none', border: 'none', color: 'var(--color-primary)', cursor: 'pointer', padding: '2px' }}
                                        >
                                          <FolderPlus size={12} />
                                        </button>
                                        <button
                                          type="button"
                                          title="Chèn hàng bên dưới nhóm"
                                          onClick={() => handleInsertRowAt(index + 1, false, level)}
                                          style={{ background: 'none', border: 'none', color: 'var(--color-text-main)', cursor: 'pointer', padding: '2px' }}
                                        >
                                          <Plus size={12} />
                                        </button>
                                        <button
                                          type="button"
                                          title="Xóa nhóm này"
                                          onClick={() => handleDeleteDetailRow(index)}
                                          style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer', padding: '2px' }}
                                          onMouseEnter={e => e.currentTarget.style.color = 'var(--color-danger)'}
                                          onMouseLeave={e => e.currentTarget.style.color = 'var(--color-text-muted)'}
                                        >
                                          <X size={13} />
                                        </button>
                                      </div>
                                    </td>
                                  )}
                                </tr>
                              </React.Fragment>
                            );
                          }

                          // Dòng dữ liệu thông thường (Regular Row)
                          const rowIndent = level * 18;

                          return (
                            <React.Fragment key={detail.id || index}>
                              {/* Hover Insert Divider phía trên dòng */}
                              {!isPreviewMode && (
                                <tr style={{ height: '0px', padding: 0 }}>
                                  <td colSpan={totalCols} style={{ padding: 0, position: 'relative', height: '0px', border: 'none' }}>
                                    <div
                                      style={{
                                        position: 'absolute', top: '-6px', left: 0, right: 0, height: '12px',
                                        zIndex: 5, display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        opacity: hoverInsertRowIndex === index ? 1 : 0,
                                        transition: 'opacity 0.15s ease',
                                        pointerEvents: hoverInsertRowIndex === index ? 'auto' : 'none'
                                      }}
                                      onMouseEnter={() => setHoverInsertRowIndex(index)}
                                      onMouseLeave={() => setHoverInsertRowIndex(null)}
                                    >
                                      <div style={{ position: 'absolute', left: 0, right: 0, height: '2px', backgroundColor: 'var(--color-primary)' }} />
                                      <div style={{ position: 'relative', zIndex: 6, display: 'flex', gap: '0.35rem', background: 'var(--color-bg-surface)', padding: '2px 8px', borderRadius: '12px', border: '1px solid var(--color-primary)', boxShadow: '0 2px 8px rgba(0,0,0,0.2)' }}>
                                        <button
                                          type="button"
                                          onClick={() => handleInsertRowAt(index, false, level)}
                                          style={{ background: 'none', border: 'none', color: 'var(--color-text-main)', fontSize: '0.72rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '2px', fontWeight: '600' }}
                                        >
                                          <Plus size={11} color="var(--color-primary)" /> Chèn hàng
                                        </button>
                                        <span style={{ color: 'var(--color-border)' }}>|</span>
                                        <button
                                          type="button"
                                          onClick={() => handleInsertRowAt(index, true, level)}
                                          style={{ background: 'none', border: 'none', color: 'var(--color-primary)', fontSize: '0.72rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '2px', fontWeight: '600' }}
                                        >
                                          <FolderPlus size={11} /> Chèn nhóm
                                        </button>
                                      </div>
                                    </div>
                                  </td>
                                </tr>
                              )}

                              <tr
                                draggable={!isPreviewMode}
                                onDragStart={(e) => handleRowDragStart(e, index)}
                                onDragOver={e => handleRowDragOver(e, index)}
                                onDrop={() => handleRowDrop(index)}
                                onDragEnd={handleRowDragEnd}
                                style={{
                                  borderBottom: index < formData.details.length - 1 ? '1px solid var(--color-border)' : 'none',
                                  opacity: dragRowRef.current?.draggedIds?.includes(rowId) ? 0.4 : 1,
                                  backgroundColor: isSelected ? 'rgba(59, 130, 246, 0.15)' : (dragOverIndex === index ? 'rgba(99,102,241,0.08)' : 'transparent'),
                                  transition: 'background 0.15s',
                                  outline: dragOverIndex === index ? '2px solid rgba(99,102,241,0.4)' : (isSelected ? '1px solid var(--color-primary)' : 'none'),
                                  cursor: isPreviewMode ? 'default' : 'default'
                                }}
                                onMouseEnter={() => setHoverInsertRowIndex(index)}
                              >
                                {/* Checkbox chọn dòng theo dấu tick */}
                                {!isPreviewMode && (
                                  <td
                                    style={{ padding: '0.4rem', textAlign: 'center', cursor: 'pointer' }}
                                    onClick={(e) => handleToggleRowSelect(rowId, e)}
                                  >
                                    <div
                                      style={{
                                        width: '18px',
                                        height: '18px',
                                        borderRadius: '4px',
                                        border: isSelected ? '2px solid var(--color-primary)' : '2px solid rgba(255,255,255,0.4)',
                                        backgroundColor: isSelected ? 'var(--color-primary)' : 'rgba(255,255,255,0.06)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        cursor: 'pointer',
                                        margin: '0 auto',
                                        transition: 'all 0.15s ease'
                                      }}
                                      title={isSelected ? "Bỏ chọn dòng này" : "Chọn dòng này"}
                                    >
                                      {isSelected && <Check size={13} color="#ffffff" strokeWidth={3} />}
                                    </div>
                                  </td>
                                )}

                                {/* STT */}
                                <td style={{ padding: isPreviewMode ? '0.65rem 0.45rem' : '0.4rem 0.35rem', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '0.78rem', userSelect: 'none' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '2px' }}>
                                    {!isPreviewMode && (
                                      <div style={{ cursor: 'grab' }} title="Kéo thả hàng">
                                        <GripVertical size={13} />
                                      </div>
                                    )}
                                    <span>{stt}</span>
                                  </div>
                                </td>

                                {/* Dynamic Column Cells với căn lề & cho phép text xuống dòng */}
                                {(formData.detailColumns || [
                                  { key: 'name', label: 'Nội dung', align: 'left' },
                                  { key: 'value', label: 'Giá trị', align: 'left' }
                                ]).map((col, cIdx) => {
                                  const colAlign = col.align || 'left';

                                  return (
                                    <td
                                      key={col.key}
                                      style={{
                                        padding: isPreviewMode ? '0.65rem 1.15rem' : '0.25rem 0.45rem',
                                        paddingLeft: cIdx === 0 && rowIndent > 0 ? `${rowIndent + (isPreviewMode ? 14 : 8)}px` : undefined,
                                        textAlign: colAlign,
                                        lineHeight: '1.45',
                                        fontSize: '0.8rem'
                                      }}
                                    >
                                      {isPreviewMode ? (
                                        <span style={{
                                          fontWeight: cIdx === 0 ? '500' : 'normal',
                                          display: 'block',
                                          whiteSpace: 'pre-wrap',
                                          wordBreak: 'break-word',
                                          fontSize: '0.8rem',
                                          lineHeight: '1.45'
                                        }}>
                                          {detail[col.key] || (col.key === 'value' ? <span style={{ color: 'var(--color-text-muted)', fontStyle: 'italic' }}>Chưa cập nhật</span> : '-')}
                                        </span>
                                      ) : (
                                        <textarea
                                          rows={1}
                                          className="datasheet-input"
                                          value={detail[col.key] || ''}
                                          onChange={e => {
                                            handleDetailChange(index, col.key, e.target.value);
                                            e.target.style.height = 'auto';
                                            e.target.style.height = `${e.target.scrollHeight}px`;
                                          }}
                                          onInput={e => {
                                            e.target.style.height = 'auto';
                                            e.target.style.height = `${e.target.scrollHeight}px`;
                                          }}
                                          ref={el => {
                                            if (el) {
                                              el.style.height = 'auto';
                                              el.style.height = `${el.scrollHeight}px`;
                                            }
                                          }}
                                          placeholder={`Nhập ${col.label.toLowerCase()}...`}
                                          style={{
                                            width: '100%',
                                            minHeight: '26px',
                                            fontWeight: col.key === 'name' ? '500' : 'normal',
                                            textAlign: colAlign,
                                            fontSize: '0.8rem',
                                            resize: 'none',
                                            overflow: 'hidden',
                                            lineHeight: '1.4',
                                            padding: '0.2rem 0.35rem',
                                            display: 'block',
                                            whiteSpace: 'pre-wrap',
                                            wordBreak: 'break-word',
                                            background: 'transparent',
                                            border: 'none',
                                            outline: 'none',
                                            color: 'var(--color-text-main)',
                                            fontFamily: 'inherit'
                                          }}
                                          onClick={e => e.stopPropagation()}
                                        />
                                      )}
                                    </td>
                                  );
                                })}

                                {/* Thao tác trên hàng */}
                                {!isPreviewMode && (
                                  <td style={{ padding: '0.2rem 0.35rem', textAlign: 'center' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '2px' }} onClick={e => e.stopPropagation()}>
                                      <button
                                        type="button"
                                        title="Giảm cấp (Thụt sang trái)"
                                        onClick={() => handleChangeRowLevel(index, -1)}
                                        disabled={level === 0}
                                        style={{ background: 'none', border: 'none', color: level === 0 ? 'var(--color-border)' : 'var(--color-text-muted)', cursor: level === 0 ? 'default' : 'pointer', padding: '2px' }}
                                      >
                                        <ArrowLeft size={12} />
                                      </button>
                                      <button
                                        type="button"
                                        title="Tăng cấp (Thụt sang phải)"
                                        onClick={() => handleChangeRowLevel(index, 1)}
                                        disabled={level >= 3}
                                        style={{ background: 'none', border: 'none', color: level >= 3 ? 'var(--color-border)' : 'var(--color-text-muted)', cursor: level >= 3 ? 'default' : 'pointer', padding: '2px' }}
                                      >
                                        <ArrowRight size={12} />
                                      </button>
                                      <button
                                        type="button"
                                        title="Chèn hàng bên dưới"
                                        onClick={() => handleInsertRowAt(index + 1, false, level)}
                                        style={{ background: 'none', border: 'none', color: 'var(--color-text-main)', cursor: 'pointer', padding: '2px' }}
                                      >
                                        <Plus size={12} />
                                      </button>
                                      <button
                                        type="button"
                                        title="Xóa hàng này"
                                        onClick={() => handleDeleteDetailRow(index)}
                                        style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer', padding: '2px' }}
                                        onMouseEnter={e => e.currentTarget.style.color = 'var(--color-danger)'}
                                        onMouseLeave={e => e.currentTarget.style.color = 'var(--color-text-muted)'}
                                      >
                                        <X size={13} />
                                      </button>
                                    </div>
                                  </td>
                                )}
                              </tr>
                            </React.Fragment>
                          );
                        });
                      })()}
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
