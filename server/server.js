import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';

const app = express();
app.use(cors()); app.use(express.json());
const here = path.dirname(fileURLToPath(import.meta.url));
const storePath = path.join(here, 'data.json');
const secret = process.env.JWT_SECRET || 'project-management-local-secret';
const read = () => JSON.parse(fs.readFileSync(storePath, 'utf8'));
const write = data => fs.writeFileSync(storePath, JSON.stringify(data, null, 2));
const id = () => crypto.randomUUID();
const hash = value => crypto.createHash('sha256').update(value).digest('hex');

function record(data, projectId, user, action, detail) {
  const previous = data.ledger.at(-1)?.hash || 'GENESIS';
  const entry = { id: id(), projectId, userId: user.id, userName: user.name, action, detail, createdAt: new Date().toISOString(), previousHash: previous };
  entry.hash = hash(`${entry.projectId}|${entry.userId}|${entry.action}|${entry.detail}|${entry.createdAt}|${previous}`);
  data.ledger.push(entry); return entry;
}
function auth(req, res, next) { try { req.user = jwt.verify(req.headers.authorization?.replace('Bearer ', ''), secret); next(); } catch { res.status(401).json({ error: 'Authentication required' }); } }
function member(project, userId) { return project.members.some(m => m.id === userId); }

app.post('/api/auth/register', async (req, res) => {
  const { name, username, mobile, email, password } = req.body;
  const role = 'member';
  if (!name || !username || !mobile || !email || !password) return res.status(400).json({ error: 'Name, username, mobile number, email and password are required' });
  if (!/^[A-Za-z0-9_.-]{3,30}$/.test(username)) return res.status(400).json({ error: 'Username must contain 3-30 letters, numbers, dots, hyphens, or underscores' });
  if (!/^[0-9+() -]{7,20}$/.test(mobile)) return res.status(400).json({ error: 'Enter a valid mobile number' });
  const data = read(); if (data.users.some(u => u.email === email)) return res.status(409).json({ error: 'Email already registered' });
  if (data.users.some(u => u.username?.toLowerCase() === username.toLowerCase())) return res.status(409).json({ error: 'Username is already taken' });
  const user = { id: id(), name, username, mobile, email, role, password: await bcrypt.hash(password, 10) }; data.users.push(user); write(data);
  const token = jwt.sign({ id: user.id, name, username, email, role }, secret, { expiresIn: '8h' }); res.status(201).json({ token, user: { id: user.id, name, username, mobile, email, role } });
});
app.post('/api/auth/login', async (req, res) => { const data = read(); const user = data.users.find(u => u.email === req.body.email); if (!user || !(await bcrypt.compare(req.body.password, user.password))) return res.status(401).json({ error: 'Invalid email or password' }); const token = jwt.sign({ id: user.id, name: user.name, username: user.username, email: user.email, role: user.role }, secret, { expiresIn: '8h' }); res.json({ token, user: { id: user.id, name: user.name, username: user.username, mobile: user.mobile, email: user.email, role: user.role } }); });
app.get('/api/users', auth, (req, res) => res.json(read().users.map(({ password, ...user }) => user)));
app.get('/api/projects', auth, (req, res) => res.json(read().projects.filter(p => member(p, req.user.id))));
app.post('/api/projects', auth, (req, res) => { const { name, description, memberIds = [] } = req.body; if (!name) return res.status(400).json({ error: 'Project name is required' }); const data = read(); const users = data.users; const ids = [...new Set([req.user.id, ...memberIds])]; const project = { id: id(), name, description: description || '', ownerId: req.user.id, members: users.filter(u => ids.includes(u.id)).map(({ password, ...u }) => u), createdAt: new Date().toISOString() }; data.projects.push(project); record(data, project.id, req.user, 'created project', name); write(data); res.status(201).json(project); });
app.get('/api/projects/:projectId/tasks', auth, (req, res) => { const data = read(); const project = data.projects.find(p => p.id === req.params.projectId); if (!project || !member(project, req.user.id)) return res.status(403).json({ error: 'Project access denied' }); res.json(data.tasks.filter(t => t.projectId === project.id)); });
app.post('/api/projects/:projectId/tasks', auth, (req, res) => { const data = read(); const project = data.projects.find(p => p.id === req.params.projectId); if (!project || !member(project, req.user.id)) return res.status(403).json({ error: 'Project access denied' }); const { title, description = '', assigneeId = '', priority = 'Medium', dueDate = '' } = req.body; if (!title) return res.status(400).json({ error: 'Task title is required' }); const task = { id: id(), projectId: project.id, title, description, assigneeId, priority, dueDate, status: 'To Do', createdBy: req.user.id, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }; data.tasks.push(task); record(data, project.id, req.user, 'created task', title); write(data); res.status(201).json(task); });
app.patch('/api/tasks/:taskId', auth, (req, res) => { const data = read(); const task = data.tasks.find(t => t.id === req.params.taskId); const project = task && data.projects.find(p => p.id === task.projectId); if (!task || !project || !member(project, req.user.id)) return res.status(403).json({ error: 'Task access denied' }); const permitted = ['title','description','assigneeId','priority','dueDate','status']; permitted.forEach(k => { if (req.body[k] !== undefined) task[k] = req.body[k]; }); task.updatedAt = new Date().toISOString(); record(data, project.id, req.user, 'updated task', `${task.title} (${task.status})`); write(data); res.json(task); });
app.get('/api/projects/:projectId/activity', auth, (req,res) => { const data=read(), project=data.projects.find(p=>p.id===req.params.projectId); if(!project||!member(project,req.user.id)) return res.status(403).json({error:'Project access denied'}); res.json(data.ledger.filter(l=>l.projectId===project.id).reverse()); });
app.get('/api/projects/:projectId/analytics', auth, (req,res) => { const data=read(), project=data.projects.find(p=>p.id===req.params.projectId); if(!project||!member(project,req.user.id)) return res.status(403).json({error:'Project access denied'}); const tasks=data.tasks.filter(t=>t.projectId===project.id), total=tasks.length, done=tasks.filter(t=>t.status==='Done').length; const now=new Date(); const overdue=tasks.filter(t=>t.status!=='Done'&&t.dueDate&&new Date(t.dueDate)<now).length; const high=tasks.filter(t=>t.status!=='Done'&&t.priority==='High').length; res.json({total,done,inProgress:tasks.filter(t=>t.status==='In Progress').length,todo:tasks.filter(t=>t.status==='To Do').length,completion:total?Math.round(done/total*100):0,overdue,high, risk: overdue ? 'High' : high ? 'Medium' : 'Low'}); });
app.listen(4000, () => console.log('API running at http://localhost:4000'));
