import React, { useState } from 'react';
import { ROLES } from '../constants';
import { Gantt, ViewMode } from 'gantt-task-react';
import "gantt-task-react/dist/index.css";
import { useToast, useConfirm } from '../context/UIContext';
import { Plus, Trash2, Edit } from 'lucide-react';

const ProjectGantt = ({ projectId, tasks = [], onTasksChange, isPreviewMode, userRole }) => {
  const [view, setView] = useState(ViewMode.Day);
  const [isTaskFormOpen, setIsTaskFormOpen] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const toast = useToast();
  const confirm = useConfirm();

  // Form state
  const [taskName, setTaskName] = useState('');
  const [taskStart, setTaskStart] = useState('');
  const [taskEnd, setTaskEnd] = useState('');
  const [taskProgress, setTaskProgress] = useState(0);

  let ganttTasks = tasks.map(t => ({
    ...t,
    start: new Date(t.start),
    end: new Date(t.end),
    type: 'task',
    progress: t.progress || 0,
    project: projectId,
    styles: { progressColor: 'var(--color-primary)', progressSelectedColor: 'var(--color-primary-dark)' }
  }));

  // Nếu không có task nào, hiển thị một task mặc định để không bị lỗi biểu đồ
  if (ganttTasks.length === 0) {
    ganttTasks = [{
      start: new Date(),
      end: new Date(new Date().getTime() + 7 * 24 * 60 * 60 * 1000),
      name: 'Chưa có công việc nào',
      id: 'default_task',
      type: 'task',
      progress: 0,
      isDisabled: true,
      styles: { progressColor: '#ccc', progressSelectedColor: '#ccc' }
    }];
  }

  const handleTaskChange = (task) => {
    if (isPreviewMode || userRole !== ROLES.ADMIN) return;
    
    const updatedTasks = tasks.map(t => (t.id === task.id ? { ...t, start: task.start.toISOString(), end: task.end.toISOString(), progress: task.progress } : t));
    onTasksChange(updatedTasks);
  };

  const handleTaskDelete = async (task) => {
    if (isPreviewMode || userRole !== ROLES.ADMIN) return;
    const ok = await confirm('Bạn có chắc muốn xoá công việc này?');
    if (ok) onTasksChange(tasks.filter(t => t.id !== task.id));
  };

  const handleTaskProgressChange = (task) => {
    if (isPreviewMode || userRole !== ROLES.ADMIN) return;
    const updatedTasks = tasks.map(t => (t.id === task.id ? { ...t, progress: task.progress } : t));
    onTasksChange(updatedTasks);
  };

  const handleDoubleClick = (task) => {
    if (isPreviewMode || userRole !== ROLES.ADMIN || task.id === 'default_task') return;
    setEditingTask(task);
    setTaskName(task.name);
    setTaskStart(task.start.toISOString().split('T')[0]);
    setTaskEnd(task.end.toISOString().split('T')[0]);
    setTaskProgress(task.progress);
    setIsTaskFormOpen(true);
  };

  const handleSaveTask = (e) => {
    e.preventDefault();
    if (!taskName || !taskStart || !taskEnd) return;

    if (new Date(taskStart) > new Date(taskEnd)) {
      toast.warning('Ngày bắt đầu không thể sau ngày kết thúc.');
      return;
    }

    if (editingTask) {
      const updatedTasks = tasks.map(t => t.id === editingTask.id ? {
        ...t,
        name: taskName,
        start: new Date(taskStart).toISOString(),
        end: new Date(taskEnd).toISOString(),
        progress: parseInt(taskProgress, 10)
      } : t);
      onTasksChange(updatedTasks);
    } else {
      const newTask = {
        id: `Task_${new Date().getTime()}`,
        name: taskName,
        start: new Date(taskStart).toISOString(),
        end: new Date(taskEnd).toISOString(),
        progress: parseInt(taskProgress, 10),
        dependencies: []
      };
      onTasksChange([...tasks, newTask]);
    }
    
    setIsTaskFormOpen(false);
    setEditingTask(null);
    setTaskName('');
    setTaskStart('');
    setTaskEnd('');
    setTaskProgress(0);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button type="button" className={`btn ${view === ViewMode.Day ? 'btn-primary' : 'btn-outline'}`} onClick={() => setView(ViewMode.Day)} style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}>Ngày</button>
          <button type="button" className={`btn ${view === ViewMode.Week ? 'btn-primary' : 'btn-outline'}`} onClick={() => setView(ViewMode.Week)} style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}>Tuần</button>
          <button type="button" className={`btn ${view === ViewMode.Month ? 'btn-primary' : 'btn-outline'}`} onClick={() => setView(ViewMode.Month)} style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}>Tháng</button>
        </div>
        {!isPreviewMode && userRole === ROLES.ADMIN && (
          <button type="button" className="btn btn-primary" onClick={() => { setEditingTask(null); setIsTaskFormOpen(true); }} style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Plus size={14} /> Thêm công việc
          </button>
        )}
      </div>

      <div style={{ overflowX: 'auto', backgroundColor: '#fff', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}>
        <Gantt
          tasks={ganttTasks}
          viewMode={view}
          onDateChange={handleTaskChange}
          onDelete={handleTaskDelete}
          onProgressChange={handleTaskProgressChange}
          onDoubleClick={handleDoubleClick}
          listCellWidth={isPreviewMode ? "" : "155px"}
          columnWidth={view === ViewMode.Month ? 150 : view === ViewMode.Week ? 150 : 60}
        />
      </div>

      {isTaskFormOpen && (
        <div className="modal-overlay" onClick={() => setIsTaskFormOpen(false)} style={{ zIndex: 1000, position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ width: '400px', backgroundColor: '#fff', padding: '1.5rem', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-lg)' }}>
            <h3 style={{ marginBottom: '1rem', fontSize: '1.25rem', fontWeight: '600' }}>{editingTask ? 'Sửa công việc' : 'Thêm công việc mới'}</h3>
            <form onSubmit={handleSaveTask}>
              <div className="form-group">
                <label className="form-label">Tên công việc</label>
                <input required type="text" className="input-field" value={taskName} onChange={e => setTaskName(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Ngày bắt đầu</label>
                <input required type="date" className="input-field" value={taskStart} onChange={e => setTaskStart(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Ngày kết thúc</label>
                <input required type="date" className="input-field" value={taskEnd} onChange={e => setTaskEnd(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Tiến độ (%)</label>
                <input type="number" min="0" max="100" className="input-field" value={taskProgress} onChange={e => setTaskProgress(e.target.value)} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1.5rem' }}>
                <button type="button" className="btn btn-outline" onClick={() => setIsTaskFormOpen(false)}>Hủy</button>
                <button type="submit" className="btn btn-primary">Lưu</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProjectGantt;
