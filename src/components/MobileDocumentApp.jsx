import React, { useState, useContext, useEffect, useMemo } from 'react';
import { DocumentContext } from '../context/DocumentContext';
import { 
  Search, Bell, Eye, EyeOff, Home, FolderKanban, Plus, Scale, Star, 
  FileText, ExternalLink, X, ChevronRight, Building2, Calendar, 
  Paperclip, Share2, RefreshCw, AlertCircle, Check, Download
} from 'lucide-react';

// Helper trích xuất tất cả các tệp đính kèm từ tài liệu (hỗ trợ nhiều format lưu trữ)
const getDocFiles = (docItem) => {
  if (!docItem) return [];
  const files = [];

  // 1. Mảng attachments
  if (Array.isArray(docItem.attachments)) {
    docItem.attachments.forEach((att, idx) => {
      if (typeof att === 'string' && att) {
        files.push({ name: `Tệp đính kèm ${idx + 1}`, url: att });
      } else if (att && typeof att === 'object') {
        const url = att.url || att.link || att.downloadUrl || att.fileUrl;
        if (url) {
          files.push({ name: att.name || att.filename || `Tệp đính kèm ${idx + 1}`, url });
        }
      }
    });
  }

  // 2. Các trường single link fallback (attachmentLink, attachmentUrl, fileUrl, url)
  const singleLinks = [
    { label: 'Tệp đính kèm gốc', url: docItem.attachmentLink },
    { label: 'Tệp đính kèm (URL)', url: docItem.attachmentUrl },
    { label: 'File URL', url: docItem.fileUrl },
    { label: 'Link đính kèm', url: docItem.url }
  ];

  singleLinks.forEach((item) => {
    if (item.url && typeof item.url === 'string' && !files.some(f => f.url === item.url)) {
      files.push({ name: files.length === 0 ? item.label : `Tệp bổ sung ${files.length + 1}`, url: item.url });
    }
  });

  return files;
};

