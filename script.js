document.addEventListener('DOMContentLoaded', () => {
    const STORAGE_KEY = 'schoolCalendarEvents';

    const calendarEl = document.getElementById('calendar');
    const monthLabel = document.getElementById('monthLabel');
    const prevBtn = document.getElementById('prevMonthBtn');
    const nextBtn = document.getElementById('nextMonthBtn');
    const modalOverlay = document.getElementById('modalOverlay');
    const modal = document.getElementById('modal');

    const today = new Date();
    let viewYear = today.getFullYear();
    let viewMonth = today.getMonth(); // 0 = Jan

    // events is the in the JSON data.
    let events = {};

    function pad(n) {
        return String(n).padStart(2, '0');
    }

    function dateKey(y, m, d) {
        return `${y}-${pad(m + 1)}-${pad(d)}`;
    }

    // Loads events.json on first run.
    // If fetch fails, falls back to a small built-in default so the app still works
    function loadEvents(callback) {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            try {
                events = JSON.parse(saved);
                callback();
                return;
            } catch (e) {
                console.warn('Saved event data was invalid, reloading defaults', e);
            }
        }

        fetch('events.json')
            .then(res => (res.ok ? res.json() : Promise.reject(new Error('bad response'))))
            .then(data => {
                events = data;
                saveEvents();
                callback();
            })
            .catch(() => {
                events = {
                    '2026-08-12': [
                        { id: 'evt-seed-1', title: 'science week', description: '' }
                    ]
                };
                saveEvents();
                callback();
            });
    }

    function saveEvents() {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(events));
    }

    // Returns 0 (Mon) .. 4 (Fri) for a weekday date, or null for Sat/Sun.
    function getWeekdayColumn(date) {
        const d = date.getDay(); // 0 Sun .. 6 Sat
        if (d === 0 || d === 6) return null;
        return d - 1;
    }

    function renderCalendar() {
        monthLabel.textContent = new Date(viewYear, viewMonth, 1)
            .toLocaleString('default', { month: 'long', year: 'numeric' });

        // remove previously generated day cells, keep the Mon-Fri header row
        calendarEl.querySelectorAll('.day').forEach(el => el.remove());

        const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
        const firstCol = getWeekdayColumn(new Date(viewYear, viewMonth, 1));
        const leadingBlanks = firstCol === null ? 0 : firstCol;

        for (let i = 0; i < leadingBlanks; i++) {
            const blank = document.createElement('div');
            blank.className = 'day empty';
            calendarEl.appendChild(blank);
        }

        for (let d = 1; d <= daysInMonth; d++) {
            const col = getWeekdayColumn(new Date(viewYear, viewMonth, d));
            if (col === null) continue; // skip weekends entirely

            const key = dateKey(viewYear, viewMonth, d);

            const dayEl = document.createElement('div');
            dayEl.className = 'day';
            dayEl.dataset.date = key;

            const span = document.createElement('span');
            span.textContent = d;
            dayEl.appendChild(span);

            const addBtn = document.createElement('button');
            addBtn.type = 'button';
            addBtn.className = 'addEventBtn';
            addBtn.textContent = '+';
            addBtn.setAttribute('aria-label', 'Add event');
            addBtn.addEventListener('click', () => openAddEventModal(key));
            dayEl.appendChild(addBtn);

            (events[key] || []).forEach(evt => {
                dayEl.appendChild(buildEventEl(key, evt));
            });

            calendarEl.appendChild(dayEl);
        }
    }

    function buildEventEl(key, evt) {
        const el = document.createElement('div');
        el.className = 'event';
        el.textContent = evt.title;
        el.addEventListener('click', () => openViewEventModal(key, evt.id));
        return el;
    }

    function escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    function closeModal() {
        modalOverlay.classList.remove('visible');
        modal.innerHTML = '';
    }

    function openAddEventModal(key) {
        modal.innerHTML = `
            <h3>Add Event</h3>
            <label for="eventTitleInput">Title</label>
            <input type="text" id="eventTitleInput" maxlength="60" autocomplete="off" />
            <label for="eventDescInput">Description</label>
            <textarea id="eventDescInput"></textarea>
            <div class="modalActions">
                <button type="button" class="btnSecondary" id="cancelBtn">Cancel</button>
                <button type="button" class="btnPrimary" id="saveBtn">Save</button>
            </div>
        `;
        modalOverlay.classList.add('visible');

        const titleInput = document.getElementById('eventTitleInput');
        titleInput.focus();

        document.getElementById('cancelBtn').addEventListener('click', closeModal);
        document.getElementById('saveBtn').addEventListener('click', () => {
            const title = titleInput.value.trim();
            if (!title) {
                titleInput.focus();
                return;
            }
            const description = document.getElementById('eventDescInput').value.trim();

            const newEvent = {
                id: 'evt-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
                title,
                description
            };

            if (!events[key]) events[key] = [];
            events[key].push(newEvent);
            saveEvents();
            closeModal();
            renderCalendar();
        });
    }

    function openViewEventModal(key, id) {
        const evt = (events[key] || []).find(e => e.id === id);
        if (!evt) return;

        modal.innerHTML = `
            <h3>${escapeHtml(evt.title)}</h3>
            <p>${evt.description ? escapeHtml(evt.description) : '<em>No description</em>'}</p>
            <div class="modalActions">
                <button type="button" class="btnDanger" id="deleteBtn">Delete</button>
                <button type="button" class="btnSecondary" id="closeBtn">Close</button>
            </div>
        `;
        modalOverlay.classList.add('visible');

        document.getElementById('closeBtn').addEventListener('click', closeModal);
        document.getElementById('deleteBtn').addEventListener('click', () => {
            events[key] = events[key].filter(e => e.id !== id);
            if (events[key].length === 0) delete events[key];
            saveEvents();
            closeModal();
            renderCalendar();
        });
    }

    modalOverlay.addEventListener('click', (e) => {
        if (e.target === modalOverlay) closeModal();
    });

    prevBtn.addEventListener('click', () => {
        viewMonth--;
        if (viewMonth < 0) {
            viewMonth = 11;
            viewYear--;
        }
        renderCalendar();
    });

    nextBtn.addEventListener('click', () => {
        viewMonth++;
        if (viewMonth > 11) {
            viewMonth = 0;
            viewYear++;
        }
        renderCalendar();
    });

    loadEvents(renderCalendar);
});
