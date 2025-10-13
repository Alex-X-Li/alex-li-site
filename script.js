// Window management
let zIndex = 100;
let draggedWindow = null;
let offsetX = 0;
let offsetY = 0;
let resizingWindow = null;
let resizeStartWidth = 0;
let resizeStartHeight = 0;
let resizeStartX = 0;
let resizeStartY = 0;
let resizeMinWidth = 0;
let resizeMinHeight = 0;
const TASKBAR_HEIGHT = 32;

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    initializeDesktopIcons();
    initializeFolderShortcuts();
    initializeWindows();
    initializeTaskbar();
    initializeStartMenu();
    registerOpenWindows();
    updateClock();
    setInterval(updateClock, 1000);
});

// Desktop icons
function initializeDesktopIcons() {
    const icons = document.querySelectorAll('.desktop-icon');
    const desktop = document.querySelector('.desktop');

    icons.forEach(icon => {
        icon.addEventListener('click', (e) => {
            e.stopPropagation();

            // Deselect all icons
            icons.forEach(i => i.classList.remove('selected'));

            // Select clicked icon
            icon.classList.add('selected');
        });

        icon.addEventListener('dblclick', () => {
            const windowId = icon.getAttribute('data-window');
            openWindow(windowId);
        });

        icon.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                const windowId = icon.getAttribute('data-window');
                openWindow(windowId);
            }
        });
    });

    // Deselect icons when clicking desktop
    if (desktop) {
        desktop.addEventListener('click', () => {
            icons.forEach(i => i.classList.remove('selected'));
        });
    }
}

function initializeFolderShortcuts() {
    const shortcuts = document.querySelectorAll('.folder-icon[data-window]');
    shortcuts.forEach(item => {
        const target = item.getAttribute('data-window');
        if (!target) {
            return;
        }

        item.addEventListener('dblclick', () => {
            openWindow(target);
        });

        item.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                openWindow(target);
            }
        });
    });
}

// Window operations
function initializeWindows() {
    const windows = document.querySelectorAll('.window');

    windows.forEach(win => {
        if (win.querySelector('.status-bar')) {
            win.classList.add('has-status-bar');
        }

        const titleBar = win.querySelector('.title-bar');
        const closeBtn = win.querySelector('.close-btn');
        const minimizeBtn = win.querySelector('.minimize-btn');
        const maximizeBtn = win.querySelector('.maximize-btn');
    const state = win._windowState || { isMaximized: false, originalStyle: {} };
        win._windowState = state;
        win.dataset.maximized = state.isMaximized ? 'true' : 'false';
        if (state.isMaximized) {
            win.classList.add('maximized');
        } else {
            win.classList.remove('maximized');
        }

        // Center window initially
        centerWindow(win);

        // Dragging
        titleBar.addEventListener('mousedown', (e) => {
            if (e.target.closest('.title-bar-controls')) return;

            startDrag(win, e);
        });

        // Bring to front on click
        win.addEventListener('mousedown', () => {
            bringToFront(win);
        });

        // Close button
        closeBtn.addEventListener('click', () => {
            closeWindow(win.id);
        });

        // Minimize button
        minimizeBtn.addEventListener('click', () => {
            minimizeWindow(win.id);
        });

        // Maximize button (toggle)
        maximizeBtn.addEventListener('click', () => {
            if (!state.isMaximized) {
                state.originalStyle = {
                    left: win.style.left,
                    top: win.style.top,
                    width: win.style.width,
                    height: win.style.height
                };

                win.style.left = '0';
                win.style.top = '0';
                win.style.width = '100%';
                win.style.height = `calc(100vh - ${TASKBAR_HEIGHT}px)`;
                state.isMaximized = true;
                win.dataset.maximized = 'true';
                win.classList.add('maximized');
            } else {
                win.style.left = state.originalStyle.left;
                win.style.top = state.originalStyle.top;
                win.style.width = state.originalStyle.width;
                win.style.height = state.originalStyle.height;
                state.isMaximized = false;
                win.dataset.maximized = 'false';
                win.classList.remove('maximized');
            }
        });

        const resizeHandle = document.createElement('div');
        resizeHandle.className = 'resize-handle';
        resizeHandle.setAttribute('aria-hidden', 'true');
        win.appendChild(resizeHandle);

        resizeHandle.addEventListener('mousedown', (e) => {
            e.preventDefault();
            e.stopPropagation();
            startResize(win, e);
        });
    });

    // Global mouse events for dragging
    document.addEventListener('mousemove', onDrag);
    document.addEventListener('mouseup', stopDrag);
    document.addEventListener('mousemove', onResize);
    document.addEventListener('mouseup', stopResize);
}

