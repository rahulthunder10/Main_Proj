<<<<<<< HEAD
# Main_Proj
=======
# Production Studio - Intelligent Project Management System

This implementation follows the supplied final-year project report: centralized project and task management, role-labelled accounts, a Kanban workflow, project analytics, activity accountability, predictive task-risk status, and hash-linked activity records.

## Run locally

1. Install Node.js 20 or newer.
2. From this folder, run `npm install`.
3. Run `npm run dev`.
4. Open the address shown by Vite (normally `http://localhost:5173`). The API runs on port 4000.

Register the first account, create a project, select team members, and then create tasks. Drag task cards between To Do, In Progress, and Done to update their workflow status.

## Data storage

For a self-contained academic demonstration, application data is stored in `server/data.json`. It starts empty and is created through the app. The Express API is in `server/server.js`; the React interface is in `src/`.
>>>>>>> 7ef568e (Initial commit)
