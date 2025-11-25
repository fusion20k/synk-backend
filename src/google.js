// Use Node.js built-in fetch (available in Node 18+)
let fetch;
if (typeof globalThis.fetch === 'undefined') {
  try {
    fetch = require('node-fetch');
  } catch (e) {
    console.error('Warning: node-fetch not available');
  }
} else {
  fetch = globalThis.fetch;
}

const { getGoogleToken } = require('./oauth');

async function listGoogleCalendars() {
  // If demo mode is enabled, return sample data immediately
  if (process.env.DEMO_MODE === 'true') {
    console.log('Demo mode: returning sample calendar data');
    const sampleData = getSampleCalendars();
    console.log('[DEBUG] DEMO_SAMPLE_DATA:', JSON.stringify(sampleData, null, 2));
    return sampleData;
  }
  
  try {
    const tokens = await getGoogleToken();
    console.log('[Google Calendar] 🔑 Token scopes:', tokens.scope);
    console.log('[Google Calendar] 🌐 API endpoint: https://www.googleapis.com/calendar/v3/users/me/calendarList');
    
    // Get user profile for name resolution
    const userInfo = await getGoogleUserInfo();
    console.log('[DEBUG] PROFILE_NAME:', userInfo?.name || null);
    
    const response = await fetch('https://www.googleapis.com/calendar/v3/users/me/calendarList?maxResults=250&showHidden=true', {
      headers: {
        'Authorization': `Bearer ${tokens.access_token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      // If demo mode is enabled and we get an error, return sample data
      if (process.env.DEMO_MODE === 'true') {
        console.log('Demo mode: returning sample calendar data');
        const sampleData = getSampleCalendars();
        console.log('[DEBUG] DEMO_SAMPLE_DATA:', JSON.stringify(sampleData, null, 2));
        return sampleData;
      }
      
      const errorText = await response.text();
      throw new Error(`Google API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log('[DEBUG] RAW_CALENDAR_LIST:', JSON.stringify(data.items, null, 2));
    console.log('[Google Calendar] Total calendars returned:', data.items?.length || 0);
    
    // Log each calendar's key properties
    if (data.items) {
      data.items.forEach((cal, index) => {
        console.log(`[Google Calendar] Calendar ${index + 1}:`, {
          id: cal.id,
          summary: cal.summary,
          summaryOverride: cal.summaryOverride,
          primary: cal.primary,
          accessRole: cal.accessRole,
          selected: cal.selected,
          hidden: cal.hidden,
          backgroundColor: cal.backgroundColor,
          isSystemCalendar: cal.id.includes('#contacts') || cal.id.includes('#holiday') || cal.id.includes('#tasks') || cal.id.includes('@group.v.calendar.google.com')
        });
      });
    }
    
    // Group calendars by sections like Google Calendar does
    const myCalendars = [];
    const otherCalendars = [];
    
    data.items.forEach(cal => {
      // Name resolution (priority as specified)
      let displayName;
      
      // 1. If summaryOverride exists and is non-empty → use it
      if (cal.summaryOverride && cal.summaryOverride.trim() !== '') {
        displayName = cal.summaryOverride;
      }
      // 2. Else if summary exists and is not an email-like string → use it
      else if (cal.summary && cal.summary.trim() !== '' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cal.summary)) {
        displayName = cal.summary;
      }
      // 3. Else if summary looks like an email → attempt to resolve friendly name
      else if (cal.summary && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cal.summary)) {
        if (cal.primary && userInfo && userInfo.name) {
          displayName = userInfo.name;
          console.log(`[DEBUG] RESOLVED_NAME_FOR_PRIMARY: ${displayName}`);
        } else if (cal.primary) {
          displayName = `Primary calendar (${cal.summary})`;
          console.log(`[DEBUG] RESOLVED_NAME_FOR_PRIMARY: ${displayName} (fallback)`);
        } else {
          displayName = cal.summary;
        }
      }
      // 4. Final fallback
      else {
        displayName = cal.primary ? 'My Calendar' : 'Untitled Calendar';
      }
      
      console.log(`[Google Calendar] Processing: ${cal.id}`);
      console.log(`  - summary: "${cal.summary}"`);
      console.log(`  - summaryOverride: "${cal.summaryOverride || 'none'}"`);
      console.log(`  - displayName: "${displayName}"`);
      console.log(`  - primary: ${cal.primary}, accessRole: ${cal.accessRole}`);
      console.log(`  - isEmailLike: ${/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cal.summary || '')}`);
      
      // Build normalized object with exact fields
      const calendarData = {
        id: cal.id,
        name: displayName,
        primary: Boolean(cal.primary),
        accessRole: cal.accessRole,
        selected: Boolean(cal.selected),
        backgroundColor: cal.backgroundColor || cal.colorId || null,
        timeZone: cal.timeZone || null,
        description: cal.description || null,
        hidden: Boolean(cal.hidden) || false
      };
      
      // Authoritative mapping rules:
      // myCalendars — calendars where accessRole === 'owner' OR primary === true
      // otherCalendars — calendars where accessRole !== 'owner' and primary !== true
      if (cal.accessRole === 'owner' || cal.primary === true) {
        myCalendars.push(calendarData);
      } else {
        otherCalendars.push(calendarData);
      }
    });
    
    // Sorting rules (exact)
    // Primary calendar always first in myCalendars, then alphabetical
    myCalendars.sort((a, b) => {
      if (a.primary && !b.primary) return -1;
      if (!a.primary && b.primary) return 1;
      return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
    });
    
    // otherCalendars sorted alphabetically by name (case-insensitive)
    otherCalendars.sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));
    
    const mappedCalendars = {
      myCalendars,
      otherCalendars,
      allCalendars: [...myCalendars, ...otherCalendars]
    };
    
    console.log('[DEBUG] MAPPED_CALENDARS:');
    console.log('myCalendars:', JSON.stringify(myCalendars, null, 2));
    console.log('otherCalendars:', JSON.stringify(otherCalendars, null, 2));
    console.log('allCalendars:', JSON.stringify(mappedCalendars.allCalendars, null, 2));
    
    return mappedCalendars;
  } catch (error) {
    console.error('Error fetching Google calendars:', error);
    throw error;
  }
}

