'use client';

import { useState, useEffect } from 'react';
import { useSession, signOut } from 'next-auth/react';
import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
} from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';
import { Task } from '@/lib/db';
import Column from './Column';
import TaskModal from './TaskModal';
import TaskDetailModal from './TaskDetailModal';
import MetricsPanel from './MetricsPanel';

const columns = [
  { id: 'todo', title: 'To Do', icon: '📋', gradient: 'from-slate-500 to-slate-600' },
  { id: 'in_progress', title: 'In Progress', icon: '⚡', gradient: 'from-blue-500 to-indigo-600' },
  { id: 'in_review', title: 'In Review', icon: '👀', gradient: 'from-amber-500 to-orange-600' },
  { id: 'done', title: 'Done', icon: '✅', gradient: 'from-emerald-500 to-teal-600' },
];

// Sort by updated_at in descending order (most recent first)
const sortByUpdatedAt = (tasks: Task[]): Task[] => {
  return [...tasks].sort((a, b) => {
    const aDate = new Date(a.updated_at || a.created_at).getTime();
    const bDate = new Date(b.updated_at || b.created_at).getTime();
    return bDate - aDate; // Descending order (most recent first)
  });
};

interface WatcherConfig {
  is_running: boolean;
  last_run: string | null;
  current_task_id: string | null;
  active_task_ids: string; // JSON array string
}

