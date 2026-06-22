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
let lastOpenedWindowId = null;
const TASKBAR_HEIGHT = 32;
const WINDOW_CASCADE_OFFSET = 24;
const WALLPAPER_PATH = 'wallpaper/';
const MANIFEST_URL = `${WALLPAPER_PATH}manifest.json`;
const DEFAULT_WALLPAPER = 'v_island.png'; // Fallback if manifest fails

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    setRandomWallpaper();
    initializeDesktopIcons();
    initializeFolderShortcuts();
    initializeWindows();
    initializeExplorerChrome();
    initializeStatusBars();
    initializeTaskbar();
    initializeStartMenu();
    registerOpenWindows();
    openWindowFromUrl();
    updateClock();
    setInterval(updateClock, 1000);
});

function setRandomWallpaper() {
    // Fetch manifest.json which lists available wallpapers.
    // To add new wallpapers: 
    // 1. Add image files to wallpaper/ folder
    // 2. Run: npm run generate:wallpaper-manifest
    // Or manually edit wallpaper/manifest.json
    fetch(MANIFEST_URL, { cache: 'no-store' })
        .then(resp => {
            if (!resp.ok) throw new Error('Manifest not found');
            return resp.json();
        })
        .then(list => {
            if (!Array.isArray(list) || list.length === 0) throw new Error('Invalid manifest');
            
            // Support both string format (legacy) and object format (with artist/location info)
            const filtered = list.filter(item => {
                if (typeof item === 'string') return item.trim();
                if (typeof item === 'object' && item.filename) return item.filename.trim();
                return false;
            });
            
            if (filtered.length === 0) throw new Error('No valid entries in manifest');
            const idx = Math.floor(Math.random() * filtered.length);
            const selected = filtered[idx];
            
            // Handle both string and object format
            const filename = typeof selected === 'string' ? selected : selected.filename;
            const artist = typeof selected === 'object' ? selected.artist : '';
            const location = typeof selected === 'object' ? selected.location : '';
            
            document.body.style.backgroundImage = `url('${WALLPAPER_PATH}${filename}')`;
            updateArtistAttribution(artist, location);
        })
        .catch(() => {
            // Fallback to default wallpaper
            document.body.style.backgroundImage = `url('${WALLPAPER_PATH}${DEFAULT_WALLPAPER}')`;
            updateArtistAttribution('', '');
        });
}

function updateArtistAttribution(artist, location) {
    // Remove existing attribution if present
    let attribution = document.querySelector('.wallpaper-attribution');
    
    // Determine what text to show
    let text = '';
    if (location && location.trim()) {
        text = `Photo taken at ${location}`;
    } else if (artist && artist.trim()) {
        text = `Art by ${artist}`;
    }
    
    if (text) {
        if (!attribution) {
            attribution = document.createElement('div');
            attribution.className = 'wallpaper-attribution';
            document.body.appendChild(attribution);
        }
        attribution.textContent = text;
        attribution.style.display = 'block';
    } else {
        if (attribution) {
            attribution.style.display = 'none';
        }
    }
}

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
        win.dataset.opened = 'true';
        lastOpenedWindowId = win.id;

        if (win.dataset.initial === 'true') {
            bringToFront(win);
        }
    });
}

function centerWindow(win) {
    const targetWidth = parseInt(win.dataset.width, 10) || 480;
    const targetHeight = parseInt(win.dataset.height, 10) || 360;
    const isDesktopViewport = window.innerWidth >= 769;
    const viewportPadding = isDesktopViewport ? 32 : 16;
    const maxInitialWidth = Math.max(320, window.innerWidth - viewportPadding);
    const maxInitialHeight = Math.max(220, window.innerHeight - TASKBAR_HEIGHT - viewportPadding);
    const desktopWidth = Math.round(window.innerWidth * 0.5);
    const desktopHeight = Math.round((window.innerHeight - TASKBAR_HEIGHT) * 0.8);
    const initialWidth = Math.min(Math.max(targetWidth, isDesktopViewport ? desktopWidth : targetWidth), maxInitialWidth);
    const initialHeight = Math.min(Math.max(targetHeight, isDesktopViewport ? desktopHeight : targetHeight), maxInitialHeight);

    if (!win.style.width) {
        win.style.width = `${initialWidth}px`;
    }

    if (!win.style.height) {
        win.style.height = `${initialHeight}px`;
    }

    const currentWidth = parseInt(win.style.width, 10) || initialWidth;
    const currentHeight = parseInt(win.style.height, 10) || initialHeight;

    const left = Math.max(0, (window.innerWidth - currentWidth) / 2);
    const top = Math.max(0, (window.innerHeight - currentHeight - TASKBAR_HEIGHT) / 2);

    win.style.left = `${left}px`;
    win.style.top = `${top}px`;
}

