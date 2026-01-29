'use client';

import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Task } from '@/lib/db';
import TaskCard from './TaskCard';

interface ColumnProps {
  id: string;
  title: string;
  icon: string;
  gradient: string;
  tasks: Task[];
  onEditTask: (task: Task) => void;
  onDeleteTask: (id: string) => void;
  onViewTask: (task: Task) => void;
}

export default function Column({ id, title, icon, gradient, tasks, onEditTask, onDeleteTask, onViewTask }: ColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id });

  return (
    <div className="flex flex-col w-80 min-w-[320px]">
      {/* Column Header */}
      <div className={`bg-gradient-to-r ${gradient} rounded-t-xl px-4 py-3 flex items-center justify-between shadow-lg`}>
        <div className="flex items-center gap-2">
          <span className="text-xl">{icon}</span>
          <h2 className="font-semibold text-white">{title}</h2>
        </div>
        <span className="bg-white/20 backdrop-blur-sm text-white text-sm px-2.5 py-0.5 rounded-full font-medium">
          {tasks.length}
        </span>
      </div>
      
      {/* Column Body */}
      <div
        ref={setNodeRef}
        className={`flex-1 glass rounded-b-xl p-3 space-y-3 min-h-[500px] transition-all duration-200 ${
          isOver ? 'bg-white/[0.06] scale-[1.02]' : ''
        }`}
      >
        <SortableContext items={tasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
          {tasks.map((task, index) => (
            <div key={task.id} className="animate-fade-in" style={{ animationDelay: `${index * 50}ms` }}>
              <TaskCard
                task={task}
                onEdit={onEditTask}
                onDelete={onDeleteTask}
                onView={onViewTask}
              />
            </div>
          ))}
        </SortableContext>
        
        {tasks.length === 0 && (
          <div className={`flex flex-col items-center justify-center py-12 text-white/30 transition-all ${isOver ? 'scale-105 text-white/50' : ''}`}>
            <div className="text-4xl mb-2">{isOver ? '📥' : '📭'}</div>
            <span className="text-sm">{isOver ? 'Drop it here!' : 'No tasks yet'}</span>
          </div>
        )}
      </div>
    </div>
  );
}
