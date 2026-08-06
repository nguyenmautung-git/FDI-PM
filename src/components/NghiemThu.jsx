import React, { useState, useContext, useRef, useEffect } from 'react';
import { DocumentContext } from '../context/DocumentContext';
import { useToast, useConfirm } from '../context/UIContext';
import { storage } from '../firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { withTimeout, getUploadErrorMessage, validateFileSize } from '../utils/uploadHelpers';
import { Plus, Edit2, Trash2, X, Check, Clock, Circle, ChevronDown, ChevronUp, AlertCircle, Save, Paperclip, FileText, Download, Loader, ArrowUp, ArrowDown, ChevronRight } from 'lucide-react';
import { ROLES, STEP_STATUS } from '../constants';
import StepBadge, { STATUS_CONFIG } from './shared/StepBadge';


// Danh sách các bước nghiệm thu mặc định
const DEFAULT_STEPS = [
  'Nghiệm thu vật liệu đầu vào',
  'Nghiệm thu công việc xây dựng',
  'Nghiệm thu giai đoạn thi công',
  'Nghiệm thu hoàn thành hạng mục',
  'Lập hồ sơ thanh toán đợt',
  'Quyết toán hợp đồng',
];



/* ─── Workflow Step Row ─── */
const StepRow = ({ step, index, total, onEdit, onDelete, onMoveUp, onMoveDown, canEditAcceptance }) => {
  const cfg = STATUS_CONFIG[step.status] || STATUS_CONFIG.pending;
  const Icon = cfg.icon;
  const isFirst = index === 0;
  const isLast = index === total - 1;
  const attachments = step.attachments || [];

  return (
    <div style={{ display: 'flex', gap: '0.5rem', position: 'relative' }}>
      {/* Up/Down buttons - chỉ Admin/canEditAcceptance mới thấy */}
      {canEditAcceptance && (
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-start', gap: '2px', flexShrink: 0, paddingTop: '4px' }}>
          <button
            onClick={onMoveUp}
            disabled={isFirst}
            title="Di chuyển lên"
            style={{
              width: '20px', height: '20px', borderRadius: '4px', border: 'none', cursor: isFirst ? 'not-allowed' : 'pointer',
              backgroundColor: isFirst ? 'transparent' : 'var(--color-bg-surface-hover)',
              color: isFirst ? 'var(--color-border)' : 'var(--color-text-muted)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0,
              transition: 'all 0.15s'
            }}
            onMouseEnter={e => { if (!isFirst) { e.currentTarget.style.backgroundColor = 'var(--color-primary)'; e.currentTarget.style.color = 'white'; }}}
            onMouseLeave={e => { e.currentTarget.style.backgroundColor = isFirst ? 'transparent' : 'var(--color-bg-surface-hover)'; e.currentTarget.style.color = isFirst ? 'var(--color-border)' : 'var(--color-text-muted)'; }}
          >
            <ArrowUp size={11} />
          </button>
          <button
            onClick={onMoveDown}
            disabled={isLast}
            title="Di chuyển xuống"
            style={{
              width: '20px', height: '20px', borderRadius: '4px', border: 'none', cursor: isLast ? 'not-allowed' : 'pointer',
              backgroundColor: isLast ? 'transparent' : 'var(--color-bg-surface-hover)',
              color: isLast ? 'var(--color-border)' : 'var(--color-text-muted)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0,
              transition: 'all 0.15s'
            }}
            onMouseEnter={e => { if (!isLast) { e.currentTarget.style.backgroundColor = 'var(--color-primary)'; e.currentTarget.style.color = 'white'; }}}
            onMouseLeave={e => { e.currentTarget.style.backgroundColor = isLast ? 'transparent' : 'var(--color-bg-surface-hover)'; e.currentTarget.style.color = isLast ? 'var(--color-border)' : 'var(--color-text-muted)'; }}
          >
            <ArrowDown size={11} />
          </button>
        </div>
      )}

      {/* Connector line */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0, width: '28px' }}>
        <div style={{ width: '28px', height: '28px', borderRadius: '50%', backgroundColor: cfg.bg, border: `2px solid ${cfg.color}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, zIndex: 1 }}>
          <Icon size={13} color={cfg.color} />
        </div>
        {!isLast && <div style={{ width: '2px', flex: 1, backgroundColor: step.status === 'done' ? 'var(--color-success)' : 'var(--color-border)', minHeight: '20px', marginTop: '2px' }} />}
      </div>

      {/* Content */}
      <div 
        style={{ flex: 1, paddingBottom: isLast ? 0 : '1rem' }}
        onDoubleClick={() => { if (canEditAcceptance) onEdit(step); }}
        title={canEditAcceptance ? "Nhấp đúp để sửa" : ""}
      >
        {/* Row 1: Tên bước — full width */}
        <div style={{ fontWeight: '600', fontSize: '0.875rem', color: 'var(--color-text-main)', marginBottom: '6px' }}>
          {step.name}
        </div>

        {/* Row 2: Ngày hiệu lực | Trạng thái + Sửa/Xóa */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap' }}>
          <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>
            {step.effectiveDate ? `📅 ${step.effectiveDate}` : ''}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
            <StepBadge status={step.status} />
            {canEditAcceptance && (
              <>
                <button className="btn-icon" onClick={() => onEdit(step)} style={{ color: 'var(--color-primary)', padding: '3px' }} title="Sửa"><Edit2 size={13} /></button>
                <button className="btn-icon" onClick={() => onDelete(step.id)} style={{ color: 'var(--color-danger)', padding: '3px' }} title="Xóa"><Trash2 size={13} /></button>
              </>
            )}
          </div>
        </div>

        {/* Row 3: Checklist summary */}
        {step.checklist && step.checklist.length > 0 && (
          <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Check size={11} /> Danh sách kiểm tra: {step.checklist.filter(i => i.isDone).length}/{step.checklist.length}
          </div>
        )}

        {/* Row 4: Attachments */}
        {attachments.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '6px' }}>
            {attachments.map((att, i) => (
              <a key={i} href={att.url} target="_blank" rel="noreferrer"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '2px 8px', borderRadius: '6px', backgroundColor: 'rgba(59, 130, 246, 0.15)', color: '#93c5fd', fontSize: '0.7rem', textDecoration: 'none', border: '1px solid rgba(59, 130, 246, 0.3)' }}>
                <Paperclip size={10} /> {att.name}
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

/* ─── Project Acceptance Card ─── */
const ProjectAcceptanceCard = ({ project, steps, canEditAcceptance, onAddStep, onEditStep, onDeleteStep, onMoveStep }) => {
  const [expanded, setExpanded] = useState(false);
  const done = steps.filter(s => s.status === 'done').length;
  const progress = steps.length > 0 ? Math.round((done / steps.length) * 100) : 0;
  const sorted = [...steps].sort((a, b) => (a.order || 0) - (b.order || 0));

  return (
    <div className="card" style={{ overflow: 'hidden' }}>

      {/* Header image */}
      <div style={{ position: 'relative', height: '140px', overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.05)' }}>
        {project.image
          ? <img src={project.image} alt={project.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg,#0ea5e9,#2dd4bf)', color: 'white', fontSize: '2rem' }}>🏗️</div>
        }
        <div style={{ position: 'absolute', top: '10px', left: '10px', backgroundColor: 'rgba(0,0,0,0.55)', color: 'white', padding: '3px 10px', borderRadius: '20px', fontSize: '0.7rem', fontWeight: '700', backdropFilter: 'blur(4px)' }}>
          {project.code || 'N/A'}
        </div>
        <div style={{ position: 'absolute', top: '10px', right: '10px', backgroundColor: progress === 100 ? '#10b981' : 'rgba(0,0,0,0.55)', color: 'white', padding: '3px 10px', borderRadius: '20px', fontSize: '0.7rem', fontWeight: '700', backdropFilter: 'blur(4px)' }}>
          {progress}% hoàn thành
        </div>
      </div>

      {/* Body */}
      <div style={{ padding: '1rem' }}>
        <h3 style={{ fontWeight: '700', fontSize: '0.95rem', color: 'var(--color-text-main)', marginBottom: '0.5rem', lineHeight: '1.3' }}>{project.name}</h3>
        <div style={{ height: '6px', borderRadius: '3px', backgroundColor: 'var(--color-bg-surface-hover)', marginBottom: '0.75rem', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${progress}%`, borderRadius: '3px', background: progress === 100 ? 'var(--color-success)' : 'linear-gradient(90deg,#0ea5e9,#2dd4bf)', transition: 'width 0.5s ease' }} />
        </div>
        <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', marginBottom: '0.75rem' }}>
          {done}/{steps.length} bước nghiệm thu • {steps.filter(s => s.status === 'inprogress').length} đang thực hiện
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          {canEditAcceptance && (
            <button className="btn btn-outline" onClick={() => onAddStep(project)} style={{ fontSize: '0.78rem', padding: '4px 12px', display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--color-primary)', borderColor: 'var(--color-primary)' }}>
              <Plus size={13} /> Thêm bước
            </button>
          )}
          <button onClick={() => setExpanded(v => !v)} style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', marginLeft: 'auto' }}>
            {expanded ? <><ChevronUp size={14} /> Thu gọn</> : <><ChevronDown size={14} /> Xem workflow</>}
          </button>
        </div>

        {expanded && (
          <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--color-border)' }}>
            {sorted.length === 0
              ? <div style={{ textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '0.8rem', padding: '1rem 0' }}>Chưa có bước nghiệm thu nào. {canEditAcceptance && 'Nhấn "+ Thêm bước" để bắt đầu.'}</div>
              : sorted.map((step, i) => (
                <StepRow
                  key={step.id}
                  step={step}
                  index={i}
                  total={sorted.length}
                  canEditAcceptance={canEditAcceptance}
                  onEdit={onEditStep}
                  onDelete={onDeleteStep}
                  onMoveUp={() => onMoveStep(sorted, i, i - 1)}
                  onMoveDown={() => onMoveStep(sorted, i, i + 1)}
                />
              ))
            }
          </div>
        )}
      </div>
    </div>
  );
};

