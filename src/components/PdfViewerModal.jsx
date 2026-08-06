import React, { useState, useEffect, useRef } from 'react';
import { X, Download, ExternalLink, FileText, AlertCircle } from 'lucide-react';
import { ref as storageRef, getDownloadURL, getBlob } from 'firebase/storage';
import { storage } from '../firebase';

/**
 * PdfViewerModal — Xem file đính kèm inline trong modal.
 *
 * Cách hoạt động:
 *   1. Lấy signed download URL từ Firebase Storage SDK
 *   2. Fetch file qua ReadableStream để theo dõi tiến trình %
 *   3. Tạo blob URL local (URL.createObjectURL) — Edge không chặn blob: URL
 *   4. Nhúng vào <iframe>; revoke URL khi đóng để giải phóng RAM
 *
 * Props:
 *   file    : { name: string, url: string }
 *   onClose : () => void
 */
const FETCH_TIMEOUT_MS = 60_000; // 60 giây timeout

const PdfViewerModal = ({ file, onClose }) => {
  const [blobUrl,  setBlobUrl]  = useState(null);
  const [progress, setProgress] = useState(0);     // 0-100
  const [status,   setStatus]   = useState('loading'); // 'loading' | 'done' | 'error'
  const [errMsg,   setErrMsg]   = useState('');
  const [fileSize, setFileSize] = useState('');    // '1.2 MB'

  const blobUrlRef    = useRef(null);
  const abortCtrlRef  = useRef(null);

  const isImage = /\.(png|jpe?g|gif|webp|svg|bmp)(\?|$)/i.test(file?.url || '');
  const isPdf   = file?.name?.toLowerCase().endsWith('.pdf');

  // ── Format bytes ────────────────────────────────────────────────────────
  const fmtBytes = (n) => {
    if (!n) return '';
    if (n < 1024)       return `${n} B`;
    if (n < 1048576)    return `${(n / 1024).toFixed(1)} KB`;
    return `${(n / 1048576).toFixed(1)} MB`;
  };

  // ── Fetch với progress tracking ─────────────────────────────────────────
  useEffect(() => {
    if (!file) return;

    let cancelled = false;
    setBlobUrl(null);
    setProgress(0);
    setStatus('loading');
    setErrMsg('');
    setFileSize('');

    // Revoke blob URL cũ nếu có
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }

    const ctrl = new AbortController();
    abortCtrlRef.current = ctrl;
    const timeoutId = setTimeout(() => ctrl.abort('timeout'), FETCH_TIMEOUT_MS);

    // Simulate progress (getBlob không hỗ trợ streaming)
    let progInterval = null;
    const startProgressSim = () => {
      let p = 5;
      progInterval = setInterval(() => {
        p = Math.min(90, p + Math.random() * 8);
        setProgress(Math.round(p));
      }, 400);
    };
    const stopProgressSim = () => {
      if (progInterval) clearInterval(progInterval);
    };

    (async () => {
      try {
        // Kiểm tra xem URL có phải Firebase Storage không
        const match = file.url.match(/\/o\/(.+?)(\?|$)/);

        let blob;
        if (match) {
          // ── Firebase Storage URL: dùng SDK getBlob() — bypass CORS hoàn toàn
          const path    = decodeURIComponent(match[1]);
          const fileRef = storageRef(storage, path);
          startProgressSim();
          blob = await getBlob(fileRef);
          stopProgressSim();
        } else {
          // ── URL khác: fetch bình thường với ReadableStream
          const res = await fetch(file.url, { signal: ctrl.signal });
          if (!res.ok) throw new Error(`Máy chủ trả về lỗi ${res.status}`);

          const totalBytes = parseInt(res.headers.get('Content-Length') || '0', 10);
          if (totalBytes) setFileSize(fmtBytes(totalBytes));

          const reader = res.body.getReader();
          const chunks = [];
          let received = 0;
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            if (cancelled) return;
            chunks.push(value);
            received += value.length;
            if (totalBytes > 0) {
              setProgress(Math.min(99, Math.round((received / totalBytes) * 100)));
            } else {
              setProgress(prev => Math.min(95, prev + 2));
            }
          }
          if (cancelled) return;
          const mimeType = isPdf ? 'application/pdf' : (res.headers.get('Content-Type') || 'application/octet-stream');
          blob = new Blob(chunks, { type: mimeType });
        }

        if (cancelled) return;

        // Đảm bảo mime type đúng cho PDF
        const finalMime = isPdf ? 'application/pdf'
          : (blob.type && blob.type !== 'application/octet-stream' ? blob.type : 'application/octet-stream');
        const typedBlob = (blob.type === finalMime) ? blob : new Blob([blob], { type: finalMime });

        setFileSize(fmtBytes(typedBlob.size));
        const url = URL.createObjectURL(typedBlob);
        blobUrlRef.current = url;
        setProgress(100);
        setBlobUrl(url);
        setStatus('done');

      } catch (err) {
        if (cancelled) return;
        stopProgressSim();
        const isTimeout = err.name === 'AbortError' || String(err.message).includes('timeout');
        setErrMsg(isTimeout
          ? 'Tải tệp quá thời gian cho phép (60 giây). Vui lòng thử lại hoặc tải xuống trực tiếp.'
          : `Lỗi tải tệp: ${err.message}`
        );
        setStatus('error');
      } finally {
        stopProgressSim();
        clearTimeout(timeoutId);
      }
    })();

    return () => {
      cancelled = true;
      ctrl.abort('unmount');
      clearTimeout(timeoutId);
      stopProgressSim();
    };
  }, [file]);

  // Dọn dẹp blob URL khi unmount
  useEffect(() => {
    return () => {
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
    };
  }, []);

  if (!file) return null;

  const handleDownload = () => {
    const a   = document.createElement('a');
    a.href     = blobUrlRef.current || file.url;
    a.download = file.name || 'file';
    a.click();
  };

  return (
    <div
      className="modal-overlay"
      onClick={onClose}
      style={{ zIndex: 400, alignItems: 'flex-start', paddingTop: '1.5rem' }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: '960px', height: '90vh',
          background: 'var(--color-bg-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: '20px',
          display: 'flex', flexDirection: 'column',
          boxShadow: '0 32px 80px rgba(0,0,0,0.6)',
          overflow: 'hidden',
        }}
      >
        {/* ── Header ── */}
        <div style={{
          padding: '1rem 1.5rem',
          borderBottom: '1px solid var(--color-border)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          flexShrink: 0,
          background: 'var(--color-bg-surface-hover)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', minWidth: 0 }}>
            <FileText size={18} style={{ color: 'var(--color-primary)', flexShrink: 0 }} />
            <div style={{ minWidth: 0 }}>
              <span style={{
                fontSize: '0.93rem', fontWeight: '600',
                color: 'var(--color-text-main)',
                display: 'block',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                maxWidth: '480px',
              }}>
                {file.name}
              </span>
              {fileSize && (
                <span style={{ fontSize: '0.73rem', color: 'var(--color-text-muted)' }}>
                  {fileSize}
                </span>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexShrink: 0 }}>
            <a href={file.url} target="_blank" rel="noreferrer"
              style={{
                display: 'flex', alignItems: 'center', gap: '0.35rem',
                padding: '0.4rem 0.85rem',
                background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.3)',
                borderRadius: '8px', color: '#60a5fa',
                fontSize: '0.8rem', fontWeight: '600', textDecoration: 'none',
              }}
            >
              <ExternalLink size={14} /> Mở mới
            </a>
            <button onClick={handleDownload}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.35rem',
                padding: '0.4rem 0.85rem',
                background: 'linear-gradient(135deg,#3b82f6,#8b5cf6)',
                border: 'none', borderRadius: '8px', color: 'white',
                fontSize: '0.8rem', fontWeight: '600', cursor: 'pointer',
              }}
            >
              <Download size={14} /> Tải xuống
            </button>
            <button onClick={onClose}
              style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer', padding: '0.25rem' }}
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* ── Progress bar (hiển thị khi đang tải) ── */}
        {status === 'loading' && (
          <div style={{ height: '3px', background: 'var(--color-border)', flexShrink: 0 }}>
            <div style={{
              height: '100%',
              width: `${progress}%`,
              background: 'linear-gradient(90deg, #3b82f6, #8b5cf6)',
              transition: 'width 0.3s ease',
              borderRadius: '0 3px 3px 0',
            }} />
          </div>
        )}

        {/* ── Body ── */}
        <div style={{ flex: 1, position: 'relative', overflow: 'hidden', background: '#0f1729' }}>

          {/* Loading state */}
          {status === 'loading' && (
            <div style={{
              position: 'absolute', inset: 0, zIndex: 2,
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              gap: '1.5rem',
            }}>
              {/* Circular progress */}
              <div style={{ position: 'relative', width: '80px', height: '80px' }}>
                <svg width="80" height="80" style={{ transform: 'rotate(-90deg)' }}>
                  <circle cx="40" cy="40" r="34" fill="none" stroke="rgba(59,130,246,0.15)" strokeWidth="6" />
                  <circle
                    cx="40" cy="40" r="34" fill="none"
                    stroke="url(#prog-grad)" strokeWidth="6"
                    strokeLinecap="round"
                    strokeDasharray={`${2 * Math.PI * 34}`}
                    strokeDashoffset={`${2 * Math.PI * 34 * (1 - progress / 100)}`}
                    style={{ transition: 'stroke-dashoffset 0.3s ease' }}
                  />
                  <defs>
                    <linearGradient id="prog-grad" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%"   stopColor="#3b82f6" />
                      <stop offset="100%" stopColor="#8b5cf6" />
                    </linearGradient>
                  </defs>
                </svg>
                <span style={{
                  position: 'absolute', inset: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '1rem', fontWeight: '700', color: 'var(--color-primary)',
                }}>
                  {progress}%
                </span>
              </div>

              <div style={{ textAlign: 'center' }}>
                <p style={{ color: 'var(--color-text-main)', fontWeight: '600', marginBottom: '0.35rem' }}>
                  Đang tải tệp...
                </p>
                <p style={{ color: 'var(--color-text-muted)', fontSize: '0.82rem' }}>
                  {fileSize ? `${fileSize} •` : ''} Vui lòng chờ trong giây lát
                </p>
              </div>
            </div>
          )}

          {/* Error state */}
          {status === 'error' && (
            <div style={{
              position: 'absolute', inset: 0,
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              gap: '1.25rem', padding: '2rem', textAlign: 'center',
            }}>
              <div style={{
                width: '72px', height: '72px', borderRadius: '50%',
                background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <AlertCircle size={32} style={{ color: '#ef4444' }} />
              </div>
              <div>
                <p style={{ color: 'var(--color-text-main)', fontWeight: '600', marginBottom: '0.5rem' }}>
                  Không thể tải tệp
                </p>
                <p style={{ color: 'var(--color-text-muted)', fontSize: '0.82rem', maxWidth: '400px', lineHeight: '1.6' }}>
                  {errMsg}
                </p>
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', justifyContent: 'center' }}>
                <a href={file.url} target="_blank" rel="noreferrer"
                  style={{
                    display: 'flex', alignItems: 'center', gap: '0.4rem',
                    padding: '0.55rem 1.25rem',
                    background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.4)',
                    borderRadius: '10px', color: '#60a5fa',
                    fontSize: '0.875rem', fontWeight: '600', textDecoration: 'none',
                  }}>
                  <ExternalLink size={15} /> Mở trong tab mới
                </a>
                <button onClick={handleDownload}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '0.4rem',
                    padding: '0.55rem 1.25rem',
                    background: 'linear-gradient(135deg,#3b82f6,#8b5cf6)',
                    border: 'none', borderRadius: '10px', color: 'white',
                    fontSize: '0.875rem', fontWeight: '600', cursor: 'pointer',
                  }}>
                  <Download size={15} /> Tải xuống
                </button>
              </div>
            </div>
          )}

          {/* ── Hiển thị ảnh ── */}
          {status === 'done' && blobUrl && isImage && (
            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}>
              <img
                src={blobUrl}
                alt={file.name}
                style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', borderRadius: '8px' }}
              />
            </div>
          )}

          {/* ── Hiển thị PDF / file khác ── */}
          {status === 'done' && blobUrl && !isImage && (
            <iframe
              src={blobUrl}
              title={file.name}
              style={{ width: '100%', height: '100%', border: 'none' }}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default PdfViewerModal;
