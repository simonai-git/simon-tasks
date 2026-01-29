'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { Task } from '@/lib/db';

interface Comment {
  id: string;
  task_id: string;
  author: string;
  content: string;
  created_at: string;
}

interface TaskDetailModalProps {
  task: Task | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: (task: Task) => void;
  onDelete: (id: string) => void;
}

const statusConfig = {
  todo: { label: 'To Do', color: 'bg-slate-500', icon: '📋' },
  in_progress: { label: 'In Progress', color: 'bg-blue-500', icon: '⚡' },
  in_review: { label: 'In Review', color: 'bg-amber-500', icon: '👀' },
  done: { label: 'Done', color: 'bg-emerald-500', icon: '✅' },
};

const priorityConfig = {
  low: { label: 'Low', color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' },
  medium: { label: 'Medium', color: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
  high: { label: 'High', color: 'bg-red-500/20 text-red-400 border-red-500/30' },
};

export default function TaskDetailModal({ task, isOpen, onClose, onUpdate, onDelete }: TaskDetailModalProps) {
  const { data: session } = useSession();
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [loadingComments, setLoadingComments] = useState(false);
  const [submittingComment, setSubmittingComment] = useState(false);

  useEffect(() => {
    if (task && isOpen) {
      fetchComments();
    }
  }, [task, isOpen]);

  const fetchComments = async () => {
    if (!task) return;
    setLoadingComments(true);
    try {
      const res = await fetch(`/api/tasks/${task.id}/comments`);
      const data = await res.json();
      setComments(data);
    } catch (error) {
      console.error('Error fetching comments:', error);
    } finally {
      setLoadingComments(false);
    }
  };

  const handleAddComment = async () => {
    if (!task || !newComment.trim() || !session?.user?.email) return;
    setSubmittingComment(true);
    try {
      const res = await fetch(`/api/tasks/${task.id}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          author: session.user.name || session.user.email,
          content: newComment.trim(),
        }),
      });
      const comment = await res.json();
      setComments(prev => [...prev, comment]);
      setNewComment('');
    } catch (error) {
      console.error('Error adding comment:', error);
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleStatusChange = async (newStatus: Task['status']) => {
    if (!task) return;
    try {
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      const updatedTask = await res.json();
      onUpdate(updatedTask);
    } catch (error) {
      console.error('Error updating status:', error);
    }
  };

  if (!isOpen || !task) return null;

  const status = statusConfig[task.status];
  const priority = priorityConfig[task.priority];

  return (
    <div className="fixed inset-0 modal-backdrop flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div 
        className="bg-[#1e1e2f]/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl shadow-black/50 w-full max-w-2xl max-h-[90vh] overflow-hidden animate-slide-up flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-white/10 flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-semibold text-white truncate">{task.title}</h2>
            <div className="flex items-center gap-3 mt-2">
              <span className={`inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-full border ${priority.color}`}>
                {priority.label}
              </span>
              <span className="text-white/40 text-sm">
                Assigned to {task.assignee}
              </span>
              {task.due_date && (
                <span className="text-white/40 text-sm flex items-center gap-1">
                  📅 {new Date(task.due_date).toLocaleDateString()}
                </span>
              )}
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-white/10 text-white/50 hover:text-white transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content - Scrollable */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Status */}
          <div>
            <label className="block text-sm font-medium text-white/70 mb-3">Status</label>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(statusConfig) as Task['status'][]).map((s) => {
                const config = statusConfig[s];
                const isActive = task.status === s;
                return (
                  <button
                    key={s}
                    onClick={() => handleStatusChange(s)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl border transition-all ${
                      isActive
                        ? `${config.color} border-transparent text-white`
                        : 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10'
                    }`}
                  >
                    <span>{config.icon}</span>
                    <span className="text-sm font-medium">{config.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-white/70 mb-2">Description</label>
            <div className="bg-black/20 rounded-xl p-4 text-white/80 text-sm whitespace-pre-wrap">
              {task.description || 'No description provided.'}
            </div>
          </div>

          {/* Metadata */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="bg-black/20 rounded-xl p-3">
              <span className="text-white/50">Created</span>
              <p className="text-white/80 mt-1">
                {new Date(task.created_at).toLocaleString()}
              </p>
            </div>
            <div className="bg-black/20 rounded-xl p-3">
              <span className="text-white/50">Last Updated</span>
              <p className="text-white/80 mt-1">
                {new Date(task.updated_at).toLocaleString()}
              </p>
            </div>
          </div>

          {/* Comments Section */}
          <div>
            <label className="block text-sm font-medium text-white/70 mb-3">
              Comments ({comments.length})
            </label>
            
            <div className="space-y-3 mb-4 max-h-64 overflow-y-auto">
              {loadingComments ? (
                <div className="text-white/40 text-sm text-center py-4">Loading comments...</div>
              ) : comments.length === 0 ? (
                <div className="text-white/40 text-sm text-center py-4">No comments yet</div>
              ) : (
                comments.map((comment) => (
                  <div key={comment.id} className="bg-black/20 rounded-xl p-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-white/80 text-sm font-medium">{comment.author}</span>
                      <span className="text-white/40 text-xs">
                        {new Date(comment.created_at).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-white/70 text-sm whitespace-pre-wrap">{comment.content}</p>
                  </div>
                ))
              )}
            </div>

            {/* Add Comment */}
            <div className="flex gap-2">
              <textarea
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Add a comment or instruction..."
                rows={2}
                className="flex-1 px-4 py-2.5 bg-black/30 border border-white/10 rounded-xl text-white placeholder-white/40 focus:border-blue-500/50 focus:bg-black/40 focus:ring-2 focus:ring-blue-500/20 resize-none text-sm"
              />
              <button
                onClick={handleAddComment}
                disabled={!newComment.trim() || submittingComment}
                className="px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-xl font-medium hover:shadow-lg hover:shadow-purple-500/25 disabled:opacity-50 disabled:cursor-not-allowed transition-all self-end"
              >
                {submittingComment ? '...' : 'Send'}
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-white/10 flex justify-between">
          <button
            onClick={() => {
              if (confirm('Are you sure you want to delete this task?')) {
                onDelete(task.id);
                onClose();
              }
            }}
            className="px-4 py-2 text-red-400 hover:bg-red-500/20 rounded-xl transition-all text-sm"
          >
            Delete Task
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 text-white/70 hover:text-white hover:bg-white/10 rounded-xl transition-all text-sm"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
