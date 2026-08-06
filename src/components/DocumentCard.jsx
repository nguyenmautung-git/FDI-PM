import React, { useState, useContext, memo } from 'react';
import { ROLES } from '../constants';
import { DocumentContext } from '../context/DocumentContext';
import { useConfirm } from '../context/UIContext';
import { Calendar, Building, Link as LinkIcon, Download, Lock, Edit, Trash2, Eye } from 'lucide-react';
import DocumentForm from './DocumentForm';
import PdfViewerModal from './PdfViewerModal';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';

// ── Checkbox component ─────────────────────────────────────────────────────
const DocCheckbox = ({ checked, onChange }) => (
  <div
    onClick={e => { e.stopPropagation(); onChange(); }}
    style={{
      width: '20px', height: '20px', borderRadius: '5px', flexShrink: 0,
      border: checked ? '2px solid #3b82f6' : '2px solid rgba(255,255,255,0.25)',
      background: checked ? '#3b82f6' : 'rgba(255,255,255,0.06)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      cursor: 'pointer', transition: 'all 0.15s',
    }}
    title={checked ? 'Bỏ chọn' : 'Chọn tài liệu này'}
  >
    {checked && (
      <svg width="11" height="8" viewBox="0 0 11 8" fill="none">
        <path d="M1 3.5L4 6.5L10 1" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    )}
  </div>
);