/* ─── Step Form Modal ─── */
const StepFormModal = ({ project, editingStep, onClose, onSave, savedCount, canUpload }) => {
  const fileInputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [savedMsg, setSavedMsg] = useState(false);

  const blankForm = {
    name: '',
    status: 'pending',
    effectiveDate: '',
    summary: '',
    order: 0,
    attachments: [],
    checklist: [],
  };

  const [form, setForm] = useState(
    editingStep
      ? {
          name: editingStep.name || '',
          status: editingStep.status || 'pending',
          effectiveDate: editingStep.effectiveDate || editingStep.completedDate || '',
          summary: editingStep.summary || editingStep.note || '',
          order: editingStep.order ?? 0,
          attachments: editingStep.attachments || [],
          checklist: editingStep.checklist || [],
        }
      : blankForm
  );

  const [newChecklistItem, setNewChecklistItem] = useState('');
  const [checklistExpanded, setChecklistExpanded] = useState(true);

  const handleAddChecklist = (e) => {
    if (e.key === 'Enter' || e.type === 'blur') {
      e.preventDefault();
      if (!newChecklistItem.trim()) return;
      setForm(f => ({
        ...f,
        checklist: [...(f.checklist || []), { id: Date.now().toString(), text: newChecklistItem.trim(), isDone: false }]
      }));
      setNewChecklistItem('');
    }
  };

  const toggleChecklist = (id) => {
    setForm(f => ({
      ...f,
      checklist: f.checklist.map(item => item.id === id ? { ...item, isDone: !item.isDone } : item)
    }));
  };

  const removeChecklist = (id) => {
    setForm(f => ({
      ...f,
      checklist: f.checklist.filter(item => item.id !== id)
    }));
  };

  const updateChecklistText = (id, newText) => {
    setForm(f => ({
      ...f,
      checklist: f.checklist.map(item => item.id === id ? { ...item, text: newText } : item)
    }));
  };

  const moveChecklistItem = (index, direction) => {
    setForm(f => {
      const newChecklist = [...f.checklist];
      const targetIndex = index + direction;
      if (targetIndex < 0 || targetIndex >= newChecklist.length) return f;
      // swap
      [newChecklist[index], newChecklist[targetIndex]] = [newChecklist[targetIndex], newChecklist[index]];
      return { ...f, checklist: newChecklist };
    });
  };

  // Reset form khi savedCount tăng (chỉ khi đang thêm mới, không phải edit)
  React.useEffect(() => {
    if (!editingStep && savedCount > 0) {
      setForm(blankForm);
      setSavedMsg(true);
      setTimeout(() => setSavedMsg(false), 2000);
    }
  }, [savedCount]);

  const handleFileUpload = async (e) => {
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
      const newAtts = await Promise.all(
        valid.map(async (file) => {
          const storageRef = ref(storage, `acceptanceSteps/${Date.now()}_${file.name}`);
          const snapshot = await withTimeout(uploadBytes(storageRef, file), 20000);
          const url = await getDownloadURL(snapshot.ref);
          return { name: file.name, url };
        })
      );
      setForm(f => ({ ...f, attachments: [...f.attachments, ...newAtts], status: 'done' }));
    } catch (err) {
      console.error('Upload error:', err);
      setUploadError(getUploadErrorMessage(err));
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const removeAttachment = (idx) => {
    setForm(f => ({ ...f, attachments: f.attachments.filter((_, i) => i !== idx) }));
  };

  const handleSaveClick = async () => {
    setIsSaving(true);
    try {
      await onSave(form);
    } catch (error) {
      // Error alerted in parent
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '520px', padding: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', paddingBottom: '1rem', borderBottom: '1px solid var(--color-border)' }}>
          <h3 style={{ fontWeight: '700', fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <AlertCircle size={18} color="var(--color-primary)" />
            {editingStep ? 'Sửa bước nghiệm thu' : 'Thêm bước nghiệm thu mới'}
          </h3>
          <button className="btn-icon" onClick={onClose}><X size={18} /></button>
        </div>

        <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', marginBottom: '1rem', padding: '0.5rem 0.75rem', backgroundColor: 'var(--color-bg-surface-hover)', borderRadius: '8px' }}>
          📁 Dự án: <strong>{project.name}</strong>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Tên bước nghiệm thu <span style={{ color: 'var(--color-danger)' }}>*</span></label>
            <input list="step-suggestions" className="input-field" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="VD: Nghiệm thu vật liệu đầu vào..." />
            <datalist id="step-suggestions">
              {DEFAULT_STEPS.map(s => <option key={s} value={s} />)}
            </datalist>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Trạng thái</label>
              <select className="input-field" value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
                <option value="pending">⚪ Chưa thực hiện</option>
                <option value="inprogress">🟡 Đang thực hiện</option>
                <option value="done">🟢 Hoàn thành</option>
              </select>
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Ngày hiệu lực</label>
              <input type="date" className="input-field" value={form.effectiveDate} onChange={e => setForm({ ...form, effectiveDate: e.target.value })} />
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Trích yếu / Ghi chú</label>
            <textarea rows={3} className="input-field" value={form.summary} onChange={e => setForm({ ...form, summary: e.target.value })} placeholder="Nội dung trích yếu của bước nghiệm thu này..." style={{ resize: 'vertical' }} />
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <div 
              style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', marginBottom: '8px', userSelect: 'none' }}
              onClick={() => setChecklistExpanded(!checklistExpanded)}
            >
              {checklistExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              <span style={{ fontWeight: '600', fontSize: '0.85rem' }}>
                Danh sách kiểm tra {form.checklist?.filter(i => i.isDone).length || 0} / {form.checklist?.length || 0}
              </span>
            </div>
            
            {checklistExpanded && (
              <div style={{ paddingLeft: '24px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {(form.checklist || []).map((item, idx) => (
                  <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input 
                      type="checkbox" 
                      checked={item.isDone} 
                      onChange={() => toggleChecklist(item.id)}
                      style={{ cursor: 'pointer', width: '16px', height: '16px', flexShrink: 0 }}
                    />
                    <input 
                      type="text"
                      value={item.text}
                      onChange={(e) => updateChecklistText(item.id, e.target.value)}
                      style={{ 
                        flex: 1, 
                        fontSize: '0.85rem', 
                        textDecoration: item.isDone ? 'line-through' : 'none', 
                        color: item.isDone ? 'var(--color-text-muted)' : 'var(--color-text-main)',
                        border: 'none',
                        background: 'transparent',
                        outline: 'none',
                        padding: '2px 0',
                        borderBottom: '1px solid transparent',
                        transition: 'border-bottom 0.2s'
                      }}
                      onFocus={e => e.target.style.borderBottom = '1px solid var(--color-primary)'}
                      onBlur={e => e.target.style.borderBottom = '1px solid transparent'}
                    />
                    <div style={{ display: 'flex', alignItems: 'center', gap: '2px', flexShrink: 0 }}>
                      <button type="button" onClick={() => moveChecklistItem(idx, -1)} disabled={idx === 0} style={{ background: 'none', border: 'none', cursor: idx === 0 ? 'not-allowed' : 'pointer', color: idx === 0 ? 'transparent' : 'var(--color-text-muted)', padding: 0 }} title="Di chuyển lên">
                        <ChevronUp size={15} />
                      </button>
                      <button type="button" onClick={() => moveChecklistItem(idx, 1)} disabled={idx === (form.checklist || []).length - 1} style={{ background: 'none', border: 'none', cursor: idx === (form.checklist || []).length - 1 ? 'not-allowed' : 'pointer', color: idx === (form.checklist || []).length - 1 ? 'transparent' : 'var(--color-text-muted)', padding: 0 }} title="Di chuyển xuống">
                        <ChevronDown size={15} />
                      </button>
                      <button type="button" onClick={() => removeChecklist(item.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-danger)', padding: '0 0 0 4px', marginLeft: '2px' }} title="Xóa">
                        <X size={15} />
                      </button>
                    </div>
                  </div>
                ))}
                
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                  <Circle size={16} color="var(--color-text-muted)" />
                  <input 
                    type="text" 
                    placeholder="Thêm mục..." 
                    className="input-field" 
                    style={{ flex: 1, padding: '4px 8px', fontSize: '0.85rem', marginBottom: 0, border: '1px solid var(--color-primary)' }}
                    value={newChecklistItem}
                    onChange={e => setNewChecklistItem(e.target.value)}
                    onKeyDown={handleAddChecklist}
                    onBlur={handleAddChecklist}
                  />
                </div>
              </div>
            )}
          </div>

          {savedMsg && (
            <div style={{ padding: '0.5rem 0.75rem', backgroundColor: 'rgba(16, 185, 129, 0.15)', borderRadius: '8px', fontSize: '0.78rem', color: '#34d399', display: 'flex', alignItems: 'center', gap: '6px' }}>
              ✅ Đã lưu! Nhập tiếp bước nghiệm thu mới...
            </div>
          )}
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Tệp đính kèm (Biên bản nghiệm thu)</label>
            <div style={{ border: '1px dashed var(--color-border)', borderRadius: '8px', padding: '0.75rem', backgroundColor: 'var(--color-bg-surface)' }}>
              <input ref={fileInputRef} type="file" multiple style={{ display: 'none' }} onChange={handleFileUpload} />
              <button type="button" className="btn btn-outline" onClick={() => fileInputRef.current?.click()} disabled={uploading || !canUpload}
                style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '6px', width: '100%', justifyContent: 'center', opacity: canUpload ? 1 : 0.6, cursor: canUpload ? 'pointer' : 'not-allowed' }}>
                {uploading ? <><Loader size={14} style={{ animation: 'spin 1s linear infinite' }} /> Đang tải lên...</> : <><Paperclip size={14} /> Chọn tệp đính kèm</>}
              </button>
              {uploadError && (
                <div style={{ marginTop: '0.5rem', padding: '6px 10px', backgroundColor: 'rgba(239, 68, 68, 0.15)', borderRadius: '6px', fontSize: '0.75rem', color: '#f87171' }}>
                  ⚠️ {uploadError}
                </div>
              )}
              {form.attachments.length > 0 && (
                <div style={{ marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {form.attachments.map((att, idx) => (
                    <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 8px', backgroundColor: 'rgba(59, 130, 246, 0.15)', borderRadius: '6px', fontSize: '0.78rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#93c5fd', overflow: 'hidden' }}>
                        <FileText size={12} />
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{att.name}</span>
                      </div>
                      <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                        <a href={att.url} target="_blank" rel="noreferrer" style={{ color: '#93c5fd' }} title="Tải xuống"><Download size={12} /></a>
                        <button type="button" onClick={() => removeAttachment(idx)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-danger)', padding: 0 }} title="Xóa"><X size={12} /></button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid var(--color-border)' }}>
          <button className="btn btn-outline" onClick={onClose} disabled={isSaving}>Hủy</button>
          <button className="btn btn-primary" onClick={handleSaveClick} style={{ display: 'flex', alignItems: 'center', gap: '6px' }} disabled={!form.name.trim() || uploading || isSaving}>
            {isSaving ? <Loader size={15} style={{ animation: 'spin 1s linear infinite' }} /> : <Save size={15} />}
            {editingStep ? 'Cập nhật' : 'Lưu bước'}
          </button>
        </div>
      </div>
    </div>
  );
};

/* ─── Main Page ─── */
const NghiemThu = () => {
  const { projects, acceptanceSteps, addAcceptanceStep, updateAcceptanceStep, deleteAcceptanceStep, userRole, enableLazy, checkPermission } = useContext(DocumentContext);
  const toast = useToast();
  const confirm = useConfirm();
  useEffect(() => { enableLazy(); }, [enableLazy]);
  const isAdmin = userRole === ROLES.ADMIN;
  const [addingToProject, setAddingToProject] = useState(null);
  const [editingStep, setEditingStep] = useState(null);
  const [editingProject, setEditingProject] = useState(null);

  const [savedCount, setSavedCount] = useState(0);

  const handleSave = async (form) => {
    try {
      if (editingStep) {
        await updateAcceptanceStep(editingStep.id, form);
        setEditingStep(null);
        setEditingProject(null);
      } else {
        const projectSteps = acceptanceSteps.filter(s => s.projectId === addingToProject.id || s.projectId === addingToProject.id?.toString());
        const maxOrder = projectSteps.reduce((max, s) => Math.max(max, s.order ?? 0), -1);
        await addAcceptanceStep(addingToProject.id, { ...form, order: maxOrder + 1 });
        setSavedCount(c => c + 1); // reset form, giữ modal mở
      }
    } catch (err) {
      console.error('Lỗi khi lưu:', err);
      toast.error('Lỗi khi lưu: ' + err.message);
      throw err;
    }
  };

  const handleEdit = (project, step) => {
    setEditingProject(project);
    setEditingStep(step);
  };

  const handleDelete = async (id) => {
    const ok = await confirm('Bạn có chắc muốn xóa bước nghiệm thu này?');
    if (ok) await deleteAcceptanceStep(id);
  };

  // Di chuyển vị trí và cập nhật lại order cho tất cả các item nếu cần để sửa lỗi trùng order
  const handleMoveStep = async (sortedSteps, fromIdx, toIdx) => {
    if (toIdx < 0 || toIdx >= sortedSteps.length) return;
    const newSteps = [...sortedSteps];
    const [moved] = newSteps.splice(fromIdx, 1);
    newSteps.splice(toIdx, 0, moved);

    const promises = [];
    newSteps.forEach((step, index) => {
      if (step.order !== index) {
        promises.push(updateAcceptanceStep(step.id, { ...step, order: index }));
      }
    });
    await Promise.all(promises);
  };

  return (
    <div className="fade-in" style={{ padding: '1.5rem' }}>
      {/* Header */}
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: '700', color: 'var(--color-text-main)', marginBottom: '0.25rem' }}>✅ Nghiệm thu - Thanh quyết toán</h1>
        <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
          Quản lý hồ sơ nghiệm thu hạng mục, thanh toán theo tiến độ và quyết toán hợp đồng của {projects.length} dự án.
        </p>
      </div>

      {/* Cards grid */}
      {projects.length === 0
        ? <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--color-text-muted)' }}>Chưa có dự án nào. Vui lòng tạo dự án ở trang "Dự án".</div>
        : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '1.5rem', alignItems: 'start' }}>
            {projects.map(project => {
              const steps = acceptanceSteps.filter(s => s.projectId === project.id || s.projectId === project.id?.toString());
              return (
                <ProjectAcceptanceCard
                  key={project.id}
                  project={project}
                  steps={steps}
                  isAdmin={isAdmin}
                  onAddStep={(p) => setAddingToProject(p)}
                  onEditStep={(step) => handleEdit(project, step)}
                  onDeleteStep={handleDelete}
                  onMoveStep={handleMoveStep}
                />
              );
            })}
          </div>
        )
      }

      {/* Modal */}
      {(addingToProject || editingStep) && (
        <StepFormModal
          project={editingProject || addingToProject}
          editingStep={editingStep}
          onClose={() => { setAddingToProject(null); setEditingStep(null); setEditingProject(null); setSavedCount(0); }}
          onSave={handleSave}
          savedCount={savedCount}
        />
      )}
    </div>
  );
};

export default NghiemThu;
