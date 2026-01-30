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

interface Activity {
  id: string;
  task_id: string;
  action: string;
  field_changed: string | null;
  old_value: string | null;
  new_value: string | null;
  actor: string;
  created_at: string;
}

interface TaskDetailModalProps {
  task: Task | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: (task: Task) => void;
  onDelete: (id: string) => void;
  isActive?: boolean;
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

// Compare due date (YYYY-MM-DD string) against today in local time
function isDateOverdue(dueDateStr: string): boolean {
  // Parse the due date as local midnight (not UTC)
  const [year, month, day] = dueDateStr.split('-').map(Number);
  const dueDate = new Date(year, month - 1, day); // month is 0-indexed
  
  // Get today's date at local midnight
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  // Due date is overdue if it's before today
  return dueDate < today;
}

// Get today's date as YYYY-MM-DD in local time
function getTodayString(): string {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export default function TaskDetailModal({ task, isOpen, onClose, onUpdate, onDelete, isActive = false }: TaskDetailModalProps) {
  const { data: session } = useSession();
  const [comments, setComments] = useState<Comment[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [newComment, setNewComment] = useState('');
  const [loadingComments, setLoadingComments] = useState(false);
  const [submittingComment, setSubmittingComment] = useState(false);
  const [activeTab, setActiveTab] = useState<'details' | 'activity' | 'agent_context'>('details');
  // Defer overdue check to client-side only to avoid hydration mismatch
  // (server runs in UTC, client runs in user's local time)
  const [isOverdue, setIsOverdue] = useState(false);
  
  useEffect(() => {
    if (task?.due_date && task.status !== 'done') {
      setIsOverdue(isDateOverdue(task.due_date));
    } else {
      setIsOverdue(false);
    }
  }, [task?.due_date, task?.status]);

  useEffect(() => {
    if (task && isOpen) {
      fetchComments();
      fetchActivity();
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

  const fetchActivity = async () => {
    if (!task) return;
    try {
      const res = await fetch(`/api/tasks/${task.id}/activity`);
      const data = await res.json();
      setActivities(data);
    } catch (error) {
      console.error('Error fetching activity:', error);
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

  const handleFieldUpdate = async (field: string, value: any) => {
    if (!task) return;
    try {
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: value }),
      });
      const updatedTask = await res.json();
      onUpdate(updatedTask);
      fetchActivity(); // Refresh activity log
    } catch (error) {
      console.error(`Error updating ${field}:`, error);
    }
  };

  if (!isOpen || !task) return null;

  const status = statusConfig[task.status];
  const priority = priorityConfig[task.priority];

  return (
    <div className="fixed inset-0 modal-backdrop flex items-end sm:items-center justify-center z-50 p-0 sm:p-4" onClick={onClose}>
      <div 
        className="bg-[#1e1e2f]/95 backdrop-blur-xl border border-white/10 rounded-t-2xl sm:rounded-2xl shadow-2xl shadow-black/50 w-full sm:max-w-2xl max-h-[95vh] sm:max-h-[90vh] overflow-hidden animate-slide-up flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-white/10 flex items-start justify-between gap-3 sm:gap-4">
          <div className="flex-1 min-w-0">
            <div className="text-[10px] text-white/40 font-mono mb-1">Task #{task.id.slice(0, 8)}</div>
            <div className="flex items-start sm:items-center gap-2 flex-wrap">
              <h2 className="text-lg sm:text-xl font-semibold text-white">{task.title}</h2>
              <div className="flex items-center gap-1.5 flex-wrap">
                {isActive && (
                  <span className="flex items-center gap-1 sm:gap-1.5 px-1.5 sm:px-2 py-0.5 bg-emerald-500/20 text-emerald-400 text-[10px] sm:text-xs rounded-full">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                    </span>
                    ACTIVE
                  </span>
                )}
                {!isActive && task.status === 'in_progress' && (
                  <span className="flex items-center gap-1 sm:gap-1.5 px-1.5 sm:px-2 py-0.5 bg-gray-500/20 text-gray-400 text-[10px] sm:text-xs rounded-full">
                    <span className="h-2 w-2 rounded-full bg-gray-500"></span>
                    IDLE
                  </span>
                )}
                {task.is_blocked && (
                  <span className="px-1.5 sm:px-2 py-0.5 bg-red-500/20 text-red-400 text-[10px] sm:text-xs rounded-full">BLOCKED</span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 sm:gap-3 mt-2 flex-wrap text-xs sm:text-sm">
              <span className={`inline-flex items-center gap-1 sm:gap-1.5 text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full border ${priority.color}`}>
                {priority.label}
              </span>
              <span className="text-white/40">
                {task.assignee}
              </span>
              {task.due_date && (
                <span className={`flex items-center gap-1 ${isOverdue ? 'text-red-400' : 'text-white/40'}`}>
                  📅 {new Date(task.due_date).toLocaleDateString()}
                  {isOverdue && <span className="hidden sm:inline"> (OVERDUE)</span>}
                </span>
              )}
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 sm:p-1.5 rounded-lg hover:bg-white/10 text-white/50 hover:text-white transition-colors flex-shrink-0"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tabs - horizontal scroll on mobile */}
        <div className="flex border-b border-white/10 overflow-x-auto scrollbar-hide">
          <button
            onClick={() => setActiveTab('details')}
            className={`px-4 sm:px-6 py-2.5 sm:py-3 text-xs sm:text-sm font-medium transition-colors whitespace-nowrap flex-shrink-0 ${
              activeTab === 'details' ? 'text-white border-b-2 border-blue-500' : 'text-white/50 hover:text-white/70'
            }`}
          >
            Details
          </button>
          <button
            onClick={() => setActiveTab('activity')}
            className={`px-4 sm:px-6 py-2.5 sm:py-3 text-xs sm:text-sm font-medium transition-colors whitespace-nowrap flex-shrink-0 ${
              activeTab === 'activity' ? 'text-white border-b-2 border-blue-500' : 'text-white/50 hover:text-white/70'
            }`}
          >
            Activity ({activities.length})
          </button>
          <button
            onClick={() => setActiveTab('agent_context')}
            className={`px-4 sm:px-6 py-2.5 sm:py-3 text-xs sm:text-sm font-medium transition-colors flex items-center gap-1.5 whitespace-nowrap flex-shrink-0 ${
              activeTab === 'agent_context' ? 'text-white border-b-2 border-purple-500' : 'text-white/50 hover:text-white/70'
            }`}
          >
            <span>🤖</span>
            <span>Agent</span>
          </button>
        </div>

        {/* Content - Scrollable */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 sm:space-y-6">
          {activeTab === 'details' ? (
            <>
              {/* Time Tracking */}
              <div className="grid grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-white/70 mb-1.5 sm:mb-2">Estimated Hours</label>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    value={task.estimated_hours || ''}
                    onChange={(e) => handleFieldUpdate('estimated_hours', e.target.value ? parseFloat(e.target.value) : null)}
                    placeholder="e.g., 2.5"
                    className="w-full px-3 sm:px-4 py-2 sm:py-2.5 bg-black/30 border border-white/10 rounded-xl text-white placeholder-white/40 focus:border-blue-500/50 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-white/70 mb-1.5 sm:mb-2">Time Spent (hours)</label>
                  <input
                    type="number"
                    step="0.25"
                    min="0"
                    value={task.time_spent || ''}
                    onChange={(e) => handleFieldUpdate('time_spent', e.target.value ? parseFloat(e.target.value) : 0)}
                    placeholder="0"
                    className="w-full px-3 sm:px-4 py-2 sm:py-2.5 bg-black/30 border border-white/10 rounded-xl text-white placeholder-white/40 focus:border-blue-500/50 text-sm"
                  />
                </div>
              </div>

              {/* Blocked Status */}
              <div>
                <label className="flex items-center gap-2 sm:gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={task.is_blocked || false}
                    onChange={(e) => handleFieldUpdate('is_blocked', e.target.checked)}
                    className="w-5 h-5 rounded border-white/20 bg-black/30 text-red-500 focus:ring-red-500"
                  />
                  <span className="text-xs sm:text-sm font-medium text-white/70">Task is blocked</span>
                </label>
                {task.is_blocked && (
                  <textarea
                    value={task.blocked_reason || ''}
                    onChange={(e) => handleFieldUpdate('blocked_reason', e.target.value)}
                    placeholder="Describe what's blocking this task..."
                    rows={2}
                    className="w-full mt-2 px-3 sm:px-4 py-2 sm:py-2.5 bg-red-500/10 border border-red-500/30 rounded-xl text-white placeholder-white/40 focus:border-red-500/50 resize-none text-sm"
                  />
                )}
              </div>

              {/* Priority */}
              <div>
                <label className="block text-xs sm:text-sm font-medium text-white/70 mb-2 sm:mb-3">Priority</label>
                <div className="flex flex-wrap gap-1.5 sm:gap-2">
                  {(Object.keys(priorityConfig) as Task['priority'][]).map((p) => {
                    const config = priorityConfig[p];
                    const isActive = task.priority === p;
                    return (
                      <button
                        key={p}
                        onClick={() => handleFieldUpdate('priority', p)}
                        className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl border transition-all ${
                          isActive
                            ? config.color
                            : 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10'
                        }`}
                      >
                        <span className="text-xs sm:text-sm font-medium">{config.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Due Date */}
              <div>
                <label className="block text-xs sm:text-sm font-medium text-white/70 mb-1.5 sm:mb-2">Due Date</label>
                <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                  <input
                    type="date"
                    value={task.due_date || ''}
                    onChange={(e) => handleFieldUpdate('due_date', e.target.value || null)}
                    className="flex-1 min-w-[150px] px-3 sm:px-4 py-2 sm:py-2.5 bg-black/30 border border-white/10 rounded-xl text-white focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 [color-scheme:dark] text-sm"
                  />
                  <button
                    onClick={() => handleFieldUpdate('due_date', getTodayString())}
                    className="px-2.5 sm:px-3 py-1.5 sm:py-2 text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 border border-blue-500/30 rounded-xl transition-all text-xs sm:text-sm font-medium"
                  >
                    Today
                  </button>
                  {task.due_date && (
                    <button
                      onClick={() => handleFieldUpdate('due_date', null)}
                      className="px-2.5 sm:px-3 py-1.5 sm:py-2 text-white/50 hover:text-white/80 hover:bg-white/10 rounded-xl transition-all text-xs sm:text-sm"
                    >
                      Clear
                    </button>
                  )}
                  {isOverdue && (
                    <span className="text-red-400 text-xs sm:text-sm font-medium">⚠️ Overdue</span>
                  )}
                </div>
              </div>

              {/* Status */}
              <div>
                <label className="block text-xs sm:text-sm font-medium text-white/70 mb-2 sm:mb-3">Status</label>
                <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-1.5 sm:gap-2">
                  {(Object.keys(statusConfig) as Task['status'][]).map((s) => {
                    const config = statusConfig[s];
                    const isActive = task.status === s;
                    return (
                      <button
                        key={s}
                        onClick={() => handleFieldUpdate('status', s)}
                        className={`flex items-center justify-center sm:justify-start gap-1.5 sm:gap-2 px-2.5 sm:px-4 py-2 sm:py-2 rounded-xl border transition-all ${
                          isActive
                            ? `${config.color} border-transparent text-white`
                            : 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10'
                        }`}
                      >
                        <span className="text-sm sm:text-base">{config.icon}</span>
                        <span className="text-xs sm:text-sm font-medium">{config.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Assignee */}
              <div>
                <label className="block text-xs sm:text-sm font-medium text-white/70 mb-2 sm:mb-3">Assignee</label>
                <div className="flex gap-2">
                  {(['Simon', 'Bogdan'] as Task['assignee'][]).map((a) => {
                    const isActive = task.assignee === a;
                    const config = a === 'Simon' 
                      ? { emoji: '🦊', color: 'bg-purple-500/20 border-purple-500/50 text-purple-300' }
                      : { emoji: '👤', color: 'bg-blue-500/20 border-blue-500/50 text-blue-300' };
                    return (
                      <button
                        key={a}
                        onClick={() => handleFieldUpdate('assignee', a)}
                        className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl border transition-all ${
                          isActive
                            ? config.color
                            : 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10'
                        }`}
                      >
                        <span>{config.emoji}</span>
                        <span className="text-xs sm:text-sm font-medium">{a}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs sm:text-sm font-medium text-white/70 mb-1.5 sm:mb-2">Description</label>
                <div className="bg-black/20 rounded-xl p-3 sm:p-4 text-white/80 text-xs sm:text-sm whitespace-pre-wrap">
                  {task.description || 'No description provided.'}
                </div>
              </div>

              {/* Metadata */}
              <div className="grid grid-cols-2 gap-2 sm:gap-4 text-xs sm:text-sm">
                <div className="bg-black/20 rounded-xl p-2.5 sm:p-3">
                  <span className="text-white/50">Created</span>
                  <p className="text-white/80 mt-0.5 sm:mt-1 text-[10px] sm:text-sm">
                    {new Date(task.created_at).toLocaleString()}
                  </p>
                </div>
                <div className="bg-black/20 rounded-xl p-2.5 sm:p-3">
                  <span className="text-white/50">Last Updated</span>
                  <p className="text-white/80 mt-0.5 sm:mt-1 text-[10px] sm:text-sm">
                    {new Date(task.updated_at).toLocaleString()}
                  </p>
                </div>
              </div>

              {/* Comments Section */}
              <div>
                <label className="block text-xs sm:text-sm font-medium text-white/70 mb-2 sm:mb-3">
                  Comments ({comments.length})
                </label>
                
                <div className="space-y-2 sm:space-y-3 mb-3 sm:mb-4 max-h-40 sm:max-h-48 overflow-y-auto">
                  {loadingComments ? (
                    <div className="text-white/40 text-xs sm:text-sm text-center py-4">Loading comments...</div>
                  ) : comments.length === 0 ? (
                    <div className="text-white/40 text-xs sm:text-sm text-center py-4">No comments yet</div>
                  ) : (
                    comments.map((comment) => (
                      <div key={comment.id} className="bg-black/20 rounded-xl p-2.5 sm:p-3">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-white/80 text-xs sm:text-sm font-medium">{comment.author}</span>
                          <span className="text-white/40 text-[10px] sm:text-xs">
                            {new Date(comment.created_at).toLocaleString()}
                          </span>
                        </div>
                        <p className="text-white/70 text-xs sm:text-sm whitespace-pre-wrap">{comment.content}</p>
                      </div>
                    ))
                  )}
                </div>

                {/* Add Comment */}
                <div className="flex gap-2">
                  <textarea
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    placeholder="Add a comment..."
                    rows={2}
                    className="flex-1 px-3 sm:px-4 py-2 sm:py-2.5 bg-black/30 border border-white/10 rounded-xl text-white placeholder-white/40 focus:border-blue-500/50 focus:bg-black/40 focus:ring-2 focus:ring-blue-500/20 resize-none text-xs sm:text-sm"
                  />
                  <button
                    onClick={handleAddComment}
                    disabled={!newComment.trim() || submittingComment}
                    className="px-3 sm:px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-xl font-medium hover:shadow-lg hover:shadow-purple-500/25 disabled:opacity-50 disabled:cursor-not-allowed transition-all self-end text-xs sm:text-sm"
                  >
                    {submittingComment ? '...' : 'Send'}
                  </button>
                </div>
              </div>
            </>
          ) : activeTab === 'activity' ? (
            /* Activity Tab */
            <div className="space-y-3">
              {activities.length === 0 ? (
                <div className="text-white/40 text-sm text-center py-8">No activity recorded yet</div>
              ) : (
                activities.map((activity) => (
                  <div key={activity.id} className="flex gap-3 text-sm">
                    <div className="w-2 h-2 rounded-full bg-blue-500 mt-1.5 flex-shrink-0" />
                    <div className="flex-1">
                      <div className="text-white/80">
                        <span className="font-medium">{activity.actor}</span>
                        {' '}changed{' '}
                        <span className="text-blue-400">{activity.field_changed}</span>
                        {activity.old_value && (
                          <>
                            {' '}from <span className="text-white/50">{activity.old_value}</span>
                          </>
                        )}
                        {' '}to <span className="text-white">{activity.new_value}</span>
                      </div>
                      <div className="text-white/40 text-xs mt-0.5">
                        {new Date(activity.created_at).toLocaleString()}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          ) : (
            /* Agent Context Tab */
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-white/50 text-sm">
                <span>🤖</span>
                <span>AI working context — updated by agents via API</span>
              </div>
              {task.agent_context ? (
                <div className="bg-black/30 border border-purple-500/20 rounded-xl p-4 font-mono text-sm text-white/80 whitespace-pre-wrap overflow-x-auto">
                  {task.agent_context}
                </div>
              ) : (
                <div className="text-white/40 text-sm text-center py-8 bg-black/20 rounded-xl">
                  No agent context set for this task
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 sm:px-6 py-3 sm:py-4 border-t border-white/10 flex justify-between">
          <button
            onClick={() => {
              if (confirm('Are you sure you want to delete this task?')) {
                onDelete(task.id);
                onClose();
              }
            }}
            className="px-3 sm:px-4 py-2 text-red-400 hover:bg-red-500/20 rounded-xl transition-all text-xs sm:text-sm"
          >
            Delete
          </button>
          <button
            onClick={onClose}
            className="px-3 sm:px-4 py-2 text-white/70 hover:text-white hover:bg-white/10 rounded-xl transition-all text-xs sm:text-sm"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
