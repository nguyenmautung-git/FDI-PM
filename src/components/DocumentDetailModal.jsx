import React, { useRef, useState, useContext, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { X, Calendar, Building, Download, Lock, Check, Upload, Loader, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../firebase';
import { withTimeout, validateFileSize } from '../utils/uploadHelpers';
import { DocumentContext } from '../context/DocumentContext';

const DocumentDetailModal = ({ document, onClose }) => {
  if (!document) return null;

  const { editDocument, markAsRead, legalSteps = [] } = useContext(DocumentContext);
  const fileInputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [currentAttachments, setCurrentAttachments] = useState(
    document.attachments || (document.attachmentLink ? [{ name: 'Tệp đính kèm gốc', url: document.attachmentLink }] : [])
  );

  // Đánh dấu đã đọc khi mở modal
  useEffect(() => {
    if (document?.id && markAsRead) {
      markAsRead(document.id);
    }
  // chỉ chạy 1 lần khi mount
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const {
    documentCode, documentNumber, documentType, issuingAgency, effectiveDate,
    summary, relatedProjects, accessLevels, quickViewImage, isNew
  } = document;

  const formattedDate = effectiveDate && !isNaN(new Date(effectiveDate).getTime())
    ? format(new Date(effectiveDate), 'dd/MM/yyyy', { locale: vi })
    : 'Chưa cập nhật';




  const handleUploadMore = async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;

    const { valid, errors } = validateFileSize(files);
    if (errors.length) {
      setUploadError(`File quá lớn (tối đa 50MB): ${errors.join('; ')}`);
      if (fileInputRef.current) fileInputRef.current.value = '';
      if (!valid.length) return;
    } else {
      setUploadError('');
    }

    setUploading(true);
    try {
      const newFiles = await Promise.all(
        valid.map(async (file) => {
          const storageRef = ref(storage, `documents/${Date.now()}_${file.name}`);
          const snapshot = await withTimeout(uploadBytes(storageRef, file), 20000);
          const url = await getDownloadURL(snapshot.ref);
          return { name: file.name, url };
        })
      );

      const updated = [...currentAttachments, ...newFiles];
      await editDocument(document.id, { ...document, attachments: updated });
      setCurrentAttachments(updated);
    } catch (err) {
      console.error('Upload error:', err);
      setUploadError(err.message || 'Lỗi tải lên. Vui lòng thử lại.');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRemoveAttachment = async (idx) => {
    const updated = currentAttachments.filter((_, i) => i !== idx);
    try {
      await editDocument(document.id, { ...document, attachments: updated });
      setCurrentAttachments(updated);
    } catch (err) {
      console.error('Remove error:', err);
    }
  };

  return ReactDOM.createPortal(
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 2000 }}>
      <div className="modal-content" onClick={e => e.stopPropagation()} style={{ display: 'flex', flexDirection: 'column', maxWidth: '800px', height: '85vh' }}>
        {/* Header */}
        <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--color-bg-surface-hover)', borderTopLeftRadius: 'var(--radius-lg)', borderTopRightRadius: 'var(--radius-lg)' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: '700', margin: 0 }}>Chi tiết tài liệu: {documentCode}</h2>
          <button className="btn-icon" onClick={onClose}><X size={20} /></button>
        </div>

        {/* Body */}
        <div style={{ padding: '1.5rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1.5rem', flex: 1 }}>

          <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 300px' }}>
              <img src={quickViewImage} alt="Preview" style={{ width: '100%', height: 'auto', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }} />
            </div>

            <div style={{ flex: '2 1 400px', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.5rem' }}>
                  {documentType && <span className="badge badge-yellow">{documentType}</span>}
                  {isNew && <span className="badge badge-pink">Mới</span>}
                  {accessLevels && accessLevels.length > 0 && (
                    <span className="badge" style={{ backgroundColor: 'rgba(240, 173, 78, 0.15)', color: '#d97706', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Lock size={12} /> Cấp {accessLevels.join(', ')}
                    </span>
                  )}
                </div>
                <h3 style={{ fontSize: '1.5rem', fontWeight: '700', margin: 0 }}>Số: {documentNumber}</h3>
              </div>

              <div style={{ padding: '1rem', backgroundColor: 'var(--color-bg-surface-hover)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}>
                <p style={{ margin: 0, fontWeight: '500', color: 'var(--color-text-main)' }}>Trích yếu:</p>
                <p style={{ margin: '0.5rem 0 0', fontSize: '0.95rem', color: 'var(--color-text-muted)' }}>{summary}</p>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem', marginBottom: '0.25rem' }}>Cơ quan ban hành</p>
                  <p style={{ fontWeight: '500', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Building size={16} color="var(--color-primary)" /> {issuingAgency}</p>
                </div>
                <div>
                  <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem', marginBottom: '0.25rem' }}>Ngày hiệu lực</p>
                  <p style={{ fontWeight: '500', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Calendar size={16} color="var(--color-primary)" /> {formattedDate}</p>
                </div>
              </div>
            </div>
          </div>

          <hr style={{ border: 'none', borderTop: '1px solid var(--color-border)' }} />

          <div>
            <h4 style={{ fontSize: '1.1rem', fontWeight: '600', marginBottom: '1rem' }}>Dự án liên quan</h4>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
              {relatedProjects && relatedProjects.map((p, idx) => (
                <span key={idx} className="badge badge-green" style={{ fontSize: '0.85rem', padding: '0.4rem 0.75rem' }}><Check size={14} style={{ marginRight: '0.25rem' }} /> {p}</span>
              ))}
            </div>

            {document.legalStepId && (() => {
              const step = (legalSteps || []).find(s => s.id === document.legalStepId);
              if (!step) return null;
              return (
                <div style={{ marginTop: '0.75rem', padding: '0.6rem 1rem', backgroundColor: 'rgba(99, 102, 241, 0.12)', border: '1px solid rgba(99, 102, 241, 0.3)', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontSize: '0.85rem', color: '#a5b4fc' }}>📌 <strong>Bước pháp lý liên quan:</strong> {step.name}</span>
                </div>
              );
            })()}
          </div>

          <hr style={{ border: 'none', borderTop: '1px solid var(--color-border)' }} />

          {/* Attachments section */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h4 style={{ fontSize: '1.1rem', fontWeight: '600', margin: 0 }}>Tài liệu đính kèm</h4>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                {uploading && (
                  <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <Loader size={14} style={{ animation: 'spin 1s linear infinite' }} />
                    Đang tải lên...
                  </span>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  id="upload-more-input"
                  style={{ display: 'none' }}
                  onChange={handleUploadMore}
                />
                <button
                  className="btn btn-outline"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', padding: '0.4rem 0.85rem' }}
                >
                  <Upload size={15} />
                  Tải lên bổ sung
                </button>
              </div>
            </div>

            {uploadError && (
              <p style={{ color: 'var(--color-danger)', fontSize: '0.82rem', marginBottom: '0.75rem' }}>⚠️ {uploadError}</p>
            )}

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
              {currentAttachments.length > 0 ? (
                currentAttachments.map((file, idx) => (
                  <div key={idx} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                    <a
                      href={file.url}
                      target="_blank"
                      rel="noreferrer"
                      className="btn btn-outline"
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', border: 'none', borderRadius: 0 }}
                    >
                      <Download size={15} /> {file.name}
                    </a>
                    <button
                      onClick={() => handleRemoveAttachment(idx)}
                      title="Xóa tệp này"
                      style={{
                        background: 'none', border: 'none', borderLeft: '1px solid var(--color-border)',
                        cursor: 'pointer', color: 'var(--color-danger)', padding: '0.5rem 0.6rem',
                        display: 'flex', alignItems: 'center'
                      }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))
              ) : (
                <p style={{ color: 'var(--color-text-muted)', fontStyle: 'italic' }}>Chưa có tệp đính kèm nào.</p>
              )}
            </div>
          </div>

        </div>

        {/* Footer */}
        <div style={{ padding: '1.25rem 1.5rem', borderTop: '1px solid var(--color-border)', display: 'flex', justifyContent: 'flex-end', backgroundColor: 'var(--color-bg-surface-hover)', borderBottomLeftRadius: 'var(--radius-lg)', borderBottomRightRadius: 'var(--radius-lg)' }}>
          <button className="btn btn-primary" onClick={onClose}>Đóng</button>
        </div>

        <style>{`
          @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        `}</style>
      </div>
    </div>,
    window.document.body
  );
};

export default DocumentDetailModal;
