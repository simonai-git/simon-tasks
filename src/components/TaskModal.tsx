'use client';

import { useState, useEffect } from 'react';
import { Task } from '@/lib/db';

interface TaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (task: Partial<Task>) => void;
  task?: Task | null;
}

export default function TaskModal({ isOpen, onClose, onSave, task }: TaskModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [assignee, setAssignee] = useState<'Bogdan' | 'Simon'>('Simon');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [dueDate, setDueDate] = useState('');

  useEffect(() => {
    if (task) {
      setTitle(task.title);
      setDescription(task.description || '');
      setAssignee(task.assignee);
      setPriority(task.priority);
      setDueDate(task.due_date || '');
    } else {
      setTitle('');
      setDescription('');
      setAssignee('Simon');
      setPriority('medium');
      setDueDate('');
    }
  }, [task, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      ...(task?.id && { id: task.id }),
      title,
      description: description || null,
      assignee,
      priority,
      due_date: dueDate || null,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 modal-backdrop flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div 
        className="bg-[#1e1e2f]/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl shadow-black/50 w-full max-w-md animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-white">
            {task ? '✏️ Edit Task' : '✨ New Task'}
          </h2>
          <button 
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-white/10 text-white/50 hover:text-white transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-white/70 mb-2">
              Title <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              className="w-full px-4 py-2.5 bg-black/30 border border-white/10 rounded-xl text-white placeholder-white/40 focus:border-blue-500/50 focus:bg-black/40 focus:ring-2 focus:ring-blue-500/20"
              placeholder="What needs to be done?"
            />
          </div>
          
          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-white/70 mb-2">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full px-4 py-2.5 bg-black/30 border border-white/10 rounded-xl text-white placeholder-white/40 focus:border-blue-500/50 focus:bg-black/40 focus:ring-2 focus:ring-blue-500/20 resize-none"
              placeholder="Add more details..."
            />
          </div>
          
          {/* Assignee & Priority */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-white/70 mb-2">
                Assignee
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setAssignee('Simon')}
                  className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border transition-all ${
                    assignee === 'Simon' 
                      ? 'bg-purple-500/20 border-purple-500/50 text-purple-300' 
                      : 'bg-white/5 border-white/10 text-white/50 hover:bg-white/10'
                  }`}
                >
                  <span>🦊</span>
                  <span className="text-sm font-medium">Simon</span>
                </button>
                <button
                  type="button"
                  onClick={() => setAssignee('Bogdan')}
                  className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border transition-all ${
                    assignee === 'Bogdan' 
                      ? 'bg-blue-500/20 border-blue-500/50 text-blue-300' 
                      : 'bg-white/5 border-white/10 text-white/50 hover:bg-white/10'
                  }`}
                >
                  <span>👤</span>
                  <span className="text-sm font-medium">Bogdan</span>
                </button>
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-white/70 mb-2">
                Priority
              </label>
              <div className="flex gap-1">
                {(['low', 'medium', 'high'] as const).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPriority(p)}
                    className={`flex-1 px-2 py-2.5 rounded-xl border text-sm font-medium transition-all ${
                      priority === p
                        ? p === 'low' 
                          ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300'
                          : p === 'medium'
                          ? 'bg-amber-500/20 border-amber-500/50 text-amber-300'
                          : 'bg-red-500/20 border-red-500/50 text-red-300'
                        : 'bg-white/5 border-white/10 text-white/50 hover:bg-white/10'
                    }`}
                  >
                    {p === 'low' ? '🟢' : p === 'medium' ? '🟡' : '🔴'}
                  </button>
                ))}
              </div>
            </div>
          </div>
          
          {/* Due Date */}
          <div>
            <label className="block text-sm font-medium text-white/70 mb-2">
              Due Date
            </label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full px-4 py-2.5 bg-black/30 border border-white/10 rounded-xl text-white focus:border-blue-500/50 focus:bg-black/40 focus:ring-2 focus:ring-blue-500/20 [color-scheme:dark]"
            />
          </div>
          
          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 text-white/70 hover:text-white hover:bg-white/10 rounded-xl transition-all font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2.5 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-xl font-medium hover:shadow-lg hover:shadow-purple-500/25 hover:scale-[1.02] active:scale-[0.98] transition-all"
            >
              {task ? 'Save Changes' : 'Create Task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
