import { NextRequest } from 'next/server';
import { getAllTasks, getWatcherConfig, Task, WatcherConfig } from '@/lib/db';

// SSE endpoint for real-time updates
// Uses server-side polling to check for changes and streams them to clients

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Track last known state hash for change detection
let lastTasksHash = '';
let lastWatcherHash = '';

function hashState(data: unknown): string {
  return JSON.stringify(data);
}

export async function GET(request: NextRequest) {
  const encoder = new TextEncoder();
  
  // Create a readable stream for SSE
  const stream = new ReadableStream({
    async start(controller) {
      // Send initial connection message
      controller.enqueue(encoder.encode(`event: connected\ndata: {"status":"connected"}\n\n`));
      
      // Send initial data
      try {
        const [tasks, watcher] = await Promise.all([
          getAllTasks(),
          getWatcherConfig()
        ]);
        
        controller.enqueue(encoder.encode(`event: tasks\ndata: ${JSON.stringify(tasks)}\n\n`));
        controller.enqueue(encoder.encode(`event: watcher\ndata: ${JSON.stringify(watcher)}\n\n`));
        
        lastTasksHash = hashState(tasks.map(t => ({ id: t.id, status: t.status, updated_at: t.updated_at })));
        lastWatcherHash = hashState(watcher);
      } catch (error) {
        console.error('SSE initial data error:', error);
      }
      
      // Poll for changes every 2 seconds
      const interval = setInterval(async () => {
        try {
          const [tasks, watcher] = await Promise.all([
            getAllTasks(),
            getWatcherConfig()
          ]);
          
          // Check for task changes
          const currentTasksHash = hashState(tasks.map(t => ({ id: t.id, status: t.status, updated_at: t.updated_at })));
          if (currentTasksHash !== lastTasksHash) {
            controller.enqueue(encoder.encode(`event: tasks\ndata: ${JSON.stringify(tasks)}\n\n`));
            lastTasksHash = currentTasksHash;
          }
          
          // Check for watcher changes
          const currentWatcherHash = hashState(watcher);
          if (currentWatcherHash !== lastWatcherHash) {
            controller.enqueue(encoder.encode(`event: watcher\ndata: ${JSON.stringify(watcher)}\n\n`));
            lastWatcherHash = currentWatcherHash;
          }
          
          // Send heartbeat to keep connection alive
          controller.enqueue(encoder.encode(`: heartbeat\n\n`));
          
        } catch (error) {
          console.error('SSE polling error:', error);
        }
      }, 2000);
      
      // Clean up on client disconnect
      request.signal.addEventListener('abort', () => {
        clearInterval(interval);
        controller.close();
      });
    }
  });
  
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // Disable buffering for nginx
    },
  });
}
