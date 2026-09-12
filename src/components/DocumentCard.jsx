import React, { useState, useContext, memo } from 'react';
import { ROLES } from '../constants';
import { DocumentContext } from '../context/DocumentContext';
import { useConfirm, useToast } from '../context/UIContext';
import { Calendar, Building, Link as LinkIcon, Download, Lock, Edit, Trash2, Eye, Check, X as XIcon, Clock, User, ShieldCheck } from 'lucide-react';
import DocumentForm from './DocumentForm';
import PdfViewerModal from './PdfViewerModal';
import RejectDocModal from './RejectDocModal';
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
  const [isEditing, setIsEditing]       = useState(false);
  const [isPreview, setIsPreview]       = useState(false);
  const [isRejecting, setIsRejecting]   = useState(false);
  const [pdfFile, setPdfFile]           = useState(null); // { name, url } đang xem inline
  const { userRole, deleteDocument, checkDocumentPermission, legalSteps = [], approveDocument, rejectDocument, canApproveDocs } = useContext(DocumentContext);
  const confirm = useConfirm();
  const toast = useToast();
  const {
    id, documentCode, documentNumber, documentType, issuingAgency, effectiveDate,
    summary, attachmentLink, attachments, accessLevels, quickViewImage, isNew, status, approvalStatus,
    createdByName, uploader, createdByEmail, approvedByName, approvedBy, approvedAt
  } = document;

  const isPending = status === 'pending_approval' || approvalStatus === 'pending';
  const hasApprovePerm = userRole === 'Admin' || (canApproveDocs && canApproveDocs());

  const formattedDate = effectiveDate && !isNaN(new Date(effectiveDate).getTime())
    ? format(new Date(effectiveDate), 'dd/MM/yyyy', { locale: vi })
    : 'Chưa cập nhật';

  const uploaderDisplayName = createdByName || uploader || (createdByEmail ? createdByEmail.split('@')[0] : '');
  const approverDisplayName = approvedByName || approvedBy || '';

  const handleDelete = async (e) => {
    e.stopPropagation();
    const ok = await confirm('Bạn có chắc chắn muốn xóa tài liệu này?');
    if (ok) deleteDocument(id);
  };

  const handleApprove = async (e) => {
    e.stopPropagation();
    const ok = await confirm('Bạn có chắc chắn muốn phê duyệt và công khai tài liệu này?');
    if (ok) {
      try {
        await approveDocument(id);
        toast.success('Đã phê duyệt tài liệu thành công!');
      } catch (err) {
        toast.error('Lỗi khi phê duyệt: ' + (err.message || ''));
      }
    }
  };

  const handleReject = (e) => {
    e.stopPropagation();
    setIsRejecting(true);
  };

  const handleConfirmReject = async (reason) => {
    try {
      await rejectDocument(id, reason, createdByEmail);
      toast.info('Đã từ chối và gửi thông báo phản hồi đến Web/Mobile App của người đăng.');
      setIsRejecting(false);
    } catch (err) {
      toast.error('Lỗi khi từ chối: ' + (err.message || ''));
    }
  };

  // ── LIST VIEW ─────────────────────────────────────────────────────────
  if (viewMode === 'list') {
    return (
      <>
        <div
          className="card"
          onClick={() => setIsPreview(true)}
          style={{
            display: 'flex', padding: '1rem', gap: '1.5rem', alignItems: 'center',
            outline: isSelected ? '2px solid rgba(59,130,246,0.5)' : 'none',
            background: isSelected ? 'rgba(59,130,246,0.05)' : undefined,
            transition: 'outline 0.15s, background 0.15s, transform 0.2s, box-shadow 0.2s',
            cursor: 'pointer'
          }}
          onMouseOver={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 18px rgba(0,0,0,0.12)'; }}
          onMouseOut={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0,0,0,0.1)'; }}
        >
          {/* Info */}
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem', flexWrap: 'wrap' }}>
              <span className="badge badge-blue">{documentCode}</span>
              {documentType && <span className="badge badge-yellow">{documentType}</span>}
              {isPending && (
                <span className="badge" style={{ backgroundColor: 'rgba(249, 115, 22, 0.15)', color: '#f97316', border: '1px solid rgba(249, 115, 22, 0.35)', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '3px' }}>
                  <Clock size={12} /> Chờ phê duyệt
                </span>
              )}
              {isNew && !isPending && <span className="badge badge-pink">Mới</span>}
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
            <div style={{ display: 'flex', gap: '1.25rem', color: 'var(--color-text-muted)', fontSize: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Building size={14} /> {issuingAgency}</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Calendar size={14} /> Hiệu lực: {formattedDate}</span>
              {uploaderDisplayName && (
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#93c5fd' }}>
                  <User size={13} color="#60a5fa" /> Đăng bởi: {uploaderDisplayName}
                </span>
              )}
              {approverDisplayName && !isPending && (
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#34d399' }}>
                  <ShieldCheck size={13} color="#10b981" /> Duyệt: {approverDisplayName}
                </span>
              )}
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
                      onClick={e => e.stopPropagation()}
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
              <a href={attachmentLink} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} className="btn btn-outline" style={{ padding: '0.5rem' }} title="Tải xuống">
                <Download size={16} />
              </a>
            )}

            {/* Edit / Delete / Approve / Reject + Checkbox — cùng một hàng */}
            <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', marginTop: 'auto', flexShrink: 0 }}>
              {isPending && hasApprovePerm && (
                <>
                  <button
                    className="btn"
                    onClick={handleApprove}
                    title="Phê duyệt đăng tải"
                    style={{
                      backgroundColor: '#10b981', color: 'white', padding: '0.3rem 0.65rem',
                      fontSize: '0.78rem', fontWeight: '700', borderRadius: '6px', border: 'none',
                      display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer',
                      boxShadow: '0 2px 6px rgba(16, 185, 129, 0.3)'
                    }}
                  >
                    <Check size={13} /> Duyệt
                  </button>
                  <button
                    className="btn"
                    onClick={handleReject}
                    title="Từ chối đăng tải & Xóa tài liệu"
                    style={{
                      backgroundColor: '#ef4444', color: 'white', padding: '0.3rem 0.65rem',
                      fontSize: '0.78rem', fontWeight: '700', borderRadius: '6px', border: 'none',
                      display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer',
                      boxShadow: '0 2px 6px rgba(239, 68, 68, 0.3)'
                    }}
                  >
                    <Trash2 size={13} /> Từ chối
                  </button>
                </>
              )}
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
        {isPreview && <DocumentForm initialData={document} previewMode={true} onClose={() => setIsPreview(false)} />}
        {pdfFile && <PdfViewerModal file={pdfFile} onClose={() => setPdfFile(null)} />}
        {isRejecting && <RejectDocModal document={document} onClose={() => setIsRejecting(false)} onConfirm={handleConfirmReject} />}
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
                {isPending && (
                  <span className="badge" style={{ backgroundColor: 'rgba(249, 115, 22, 0.15)', color: '#f97316', border: '1px solid rgba(249, 115, 22, 0.35)', fontSize: '0.65rem', padding: '0.15rem 0.4rem', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '3px' }}>
                    <Clock size={10} /> Chờ phê duyệt
                  </span>
                )}
                {isNew && !isPending && <span className="badge badge-pink" style={{ fontSize: '0.65rem', padding: '0.15rem 0.4rem' }}>Mới</span>}
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

          {/* Agency / Date / Uploader */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem', marginBottom: '1.25rem', paddingTop: '0.85rem', borderTop: '1px solid var(--color-border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-text-muted)', fontSize: '0.8125rem' }}>
              <Building size={16} />
              <span style={{ fontWeight: '500', color: 'var(--color-text-main)' }}>{issuingAgency}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '6px', color: 'var(--color-text-muted)', fontSize: '0.78rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Calendar size={14} />
                <span>Hiệu lực: {formattedDate}</span>
              </div>
              {uploaderDisplayName && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#93c5fd', fontSize: '0.75rem' }}>
                  <User size={13} color="#60a5fa" /> {uploaderDisplayName}
                </div>
              )}
            </div>
            {approverDisplayName && !isPending && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#34d399', fontSize: '0.75rem' }}>
                <ShieldCheck size={13} color="#10b981" /> Đã duyệt bởi: {approverDisplayName}
              </div>
            )}
          </div>

          {/* Attachments & Admin Buttons */}
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

            {/* Cụm biểu tượng Sửa, Xóa, Checkbox / Duyệt, Từ chối */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0, marginLeft: 'auto' }}>
              {isPending && hasApprovePerm && (
                <>
                  <button
                    className="btn"
                    onClick={handleApprove}
                    title="Phê duyệt đăng tải"
                    style={{
                      backgroundColor: '#10b981', color: 'white', padding: '0.25rem 0.5rem',
                      fontSize: '0.72rem', fontWeight: '700', borderRadius: '5px', border: 'none',
                      display: 'flex', alignItems: 'center', gap: '3px', cursor: 'pointer',
                      boxShadow: '0 2px 4px rgba(16, 185, 129, 0.25)'
                    }}
                  >
                    <Check size={12} /> Duyệt
                  </button>
                  <button
                    className="btn"
                    onClick={handleReject}
                    title="Từ chối đăng tải & Xóa tài liệu"
                    style={{
                      backgroundColor: '#ef4444', color: 'white', padding: '0.25rem 0.5rem',
                      fontSize: '0.72rem', fontWeight: '700', borderRadius: '5px', border: 'none',
                      display: 'flex', alignItems: 'center', gap: '3px', cursor: 'pointer',
                      boxShadow: '0 2px 4px rgba(239, 68, 68, 0.25)'
                    }}
                  >
                    <Trash2 size={12} /> Từ chối
                  </button>
                </>
              )}
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
      {isRejecting && <RejectDocModal document={document} onClose={() => setIsRejecting(false)} onConfirm={handleConfirmReject} />}
    </>
  );
};

export default memo(DocumentCard);
