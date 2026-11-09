// Desfazer e refazer: guarda "fotografias" do card (em texto) a cada mudança.

export function createHistory(limit = 100) {
  let stack = [];
  let at = -1;
  return {
    reset(state) {
      stack = [state];
      at = 0;
    },
    push(state) {
      if (stack[at] === state) return false;
      stack = stack.slice(0, at + 1);
      stack.push(state);
      if (stack.length > limit) stack.shift();
      at = stack.length - 1;
      return true;
    },
    undo() {
      if (at <= 0) return null;
      at--;
      return stack[at];
    },
    redo() {
      if (at >= stack.length - 1) return null;
      at++;
      return stack[at];
    },
    canUndo: () => at > 0,
    canRedo: () => at < stack.length - 1,
  };
}
