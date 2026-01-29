'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Task } from '@/lib/db';

interface TaskCardProps {
  task: Task;
  onEdit: (task: Task) => void;
  onDelete: (id: string) => void;
  onView: (task: Task) => void;
  isActive?: boolean;
}

const priorityConfig = {
  low: { color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30', dot: 'bg-emerald-400' },
  medium: { color: 'bg-amber-500/20 text-amber-400 border-amber-500/30', dot: 'bg-amber-400' },
  high: { color: 'bg-red-500/20 text-red-400 border-red-500/30', dot: 'bg-red-400' },
};

const assigneeConfig = {
  Bogdan: { color: 'from-blue-500 to-cyan-500', emoji: '👤' },
  Simon: { color: 'from-purple-500 to-pink-500', emoji: '🦊' },
};

export default function TaskCard({ task, onEdit, onDelete, onView, isActive = false }: TaskCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const priority = priorityConfig[task.priority];
  const assignee = assigneeConfig[task.assignee];
  const isOverdue = task.due_date && new Date(task.due_date) < new Date() && task.status !== 'done';
  const progress = task.progress || 0;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={() => !isDragging && onView(task)}
      className={`group relative bg-white/[0.03] hover:bg-white/[0.06] border rounded-xl p-4 cursor-pointer active:cursor-grabbing transition-all duration-200 ${
        isDragging ? 'opacity-50 scale-105 shadow-2xl shadow-purple-500/20 border-purple-500/30' : ''
      } ${task.is_blocked ? 'border-red-500/30' : isOverdue ? 'border-orange-500/30' : 'border-white/[0.06] hover:border-white/[0.12]'}`}
    >
      {/* Active work indicator */}
      <div className="absolute top-2 right-2 z-10">
        {isActive ? (
          <span className="relative flex h-3 w-3" title="Agent actively working on this task">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
          </span>
        ) : task.status === 'in_progress' ? (
          <span className="flex h-3 w-3" title="In progress but not actively being worked on">
            <span className="rounded-full h-3 w-3 bg-gray-500/50"></span>
          </span>
        ) : null}
      </div>

      {/* Blocked/Overdue indicator */}
      {(task.is_blocked || isOverdue) && (
        <div className={`absolute top-0 left-0 right-0 h-1 rounded-t-xl ${task.is_blocked ? 'bg-red-500' : 'bg-orange-500'}`} />
      )}

      {/* Action buttons - appear on hover */}
      <div className="absolute top-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onEdit(task);
          }}
          className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/40 hover:text-blue-400 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete(task.id);
          }}
          className="p-1.5 rounded-lg bg-white/5 hover:bg-red-500/20 text-white/40 hover:text-red-400 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>

      {/* Title with badges */}
      <div className="flex items-start gap-2 pr-16 mb-2">
        <h3 className="font-medium text-white flex-1">{task.title}</h3>
        {task.is_blocked && (
          <span className="text-[10px] px-1.5 py-0.5 bg-red-500/20 text-red-400 rounded">BLOCKED</span>
        )}
      </div>
      
      {/* Description */}
      {task.description && (
        <p className="text-sm text-white/50 mb-3 line-clamp-2">{task.description}</p>
      )}

      {/* Progress bar (if > 0) */}
      {progress > 0 && (
        <div className="mb-3">
          <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="text-[10px] text-white/40 mt-1">{progress}%</span>
        </div>
      )}
      
      {/* Footer */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Priority badge */}
          <span className={`inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-full border ${priority.color}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${priority.dot}`} />
            {task.priority}
          </span>
          
          {/* Time estimate */}
          {task.estimated_hours && (
            <span className="text-xs text-white/40">
              {task.time_spent || 0}/{task.estimated_hours}h
            </span>
          )}
          
          {/* Due date */}
          {task.due_date && (
            <span className={`text-xs flex items-center gap-1 ${isOverdue ? 'text-orange-400' : 'text-white/40'}`}>
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              {new Date(task.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </span>
          )}
        </div>
        
        {/* Assignee */}
        <div className={`w-7 h-7 rounded-full bg-gradient-to-br ${assignee.color} flex items-center justify-center text-sm shadow-lg`}>
          {assignee.emoji}
        </div>
      </div>
    </div>
  );
}