const MobileDocumentApp = ({ onCloseMobileView }) => {
  const { 
    allDocuments = [], 
    documentTypes = [], 
    allProjects = [], 
    legalSteps = [],
    enableLazy 
  } = useContext(DocumentContext);

  // Lazy loading context data
  useEffect(() => {
    if (enableLazy) enableLazy();
  }, [enableLazy]);

  // States
  const [activeBottomNav, setActiveBottomNav] = useState('overview'); // 'overview' | 'documents' | 'phaply' | 'profile'
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearchInput, setShowSearchInput] = useState(false);
  const [showTotalDocsCount, setShowTotalDocsCount] = useState(true);
  const [selectedProjectId, setSelectedProjectId] = useState('ALL');
  const [selectedDocType, setSelectedDocType] = useState('ALL');
  const [selectedStepId, setSelectedStepId] = useState('ALL');
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [selectedLegalStep, setSelectedLegalStep] = useState(null);
  
  // Favorites in LocalStorage
  const [favorites, setFavorites] = useState(() => {
    try {
      const saved = localStorage.getItem('mobile_doc_favorites');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });

  const toggleFavorite = (docId, e) => {
    if (e) e.stopPropagation();
    setFavorites(prev => {
      const next = prev.includes(docId) ? prev.filter(id => id !== docId) : [...prev, docId];
      localStorage.setItem('mobile_doc_favorites', JSON.stringify(next));
      return next;
    });
  };

  // Filtered documents
  const filteredDocuments = useMemo(() => {
    return (allDocuments || []).filter(doc => {
      if (doc.isDeleted) return false;

      // Tab yêu thích nếu chọn ở profile
      if (activeBottomNav === 'profile' && !favorites.includes(doc.id)) return false;

      // Lọc theo Dự án
      if (selectedProjectId !== 'ALL' && String(doc.projectId || '') !== String(selectedProjectId)) {
        return false;
      }

      // Lọc theo Phân loại
      if (selectedDocType !== 'ALL' && (doc.type || doc.documentType) !== selectedDocType) {
        return false;
      }

      // Lọc theo Bước pháp lý
      if (selectedStepId !== 'ALL' && String(doc.legalStepId || '') !== String(selectedStepId)) {
        return false;
      }

      // Tìm kiếm từ khóa
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const code = (doc.code || doc.number || doc.documentNumber || doc.documentCode || '').toLowerCase();
        const summary = (doc.summary || doc.title || doc.name || '').toLowerCase();
        const agency = (doc.issuingAgency || doc.agency || '').toLowerCase();
        const files = getDocFiles(doc);
        const fileNames = files.map(f => f.name.toLowerCase()).join(' ');

        const matchCode = code.includes(q);
        const matchSummary = summary.includes(q);
        const matchAgency = agency.includes(q);
        const matchAtt = fileNames.includes(q);

        if (!matchCode && !matchSummary && !matchAgency && !matchAtt) return false;
      }

      return true;
    });
  }, [allDocuments, selectedProjectId, selectedDocType, selectedStepId, searchQuery, activeBottomNav, favorites]);

  // Mở file trực tiếp 1-Chạm
  const handleOpenFile = (fileUrl, e) => {
    if (e) e.stopPropagation();
    if (fileUrl) {
      window.open(fileUrl, '_blank', 'noopener,noreferrer');
    }
  };

  // Chia sẻ nhanh file qua Web Share API (iOS Safari)
  const handleShare = async (docItem, e) => {
    if (e) e.stopPropagation();
    const files = getDocFiles(docItem);
    const fileUrl = files.length > 0 ? files[0].url : window.location.href;

    if (navigator.share) {
      try {
        await navigator.share({
          title: docItem.code || docItem.documentNumber || 'Tài liệu dự án',
          text: docItem.summary || docItem.name,
          url: fileUrl
        });
      } catch (err) {
        console.log('Chia sẻ bị hủy:', err);
      }
    } else {
      navigator.clipboard.writeText(fileUrl);
      alert('Đã sao chép liên kết tài liệu!');
    }
  };

  // Thống kê nhanh Money Lover Style
  const totalActiveDocs = (allDocuments || []).filter(d => !d.isDeleted).length;
  const docsWithFilesCount = (allDocuments || []).filter(d => !d.isDeleted && getDocFiles(d).length > 0).length;

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 9999,
      backgroundColor: '#f4f5f7',
      color: '#1e293b',
      display: 'flex',
      flexDirection: 'column',
      fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Roboto, sans-serif',
      WebkitOverflowScrolling: 'touch'
    }}>

      {/* ── MONEY LOVER HEADER (Top Metrics & Action Icons) ── */}
      <header style={{
        padding: '16px 20px 12px 20px',
        backgroundColor: '#ffffff',
        borderBottom: '1px solid #e2e8f0',
        boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
      }}>
        {/* Row 1: Total Metric & Action Icons */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '1.75rem', fontWeight: '800', color: '#0f172a', letterSpacing: '-0.5px' }}>
                {showTotalDocsCount ? `${totalActiveDocs} văn bản` : '••••••'}
              </span>
              <button
                onClick={() => setShowTotalDocsCount(!showTotalDocsCount)}
                style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: '4px' }}
              >
                {showTotalDocsCount ? <Eye size={18} /> : <EyeOff size={18} />}
              </button>
            </div>
            <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: '500', marginTop: '2px' }}>
              Tổng tài liệu hệ thống FDI PM ℹ️
            </div>
          </div>

          {/* Action Icons: Search & Notification */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button
              onClick={() => setShowSearchInput(!showSearchInput)}
              style={{
                background: showSearchInput ? '#e6f4ea' : '#f1f5f9',
                border: 'none',
                borderRadius: '50%',
                width: '38px',
                height: '38px',
                display: 'flex',
                alignItems: 'center',
                justify: 'center',
                color: showSearchInput ? '#059669' : '#334155',
                cursor: 'pointer'
              }}
            >
              <Search size={19} />
            </button>

            <div style={{ position: 'relative' }}>
              <button
                style={{
                  background: '#f1f5f9',
                  border: 'none',
                  borderRadius: '50%',
                  width: '38px',
                  height: '38px',
                  display: 'flex',
                  alignItems: 'center',
                  justify: 'center',
                  color: '#334155',
                  cursor: 'pointer'
                }}
              >
                <Bell size={19} />
              </button>
              <span style={{
                position: 'absolute',
                top: '2px',
                right: '2px',
                backgroundColor: '#ef4444',
                color: '#fff',
                fontSize: '0.65rem',
                fontWeight: '800',
                borderRadius: '10px',
                padding: '1px 5px',
                border: '2px solid #fff'
              }}>
                6
              </span>
            </div>
          </div>
        </div>

        {/* Search Bar Input */}
        {showSearchInput && (
          <div style={{ marginTop: '12px', position: 'relative' }}>
            <input
              type="text"
              placeholder="Nhập số hiệu, trích yếu, cơ quan ban hành, tên tệp..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              autoFocus
              style={{
                width: '100%',
                backgroundColor: '#f8fafc',
                border: '1.5px solid #10b981',
                borderRadius: '12px',
                padding: '10px 36px 10px 14px',
                fontSize: '0.9rem',
                color: '#0f172a',
                outline: 'none',
                boxSizing: 'border-box'
              }}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#64748b' }}
              >
                <X size={16} />
              </button>
            )}
          </div>
        )}

        {/* Filter Chips Vuốt Ngang (Money Lover Tag Style) */}
        <div style={{
          display: 'flex',
          gap: '8px',
          overflowX: 'auto',
          marginTop: '12px',
          paddingBottom: '2px',
          scrollbarWidth: 'none'
        }}>
          <select
            value={selectedProjectId}
            onChange={(e) => setSelectedProjectId(e.target.value)}
            style={{
              backgroundColor: selectedProjectId !== 'ALL' ? '#10b981' : '#f1f5f9',
              color: selectedProjectId !== 'ALL' ? '#fff' : '#475569',
              border: 'none',
              borderRadius: '20px',
              padding: '6px 14px',
              fontSize: '0.78rem',
              fontWeight: '600',
              outline: 'none',
              whiteSpace: 'nowrap'
            }}
          >
            <option value="ALL">🏢 Dự án (Tất cả {allProjects.length})</option>
            {allProjects.map(p => (
              <option key={p.id} value={p.id}>{p.name || p.code}</option>
            ))}
          </select>

          <select
            value={selectedDocType}
            onChange={(e) => setSelectedDocType(e.target.value)}
            style={{
              backgroundColor: selectedDocType !== 'ALL' ? '#10b981' : '#f1f5f9',
              color: selectedDocType !== 'ALL' ? '#fff' : '#475569',
              border: 'none',
              borderRadius: '20px',
              padding: '6px 14px',
              fontSize: '0.78rem',
              fontWeight: '600',
              outline: 'none',
              whiteSpace: 'nowrap'
            }}
          >
            <option value="ALL">📂 Loại VB (Tất cả)</option>
            {(documentTypes || []).map(dt => (
              <option key={dt.id || dt.name} value={dt.name || dt.id}>{dt.name}</option>
            ))}
          </select>

          <select
            value={selectedStepId}
            onChange={(e) => setSelectedStepId(e.target.value)}
            style={{
              backgroundColor: selectedStepId !== 'ALL' ? '#10b981' : '#f1f5f9',
              color: selectedStepId !== 'ALL' ? '#fff' : '#475569',
              border: 'none',
              borderRadius: '20px',
              padding: '6px 14px',
              fontSize: '0.78rem',
              fontWeight: '600',
              outline: 'none',
              whiteSpace: 'nowrap'
            }}
          >
            <option value="ALL">⚖️ Bước Pháp Lý (Tất cả)</option>
            {(legalSteps || []).map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>

          {(selectedProjectId !== 'ALL' || selectedDocType !== 'ALL' || selectedStepId !== 'ALL' || searchQuery) && (
            <button
              onClick={() => { setSelectedProjectId('ALL'); setSelectedDocType('ALL'); setSelectedStepId('ALL'); setSearchQuery(''); }}
              style={{
                backgroundColor: '#fee2e2',
                color: '#ef4444',
                border: 'none',
                borderRadius: '20px',
                padding: '6px 12px',
                fontSize: '0.78rem',
                fontWeight: '600',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                whiteSpace: 'nowrap'
              }}
            >
              <RefreshCw size={12} /> Xóa lọc
            </button>
          )}
        </div>
      </header>

      {/* ── MAIN CONTENT AREA (Scrollable Cards) ── */}
      <main style={{
        flex: 1,
        overflowY: 'auto',
        padding: '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        paddingBottom: '90px'
      }}>

        {/* ── TAB TỔNG QUAN (Overview Cards Money Lover Style) ── */}
        {activeBottomNav === 'overview' && (
          <>
            {/* Card 1: Dự án của tôi */}
            <div style={{
              backgroundColor: '#ffffff',
              borderRadius: '16px',
              padding: '16px 18px',
              boxShadow: '0 4px 16px rgba(0,0,0,0.03)',
              border: '1px solid #f1f5f9'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                <span style={{ fontSize: '0.95rem', fontWeight: '700', color: '#0f172a' }}>Dự án của tôi</span>
                <button
                  onClick={() => setActiveBottomNav('documents')}
                  style={{ background: 'none', border: 'none', color: '#10b981', fontSize: '0.82rem', fontWeight: '700', cursor: 'pointer' }}
                >
                  Xem tất cả
                </button>
              </div>

              {/* List Projects Items */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {allProjects.slice(0, 5).map(prj => {
                  const prjDocs = (allDocuments || []).filter(d => !d.isDeleted && String(d.projectId || '') === String(prj.id));
                  return (
                    <div
                      key={prj.id}
                      onClick={() => { setSelectedProjectId(prj.id); setActiveBottomNav('documents'); }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justify: 'space-between',
                        cursor: 'pointer'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{
                          width: '40px', height: '40px', borderRadius: '12px',
                          backgroundColor: '#e6f4ea',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          color: '#059669'
                        }}>
                          <Building2 size={20} />
                        </div>
                        <div>
                          <div style={{ fontSize: '0.9rem', fontWeight: '700', color: '#1e293b' }}>
                            {prj.name || prj.code}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                            {prj.code || 'Mã dự án'}
                          </div>
                        </div>
                      </div>

                      <div style={{ fontSize: '0.9rem', fontWeight: '800', color: '#059669' }}>
                        {prjDocs.length} tài liệu
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Card 2: Báo cáo Thống kê Tài liệu */}
            <div style={{
              backgroundColor: '#ffffff',
              borderRadius: '16px',
              padding: '16px 18px',
              boxShadow: '0 4px 16px rgba(0,0,0,0.03)',
              border: '1px solid #f1f5f9'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <span style={{ fontSize: '0.95rem', fontWeight: '700', color: '#0f172a' }}>Thống kê dữ liệu</span>
                <span style={{ fontSize: '0.78rem', color: '#64748b' }}>Cập nhật realtime</span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div style={{ backgroundColor: '#f8fafc', padding: '12px', borderRadius: '12px', border: '1px solid #f1f5f9' }}>
                  <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Có file đính kèm</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: '800', color: '#059669', marginTop: '4px' }}>
                    {docsWithFilesCount}
                  </div>
                </div>

                <div style={{ backgroundColor: '#f8fafc', padding: '12px', borderRadius: '12px', border: '1px solid #f1f5f9' }}>
                  <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Tài liệu đã lưu ★</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: '800', color: '#d97706', marginTop: '4px' }}>
                    {favorites.length}
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        {/* ── TAB SỔ TÀI LIỆU / KẾT QUẢ LỌC (Money Lover Transaction List Style) ── */}
        {(activeBottomNav === 'documents' || activeBottomNav === 'profile') && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 4px' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: '700', color: '#475569' }}>
                {activeBottomNav === 'profile' ? 'Tài liệu đã lưu ★' : `Danh sách văn bản (${filteredDocuments.length})`}
              </span>
              {selectedProjectId !== 'ALL' && (
                <span style={{ fontSize: '0.75rem', color: '#059669', fontWeight: '600' }}>
                  Đang lọc dự án
                </span>
              )}
            </div>

            {filteredDocuments.length === 0 ? (
              <div style={{
                backgroundColor: '#ffffff',
                borderRadius: '16px',
                padding: '40px 20px',
                textAlign: 'center',
                color: '#64748b'
              }}>
                <AlertCircle size={36} color="#94a3b8" style={{ marginBottom: '8px' }} />
                <div style={{ fontSize: '0.9rem', fontWeight: '600' }}>Không tìm thấy tài liệu phù hợp</div>
                <div style={{ fontSize: '0.78rem', marginTop: '4px' }}>Thử chọn lại bộ lọc hoặc đổi từ khóa tìm kiếm</div>
              </div>
            ) : (
              filteredDocuments.map(doc => {
                const files = getDocFiles(doc);
                const prj = allProjects.find(p => String(p.id) === String(doc.projectId));
                const isFav = favorites.includes(doc.id);
                const docCode = doc.code || doc.number || doc.documentCode || doc.documentNumber || 'Không số';

                return (
                  <div
                    key={doc.id}
                    onClick={() => setSelectedDoc(doc)}
                    style={{
                      backgroundColor: '#ffffff',
                      borderRadius: '16px',
                      padding: '14px 16px',
                      boxShadow: '0 2px 10px rgba(0,0,0,0.02)',
                      border: '1px solid #f1f5f9',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px',
                      cursor: 'pointer'
                    }}
                  >
                    {/* Header Item: Badge & Code & Favorite */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{
                          backgroundColor: '#e6f4ea',
                          color: '#059669',
                          fontSize: '0.75rem',
                          fontWeight: '800',
                          padding: '3px 8px',
                          borderRadius: '6px'
                        }}>
                          {docCode}
                        </span>
                        {doc.type && (
                          <span style={{ backgroundColor: '#f1f5f9', color: '#475569', fontSize: '0.72rem', padding: '3px 8px', borderRadius: '6px', fontWeight: '600' }}>
                            {doc.type}
                          </span>
                        )}
                      </div>

                      <button
                        onClick={(e) => toggleFavorite(doc.id, e)}
                        style={{ background: 'none', border: 'none', color: isFav ? '#d97706' : '#cbd5e1', fontSize: '1.1rem', cursor: 'pointer' }}
                      >
                        {isFav ? '★' : '☆'}
                      </button>
                    </div>

                    {/* Summary */}
                    <div style={{ fontSize: '0.9rem', fontWeight: '700', color: '#0f172a', lineHeight: '1.35' }}>
                      {doc.summary || doc.name || doc.title || 'Không có trích yếu nội dung'}
                    </div>

                    {/* Sub-info: Dự án & Ngày */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.76rem', color: '#64748b', marginTop: '2px' }}>
                      <span>{prj?.name || 'Tất cả dự án'}</span>
                      {(doc.effectiveDate || doc.date || doc.completedDate) && (
                        <span>Hiệu lực: {doc.effectiveDate || doc.date || doc.completedDate}</span>
                      )}
                    </div>

                    {/* Danh sách các Tệp đính kèm trên Card */}
                    {files.length > 0 && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '4px', backgroundColor: '#f8fafc', padding: '8px 10px', borderRadius: '10px', border: '1px solid #f1f5f9' }}>
                        <div style={{ fontSize: '0.72rem', fontWeight: '700', color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Paperclip size={12} /> Tệp đính kèm ({files.length}):
                        </div>
                        {files.map((file, fIdx) => (
                          <div key={fIdx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                            <span style={{ fontSize: '0.78rem', color: '#1e293b', fontWeight: '600', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              📄 {file.name}
                            </span>
                            <button
                              onClick={(e) => handleOpenFile(file.url, e)}
                              style={{
                                backgroundColor: '#10b981',
                                color: '#ffffff',
                                border: 'none',
                                borderRadius: '6px',
                                padding: '4px 10px',
                                fontSize: '0.72rem',
                                fontWeight: '700',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '3px',
                                flexShrink: 0,
                                boxShadow: '0 2px 6px rgba(16,185,129,0.2)'
                              }}
                            >
                              Mở file <ExternalLink size={10} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Footer Action */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px', paddingTop: '6px' }}>
                      <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                        Cơ quan: {doc.issuingAgency || 'N/A'}
                      </span>

                      <button
                        onClick={(e) => handleShare(doc, e)}
                        style={{
                          backgroundColor: '#f1f5f9', color: '#475569', border: 'none', borderRadius: '8px',
                          padding: '4px 10px', fontSize: '0.72rem', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '4px'
                        }}
                      >
                        <Share2 size={12} /> Chia sẻ
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* ── TAB PHÁP LÝ (Legal Steps Timeline) ── */}
        {activeBottomNav === 'phaply' && (
          <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', padding: '18px', boxShadow: '0 4px 16px rgba(0,0,0,0.03)' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: '700', color: '#0f172a', marginBottom: '12px' }}>
              Quy trình & Bước pháp lý
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {(legalSteps || []).map((step, idx) => {
                const linkedDocs = (allDocuments || []).filter(d => !d.isDeleted && String(d.legalStepId || '') === String(step.id));
                const stepAtts = step.attachments || [];

                return (
                  <div
                    key={step.id || idx}
                    onClick={() => setSelectedLegalStep(step)}
                    style={{
                      padding: '14px', backgroundColor: '#f8fafc', borderRadius: '12px',
                      display: 'flex', flexDirection: 'column', gap: '8px', cursor: 'pointer',
                      border: '1px solid #f1f5f9'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ fontSize: '0.9rem', fontWeight: '700', color: '#1e293b' }}>{step.name}</div>
                      <span style={{ backgroundColor: '#e6f4ea', color: '#059669', fontSize: '0.75rem', fontWeight: '800', padding: '4px 10px', borderRadius: '12px' }}>
                        {linkedDocs.length + stepAtts.length} tệp
                      </span>
                    </div>

                    {/* Direct Step Attachments */}
                    {stepAtts.length > 0 && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '4px' }}>
                        <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: '700' }}>Tệp đính kèm bước ({stepAtts.length}):</div>
                        {stepAtts.map((att, aIdx) => (
                          <div key={aIdx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#ffffff', padding: '6px 10px', borderRadius: '8px' }}>
                            <span style={{ fontSize: '0.78rem', color: '#1e293b', fontWeight: '600' }}>📄 {att.name}</span>
                            <button
                              onClick={(e) => handleOpenFile(att.url, e)}
                              style={{ backgroundColor: '#10b981', color: '#fff', border: 'none', borderRadius: '6px', padding: '3px 8px', fontSize: '0.72rem', fontWeight: '700' }}
                            >
                              Mở file
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </main>

      {/* ── MONEY LOVER FLOATING BOTTOM NAVIGATION BAR ── */}
      <nav style={{
        position: 'fixed',
        bottom: '16px',
        left: '16px',
        right: '16px',
        height: '64px',
        backgroundColor: '#ffffff',
        borderRadius: '32px',
        boxShadow: '0 10px 30px rgba(0,0,0,0.08)',
        border: '1px solid rgba(0,0,0,0.04)',
        display: 'flex',
        alignItems: 'center',
        justify: 'space-around',
        zIndex: 99999,
        padding: '0 8px'
      }}>
        {/* 1. Tổng quan */}
        <button
          onClick={() => setActiveBottomNav('overview')}
          style={{
            background: 'none', border: 'none',
            color: activeBottomNav === 'overview' ? '#10b981' : '#94a3b8',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px',
            fontSize: '0.68rem', fontWeight: activeBottomNav === 'overview' ? '700' : '500',
            cursor: 'pointer', flex: 1
          }}
        >
          <Home size={20} />
          <span>Tổng quan</span>
        </button>

        {/* 2. Sổ tài liệu */}
        <button
          onClick={() => setActiveBottomNav('documents')}
          style={{
            background: 'none', border: 'none',
            color: activeBottomNav === 'documents' ? '#10b981' : '#94a3b8',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px',
            fontSize: '0.68rem', fontWeight: activeBottomNav === 'documents' ? '700' : '500',
            cursor: 'pointer', flex: 1
          }}
        >
          <FolderKanban size={20} />
          <span>Sổ tài liệu</span>
        </button>

        {/* 3. CENTER FLOATING PLUS FAB BUTTON */}
        <div style={{ position: 'relative', flex: 1, display: 'flex', justifyContent: 'center' }}>
          <button
            onClick={() => { setShowSearchInput(true); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
            style={{
              width: '52px',
              height: '52px',
              borderRadius: '50%',
              backgroundColor: '#10b981',
              color: '#ffffff',
              border: '4px solid #ffffff',
              boxShadow: '0 6px 16px rgba(16, 185, 129, 0.4)',
              display: 'flex',
              alignItems: 'center',
              justify: 'center',
              marginTop: '-24px',
              cursor: 'pointer'
            }}
          >
            <Plus size={28} strokeWidth={2.5} />
          </button>
        </div>

        {/* 4. Pháp lý */}
        <button
          onClick={() => setActiveBottomNav('phaply')}
          style={{
            background: 'none', border: 'none',
            color: activeBottomNav === 'phaply' ? '#10b981' : '#94a3b8',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px',
            fontSize: '0.68rem', fontWeight: activeBottomNav === 'phaply' ? '700' : '500',
            cursor: 'pointer', flex: 1
          }}
        >
          <Scale size={20} />
          <span>Pháp lý</span>
        </button>

        {/* 5. Đã lưu */}
        <button
          onClick={() => setActiveBottomNav('profile')}
          style={{
            background: 'none', border: 'none',
            color: activeBottomNav === 'profile' ? '#10b981' : '#94a3b8',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px',
            fontSize: '0.68rem', fontWeight: activeBottomNav === 'profile' ? '700' : '500',
            cursor: 'pointer', flex: 1
          }}
        >
          <Star size={20} />
          <span>Đã lưu ({favorites.length})</span>
        </button>
      </nav>

      {/* ── DETAIL MODAL SHEET (Money Lover Bottom Sheet with Complete Attachment List) ── */}
      {selectedDoc && (() => {
        const files = getDocFiles(selectedDoc);
        const docCode = selectedDoc.code || selectedDoc.number || selectedDoc.documentCode || selectedDoc.documentNumber || 'Chi tiết văn bản';

        return (
          <div
            onClick={() => setSelectedDoc(null)}
            style={{
              position: 'fixed', inset: 0, zIndex: 100000,
              backgroundColor: 'rgba(0,0,0,0.5)',
              display: 'flex', alignItems: 'flex-end',
              backdropFilter: 'blur(3px)'
            }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                width: '100%',
                backgroundColor: '#ffffff',
                borderTopLeftRadius: '24px',
                borderTopRightRadius: '24px',
                maxHeight: '88vh',
                overflowY: 'auto',
                padding: '20px 20px 32px 20px',
                boxSizing: 'border-box',
                display: 'flex',
                flexDirection: 'column',
                gap: '16px'
              }}
            >
              {/* Sheet Handle */}
              <div style={{ width: '40px', height: '4px', backgroundColor: '#cbd5e1', borderRadius: '2px', alignSelf: 'center' }} />

              {/* Header Detail */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <span style={{ backgroundColor: '#e6f4ea', color: '#059669', fontSize: '0.8rem', fontWeight: '800', padding: '4px 10px', borderRadius: '6px' }}>
                    {docCode}
                  </span>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: '800', color: '#0f172a', marginTop: '8px', lineHeight: '1.35' }}>
                    {selectedDoc.summary || selectedDoc.name || selectedDoc.title}
                  </h3>
                </div>
                <button onClick={() => setSelectedDoc(null)} style={{ background: '#f1f5f9', border: 'none', color: '#64748b', borderRadius: '50%', padding: '6px', cursor: 'pointer' }}>
                  <X size={18} />
                </button>
              </div>

              {/* Metadata Fields */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '0.82rem', backgroundColor: '#f8fafc', padding: '14px', borderRadius: '14px', border: '1px solid #f1f5f9' }}>
                <div>
                  <span style={{ color: '#64748b' }}>Phân loại:</span>
                  <div style={{ color: '#0f172a', fontWeight: '700', marginTop: '2px' }}>{selectedDoc.type || 'N/A'}</div>
                </div>
                <div>
                  <span style={{ color: '#64748b' }}>Cơ quan ban hành:</span>
                  <div style={{ color: '#0f172a', fontWeight: '700', marginTop: '2px' }}>{selectedDoc.issuingAgency || 'N/A'}</div>
                </div>
                <div>
                  <span style={{ color: '#64748b' }}>Ngày hiệu lực:</span>
                  <div style={{ color: '#0f172a', fontWeight: '700', marginTop: '2px' }}>{selectedDoc.effectiveDate || selectedDoc.date || selectedDoc.completedDate || 'N/A'}</div>
                </div>
                <div>
                  <span style={{ color: '#64748b' }}>Dự án:</span>
                  <div style={{ color: '#0f172a', fontWeight: '700', marginTop: '2px' }}>
                    {allProjects.find(p => String(p.id) === String(selectedDoc.projectId))?.name || 'Tất cả dự án'}
                  </div>
                </div>
              </div>

              {/* 📎 CHUYÊN MỤC TỆP ĐÍNH KÈM TÀI LIỆU ── */}
              <div>
                <div style={{ fontSize: '0.88rem', fontWeight: '800', color: '#0f172a', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Paperclip size={16} color="#059669" />
                  <span>Danh sách tệp đính kèm ({files.length})</span>
                </div>

                {files.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {files.map((file, idx) => (
                      <div
                        key={idx}
                        style={{
                          backgroundColor: '#f8fafc',
                          borderRadius: '12px',
                          padding: '10px 14px',
                          display: 'flex',
                          alignItems: 'center',
                          justify: 'space-between',
                          border: '1px solid #e2e8f0'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden', paddingRight: '8px' }}>
                          <span style={{ fontSize: '1.1rem' }}>📄</span>
                          <span style={{ fontSize: '0.82rem', fontWeight: '700', color: '#1e293b', wordBreak: 'break-all' }}>
                            {file.name}
                          </span>
                        </div>

                        <button
                          onClick={(e) => handleOpenFile(file.url, e)}
                          style={{
                            backgroundColor: '#10b981',
                            color: '#ffffff',
                            border: 'none',
                            borderRadius: '8px',
                            padding: '6px 14px',
                            fontSize: '0.78rem',
                            fontWeight: '700',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            flexShrink: 0,
                            boxShadow: '0 3px 8px rgba(16,185,129,0.25)',
                            cursor: 'pointer'
                          }}
                        >
                          Mở file <ExternalLink size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ backgroundColor: '#f8fafc', padding: '14px', borderRadius: '12px', fontSize: '0.8rem', color: '#64748b', textAlign: 'center' }}>
                    Không tìm thấy tệp đính kèm nào cho văn bản này.
                  </div>
                )}
              </div>

              {/* Actions Footer */}
              <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                <button
                  onClick={(e) => handleShare(selectedDoc, e)}
                  style={{ flex: 1, backgroundColor: '#f1f5f9', color: '#334155', border: 'none', borderRadius: '12px', padding: '14px', fontWeight: '700', fontSize: '0.9rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', cursor: 'pointer' }}
                >
                  <Share2 size={18} /> Chia sẻ
                </button>

                {files.length > 0 && (
                  <button
                    onClick={(e) => handleOpenFile(files[0].url, e)}
                    style={{ flex: 2, backgroundColor: '#10b981', color: '#ffffff', border: 'none', borderRadius: '12px', padding: '14px', fontWeight: '800', fontSize: '0.9rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', boxShadow: '0 4px 14px rgba(16,185,129,0.35)', cursor: 'pointer' }}
                  >
                    📄 Mở file đính kèm 1 <ExternalLink size={18} />
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};

export default MobileDocumentApp;
