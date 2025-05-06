type Project = {
  id: string;
  name: string;
  createdAt: string;
};

type Todo = {
  id: string;
  projectId: string;
  title: string;
  completed: boolean;
  dueDate: string | null;
  createdAt: string;
};

type RequestBody = Record<string, unknown> | null;

const projects = new Map<string, Project>();
const todos = new Map<string, Todo>();

let projectCounter = 1;
let todoCounter = 1;

function json(res: unknown, status = 200): Response {
  return new Response(JSON.stringify(res), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function notFound(): Response {
  return new Response("Not Found", { status: 404 });
}

async function parseBody(req: Request): Promise<RequestBody> {
  try {
    return await req.json();
  } catch {
    return null;
  }
}

function matchRoute(path: string, method: string) {
  const routes = [
    { method: "GET", path: /^\/projects$/, handler: listProjects },
    { method: "POST", path: /^\/projects$/, handler: createProject },
    { method: "GET", path: /^\/projects\/([^\/]+)$/, handler: getProject },
    { method: "PUT", path: /^\/projects\/([^\/]+)$/, handler: updateProject },
    { method: "DELETE", path: /^\/projects\/([^\/]+)$/, handler: deleteProject },

    { method: "GET", path: /^\/projects\/([^\/]+)\/todos$/, handler: listTodos },
    { method: "POST", path: /^\/projects\/([^\/]+)\/todos$/, handler: createTodo },

    { method: "GET", path: /^\/todos$/, handler: listAllTodos },
    { method: "GET", path: /^\/todos\/([^\/]+)$/, handler: getTodo },
    { method: "PUT", path: /^\/todos\/([^\/]+)$/, handler: updateTodo },
    { method: "DELETE", path: /^\/todos\/([^\/]+)$/, handler: deleteTodo },
  ];

  for (const route of routes) {
    const match = path.match(route.path);
    if (match && method === route.method) {
      return {
        handler: route.handler,
        params: match.slice(1),
      };
    }
  }

  return null;
}

async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const match = matchRoute(url.pathname, req.method);

  if (!match) return notFound();

  const body = req.method === "POST" || req.method === "PUT" ? await parseBody(req) : null;
  let params = match.params
  if (params.length === 0) {
    params[0] = ''
  }
  return (match.handler as any)(...match.params, body);
}

// ==== Handlers ====

function listProjects(): Response {
  return json(Array.from(projects.values()));
}

function createProject(_: string, body: RequestBody): Response {
  const name = String(body?.name ?? "").trim();
  if (!name) return new Response("Missing project name", { status: 400 });

  const id = String(projectCounter++);
  const createdAt = new Date().toISOString();
  const project: Project = { id, name, createdAt };
  projects.set(id, project);
  return json(project, 201);
}

function getProject(projectId: string): Response {
  const project = projects.get(projectId);
  return project ? json(project) : notFound();
}

function updateProject(projectId: string, body: RequestBody): Response {
  if (!projects.has(projectId)) return notFound();

  const name = String(body?.name ?? "").trim();
  if (!name) return new Response("Missing project name", { status: 400 });

  const existing = projects.get(projectId)!;
  const updated: Project = { ...existing, name };
  projects.set(projectId, updated);
  return json(updated);
}

function deleteProject(projectId: string): Response {
  if (!projects.delete(projectId)) return notFound();
  return new Response(null, { status: 204 });
}

function listTodos(projectId: string): Response {
  if (!projects.has(projectId)) return notFound();
  const result = Array.from(todos.values()).filter(todo => todo.projectId === projectId);
  return json(result);
}

function listAllTodos(): Response {
  return json(Array.from(todos.values()));
}

function createTodo(projectId: string, body: RequestBody): Response {
  if (!projects.has(projectId)) return notFound();
  const title = String(body?.title ?? "").trim();
  if (!title) return new Response("Missing todo title", { status: 400 });

  const id = String(todoCounter++);
  const createdAt = new Date().toISOString();
  const todo: Todo = {
    id,
    projectId,
    title,
    completed: Boolean(body?.completed ?? false),
    dueDate: typeof body?.dueDate === "string" ? body.dueDate : null,
    createdAt,
  };
  todos.set(id, todo);
  return json(todo, 201);
}

function getTodo(todoId: string): Response {
  const todo = todos.get(todoId);
  return todo ? json(todo) : notFound();
}

function updateTodo(todoId: string, body: RequestBody): Response {
  if (!todos.has(todoId)) return notFound();
  const todo = todos.get(todoId)!;

  const updated: Todo = {
    ...todo,
    title: typeof body?.title === "string" ? body.title : todo.title,
    completed: typeof body?.completed === "boolean" ? body.completed : todo.completed,
    dueDate: typeof body?.dueDate === "string" ? body.dueDate : todo.dueDate,
  };

  todos.set(todoId, updated);
  return json(updated);
}

function deleteTodo(todoId: string): Response {
  if (!todos.delete(todoId)) return notFound();
  return new Response(null, { status: 204 });
}

// ==== Start Server ====

Bun.serve({
  port: 3000,
  fetch: handler,
});

console.log("🚀 Bun API server running at http://localhost:3000");
