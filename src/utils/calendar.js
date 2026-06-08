/**
 * Utility to generate and download .ics (iCalendar) files for certificate reminders.
 */

// Helper to format date as YYYYMMDD
function formatDateICS(dateStr) {
  if (!dateStr) return '';
  return dateStr.replace(/-/g, '');
}

export function downloadICSFile(certificate) {
  const { employeeName, expirationDate, id } = certificate;
  
  if (!expirationDate) return;

  const expDate = new Date(expirationDate);
  
  // Expiration Event Date (All day event)
  const dtStart = formatDateICS(expirationDate);
  // End date is next day for all-day event
  const nextDay = new Date(expDate);
  nextDay.setDate(nextDay.getDate() + 1);
  const dtEnd = formatDateICS(nextDay.toISOString().split('T')[0]);

  // Two weeks warning Date (14 days before)
  const warnDateObj = new Date(expDate);
  warnDateObj.setDate(warnDateObj.getDate() - 14);
  const warnDateStr = warnDateObj.toISOString().split('T')[0];
  const dtStartWarn = formatDateICS(warnDateStr);
  
  const warnNextDay = new Date(warnDateObj);
  warnNextDay.setDate(warnNextDay.getDate() + 1);
  const dtEndWarn = formatDateICS(warnNextDay.toISOString().split('T')[0]);

  const timestamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

  // Construct ICS template with two events: Expiration and 2-week reminder
  const icsLines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//HealthCert//CertificateMonitor//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    
    // Event 1: The Expiration Date
    'BEGIN:VEVENT',
    `UID:exp_${id}@healthcert.system`,
    `DTSTAMP:${timestamp}`,
    `DTSTART;VALUE=DATE:${dtStart}`,
    `DTEND;VALUE=DATE:${dtEnd}`,
    `SUMMARY:🛡️ HEALTH CERT EXPIRED: ${employeeName}`,
    `DESCRIPTION:Health certificate for ${employeeName} has expired today. Renewal is required immediately. Document ID: ${id}`,
    'STATUS:CONFIRMED',
    'TRANSP:TRANSPARENT',
    'END:VEVENT',

    // Event 2: Two Weeks Expiration Warning
    'BEGIN:VEVENT',
    `UID:warn_${id}@healthcert.system`,
    `DTSTAMP:${timestamp}`,
    `DTSTART;VALUE=DATE:${dtStartWarn}`,
    `DTEND;VALUE=DATE:${dtEndWarn}`,
    `SUMMARY:⚠️ Renewal Due (2 Weeks): ${employeeName}`,
    `DESCRIPTION:Reminder: Health certificate for ${employeeName} will expire in 2 weeks on ${expirationDate}. Please arrange for a renewal. Document ID: ${id}`,
    'STATUS:CONFIRMED',
    'TRANSP:TRANSPARENT',
    'END:VEVENT',

    'END:VCALENDAR'
  ].join('\r\n');

  // Trigger browser file download
  const blob = new Blob([icsLines], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `${employeeName.replace(/\s+/g, '_')}_Health_Cert_Reminder.ics`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
