document.addEventListener('DOMContentLoaded', () => {
    const days = document.querySelectorAll('.calendar .day');

    days.forEach(day => {
        // lets people know the day is clickable, without touching style.css
        day.style.cursor = 'pointer';

        day.addEventListener('click', (e) => {
            // don't open the prompt again if they clicked an existing event
            if (e.target.classList.contains('event')) {
                return;
            }

            const eventText = prompt('Event name:');

            if (eventText && eventText.trim() !== '') {
                const eventDiv = document.createElement('div');
                eventDiv.className = 'event';
                eventDiv.textContent = eventText.trim();
                day.appendChild(eventDiv);
            }
        });
    });
});