function offsetWindowFromPrevious(win) {
    if (!lastOpenedWindowId || lastOpenedWindowId === win.id) {
        return;
    }

    const previousWindow = document.getElementById(lastOpenedWindowId);
    if (!previousWindow || previousWindow.style.display === 'none') {
        return;
    }

    const previousLeft = parseFloat(previousWindow.style.left) || 0;
    const previousTop = parseFloat(previousWindow.style.top) || 0;
    const width = win.offsetWidth || parseInt(win.style.width, 10) || parseInt(win.dataset.width, 10) || 480;
    const height = win.offsetHeight || parseInt(win.style.height, 10) || parseInt(win.dataset.height, 10) || 360;
    const maxLeft = Math.max(0, window.innerWidth - width);
    const maxTop = Math.max(0, window.innerHeight - TASKBAR_HEIGHT - height);
    const left = Math.min(previousLeft + WINDOW_CASCADE_OFFSET, maxLeft);
    const top = Math.min(previousTop + WINDOW_CASCADE_OFFSET, maxTop);

    win.style.left = `${left}px`;
    win.style.top = `${top}px`;
}

function openWindow(windowId) {
    const win = document.getElementById(windowId);
    if (!win) return;

    closeStartMenu();

    const isFirstOpen = win.dataset.opened !== 'true';
    win.style.display = 'flex';
    if (isFirstOpen) {
        offsetWindowFromPrevious(win);
        win.dataset.opened = 'true';
    }

    addTaskbarTask(windowId);
    bringToFront(win);
    lastOpenedWindowId = windowId;
}

