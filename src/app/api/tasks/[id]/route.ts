import { NextRequest, NextResponse } from 'next/server';
import { getTask, updateTask, deleteTask } from '@/lib/db';
import { sendWebhook } from '@/lib/webhook';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const task = await updateTask(id, body);
    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }
    
    // Send webhook for significant updates (not just drag-drop status changes)
    const significantFields = ['title', 'description', 'priority', 'assignee', 'due_date'];
    const hasSignificantChange = significantFields.some(field => field in body);
    
    if (hasSignificantChange) {
      await sendWebhook({
        event: 'task.updated',
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