function registerOpenWindows() {
    const windows = document.querySelectorAll('.window');

    windows.forEach(win => {
        if (!win.id) {
            return;
        }

        if (win.style.display === 'none') {
            return;
        }

        addTaskbarTask(win.id);

        if (win.dataset.initial === 'true') {
            bringToFront(win);
        }
    });
}

function centerWindow(win) {
    const targetWidth = parseInt(win.dataset.width, 10) || 480;
    const targetHeight = parseInt(win.dataset.height, 10) || 360;

    if (!win.style.width) {
        win.style.width = `${targetWidth}px`;
    }

    if (!win.style.height) {
        win.style.height = `${targetHeight}px`;
    }

    const currentWidth = parseInt(win.style.width, 10) || targetWidth;
    const currentHeight = parseInt(win.style.height, 10) || targetHeight;

    const left = Math.max(0, (window.innerWidth - currentWidth) / 2);
    const top = Math.max(0, (window.innerHeight - currentHeight - TASKBAR_HEIGHT) / 2);

    win.style.left = `${left}px`;
    win.style.top = `${top}px`;
}

function openWindow(windowId) {
    const win = document.getElementById(windowId);
    if (!win) return;

    closeStartMenu();
 
    win.style.display = 'flex';
    addTaskbarTask(windowId);
    bringToFront(win);
}

function closeWindow(windowId) {
    const win = document.getElementById(windowId);
    if (!win) return;

    win.style.display = 'none';
    removeTaskbarTask(windowId);
}

function minimizeWindow(windowId) {
    const win = document.getElementById(windowId);
    if (!win) return;

    win.style.display = 'none';
    const task = document.querySelector(`[data-window-id="${windowId}"]`);
    if (task) {
        task.classList.remove('active');
    }
}

function bringToFront(win) {
    zIndex++;
    win.style.zIndex = zIndex;

    // Update active states
    document.querySelectorAll('.window').forEach(w => {
        w.classList.remove('active');
    });
    win.classList.add('active');

    // Update taskbar active state
    document.querySelectorAll('.taskbar-task').forEach(task => {
        task.classList.remove('active');
    });
    const taskbarTask = document.querySelector(`[data-window-id="${win.id}"]`);
    if (taskbarTask) {
        taskbarTask.classList.add('active');
    }
}

function startDrag(win, e) {
    draggedWindow = win;
    offsetX = e.clientX - win.offsetLeft;
    offsetY = e.clientY - win.offsetTop;
    bringToFront(win);
}

function onDrag(e) {
    if (!draggedWindow) return;

    const x = e.clientX - offsetX;
    const y = e.clientY - offsetY;

    // Keep window within bounds
    const maxX = window.innerWidth - draggedWindow.offsetWidth;
    const maxY = window.innerHeight - TASKBAR_HEIGHT - draggedWindow.offsetHeight;

    draggedWindow.style.left = `${Math.max(0, Math.min(x, maxX))}px`;
    draggedWindow.style.top = `${Math.max(0, Math.min(y, maxY))}px`;
}

function stopDrag() {
    draggedWindow = null;
}

function startResize(win, e) {
    if (e.button !== 0) {
        return;
    }

    const state = win._windowState;
    if (state?.isMaximized) {
        return;
    }

    resizingWindow = win;
    resizeStartWidth = win.offsetWidth;
    resizeStartHeight = win.offsetHeight;
    resizeStartX = e.clientX;
    resizeStartY = e.clientY;

    const computedStyle = window.getComputedStyle(win);
    resizeMinWidth = parseInt(computedStyle.minWidth, 10) || 320;
    resizeMinHeight = parseInt(computedStyle.minHeight, 10) || 220;

    if (state) {
        state.isMaximized = false;
        win.dataset.maximized = 'false';
        win.classList.remove('maximized');
    }

    draggedWindow = null;
    bringToFront(win);
}

function onResize(e) {
    if (!resizingWindow) {
        return;
    }

    const dx = e.clientX - resizeStartX;
    const dy = e.clientY - resizeStartY;

    const maxWidth = window.innerWidth - resizingWindow.offsetLeft;
    const maxHeight = window.innerHeight - TASKBAR_HEIGHT - resizingWindow.offsetTop;

    const newWidth = Math.max(resizeMinWidth, Math.min(resizeStartWidth + dx, maxWidth));
    const newHeight = Math.max(resizeMinHeight, Math.min(resizeStartHeight + dy, maxHeight));

    resizingWindow.style.width = `${newWidth}px`;
    resizingWindow.style.height = `${newHeight}px`;
}

