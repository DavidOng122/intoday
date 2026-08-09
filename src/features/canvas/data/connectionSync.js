export const drainConnectionOperations = async (operations, execute) => {
  const queue = Array.isArray(operations) ? operations : [];
  for (let index = 0; index < queue.length; index += 1) {
    try {
      await execute(queue[index]);
    } catch (error) {
      return { completed: index, remaining: queue.slice(index), error };
    }
  }
  return { completed: queue.length, remaining: [], error: null };
};
