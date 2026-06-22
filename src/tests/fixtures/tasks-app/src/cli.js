// A thin CLI over the task store: `add <text>` and `list`. No search/filter exists yet.
import { addTask, listTasks } from "./store.js";

export function run(argv) {
  const [cmd, ...rest] = argv;
  if (cmd === "add") {
    const task = addTask(rest.join(" "));
    return `added #${task.id}`;
  }
  if (cmd === "list") {
    return listTasks().map((t) => `#${t.id} ${t.text}`).join("\n");
  }
  return "usage: add <text> | list";
}

if (import.meta.url === `file://${process.argv[1]}`) {
  process.stdout.write(run(process.argv.slice(2)) + "\n");
}
