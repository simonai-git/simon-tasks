const NTFY_TOPIC = process.env.NTFY_TOPIC || 'simon-tasks-notify';
const NTFY_URL = `https://ntfy.sh/${NTFY_TOPIC}`;

export interface WebhookPayload {
  event: 'task.created' | 'task.updated' | 'task.deleted';
  task: {
    id: string;
    title: string;
    description?: string | null;
    status: string;
    assignee: string;
    priority: string;
    due_date?: string | null;
  };
}

export async function sendWebhook(payload: WebhookPayload): Promise<void> {
  try {
    const { event, task } = payload;
    
    // Format message for ntfy
    const priorityEmoji = task.priority === 'high' ? '🔴' : task.priority === 'medium' ? '🟡' : '🟢';
    const eventAction = event === 'task.created' ? '📥 New Task' : event === 'task.updated' ? '✏️ Updated' : '🗑️ Deleted';
    
    const title = `${eventAction}: ${task.title}`;
    const message = [
      task.description || 'No description',
      '',
      `${priorityEmoji} Priority: ${task.priority}`,
      `👤 Assignee: ${task.assignee}`,
      task.due_date ? `📅 Due: ${task.due_date}` : '',
    ].filter(Boolean).join('\n');

    // Map priority to ntfy priority (1-5)
    const ntfyPriority = task.priority === 'high' ? '5' : task.priority === 'medium' ? '3' : '2';

    await fetch(NTFY_URL, {
      method: 'POST',
      headers: {
        'Title': title,
        'Priority': ntfyPriority,
        'Tags': `task,${task.priority},${task.assignee.toLowerCase()}`,
      },
      body: message,
    });

    console.log(`Webhook sent: ${event} - ${task.title}`);
  } catch (error) {
    console.error('Webhook error:', error);
    // Don't throw - webhook failure shouldn't break task creation
  }
}
