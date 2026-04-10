export const createTaskEditActions = ({ openTaskEditor }) => ({
  openTaskEditor: (task) => {
    if (!task) return null;
    openTaskEditor(task);
    return 'edit';
  },
});
