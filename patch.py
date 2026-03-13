import re

def main():
    with open('src/App.jsx', 'r', encoding='utf-8') as f:
        content = f.read()

    # 1. Add imports
    content = content.replace("import { ChevronLeft, ArrowUp, Maximize2, Minimize2 } from 'lucide-react';",
        "import { ChevronLeft, ArrowUp, Maximize2, Minimize2 } from 'lucide-react';\n"
        "import { DndContext, DragOverlay, closestCorners, KeyboardSensor, PointerSensor, useSensor, useSensors, defaultDropAnimationSideEffects, useDroppable } from '@dnd-kit/core';\n"
        "import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';\n"
        "import { CSS } from '@dnd-kit/utilities';\n")
    
    # 2. Add Plus and X if needed (not in current App.jsx but script expects them)
    if "Plus" not in content and "lucide-react" in content:
         content = content.replace("from 'lucide-react';", ", Plus, X, ArrowDown } from 'lucide-react';")
    
    # 3. Insert SortableTask, TaskCardOverlay, DroppableSection, just before function App()
    new_components = """
function SortableTask({ todo, block, toggleTodo }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: todo.id,
    data: {
      type: 'Task',
      todo,
    }
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : 1,
    zIndex: isDragging ? 2 : 1,
  };

  const fallbackBlock = block || { accentColor: '#FF3B30' }; // Default for 'Now'

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`task-card ${todo.completed ? 'completed' : ''} ${isDragging ? 'dragging' : ''}`}
      {...attributes}
      {...listeners}
      onClick={(e) => {
        if (!isDragging) {
           toggleTodo(todo.id);
        }
      }}
    >
      <div className="task-icon-placeholder" style={{ backgroundColor: `${fallbackBlock.accentColor}20`, color: fallbackBlock.accentColor }}>
         <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
      </div>
      <div className="task-content">
        <span className="task-title">{todo.text}</span>
        <span className="task-desc">Action Item</span>
      </div>
    </div>
  );
}

function TaskCardOverlay({ todo, block }) {
  const fallbackBlock = block || { accentColor: '#FF3B30' }; // Default for 'Now'
  return (
    <div className={`task-card dragging`} style={{ cursor: 'grabbing', opacity: 0.9 }}>
      <div className="task-icon-placeholder" style={{ backgroundColor: `${fallbackBlock.accentColor}20`, color: fallbackBlock.accentColor }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
      </div>
      <div className="task-content">
        <span className="task-title">{todo.text}</span>
        <span className="task-desc">Action Item</span>
      </div>
    </div>
  );
}

function DroppableSection({ id, items, children }) {
  const { setNodeRef } = useDroppable({
    id: id,
    data: {
      type: 'Container',
    }
  });

  return (
    <div ref={setNodeRef} className="tasks-col" style={{ minHeight: '80px', transition: 'background-color 0.2sease' }}>
      <SortableContext items={items} strategy={verticalListSortingStrategy}>
        {children}
      </SortableContext>
    </div>
  );
}
"""
    content = content.replace("function App() {", new_components + "\nfunction App() {")

    # 4. Add drag and drop state and handlers in App
    dnd_state_and_handlers = """
  const [activeId, setActiveId] = useState(null);
  const [activeTodo, setActiveTodo] = useState(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragStart = (event) => {
    const { active } = event;
    const { id } = active;
    setActiveId(id);
    const todo = todos.find(t => t.id === id);
    if (todo) setActiveTodo(todo);
  };

  const handleDragOver = (event) => {
    const { active, over } = event;
    if (!over) return;
    
    const activeId = active.id;
    const overId = over.id;

    if (activeId === overId) return;

    const isActiveTask = active.data.current?.type === 'Task';
    const isOverTask = over.data.current?.type === 'Task';
    const isOverContainer = over.data.current?.type === 'Container';

    if (!isActiveTask) return;

    // Use a function update so we work with latest state
    setTodos((todosList) => {
      const activeIndex = todosList.findIndex((t) => t.id === activeId);
      if (activeIndex === -1) return todosList;
      
      const activeTodo = todosList[activeIndex];

      if (isOverTask) {
        const overIndex = todosList.findIndex((t) => t.id === overId);
        if (overIndex === -1) return todosList;

        if (todosList[activeIndex].timeOfDay !== todosList[overIndex].timeOfDay) {
            const newTodos = [...todosList];
            newTodos[activeIndex] = { ...newTodos[activeIndex], timeOfDay: todosList[overIndex].timeOfDay };
            return arrayMove(newTodos, activeIndex, overIndex);
        }
      } else if (isOverContainer) {
        if (todosList[activeIndex].timeOfDay !== overId) {
            const newTodos = [...todosList];
            newTodos[activeIndex] = { ...newTodos[activeIndex], timeOfDay: overId };
            return newTodos;
        }
      }
      return todosList;
    });
  };

  const handleDragEnd = (event) => {
    const { active, over } = event;
    
    if (over) {
      setTodos((todosList) => {
        const activeIndex = todosList.findIndex((t) => t.id === active.id);
        const overIndex = todosList.findIndex((t) => t.id === over.id);

        if (activeIndex !== -1 && overIndex !== -1 && activeIndex !== overIndex) {
            return arrayMove(todosList, activeIndex, overIndex);
        }
        return todosList;
      });
    }

    setActiveId(null);
    setActiveTodo(null);
  };

  const dropAnimation = {
    sideEffects: defaultDropAnimationSideEffects({
      styles: {
        active: {
          opacity: '0.4',
        },
      },
    }),
  };

  // Find active block for overlay
  const activeBlock = activeTodo ? timeBlocks.find(b => b.id === activeTodo.timeOfDay) : null;
"""
    # Insert after `const moveTodo = ... }`
    # Or just replace moveTodo completely
    import re
    content = re.sub(r'const moveTodo =.*?setTodos\(\[\.\.\.otherTodos, \.\.\.dateTodos\]\);\n  };', dnd_state_and_handlers, content, flags=re.DOTALL)

    # Wrap main in DndContext
    content = content.replace('<main className="timeline-area">', 
        '<DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={handleDragStart} onDragOver={handleDragOver} onDragEnd={handleDragEnd}><main className="timeline-area">')
    
    content = content.replace('      </main>', 
        '        <DragOverlay dropAnimation={dropAnimation}>\n'
        '          {activeId && activeTodo ? <TaskCardOverlay todo={activeTodo} block={activeBlock} /> : null}\n'
        '        </DragOverlay>\n'
        '      </main>\n'
        '      </DndContext>')

    # Substitute 'Now' rendering
    now_render_old = """        {selectedDateTodos.filter(t => t.timeOfDay === 'Now').length > 0 && (
          <div className="time-block">
            <div className="time-col">
              <div className="time-pill" style={{ backgroundColor: '#FF3B30', color: '#FFF' }}>Now</div>
            </div>
            <div className="tasks-col">
              {selectedDateTodos.filter(t => t.timeOfDay === 'Now').map(todo => (
                <div key={todo.id} className={`task-card ${todo.completed ? 'completed' : ''}`} onClick={() => toggleTodo(todo.id)}>
                  <div className="task-icon-placeholder" style={{ backgroundColor: '#FFECEB', color: '#FF3B30' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                  </div>
                  <div className="task-content">
                    <span className="task-title">{todo.text}</span>
                    <span className="task-desc">Action Item</span>
                  </div>
                  <div className="task-actions" onClick={(e) => e.stopPropagation()}>
                    <button className="move-btn" onClick={(e) => moveTodo(e, todo.id, 'up')}><ArrowUp size={14} /></button>
                    <button className="move-btn" onClick={(e) => moveTodo(e, todo.id, 'down')}><ArrowDown size={14} /></button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}"""
        
    now_render_new = """        {(() => {
          const nowTodos = selectedDateTodos.filter(t => t.timeOfDay === 'Now');
          if (nowTodos.length === 0 && !activeTodo?.timeOfDay === 'Now' && !isSheetOpen) return null; // We might want to keep it visible if dragging over it, but for simplicity let's stick to original behavior, or always render it if >0. Actually to support dragging to 'Now' even if empty, we might want to render it always if active. Let's just keep original logic: only if > 0.
          
          if (nowTodos.length > 0 || (activeTodo && activeTodo.timeOfDay === 'Now')) {
             return (
               <div className="time-block">
                <div className="time-col">
                  <div className="time-pill" style={{ backgroundColor: '#FF3B30', color: '#FFF' }}>Now</div>
                </div>
                <DroppableSection id="Now" items={nowTodos.map(t => t.id)}>
                  {nowTodos.map(todo => (
                     <SortableTask key={todo.id} todo={todo} block={{ accentColor: '#FF3B30' }} toggleTodo={toggleTodo} />
                  ))}
                </DroppableSection>
              </div>
             );
          }
          return null;
        })()}"""
    
    content = content.replace(now_render_old, now_render_new)
    
    # Also if the above string regex missed because of a small difference, try a more resilient replacement
    content = re.sub(r"\{\/\* Render 'Now' tasks at the top if any \*\/\}[\s\S]*?\{\/\* Render rest of the timeline blocks \*\/\}",
                     "{/* Render 'Now' tasks at the top if any */}\n" + now_render_new + "\n\n{/* Render rest of the timeline blocks */}", content)

    # Substitute time block rendering
    block_render_old = """              <div className="tasks-col">
                {blockTodos.map(todo => (
                  <div
                    key={todo.id}
                    className={`task-card ${todo.completed ? 'completed' : ''}`}
                    onClick={() => toggleTodo(todo.id)}
                  >
                    <div className="task-icon-placeholder" style={{ backgroundColor: `${block.accentColor}20`, color: block.accentColor }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                    </div>
                    <div className="task-content">
                      <span className="task-title">{todo.text}</span>
                      <span className="task-desc">Action Item</span>
                    </div>
                    <div className="task-actions" onClick={(e) => e.stopPropagation()}>
                      <button className="move-btn" onClick={(e) => moveTodo(e, todo.id, 'up')}><ArrowUp size={14} /></button>
                      <button className="move-btn" onClick={(e) => moveTodo(e, todo.id, 'down')}><ArrowDown size={14} /></button>
                    </div>
                  </div>
                ))}
              </div>"""
              
    block_render_new = """              <DroppableSection id={block.id} items={blockTodos.map(t => t.id)}>
                {blockTodos.map(todo => (
                   <SortableTask key={todo.id} todo={todo} block={block} toggleTodo={toggleTodo} />
                ))}
              </DroppableSection>"""
    
    content = content.replace(block_render_old, block_render_new)
    
    with open('src/App.jsx', 'w', encoding='utf-8') as f:
        f.write(content)

if __name__ == "__main__":
    main()
