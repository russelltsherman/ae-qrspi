// The task domain: an in-memory list of tasks. No persistence and no search yet —
// those gaps are where QRSPI features land.

let nextId = 1;
const TASKS = [];

export function addTask(text) {
  const task = { id: nextId++, text, createdAt: "1970-01-01T00:00:00.000Z" };
  TASKS.push(task);
  return task;
}

export function listTasks() {
  return TASKS.slice();
}