export default function KanbanBoard() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailTask, setDetailTask] = useState<Task | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [watcherConfig, setWatcherConfig] = useState<WatcherConfig | null>(null);
  const [togglingWatcher, setTogglingWatcher] = useState(false);
  const { data: session } = useSession();

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  useEffect(() => {
    fetchTasks();
    fetchWatcherConfig();
    // Poll watcher config every 30 seconds
    const interval = setInterval(fetchWatcherConfig, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchWatcherConfig = async () => {
    try {
      const res = await fetch('/api/watcher');
      const data = await res.json();
      setWatcherConfig(data);
    } catch (error) {
      console.error('Error fetching watcher config:', error);
    }
  };

  const toggleWatcher = async () => {
    setTogglingWatcher(true);
    try {
      const res = await fetch('/api/watcher', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'toggle' }),
      });
      const data = await res.json();
      setWatcherConfig(data);
    } catch (error) {
      console.error('Error toggling watcher:', error);
    } finally {
      setTogglingWatcher(false);
    }
  };

  const fetchTasks = async () => {
    try {
      const res = await fetch('/api/tasks');
      const data = await res.json();
      setTasks(data);
    } catch (error) {
      console.error('Error fetching tasks:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeTask = tasks.find(t => t.id === active.id);
    if (!activeTask) return;

    const overId = over.id as string;
    
    const overColumn = columns.find(c => c.id === overId);
    if (overColumn && activeTask.status !== overId) {
      setTasks(prev => prev.map(t => 
        t.id === activeTask.id ? { ...t, status: overId as Task['status'] } : t
      ));
    }
    
    const overTask = tasks.find(t => t.id === overId);
    if (overTask && activeTask.status !== overTask.status) {
      setTasks(prev => prev.map(t => 
        t.id === activeTask.id ? { ...t, status: overTask.status } : t
      ));
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    
    if (!over) return;

    const activeTask = tasks.find(t => t.id === active.id);
    if (!activeTask) return;

    try {
      await fetch(`/api/tasks/${activeTask.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: activeTask.status }),
      });
    } catch (error) {
      console.error('Error updating task:', error);
      fetchTasks();
    }
  };

  const handleCreateTask = async (taskData: Partial<Task>) => {
    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(taskData),
      });
      const newTask = await res.json();
      setTasks(prev => [newTask, ...prev]);
    } catch (error) {
      console.error('Error creating task:', error);
    }
  };

  const handleEditTask = async (taskData: Partial<Task>) => {
    if (!taskData.id) return;
    try {
      const res = await fetch(`/api/tasks/${taskData.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(taskData),
      });
      const updatedTask = await res.json();
      setTasks(prev => prev.map(t => t.id === updatedTask.id ? updatedTask : t));
    } catch (error) {
      console.error('Error updating task:', error);
    }
  };

  const handleDeleteTask = async (id: string) => {
    if (!confirm('Are you sure you want to delete this task?')) return;
    try {
      await fetch(`/api/tasks/${id}`, { method: 'DELETE' });
      setTasks(prev => prev.filter(t => t.id !== id));
    } catch (error) {
      console.error('Error deleting task:', error);
    }
  };

  const openEditModal = (task: Task) => {
    setEditingTask(task);
    setIsModalOpen(true);
  };

  const openCreateModal = () => {
    setEditingTask(null);
    setIsModalOpen(true);
  };

  const openDetailModal = (task: Task) => {
    setDetailTask(task);
    setIsDetailOpen(true);
  };

  const handleTaskUpdate = (updatedTask: Task) => {
    setTasks(prev => prev.map(t => t.id === updatedTask.id ? updatedTask : t));
    setDetailTask(updatedTask);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
          <span className="text-white/60">Loading tasks...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-6 lg:p-8 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="glass rounded-2xl p-4 sm:p-6 mb-4 sm:mb-8 animate-fade-in">
        {/* Single row header with title left, actions right */}
        <div className="flex items-center justify-between gap-3">
          {/* Title */}
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold gradient-text truncate">
              Simon Task Tracker
            </h1>
            <p className="text-white/50 text-xs sm:text-sm hidden md:block">
              Drag tasks between columns to update their status
            </p>
          </div>
          
          {/* Action buttons - right side */}
          <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
            {/* Watcher Toggle */}
            <button
              onClick={toggleWatcher}
              disabled={togglingWatcher}
              className={`group flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-lg sm:rounded-xl font-medium transition-all text-xs sm:text-sm ${
                watcherConfig?.is_running
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30'
                  : 'bg-white/5 text-white/50 border border-white/10 hover:bg-white/10 hover:text-white/70'
              }`}
              title={watcherConfig?.is_running ? 'Watcher is running - click to pause' : 'Watcher is paused - click to start'}
            >
              {togglingWatcher ? (
                <div className="w-3 h-3 sm:w-4 sm:h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
              ) : watcherConfig?.is_running ? (
                <>
                  <span className="relative flex h-2.5 w-2.5 sm:h-3 sm:w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 sm:h-3 sm:w-3 bg-emerald-500"></span>
                  </span>
                  <span className="hidden sm:inline">Watcher</span>
                </>
              ) : (
                <>
                  <span className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-white/30"></span>
                  <span className="hidden sm:inline">Paused</span>
                </>
              )}
            </button>
            
            {/* New Task Button */}
            <button
              onClick={openCreateModal}
              className="group flex items-center gap-1 sm:gap-2 px-2.5 sm:px-4 py-1.5 sm:py-2 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg sm:rounded-xl font-medium hover:shadow-lg hover:shadow-purple-500/25 hover:scale-105 active:scale-95 text-xs sm:text-sm"
            >
              <span className="text-base sm:text-lg group-hover:rotate-90 transition-transform duration-200">+</span>
              <span className="hidden sm:inline">New Task</span>
            </button>
            
            {/* User info */}
            {session?.user && (
              <div className="flex items-center gap-2 ml-1 sm:ml-2">
                {session.user.image && (
                  <img src={session.user.image} alt="" className="w-6 h-6 sm:w-8 sm:h-8 rounded-full" />
                )}
                <button
                  onClick={() => signOut()}
                  className="text-white/40 hover:text-white/70 text-xs transition-colors hidden sm:block"
                >
                  Sign out
                </button>
              </div>
            )}
          </div>
        </div>
        
        {/* Stats - horizontal scroll on mobile */}
        <div className="flex gap-3 sm:gap-6 mt-4 sm:mt-6 pt-4 sm:pt-6 border-t border-white/10 overflow-x-auto pb-1 -mx-4 px-4 sm:mx-0 sm:px-0 scrollbar-hide">
          {columns.map((col) => {
            const count = tasks.filter(t => t.status === col.id).length;
            return (
              <div key={col.id} className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
                <span className="text-base sm:text-lg">{col.icon}</span>
                <span className="text-white/70 text-xs sm:text-sm whitespace-nowrap">{col.title}:</span>
                <span className="text-white font-semibold text-sm sm:text-base">{count}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Board - horizontal scroll with snap on mobile */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-3 sm:gap-4 overflow-x-auto sm:overflow-visible pb-4 -mx-3 px-3 sm:mx-0 sm:px-0 snap-x snap-mandatory sm:snap-none scrollbar-hide w-full">
          {columns.map((column, index) => (
            <div key={column.id} className="animate-fade-in snap-start flex-shrink-0 sm:flex-shrink sm:flex-1 sm:min-w-0" style={{ animationDelay: `${index * 100}ms` }}>
              <Column
                id={column.id}
                title={column.title}
                icon={column.icon}
                gradient={column.gradient}
                tasks={sortByUpdatedAt(tasks.filter(t => t.status === column.id))}
                onEditTask={openEditModal}
                onDeleteTask={handleDeleteTask}
                onViewTask={openDetailModal}
                activeTaskIds={watcherConfig?.active_task_ids ? JSON.parse(watcherConfig.active_task_ids) : []}
              />
            </div>
          ))}
        </div>
      </DndContext>

      {/* Metrics Panel */}
      <MetricsPanel />

      <TaskModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={editingTask ? handleEditTask : handleCreateTask}
        task={editingTask}
      />

      <TaskDetailModal
        task={detailTask}
        isOpen={isDetailOpen}
        onClose={() => setIsDetailOpen(false)}
        onUpdate={handleTaskUpdate}
        onDelete={handleDeleteTask}
        isActive={detailTask ? (JSON.parse(watcherConfig?.active_task_ids || '[]') as string[]).includes(detailTask.id) : false}
      />
    </div>
  );
}
