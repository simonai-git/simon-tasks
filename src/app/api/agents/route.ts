import { NextRequest, NextResponse } from 'next/server';
import { getAllAgents, getActiveAgents, createAgent, Agent } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';

// API key from environment
const API_KEY = process.env.SIMON_API_KEY;

function checkAuth(request: NextRequest): boolean {
  const apiKey = request.headers.get('x-api-key');
  return apiKey === API_KEY;
}

// GET /api/agents - Get all agents
export async function GET(request: NextRequest) {
  if (!checkAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const activeOnly = request.nextUrl.searchParams.get('active') === 'true';
    const agents = activeOnly ? await getActiveAgents() : await getAllAgents();
    return NextResponse.json(agents);
  } catch (error) {
    console.error('Error fetching agents:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/agents - Create a new agent
export async function POST(request: NextRequest) {
  if (!checkAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    
    if (!body.name || !body.specialization) {
      return NextResponse.json(
        { error: 'Name and specialization are required' },
        { status: 400 }
      );
    }

    const agent = await createAgent({
      id: body.id || `agent-${uuidv4()}`,
      name: body.name,
      specialization: body.specialization,
      description: body.description,
      system_prompt: body.system_prompt,
      memory: body.memory,
      avatar_emoji: body.avatar_emoji,
      avatar_color: body.avatar_color,
      is_active: body.is_active,
    });

    return NextResponse.json(agent, { status: 201 });
  } catch (error: any) {
    console.error('Error creating agent:', error);
    if (error.code === '23505') { // Unique violation
      return NextResponse.json({ error: 'An agent with this name already exists' }, { status: 409 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
