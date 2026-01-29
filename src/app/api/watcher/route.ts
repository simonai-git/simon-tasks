import { NextRequest, NextResponse } from 'next/server';
import { getWatcherConfig, toggleWatcher, updateWatcherConfig } from '@/lib/db';

export async function GET() {
  try {
    const config = await getWatcherConfig();
    return NextResponse.json(config);
  } catch (error) {
    console.error('Error fetching watcher config:', error);
    return NextResponse.json({ error: 'Failed to fetch watcher config' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // If toggle action, toggle the state
    if (body.action === 'toggle') {
      const config = await toggleWatcher();
      return NextResponse.json(config);
    }
    
    // If heartbeat action, update last_run
    if (body.action === 'heartbeat') {
      const config = await updateWatcherConfig({
        last_run: new Date().toISOString(),
        current_task_id: body.current_task_id || null,
      });
      return NextResponse.json(config);
    }
    
    // Otherwise, update with provided values
    const config = await updateWatcherConfig(body);
    return NextResponse.json(config);
  } catch (error) {
    console.error('Error updating watcher config:', error);
    return NextResponse.json({ error: 'Failed to update watcher config' }, { status: 500 });
  }
}
