import { NextRequest, NextResponse } from 'next/server';
import { getTask, updateTask, deleteTask, logActivity } from '@/lib/db';
import { sendWebhook } from '@/lib/webhook';
import { v4 as uuidv4 } from 'uuid';

const API_KEY = process.env.SIMON_API_KEY;

function isAuthorized(request: NextRequest): boolean {
  const authHeader = request.headers.get('x-api-key');
  return authHeader === API_KEY && !!API_KEY;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    
    // Get current task for activity logging
    const oldTask = await getTask(id);
    if (!oldTask) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }
    
    // Keep the assigned agent - don't auto-reassign based on status
    // Tasks stay with their assigned agent throughout the workflow
    
    const task = await updateTask(id, body);
    if (!task) {
      return NextResponse.json({ error: 'Failed to update task' }, { status: 500 });
    }
    
    // Log activity for each changed field
    const actor = isAuthorized(request) ? 'Simon' : 'Bogdan';
    for (const field of Object.keys(body)) {
      const oldValue = String(oldTask[field as keyof typeof oldTask] ?? '');
      const newValue = String(body[field] ?? '');
      if (oldValue !== newValue) {
        await logActivity({
          id: uuidv4(),
          task_id: id,
          action: 'updated',
          field_changed: field,
          old_value: oldValue,
          new_value: newValue,
          actor,
        });
      }
    }
    
    // Send webhook for ALL task updates so Simon stays in sync
    const isCompleted = body.status === 'done';
    await sendWebhook({
      event: isCompleted ? 'task.completed' : 'task.updated',
      task: task,
    });
    
    return NextResponse.json(task);
  } catch (error) {
    console.error('Error updating task:', error);
    return NextResponse.json({ error: 'Failed to update task' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    // Get task before deleting for webhook
    const task = await getTask(id);
    
    const success = await deleteTask(id);
    if (!success) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }
    
    // Send webhook for deletion
    if (task) {
      await sendWebhook({
        event: 'task.deleted',
        task: task,
      });
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting task:', error);
    return NextResponse.json({ error: 'Failed to delete task' }, { status: 500 });
  }
}
