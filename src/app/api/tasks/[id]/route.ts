import { NextRequest, NextResponse } from 'next/server';
import { getTask, updateTask, deleteTask } from '@/lib/db';
import { sendWebhook } from '@/lib/webhook';

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
    
    // Auto-assign to Bogdan when moving to in_review
    if (body.status === 'in_review') {
      body.assignee = 'Bogdan';
    }
    
    const task = await updateTask(id, body);
    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }
    
    // Send webhook for significant updates
    // - Field changes: title, description, priority, assignee, due_date
    // - Status changes: only when moved to 'done' (completion is significant)
    const significantFields = ['title', 'description', 'priority', 'assignee', 'due_date'];
    const hasSignificantChange = significantFields.some(field => field in body);
    const isCompleted = body.status === 'done';
    
    if (hasSignificantChange || isCompleted) {
      await sendWebhook({
        event: isCompleted ? 'task.completed' : 'task.updated',
        task: task,
      });
    }
    
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
