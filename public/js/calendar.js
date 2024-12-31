// /frontend/js/calendar.js

class CalendarService {
    static generateICSFile(interview) {
        const startTime = interview.date.toDate();
        const endTime = new Date(startTime.getTime() + 60 * 60 * 1000); // 1 hour duration

        const icsContent = [
            'BEGIN:VCALENDAR',
            'VERSION:2.0',
            'PRODID:-//TalentSync//Interview Calendar//EN',
            'METHOD:REQUEST',
            'BEGIN:VEVENT',
            `DTSTART:${this.formatDateToICS(startTime)}`,
            `DTEND:${this.formatDateToICS(endTime)}`,
            `DTSTAMP:${this.formatDateToICS(new Date())}`,
            `UID:${interview.id}@talentsync.com`,
            `CREATED:${this.formatDateToICS(new Date())}`,
            `DESCRIPTION:Join your TalentSync interview using this link:\\n\\n${interview.meetingLink}`,
            `LAST-MODIFIED:${this.formatDateToICS(new Date())}`,
            `LOCATION:Virtual Meeting`,
            `SUMMARY:TalentSync Interview: ${interview.candidateName}`,
            'STATUS:CONFIRMED',
            'SEQUENCE:0',
            'TRANSP:OPAQUE',
            'BEGIN:VALARM',
            'ACTION:DISPLAY',
            'DESCRIPTION:Interview Reminder',
            'TRIGGER:-P0DT0H15M0S',
            'END:VALARM',
            'END:VEVENT',
            'END:VCALENDAR'
        ].join('\r\n');

        return new Blob([icsContent], { 
            type: 'text/calendar;charset=utf-8' 
        });
    }

    static formatDateToICS(date) {
        return date.toISOString().replace(/[-:.]|(\d{3})/g, '');
    }

    static async downloadCalendarInvite(interview) {
        try {
            const icsBlob = this.generateICSFile(interview);
            const url = window.URL.createObjectURL(icsBlob);
            
            // Create and trigger download
            const link = document.createElement('a');
            link.href = url;
            link.download = `TalentSync_Interview_${interview.candidateName.replace(/\s+/g, '_')}.ics`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            // Cleanup
            setTimeout(() => {
                window.URL.revokeObjectURL(url);
            }, 100);

            return true;
        } catch (error) {
            console.error('Error generating calendar invite:', error);
            return false;
        }
    }

    static async sendCalendarInvites(interview) {
        try {
            // Generate calendar invites for both interviewer and candidate
            const interviewerInvite = this.generateICSFile({
                ...interview,
                description: `Interview with ${interview.candidateName}\n\nJoin using: ${interview.meetingLink}`
            });

            const candidateInvite = this.generateICSFile({
                ...interview,
                description: `Interview with TalentSync\n\nJoin using: ${interview.meetingLink}`
            });

            // Send to backend for email delivery
            const response = await fetch('/api/send-calendar-invites', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    interviewId: interview.id,
                    candidateEmail: interview.candidateEmail,
                    interviewerEmail: interview.interviewerEmail,
                    interviewerInvite: await this.blobToBase64(interviewerInvite),
                    candidateInvite: await this.blobToBase64(candidateInvite)
                })
            });

            if (!response.ok) {
                throw new Error('Failed to send calendar invites');
            }

            return true;
        } catch (error) {
            console.error('Error sending calendar invites:', error);
            throw error;
        }
    }

    static async blobToBase64(blob) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result.split(',')[1]);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    }

    static validateDateTime(date, time) {
        const dateTime = new Date(`${date}T${time}`);
        const now = new Date();
        
        // Check if date is in the past
        if (dateTime <= now) {
            throw new Error('Please select a future date and time');
        }

        // Check if date is too far in the future (e.g., 6 months)
        const sixMonthsFromNow = new Date();
        sixMonthsFromNow.setMonth(sixMonthsFromNow.getMonth() + 6);
        if (dateTime > sixMonthsFromNow) {
            throw new Error('Please select a date within the next 6 months');
        }

        // Check if time is within business hours (9 AM to 6 PM)
        const hours = dateTime.getHours();
        if (hours < 9 || hours >= 18) {
            throw new Error('Please select a time between 9 AM and 6 PM');
        }

        return dateTime;
    }
}

// Export for use in other files
window.CalendarService = CalendarService;