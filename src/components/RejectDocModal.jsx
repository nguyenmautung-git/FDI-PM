import React, { useState } from 'react';
import ReactDOM from 'react-dom';
import { X, AlertTriangle, Send, User, FileText, CheckCircle2, MessageSquare, Tag, Bell, Smartphone } from 'lucide-react';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';

const QUICK_TAGS = [
  'Tài liệu đăng không phù hợp',
  'Tài liệu đăng đã có',
  'Ý kiến khác',
  'Tài liệu scan/file bị mờ hoặc thiếu trang',
  'Thông tin trích yếu hoặc phân loại chưa chính xác'
];

const RejectDocModal = ({ document: doc, onClose, onConfirm }) => {
  const [selectedTag, setSelectedTag] = useState('Tài liệu đăng không phù hợp');
  const [customReason, setCustomReason] = useState('Tài liệu đăng không phù hợp');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!doc) return null;

  const uploaderName = doc.createdByName || doc.uploader || (doc.createdByEmail ? doc.createdByEmail.split('@')[0] : 'Người đăng');
  const uploaderEmail = doc.createdByEmail || '';
  const formattedUploadDate = doc.createdAt && !isNaN(new Date(doc.createdAt).getTime())
    ? format(new Date(doc.createdAt), 'dd/MM/yyyy HH:mm', { locale: vi })
    : 'Chưa xác định';

  const handleSelectTag = (tag) => {
    setSelectedTag(tag);
    if (tag === 'Ý kiến khác') {
      if (customReason === 'Tài liệu đăng không phù hợp' || customReason === 'Tài liệu đăng đã có' || customReason === 'Tài liệu scan/file bị mờ hoặc thiếu trang' || customReason === 'Thông tin trích yếu hoặc phân loại chưa chính xác') {
        setCustomReason('');
      }
    } else {
      setCustomReason(tag);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const finalReason = customReason.trim() || selectedTag;
    if (!finalReason) {
      alert('Vui lòng chọn hoặc nhập lý do từ chối đăng tải.');
      return;
    }

    setIsSubmitting(true);
    onConfirm(finalReason);
  };

  return ReactDOM.createPortal(
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 2500 }}>
      <div 
        className="modal-content" 
        onClick={e => e.stopPropagation()} 
        style={{ 
          maxWidth: '560px', 
          display: 'flex', 
          flexDirection: 'column', 
          backgroundColor: '#1e293b', 
          color: '#f8fafc',
          borderRadius: '16px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.65)',
          border: '1px solid rgba(239, 68, 68, 0.35)',
          overflow: 'hidden'
        }}
      >
        {/* Header */}
        <div style={{ 
          padding: '1.25rem 1.5rem', 
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)', 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          backgroundColor: 'rgba(239, 68, 68, 0.12)' 
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ 
              width: '38px', 
              height: '38px', 
              borderRadius: '10px', 
              backgroundColor: 'rgba(239, 68, 68, 0.2)', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              color: '#ef4444',
              border: '1px solid rgba(239, 68, 68, 0.35)'
            }}>
              <AlertTriangle size={20} />
            </div>
            <div>
              <h2 style={{ fontSize: '1.15rem', fontWeight: '700', margin: 0, color: '#fca5a5' }}>
                Từ chối phê duyệt tài liệu
              </h2>
              <span style={{ fontSize: '0.78rem', color: '#cbd5e1' }}>
                Số: <strong style={{ color: '#fff' }}>{doc.documentNumber || doc.documentCode}</strong>
              </span>
            </div>
          </div>
          <button 
            className="btn-icon" 
            onClick={onClose}
            style={{ color: '#94a3b8', background: 'none', border: 'none', cursor: 'pointer' }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem', overflowY: 'auto' }}>
          
          {/* Thông tin người đăng */}
          <div style={{ 
            padding: '0.85rem 1rem', 
            backgroundColor: 'rgba(255, 255, 255, 0.04)', 
            borderRadius: '10px', 
            border: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.4rem',
            fontSize: '0.85rem'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
              <span style={{ color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '5px' }}>
                <User size={14} color="#60a5fa" /> Người đăng:
              </span>
              <span style={{ fontWeight: '600', color: '#f8fafc' }}>
                {uploaderName} {uploaderEmail ? `(${uploaderEmail})` : ''}
              </span>
            </div>
            {formattedUploadDate && formattedUploadDate !== 'Chưa xác định' && (
              <div style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'flex', justifyContent: 'flex-end' }}>
                Thời gian tải lên: {formattedUploadDate}
              </div>
            )}
            {doc.summary && (
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '5px', marginTop: '2px', color: '#cbd5e1', fontSize: '0.8rem' }}>
                <FileText size={13} style={{ flexShrink: 0, marginTop: '2px' }} color="#94a3b8" />
                <span style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                  {doc.summary}
                </span>
              </div>
            )}
          </div>

          {/* Quick Tags Selection */}
          <div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.65rem', color: '#e2e8f0' }}>
              <Tag size={15} color="#f59e0b" />
              Chọn nhanh lý do từ chối:
            </label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
              {QUICK_TAGS.map((tag, idx) => {
                const isSelected = selectedTag === tag;
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSelectTag(tag)}
                    style={{
                      padding: '0.4rem 0.75rem',
                      fontSize: '0.8rem',
                      fontWeight: isSelected ? '600' : '400',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      border: isSelected ? '1px solid #ef4444' : '1px solid rgba(255, 255, 255, 0.12)',
                      backgroundColor: isSelected ? 'rgba(239, 68, 68, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                      color: isSelected ? '#fca5a5' : '#cbd5e1',
                      transition: 'all 0.15s ease',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    {isSelected && <CheckCircle2 size={13} color="#ef4444" />}
                    {tag}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Detailed Reason Input */}
          <div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.5rem', color: '#e2e8f0' }}>
              <MessageSquare size={15} color="#60a5fa" />
              Nội dung phản hồi / Lý do chi tiết: <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <textarea
              required
              rows={3}
              value={customReason}
              onChange={(e) => setCustomReason(e.target.value)}
              placeholder="Nhập lý do từ chối hoặc chỉnh sửa nội dung phản hồi..."
              className="input-field"
              style={{
                width: '100%',
                backgroundColor: 'rgba(15, 23, 42, 0.7)',
                color: '#f8fafc',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                borderRadius: '8px',
                padding: '0.75rem',
                fontSize: '0.875rem',
                lineHeight: '1.4',
                resize: 'vertical'
              }}
            />
          </div>

          {/* In-app Web & Mobile Notification Notice */}
          <div style={{ 
            display: 'flex', 
            alignItems: 'flex-start', 
            gap: '0.75rem', 
            padding: '0.75rem 0.85rem', 
            backgroundColor: 'rgba(59, 130, 246, 0.12)', 
            borderRadius: '10px',
            border: '1px solid rgba(59, 130, 246, 0.3)',
            fontSize: '0.82rem',
            color: '#93c5fd'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#60a5fa', marginTop: '2px', flexShrink: 0 }}>
              <Bell size={16} />
              <Smartphone size={16} />
            </div>
            <div style={{ lineHeight: '1.4' }}>
              <strong style={{ color: '#fff' }}>Thông báo phản hồi tức thì:</strong> Kết quả và lý do từ chối sẽ được gửi trực tiếp đến quả chuông thông báo trên <strong>Web app</strong> và <strong>Mobile App</strong> của người đăng ({uploaderName} {uploaderEmail ? `- ${uploaderEmail}` : ''}).
            </div>
          </div>

          {/* Warning Banner */}
          <div style={{ 
            fontSize: '0.75rem', 
            color: '#94a3b8', 
            backgroundColor: 'rgba(0, 0, 0, 0.2)', 
            padding: '0.5rem 0.75rem', 
            borderRadius: '6px', 
            borderLeft: '3px solid #ef4444' 
          }}>
            ⚠️ <strong>Lưu ý:</strong> Sau khi từ chối, tài liệu này sẽ bị xóa khỏi hệ thống để tránh tải lên lung tung hoặc sai lệch dữ liệu.
          </div>

          {/* Modal Footer Buttons */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
            <button
              type="button"
              className="btn btn-outline"
              onClick={onClose}
              disabled={isSubmitting}
              style={{ padding: '0.5rem 1rem', fontSize: '0.875rem' }}
            >
              Hủy bỏ
            </button>
            <button
              type="submit"
              className="btn"
              disabled={isSubmitting}
              style={{
                backgroundColor: '#ef4444',
                color: 'white',
                border: 'none',
                padding: '0.5rem 1.25rem',
                fontSize: '0.875rem',
                fontWeight: '600',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(239, 68, 68, 0.35)'
              }}
            >
              <Send size={15} />
              {isSubmitting ? 'Đang xử lý...' : 'Từ chối & Gửi thông báo đến App'}
            </button>
          </div>

        </form>
      </div>
    </div>,
    window.document.body
  );
};

export default RejectDocModal;