function stopResize() {
    resizingWindow = null;
}

// Taskbar
function initializeTaskbar() {
    // Taskbar task clicks
    document.addEventListener('click', (e) => {
        if (e.target.closest('.taskbar-task')) {
            const task = e.target.closest('.taskbar-task');
            const windowId = task.getAttribute('data-window-id');
            const win = document.getElementById(windowId);

            closeStartMenu();

            if (win.style.display === 'none') {
                win.style.display = 'block';
                bringToFront(win);
            } else if (win.classList.contains('active')) {
                win.style.display = 'none';
                task.classList.remove('active');
            } else {
                bringToFront(win);
            }
        }
    });
}

function addTaskbarTask(windowId) {
    const existingTask = document.querySelector(`[data-window-id="${windowId}"]`);
    if (existingTask) {
        existingTask.classList.add('active');
        return;
    }

    const win = document.getElementById(windowId);
    if (!win) {
        return;
    }

    const titleElement = win.querySelector('.title-bar-text span') || win.querySelector('.title-bar-text');
    const title = titleElement ? titleElement.textContent.trim() : windowId;
    const icon = win.dataset.icon || win.querySelector('.title-bar-text img')?.getAttribute('src');

    const taskbar = document.getElementById('taskbar-tasks');
    const task = document.createElement('button');
    task.className = 'taskbar-task active';
    task.setAttribute('data-window-id', windowId);
    task.title = title;

    if (icon) {
        const img = document.createElement('img');
        img.src = icon;
        img.alt = '';
        img.width = 16;
        img.height = 16;
        img.setAttribute('aria-hidden', 'true');
        task.appendChild(img);
    }

    const label = document.createElement('span');
    label.textContent = title;
    task.appendChild(label);

    taskbar.appendChild(task);
}

function removeTaskbarTask(windowId) {
    const task = document.querySelector(`[data-window-id="${windowId}"]`);
    if (task) {
        task.remove();
    }
}

// Start Menu
function initializeStartMenu() {
    const startButton = document.querySelector('.start-button');
    const startMenu = document.getElementById('start-menu');

    if (!startButton || !startMenu) {
        return;
    }

    startButton.setAttribute('aria-expanded', 'false');

    startButton.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleStartMenu();
    });

    startMenu.addEventListener('click', (e) => {
        e.stopPropagation();
    });

    // Close start menu when clicking outside
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.start-menu') && !e.target.closest('.start-button')) {
            closeStartMenu();
        }
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeStartMenu();
        }
    });

    const windowButtons = startMenu.querySelectorAll('[data-window]');
    windowButtons.forEach(button => {
        button.addEventListener('click', () => {
            const target = button.getAttribute('data-window');
            openWindow(target);
        });
    });

    const shutdownButton = startMenu.querySelector('[data-action="shutdown"]');
    if (shutdownButton) {
        shutdownButton.addEventListener('click', () => {
            if (confirm('Are you sure you want to shut down?')) {
                document.body.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100vh;background:#000;color:#fff;font-size:24px;">It\'s now safe to turn off your computer.</div>';
            } else {
                closeStartMenu();
            }
        });
    }
}

function toggleStartMenu() {
    const startMenu = document.getElementById('start-menu');
    const startButton = document.querySelector('.start-button');

    if (!startMenu || !startButton) {
        return;
    }

    if (startMenu.style.display === 'none' || !startMenu.style.display) {
        startMenu.style.display = 'block';
        startButton.classList.add('active');
        startButton.setAttribute('aria-expanded', 'true');
    } else {
        startMenu.style.display = 'none';
        startButton.classList.remove('active');
        startButton.setAttribute('aria-expanded', 'false');
    }
}

function closeStartMenu() {
    const startMenu = document.getElementById('start-menu');
    const startButton = document.querySelector('.start-button');

    if (!startMenu || !startButton) {
        return;
    }

    startMenu.style.display = 'none';
    startButton.classList.remove('active');
    startButton.setAttribute('aria-expanded', 'false');
}

// Clock
function updateClock() {
    const clock = document.getElementById('clock');
    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes().toString().padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;

    clock.textContent = `${displayHours}:${minutes} ${ampm}`;
}
