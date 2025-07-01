import { SignJWT } from "jose";

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

type HandlerArgs = {
  req: Request;
  body: RequestBody;
  params: string[];
};

type Route = {
  method: 'GET' | 'POST' | 'DELETE' | 'PUT';
  path: RegExp;
  handler: (handleArgs: HandlerArgs) => any;
  name?: string;
}

const projects = new Map<string, Project>();
const todos = new Map<string, Todo>();

let projectCounter = 1;
let todoCounter = 1;
let validJwts = new Map<string, number>();

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

function matchRoute(path: string, method: string): any {
  const routes: Route[] = [
    { method: "GET", path: /\/$/, handler: () => {
      return json({})
    }},
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

    { method: "POST", path: /^\/login$/, name: 'login', handler: login },
  ];

  for (const route of routes) {
    const match = path.match(route.path);
    if (match && method === route.method) {
      return {
        handler: route.handler,
        name: route.name,
        params: match.slice(1),
      };
    }
  }

  return null;
}

async function authHandler(req: Request): Promise<Response> {
  const authHeader = req.headers.get("authorization");

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return json({ error: "Missing Authorization header" }, 401);
  }

  const token = authHeader.slice("Bearer ".length);
  const expMs = validJwts.get(token);
  const now = Date.now();

  if (!expMs || expMs < now) {
    return json({ error: "Invalid token" }, 401);
  }

  return json({
    message: 'Token is valid'
  }, 200);
}

async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const match = matchRoute(url.pathname, req.method);

  if (!match) return notFound();


  console.log({
    match
  })
  if (match.name !== 'login') {
    const auth = await authHandler(req);
    if (auth.status !== 200) return auth;
  }

  const body = req.method === "POST" || req.method === "PUT" ? await parseBody(req) : null;
  const params = match.params;
  return match.handler({ req, body, params });
}

// ==== Handlers ====

function listProjects(): Response {
  return json(Array.from(projects.values()));
}

function createProject({ body }: HandlerArgs): Response {
  const name = String(body?.name ?? "").trim();
  if (!name) return new Response("Missing project name", { status: 400 });

  const id = String(projectCounter++);
  const createdAt = new Date().toISOString();
  const project: Project = { id, name, createdAt };
  projects.set(id, project);
  return json(project, 201);
}

function getProject({ params }: HandlerArgs): Response {
  const [projectId] = params;
  const project = projects.get(projectId);
  return project ? json(project) : notFound();
}

function updateProject({ params, body }: HandlerArgs): Response {
  const [projectId] = params;
  if (!projects.has(projectId)) return notFound();

  const name = String(body?.name ?? "").trim();
  if (!name) return new Response("Missing project name", { status: 400 });

  const existing = projects.get(projectId)!;
  const updated: Project = { ...existing, name };
  projects.set(projectId, updated);
  return json(updated);
}

function deleteProject({ params }: HandlerArgs): Response {
  const [projectId] = params;
  if (!projects.delete(projectId)) return notFound();
  return new Response(null, { status: 204 });
}

function listTodos({ params }: HandlerArgs): Response {
  const [projectId] = params;
  if (!projects.has(projectId)) return notFound();
  const result = Array.from(todos.values()).filter(todo => todo.projectId === projectId);
  return json(result);
}

function listAllTodos(): Response {
  return json(Array.from(todos.values()));
}

function createTodo({ params, body }: HandlerArgs): Response {
  const [projectId] = params;
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

function getTodo({ params }: HandlerArgs): Response {
  const [todoId] = params;
  const todo = todos.get(todoId);
  return todo ? json(todo) : notFound();
}

function updateTodo({ params, body }: HandlerArgs): Response {
  const [todoId] = params;
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

function deleteTodo({ params }: HandlerArgs): Response {
  const [todoId] = params;
  if (!todos.delete(todoId)) return notFound();
  return new Response(null, { status: 204 });
}

const JWT_SECRET = new TextEncoder().encode("hunter2"); // 🔐 replace in prod
const USERNAME = 'admin';
const PASSWORD = 'hunter2'; // 🔐 replace in prod

async function login({ req }: HandlerArgs): Promise<Response> {
  const authHeader = req.headers.get("authorization");

  if (!authHeader || !authHeader.startsWith("Basic ")) {
    return json({ error: "Missing Authorization header" }, 401);
  }

  const base64 = authHeader.slice("Basic ".length);
  const decoded = atob(base64);
  const [username, password] = decoded.split(":");

  if (username !== USERNAME || password !== PASSWORD) {
    return json({ error: "Invalid credentials" }, 401);
  }

  const now = Math.floor(Date.now() / 1000);
  const exp = now + 60 * 60; // 1 hour in seconds
  const jwt = await new SignJWT({ sub: username, role: "user" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt(now)
    .setExpirationTime(exp)
    .sign(JWT_SECRET);
  const expMs = exp * 1000;

  validJwts.set(jwt, expMs);

  return json({ token: jwt, expMs });
}
const PORT = 3000
// ==== Start Server ====

Bun.serve({
  port: PORT,
  fetch: handler,
});

console.log(`🚀 Bun API server running at http://localhost:${PORT}`);
