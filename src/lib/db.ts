import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

// Initialize database
async function initDb() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT,
        status TEXT NOT NULL DEFAULT 'todo',
        assignee TEXT NOT NULL DEFAULT 'Simon',
        priority TEXT DEFAULT 'medium',
        due_date TEXT,
        estimated_hours DECIMAL,
        time_spent DECIMAL DEFAULT 0,
        progress INTEGER DEFAULT 0,
        is_blocked BOOLEAN DEFAULT FALSE,
        blocked_reason TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    
    // Add new columns if they don't exist (for existing databases)
    await client.query(`
      DO $$ 
      BEGIN
        ALTER TABLE tasks ADD COLUMN IF NOT EXISTS estimated_hours DECIMAL;
        ALTER TABLE tasks ADD COLUMN IF NOT EXISTS time_spent DECIMAL DEFAULT 0;
        ALTER TABLE tasks ADD COLUMN IF NOT EXISTS progress INTEGER DEFAULT 0;
        ALTER TABLE tasks ADD COLUMN IF NOT EXISTS is_blocked BOOLEAN DEFAULT FALSE;
        ALTER TABLE tasks ADD COLUMN IF NOT EXISTS blocked_reason TEXT;
        ALTER TABLE tasks ADD COLUMN IF NOT EXISTS agent_context TEXT;
      EXCEPTION WHEN OTHERS THEN NULL;
      END $$;
    `);
    
    await client.query(`
      CREATE TABLE IF NOT EXISTS comments (
        id TEXT PRIMARY KEY,
        task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
        author TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    
    await client.query(`
      CREATE TABLE IF NOT EXISTS activity_log (
        id TEXT PRIMARY KEY,
        task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
        action TEXT NOT NULL,
        field_changed TEXT,
        old_value TEXT,
        new_value TEXT,
        actor TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    
    console.log('Database initialized');
  } finally {
    client.release();
  }
}

// Initialize on module load
initDb().catch(console.error);

export interface Task {
  id: string;
  title: string;
  description: string | null;
  status: 'todo' | 'in_progress' | 'in_review' | 'done';
  assignee: 'Bogdan' | 'Simon';
  priority: 'low' | 'medium' | 'high';
  due_date: string | null;
  estimated_hours: number | null;
  time_spent: number;
  progress: number;
  is_blocked: boolean;
  blocked_reason: string | null;
  agent_context: string | null;
  created_at: string;
  updated_at: string;
}

export async function getAllTasks(): Promise<Task[]> {
  const result = await pool.query('SELECT * FROM tasks ORDER BY created_at DESC');
  return result.rows;
}

export async function getTask(id: string): Promise<Task | null> {
  const result = await pool.query('SELECT * FROM tasks WHERE id = $1', [id]);
  return result.rows[0] || null;
}

export async function getTasksByStatus(status: string): Promise<Task[]> {
  const result = await pool.query('SELECT * FROM tasks WHERE status = $1 ORDER BY created_at DESC', [status]);
  return result.rows;
}

export async function createTask(task: Partial<Task> & { id: string; title: string }): Promise<Task> {
  const result = await pool.query(
    `INSERT INTO tasks (id, title, description, status, assignee, priority, due_date, estimated_hours, time_spent, progress, is_blocked, blocked_reason, agent_context)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
     RETURNING *`,
    [
      task.id,
      task.title,
      task.description || null,
      task.status || 'todo',
      task.assignee || 'Simon',
      task.priority || 'medium',
      task.due_date || null,
      task.estimated_hours || null,
      task.time_spent || 0,
      task.progress || 0,
      task.is_blocked || false,
      task.blocked_reason || null,
      task.agent_context || null
    ]
  );
  return result.rows[0];
}

export async function updateTask(id: string, updates: Partial<Task>): Promise<Task | null> {
  const fields = Object.keys(updates).filter(k => k !== 'id' && k !== 'created_at');
  if (fields.length === 0) return null;
  
  const setClause = fields.map((f, i) => `${f} = $${i + 1}`).join(', ');
  const values = fields.map(f => updates[f as keyof Task]);
  
  const result = await pool.query(
    `UPDATE tasks SET ${setClause}, updated_at = NOW() WHERE id = $${fields.length + 1} RETURNING *`,
    [...values, id]
  );
  
  return result.rows[0] || null;
}

export async function deleteTask(id: string): Promise<boolean> {
  const result = await pool.query('DELETE FROM tasks WHERE id = $1', [id]);
  return (result.rowCount ?? 0) > 0;
}

// Comments
export interface Comment {
  id: string;
  task_id: string;
  author: string;
  content: string;
  created_at: string;
}

export async function getCommentsByTaskId(taskId: string): Promise<Comment[]> {
  const result = await pool.query(
    'SELECT * FROM comments WHERE task_id = $1 ORDER BY created_at ASC',
    [taskId]
  );
  return result.rows;
}

export async function createComment(comment: Omit<Comment, 'created_at'>): Promise<Comment> {
  const result = await pool.query(
    `INSERT INTO comments (id, task_id, author, content)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [comment.id, comment.task_id, comment.author, comment.content]
  );
  return result.rows[0];
}

export async function deleteComment(id: string): Promise<boolean> {
  const result = await pool.query('DELETE FROM comments WHERE id = $1', [id]);
  return (result.rowCount ?? 0) > 0;
}

// Activity Log
export interface ActivityLog {
  id: string;
  task_id: string;
  action: string;
  field_changed: string | null;
  old_value: string | null;
  new_value: string | null;
  actor: string;
  created_at: string;
}

export async function logActivity(log: Omit<ActivityLog, 'created_at'>): Promise<ActivityLog> {
  const result = await pool.query(
    `INSERT INTO activity_log (id, task_id, action, field_changed, old_value, new_value, actor)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [log.id, log.task_id, log.action, log.field_changed, log.old_value, log.new_value, log.actor]
  );
  return result.rows[0];
}

export async function getActivityByTaskId(taskId: string): Promise<ActivityLog[]> {
  const result = await pool.query(
    'SELECT * FROM activity_log WHERE task_id = $1 ORDER BY created_at DESC',
    [taskId]
  );
  return result.rows;
}

export default pool;
