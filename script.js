document.addEventListener('DOMContentLoaded', () => {
    const STORAGE_KEY = 'schoolCalendarEvents';
    const NOTIFICATION_KEY = 'schoolCalendarNotifications';
    const IMPORTANCE_LEVELS = ['minor', 'moderate', 'major'];

    const calendarEl = document.getElementById('calendar');
    const monthLabel = document.getElementById('monthLabel');
    const prevBtn = document.getElementById('prevMonthBtn');
    const nextBtn = document.getElementById('nextMonthBtn');
    const modalOverlay = document.getElementById('modalOverlay');
    const modal = document.getElementById('modal');
    const filterCheckboxes = document.querySelectorAll('.filterCheckbox');
    const yearFilter = document.getElementById('yearFilter');
    const notificationBtn = document.getElementById('notificationBtn');
    const notificationCount = document.getElementById('notificationCount');

    const today = new Date();
    let viewYear = today.getFullYear();
    let viewMonth = today.getMonth();

    let events = {};
    let notifications = [];

    let activeFilters = new Set(IMPORTANCE_LEVELS);
    let selectedYear = 'all';

    function pad(n) {
        return String(n).padStart(2, '0');
    }

    function dateKey(y, m, d) {
        return `${y}-${pad(m + 1)}-${pad(d)}`;
    }

    function loadEvents(callback) {
        const saved = localStorage.getItem(STORAGE_KEY);

        if (saved) {
            try {
                events = JSON.parse(saved);
                callback();
                return;
            } catch (e) {
                console.warn('saved event data was invalid');
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
                events = {};
                callback();
            });
    }

    function saveEvents() {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(events));
    }

    // gets old notifications from the browser
    function loadNotifications() {
        const savedNotifications = localStorage.getItem(NOTIFICATION_KEY);

        if (savedNotifications) {
            try {
                notifications = JSON.parse(savedNotifications);
            } catch (e) {
                notifications = [];
            }
        }

        updateNotificationCount();
    }

    function saveNotifications() {
        localStorage.setItem(NOTIFICATION_KEY, JSON.stringify(notifications));
        updateNotificationCount();
    }

    // adds a notification when something happens to an event
    function addNotification(message) {
        const newNotification = {
            message: message,
            time: new Date().toLocaleString()
        };

        notifications.unshift(newNotification);

        // stops the list getting massive
        if (notifications.length > 20) {
            notifications.pop();
        }

        saveNotifications();
    }

    function updateNotificationCount() {
        notificationCount.textContent = notifications.length;
    }

    function openNotifications() {
        let notificationHtml = '';

        if (notifications.length === 0) {
            notificationHtml = '<p class="noNotifications">No notifications</p>';
        } else {
            notifications.forEach(item => {
                notificationHtml += `
                    <div class="notificationItem">
                        <p>${escapeHtml(item.message)}</p>
                        <div class="notificationTime">${escapeHtml(item.time)}</div>
                    </div>
                `;
            });
        }

        modal.innerHTML = `
            <h3>Notifications</h3>

            ${notificationHtml}

            <div class="modalActions">
                <button type="button" class="btnSecondary" id="clearNotificationsBtn">Clear</button>
                <button type="button" class="btnPrimary" id="closeNotificationsBtn">Close</button>
            </div>
        `;

        modalOverlay.classList.add('visible');

        document.getElementById('closeNotificationsBtn').addEventListener('click', closeModal);

        document.getElementById('clearNotificationsBtn').addEventListener('click', () => {
            notifications = [];
            saveNotifications();
            openNotifications();
        });
    }

    function getWeekdayColumn(date) {
        const d = date.getDay();

        if (d === 0 || d === 6) return null;

        return d - 1;
    }

    function renderCalendar() {
        monthLabel.textContent = new Date(viewYear, viewMonth, 1)
            .toLocaleString('default', { month: 'long', year: 'numeric' });

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

            if (col === null) continue;

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

            addBtn.addEventListener('click', () => {
                openAddEventModal(key);
            });

            dayEl.appendChild(addBtn);

            (events[key] || [])
                .filter(evt => activeFilters.has(evt.importance || 'minor'))
                .filter(evt => {
                    const eventYear = evt.yearLevel || 'all';

                    if (selectedYear === 'all') {
                        return true;
                    }

                    if (eventYear === 'all') {
                        return true;
                    }

                    return eventYear === selectedYear;
                })
                .forEach(evt => {
                    dayEl.appendChild(buildEventEl(key, evt));
                });

            calendarEl.appendChild(dayEl);
        }
    }

    function buildEventEl(key, evt) {
        const el = document.createElement('div');
        const importance = evt.importance || 'minor';

        el.className = `event importance-${importance}`;
        el.textContent = evt.title;

        el.addEventListener('click', () => {
            openViewEventModal(key, evt.id);
        });

        return el;
    }

    function escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    function capitalize(str) {
        return str.charAt(0).toUpperCase() + str.slice(1);
    }

    function closeModal() {
        modalOverlay.classList.remove('visible');
        modal.innerHTML = '';
    }

    function importanceOptionsHtml(selected) {
        return IMPORTANCE_LEVELS.map(level =>
            `<option value="${level}" ${level === selected ? 'selected' : ''}>${capitalize(level)}</option>`
        ).join('');
    }

    function yearLevelOptionsHtml(selected) {
        return `
            <option value="all" ${selected === 'all' ? 'selected' : ''}>All years</option>
            <option value="10" ${selected === '10' ? 'selected' : ''}>Year 10</option>
            <option value="11" ${selected === '11' ? 'selected' : ''}>Year 11</option>
            <option value="12" ${selected === '12' ? 'selected' : ''}>Year 12</option>
        `;
    }

    function openAddEventModal(key) {
        modal.innerHTML = `
            <h3>Add Event</h3>

            <label for="eventTitleInput">Title</label>
            <input type="text" id="eventTitleInput" maxlength="60" autocomplete="off" />

            <label for="eventTimeInput">Time</label>
            <input type="time" id="eventTimeInput" />

            <label for="eventLocationInput">Location</label>
            <input type="text" id="eventLocationInput" maxlength="60" />

            <label for="eventYearInput">Year level</label>
            <select id="eventYearInput">
                ${yearLevelOptionsHtml('all')}
            </select>

            <label for="eventDescInput">Description</label>
            <textarea id="eventDescInput"></textarea>

            <label for="eventImportanceInput">Importance</label>
            <select id="eventImportanceInput">
                ${importanceOptionsHtml('minor')}
            </select>

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
            const importance = document.getElementById('eventImportanceInput').value;
            const time = document.getElementById('eventTimeInput').value;
            const location = document.getElementById('eventLocationInput').value.trim();
            const yearLevel = document.getElementById('eventYearInput').value;

            const newEvent = {
                id: 'evt-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
                title,
                description,
                importance,
                time,
                location,
                yearLevel
            };

            if (!events[key]) {
                events[key] = [];
            }

            events[key].push(newEvent);

            saveEvents();
            addNotification('New event added: ' + title);

            closeModal();
            renderCalendar();
        });
    }

    function openViewEventModal(key, id) {
        const evt = (events[key] || []).find(e => e.id === id);

        if (!evt) return;

        const importance = evt.importance || 'minor';
        const time = evt.time || 'Not set';
        const location = evt.location || 'Not set';

        let yearText = 'All years';

        if (evt.yearLevel && evt.yearLevel !== 'all') {
            yearText = 'Year ' + evt.yearLevel;
        }

        modal.innerHTML = `
            <h3>${escapeHtml(evt.title)}</h3>

            <div class="eventMeta">
                <span class="colorDot dot-${importance}"></span>
                ${capitalize(importance)}
            </div>

            <div class="eventInfo">
                <p><strong>Date:</strong> ${key}</p>
                <p><strong>Time:</strong> ${escapeHtml(time)}</p>
                <p><strong>Location:</strong> ${escapeHtml(location)}</p>
                <p><strong>Year level:</strong> ${yearText}</p>
                <p><strong>Description:</strong> ${evt.description ? escapeHtml(evt.description) : 'No description'}</p>
            </div>

            <div class="modalActions">
                <button type="button" class="btnDanger" id="deleteBtn">Delete</button>
                <button type="button" class="btnSecondary" id="reminderBtn">Email reminder</button>
                <button type="button" class="btnSecondary" id="editBtn">Edit</button>
                <button type="button" class="btnSecondary" id="closeBtn">Close</button>
            </div>
        `;

        modalOverlay.classList.add('visible');

        document.getElementById('closeBtn').addEventListener('click', closeModal);

        document.getElementById('editBtn').addEventListener('click', () => {
            openEditEventModal(key, id);
        });

        // opens the prototype email reminder
        document.getElementById('reminderBtn').addEventListener('click', () => {
            openReminderModal(key, id);
        });

        document.getElementById('deleteBtn').addEventListener('click', () => {
            const deletedTitle = evt.title;

            events[key] = events[key].filter(e => e.id !== id);

            if (events[key].length === 0) {
                delete events[key];
            }

            saveEvents();
            addNotification('Event removed: ' + deletedTitle);

            closeModal();
            renderCalendar();
        });
    }

    // prototype for the email reminder feature
    function openReminderModal(key, id) {
        const evt = (events[key] || []).find(e => e.id === id);

        if (!evt) return;

        modal.innerHTML = `
            <h3>Email reminder</h3>

            <p class="prototypeNote">
                Set an email reminder for ${escapeHtml(evt.title)}.
            </p>

            <label for="reminderEmail">Email</label>
            <input type="email" id="reminderEmail" placeholder="student@email.com" />

            <label for="reminderTime">Send reminder</label>
            <select id="reminderTime">
                <option value="1 day before">1 day before</option>
                <option value="morning of event">Morning of event</option>
                <option value="1 hour before">1 hour before</option>
            </select>

            <div class="modalActions">
                <button type="button" class="btnSecondary" id="backReminderBtn">Back</button>
                <button type="button" class="btnPrimary" id="setReminderBtn">Set reminder</button>
            </div>
        `;

        document.getElementById('backReminderBtn').addEventListener('click', () => {
            openViewEventModal(key, id);
        });

        document.getElementById('setReminderBtn').addEventListener('click', () => {
            const email = document.getElementById('reminderEmail').value.trim();
            const reminderTime = document.getElementById('reminderTime').value;

            // simple check for the prototype
            if (email === '' || !email.includes('@')) {
                document.getElementById('reminderEmail').focus();
                return;
            }

            modal.innerHTML = `
                <h3>Reminder set</h3>

                <p>
                    A reminder for <strong>${escapeHtml(evt.title)}</strong>
                    would be sent to <strong>${escapeHtml(email)}</strong>
                    ${escapeHtml(reminderTime)}.
                </p>

                <p class="prototypeNote">
                    This is a prototype, so an email is not actually sent.
                </p>

                <div class="modalActions">
                    <button type="button" class="btnPrimary" id="finishReminderBtn">Close</button>
                </div>
            `;

            document.getElementById('finishReminderBtn').addEventListener('click', closeModal);
        });
    }

    function openEditEventModal(key, id) {
        const evt = (events[key] || []).find(e => e.id === id);

        if (!evt) return;

        const oldImportance = evt.importance || 'minor';
        const oldYearLevel = evt.yearLevel || 'all';

        modal.innerHTML = `
            <h3>Edit Event</h3>

            <label for="editTitleInput">Title</label>
            <input type="text" id="editTitleInput" maxlength="60" value="${escapeHtml(evt.title)}" />

            <label for="editTimeInput">Time</label>
            <input type="time" id="editTimeInput" value="${evt.time || ''}" />

            <label for="editLocationInput">Location</label>
            <input type="text" id="editLocationInput" maxlength="60" value="${escapeHtml(evt.location || '')}" />

            <label for="editYearInput">Year level</label>
            <select id="editYearInput">
                ${yearLevelOptionsHtml(oldYearLevel)}
            </select>

            <label for="editDescInput">Description</label>
            <textarea id="editDescInput">${escapeHtml(evt.description || '')}</textarea>

            <label for="editImportanceInput">Importance</label>
            <select id="editImportanceInput">
                ${importanceOptionsHtml(oldImportance)}
            </select>

            <div class="modalActions">
                <button type="button" class="btnSecondary" id="cancelEditBtn">Cancel</button>
                <button type="button" class="btnPrimary" id="saveEditBtn">Save changes</button>
            </div>
        `;

        document.getElementById('cancelEditBtn').addEventListener('click', () => {
            openViewEventModal(key, id);
        });

        document.getElementById('saveEditBtn').addEventListener('click', () => {
            const newTitle = document.getElementById('editTitleInput').value.trim();

            if (!newTitle) {
                document.getElementById('editTitleInput').focus();
                return;
            }

            evt.title = newTitle;
            evt.time = document.getElementById('editTimeInput').value;
            evt.location = document.getElementById('editLocationInput').value.trim();
            evt.yearLevel = document.getElementById('editYearInput').value;
            evt.description = document.getElementById('editDescInput').value.trim();
            evt.importance = document.getElementById('editImportanceInput').value;

            saveEvents();
            addNotification('Event updated: ' + evt.title);

            closeModal();
            renderCalendar();
        });
    }

    modalOverlay.addEventListener('click', (e) => {
        if (e.target === modalOverlay) {
            closeModal();
        }
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

    filterCheckboxes.forEach(cb => {
        cb.addEventListener('change', () => {
            activeFilters = new Set(
                Array.from(filterCheckboxes)
                    .filter(c => c.checked)
                    .map(c => c.value)
            );

            renderCalendar();
        });
    });

    yearFilter.addEventListener('change', () => {
        selectedYear = yearFilter.value;
        renderCalendar();
    });

    notificationBtn.addEventListener('click', openNotifications);

    loadNotifications();
    loadEvents(renderCalendar);
});
