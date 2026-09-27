'use strict';

const STORAGE_KEY = 'todos.v1';
const MAX_LENGTH = 200;

const els = {
  form: document.getElementById('composer'),
  input: document.getElementById('new-todo'),
  list: document.getElementById('todo-list'),
  empty: document.getElementById('empty-state'),
  summary: document.getElementById('summary'),
  clear: document.getElementById('clear-completed'),
  filters: Array.from(document.querySelectorAll('.filter')),
};

let todos = loadTodos();
let filter = 'all';

function newId() {
  if (window.crypto && typeof window.crypto.randomUUID === 'function') {
    return window.crypto.randomUUID();
  }
  return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
}

function loadTodos() {
  let raw;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch (error) {
    console.warn('无法读取本地存储，本次改动不会保存。', error);
    return [];
  }
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item) => item && typeof item.text === 'string')
      .map((item) => ({
        id: typeof item.id === 'string' ? item.id : newId(),
        text: item.text.slice(0, MAX_LENGTH),
        done: Boolean(item.done),
      }));
  } catch (error) {
    console.warn('本地存储中的数据已损坏，已重新开始。', error);
    return [];
  }
}

function saveTodos() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(todos));
  } catch (error) {
    console.warn('无法写入本地存储。', error);
  }
}

function visibleTodos() {
  if (filter === 'active') return todos.filter((todo) => !todo.done);
  if (filter === 'completed') return todos.filter((todo) => todo.done);
  return todos;
}

function emptyMessage() {
  if (todos.length === 0) return '列表还是空的，先添加一条吧。';
  if (filter === 'active') return '没有未完成的任务，全部搞定 🎉';
  if (filter === 'completed') return '还没有完成的任务。';
  return '列表还是空的，先添加一条吧。';
}

function createItem(todo) {
  const li = document.createElement('li');
  li.className = 'todo-item' + (todo.done ? ' is-done' : '');
  li.dataset.id = todo.id;

  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.className = 'todo-item__checkbox';
  checkbox.checked = todo.done;
  checkbox.dataset.action = 'toggle';
  checkbox.setAttribute('aria-label', `${todo.done ? '标记为未完成' : '标记为已完成'}：${todo.text}`);

  const text = document.createElement('span');
  text.className = 'todo-item__text';
  text.textContent = todo.text;
  text.title = '双击可编辑';

  const remove = document.createElement('button');
  remove.type = 'button';
  remove.className = 'todo-item__delete';
  remove.dataset.action = 'delete';
  remove.textContent = '删除';
  remove.setAttribute('aria-label', `删除：${todo.text}`);

  li.append(checkbox, text, remove);
  return li;
}

function render() {
  const visible = visibleTodos();

  els.list.replaceChildren(...visible.map(createItem));

  const remaining = todos.filter((todo) => !todo.done).length;
  if (todos.length === 0) {
    els.summary.textContent = '还没有任务';
  } else if (remaining === 0) {
    els.summary.textContent = `共 ${todos.length} 条，全部已完成`;
  } else {
    els.summary.textContent = `共 ${todos.length} 条，还有 ${remaining} 条未完成`;
  }

  const empty = els.empty;
  empty.textContent = emptyMessage();
  empty.hidden = visible.length > 0;

  els.clear.disabled = todos.every((todo) => !todo.done);
  els.filters.forEach((button) => {
    button.setAttribute('aria-pressed', String(button.dataset.filter === filter));
  });
}

function addTodo(text) {
  const value = text.trim().slice(0, MAX_LENGTH);
  if (!value) return;
  todos.unshift({ id: newId(), text: value, done: false });
  saveTodos();
  render();
}

function toggleTodo(id) {
  const todo = todos.find((item) => item.id === id);
  if (!todo) return;
  todo.done = !todo.done;
  saveTodos();
  render();
}

function deleteTodo(id) {
  todos = todos.filter((todo) => todo.id !== id);
  saveTodos();
  render();
}

function startEdit(li, id) {
  const todo = todos.find((item) => item.id === id);
  if (!todo) return;

  const text = li.querySelector('.todo-item__text');
  if (!text) return;

  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'todo-item__edit';
  input.value = todo.text;
  input.maxLength = MAX_LENGTH;
  input.setAttribute('aria-label', '编辑任务内容');

  let settled = false;
  const finish = (keepEdit) => {
    if (settled) return;
    settled = true;
    const value = input.value.trim();
    if (keepEdit && value && value !== todo.text) {
      todo.text = value;
      saveTodos();
    }
    render();
  };

  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      finish(true);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      finish(false);
    }
  });
  input.addEventListener('blur', () => finish(true));

  li.replaceChild(input, text);
  input.focus();
  input.select();
}

els.form.addEventListener('submit', (event) => {
  event.preventDefault();
  addTodo(els.input.value);
  els.input.value = '';
  els.input.focus();
});

els.list.addEventListener('change', (event) => {
  const checkbox = event.target.closest('[data-action="toggle"]');
  if (!checkbox) return;
  const li = checkbox.closest('.todo-item');
  if (li) toggleTodo(li.dataset.id);
});

els.list.addEventListener('click', (event) => {
  const button = event.target.closest('[data-action="delete"]');
  if (!button) return;
  const li = button.closest('.todo-item');
  if (li) deleteTodo(li.dataset.id);
});

els.list.addEventListener('dblclick', (event) => {
  const text = event.target.closest('.todo-item__text');
  if (!text) return;
  const li = text.closest('.todo-item');
  if (li) startEdit(li, li.dataset.id);
});

els.filters.forEach((button) => {
  button.addEventListener('click', () => {
    filter = button.dataset.filter;
    render();
  });
});

els.clear.addEventListener('click', () => {
  todos = todos.filter((todo) => !todo.done);
  saveTodos();
  render();
});

render();