function openWindowFromUrl() {
    const params = new URLSearchParams(window.location.search);
    const windowId = params.get('open');

    if (!windowId) {
        return;
    }

    openWindow(windowId);
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

// Explorer chrome
function initializeExplorerChrome() {
    document.querySelectorAll('.window').forEach(win => {
        if (win.id === 'internet' || win.querySelector('.explorer-toolbar')) {
            return;
        }

        win.querySelectorAll('.toolbar:not(.explorer-toolbar), .address-bar:not(.explorer-address-bar)').forEach(element => {
            element.remove();
        });

        const anchor = win.querySelector('.menu-bar') || win.querySelector('.title-bar');
        if (!anchor) {
            return;
        }

        anchor.insertAdjacentElement('afterend', createExplorerAddressBar(win));
        anchor.insertAdjacentElement('afterend', createStandardExplorerToolbar());
    });
}

function createStandardExplorerToolbar() {
    const toolbar = document.createElement('div');
    toolbar.className = 'toolbar explorer-toolbar standard-explorer-toolbar';
    toolbar.setAttribute('aria-label', 'Explorer toolbar');

    toolbar.appendChild(createToolbarGripper());
    toolbar.appendChild(createExplorerButton('Back', 'back', { muted: true, caret: true }));
    toolbar.appendChild(createExplorerButton('Forward', 'forward', { muted: true, caret: true }));
    toolbar.appendChild(createExplorerButton('Up', 'up'));
    toolbar.appendChild(createToolbarSeparator());
    toolbar.appendChild(createExplorerButton('Cut', 'cut'));
    toolbar.appendChild(createExplorerButton('Copy', 'copy'));
    toolbar.appendChild(createExplorerButton('Paste', 'paste'));
    toolbar.appendChild(createToolbarSeparator());
    toolbar.appendChild(createExplorerButton('Undo', 'undo'));
    toolbar.appendChild(createToolbarSeparator());
    toolbar.appendChild(createExplorerButton('Delete', 'delete'));
    toolbar.appendChild(createExplorerButton('Properties', 'properties'));
    toolbar.appendChild(createToolbarSeparator());
    toolbar.appendChild(createExplorerButton('Views', 'views', { caret: true }));

    return toolbar;
}

function createExplorerButton(label, icon, options = {}) {
    const button = document.createElement('button');
    button.className = `toolbar-btn explorer-toolbar-btn${options.muted ? ' is-muted' : ''}`;
    button.type = 'button';

    const iconElement = document.createElement('span');
    iconElement.className = `toolbar-icon toolbar-icon--${icon}`;
    iconElement.setAttribute('aria-hidden', 'true');
    button.appendChild(iconElement);

    const labelElement = document.createElement('span');
    labelElement.className = 'toolbar-label';
    labelElement.textContent = label;
    button.appendChild(labelElement);

    if (options.caret) {
        button.appendChild(createToolbarCaret());
    }

    return button;
}

function createToolbarGripper() {
    const gripper = document.createElement('div');
    gripper.className = 'toolbar-gripper';
    gripper.setAttribute('aria-hidden', 'true');
    return gripper;
}

function createToolbarSeparator() {
    const separator = document.createElement('span');
    separator.className = 'toolbar-separator';
    separator.setAttribute('aria-hidden', 'true');
    return separator;
}

function createToolbarCaret() {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.classList.add('toolbar-caret');
    svg.setAttribute('width', '16');
    svg.setAttribute('height', '16');
    svg.setAttribute('viewBox', '0 0 16 16');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');

    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('style', 'transform:rotate(90deg);transform-origin:center');
    path.setAttribute('d', 'm6 4 4 4-4 4z');
    svg.appendChild(path);

    return svg;
}

function createExplorerAddressBar(win) {
    const addressBar = document.createElement('div');
    addressBar.className = 'address-bar explorer-address-bar';

    addressBar.appendChild(createToolbarGripper());

    const label = document.createElement('label');
    label.textContent = 'Address';
    addressBar.appendChild(label);

    const icon = document.createElement('img');
    icon.className = 'address-folder-icon';
    icon.src = getExplorerAddressIcon(win);
    icon.alt = '';
    icon.setAttribute('aria-hidden', 'true');
    addressBar.appendChild(icon);

    const input = document.createElement('input');
    input.type = 'text';
    input.value = getExplorerAddressValue(win);
    input.readOnly = true;
    addressBar.appendChild(input);

    const dropdown = document.createElement('button');
    dropdown.className = 'address-dropdown-btn';
    dropdown.type = 'button';
    dropdown.setAttribute('aria-label', 'Address history');

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', '16');
    svg.setAttribute('height', '16');
    svg.setAttribute('viewBox', '0 0 16 16');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');

    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('style', 'transform:rotate(90deg);transform-origin:center');
    path.setAttribute('d', 'm5 6 4 4-4 4z');
    svg.appendChild(path);
    dropdown.appendChild(svg);
    addressBar.appendChild(dropdown);

    return addressBar;
}

function getExplorerAddressIcon(win) {
    const icons = {
        welcome: 'assets/icons/98js/html-16x16.png',
        notepad: 'assets/icons/notepad-32x32.png',
        network: 'assets/icons/network-32x32.png',
        'recycle-bin': 'assets/icons/recycle-bin-32x32.png'
    };

    return icons[win.id] || 'assets/icons/98js/folder-16x16.png';
}

function getExplorerAddressValue(win) {
    const addresses = {
        welcome: 'C:\\WINDOWS\\Desktop\\Welcome.htm',
        'my-computer': 'My Computer',
        'my-documents': 'C:\\My Documents\\',
        notepad: 'C:\\My Documents\\Retro-Web-Notes.txt',
        network: 'Network Neighborhood',
        'recycle-bin': 'Recycle Bin'
    };

    return addresses[win.id] || win.querySelector('.title-bar-text span')?.textContent.trim() || win.id;
}

// Status bars
function initializeStatusBars() {
    const windows = document.querySelectorAll('.window');

    windows.forEach(win => {
        const statusBar = win.querySelector('.status-bar');
        if (!statusBar) {
            return;
        }

        const fields = enhanceStatusBar(win, statusBar);
        const defaultMessage = statusBar.dataset.defaultStatus || fields.message.textContent.trim() || 'Ready';
        statusBar.dataset.defaultStatus = defaultMessage;

        setStatusBar(win, defaultMessage);

        const statusTargets = win.querySelectorAll([
            '.menu-item',
            '.toolbar-btn',
            '.address-bar input',
            '.address-dropdown-btn',
            '.folder-icon',
            '.browser-card',
            '.card-link',
            '.window-body a',
            '.notepad-text',
            '.title-bar-controls button'
        ].join(','));

        statusTargets.forEach(target => {
            target.addEventListener('mouseenter', () => {
                setStatusBar(win, getStatusMessage(target));
            });
            target.addEventListener('focus', () => {
                setStatusBar(win, getStatusMessage(target));
            });
            target.addEventListener('mouseleave', () => {
                resetStatusBar(win);
            });
            target.addEventListener('blur', () => {
                resetStatusBar(win);
            });
        });
    });
}

function enhanceStatusBar(win, statusBar) {
    const existingMessage = statusBar.querySelector('.status-bar-field');
    const message = existingMessage || document.createElement('p');
    message.classList.add('status-bar-field', 'status-bar-message');
    message.setAttribute('role', 'status');
    message.setAttribute('aria-live', 'polite');

    if (!existingMessage) {
        statusBar.prepend(message);
    }

    let detail = statusBar.querySelector('.status-bar-detail');
    if (!detail) {
        detail = document.createElement('p');
        detail.className = 'status-bar-field status-bar-detail';
        statusBar.appendChild(detail);
    }
    detail.textContent = getStatusDetail(win);

    let meter = statusBar.querySelector('.status-bar-meter');
    if (!meter) {
        meter = document.createElement('div');
        meter.className = 'status-bar-field status-bar-meter';
        meter.setAttribute('aria-hidden', 'true');
        meter.innerHTML = '<span></span><span></span><span></span>';
        statusBar.appendChild(meter);
    }

    let grip = statusBar.querySelector('.status-bar-grip');
    if (!grip) {
        grip = document.createElement('div');
        grip.className = 'status-bar-grip';
        grip.setAttribute('aria-hidden', 'true');
        statusBar.appendChild(grip);
    }

    return { message, detail };
}

function getStatusDetail(win) {
    const details = {
        welcome: 'Local intranet',
        'my-computer': '3 object(s)',
        'my-documents': '3 file(s)',
        internet: 'Internet zone',
        network: 'Connected',
        'recycle-bin': '0 bytes'
    };

    return details[win.id] || '';
}

function setStatusBar(win, message) {
    const field = win.querySelector('.status-bar-message');
    if (!field) {
        return;
    }

    field.textContent = message || win.querySelector('.status-bar')?.dataset.defaultStatus || 'Ready';
}

function resetStatusBar(win) {
    const statusBar = win.querySelector('.status-bar');
    if (!statusBar) {
        return;
    }

    setStatusBar(win, statusBar.dataset.defaultStatus || 'Ready');
}

function getStatusMessage(target) {
    if (target.dataset.status) {
        return target.dataset.status;
    }

    if (target.classList.contains('menu-item')) {
        return `${target.textContent.trim()} commands`;
    }

    if (target.classList.contains('toolbar-btn')) {
        const messages = {
            Up: 'Move up one level',
            Cut: 'Cut the selected item',
            Copy: 'Copy the selected item',
            Paste: 'Paste from the clipboard',
            Undo: 'Undo the last action',
            Delete: 'Delete the selected item',
            Properties: 'View properties for the selected item',
            Views: 'Change how items are displayed',
            Back: 'Go back to the previous page',
            Forward: 'Go forward to the next page',
            Stop: 'Stop loading this page',
            Refresh: 'Refresh the current page',
            Home: 'Go to your home page',
            Search: 'Open the search pane',
            Favorites: 'Show favorite pages',
            History: 'Show browsing history',
            Print: 'Print this page'
        };
        return messages[target.textContent.trim()] || 'Toolbar command';
    }

    if (target.classList.contains('folder-icon')) {
        const label = target.querySelector('.icon-label')?.textContent.trim() || 'item';
        return target.dataset.window ? `Open ${label}` : `Select ${label}`;
    }

    if (target.classList.contains('browser-card')) {
        const title = target.querySelector('h3')?.textContent.trim() || 'web shortcut';
        return `Select ${title}`;
    }

    if (target.classList.contains('card-link') || target.matches('.window-body a')) {
        const url = target.getAttribute('href');
        if (url) {
            if (url.startsWith('mailto:')) {
                return 'Compose email';
            }

            try {
                return `Open ${new URL(url).hostname}`;
            } catch (error) {
                return 'Open link';
            }
        }
        return 'Open link';
    }

    if (target.matches('.address-bar input')) {
        return 'Address of the current page';
    }

    if (target.classList.contains('address-dropdown-btn')) {
        return 'Show address history';
    }

    if (target.classList.contains('notepad-text')) {
        return 'Text editor ready';
    }

    if (target.classList.contains('minimize-btn')) {
        return 'Minimize this window';
    }

    if (target.classList.contains('maximize-btn')) {
        return 'Maximize or restore this window';
    }

    if (target.classList.contains('close-btn')) {
        return 'Close this window';
    }

    return 'Ready';
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
                win.style.display = 'flex';
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