async function getGoogleUserInfo() {
  try {
    const tokens = await getGoogleToken();
    
    // Try to get user info from stored tokens first
    if (tokens.user_info) {
      return tokens.user_info;
    }
    
    // If not available, fetch from Google's userinfo endpoint
    const response = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
      headers: {
        'Authorization': `Bearer ${tokens.access_token}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (response.ok) {
      const userInfo = await response.json();
      console.log('[DEBUG] PROFILE_NAME:', userInfo.name);
      return userInfo;
    } else {
      console.log('[DEBUG] PROFILE_NAME: null (API error)');
      return null;
    }
  } catch (error) {
    console.error('Error getting Google user info:', error);
    console.log('[DEBUG] PROFILE_NAME: null (exception)');
    return null;
  }
}

function getSampleCalendars() {
  // Return sample data in the NEW object format for testing
  const myCalendars = [
    {
      id: 'primary',
      name: 'Daniel Kraemer',
      primary: true,
      accessRole: 'owner',
      selected: false,
      backgroundColor: '#3174ad',
      timeZone: 'America/New_York',
      description: null,
      hidden: false
    },
    {
      id: 'personal@gmail.com',
      name: 'Personal',
      primary: false,
      accessRole: 'owner',
      selected: false,
      backgroundColor: '#16a765',
      timeZone: 'America/New_York',
      description: null,
      hidden: false
    }
  ];
  
  const otherCalendars = [
    {
      id: 'addressbook#contacts@group.v.calendar.google.com',
      name: 'Birthdays',
      primary: false,
      accessRole: 'reader',
      selected: false,
      backgroundColor: '#9a9cff',
      timeZone: 'America/New_York',
      description: 'Displays birthdays of people in Google Contacts',
      hidden: false
    },
    {
      id: 'en.usa#holiday@group.v.calendar.google.com',
      name: 'Holidays in United States',
      primary: false,
      accessRole: 'reader',
      selected: false,
      backgroundColor: '#0d7377',
      timeZone: 'America/New_York',
      description: 'Holidays and observances in United States',
      hidden: false
    }
  ];
  
  return {
    myCalendars,
    otherCalendars,
    allCalendars: [...myCalendars, ...otherCalendars]
  };
  
  // OLD FORMAT - keeping for reference
  /*
  return [
    {
      id: 'primary',
      name: 'Primary Calendar',
      primary: true,
      accessRole: 'owner',
      backgroundColor: '#1976d2',
      description: 'Your main calendar',
      timeZone: 'America/New_York',
      _demo: true
    },
    {
      id: 'work@example.com',
      name: 'Work Calendar',
      primary: false,
      accessRole: 'owner',
      backgroundColor: '#f44336',
      description: 'Work-related events',
      timeZone: 'America/New_York',
      _demo: true
    },
    {
      id: 'personal@example.com',
      name: 'Personal Calendar',
      primary: false,
      accessRole: 'owner',
      backgroundColor: '#4caf50',
      description: 'Personal events and appointments',
      timeZone: 'America/New_York',
      _demo: true
    }
  ];
  */
}

async function getCalendarEvents(calendarId, timeMin, timeMax) {
  try {
    const tokens = await getGoogleToken();
    
    const params = new URLSearchParams({
      timeMin: timeMin || new Date().toISOString(),
      timeMax: timeMax || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days from now
      singleEvents: 'true',
      orderBy: 'startTime',
      maxResults: '250'
    });
    
    const response = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?${params}`, {
      headers: {
        'Authorization': `Bearer ${tokens.access_token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Google Calendar API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const events = data.items || [];
    console.log(`[Google Calendar] Fetched ${events.length} events from calendar ${calendarId}`);
    
    // 🔍 ENHANCED DEBUG: Log full event structure to understand calendar filtering
    if (events.length > 0) {
      const organizerEmails = [...new Set(events.map(e => e.organizer?.email).filter(Boolean))];
      console.log(`[Google Calendar] Organizer emails found:`, organizerEmails);
      
      // Log first event's full structure for debugging
      const sampleEvent = events[0];
      console.log(`[DEBUG] Sample event structure:`, {
        id: sampleEvent.id,
        summary: sampleEvent.summary,
        organizer: sampleEvent.organizer,
        creator: sampleEvent.creator,
        iCalUID: sampleEvent.iCalUID,
        requestedCalendarId: calendarId
      });
    }
    
    return events;
  } catch (error) {
    console.error('Error fetching Google Calendar events:', error);
    throw error;
  }
}

async function createCalendarEvent(calendarId, event) {
  try {
    const tokens = await getGoogleToken();
    
    const response = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${tokens.access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(event)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Google Calendar API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log(`[Google Calendar] Created event: ${data.summary} (${data.id})`);
    return data;
  } catch (error) {
    console.error('Error creating Google Calendar event:', error);
    throw error;
  }
}

async function updateCalendarEvent(calendarId, eventId, event) {
  try {
    const tokens = await getGoogleToken();
    
    const response = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${eventId}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${tokens.access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(event)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Google Calendar API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log(`[Google Calendar] Updated event: ${data.summary} (${data.id})`);
    return data;
  } catch (error) {
    console.error('Error updating Google Calendar event:', error);
    throw error;
  }
}

async function deleteCalendarEvent(calendarId, eventId) {
  try {
    const tokens = await getGoogleToken();

    const response = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${eventId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${tokens.access_token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok && response.status !== 204) {
      const errorText = await response.text();
      throw new Error(`Google Calendar API error: ${response.status} - ${errorText}`);
    }

    console.log(`[Google Calendar] Deleted event: ${eventId}`);
    return { success: true };
  } catch (error) {
    console.error('Error deleting Google Calendar event:', error);
    throw error;
  }
}

module.exports = {
  listGoogleCalendars,
  getGoogleUserInfo,
  getCalendarEvents,
  createCalendarEvent,
  updateCalendarEvent,
  deleteCalendarEvent
};