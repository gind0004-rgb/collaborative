document.addEventListener('DOMContentLoaded', () => {
    const STORAGE_KEY = 'schoolCalendarEvents';
    const PERSONAL_KEY = 'schoolCalendarPersonalEvents';
    const NOTIFICATION_KEY = 'schoolCalendarNotifications';
    const REMINDER_KEY = 'schoolCalendarReminders';
    const MODE_KEY = 'schoolCalendarMode';

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
    const settingsBtn = document.getElementById('settingsBtn');
    const modeLabel = document.getElementById('modeLabel');

    const today = new Date();

    let viewYear = today.getFullYear();
    let viewMonth = today.getMonth();

    let events = {};
    let personalEvents = {};
    let notifications = [];
    let reminders = [];

    let activeFilters = new Set(IMPORTANCE_LEVELS);
    let selectedYear = 'all';

    // admin is default so the older versions still work normally
    let currentMode = localStorage.getItem(MODE_KEY) || 'admin';


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


    function loadPersonalEvents() {
        const saved = localStorage.getItem(PERSONAL_KEY);

        if (saved) {
            try {
                personalEvents = JSON.parse(saved);
            } catch (e) {
                personalEvents = {};
            }
        }
    }


    function savePersonalEvents() {
        localStorage.setItem(PERSONAL_KEY, JSON.stringify(personalEvents));
    }


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


    function addNotification(message) {
        const newNotification = {
            message: message,
            time: new Date().toLocaleString()
        };

        notifications.unshift(newNotification);

        if (notifications.length > 20) {
            notifications.pop();
        }

        saveNotifications();
    }


    function updateNotificationCount() {
        notificationCount.textContent = notifications.length;
    }


    function loadReminders() {
        const savedReminders = localStorage.getItem(REMINDER_KEY);

        if (savedReminders) {
            try {
                reminders = JSON.parse(savedReminders);
            } catch (e) {
                reminders = [];
            }
        }
    }


    function saveReminders() {
        localStorage.setItem(REMINDER_KEY, JSON.stringify(reminders));
    }


    function updateModeLabel() {
        if (currentMode === 'admin') {
            modeLabel.textContent = 'Admin mode';
        } else {
            modeLabel.textContent = 'Student mode';
        }
    }


    function openSettings() {
        modal.innerHTML = `
            <h3>Account mode</h3>

            <p class="prototypeNote">
                Switch between the staff and student prototype views.
            </p>

            <button type="button"
                class="modeButton ${currentMode === 'admin' ? 'currentMode' : ''}"
                id="adminModeBtn">
                Admin mode
            </button>

            <button type="button"
                class="modeButton ${currentMode === 'student' ? 'currentMode' : ''}"
                id="studentModeBtn">
                Student mode
            </button>

            <div class="modalActions">
                <button type="button" class="btnSecondary" id="closeSettingsBtn">Close</button>
            </div>
        `;

        modalOverlay.classList.add('visible');

        document.getElementById('adminModeBtn').addEventListener('click', () => {
            changeMode('admin');
        });

        document.getElementById('studentModeBtn').addEventListener('click', () => {
            changeMode('student');
        });

        document.getElementById('closeSettingsBtn').addEventListener('click', closeModal);
    }


    function changeMode(mode) {
        currentMode = mode;

        localStorage.setItem(MODE_KEY, currentMode);

        updateModeLabel();
        closeModal();
        renderCalendar();
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

            if (currentMode === 'admin') {
                addBtn.setAttribute('aria-label', 'Add school event');

                addBtn.addEventListener('click', () => {
                    openAddSchoolEventModal(key);
                });
            } else {
                addBtn.setAttribute('aria-label', 'Add personal event');

                addBtn.addEventListener('click', () => {
                    openAddPersonalEventModal(key);
                });
            }

            dayEl.appendChild(addBtn);

            // school events show in both modes
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
                    dayEl.appendChild(buildSchoolEventEl(key, evt));
                });


            // personal events only show to students
            if (currentMode === 'student') {
                (personalEvents[key] || []).forEach(evt => {
                    dayEl.appendChild(buildPersonalEventEl(key, evt));
                });
            }

            calendarEl.appendChild(dayEl);
        }
    }


    function buildSchoolEventEl(key, evt) {
        const el = document.createElement('div');
        const importance = evt.importance || 'minor';

        el.className = `event importance-${importance}`;
        el.textContent = evt.title;

        el.addEventListener('click', () => {
            openSchoolEventModal(key, evt.id);
        });

        return el;
    }


    function buildPersonalEventEl(key, evt) {
        const el = document.createElement('div');

        el.className = 'event personalEvent';

        el.innerHTML = `
            ${escapeHtml(evt.title)}
            <span class="personalLabel">Personal event</span>
        `;

        el.addEventListener('click', () => {
            openPersonalEventModal(key, evt.id);
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


    // this is the old add event form used by admin
    function openAddSchoolEventModal(key) {
        modal.innerHTML = `
            <h3>Add School Event</h3>

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

        document.getElementById('cancelBtn').addEventListener('click', closeModal);

        document.getElementById('saveBtn').addEventListener('click', () => {
            const title = document.getElementById('eventTitleInput').value.trim();

            if (!title) {
                return;
            }

            const newEvent = {
                id: 'evt-' + Date.now(),
                title: title,
                time: document.getElementById('eventTimeInput').value,
                location: document.getElementById('eventLocationInput').value.trim(),
                yearLevel: document.getElementById('eventYearInput').value,
                description: document.getElementById('eventDescInput').value.trim(),
                importance: document.getElementById('eventImportanceInput').value
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


    // students add seperate personal events
    function openAddPersonalEventModal(key) {
        modal.innerHTML = `
            <h3>Add Personal Event</h3>

            <p class="prototypeNote">
                This event is only visible in your student view.
            </p>

            <label for="personalTitleInput">Title</label>
            <input type="text" id="personalTitleInput" maxlength="60" />

            <label for="personalTimeInput">Time</label>
            <input type="time" id="personalTimeInput" />

            <label for="personalLocationInput">Location</label>
            <input type="text" id="personalLocationInput" maxlength="60" />

            <label for="personalDescInput">Description</label>
            <textarea id="personalDescInput"></textarea>

            <div class="modalActions">
                <button type="button" class="btnSecondary" id="cancelPersonalBtn">Cancel</button>
                <button type="button" class="btnPrimary" id="savePersonalBtn">Save</button>
            </div>
        `;

        modalOverlay.classList.add('visible');

        document.getElementById('cancelPersonalBtn').addEventListener('click', closeModal);

        document.getElementById('savePersonalBtn').addEventListener('click', () => {
            const title = document.getElementById('personalTitleInput').value.trim();

            if (!title) {
                return;
            }

            const newPersonalEvent = {
                id: 'personal-' + Date.now(),
                title: title,
                time: document.getElementById('personalTimeInput').value,
                location: document.getElementById('personalLocationInput').value.trim(),
                description: document.getElementById('personalDescInput').value.trim()
            };

            if (!personalEvents[key]) {
                personalEvents[key] = [];
            }

            personalEvents[key].push(newPersonalEvent);

            savePersonalEvents();

            closeModal();
            renderCalendar();
        });
    }


    function openSchoolEventModal(key, id) {
        const evt = (events[key] || []).find(e => e.id === id);

        if (!evt) return;

        let yearText = 'All years';

        if (evt.yearLevel && evt.yearLevel !== 'all') {
            yearText = 'Year ' + evt.yearLevel;
        }

        let adminButtons = '';

        // only admin can edit or delete school events
        if (currentMode === 'admin') {
            adminButtons = `
                <button type="button" class="btnDanger" id="deleteBtn">Delete</button>
                <button type="button" class="btnSecondary" id="editBtn">Edit</button>
            `;
        }

        modal.innerHTML = `
            <h3>${escapeHtml(evt.title)}</h3>

            <div class="eventInfo">
                <p><strong>Date:</strong> ${key}</p>
                <p><strong>Time:</strong> ${escapeHtml(evt.time || 'Not set')}</p>
                <p><strong>Location:</strong> ${escapeHtml(evt.location || 'Not set')}</p>
                <p><strong>Year level:</strong> ${yearText}</p>
                <p><strong>Description:</strong> ${evt.description ? escapeHtml(evt.description) : 'No description'}</p>
            </div>

            <div class="modalActions">
                ${adminButtons}
                <button type="button" class="btnSecondary" id="reminderBtn">Set reminder</button>
                <button type="button" class="btnSecondary" id="closeBtn">Close</button>
            </div>
        `;

        modalOverlay.classList.add('visible');

        document.getElementById('closeBtn').addEventListener('click', closeModal);

        document.getElementById('reminderBtn').addEventListener('click', () => {
            openReminderModal(key, evt);
        });

        if (currentMode === 'admin') {
            document.getElementById('editBtn').addEventListener('click', () => {
                openEditEventModal(key, id);
            });

            document.getElementById('deleteBtn').addEventListener('click', () => {
                events[key] = events[key].filter(e => e.id !== id);

                if (events[key].length === 0) {
                    delete events[key];
                }

                saveEvents();
                addNotification('Event removed: ' + evt.title);

                closeModal();
                renderCalendar();
            });
        }
    }


    function openPersonalEventModal(key, id) {
        const evt = (personalEvents[key] || []).find(e => e.id === id);

        if (!evt) return;

        modal.innerHTML = `
            <h3>${escapeHtml(evt.title)}</h3>

            <p class="prototypeNote">Personal event</p>

            <div class="eventInfo">
                <p><strong>Date:</strong> ${key}</p>
                <p><strong>Time:</strong> ${escapeHtml(evt.time || 'Not set')}</p>
                <p><strong>Location:</strong> ${escapeHtml(evt.location || 'Not set')}</p>
                <p><strong>Description:</strong> ${evt.description ? escapeHtml(evt.description) : 'No description'}</p>
            </div>

            <div class="modalActions">
                <button type="button" class="btnDanger" id="deletePersonalBtn">Delete</button>
                <button type="button" class="btnSecondary" id="personalReminderBtn">Set reminder</button>
                <button type="button" class="btnSecondary" id="closePersonalBtn">Close</button>
            </div>
        `;

        modalOverlay.classList.add('visible');

        document.getElementById('closePersonalBtn').addEventListener('click', closeModal);

        document.getElementById('personalReminderBtn').addEventListener('click', () => {
            openReminderModal(key, evt);
        });

        document.getElementById('deletePersonalBtn').addEventListener('click', () => {
            personalEvents[key] = personalEvents[key].filter(e => e.id !== id);

            if (personalEvents[key].length === 0) {
                delete personalEvents[key];
            }

            savePersonalEvents();

            closeModal();
            renderCalendar();
        });
    }


    function openReminderModal(key, evt) {
        modal.innerHTML = `
            <h3>Set reminder</h3>

            <p class="prototypeNote">
                Choose how and when you want to be reminded about ${escapeHtml(evt.title)}.
            </p>

            <label for="reminderMethod">Reminder type</label>
            <select id="reminderMethod">
                <option value="native">In-app notification</option>
                <option value="email">Email</option>
                <option value="both">Both</option>
            </select>

            <label for="reminderTime">Remind me</label>
            <select id="reminderTime">
                <option value="day">1 day before</option>
                <option value="morning">Morning of event</option>
                <option value="hour">1 hour before</option>
            </select>

            <label for="reminderEmail">Email</label>
            <input type="email" id="reminderEmail" placeholder="only needed for email reminders" />

            <div class="modalActions">
                <button type="button" class="btnSecondary" id="cancelReminderBtn">Cancel</button>
                <button type="button" class="btnPrimary" id="saveReminderBtn">Save reminder</button>
            </div>
        `;

        document.getElementById('cancelReminderBtn').addEventListener('click', closeModal);

        document.getElementById('saveReminderBtn').addEventListener('click', () => {
            const method = document.getElementById('reminderMethod').value;
            const reminderTime = document.getElementById('reminderTime').value;
            const email = document.getElementById('reminderEmail').value.trim();

            if ((method === 'email' || method === 'both') && !email.includes('@')) {
                document.getElementById('reminderEmail').focus();
                return;
            }

            const newReminder = {
                id: 'rem-' + Date.now(),
                eventDate: key,
                eventTitle: evt.title,
                eventTime: evt.time || '',
                method: method,
                reminderTime: reminderTime,
                email: email,
                delivered: false
            };

            reminders.push(newReminder);
            saveReminders();

            modal.innerHTML = `
                <h3>Reminder saved</h3>

                <p>
                    Your reminder for <strong>${escapeHtml(evt.title)}</strong> has been saved.
                </p>

                <p class="prototypeNote">
                    Email sending is only a prototype and does not send a real email.
                </p>

                <div class="modalActions">
                    <button type="button" class="btnPrimary" id="finishReminderBtn">Close</button>
                </div>
            `;

            document.getElementById('finishReminderBtn').addEventListener('click', closeModal);
        });
    }


    function getReminderDate(reminder) {
        let eventHour = 9;
        let eventMinute = 0;

        if (reminder.eventTime && reminder.eventTime.includes(':')) {
            const parts = reminder.eventTime.split(':');

            eventHour = Number(parts[0]);
            eventMinute = Number(parts[1]);
        }

        const dateParts = reminder.eventDate.split('-');

        const eventDate = new Date(
            Number(dateParts[0]),
            Number(dateParts[1]) - 1,
            Number(dateParts[2]),
            eventHour,
            eventMinute
        );

        const reminderDate = new Date(eventDate);

        if (reminder.reminderTime === 'day') {
            reminderDate.setDate(reminderDate.getDate() - 1);
        }

        if (reminder.reminderTime === 'morning') {
            reminderDate.setHours(8, 0, 0, 0);
        }

        if (reminder.reminderTime === 'hour') {
            reminderDate.setHours(reminderDate.getHours() - 1);
        }

        return reminderDate;
    }


    function checkReminders() {
        const now = new Date();
        let changed = false;

        reminders.forEach(reminder => {
            if (reminder.delivered) {
                return;
            }

            const reminderDate = getReminderDate(reminder);

            if (now >= reminderDate) {
                if (reminder.method === 'native' || reminder.method === 'both') {
                    addNotification(
                        'Approaching event: ' +
                        reminder.eventTitle +
                        ' on ' +
                        reminder.eventDate
                    );
                }

                reminder.delivered = true;
                changed = true;
            }
        });

        if (changed) {
            saveReminders();
        }
    }


    function openEditEventModal(key, id) {
        const evt = (events[key] || []).find(e => e.id === id);

        if (!evt) return;

        const oldImportance = evt.importance || 'minor';
        const oldYearLevel = evt.yearLevel || 'all';

        modal.innerHTML = `
            <h3>Edit Event</h3>

            <label for="editTitleInput">Title</label>
            <input type="text" id="editTitleInput" value="${escapeHtml(evt.title)}" />

            <label for="editTimeInput">Time</label>
            <input type="time" id="editTimeInput" value="${evt.time || ''}" />

            <label for="editLocationInput">Location</label>
            <input type="text" id="editLocationInput" value="${escapeHtml(evt.location || '')}" />

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
            openSchoolEventModal(key, id);
        });

        document.getElementById('saveEditBtn').addEventListener('click', () => {
            evt.title = document.getElementById('editTitleInput').value.trim();
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
    settingsBtn.addEventListener('click', openSettings);

    updateModeLabel();

    loadNotifications();
    loadReminders();
    loadPersonalEvents();

    loadEvents(() => {
        renderCalendar();
        checkReminders();
    });

    setInterval(checkReminders, 60000);
});