// ── Main Card ─────────────────────────────────────────────────────────────
const DocumentCard = ({ document, viewMode, isSelected, onToggleSelect }) => {
  const [isEditing, setIsEditing]   = useState(false);
  const [isPreview, setIsPreview]   = useState(false);
  const [pdfFile, setPdfFile]       = useState(null); // { name, url } đang xem inline
  const { userRole, deleteDocument, checkDocumentPermission, legalSteps = [] } = useContext(DocumentContext);
  const confirm = useConfirm();
  const {
    id, documentCode, documentNumber, documentType, issuingAgency, effectiveDate,
    summary, attachmentLink, attachments, accessLevels, quickViewImage, isNew
  } = document;

  const formattedDate = effectiveDate && !isNaN(new Date(effectiveDate).getTime())
    ? format(new Date(effectiveDate), 'dd/MM/yyyy', { locale: vi })
    : 'Chưa cập nhật';

  const handleDelete = async (e) => {
    e.stopPropagation();
    const ok = await confirm('Bạn có chắc chắn muốn xóa tài liệu này?');
    if (ok) deleteDocument(id);
  };

  // ── LIST VIEW ─────────────────────────────────────────────────────────
  if (viewMode === 'list') {
    return (
      <>
        <div
          className="card"
          style={{
            display: 'flex', padding: '1rem', gap: '1.5rem', alignItems: 'center',
            outline: isSelected ? '2px solid rgba(59,130,246,0.5)' : 'none',
            background: isSelected ? 'rgba(59,130,246,0.05)' : undefined,
            transition: 'outline 0.15s, background 0.15s',
          }}
        >
          {/* Preview thumbnail */}
          <div style={{ width: '120px', height: '80px', borderRadius: 'var(--radius-md)', overflow: 'hidden', flexShrink: 0 }}>
            <img src={quickViewImage} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>

          {/* Info */}
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem', flexWrap: 'wrap' }}>
              <span className="badge badge-blue">{documentCode}</span>
              {documentType && <span className="badge badge-yellow">{documentType}</span>}
              {isNew && <span className="badge badge-pink">Mới</span>}
              {accessLevels?.length > 0 && (
                <span className="badge" style={{ backgroundColor: 'rgba(240,173,78,0.15)', color: '#d97706', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Lock size={12} /> Cấp {accessLevels.join(', ')}
                </span>
              )}
              {document.legalStepId && (() => {
                const step = (legalSteps || []).find(s => s.id === document.legalStepId);
                if (!step) return null;
                return (
                  <span className="badge" style={{ backgroundColor: 'rgba(99, 102, 241, 0.15)', color: '#a5b4fc', border: '1px solid rgba(99, 102, 241, 0.3)' }}>
                    📌 {step.name}
                  </span>
                );
              })()}
              <h3 style={{ fontSize: '1rem', fontWeight: '600', margin: 0 }}>Số: {documentNumber}</h3>
            </div>
            <p style={{ color: 'var(--color-text-main)', fontSize: '0.875rem', marginBottom: '0.5rem', display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
              {summary}
            </p>
            <div style={{ display: 'flex', gap: '1.5rem', color: 'var(--color-text-muted)', fontSize: '0.75rem' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Building size={14} /> {issuingAgency}</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Calendar size={14} /> Hiệu lực: {formattedDate}</span>
            </div>
          </div>

          {/* Attachments */}
          <div style={{ display: 'flex', gap: '0.5rem', flexDirection: 'column' }}>
            {attachments?.length > 0 ? (
              <div style={{ display: 'flex', gap: '0.25rem', flexDirection: 'column' }}>
                {attachments.map((file, idx) => (
                  <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <a href={file.url} target="_blank" rel="noreferrer"
                      className="badge"
                      style={{ backgroundColor: 'var(--color-bg-surface)', border: '1px solid var(--color-border)', color: 'var(--color-primary)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px', padding: '0.25rem 0.5rem', flex: 1 }}
                      title={file.name}
                    >
                      <Download size={12} />
                      <span style={{ maxWidth: '80px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.name}</span>
                    </a>
                    <button
                      onClick={e => { e.stopPropagation(); setPdfFile(file); }}
                      title="Xem tệp inline"
                      style={{ background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.3)', borderRadius: '4px', color: '#60a5fa', cursor: 'pointer', padding: '2px 5px', display: 'flex', alignItems: 'center', flexShrink: 0 }}
                    >
                      <Eye size={12} />
                    </button>
                  </div>
                ))}
              </div>
            ) : attachmentLink && (
              <a href={attachmentLink} target="_blank" rel="noreferrer" className="btn btn-outline" style={{ padding: '0.5rem' }} title="Tải xuống">
                <Download size={16} />
              </a>
            )}

            {/* Edit / Delete + Checkbox — cùng một hàng */}
            <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', marginTop: 'auto', flexShrink: 0 }}>
              {checkDocumentPermission(document, 'edit_docs') && (
                <>
                  <button className="btn-icon"
                    style={{ backgroundColor: 'rgba(255,255,255,0.1)', border: '1px solid var(--color-border)', color: 'var(--color-primary)', width: '32px', height: '32px' }}
                    onClick={e => { e.stopPropagation(); setIsEditing(true); }} title="Sửa thông tin">
                    <Edit size={16} />
                  </button>
                  <button className="btn-icon"
                    style={{ backgroundColor: 'rgba(255,255,255,0.1)', border: '1px solid var(--color-border)', color: 'var(--color-danger)', width: '32px', height: '32px' }}
                    onClick={handleDelete} title="Xóa tài liệu">
                    <Trash2 size={16} />
                  </button>
                </>
              )}
              <DocCheckbox checked={!!isSelected} onChange={onToggleSelect} />
            </div>
          </div>
        </div>
        {isEditing && <DocumentForm initialData={document} onClose={() => setIsEditing(false)} />}
        {pdfFile && <PdfViewerModal file={pdfFile} onClose={() => setPdfFile(null)} />}
      </>
    );
  }

  // ── GRID VIEW ─────────────────────────────────────────────────────────
  return (
    <>
      <div
        className="card"
        style={{
          display: 'flex', flexDirection: 'column', height: '100%',
          cursor: 'pointer', transition: 'transform 0.2s ease, box-shadow 0.2s ease',
          padding: 0, overflow: 'hidden',
          outline: isSelected ? '2px solid rgba(59,130,246,0.6)' : 'none',
        }}
        onClick={() => setIsPreview(true)}
        onMouseOver={e => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = '0 12px 24px rgba(0,0,0,0.1)'; }}
        onMouseOut={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06)'; }}
      >
        <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', flex: 1 }}>
          {/* Top row: badges */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
            <div>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                {isNew && <span className="badge badge-pink" style={{ fontSize: '0.65rem', padding: '0.15rem 0.4rem' }}>Mới</span>}
                <span style={{ fontSize: '0.75rem', color: 'var(--color-primary)', fontWeight: '600' }}>{documentCode}</span>
                {documentType && <span className="badge badge-yellow" style={{ fontSize: '0.65rem', padding: '0.15rem 0.4rem' }}>{documentType}</span>}
                {accessLevels?.length > 0 && (
                  <span className="badge" style={{ backgroundColor: 'rgba(240,173,78,0.15)', color: '#d97706', fontSize: '0.65rem', padding: '0.15rem 0.4rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Lock size={10} /> Cấp {accessLevels.join(', ')}
                  </span>
                )}
                {document.legalStepId && (() => {
                  const step = (legalSteps || []).find(s => s.id === document.legalStepId);
                  if (!step) return null;
                  return (
                    <span className="badge" style={{ backgroundColor: 'rgba(99, 102, 241, 0.15)', color: '#a5b4fc', border: '1px solid rgba(99, 102, 241, 0.3)', fontSize: '0.65rem', padding: '0.15rem 0.4rem' }}>
                      📌 {step.name}
                    </span>
                  );
                })()}
              </div>
              <h3 style={{ fontSize: '1.125rem', fontWeight: '700', marginTop: '0.25rem', marginBottom: 0 }}>Số: {documentNumber}</h3>
            </div>
          </div>

          {/* Summary */}
          <div style={{ color: 'var(--color-text-main)', fontSize: '0.875rem', marginBottom: '1rem', flex: 1, display: '-webkit-box', WebkitLineClamp: 6, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
            {summary}
          </div>

          {/* Agency / Date */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.25rem', paddingTop: '1rem', borderTop: '1px solid var(--color-border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-text-muted)', fontSize: '0.8125rem' }}>
              <Building size={16} />
              <span style={{ fontWeight: '500', color: 'var(--color-text-main)' }}>{issuingAgency}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-text-muted)', fontSize: '0.8125rem' }}>
              <Calendar size={16} />
              <span>Ngày hiệu lực: {formattedDate}</span>
            </div>
          </div>

          {/* Attachments & Admin Buttons (Khung Đỏ mới ở dưới góc phải) */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', marginTop: 'auto', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', flex: 1 }}>
              {attachments?.length > 0 ? (
                attachments.map((file, idx) => (
                  <div key={idx} style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                    <a href={file.url} target="_blank" rel="noreferrer"
                      className="badge"
                      onClick={e => e.stopPropagation()}
                      style={{ backgroundColor: 'var(--color-bg-body)', border: '1px solid var(--color-border)', color: 'var(--color-primary)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px', padding: '0.25rem 0.5rem' }}
                      title={file.name}
                    >
                      <LinkIcon size={12} />
                      <span style={{ maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.name}</span>
                    </a>
                    <button
                      onClick={e => { e.stopPropagation(); setPdfFile(file); }}
                      title="Xem tệp inline"
                      style={{ background: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.3)', borderRadius: '4px', color: '#60a5fa', cursor: 'pointer', padding: '3px 5px', display: 'flex', alignItems: 'center', flexShrink: 0 }}
                    >
                      <Eye size={11} />
                    </button>
                  </div>
                ))
              ) : attachmentLink && (
                <a href={attachmentLink} target="_blank" rel="noreferrer"
                  className="badge"
                  style={{ backgroundColor: 'var(--color-bg-body)', border: '1px solid var(--color-border)', color: 'var(--color-primary)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px', padding: '0.25rem 0.5rem' }}>
                  <LinkIcon size={12} /> Tải xuống tệp
                </a>
              )}
            </div>

            {/* Cụm biểu tượng Sửa, Xóa, Checkbox ở Khung Đỏ dưới góc phải */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0, marginLeft: 'auto' }}>
              {checkDocumentPermission(document, 'edit_docs') && (
                <>
                  <button className="btn-icon"
                    style={{ backgroundColor: 'var(--color-bg-surface-hover)', border: '1px solid var(--color-border)', color: 'var(--color-primary)', width: '28px', height: '28px' }}
                    onClick={e => { e.stopPropagation(); setIsEditing(true); }} title="Sửa thông tin">
                    <Edit size={14} />
                  </button>
                  <button className="btn-icon"
                    style={{ backgroundColor: 'var(--color-bg-surface-hover)', border: '1px solid var(--color-border)', color: 'var(--color-danger)', width: '28px', height: '28px' }}
                    onClick={handleDelete} title="Xóa tài liệu">
                    <Trash2 size={14} />
                  </button>
                </>
              )}
              <DocCheckbox checked={!!isSelected} onChange={onToggleSelect} />
            </div>
          </div>
        </div>
      </div>
      {isEditing && <DocumentForm initialData={document} onClose={() => setIsEditing(false)} />}
      {isPreview && <DocumentForm initialData={document} previewMode={true} onClose={() => setIsPreview(false)} />}
      {pdfFile && <PdfViewerModal file={pdfFile} onClose={() => setPdfFile(null)} />}
    </>
  );
};

export default memo(DocumentCard);
