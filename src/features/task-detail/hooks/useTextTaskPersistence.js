import { useCallback } from 'react';
import { createUpdatedTimestamp } from '../../pack/model/packMetadata';
import { normalizeTask } from '../../../lib/taskNormalize';

export const useTextTaskPersistence = ({ setTasks }) => {
  const handleSaveTextTask = useCallback((taskId, changes) => {
    const text = String(changes?.text || '');
    const title = String(changes?.title || '').trim() || null;
    const updatedAt = createUpdatedTimestamp();
    setTasks((currentTasks) => currentTasks.map((task) => (
      task.id === taskId
        ? normalizeTask({ ...task, text, title, updatedAt })
        : task
    )));
  }, [setTasks]);

  return {
    handleSaveTextTask,
  };
};
